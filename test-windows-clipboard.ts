// Mock 'obsidian' module so main.ts can be required in standalone Node.js test environment
const Module = require("module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string, ...rest: any[]) {
  if (id === "obsidian") {
    return {
      Plugin: class {},
      PluginSettingTab: class {},
      Setting: class {},
      Modal: class {},
      Notice: class {},
    };
  }
  return originalRequire.apply(this, [id, ...rest]);
};

import PasteWithSourcePlugin, { parseInternalSourceUrl, WindowsClipboardProvider } from "./main";

let failures = 0;

/** Records one check and prints it, with what was actually produced when it fails. */
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${ok ? "" : ` (got ${JSON.stringify(actual)})`}`);
}

const SOURCE_FORMAT = "Chromium internal source URL";
const PREFIXED_SOURCE_FORMAT = `electron application/osclipboard;format="${SOURCE_FORMAT}"`;

/**
 * Builds a WindowsClipboardProvider over a fake clipboard holding `formats` (format
 * name to contents), with the setting read from `setting.on`. The PowerShell
 * fallback is replaced, so nothing is spawned: it answers "from PowerShell" and
 * counts its runs.
 */
function provider(formats: Record<string, string>, setting = { on: true }) {
  (globalThis as any).window = {
    require: () => ({ clipboard: { readBuffer: (format: string) => Buffer.from(formats[format] ?? "", "utf8") } }),
  };
  const result = { provider: new WindowsClipboardProvider(() => setting.on), powerShellRuns: 0 };
  (result.provider as any).executePowerShellFallback = async () => {
    result.powerShellRuns++;
    return "from PowerShell";
  };
  return result;
}

const HTML_WITH_SOURCE = "Version:0.9\r\nStartHTML:0\r\nSourceURL:https://html.example.com/page\r\n<html></html>";

(async () => {
  console.log("Running Windows clipboard tests...");

  console.log("\nparseInternalSourceUrl");
  check("a URL with Chromium's trailing NUL", parseInternalSourceUrl(Buffer.from("https://example.com/test-page\0")),
    "https://example.com/test-page");
  check("a URL without a NUL", parseInternalSourceUrl(Buffer.from("https://example.com/a")), "https://example.com/a");
  check("surrounding whitespace is trimmed", parseInternalSourceUrl(Buffer.from("  https://example.com/a \r\n\0")),
    "https://example.com/a");
  check("the scheme matches case-insensitively", parseInternalSourceUrl(Buffer.from("HTTP://example.com/\0")), "HTTP://example.com/");
  check("non-ASCII paths decode as UTF-8", parseInternalSourceUrl(Buffer.from("https://example.com/café\0", "utf8")),
    "https://example.com/café");
  check("an empty buffer gives nothing", parseInternalSourceUrl(Buffer.alloc(0)), "");
  check("a value that isn't a URL gives nothing", parseInternalSourceUrl(Buffer.from("not a url\0")), "");
  check("Obsidian's own app:// page gives nothing", parseInternalSourceUrl(Buffer.from("app://obsidian.md/index.html\0")), "");
  check("VS Code's vscode-file:// page gives nothing",
    parseInternalSourceUrl(Buffer.from("vscode-file://vscode-app/c:/Program%20Files/workbench.html\0")), "");

  console.log("\nRead order");
  {
    const p = provider({ "HTML Format": HTML_WITH_SOURCE, [SOURCE_FORMAT]: "https://other.example.com/\0" });
    check("HTML Format's SourceURL wins over Chromium's source URL", await p.provider.getSourceUrl(), "https://html.example.com/page");
  }
  {
    const p = provider({ [SOURCE_FORMAT]: "https://example.com/test-page\0" });
    check("a plain-text copy takes Chromium's source URL", await p.provider.getSourceUrl(), "https://example.com/test-page");
    check("... without running PowerShell", p.powerShellRuns, 0);
  }
  {
    const p = provider({ [PREFIXED_SOURCE_FORMAT]: "https://example.com/prefixed\0" });
    check("the Electron-prefixed format name is tried when the bare one is empty", await p.provider.getSourceUrl(),
      "https://example.com/prefixed");
  }
  {
    const p = provider({ "HTML Format": "<html>no source header</html>", [SOURCE_FORMAT]: "https://example.com/a\0" });
    check("HTML Format without a SourceURL falls through to Chromium's", await p.provider.getSourceUrl(), "https://example.com/a");
  }
  {
    const p = provider({ [SOURCE_FORMAT]: "https://example.com/test-page\0" }, { on: false });
    check("with the setting off, Chromium's source URL is ignored", await p.provider.getSourceUrl(), "from PowerShell");
    check("... and PowerShell runs", p.powerShellRuns, 1);
  }
  {
    const p = provider({ [SOURCE_FORMAT]: "app://obsidian.md/index.html\0" });
    check("a source URL that isn't http(s) falls through to PowerShell", await p.provider.getSourceUrl(), "from PowerShell");
  }
  {
    const p = provider({});
    check("an empty clipboard falls through to PowerShell", await p.provider.getSourceUrl(), "from PowerShell");
  }
  {
    const setting = { on: false };
    const p = provider({ [SOURCE_FORMAT]: "https://example.com/test-page\0" }, setting);
    const before = await p.provider.getSourceUrl();
    setting.on = true;
    const after = await p.provider.getSourceUrl();
    check("turning the setting on applies to the next read, without a new provider", [before, after],
      ["from PowerShell", "https://example.com/test-page"]);
  }
  {
    const p = provider({});
    (globalThis as any).window = {
      require: () => ({ clipboard: { readBuffer: () => { throw new Error("clipboard busy"); } } }),
    };
    // The provider logs the failure as a warning; keep it out of the test output.
    const warn = console.warn;
    console.warn = () => {};
    const url = await p.provider.getSourceUrl();
    console.warn = warn;
    check("a clipboard that throws falls through to PowerShell", url, "from PowerShell");
  }

  console.log("\nPowerShell script");
  const withSource = WindowsClipboardProvider.powerShellScript(true);
  const withoutSource = WindowsClipboardProvider.powerShellScript(false);
  check("with the setting on, it reads Chromium's source URL", withSource.includes(`GetData('${SOURCE_FORMAT}')`), true);
  check("with the setting off, it doesn't", withoutSource.includes(SOURCE_FORMAT), false);
  check("both read HTML Format's SourceURL first", [withSource, withoutSource].every((s) => s.includes("SourceURL:")), true);
  check("neither contains a double quote, since it's passed inside them", /"/.test(withSource + withoutSource), false);

  console.log("\nSettings loading");
  /** What `stored` loads readChromiumSourceUrl as. */
  async function loaded(stored: object | null): Promise<boolean> {
    const plugin = new PasteWithSourcePlugin({} as any, {} as any) as any;
    plugin.loadData = async () => stored;
    await plugin.loadSettings();
    return plugin.settings.readChromiumSourceUrl;
  }
  check("a fresh install has it on", await loaded(null), true);
  check("a stored false is kept", await loaded({ readChromiumSourceUrl: false }), false);
  check("a value that isn't a boolean resets to on", await loaded({ readChromiumSourceUrl: "no" }), true);

  console.log("\nChromium paste command");
  /** What Obsidian's own paste puts in the note in these tests, so it can be told apart from the plugin's inserts. */
  const NATIVE_PASTE = "<Obsidian's paste>";
  /**
   * Loads the plugin as if on `platform`, over a fake clipboard holding `formats` and
   * the text "pasted text", with `readChromiumSourceUrl` stored as `setting` and
   * `pasteMode` as stored. The cursor sits at the end of `line`. Electron's remote
   * paste is faked: it records a call, inserts NATIVE_PASTE and fires a paste event,
   * unless `pasteFires` is false, and `remote: false` leaves it out altogether.
   * Runs what `invoke` names, the Chromium command by default, and waits for its
   * citation. Both providers' PowerShell fallbacks are stubbed, so nothing is spawned.
   */
  async function loadOn(
    platform: string,
    formats: Record<string, string>,
    options: {
      setting?: boolean;
      pasteMode?: string;
      line?: string;
      remote?: boolean;
      pasteFires?: boolean;
      invoke?: "chromium" | "default-command" | "default-menu";
    } = {}
  ) {
    const { setting = false, pasteMode = "default+source", line = "", remote = true, pasteFires = true, invoke = "chromium" } = options;
    const realPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
    const inserted: string[] = [];
    let focused = false;
    const editor = {
      getLine: () => line,
      lineCount: () => 1,
      getCursor: () => ({ line: 0, ch: line.length }),
      replaceSelection: (value: string) => inserted.push(value),
      hasFocus: () => focused,
      focus: () => (focused = true),
      posToOffset: () => 0,
    };
    const commands: any[] = [];
    const menuHandlers: Array<(menu: any, editor: any, info: any) => void> = [];
    const plugin = new PasteWithSourcePlugin({} as any, {} as any) as any;
    try {
      const on = (name: string, handler: any) => {
        if (name === "editor-menu") menuHandlers.push(handler);
        return {};
      };
      plugin.app = { workspace: { activeEditor: { editor }, on, onLayoutReady: () => {}, iterateAllLeaves: () => {} } };
      plugin.loadData = async () => ({ readChromiumSourceUrl: setting, pasteMode });
      plugin.addSettingTab = () => {};
      plugin.addCommand = (command: any) => commands.push(command);
      plugin.registerEvent = () => {};
      plugin.registerDomEvent = () => {};
      (globalThis as any).document = {};
      await plugin.onload();
    } finally {
      Object.defineProperty(process, "platform", realPlatform);
    }
    plugin.titleFetcher = async () => undefined;
    for (const p of [plugin.clipboardProvider, plugin.chromiumClipboardProvider]) {
      if (p) p.executePowerShellFallback = async () => "";
    }
    (globalThis as any).window = {
      require: () => ({ clipboard: { readBuffer: (format: string) => Buffer.from(formats[format] ?? "", "utf8") } }),
    };
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { readText: async () => "pasted text" } },
      configurable: true,
    });
    const pasteListeners = new Set<() => void>();
    (globalThis as any).activeDocument = {
      addEventListener: (type: string, listener: () => void) => type === "paste" && pasteListeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => pasteListeners.delete(listener),
    };
    let electronPastes = 0;
    const webContents = {
      paste: () => {
        electronPastes++;
        if (!pasteFires) return;
        // Electron's paste arrives after the request returns, as it does in Obsidian. Arriving later
        // than Ctrl+V's fixed 50 ms shows the citation waits for the paste rather than for the clock.
        setTimeout(() => {
          inserted.push(NATIVE_PASTE);
          for (const listener of [...pasteListeners]) listener();
        }, 70);
      },
    };
    (globalThis as any).activeWindow = remote ? { electron: { remote: { getCurrentWebContents: () => webContents } } } : {};
    const command = commands.find((c) => c.id === "paste-with-source-url-chromium");
    if (invoke === "chromium") {
      if (command) await command.callback();
    } else if (invoke === "default-command") {
      await commands.find((c) => c.id === "paste-default-plus-source").callback();
    } else {
      // A stand-in for Obsidian's editor menu, collecting each item's title and click handler.
      const items: any[] = [];
      const menu = {
        addItem: (build: (item: any) => void) => {
          const item: any = {
            setTitle: (title: string) => ((item.title = title), item),
            setIcon: () => item,
            onClick: (click: () => unknown) => ((item.click = click), item),
          };
          build(item);
          items.push(item);
        },
      };
      for (const handler of menuHandlers) handler(menu, editor, { editor });
      await items.find((item) => item.title === "Paste (Default Handler) + Source URL").click();
    }
    // A citation after a native paste waits 50 ms.
    await new Promise((resolve) => setTimeout(resolve, 80));
    return { command, inserted, plugin, electronPastes: () => electronPastes, focused: () => focused };
  }

  const PLAIN_TEXT_COPY = { [SOURCE_FORMAT]: "https://example.com/test-page\0" };
  const CITATION = "\n\nFrom: [https://example.com/test-page](https://example.com/test-page) – example.com";
  {
    const { command } = await loadOn("win32", PLAIN_TEXT_COPY);
    check("it's registered on Windows with its id and name", command && [command.id, command.name],
      ["paste-with-source-url-chromium", "Paste, citing Chromium plain-text copies"]);
    check("its default hotkey is Mod+Alt+V, which is Ctrl+Alt+V on Windows", command?.hotkeys, [{ modifiers: ["Mod", "Alt"], key: "V" }]);
  }
  {
    const run = await loadOn("win32", PLAIN_TEXT_COPY);
    check("default mode: it focuses the editor and requests one Electron paste", [run.focused(), run.electronPastes()], [true, 1]);
    check("... lets Obsidian paste, then cites Chromium's source URL with the setting off", run.inserted, [NATIVE_PASTE, CITATION]);
    check("... while ordinary pastes still ignore Chromium's source URL", await run.plugin.clipboardProvider.getSourceUrl(), "");
  }
  {
    const { inserted } = await loadOn("win32", { "HTML Format": HTML_WITH_SOURCE, ...PLAIN_TEXT_COPY });
    check("HTML Format's SourceURL still wins over Chromium's",
      inserted.length === 2 && inserted[0] === NATIVE_PASTE && inserted[1].includes("(https://html.example.com/page)"), true);
  }
  {
    const { inserted } = await loadOn("win32", {});
    check("with no source URL anywhere, only Obsidian's paste goes in", inserted, [NATIVE_PASTE]);
  }
  {
    const run = await loadOn("win32", PLAIN_TEXT_COPY, { pasteMode: "clipboard+source" });
    check("content mode: plain text plus the citation, with no Electron paste", [run.inserted, run.electronPastes()],
      [[`pasted text${CITATION}`], 0]);
  }
  {
    const run = await loadOn("win32", PLAIN_TEXT_COPY, { line: "see `code " });
    check("inside inline code: Obsidian's paste, with no citation", [run.inserted, run.electronPastes()], [[NATIVE_PASTE], 1]);
  }
  {
    const run = await loadOn("win32", PLAIN_TEXT_COPY, { remote: false });
    check("without Electron's remote: the plain text, then the citation", run.inserted, [`pasted text${CITATION}`]);
  }
  {
    const started = Date.now();
    const run = await loadOn("win32", PLAIN_TEXT_COPY, { pasteFires: false });
    check("when no paste event arrives: no citation, after waiting about a second",
      [run.inserted, run.electronPastes(), Date.now() - started >= 1000], [[], 1, true]);
  }
  {
    const { command, plugin } = await loadOn("darwin", PLAIN_TEXT_COPY);
    check("it isn't registered on macOS", command, undefined);
    check("... and there's no Chromium-only provider there", plugin.chromiumClipboardProvider, undefined);
  }

  console.log("\nDefault paste command and menu item");
  const HTML_COPY = { "HTML Format": HTML_WITH_SOURCE };
  const HTML_CITATION = "\n\nFrom: [https://html.example.com/page](https://html.example.com/page) – html.example.com";
  {
    const run = await loadOn("win32", HTML_COPY, { invoke: "default-menu" });
    check("menu item: it focuses the editor and requests one Electron paste", [run.focused(), run.electronPastes()], [true, 1]);
    check("... lets Obsidian paste, then adds the citation", run.inserted, [NATIVE_PASTE, HTML_CITATION]);
  }
  {
    const run = await loadOn("win32", HTML_COPY, { invoke: "default-command" });
    check("command: Obsidian's paste, then the citation", [run.inserted, run.electronPastes()], [[NATIVE_PASTE, HTML_CITATION], 1]);
  }
  {
    const { inserted } = await loadOn("win32", {}, { invoke: "default-menu" });
    check("with no source URL, Obsidian's paste still goes in, without a citation", inserted, [NATIVE_PASTE]);
  }
  {
    const run = await loadOn("win32", HTML_COPY, { invoke: "default-menu", line: "see `code " });
    check("inside inline code, the citation is still added", run.inserted, [NATIVE_PASTE, HTML_CITATION]);
  }
  {
    const run = await loadOn("win32", HTML_COPY, { invoke: "default-menu", pasteMode: "clipboard+source" });
    check("Paste Mode doesn't apply: still Obsidian's paste, then the citation", [run.inserted, run.electronPastes()],
      [[NATIVE_PASTE, HTML_CITATION], 1]);
  }
  {
    const run = await loadOn("win32", HTML_COPY, { invoke: "default-menu", remote: false });
    check("without Electron's remote: the plain text, then the citation", run.inserted, [`pasted text${HTML_CITATION}`]);
  }
  {
    const run = await loadOn("win32", HTML_COPY, { invoke: "default-menu", pasteFires: false });
    check("when no paste event arrives: no citation", [run.inserted, run.electronPastes()], [[], 1]);
  }

  if (failures > 0) {
    console.error(`\n${failures} Windows clipboard test(s) failed.\n`);
    process.exit(1);
  }
  console.log("\nAll Windows clipboard tests passed successfully! 🎉\n");
})();
