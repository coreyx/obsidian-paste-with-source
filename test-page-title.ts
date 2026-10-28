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

import { JSDOM } from "jsdom";
import PasteWithSourcePlugin, {
  decodeHtml,
  extractPageTitle,
  fetchPageTitle,
  PageResponse,
  parseRedditOembed,
  redditTarget,
} from "./main";

// Node has no DOM; extractPageTitle parses with whatever DOMParser is global, as it does in Obsidian.
(globalThis as any).DOMParser = new JSDOM("").window.DOMParser;

let failures = 0;

/** Records one check and prints it, with what was actually produced when it fails. */
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${ok ? "" : ` (got ${JSON.stringify(actual)})`}`);
}

/** The bytes of `parts`, where strings are ASCII markup and byte arrays are text already encoded. */
function bytes(...parts: (string | number[])[]): ArrayBuffer {
  const chunks = parts.map((part) => (typeof part === "string" ? Buffer.from(part, "latin1") : Buffer.from(part)));
  const all = Buffer.concat(chunks);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.length) as ArrayBuffer;
}

/** "日本語" in Shift_JIS, which decodes to mojibake if read as UTF-8 or windows-1252. */
const NIHONGO_SJIS = [0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea];

/** A requester that answers every request with `response`, and counts how often it was asked. */
function answer(response: Partial<PageResponse>): { request: (url: string) => Promise<PageResponse>; calls: () => number } {
  let calls = 0;
  return {
    request: async () => {
      calls++;
      return { status: 200, headers: { "Content-Type": "text/html" }, arrayBuffer: bytes(""), ...response };
    },
    calls: () => calls,
  };
}

/**
 * A minimal editor over a string: the parts of Obsidian's Editor that inserting a
 * citation and swapping its title in use, with the cursor starting at the end.
 */
function memoryEditor(text: string) {
  const state = { text, cursor: text.length };
  const offsetToPos = (offset: number) => {
    const lines = state.text.slice(0, offset).split("\n");
    return { line: lines.length - 1, ch: lines[lines.length - 1].length };
  };
  const posToOffset = (pos: { line: number; ch: number }) =>
    state.text.split("\n").slice(0, pos.line).reduce((sum, line) => sum + line.length + 1, 0) + pos.ch;
  return {
    state,
    getValue: () => state.text,
    getCursor: () => offsetToPos(state.cursor),
    posToOffset,
    offsetToPos,
    replaceSelection: (value: string) => {
      state.text = state.text.slice(0, state.cursor) + value + state.text.slice(state.cursor);
      state.cursor += value.length;
    },
    replaceRange: (value: string, from: { line: number; ch: number }, to: { line: number; ch: number }) => {
      state.text = state.text.slice(0, posToOffset(from)) + value + state.text.slice(posToOffset(to));
    },
  };
}

/**
 * Pastes `"pasted"` with a citation for https://example.com/a into a note holding
 * `before`, runs `meanwhile` while the title lookup is still pending, then lets the
 * lookup answer "Example Page" and returns the note's text and how many lookups ran.
 */
async function pasteAndSwap(options: {
  linkLabel?: string;
  template?: string;
  before?: string;
  meanwhile?: (editor: ReturnType<typeof memoryEditor>, info: { file: { path: string } }) => void;
}): Promise<{ text: string; lookups: number }> {
  const plugin = new PasteWithSourcePlugin({} as any, {} as any) as any;
  plugin.loadData = async () => ({
    linkLabel: options.linkLabel ?? "title",
    templateString: options.template ?? "\n\nFrom <{link}>",
  });
  await plugin.loadSettings();

  let lookups = 0;
  let answerTitle: () => void = () => {};
  plugin.titleFetcher = () => {
    lookups++;
    return new Promise<string>((resolve) => (answerTitle = () => resolve("Example Page")));
  };

  const editor = memoryEditor(options.before ?? "Intro ");
  const info = { editor, file: { path: "note.md" } };
  plugin.insertWithCitation(editor, info, "pasted", "https://example.com/a");
  options.meanwhile?.(editor, info);
  answerTitle();
  // Let swapInTitle finish now that its lookup has resolved.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { text: editor.getValue(), lookups };
}

const URL_LINK = "[https://example.com/a](https://example.com/a)";
const TITLE_LINK = "[Example Page](https://example.com/a)";

(async () => {
  console.log("Running page title tests...");

  console.log("\nextractPageTitle");
  check("og:title wins over twitter:title and <title>",
    extractPageTitle('<title>T</title><meta name="twitter:title" content="Tw"><meta property="og:title" content="OG">'), "OG");
  check("twitter:title wins over <title>",
    extractPageTitle('<title>T</title><meta name="twitter:title" content="Tw">'), "Tw");
  check("<title> is used when there are no social titles", extractPageTitle("<title>Plain</title>"), "Plain");
  check("meta names match case-insensitively", extractPageTitle('<meta property="OG:Title" content="Upper">'), "Upper");
  check("a blank og:title falls through to <title>",
    extractPageTitle('<meta property="og:title" content="  "><title>Fallback</title>'), "Fallback");
  check("whitespace collapses", extractPageTitle("<title>\n  Many \t spaces\n</title>"), "Many spaces");
  check("entities decode", extractPageTitle("<title>Tom &amp; Jerry &#8211; &quot;Cats&quot;</title>"), 'Tom & Jerry – "Cats"');
  check("a page with no title gives undefined", extractPageTitle("<p>No title here</p>"), undefined);
  check("a blank <title> gives undefined", extractPageTitle("<title>   </title>"), undefined);
  check("scripts don't run while parsing",
    extractPageTitle("<title>Safe</title><script>globalThis.ranScript = true</script>") === "Safe" &&
      (globalThis as any).ranScript === undefined, true);

  console.log("\ndecodeHtml");
  check("Shift_JIS named in the Content-Type header",
    extractPageTitle(decodeHtml(bytes("<title>", NIHONGO_SJIS, "</title>"), "text/html; charset=Shift_JIS")), "日本語");
  check("Shift_JIS named only in <meta charset>",
    extractPageTitle(decodeHtml(bytes('<meta charset="shift_jis"><title>', NIHONGO_SJIS, "</title>"))), "日本語");
  check("Shift_JIS named only in <meta http-equiv>",
    extractPageTitle(decodeHtml(bytes(
      '<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS"><title>', NIHONGO_SJIS, "</title>"))), "日本語");
  check("the header wins over a <meta> charset",
    extractPageTitle(decodeHtml(bytes('<meta charset="utf-8"><title>', NIHONGO_SJIS, "</title>"), "text/html; charset=shift_jis")),
    "日本語");
  const utf8 = Array.from(Buffer.from("Café", "utf8"));
  check("an unknown charset falls back to UTF-8",
    extractPageTitle(decodeHtml(bytes("<title>", utf8, "</title>"), "text/html; charset=no-such-encoding")), "Café");
  check("no charset at all means UTF-8", extractPageTitle(decodeHtml(bytes("<title>", utf8, "</title>"))), "Café");

  console.log("\nfetchPageTitle");
  const page = answer({ arrayBuffer: bytes("<title>Fetched</title>") });
  check("a 200 HTML page gives its title", await fetchPageTitle("https://example.com", page.request), "Fetched");
  check("headers are read case-insensitively",
    await fetchPageTitle("https://example.com", answer({
      headers: { "CONTENT-TYPE": "text/html; charset=shift_jis" },
      arrayBuffer: bytes("<title>", NIHONGO_SJIS, "</title>"),
    }).request), "日本語");
  check("a 404 gives undefined",
    await fetchPageTitle("https://example.com", answer({ status: 404, arrayBuffer: bytes("<title>Not Found</title>") }).request),
    undefined);
  // The body would yield a title if it were parsed as HTML, so only the content-type check can reject it.
  check("a JSON response gives undefined",
    await fetchPageTitle("https://example.com", answer({
      headers: { "content-type": "application/json" },
      arrayBuffer: bytes('{"snippet": "<title>Not a page</title>"}'),
    }).request), undefined);
  check("a failed request gives undefined",
    await fetchPageTitle("https://example.com", async () => { throw new Error("offline"); }), undefined);
  const started = Date.now();
  const hung = await fetchPageTitle("https://example.com", () => new Promise<PageResponse>(() => {}), 50);
  check("a request that never answers gives undefined at the timeout", hung === undefined && Date.now() - started < 1000, true);
  const local = answer({});
  check("a file: URL gives undefined", await fetchPageTitle("file:///C:/notes/page.html", local.request), undefined);
  check("a file: URL makes no request", local.calls(), 0);
  check("a malformed URL gives undefined", await fetchPageTitle("not a url", local.request), undefined);

  console.log("\nReddit");
  const POST = { kind: "post", postUrl: "https://www.reddit.com/r/ExampleSub/comments/abc123/", subreddit: "ExampleSub" };
  check("a post URL is recognized, and its post URL rebuilt without the slug",
    redditTarget("https://www.reddit.com/r/ExampleSub/comments/abc123/an_example_post/"), POST);
  check("the host variants are recognized",
    ["reddit.com", "old.reddit.com", "new.reddit.com", "np.reddit.com", "m.reddit.com"].map((host) =>
      redditTarget(`https://${host}/r/ExampleSub/comments/abc123/`)), Array(5).fill(POST));
  check("a comment permalink becomes its post",
    redditTarget("https://www.reddit.com/r/ExampleSub/comments/abc123/an_example_post/def456/"), POST);
  check("share-tracking parameters and the fragment are dropped",
    redditTarget("https://www.reddit.com/r/ExampleSub/comments/abc123/x/?utm_source=share&utm_medium=web#top"), POST);
  check("a subreddit page is recognized, with and without a trailing slash",
    [redditTarget("https://www.reddit.com/r/ExampleSub"), redditTarget("https://www.reddit.com/r/ExampleSub/")],
    Array(2).fill({ kind: "subreddit", subreddit: "ExampleSub" }));
  check("a share link, a user page, a short link and another site aren't recognized",
    ["https://www.reddit.com/r/ExampleSub/s/AbCdEf", "https://www.reddit.com/user/someone/", "https://redd.it/abc123",
      "https://example.com/r/ExampleSub/comments/abc123/"].map(redditTarget), Array(4).fill(undefined));

  /** An oEmbed answer for a post titled `title`, whose embed HTML links to the subreddit spelled `subreddit`. */
  const oembed = (title: string, subreddit = "ExampleSub") => JSON.stringify({
    type: "rich",
    title,
    html: `<blockquote><a href="https://www.reddit.com/r/${subreddit}/comments/abc123/x/">${title}</a> by ` +
      `<a href="https://www.reddit.com/user/someone/">u/someone</a></blockquote>`,
  });
  check("an oEmbed answer gives its title, and the subreddit spelled as the embed HTML has it",
    parseRedditOembed(oembed(' An  "Example"\n Post ')), { title: 'An "Example" Post', subreddit: "ExampleSub" });
  check("an answer with no subreddit link gives just the title",
    parseRedditOembed(JSON.stringify({ title: "An Example Post" })), { title: "An Example Post" });
  check("malformed JSON, a missing title and a blank title give undefined",
    ["<html>Not JSON</html>", JSON.stringify({ html: "<a></a>" }), JSON.stringify({ title: "  " }), "null"].map(parseRedditOembed),
    Array(4).fill(undefined));

  /** A requester that records each URL it's asked for, and answers with `response`. */
  function recorder(response: Partial<PageResponse>) {
    const urls: string[] = [];
    return { request: async (url: string) => (urls.push(url), answer(response).request(url)), urls };
  }
  const embed = recorder({ headers: { "content-type": "application/json" }, arrayBuffer: bytes(oembed("An Example Post")) });
  check("a post is titled from oEmbed, with the subreddit's own capitalization",
    await fetchPageTitle("https://old.reddit.com/r/examplesub/comments/abc123/an_example_post/?utm_source=share", embed.request),
    "An Example Post - r/ExampleSub");
  check("... with one request, to the oEmbed URL for the rebuilt post URL", embed.urls,
    ["https://www.reddit.com/oembed?url=https%3A%2F%2Fwww.reddit.com%2Fr%2Fexamplesub%2Fcomments%2Fabc123%2F"]);
  const noLink = recorder({ arrayBuffer: bytes(JSON.stringify({ title: "An Example Post" })) });
  check("with no subreddit link in the answer, the URL's subreddit is used",
    await fetchPageTitle("https://www.reddit.com/r/ExampleSub/comments/abc123/", noLink.request), "An Example Post - r/ExampleSub");
  const front = recorder({});
  check("a subreddit page is titled from its URL", await fetchPageTitle("https://www.reddit.com/r/ExampleSub/", front.request),
    "r/ExampleSub");
  check("... with no request", front.urls, []);
  check("a 404 from oEmbed gives undefined",
    await fetchPageTitle("https://www.reddit.com/r/ExampleSub/comments/abc123/", answer({ status: 404 }).request), undefined);
  const botCheck = { arrayBuffer: bytes("<html><head><title>Reddit</title></head></html>") };
  check("a share link whose page is titled just \"Reddit\" gives undefined",
    await fetchPageTitle("https://www.reddit.com/r/ExampleSub/s/AbCdEf", answer(botCheck).request), undefined);
  check("... and so does a short link", await fetchPageTitle("https://redd.it/abc123", answer(botCheck).request), undefined);
  check("another site's page titled \"Reddit\" keeps that title",
    await fetchPageTitle("https://example.com/page", answer(botCheck).request), "Reddit");

  console.log("\nSettings loading");
  /** The linkLabel `stored` loads as, and whether the old toggle's key survived loading. */
  async function loaded(stored: object | null): Promise<[string, boolean]> {
    const plugin = new PasteWithSourcePlugin({} as any, {} as any) as any;
    plugin.loadData = async () => stored;
    await plugin.loadSettings();
    return [plugin.settings.linkLabel, "useUrlAsLinkLabel" in plugin.settings];
  }
  check("a fresh install defaults to Page title", await loaded(null), ["title", false]);
  check("a stored label is kept", await loaded({ linkLabel: "page" }), ["page", false]);
  check("an invalid label resets to Page title", await loaded({ linkLabel: "bogus" }), ["title", false]);
  check("the old toggle is dropped, not carried over", await loaded({ useUrlAsLinkLabel: false }), ["title", false]);

  console.log("\nSwapping the title in");
  check("the URL placeholder becomes the title", await pasteAndSwap({}),
    { text: `Intro pasted\n\nFrom <${TITLE_LINK}>`, lookups: 1 });
  check("text typed before the citation doesn't stop the swap",
    await pasteAndSwap({ meanwhile: (editor) => { editor.state.text = "Typed. " + editor.state.text; } }),
    { text: `Typed. Intro pasted\n\nFrom <${TITLE_LINK}>`, lookups: 1 });
  check("an edited citation is left alone",
    await pasteAndSwap({ meanwhile: (editor) => { editor.state.text = editor.state.text.replace("From <", "Via <"); } }),
    { text: `Intro pasted\n\nVia <${URL_LINK}>`, lookups: 1 });
  check("a deleted citation stays deleted",
    await pasteAndSwap({ meanwhile: (editor) => { editor.state.text = "Intro pasted"; } }),
    { text: "Intro pasted", lookups: 1 });
  check("a pane that switched notes is left alone",
    await pasteAndSwap({ meanwhile: (_editor, info) => { info.file = { path: "other.md" }; } }),
    { text: `Intro pasted\n\nFrom <${URL_LINK}>`, lookups: 1 });
  check("of two identical citations, the one just pasted is updated",
    await pasteAndSwap({ before: `\n\nFrom <${URL_LINK}>\n\n` }),
    { text: `\n\nFrom <${URL_LINK}>\n\npasted\n\nFrom <${TITLE_LINK}>`, lookups: 1 });
  check("{title} is swapped in with the URL label too",
    await pasteAndSwap({ linkLabel: "url", template: "\n\nSource: [{title}]({url})" }),
    { text: `Intro pasted\n\nSource: ${TITLE_LINK}`, lookups: 1 });
  check("with the URL label and no {title}, nothing is looked up",
    await pasteAndSwap({ linkLabel: "url" }), { text: `Intro pasted\n\nFrom <${URL_LINK}>`, lookups: 0 });
  check("with the page-name label, nothing is looked up",
    await pasteAndSwap({ linkLabel: "page" }),
    { text: "Intro pasted\n\nFrom <[A](https://example.com/a)>", lookups: 0 });

  if (failures > 0) {
    console.error(`\n${failures} page title test(s) failed.\n`);
    process.exit(1);
  }
  console.log("\nAll page title tests passed successfully! 🎉\n");
})();
