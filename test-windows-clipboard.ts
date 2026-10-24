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

  if (failures > 0) {
    console.error(`\n${failures} Windows clipboard test(s) failed.\n`);
    process.exit(1);
  }
  console.log("\nAll Windows clipboard tests passed successfully! 🎉\n");
})();
