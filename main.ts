import {
  Plugin,
  PluginSettingTab,
  Setting,
  Editor,
  FileSystemAdapter,
  Menu,
  App
} from "obsidian";
import { execFile } from "child_process";
import * as path from "path";

type InterceptShortcut = "ctrl+v" | "shift+insert" | "both";

type PasteMode = "default+source" | "clipboard+source";

type CitationStyle = "OneNote" | "Source";

interface PasteWithSourceSettings {
  interceptPaste: boolean;
  interceptShortcut: InterceptShortcut;
  pasteMode: PasteMode;
  citationStyle: CitationStyle;
  useUrlAsLinkLabel: boolean;
}

const DEFAULT_SETTINGS: PasteWithSourceSettings = {
  interceptPaste: true,
  interceptShortcut: "both",
  pasteMode: "default+source",
  citationStyle: "OneNote",
  useUrlAsLinkLabel: true,
};

// ---------------------------------------------------------------------------
// Platform Clipboard Abstraction
// ---------------------------------------------------------------------------

export interface IClipboardSourceProvider {
  getSourceUrl(): Promise<string>;
}

/**
 * Lightweight in-memory Apple Binary Property List (bplist00) decoder
 * specialized for extracting WebResourceURL from Safari com.apple.webarchive buffers.
 */
export class BplistParser {
  static extractSourceUrl(buf: Buffer): string {
    try {
      if (!buf || buf.length < 40) return "";
      if (buf.subarray(0, 8).toString("ascii") !== "bplist00") {
        return this.fallbackRegexUrl(buf);
      }

      const trailerOffset = buf.length - 32;
      const offsetIntSize = buf.readUInt8(trailerOffset + 6);
      const objectRefSize = buf.readUInt8(trailerOffset + 7);
      const numObjects = Number(buf.readBigUInt64BE(trailerOffset + 8));
      const topObject = Number(buf.readBigUInt64BE(trailerOffset + 16));
      const offsetTableOffset = Number(buf.readBigUInt64BE(trailerOffset + 24));

      if (offsetIntSize === 0 || objectRefSize === 0 || numObjects === 0) {
        return this.fallbackRegexUrl(buf);
      }

      const getOffset = (objIndex: number): number => {
        const ptr = offsetTableOffset + objIndex * offsetIntSize;
        if (ptr + offsetIntSize > trailerOffset) return -1;
        if (offsetIntSize === 1) return buf.readUInt8(ptr);
        if (offsetIntSize === 2) return buf.readUInt16BE(ptr);
        if (offsetIntSize === 4) return buf.readUInt32BE(ptr);
        return Number(buf.readBigUInt64BE(ptr));
      };

      const parseObject = (objIndex: number, depth = 0): any => {
        if (depth > 10) return null; // recursion guard
        const offset = getOffset(objIndex);
        if (offset < 8 || offset >= offsetTableOffset) return null;

        const marker = buf.readUInt8(offset);
        const objType = marker & 0xf0;
        let count = marker & 0x0f;
        let dataStart = offset + 1;

        // Count extension if count == 0x0F
        if (count === 0x0f) {
          const intMarker = buf.readUInt8(dataStart);
          const intBytes = 1 << (intMarker & 0x0f);
          dataStart += 1;
          if (intBytes === 1) count = buf.readUInt8(dataStart);
          else if (intBytes === 2) count = buf.readUInt16BE(dataStart);
          else if (intBytes === 4) count = buf.readUInt32BE(dataStart);
          dataStart += intBytes;
        }

        // ASCII String (0x50)
        if (objType === 0x50) {
          if (dataStart + count > buf.length) return null;
          return buf.subarray(dataStart, dataStart + count).toString("ascii");
        }

        // UTF-16BE String (0x60)
        if (objType === 0x60) {
          const byteLen = count * 2;
          if (dataStart + byteLen > buf.length) return null;
          return buf.subarray(dataStart, dataStart + byteLen).swap16().toString("utf16le");
        }

        // Dictionary (0xD0)
        if (objType === 0xd0) {
          const dict: Record<string, any> = {};
          const keysStart = dataStart;
          const valsStart = dataStart + count * objectRefSize;

          const readRef = (pos: number) => {
            if (objectRefSize === 1) return buf.readUInt8(pos);
            if (objectRefSize === 2) return buf.readUInt16BE(pos);
            return buf.readUInt32BE(pos);
          };

          for (let i = 0; i < count; i++) {
            const keyIndex = readRef(keysStart + i * objectRefSize);
            const valIndex = readRef(valsStart + i * objectRefSize);
            const key = parseObject(keyIndex, depth + 1);
            if (typeof key === "string") {
              if (key === "WebMainResource" || key === "WebResourceURL") {
                dict[key] = parseObject(valIndex, depth + 1);
              }
            }
          }
          return dict;
        }

        return null;
      };

      const root = parseObject(topObject);
      const url = root?.WebMainResource?.WebResourceURL ?? root?.WebResourceURL;
      if (typeof url === "string" && url.trim().startsWith("http")) {
        return url.trim();
      }
    } catch (e) {
      console.warn("BplistParser exception, falling back to regex:", e);
    }

    return this.fallbackRegexUrl(buf);
  }

  private static fallbackRegexUrl(buf: Buffer): string {
    try {
      const text = buf.toString("latin1");
      const keyPos = text.indexOf("WebResourceURL");
      if (keyPos !== -1) {
        const slice = text.substring(keyPos, keyPos + 1000);
        const match = slice.match(/https?:\/\/[^\s<>"'\0\x01-\x1f]+/);
        if (match) return match[0].trim();
      }
      const generalMatch = text.match(/https?:\/\/[^\s<>"'\0\x01-\x1f]+/);
      if (generalMatch) return generalMatch[0].trim();
    } catch {
      // ignore
    }
    return "";
  }
}

/**
 * macOS In-Process Clipboard Provider
 * Supports Chromium browsers (Chrome, Edge, Brave, Arc, Opera) and Safari
 */
export class MacOSClipboardProvider implements IClipboardSourceProvider {
  async getSourceUrl(): Promise<string> {
    try {
      // Dynamically resolve electron clipboard in Obsidian desktop environment
      const electron = (window as any).require
        ? (window as any).require("electron")
        : require("electron");

      if (!electron || !electron.clipboard) {
        return "";
      }

      const clipboard = electron.clipboard;

      // 1. Check Chromium family (org.chromium.source-url)
      const chromiumUrl = clipboard.read("org.chromium.source-url");
      if (typeof chromiumUrl === "string" && chromiumUrl.trim().startsWith("http")) {
        return chromiumUrl.trim();
      }

      // 2. Check Safari (com.apple.webarchive)
      const webArchiveBuf: Buffer = clipboard.readBuffer("com.apple.webarchive");
      if (webArchiveBuf && webArchiveBuf.length > 8) {
        const safariUrl = BplistParser.extractSourceUrl(webArchiveBuf);
        if (safariUrl && safariUrl.trim().startsWith("http")) {
          return safariUrl.trim();
        }
      }

      // 3. Fallback: public.url
      const publicUrl = clipboard.read("public.url");
      if (typeof publicUrl === "string" && publicUrl.trim().startsWith("http")) {
        return publicUrl.trim();
      }
    } catch (err) {
      console.warn("PasteWithSource: Error accessing macOS clipboard:", err);
    }
    return "";
  }
}

/**
 * Windows Native Process Clipboard Provider
 * Invokes bundled ClipboardReader.exe to parse CF_HTML
 */
export class WindowsClipboardProvider implements IClipboardSourceProvider {
  constructor(private app: App) {}

  async getSourceUrl(): Promise<string> {
    return new Promise((resolve) => {
      (process as any).noAsar = true;

      const adapter = this.app.vault.adapter;
      const basePath = (adapter instanceof FileSystemAdapter)
        ? adapter.getBasePath()
        : "";

      const exePath = path.join(
        basePath,
        ".obsidian",
        "plugins",
        "paste-with-source",
        "ClipboardReader.exe"
      );

      execFile(exePath, [], (error, stdout, stderr) => {
        if (error) {
          console.error("ClipboardReader.exe failed:", error);
          if (stderr) console.error("stderr:", stderr);
          resolve("");
          return;
        }

        const sourceUrl = typeof stdout === "string" ? stdout.trim() : "";
        const isValid = sourceUrl.startsWith("http");
        resolve(isValid ? sourceUrl : "");
      });
    });
  }
}

/**
 * Fallback provider for unsupported environments
 */
export class NullClipboardProvider implements IClipboardSourceProvider {
  async getSourceUrl(): Promise<string> {
    return "";
  }
}

export function createClipboardProvider(app: App): IClipboardSourceProvider {
  if (process.platform === "darwin") {
    return new MacOSClipboardProvider();
  } else if (process.platform === "win32") {
    return new WindowsClipboardProvider(app);
  }
  return new NullClipboardProvider();
}

// ---------------------------------------------------------------------------
// Main Plugin Class
// ---------------------------------------------------------------------------

export default class PasteWithSourcePlugin extends Plugin {
  settings!: PasteWithSourceSettings;
  clipboardProvider!: IClipboardSourceProvider;

  async onload() {
    await this.loadSettings();
    this.clipboardProvider = createClipboardProvider(this.app);
    this.addSettingTab(new PasteWithSourceSettingTab(this));

    this.addCommand({
      id: "paste-default-plus-source",
      name: "Paste (Default) + Source URL",
      callback: async () => {
        const editor = this.app.workspace.activeEditor?.editor;
        if (editor) await this.pasteDefaultPlusSource(editor);
      },
    });

    this.addCommand({
      id: "paste-with-source-url",
      name: "Paste with Source URL",
      callback: async () => {
        const editor = this.app.workspace.activeEditor?.editor;
        if (editor) await this.pasteWithSource(editor);
      },
    });

    // Add context menu items
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
        menu.addItem((item) =>
          item
            .setTitle("Paste (Default Handler) + Source URL")
            .setIcon("clipboard")
            .onClick(() => this.pasteDefaultPlusSource(editor))
        );
        menu.addItem((item) =>
          item
            .setTitle("Paste Clipboard with Source URL")
            .setIcon("paste")
            .onClick(() => this.pasteWithSource(editor))
        );
      })
    );

    // Intercept paste via keyboard shortcut
    this.registerDomEvent(document, "keydown", async (event: KeyboardEvent) => {
      if (!this.settings.interceptPaste) return;

      const isMac = process.platform === "darwin";
      const isCmdV = isMac && event.metaKey && event.key.toLowerCase() === "v";
      const isCtrlV = !isMac && event.ctrlKey && event.key.toLowerCase() === "v";
      const isShiftInsert = !isMac && event.shiftKey && event.key === "Insert";

      const shouldIntercept =
        (this.settings.interceptShortcut === "both" && (isCmdV || isCtrlV || isShiftInsert)) ||
        (this.settings.interceptShortcut === "ctrl+v" && (isCmdV || isCtrlV)) ||
        (this.settings.interceptShortcut === "shift+insert" && isShiftInsert);

      if (!shouldIntercept) return;

      const editor = this.app.workspace.activeEditor?.editor;
      if (!editor) return;

      const sourceUrl = await this.getClipboardSourceUrl();

      if (this.settings.pasteMode === "clipboard+source") {
        event.preventDefault();
        const clipboardText = await navigator.clipboard.readText();
        const sourceLink = sourceUrl ? this.getSourceLinkMarkdown(sourceUrl) : "";
        editor.replaceSelection(clipboardText + sourceLink);
      } else if (this.settings.pasteMode === "default+source") {
        setTimeout(() => {
          if (sourceUrl) {
            editor.replaceSelection(this.getSourceLinkMarkdown(sourceUrl));
          }
        }, 50);
      }
    });
  }

  getSourceLinkMarkdown(url: string): string {
    if (this.settings.citationStyle === "OneNote") {
      return `\n\nFrom <${this.formatSourceLink(url)}>`;
    } else {
      return `\n\n> — ${this.formatSourceLink(url)}`;
    }
  }

  formatSourceLink(url: string): string {
    return this.settings.useUrlAsLinkLabel
      ? `[${url}](${url})`
      : `[Source](${url})`;
  }

  async pasteWithSource(editor: Editor) {
    const clipboardText = await navigator.clipboard.readText();
    const sourceUrl = await this.getClipboardSourceUrl();
    const sourceLink = sourceUrl ? this.getSourceLinkMarkdown(sourceUrl) : "";
    editor.replaceSelection(clipboardText + sourceLink);
  }

  async pasteSourceOnly(editor: Editor) {
    const sourceUrl = await this.getClipboardSourceUrl();
    if (sourceUrl) {
      editor.replaceSelection(this.formatSourceLink(sourceUrl));
    } else {
      console.warn("No valid SourceURL found.");
    }
  }

  async pasteDefaultPlusSource(editor: Editor) {
    const sourceUrl = await this.getClipboardSourceUrl();
    if (!sourceUrl) return;

    setTimeout(() => {
      editor.replaceSelection(this.getSourceLinkMarkdown(sourceUrl));
    }, 50);
  }

  async getClipboardSourceUrl(): Promise<string> {
    return this.clipboardProvider.getSourceUrl();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class PasteWithSourceSettingTab extends PluginSettingTab {
  plugin: PasteWithSourcePlugin;

  constructor(plugin: PasteWithSourcePlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Paste with Source Settings" });

    const isMac = process.platform === "darwin";

    new Setting(containerEl)
      .setName("Intercept Paste")
      .setDesc("Automatically replace paste operation with a source-aware paste")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.interceptPaste)
          .onChange(async (value) => {
            this.plugin.settings.interceptPaste = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Intercept Shortcut")
      .setDesc(isMac ? "Choose which keyboard shortcut to intercept" : "Choose which keyboard shortcut(s) to intercept")
      .addDropdown((dropdown) => {
        if (isMac) {
          dropdown
            .addOption("both", "Cmd+V (Default)")
            .addOption("ctrl+v", "Cmd+V only");
        } else {
          dropdown
            .addOption("both", "Both Ctrl+V and Shift+Insert")
            .addOption("ctrl+v", "Ctrl+V only")
            .addOption("shift+insert", "Shift+Insert only");
        }
        dropdown
          .setValue(this.plugin.settings.interceptShortcut)
          .onChange(async (value: string) => {
            this.plugin.settings.interceptShortcut = value as InterceptShortcut;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Paste Mode")
      .setDesc("Choose what to insert when intercepting paste")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("default+source", "Default handler + source")
          .addOption("clipboard+source", "Paste content + source")
          .setValue(this.plugin.settings.pasteMode)
          .onChange(async (value: string) => {
            this.plugin.settings.pasteMode = value as PasteMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Citation Style")
      .setDesc("Choose the style of the citation")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("OneNote", "OneNote-style From <...> links")
          .addOption("Source", "Simple 'Source' markdown link")
          .setValue(this.plugin.settings.citationStyle)
          .onChange(async (value: string) => {
            this.plugin.settings.citationStyle = value as CitationStyle;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Use URL as Link Label")
      .setDesc("Format links as [url](url) instead of [Source](url)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useUrlAsLinkLabel)
          .onChange(async (value) => {
            this.plugin.settings.useUrlAsLinkLabel = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
