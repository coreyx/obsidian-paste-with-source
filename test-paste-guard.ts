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

import { canAddCitation, LineSource } from "./main";

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

if (failures > 0) {
  console.error(`\n${failures} paste position guard test(s) failed.\n`);
  process.exit(1);
}
console.log("\nAll paste position guard tests passed successfully! 🎉\n");
