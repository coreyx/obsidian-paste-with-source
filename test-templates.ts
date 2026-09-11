// Mock 'obsidian' module so main.ts can be required in standalone Node.js test environment
const Module = require("module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string, ...rest: any[]) {
  if (id === "obsidian") {
    return {
      Plugin: class {},
      PluginSettingTab: class {},
      Setting: class {
        settingEl = { style: {} };
        infoEl = { style: {} };
        controlEl = { style: {} };
        setName() { return this; }
        setDesc() { return this; }
        addToggle() { return this; }
        addDropdown() { return this; }
        addButton(cb?: any) { if (cb) cb({ setButtonText: () => this, setTooltip: () => this, setDisabled: () => this, setWarning: () => this, onClick: () => this, buttonEl: { style: {} } }); return this; }
      },
      Modal: class {},
      Notice: class {},
    };
  }
  return originalRequire.apply(this, [id, ...rest]);
};

import PasteWithSourcePlugin, {
  TemplateEngine,
  PresetManager,
  BUILTIN_PRESETS,
  TemplatePreset,
  PresetImportExportService,
  DEFAULT_SETTINGS,
} from "./main";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`  [PASS] ${message}`);
}

console.log("Running TemplateEngine unit tests...");

// Test 1: Context building and standard variable replacements
{
  const url = "https://en.wikipedia.org/wiki/Obsidian_(software)";
  const context = TemplateEngine.buildContext(url, true);

  assert(context.url === url, "Context url matches");
  assert(context.domain === "en.wikipedia.org", "Domain extracted without www");
  assert(context.page === "Obsidian (software)", "Page extracted from path slug");
  assert(context.path === "/wiki/Obsidian_(software)", "Path extracted from URL pathname");
  assert((context as any).title === undefined, "Title is removed and not in context");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(context.date), "Date matches YYYY-MM-DD");
  assert(/^\d{2}:\d{2}(\s+[A-Za-z0-9/+-]+)?$/.test(context.time), "Time matches 24h HH:mm with timezone");
  assert(/^\d{2}:\d{2}Z$/.test(context.timez), "Timez matches UTC/Zulu 24h HH:mmZ");
  assert(/^\d{2}:\d{2}\s+(?:AM|PM)$/.test(context.time12h), "Time12h matches 12h hh:mm AM/PM");
  assert(context.time_12 === context.time12h, "time_12 matches time12h for backwards compatibility");
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(context.datetime), "Datetime matches ISO 8601 24h with timezone offset");
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(context.datetimez), "Datetimez matches ISO 8601 24h UTC/Zulu");
  assert(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(?:AM|PM)$/.test(context.datetime12h), "Datetime12h matches YYYY-MM-DD hh:mm AM/PM");
  assert(typeof context.timezone === "string" && context.timezone.length > 0, "Timezone is non-empty string");
  assert(context.link === `[${url}](${url})`, "Link matches [url](url) when useUrlAsLinkLabel is true");

  const rootUrl = "https://news.ycombinator.com/";
  const rootContext = TemplateEngine.buildContext(rootUrl, true);
  assert(rootContext.page === "news.ycombinator.com", "Page fallback matches domain for root URL");
  assert(rootContext.path === "/", "Path matches / for root URL");

  const template = "Source: {domain} at {url} on {date} (Page: {page}, Path: {path})";
  const rendered = TemplateEngine.render(template, context);
  assert(
    rendered === `Source: en.wikipedia.org at ${url} on ${context.date} (Page: Obsidian (software), Path: /wiki/Obsidian_(software))`,
    "Template renders {domain}, {url}, {date}, {page}, {path} correctly"
  );
}

// Test 2: Link formatting toggle (useUrlAsLinkLabel = false)
{
  const url = "https://example.com/article";
  const context = TemplateEngine.buildContext(url, false);
  assert(context.link === `[Source](${url})`, "Link matches [Source](url) when useUrlAsLinkLabel is false");
}

// Test 3: Case-insensitive token replacement
{
  const url = "https://github.com/obsidianmd";
  const context = TemplateEngine.buildContext(url, true);
  const template = "{URL} | {DOMAIN} | {Date} | {Link}";
  const rendered = TemplateEngine.render(template, context);

  assert(
    rendered === `${url} | github.com | ${context.date} | [${url}](${url})`,
    "Case-insensitive token replacement ({URL}, {DOMAIN}, {Date}, {Link})"
  );
}

// Test 4: Unmatched tokens preserved safely
{
  const url = "https://example.com";
  const context = TemplateEngine.buildContext(url, true);
  const template = "Found at {url} by {author} with {tag_123}";
  const rendered = TemplateEngine.render(template, context);

  assert(
    rendered === `Found at ${url} by {author} with {tag_123}`,
    "Unmatched tokens ({author}, {tag_123}) are preserved verbatim"
  );
}

// Test 5: Literal and escaped newlines
{
  const url = "https://example.com";
  const context = TemplateEngine.buildContext(url, true);
  const templateWithEscape = "\\n\\nFrom <{url}>";
  const renderedEscape = TemplateEngine.render(templateWithEscape, context);
  assert(
    renderedEscape === `\n\nFrom <${url}>`,
    "Escape sequence \\n properly converted to newline"
  );

  const templateWithLiteral = `\n\n> — [Source]({url})`;
  const renderedLiteral = TemplateEngine.render(templateWithLiteral, context);
  assert(
    renderedLiteral === `\n\n> — [Source](${url})`,
    "Literal newline preserved correctly"
  );
}

// Test 6: Domain extraction edge cases
{
  assert(TemplateEngine.extractDomain("https://www.google.com/search?q=test") === "google.com", "Strips www. prefix");
  assert(TemplateEngine.extractDomain("http://sub.domain.co.uk/path") === "sub.domain.co.uk", "Subdomains preserved");
  assert(TemplateEngine.extractDomain("https://localhost:8080/app") === "localhost", "Localhost handled");
  assert(TemplateEngine.extractDomain("not-a-valid-url/path") === "not-a-valid-url", "Non-URL string handled gracefully");
}

// Test 6b: Page name extraction edge cases
{
  assert(TemplateEngine.extractPage("https://en.wikipedia.org/wiki/Obsidian_(software)") === "Obsidian (software)", "Extracts page from Wikipedia path with underscores");
  assert(TemplateEngine.extractPage("https://github.com/coreyx/paste-with-source") === "Paste with source", "Extracts page from GitHub slug with hyphens");
  assert(TemplateEngine.extractPage("https://example.com/blog/2026/my-first-post.html") === "My first post", "Strips .html and converts slug to page");
  assert(TemplateEngine.extractPage("https://example.com/search/hello%20world") === "Hello world", "Decodes URI components");
  assert(TemplateEngine.extractPage("https://example.com/") === "example.com", "Falls back to domain for root URL with slash");
  assert(TemplateEngine.extractPage("https://www.example.com") === "example.com", "Falls back to domain for root URL without www");
  assert(TemplateEngine.extractPage("not-a-valid-url/path") === "not-a-valid-url", "Handles invalid URL gracefully");
}

// Test 6c: Path extraction edge cases
{
  assert(TemplateEngine.extractPath("https://en.wikipedia.org/wiki/Obsidian_(software)") === "/wiki/Obsidian_(software)", "Extracts pathname from URL");
  assert(TemplateEngine.extractPath("https://example.com/blog/post.html?query=1#section") === "/blog/post.html", "Excludes query and hash from path");
  assert(TemplateEngine.extractPath("https://example.com/") === "/", "Root URL path is /");
  assert(TemplateEngine.extractPath("https://example.com") === "/", "URL without trailing slash path is /");
}

// Test 7: Built-in presets
{
  assert(BUILTIN_PRESETS.length === 11, "Contains 11 built-in presets");
  const expectedIds = [
    "builtin-onenote",
    "builtin-italic-attribution",
    "builtin-minimal-domain",
    "builtin-parenthetical",
    "builtin-academic",
    "builtin-obsidian-callout",
    "builtin-iso-timestamp",
    "builtin-zulu-log",
    "builtin-casual-12h",
    "builtin-markdown-quote",
    "builtin-raw-url",
  ];

  for (const id of expectedIds) {
    const p = PresetManager.getPresetById(id);
    assert(!!p && p.isBuiltIn === true, `Built-in preset '${id}' exists and is marked built-in`);
  }

  const url = "https://obsidian.md";
  const ctx = TemplateEngine.buildContext(url, true);

  const onenote = PresetManager.getPresetById("builtin-onenote")!;
  assert(TemplateEngine.render(onenote.template, ctx) === `\n\nFrom <[${url}](${url})>`, "OneNote preset renders expected citation");

  const italic = PresetManager.getPresetById("builtin-italic-attribution")!;
  assert(TemplateEngine.render(italic.template, ctx) === `\n\n— *Source: [obsidian.md](${url})*`, "Italic preset renders expected citation");

  const callout = PresetManager.getPresetById("builtin-obsidian-callout")!;
  assert(TemplateEngine.render(callout.template, ctx).startsWith(`\n\n> [!info] Source: [obsidian.md](${url})`), "Obsidian Callout preset renders callout header");

  const isoPreset = PresetManager.getPresetById("builtin-iso-timestamp")!;
  assert(TemplateEngine.render(isoPreset.template, ctx) === `\n\n— *Source: [obsidian.md](${url})* [${ctx.datetime}]`, "ISO 8601 Timestamp preset renders expected citation");

  const zuluPreset = PresetManager.getPresetById("builtin-zulu-log")!;
  assert(TemplateEngine.render(zuluPreset.template, ctx) === `\n\nSource: [obsidian.md](${url}) (Retrieved: ${ctx.datetimez})`, "Zulu Log preset renders expected citation");

  const casual12h = PresetManager.getPresetById("builtin-casual-12h")!;
  assert(TemplateEngine.render(casual12h.template, ctx) === `\n\nSource: [obsidian.md](${url}) (${ctx.date} at ${ctx.time12h})`, "12-Hour Casual preset renders expected citation");
}

// Test 8: Preset JSON Import Validation
{
  console.log("\nRunning Preset JSON schema tests...");

  // Mock File for node environment
  class MockFile {
    name: string;
    content: string;
    constructor(name: string, content: string) {
      this.name = name;
      this.content = content;
    }
    async text() {
      return this.content;
    }
  }

  // Valid JSON preset
  const validJson = JSON.stringify({
    name: "Custom Wiki Preset",
    template: "> [{domain}]({url})",
    description: "Wiki style",
  });

  PresetImportExportService.importPresetFromFile(new MockFile("wiki.json", validJson) as any)
    .then((preset) => {
      assert(preset.name === "Custom Wiki Preset", "Imported preset name matches");
      assert(preset.template === "> [{domain}]({url})", "Imported preset template matches");
      assert(preset.isBuiltIn === false, "Imported preset is not built-in");
      assert(preset.id.startsWith("user-preset-"), "Imported preset gets unique ID");
    })
    .catch((err) => {
      console.error("  [FAIL] Valid preset threw error:", err);
      process.exit(1);
    });

  // Invalid JSON (missing template)
  const missingTemplate = JSON.stringify({ name: "Bad Preset" });
  PresetImportExportService.importPresetFromFile(new MockFile("bad.json", missingTemplate) as any)
    .then(() => {
      console.error("  [FAIL] Missing template should have rejected!");
      process.exit(1);
    })
    .catch((err) => {
      assert(err.message.includes("missing or empty 'template'"), "Missing template rejected with descriptive error");
    });
}

// Test 9: Performance benchmark (10,000 renders)
{
  const url = "https://en.wikipedia.org/wiki/Obsidian_(software)";
  const context = TemplateEngine.buildContext(url, true);
  const template = "\n\n> Source: [{domain}]({url}) (Accessed: {date} at {time})";

  // Warmup
  for (let i = 0; i < 500; i++) {
    TemplateEngine.render(template, context);
  }

  const iterations = 10000;
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    TemplateEngine.render(template, context);
  }
  const end = process.hrtime.bigint();
  const totalNs = Number(end - start);
  const totalMs = totalNs / 1000000;
  const perOpUs = (totalNs / iterations) / 1000;

  console.log(`\n  [BENCHMARK] ${iterations} template renders in ${totalMs.toFixed(2)}ms (${perOpUs.toFixed(3)} µs per render)`);
}

// Test 10: Active Preset Slot Switching & Template Resolution
(async () => {
  console.log("\nRunning Preset Slot Switching & Resolution tests...");

  const plugin = new PasteWithSourcePlugin({} as any, {} as any);
  plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
  plugin.saveData = async () => {};

  // Initial state: Slot A active
  assert(plugin.settings.activeSlot === "A", "Initial activeSlot is 'A'");
  const initialActive = plugin.getActiveTemplate();
  assert(initialActive.slot === "A", "Active template slot is 'A'");
  assert(initialActive.template === DEFAULT_SETTINGS.templateString, "Slot A uses editable templateString");
  assert(
    plugin.getSourceLinkMarkdown("https://example.com") === "\n\nFrom <[https://example.com](https://example.com)>",
    "getSourceLinkMarkdown uses Slot A template initially"
  );

  // Switch to Slot B (Minimal Domain)
  await plugin.switchToSlot("B");
  assert(plugin.settings.activeSlot === "B", "activeSlot switched to 'B'");
  const slotBActive = plugin.getActiveTemplate();
  assert(slotBActive.slot === "B", "Active template slot is 'B'");
  assert(slotBActive.name === "Minimal Domain", "Slot B name is 'Minimal Domain'");
  assert(
    plugin.getSourceLinkMarkdown("https://example.com") === "\n\nSource: [example.com](https://example.com)",
    "getSourceLinkMarkdown renders Slot B (Minimal Domain)"
  );

  // Switch to Slot C (Academic Citation)
  await plugin.switchToSlot("C");
  assert(plugin.settings.activeSlot === "C", "activeSlot switched to 'C'");
  const slotCActive = plugin.getActiveTemplate();
  assert(slotCActive.slot === "C", "Active template slot is 'C'");
  assert(slotCActive.name === "Academic Citation", "Slot C name is 'Academic Citation'");
  assert(
    plugin.getSourceLinkMarkdown("https://example.com/research-paper").includes("via example.com"),
    "getSourceLinkMarkdown renders Slot C (Academic Citation)"
  );

  // Switch back to Slot A and test editable template reflection
  await plugin.switchToSlot("A");
  assert(plugin.settings.activeSlot === "A", "activeSlot switched back to 'A'");
  plugin.settings.templateString = "Custom Edit: {url}";
  const editedActive = plugin.getActiveTemplate();
  assert(editedActive.template === "Custom Edit: {url}", "Slot A immediately reflects templateString edits");
  assert(
    plugin.getSourceLinkMarkdown("https://example.com") === "Custom Edit: https://example.com",
    "getSourceLinkMarkdown renders newly edited Slot A template"
  );

  // Custom preset assignment for Slot B
  const customPreset: TemplatePreset = {
    id: "user-preset-special",
    name: "Special Format",
    template: "Special: {url}",
    isBuiltIn: false,
  };
  plugin.settings.userPresets.push(customPreset);
  plugin.settings.presetSlotB = "user-preset-special";
  await plugin.switchToSlot("B");
  assert(plugin.getActiveTemplate().name === "Special Format", "Slot B resolves custom user preset");
  assert(plugin.getActiveTemplate().template === "Special: {url}", "Slot B uses custom template");

  // Fallback if custom preset deleted
  plugin.settings.presetSlotB = "non-existent-preset-id";
  const fallbackActive = plugin.getActiveTemplate();
  assert(fallbackActive.name === "Minimal Domain", "Deleted Slot B preset falls back to default slot preset");

  console.log("\nAll TemplateEngine and Preset tests passed successfully! 🎉\n");
})();
