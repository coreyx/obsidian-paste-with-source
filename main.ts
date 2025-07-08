import {
  Plugin,
  PluginSettingTab,
  Setting,
  Editor,
  FileSystemAdapter,
  Menu
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

export default class PasteWithSourcePlugin extends Plugin {
  settings!: PasteWithSourceSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new PasteWithSourceSettingTab(this));

    this.addCommand({
      id: "paste-default-plus-source",
      name: "Paste (Default) + Source URL",
      callback: async () => {
        const editor = this.app.workspace.activeEditor?.editor;
        if (editor) await this.pasteDefaultPlusSource(editor);
      },
    });
	
    // Register commands
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

	  const isMac = navigator.platform.toUpperCase().includes("MAC");
	  const isCtrlV =
		(isMac && event.metaKey && event.key === "v") ||
		(!isMac && event.ctrlKey && event.key === "v");
	  const isShiftInsert = !isMac && event.shiftKey && event.key === "Insert";

	  const shouldIntercept =
		(this.settings.interceptShortcut === "both" && (isCtrlV || isShiftInsert)) ||
		(this.settings.interceptShortcut === "ctrl+v" && isCtrlV) ||
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
    if (this.settings.citationStyle === "OneNote")
		return `\n\nFrom <${this.formatSourceLink(url)}>`
	else
		return `\n\n> — ${this.formatSourceLink(url)}`	
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
	  .setDesc("Choose which keyboard shortcut(s) to intercept")
	  .addDropdown((dropdown) =>
		dropdown
		  .addOption("both", "Both Ctrl+V and Shift+Insert")
		  .addOption("ctrl+v", "Ctrl+V only")
		  .addOption("shift+insert", "Shift+Insert only")
		  .setValue(this.plugin.settings.interceptShortcut)
		  .onChange(async (value: string) => {
			this.plugin.settings.interceptShortcut = value as InterceptShortcut;
			await this.plugin.saveSettings();
		  })
	  );

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
