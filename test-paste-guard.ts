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

import PasteWithSourcePlugin, { canAddCitation, LineSource } from "./main";

let failures = 0;

/**
 * Whether a paste can take a citation at the `|` in `text`, which may span
 * several lines. The first `|` marks the cursor and is removed.
 */
function pasteAt(text: string): boolean {
  const cursor = text.indexOf("|");
  const lines = (text.slice(0, cursor) + text.slice(cursor + 1)).split("\n");
  const line = text.slice(0, cursor).split("\n").length - 1;
  const ch = cursor - text.lastIndexOf("\n", cursor - 1) - 1;
  const doc: LineSource = { getLine: (i) => lines[i] ?? "", lineCount: () => lines.length };
  return canAddCitation(doc, line, ch);
}

/** Checks each case against the expected result and reports one line per case. */
function expectAll(group: string, expected: boolean, cases: string[]) {
  console.log(`\n${group}`);
  for (const text of cases) {
    const ok = pasteAt(text) === expected;
    if (!ok) failures++;
    console.log(`  [${ok ? "PASS" : "FAIL"}] ${JSON.stringify(text)} → ${expected ? "citation" : "no citation"}`);
  }
}

console.log("Running paste position guard tests...");

expectAll("Link syntax refuses a citation", false, [
  "[Exa|mple](https://obsidian.md)",
  "![alt |](image.png)",
  "[|]",
  "[|",
  "[[Note|",
  "see [ this |",
  "[a](|",
  "[a]( |",
  "[a](https://obs|idian.md)",
  "[W](https://en.wikipedia.org/wiki/Foo_(bar|))",
  "\\`[|",
]);

expectAll("Inline code refuses a citation", false, [
  "use `foo |",
  "``a`|",
  "``a`[|",
  "x ```a`` |",
  "`a``b` [|",
]);

expectAll("HTML being typed refuses a citation", false, [
  "<|",
  '<img src="|',
  "<a href='|",
]);

expectAll("Code fences and frontmatter refuse a citation", false, [
  "```\ncode |\n```",
  "```js|",
  "~~~\n|",
  "> ```\n> code |",
  "- ```\n  code |",
  "````\n```\n|",
  "```\n```js\n|",
  "---\ntitle: |\n---",
  "---|\ntitle: x\n---",
]);

expectAll("Math refuses a citation", false, [
  "$$\nx^2 |\n$$",
  "$$\n\\$ and |\n$$",
  "$$x|$$",
  "text $$x |",
  "$x^2|$",
  "where $|x$ holds",
  "$a$ and $b |c$",
  "> $$\n> x |",
]);

expectAll("Comments refuse a citation", false, [
  "%%\nnote |\n%%",
  "%%note |%%",
  "text %% hidden |",
  "%%\n```\n%%\n%% |",
]);

expectAll("Constructs hide each other's markers", true, [
  "`%%` and |",
  "`$$` and |",
  "```\n%%\n$$\n```\n|",
  "%%\n```\n%%\n|",
  "$$\n%%\n$$\n|",
  "%%[%% |",
  "\\%% and |",
  "\\$$ and |",
]);

expectAll("Math and comments that are closed or aren't math accept a citation", true, [
  "$$\nx^2\n$$\n|",
  "$$x$$ and |",
  "%%\nnote\n%%\n|",
  "%%note%% and |",
  "$x^2$ and |",
  "I paid $5 for |",
  "$5 and $10 |",
  "costs $5, or |$6",
  "$ x |$",
  "`$x$` and |",
]);

expectAll("Prose accepts a citation", true, [
  "see |",
  "|",
  "- [ ] task |",
  "- [x] done |",
  "[Example](https://obsidian.md) |",
  "[W](https://en.wikipedia.org/wiki/Foo_(bar)) |",
  "[[Note]] |",
  "\\[ |",
  "`a[0` and |",
  "``a`[`` and |",
  "\\` and |",
  "```\ncode\n```\n|",
  "~~~\n```\n~~~\n|",
  "---\na: 1\n---\n|",
  "text\n---\n|",
]);

/** Loads settings from `stored` the way Obsidian would and returns the resulting fallback. */
async function loadedFallback(stored: object | null): Promise<string> {
  const plugin = new PasteWithSourcePlugin({} as any, {} as any);
  plugin.loadData = async () => stored;
  await plugin.loadSettings();
  return plugin.settings.guardedPasteFallback;
}

/**
 * Loads the plugin with stubbed Obsidian APIs, presses Ctrl/Cmd+V with the
 * cursor at the `|` in `text`, and reports whether preventDefault() ran before
 * the listener first yielded (the only point at which it can still stop
 * Obsidian's paste) and what the plugin inserted.
 */
async function pressPaste(
  text: string,
  pasteMode: "default+source" | "clipboard+source",
  fallback: "native" | "plain"
): Promise<{ preventedBeforeYield: boolean; inserted: string[] }> {
  const cursor = text.indexOf("|");
  const lines = (text.slice(0, cursor) + text.slice(cursor + 1)).split("\n");
  const position = { line: text.slice(0, cursor).split("\n").length - 1, ch: cursor - text.lastIndexOf("\n", cursor - 1) - 1 };
  const inserted: string[] = [];
  const editor = {
    getLine: (i: number) => lines[i] ?? "",
    lineCount: () => lines.length,
    getCursor: () => position,
    replaceSelection: (value: string) => inserted.push(value),
  };

  let keydown: ((event: any) => Promise<void>) | undefined;
  const plugin = new PasteWithSourcePlugin({} as any, {} as any) as any;
  plugin.app = { workspace: { activeEditor: { editor }, on: () => ({}) } };
  plugin.loadData = async () => ({ pasteMode, guardedPasteFallback: fallback });
  plugin.addSettingTab = () => {};
  plugin.addCommand = () => {};
  plugin.registerEvent = () => {};
  plugin.registerDomEvent = (_el: unknown, type: string, callback: any) => {
    if (type === "keydown") keydown = callback;
  };
  (globalThis as any).document = {};
  await plugin.onload();
  plugin.getClipboardSourceUrl = async () => "https://example.com";
  plugin.getSourceLinkMarkdown = () => " + cite";
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { readText: async () => "pasted text" } },
    configurable: true,
  });

  let prevented = false;
  const pending = keydown!({ ctrlKey: true, metaKey: true, shiftKey: false, key: "v", preventDefault: () => (prevented = true) });
  const preventedBeforeYield = prevented;
  await pending;
  // default+source inserts its citation on a 50 ms timer, after Obsidian's paste.
  await new Promise((resolve) => setTimeout(resolve, 80));
  return { preventedBeforeYield, inserted };
}

(async () => {
  console.log("\nGuarded paste fallback setting");
  const cases: [string, object | null, string][] = [
    ["fresh install defaults to native", null, "native"],
    ["install from before the setting defaults to native", { templateString: "x" }, "native"],
    ["stored plain is kept", { guardedPasteFallback: "plain" }, "plain"],
    ["invalid stored value resets to native", { guardedPasteFallback: "bogus" }, "native"],
  ];
  for (const [name, stored, expected] of cases) {
    const ok = (await loadedFallback(stored)) === expected;
    if (!ok) failures++;
    console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  }

  console.log("\nPaste shortcut handling");
  const shortcutCases: {
    name: string;
    text: string;
    pasteMode: "default+source" | "clipboard+source";
    fallback: "native" | "plain";
    prevented: boolean;
    inserted: string[];
  }[] = [
    { name: "content mode, prose: prevents and adds a citation", text: "see |", pasteMode: "clipboard+source", fallback: "native", prevented: true, inserted: ["pasted text + cite"] },
    { name: "content mode, guarded, native: leaves the paste to Obsidian", text: "`code |`", pasteMode: "clipboard+source", fallback: "native", prevented: false, inserted: [] },
    { name: "content mode, guarded, plain: inserts the text alone", text: "`code |`", pasteMode: "clipboard+source", fallback: "plain", prevented: true, inserted: ["pasted text"] },
    { name: "default mode, prose: adds the citation after Obsidian's paste", text: "see |", pasteMode: "default+source", fallback: "native", prevented: false, inserted: [" + cite"] },
    { name: "default mode, guarded: adds nothing", text: "[[Note|", pasteMode: "default+source", fallback: "plain", prevented: false, inserted: [] },
  ];
  for (const c of shortcutCases) {
    const result = await pressPaste(c.text, c.pasteMode, c.fallback);
    const ok = result.preventedBeforeYield === c.prevented && JSON.stringify(result.inserted) === JSON.stringify(c.inserted);
    if (!ok) failures++;
    console.log(`  [${ok ? "PASS" : "FAIL"}] ${c.name}${ok ? "" : ` (got ${JSON.stringify(result)})`}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} paste position guard test(s) failed.\n`);
    process.exit(1);
  }
  console.log("\nAll paste position guard tests passed successfully! 🎉\n");
})();
