// Mock 'obsidian' module so main.ts can be required in standalone Node.js test environment
const Module = require("module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string, ...rest: any[]) {
  if (id === "obsidian") {
    return {
      Plugin: class {},
      PluginSettingTab: class {},
      Setting: class {
        setName() { return this; }
        setDesc() { return this; }
        addToggle() { return this; }
        addDropdown() { return this; }
        addButton() { return this; }
      },
      Modal: class {},
      Notice: class {},
    };
  }
  return originalRequire.apply(this, [id, ...rest]);
};

import {
  TemplateEngine,
  PresetManager,
  BUILTIN_PRESETS,
  TemplatePreset,
  PresetImportExportService,
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
  assert(context.title === "Obsidian (software)", "Title extracted from path slug");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(context.date), "Date matches YYYY-MM-DD");
  assert(/^\d{2}:\d{2}$/.test(context.time), "Time matches HH:mm");
  assert(context.link === `[${url}](${url})`, "Link matches [url](url) when useUrlAsLinkLabel is true");

  const rootUrl = "https://news.ycombinator.com/";
  const rootContext = TemplateEngine.buildContext(rootUrl, true);
  assert(rootContext.title === "news.ycombinator.com", "Title fallback matches domain for root URL");

  const template = "Source: {domain} at {url} on {date}";
  const rendered = TemplateEngine.render(template, context);
  assert(
    rendered === `Source: en.wikipedia.org at ${url} on ${context.date}`,
    "Template renders {domain}, {url}, {date} correctly"
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

// Test 6b: Title extraction edge cases
{
  assert(TemplateEngine.extractTitle("https://en.wikipedia.org/wiki/Obsidian_(software)") === "Obsidian (software)", "Extracts title from Wikipedia path with underscores");
  assert(TemplateEngine.extractTitle("https://github.com/coreyx/paste-with-source") === "Paste with source", "Extracts title from GitHub slug with hyphens");
  assert(TemplateEngine.extractTitle("https://example.com/blog/2026/my-first-post.html") === "My first post", "Strips .html and converts slug to title");
  assert(TemplateEngine.extractTitle("https://example.com/search/hello%20world") === "Hello world", "Decodes URI components");
  assert(TemplateEngine.extractTitle("https://example.com/") === "example.com", "Falls back to domain for root URL with slash");
  assert(TemplateEngine.extractTitle("https://www.example.com") === "example.com", "Falls back to domain for root URL without www");
  assert(TemplateEngine.extractTitle("not-a-valid-url/path") === "not-a-valid-url", "Handles invalid URL gracefully");
}

// Test 7: Built-in presets
{
  assert(BUILTIN_PRESETS.length === 3, "Contains 3 built-in presets");
  const onenote = PresetManager.getPresetById("builtin-onenote");
  assert(!!onenote && onenote.isBuiltIn === true, "OneNote preset exists and is built-in");

  const mdQuote = PresetManager.getPresetById("builtin-markdown-quote");
  assert(!!mdQuote && mdQuote.isBuiltIn === true, "Markdown Quote preset exists and is built-in");

  const academic = PresetManager.getPresetById("builtin-academic");
  assert(!!academic && academic.isBuiltIn === true, "Academic preset exists and is built-in");

  const url = "https://obsidian.md";
  const ctx = TemplateEngine.buildContext(url, true);
  const onenoteRendered = TemplateEngine.render(onenote!.template, ctx);
  assert(onenoteRendered === `\n\nFrom <[${url}](${url})>`, "OneNote preset renders expected citation");
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

console.log("\nAll TemplateEngine and Preset tests passed successfully! 🎉\n");
