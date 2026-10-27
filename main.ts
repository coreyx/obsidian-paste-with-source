import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  Editor,
  Menu,
  Modal,
  Notice,
  requestUrl
} from "obsidian";
import type { MarkdownFileInfo } from "obsidian";
import { exec } from "child_process";

type InterceptShortcut = "ctrl+v" | "shift+insert" | "both";

type PasteMode = "default+source" | "clipboard+source";

/**
 * What an intercepted paste does in "Paste content + source" mode when the cursor
 * is somewhere a citation would break the markup: hand the paste to Obsidian, as
 * if this plugin were off, or insert the clipboard's plain text.
 */
type GuardedPasteFallback = "native" | "plain";

/**
 * How `{link}` labels its link: the URL itself, the word "Source", the page name
 * guessed from the URL's path (what `{page}` gives), or the title fetched from the
 * page. Only "title" makes a network request.
 */
export type LinkLabel = "url" | "source" | "page" | "title";

const LINK_LABELS: readonly LinkLabel[] = ["url", "source", "page", "title"];

type CitationStyle = "OneNote" | "Source";

export interface TemplatePreset {
  id: string;
  name: string;
  template: string;
  isBuiltIn?: boolean;
  description?: string;
}

export interface PasteWithSourceSettings {
  interceptPaste: boolean;
  interceptShortcut: InterceptShortcut;
  pasteMode: PasteMode;
  guardedPasteFallback: GuardedPasteFallback;
  /**
   * Windows only. Whether a copy with no HTML on the clipboard, such as a page's
   * plain-text Copy button, takes its source URL from the "Chromium internal source
   * URL" format that Chromium-based browsers and apps leave there.
   */
  readChromiumSourceUrl: boolean;
  /** How `{link}` is labeled in every template; see {@link LinkLabel}. */
  linkLabel: LinkLabel;
  templateString: string;
  selectedPresetId: string;
  userPresets: TemplatePreset[];
  citationStyle?: CitationStyle;
  activeSlot: "A" | "B" | "C";
  presetSlotB: string;
  presetSlotC: string;
}

export const BUILTIN_PRESETS: TemplatePreset[] = [
  {
    id: "builtin-onenote",
    name: "OneNote Style",
    template: "\n\nFrom <{link}>",
    isBuiltIn: true,
    description: "Classic Microsoft OneNote format (From <url>)",
  },
  {
    id: "builtin-italic-attribution",
    name: "Italic Attribution",
    template: "\n\n— *Source: {link}*",
    isBuiltIn: true,
    description: "Editorial dash attribution with italicized link",
  },
  {
    id: "builtin-minimal-domain",
    name: "Minimal Domain",
    template: "\n\nSource: [{domain}]({url})",
    isBuiltIn: true,
    description: "Clean, unobtrusive source link using the domain name",
  },
  {
    id: "builtin-parenthetical",
    name: "Parenthetical",
    template: "\n\n(Source: {link})",
    isBuiltIn: true,
    description: "Casual parenthetical citation with link",
  },
  {
    id: "builtin-academic",
    name: "Academic Citation",
    template: "\n\nSource: {link} via {domain} (Accessed: {date} at {time12h})",
    isBuiltIn: true,
    description: "Comprehensive citation with link, domain, and 12-hour access timestamp",
  },
  {
    id: "builtin-obsidian-callout",
    name: "Obsidian Callout",
    template: "\n\n> [!info] Source: {link}\n> Accessed on {datetime12h}",
    isBuiltIn: true,
    description: "Styled Obsidian info callout box with formatted access timestamp",
  },
  {
    id: "builtin-iso-timestamp",
    name: "Timestamped (ISO 8601)",
    template: "\n\n— *Source: {link}* [{datetime}]",
    isBuiltIn: true,
    description: "Editorial citation with ISO 8601 24h date, time, and timezone offset",
  },
  {
    id: "builtin-zulu-log",
    name: "Zulu / UTC Research Log",
    template: "\n\nSource: {link} (Retrieved: {datetimez})",
    isBuiltIn: true,
    description: "Research citation formatted in UTC/Zulu 24h ISO 8601",
  },
  {
    id: "builtin-casual-12h",
    name: "12-Hour Casual",
    template: "\n\nSource: {link} ({date} at {time12h})",
    isBuiltIn: true,
    description: "Human-friendly citation with 12-hour AM/PM access timestamp",
  },
  {
    id: "builtin-markdown-quote",
    name: "Markdown Quote",
    template: "\n\n> — [Source]({url})",
    isBuiltIn: true,
    description: "Blockquoted markdown attribution line",
  },
  {
    id: "builtin-raw-url",
    name: "Raw URL",
    template: "\n\n{url}",
    isBuiltIn: true,
    description: "Plain origin URL without markdown link markup",
  },
];

export const DEFAULT_SETTINGS: PasteWithSourceSettings = {
  interceptPaste: true,
  interceptShortcut: "both",
  pasteMode: "default+source",
  guardedPasteFallback: "native",
  readChromiumSourceUrl: true,
  linkLabel: "title",
  templateString: "\n\nFrom <{link}>",
  selectedPresetId: "builtin-onenote",
  userPresets: [],
  citationStyle: "OneNote",
  activeSlot: "A",
  presetSlotB: "builtin-minimal-domain",
  presetSlotC: "builtin-academic",
};

export class PresetManager {
  static getAllPresets(userPresets: TemplatePreset[] = []): TemplatePreset[] {
    return [...BUILTIN_PRESETS, ...(userPresets || [])];
  }

  static getPresetById(id: string, userPresets: TemplatePreset[] = []): TemplatePreset | undefined {
    return this.getAllPresets(userPresets).find((p) => p.id === id);
  }
}

export interface TemplateContext {
  url: string;
  domain: string;
  page: string;
  path: string;
  date: string;
  time: string;
  timez: string;
  time12h: string;
  time_12: string;
  datetime: string;
  datetimez: string;
  datetime12h: string;
  timezone: string;
  iso: string;
  year: string;
  month: string;
  day: string;
  link: string;
  /** The page's fetched title, escaped for link text, or the URL until a title is known. */
  title: string;
}

export class TemplateEngine {
  /**
   * Builds the values every `{var}` in a template renders to.
   *
   * @param linkLabel How `{link}` is labeled; see {@link LinkLabel}.
   * @param title The page's fetched title, if one has arrived. Without it, `{title}`
   *   and a "title" `{link}` fall back to the URL.
   * @param now The moment the citation is for. A citation re-rendered once its title
   *   arrives passes the time it was first inserted, so its date and time don't change.
   */
  static buildContext(
    url: string,
    linkLabel: LinkLabel = "url",
    title?: string,
    now: Date = new Date()
  ): TemplateContext {
    const domain = this.extractDomain(url);
    const path = this.extractPath(url);
    const page = this.extractPage(url);
    const linkText =
      linkLabel === "source" ? "Source" :
      linkLabel === "page" ? this.escapeLinkText(page) :
      linkLabel === "title" && title ? this.escapeLinkText(title) :
      url;
    const link = `[${linkText}](${url})`;

    const pad = (n: number) => n.toString().padStart(2, "0");
    const year = now.getFullYear().toString();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const date = `${year}-${month}-${day}`;

    // Timezone resolution (short timezone code, e.g. PDT, EDT, CET, or GMT offset)
    const tz =
      Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")?.value || "";

    // ISO 8601 timezone offset (e.g. "-07:00" or "+02:00")
    const offsetMinutes = now.getTimezoneOffset();
    const sign = offsetMinutes > 0 ? "-" : "+";
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetMins = pad(absOffset % 60);
    const tzOffset = `${sign}${offsetHours}:${offsetMins}`;

    // 24h local time clarified with timezone (e.g. "13:00 PDT" or "13:00")
    const localTime24 = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const time = tz ? `${localTime24} ${tz}` : localTime24;

    // 24h UTC/Zulu time in ISO 8601 (e.g. "20:00Z")
    const timez = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}Z`;

    // 12h AM/PM time format (e.g. "01:00 PM")
    const hours12 = now.getHours() % 12 || 12;
    const ampm = now.getHours() >= 12 ? "PM" : "AM";
    const time12h = `${pad(hours12)}:${pad(now.getMinutes())} ${ampm}`;

    // ISO 8601 24h local datetime clarified with timezone offset (e.g. "2026-09-11T13:00-07:00")
    const datetime = `${date}T${localTime24}${tzOffset}`;

    // ISO 8601 24h UTC/Zulu datetime (e.g. "2026-09-11T20:00Z")
    const utcYear = now.getUTCFullYear().toString();
    const utcMonth = pad(now.getUTCMonth() + 1);
    const utcDay = pad(now.getUTCDate());
    const datetimez = `${utcYear}-${utcMonth}-${utcDay}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}Z`;

    // 12h combined datetime (e.g. "2026-09-11 01:00 PM")
    const datetime12h = `${date} ${time12h}`;

    return {
      url,
      domain,
      page,
      path,
      date,
      time,
      timez,
      time12h,
      time_12: time12h,
      datetime,
      datetimez,
      datetime12h,
      timezone: tz,
      iso: now.toISOString(),
      year,
      month,
      day,
      link,
      title: title ? this.escapeLinkText(title) : url,
    };
  }

  /**
   * Makes text safe to put between a link's brackets: whitespace runs collapse to one
   * space, and `\`, `[` and `]` are backslash-escaped so a title like "Arrays [MDN]"
   * can't end the link text early. Obsidian renders `\[` as `[` in prose too, so the
   * escaped text reads the same outside a link.
   */
  static escapeLinkText(text: string): string {
    return text.replace(/\s+/g, " ").trim().replace(/[\\[\]]/g, (char) => `\\${char}`);
  }

  /**
   * Whether rendering `template` needs the page's title, and so a network request:
   * it uses `{title}`, or uses `{link}` while links are labeled with the title.
   * Matched case-insensitively, the way {@link render} matches variables.
   */
  static templateNeedsTitle(template: string, linkLabel: LinkLabel): boolean {
    return /\{title\}/i.test(template) || (linkLabel === "title" && /\{link\}/i.test(template));
  }

  static render(template: string, context: TemplateContext): string {
    if (!template) return "";

    // Parse literal \n and \t escape sequences if present
    let processed = template.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

    // Replace {variable} case-insensitively
    return processed.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey in context) {
        return (context as any)[lowerKey];
      }
      return match;
    });
  }

  static extractDomain(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace(/^www\./i, "");
    } catch {
      return urlStr.replace(/^https?:\/\//i, "").split("/")[0].replace(/^www\./i, "");
    }
  }

  static extractPath(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      return parsed.pathname || "/";
    } catch {
      const match = urlStr.replace(/^https?:\/\/[^\/]+/i, "");
      return match.startsWith("/") ? match.split(/[?#]/)[0] : "/";
    }
  }

  /**
   * Intelligently derives a human-readable page/article name from the URL path slug,
   * decoding URI components and converting slugs (underscores and hyphens) into clean titles.
   */
  static extractPage(urlStr: string): string {
    try {
      const parsed = new URL(urlStr);
      const pathname = parsed.pathname.replace(/\/+$/, "");
      if (pathname && pathname !== "/") {
        const segments = pathname.split("/").filter((s) => s.length > 0);
        if (segments.length > 0) {
          let lastSegment = segments[segments.length - 1];
          // Strip web extensions (.html, .htm, .php, etc.)
          lastSegment = lastSegment.replace(/\.(html?|php|asp[x]?|jsp|xhtml|md)$/i, "");
          let decoded = lastSegment;
          try {
            decoded = decodeURIComponent(lastSegment);
          } catch {
            // Retain raw segment if URI encoding is malformed
          }
          // Convert underscores and hyphens into clean word breaks
          const cleaned = decoded.replace(/[_-]+/g, " ").trim();
          if (cleaned.length > 0) {
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          }
        }
      }
      return parsed.hostname.replace(/^www\./i, "");
    } catch {
      return this.extractDomain(urlStr);
    }
  }
}

/**
 * The two Editor methods the paste guard reads a note through. Taking just these
 * lets the guard run on the live editor and on a plain stub in tests alike.
 */
export type LineSource = Pick<Editor, "getLine" | "lineCount">;

const isBlank = (char: string): boolean => char === " " || char === "\t";

/**
 * A line's content once the markers that nest it are skipped: any depth of
 * blockquote `>`, then one list item marker (`-`, `*`, `+`, or digits followed
 * by `.` or `)`), then a task checkbox such as `[ ]` or `[x]`. A fence opened
 * inside a quote or a list item is still a fence, so fences are looked for here.
 * A list marker or checkbox only counts when whitespace follows it, so `-x` and
 * `[x]y` stay content.
 */
function lineBody(text: string): string {
  let pos = 0;
  const skipBlanks = () => {
    while (isBlank(text.charAt(pos))) pos++;
  };

  skipBlanks();
  // Each `>` takes at most one following space or tab, so `>  >` is a quote holding a literal `>`.
  while (text.charAt(pos) === ">") {
    pos++;
    if (isBlank(text.charAt(pos))) pos++;
  }
  skipBlanks();

  const bullet = text.charAt(pos);
  let markerEnd = pos;
  if (bullet === "-" || bullet === "*" || bullet === "+") {
    markerEnd = pos + 1;
  } else {
    let digits = pos;
    while (text.charAt(digits) >= "0" && text.charAt(digits) <= "9") digits++;
    const delimiter = text.charAt(digits);
    if (digits > pos && (delimiter === "." || delimiter === ")")) markerEnd = digits + 1;
  }
  if (markerEnd > pos && isBlank(text.charAt(markerEnd))) {
    pos = markerEnd;
    skipBlanks();
    const isCheckbox = text.charAt(pos) === "[" && text.charAt(pos + 2) === "]" && isBlank(text.charAt(pos + 3));
    if (isCheckbox) {
      pos += 3;
      skipBlanks();
    }
  }
  return text.slice(pos).trimStart();
}

/** A fence line's opening run of backticks or tildes, and whatever follows it on the line. */
interface Fence {
  char: "`" | "~";
  length: number;
  info: string;
}

/** The fence `body` opens or closes with, or null when it doesn't start with three or more backticks or tildes. */
function parseFence(body: string): Fence | null {
  const char = body.charAt(0);
  if (char !== "`" && char !== "~") return null;
  let length = 1;
  while (body.charAt(length) === char) length++;
  return length < 3 ? null : { char, length, info: body.slice(length) };
}

/** Whether `fence` ends the block `open` started: the same character, at least as long, and nothing after it, as in CommonMark. */
function closesFence(open: { char: string; length: number }, fence: Fence | null): boolean {
  return fence !== null && fence.char === open.char && fence.length >= open.length && fence.info.trim() === "";
}

/**
 * The line that closes the note's frontmatter, or -1 when it has none. YAML
 * frontmatter opens with `---` on the very first line and closes at the next line
 * that is `---` or `...`; an opening with no close isn't frontmatter at all.
 */
function frontmatterEnd(doc: LineSource): number {
  const isDelimiter = (text: string, closing: boolean) => {
    const trimmed = text.trimEnd();
    return trimmed === "---" || (closing && trimmed === "...");
  };
  if (doc.lineCount() === 0 || !isDelimiter(doc.getLine(0), false)) return -1;
  for (let i = 1; i < doc.lineCount(); i++) {
    if (isDelimiter(doc.getLine(i), true)) return i;
  }
  return -1;
}

/** Whether the given line is in the frontmatter, including its delimiter lines. */
export function isInsideFrontmatter(note: LineSource, lineIndex: number): boolean {
  const end = frontmatterEnd(note);
  return end !== -1 && lineIndex <= end;
}

/** Index of the first line after the frontmatter, or 0 when the note has none. */
function bodyStart(doc: LineSource): number {
  return frontmatterEnd(doc) + 1;
}

/**
 * A construct that can span lines and that a citation must not be pasted into:
 * a fenced code block, an Obsidian `%%` comment, or a `$$` math block. Null in
 * ordinary prose.
 */
type BlockState = { kind: "fence"; char: string; length: number } | { kind: "comment" } | { kind: "math" } | null;

/** Length of the run of backticks starting at index. */
function backtickRun(text: string, index: number): number {
  let end = index;
  while (text.charAt(end) === "`") end++;
  return end - index;
}

/** Start of the next run of exactly `length` backticks at or after `from`, or -1. */
function findBacktickRun(text: string, from: number, length: number): number {
  for (let i = text.indexOf("`", from); i !== -1; ) {
    const run = backtickRun(text, i);
    if (run === length) return i;
    i = text.indexOf("`", i + run);
  }
  return -1;
}

/**
 * Scans one line's text (outside any code fence) for inline code spans, `%%`
 * comment markers and `$$` math markers, starting in `state` and returning the
 * state at the end of the text, plus the prose that is in none of them.
 *
 * Code spans pair backtick runs by exact length, as in CommonMark: in ``a`b``
 * the single backtick is code, not the start of another span, so counting
 * backticks would misjudge the line. Markers inside a code span don't count,
 * and inside a comment or math block only that construct's closing marker
 * does. Outside them a backslash escapes the next character.
 *
 * On the cursor's line the text ends at the cursor, and a backtick run with no
 * partner before it counts as code still being typed (`codeOpen`). On earlier
 * lines such a run is literal text, since a code span never crosses lines here.
 */
function scanSpans(text: string, state: BlockState, atCursor: boolean): { state: BlockState; prose: string; codeOpen: boolean } {
  let prose = "";
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    if (state?.kind === "comment") {
      // Comments are raw text, so nothing in them is escaped.
      if (text.startsWith("%%", i)) {
        state = null;
        i += 2;
      } else i++;
    } else if (state?.kind === "math") {
      // In LaTeX \$ is a literal dollar sign and \\ a line break; skipping pairs handles both.
      if (char === "\\") i += 2;
      else if (text.startsWith("$$", i)) {
        state = null;
        i += 2;
      } else i++;
    } else if (char === "\\") {
      prose += text.slice(i, i + 2);
      i += 2;
    } else if (char === "`") {
      const run = backtickRun(text, i);
      const close = findBacktickRun(text, i + run, run);
      if (close !== -1) i = close + run;
      else if (atCursor) return { state, prose, codeOpen: true };
      else {
        prose += text.slice(i, i + run);
        i += run;
      }
    } else if (text.startsWith("%%", i)) {
      state = { kind: "comment" };
      i += 2;
    } else if (text.startsWith("$$", i)) {
      state = { kind: "math" };
      i += 2;
    } else {
      prose += char;
      i++;
    }
  }
  return { state, prose, codeOpen: false };
}

/**
 * Index of the `$` that closes inline math opened at `open`, or -1 when `open`
 * is not an opener or nothing on the line closes it. Follows Obsidian's rule:
 * the opener is followed by a non-space, and the closer is preceded by a
 * non-space and not followed by a digit. That keeps prices such as "$5 and
 * $10" from reading as math.
 */
function findInlineMathClose(text: string, open: number): number {
  if (!/\S/.test(text.charAt(open + 1))) return -1;
  for (let j = open + 1; j < text.length; j++) {
    const char = text.charAt(j);
    if (char === "\\") {
      j++;
    } else if (char === "$") {
      if (text.charAt(j + 1) === "$") return -1;
      if (/\S/.test(text.charAt(j - 1)) && !/\d/.test(text.charAt(j + 1))) return j;
    }
  }
  return -1;
}

/**
 * Whether the cursor at `ch` sits inside a closed inline `$…$` span on this
 * line. Unlike code, an unclosed `$` doesn't count: a lone dollar sign is far
 * more often a price than math being typed. Code spans and `$$` markers are
 * skipped, since a `$` in them doesn't open inline math.
 */
function isInsideInlineMath(text: string, ch: number): boolean {
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    if (char === "\\") {
      i += 2;
    } else if (char === "`") {
      const run = backtickRun(text, i);
      const close = findBacktickRun(text, i + run, run);
      i = close === -1 ? i + run : close + run;
    } else if (char !== "$") {
      i++;
    } else if (text.charAt(i + 1) === "$") {
      i += 2;
    } else {
      const close = findInlineMathClose(text, i);
      if (close === -1) {
        i++;
        continue;
      }
      if (ch > i && ch <= close) return true;
      i = close + 1;
    }
  }
  return false;
}

/**
 * Whether prose before the cursor, with code spans already removed, leaves it
 * inside link syntax: an unclosed `[` (link text, image alt text, a wikilink, or
 * a stray bracket in prose), or the `( )` destination of a link. A citation
 * pasted there becomes part of the link and breaks it. Escaped characters do
 * not count.
 */
function isInsideLinkSyntax(text: string): boolean {
  let brackets = 0;
  // Open parentheses of the link destination being read; 0 outside one.
  let parens = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (char === "\\") {
      i++;
    } else if (parens > 0) {
      // A destination may hold balanced parentheses of its own, as Wikipedia URLs do.
      if (char === "(") parens++;
      else if (char === ")") parens--;
    } else if (char === "[") {
      brackets++;
    } else if (char === "]") {
      brackets = Math.max(0, brackets - 1);
      if (text.charAt(i + 1) === "(") {
        parens = 1;
        i++;
      }
    }
  }
  return brackets > 0 || parens > 0;
}

/**
 * Whether a paste at (line, ch) is prose that can take a citation, rather than
 * part of other syntax a citation would break: the frontmatter, a code block or
 * its fence line, inline code, a `$$` or `$…$` formula, a `%%` comment, a
 * link's text or `( )` URL, a wikilink, or an HTML tag or attribute being
 * typed. Only the intercepted keyboard paste asks; the explicit paste commands
 * add a citation wherever the user invokes them.
 *
 * The document is read from the end of the frontmatter to the cursor in one
 * pass, so each construct hides the others' markers: a `%%` in a code block,
 * or a fence inside a comment, doesn't count. An unclosed `$$` or `%%` makes
 * the rest of the document count as math or a comment, which errs toward
 * leaving a paste without a citation rather than breaking the markup.
 */
export function canAddCitation(doc: LineSource, line: number, ch: number): boolean {
  if (isInsideFrontmatter(doc, line)) return false;
  let state: BlockState = null;
  for (let i = bodyStart(doc); i <= line; i++) {
    const text = doc.getLine(i);
    const fence = parseFence(lineBody(text));
    if (state?.kind === "fence") {
      // Inside the block, or on its closing line.
      if (i === line) return false;
      if (closesFence(state, fence)) state = null;
      continue;
    }
    if (state === null && fence) {
      if (i === line) return false;
      state = { kind: "fence", char: fence.char, length: fence.length };
      continue;
    }
    if (i < line) {
      state = scanSpans(text, state, false).state;
      continue;
    }
    // The cursor's own line is judged by what has been typed up to it.
    const typed = text.slice(0, ch);
    const scan = scanSpans(typed, state, true);
    if (scan.state !== null || scan.codeOpen || isInsideLinkSyntax(scan.prose)) return false;
    if (isInsideInlineMath(text, ch)) return false;
    // Right after `<` or `="`/`='`, an HTML tag or attribute value is being typed.
    if (typed.endsWith("<") || /=["']$/.test(typed)) return false;
  }
  return true;
}

export class PresetImportExportService {
  static exportPreset(preset: { name: string; template: string; description?: string }): void {
    const payload = {
      $schema: "https://paste-with-source.obsidian.md/schemas/preset-v1.json",
      format: "paste-with-source-preset",
      version: 1,
      name: preset.name,
      description: preset.description || "",
      template: preset.template,
      createdAt: new Date().toISOString(),
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const safeName = preset.name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    a.href = url;
    a.download = `${safeName || "preset"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    new Notice(`Exported preset "${preset.name}" as JSON.`);
  }

  static async importPresetFromFile(file: File): Promise<TemplatePreset> {
    const text = await file.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Selected file is not valid JSON.");
    }

    if (!data || typeof data.template !== "string" || !data.template.trim()) {
      throw new Error("Invalid preset: missing or empty 'template' property.");
    }

    const name = typeof data.name === "string" && data.name.trim()
      ? data.name.trim()
      : file.name.replace(/\.json$/i, "");

    return {
      id: `user-preset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      template: data.template,
      description: typeof data.description === "string" ? data.description : "",
      isBuiltIn: false,
    };
  }
}

export class PresetNameModal extends Modal {
  name: string;
  onSubmit: (name: string) => void;

  constructor(app: App, defaultName: string, onSubmit: (name: string) => void) {
    super(app);
    this.name = defaultName;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Save Template Preset" });

    new Setting(contentEl)
      .setName("Preset Name")
      .setDesc("Enter a descriptive name for your custom citation preset")
      .addText((text) => {
        text.setValue(this.name).onChange((value) => {
          this.name = value;
        });
        text.inputEl.focus();
        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.submit();
          }
        });
      });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Save Preset")
          .setCta()
          .onClick(() => this.submit())
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );
  }

  submit() {
    const trimmed = this.name.trim();
    if (!trimmed) {
      new Notice("Please enter a preset name.");
      return;
    }
    this.close();
    this.onSubmit(trimmed);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}


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
 * Executes a clipboard read operation while suppressing Electron's renderer-process
 * deprecation warnings in the DevTools console.
 */
function safelyReadClipboard<T>(fn: () => T): T {
  const proc = typeof process !== "undefined" ? (process as any) : null;
  const prevNoDeprecation = proc ? proc.noDeprecation : undefined;
  const originalWarn = console.warn;

  try {
    if (proc) {
      proc.noDeprecation = true;
    }
    console.warn = (...args: any[]) => {
      if (
        args.length > 0 &&
        typeof args[0] === "string" &&
        (args[0].includes("clipboard") || args[0].includes("contextBridge"))
      ) {
        return;
      }
      originalWarn.apply(console, args);
    };
    return fn();
  } finally {
    console.warn = originalWarn;
    if (proc) {
      proc.noDeprecation = prevNoDeprecation;
    }
  }
}

/**
 * macOS In-Process Clipboard Provider
 * Reads org.chromium.source-url (Chromium) and com.apple.webarchive (Safari)
 * directly from Electron's in-process clipboard API.
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
      const chromiumUrl = safelyReadClipboard(() => clipboard.read("org.chromium.source-url"));
      if (typeof chromiumUrl === "string" && chromiumUrl.trim().startsWith("http")) {
        return chromiumUrl.trim();
      }

      // 2. Check Safari (com.apple.webarchive)
      const webArchiveBuf: Buffer = safelyReadClipboard(() => clipboard.readBuffer("com.apple.webarchive"));
      if (webArchiveBuf && webArchiveBuf.length > 8) {
        const safariUrl = BplistParser.extractSourceUrl(webArchiveBuf);
        if (safariUrl && safariUrl.trim().startsWith("http")) {
          return safariUrl.trim();
        }
      }

      // 3. Fallback: public.url
      const publicUrl = safelyReadClipboard(() => clipboard.read("public.url"));
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
 * The clipboard format in which Chromium-based browsers and apps on Windows record
 * the address of the page a copy came from. Chromium writes it for every copy,
 * including plain-text-only writes such as `navigator.clipboard.writeText`, which
 * put no "HTML Format" (and so no `SourceURL`) on the clipboard.
 */
const CHROMIUM_SOURCE_URL_FORMAT = "Chromium internal source URL";

/**
 * Reads the page address from a "Chromium internal source URL" clipboard buffer.
 * Chromium stores it as UTF-8 with a trailing NUL. Only http(s) addresses count as
 * a source: Chromium-based desktop apps record their own internal pages too, such
 * as Obsidian's `app://obsidian.md/index.html`, and those aren't worth citing.
 */
export function parseInternalSourceUrl(buf: Buffer): string {
  const url = buf.toString("utf8").replace(/\0/g, "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

/**
 * Windows In-Process Clipboard Provider
 * Reads raw CF_HTML via Electron clipboard.readBuffer("HTML Format"), then
 * Chromium's own source-URL format for plain-text copies, with a zero-binary
 * PowerShell CLI fallback for maximum resilience.
 */
export class WindowsClipboardProvider implements IClipboardSourceProvider {
  /**
   * @param readChromiumSourceUrl Whether to read Chromium's source-URL format when
   *   HTML Format has no `SourceURL`. A function, so a change to the setting applies
   *   to the next paste without rebuilding the provider.
   */
  constructor(private readonly readChromiumSourceUrl: () => boolean = () => true) {}

  async getSourceUrl(): Promise<string> {
    // 1. In-process Electron raw buffer read (< 1ms)
    try {
      const electron = (window as any).require
        ? (window as any).require("electron")
        : require("electron");

      if (electron && electron.clipboard) {
        // Read buffer with deprecation warning suppression
        let buf: Buffer = safelyReadClipboard(() => {
          let b = electron.clipboard.readBuffer("HTML Format");
          if (!b || b.length === 0) {
            b = electron.clipboard.readBuffer('electron application/osclipboard;format="HTML Format"');
          }
          return b;
        });

        if (buf && buf.length > 0) {
          const url = this.parseSourceUrlFromBuffer(buf);
          if (url) return url;
        }

        // A plain-text-only copy leaves no HTML Format, but Chromium still records the page address.
        if (this.readChromiumSourceUrl()) {
          const sourceBuf: Buffer = safelyReadClipboard(() => {
            let b = electron.clipboard.readBuffer(CHROMIUM_SOURCE_URL_FORMAT);
            if (!b || b.length === 0) {
              b = electron.clipboard.readBuffer(`electron application/osclipboard;format="${CHROMIUM_SOURCE_URL_FORMAT}"`);
            }
            return b;
          });
          if (sourceBuf && sourceBuf.length > 0) {
            const url = parseInternalSourceUrl(sourceBuf);
            if (url) return url;
          }
        }
      }
    } catch (err) {
      console.warn("PasteWithSource: Electron clipboard read failed on Windows:", err);
    }

    // 2. Zero-binary fallback: Windows built-in PowerShell CLI
    return this.executePowerShellFallback();
  }

  parseSourceUrlFromBuffer(buf: Buffer): string {
    try {
      const text = buf.toString("utf8");
      const match = text.match(/SourceURL:(https?:\/\/[^\r\n]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
      // ignore
    }
    return "";
  }

  /**
   * The PowerShell fallback's script: print the `SourceURL` from HTML Format and,
   * if there isn't one and `readChromiumSourceUrl` is set, the http(s) address in
   * Chromium's source-URL format. `GetData` returns that format as a MemoryStream
   * of UTF-8 bytes ending in a NUL. The script avoids double quotes because it's
   * passed inside them on the command line.
   */
  static powerShellScript(readChromiumSourceUrl: boolean): string {
    const html =
      "Add-Type -AssemblyName System.Windows.Forms; " +
      "$h = [System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::Html); " +
      "if ($h -match 'SourceURL:(https?://[^\\r\\n]+)') { $matches[1] }";
    if (!readChromiumSourceUrl) return html;
    return (
      html +
      ` else { $d = [System.Windows.Forms.Clipboard]::GetData('${CHROMIUM_SOURCE_URL_FORMAT}'); ` +
      "if ($d -is [System.IO.MemoryStream]) { " +
      "$u = ([System.Text.Encoding]::UTF8.GetString($d.ToArray()) -replace '\\x00', '').Trim(); " +
      "if ($u -match '^https?://') { $u } } }"
    );
  }

  private async executePowerShellFallback(): Promise<string> {
    return new Promise((resolve) => {
      const script = WindowsClipboardProvider.powerShellScript(this.readChromiumSourceUrl());
      const cmd = `powershell.exe -NoProfile -NonInteractive -Command "${script}"`;

      exec(cmd, (error, stdout) => {
        if (error || !stdout) {
          resolve("");
          return;
        }
        const url = stdout.trim();
        resolve(url.startsWith("http") ? url : "");
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

/**
 * Picks the clipboard provider for this platform.
 *
 * @param readChromiumSourceUrl Read at each paste on Windows; see {@link WindowsClipboardProvider}.
 */
export function createClipboardProvider(readChromiumSourceUrl: () => boolean = () => true): IClipboardSourceProvider {
  if (process.platform === "darwin") {
    return new MacOSClipboardProvider();
  } else if (process.platform === "win32") {
    return new WindowsClipboardProvider(readChromiumSourceUrl);
  }
  return new NullClipboardProvider();
}

// ---------------------------------------------------------------------------
// Page Title Fetching
// ---------------------------------------------------------------------------

/** The parts of an HTTP response a title lookup reads. */
export interface PageResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
}

/** Requests a page. The plugin uses {@link requestPage}; tests pass their own so nothing goes over the network. */
export type TitleRequester = (url: string) => Promise<PageResponse>;

/** How long a title lookup may take before the citation keeps the URL in place of the title. */
export const TITLE_FETCH_TIMEOUT_MS = 10_000;

/**
 * How far into a page to look for a `<meta>` charset. The HTML standard wants it in
 * the first 1024 bytes, but some pages put it later.
 */
const CHARSET_SCAN_BYTES = 4096;

/**
 * How much of a page is parsed for its title. The title and the meta tags that
 * carry it sit in `<head>`, so parsing a huge page in full would only cost time.
 */
const TITLE_PARSE_BYTES = 1024 * 1024;

/**
 * Requests a page through Obsidian's `requestUrl` rather than `fetch()`. `fetch()`
 * runs under the app's own origin, so most sites' CORS rules would refuse it.
 * `throw: false` turns an HTTP error status into a normal response to inspect.
 */
const requestPage: TitleRequester = async (url) => {
  const { status, headers, arrayBuffer } = await requestUrl({
    url,
    method: "GET",
    headers: { Accept: "text/html, application/xhtml+xml;q=0.9" },
    throw: false,
  });
  return { status, headers, arrayBuffer };
};

/** Reads a header by name. HTTP header names are case-insensitive, and servers vary in how they send them. */
function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

/** The encoding a `Content-Type` value or a `<meta>` tag names with `charset=`, if any. */
function findCharset(text: string | undefined): string | undefined {
  return text?.match(/charset\s*=\s*["']?\s*([\w.:-]+)/i)?.[1];
}

/** Decodes `bytes` with the named encoding, or returns undefined if `TextDecoder` doesn't know the name. */
function tryDecode(bytes: ArrayBuffer, encoding: string | undefined): string | undefined {
  if (!encoding) return undefined;
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return undefined;
  }
}

/**
 * Turns a page's bytes into text in the encoding the page declares, so a title in,
 * say, Shift_JIS doesn't come out garbled. The `Content-Type` header wins, then a
 * charset named by a `<meta>` tag near the start of the page, then UTF-8.
 */
export function decodeHtml(bytes: ArrayBuffer, contentType?: string): string {
  const fromHeader = tryDecode(bytes, findCharset(contentType));
  if (fromHeader !== undefined) return fromHeader;

  // windows-1252 gives every byte a character, so the ASCII <meta> markup comes
  // out readable whatever the page's real encoding turns out to be.
  const start = new TextDecoder("windows-1252").decode(bytes.slice(0, CHARSET_SCAN_BYTES));
  const declared = (start.match(/<meta\b[^>]*>/gi) ?? [])
    .filter((tag) => /\bcharset\s*=|http-equiv\s*=\s*["']?content-type/i.test(tag))
    .map(findCharset)
    .find((charset) => charset !== undefined);
  return tryDecode(bytes, declared) ?? new TextDecoder("utf-8").decode(bytes);
}

/**
 * Reads a page's title from its HTML: the Open Graph title, then the Twitter card
 * title, then `<title>`. Sites tend to write the social titles for people, without
 * the " | Site Name" tail their `<title>` often carries. `DOMParser` builds an
 * inert document, so none of the page's scripts run and nothing it links to loads.
 */
export function extractPageTitle(html: string): string | undefined {
  const parser = new DOMParser();
  const page = parser.parseFromString(html, "text/html");
  const candidates = [
    page.querySelector('meta[property="og:title" i], meta[name="og:title" i]')?.getAttribute("content"),
    page.querySelector('meta[name="twitter:title" i], meta[property="twitter:title" i]')?.getAttribute("content"),
    page.title,
  ];
  for (const candidate of candidates) {
    const title = candidate?.replace(/\s+/g, " ").trim();
    if (title) return title;
  }
  return undefined;
}

/**
 * Looks up the title of the page at `url`. It resolves to undefined rather than
 * throwing whenever there is no usable title, so a paste never waits on or fails
 * because of it. That covers: a URL that isn't http(s), a failed request, no answer
 * within `timeoutMs`, a non-2xx status, a response that isn't HTML, and a page
 * without a title.
 */
export async function fetchPageTitle(
  url: string,
  request: TitleRequester = requestPage,
  timeoutMs: number = TITLE_FETCH_TIMEOUT_MS
): Promise<string | undefined> {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    return undefined;
  }
  if (protocol !== "http:" && protocol !== "https:") return undefined;

  // requestUrl takes no timeout, so a server that never answers is cut off here instead.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No response within ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    const response = await Promise.race([request(url), timeout]);
    if (response.status < 200 || response.status > 299) return undefined;
    const contentType = getHeader(response.headers, "content-type");
    if (contentType !== undefined && !/html/i.test(contentType)) return undefined;
    const html = decodeHtml(response.arrayBuffer.slice(0, TITLE_PARSE_BYTES), contentType);
    return extractPageTitle(html);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Where `needle` occurs in `text` closest to `offset`, or -1 if it doesn't occur.
 * Used to find a citation again after the note may have changed around it: edits
 * before it shift its position, and the same citation can appear more than once.
 */
export function findNearestOccurrence(text: string, needle: string, offset: number): number {
  let best = -1;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    if (best === -1 || Math.abs(at - offset) < Math.abs(best - offset)) best = at;
  }
  return best;
}

/**
 * A citation as it was at paste time: the template, link label and moment it was
 * rendered with. Re-rendering one once the page title arrives gives the same text
 * apart from the title, even if the user has since switched slots or settings.
 */
export interface PendingCitation {
  template: string;
  linkLabel: LinkLabel;
  url: string;
  now: Date;
}

// ---------------------------------------------------------------------------
// Main Plugin Class
// ---------------------------------------------------------------------------

export default class PasteWithSourcePlugin extends Plugin {
  settings!: PasteWithSourceSettings;
  clipboardProvider!: IClipboardSourceProvider;
  settingTab!: PasteWithSourceSettingTab;
  /** Looks up a page title for a pasted citation. Tests replace it so nothing goes over the network. */
  titleFetcher: (url: string) => Promise<string | undefined> = (url) => fetchPageTitle(url);

  async onload() {
    await this.loadSettings();
    this.clipboardProvider = createClipboardProvider(() => this.settings.readChromiumSourceUrl);
    this.settingTab = new PasteWithSourceSettingTab(this);
    this.addSettingTab(this.settingTab);

    this.addCommand({
      id: "activate-preset-slot-a",
      name: "Activate Citation Preset A (Editable Template)",
      hotkeys: [
        {
          modifiers: ["Mod", "Alt"],
          key: "A",
        },
      ],
      callback: async () => {
        await this.switchToSlot("A");
      },
    });

    this.addCommand({
      id: "activate-preset-slot-b",
      name: "Activate Citation Preset B",
      hotkeys: [
        {
          modifiers: ["Mod", "Alt"],
          key: "B",
        },
      ],
      callback: async () => {
        await this.switchToSlot("B");
      },
    });

    this.addCommand({
      id: "activate-preset-slot-c",
      name: "Activate Citation Preset C",
      hotkeys: [
        {
          modifiers: ["Mod", "Alt"],
          key: "C",
        },
      ],
      callback: async () => {
        await this.switchToSlot("C");
      },
    });

    this.addCommand({
      id: "paste-default-plus-source",
      name: "Paste (Default) + Source URL",
      callback: async () => {
        const info = this.app.workspace.activeEditor;
        if (info?.editor) await this.pasteDefaultPlusSource(info.editor, info);
      },
    });

    this.addCommand({
      id: "paste-with-source-url",
      name: "Paste with Source URL",
      callback: async () => {
        const info = this.app.workspace.activeEditor;
        if (info?.editor) await this.pasteWithSource(info.editor, info);
      },
    });

    // Add context menu items
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, info: MarkdownFileInfo) => {
        menu.addItem((item) =>
          item
            .setTitle("Paste (Default Handler) + Source URL")
            .setIcon("clipboard")
            .onClick(() => this.pasteDefaultPlusSource(editor, info))
        );
        menu.addItem((item) =>
          item
            .setTitle("Paste Clipboard with Source URL")
            .setIcon("paste")
            .onClick(() => this.pasteWithSource(editor, info))
        );
      })
    );

    /**
     * Intercepts the paste shortcut to add a citation. The cursor position and
     * preventDefault() are both decided before the first await: the browser
     * runs its default action as soon as this listener yields, so a later
     * preventDefault() cannot stop Obsidian's own paste, and once that paste
     * runs it moves the cursor away from where the content lands. The editor
     * must also have keyboard focus, because activeEditor follows the active
     * view rather than focus: without the check, a paste into the search box or
     * a settings field would be redirected into, or cited onto, the note.
     */
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

      const info = this.app.workspace.activeEditor;
      const editor = info?.editor;
      if (!info || !editor || !editor.hasFocus()) return;

      const from = editor.getCursor("from");
      const citable = canAddCitation(editor, from.line, from.ch);

      if (this.settings.pasteMode === "clipboard+source") {
        if (!citable && this.settings.guardedPasteFallback === "native") return;
        event.preventDefault();
        if (!citable) {
          editor.replaceSelection(await navigator.clipboard.readText());
          return;
        }
        const sourceUrl = await this.getClipboardSourceUrl();
        const clipboardText = await navigator.clipboard.readText();
        this.insertWithCitation(editor, info, clipboardText, sourceUrl);
      } else if (this.settings.pasteMode === "default+source") {
        // Obsidian's own paste always runs in this mode; a guarded position just gets no citation after it.
        if (!citable) return;
        const sourceUrl = await this.getClipboardSourceUrl();
        setTimeout(() => {
          if (sourceUrl) this.insertWithCitation(editor, info, "", sourceUrl);
        }, 50);
      }
    });
  }

  getActiveTemplate(): { template: string; name: string; slot: "A" | "B" | "C" } {
    if (this.settings.activeSlot === "B") {
      const preset = PresetManager.getPresetById(this.settings.presetSlotB, this.settings.userPresets);
      if (preset) return { template: preset.template, name: preset.name, slot: "B" };
      const fallbackB = PresetManager.getPresetById(DEFAULT_SETTINGS.presetSlotB, this.settings.userPresets);
      if (fallbackB) return { template: fallbackB.template, name: fallbackB.name, slot: "B" };
    } else if (this.settings.activeSlot === "C") {
      const preset = PresetManager.getPresetById(this.settings.presetSlotC, this.settings.userPresets);
      if (preset) return { template: preset.template, name: preset.name, slot: "C" };
      const fallbackC = PresetManager.getPresetById(DEFAULT_SETTINGS.presetSlotC, this.settings.userPresets);
      if (fallbackC) return { template: fallbackC.template, name: fallbackC.name, slot: "C" };
    }
    // Slot A (default): editable preset from settings
    const selectedPreset = PresetManager.getPresetById(this.settings.selectedPresetId, this.settings.userPresets);
    const name = selectedPreset ? selectedPreset.name : "Custom Template";
    return { template: this.settings.templateString, name, slot: "A" };
  }

  async switchToSlot(slot: "A" | "B" | "C") {
    this.settings.activeSlot = slot;
    await this.saveSettings();
    const active = this.getActiveTemplate();
    new Notice(`Active Citation Preset: [Slot ${slot}] ${active.name}`);
    if (this.settingTab) {
      this.settingTab.display();
    }
  }

  /** The citation for `url` with the active template, as it reads before any page title has been fetched. */
  getSourceLinkMarkdown(url: string): string {
    return this.renderCitation(this.prepareCitation(url));
  }

  /** Captures what a citation for `url` is rendered with right now, so it can be rendered again once its title arrives. */
  prepareCitation(url: string): PendingCitation {
    return { template: this.getActiveTemplate().template, linkLabel: this.settings.linkLabel, url, now: new Date() };
  }

  /** Renders `citation`, with `title` in place of the URL wherever the template uses the page title. */
  renderCitation(citation: PendingCitation, title?: string): string {
    const context = TemplateEngine.buildContext(citation.url, citation.linkLabel, title, citation.now);
    return TemplateEngine.render(citation.template, context);
  }

  /**
   * Replaces the selection with `text` followed by the citation for `sourceUrl`, or
   * just `text` when there is no source URL. If the citation needs the page title,
   * it goes in with the URL in its place and {@link swapInTitle} updates it once the
   * title arrives, so the paste itself never waits on the network.
   */
  insertWithCitation(editor: Editor, info: MarkdownFileInfo, text: string, sourceUrl: string): void {
    const citation = sourceUrl ? this.prepareCitation(sourceUrl) : undefined;
    const rendered = citation ? this.renderCitation(citation) : "";
    editor.replaceSelection(text + rendered);
    if (!citation || !rendered) return;
    // The cursor ends up just after what was inserted, so the citation starts its length before it.
    const offset = editor.posToOffset(editor.getCursor()) - rendered.length;
    void this.swapInTitle(info, citation, rendered, offset);
  }

  /**
   * Once the page title arrives, replaces the citation inserted as `inserted` at
   * `offset` with the same citation showing the title. It leaves the note alone when
   * the template doesn't use the title, no title could be fetched, the pane now shows
   * a different note, or the citation no longer appears as it was inserted (the user
   * edited or deleted it). Of several identical citations, the one nearest `offset`
   * is the one replaced.
   */
  async swapInTitle(info: MarkdownFileInfo, citation: PendingCitation, inserted: string, offset: number): Promise<void> {
    if (!TemplateEngine.templateNeedsTitle(citation.template, citation.linkLabel)) return;
    const path = info.file?.path;
    const title = await this.titleFetcher(citation.url);
    if (!title) return;

    const titled = this.renderCitation(citation, title);
    const editor = info.editor;
    if (titled === inserted || !editor || info.file?.path !== path) return;

    const at = findNearestOccurrence(editor.getValue(), inserted, offset);
    if (at === -1) return;
    editor.replaceRange(titled, editor.offsetToPos(at), editor.offsetToPos(at + inserted.length));
  }

  /** The bare `{link}` markdown for `url`. A "title" label falls back to the URL, since this inserts at once. */
  formatSourceLink(url: string): string {
    return TemplateEngine.buildContext(url, this.settings.linkLabel).link;
  }

  async pasteWithSource(editor: Editor, info: MarkdownFileInfo) {
    const clipboardText = await navigator.clipboard.readText();
    const sourceUrl = await this.getClipboardSourceUrl();
    this.insertWithCitation(editor, info, clipboardText, sourceUrl);
  }

  async pasteSourceOnly(editor: Editor) {
    const sourceUrl = await this.getClipboardSourceUrl();
    if (sourceUrl) {
      editor.replaceSelection(this.formatSourceLink(sourceUrl));
    } else {
      console.warn("No valid SourceURL found.");
    }
  }

  async pasteDefaultPlusSource(editor: Editor, info: MarkdownFileInfo) {
    const sourceUrl = await this.getClipboardSourceUrl();
    if (!sourceUrl) return;

    setTimeout(() => {
      this.insertWithCitation(editor, info, "", sourceUrl);
    }, 50);
  }

  async getClipboardSourceUrl(): Promise<string> {
    return this.clipboardProvider.getSourceUrl();
  }

  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

    // Migration for existing installations without templateString
    if (!loadedData || typeof loadedData.templateString === "undefined") {
      if (this.settings.citationStyle === "Source") {
        this.settings.templateString = "\n\n> — [Source]({url})";
        this.settings.selectedPresetId = "builtin-markdown-quote";
      } else {
        this.settings.templateString = "\n\nFrom <{link}>";
        this.settings.selectedPresetId = "builtin-onenote";
      }
    }

    if (!Array.isArray(this.settings.userPresets)) {
      this.settings.userPresets = [];
    }

    if (!this.settings.activeSlot) {
      this.settings.activeSlot = "A";
    }
    if (this.settings.guardedPasteFallback !== "native" && this.settings.guardedPasteFallback !== "plain") {
      this.settings.guardedPasteFallback = DEFAULT_SETTINGS.guardedPasteFallback;
    }
    if (typeof this.settings.readChromiumSourceUrl !== "boolean") {
      this.settings.readChromiumSourceUrl = DEFAULT_SETTINGS.readChromiumSourceUrl;
    }
    if (!LINK_LABELS.includes(this.settings.linkLabel)) {
      this.settings.linkLabel = DEFAULT_SETTINGS.linkLabel;
    }
    // Replaced by linkLabel. The plugin had no users yet, so the old toggle isn't carried over.
    delete (this.settings as { useUrlAsLinkLabel?: boolean }).useUrlAsLinkLabel;
    if (!this.settings.presetSlotB) {
      this.settings.presetSlotB = DEFAULT_SETTINGS.presetSlotB;
    }
    if (!this.settings.presetSlotC) {
      this.settings.presetSlotC = DEFAULT_SETTINGS.presetSlotC;
    }
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
            // Re-render so the guarded paste setting below appears or disappears with the mode.
            this.display();
          })
      );

    // In "Default handler + source" mode Obsidian's own paste always runs, so there is nothing to choose.
    if (this.plugin.settings.pasteMode === "clipboard+source") {
      new Setting(containerEl)
        .setName("When a citation can't be added")
        .setDesc(
          "Pastes inside code, math, comments, frontmatter, links, and wikilinks get no citation. " +
          "Choose what such a paste does: Obsidian's native paste, as if this plugin were off, or the clipboard's plain text."
        )
        .addDropdown((dropdown) =>
          dropdown
            .addOption("native", "Obsidian's native paste (Default)")
            .addOption("plain", "Plain clipboard text")
            .setValue(this.plugin.settings.guardedPasteFallback)
            .onChange(async (value: string) => {
              this.plugin.settings.guardedPasteFallback = value as GuardedPasteFallback;
              await this.plugin.saveSettings();
            })
        );
    }

    // macOS always reads Chromium's equivalent format, as its main source for Chrome copies, so there's nothing to choose there.
    if (process.platform === "win32") {
      new Setting(containerEl)
        .setName("Cite plain-text copies from Chromium apps")
        .setDesc(
          "When a browser or app built on Chromium (Chrome, Edge, Brave, Slack, …) copies plain text only, such as from a Copy button, " +
          "read the page address it leaves on the clipboard. Turn off if plain-text copies from desktop apps get citations you don't want."
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.readChromiumSourceUrl)
            .onChange(async (value) => {
              this.plugin.settings.readChromiumSourceUrl = value;
              await this.plugin.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName("Link Label")
      .setDesc(
        "How {link} is labeled in every template. Page title requests each pasted page from its website to read its title, " +
        "showing the URL until the title arrives or if it can't be read. The other options make no network requests."
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("title", "Page title, fetched from the page (Default)")
          .addOption("page", "Page name, from the URL")
          .addOption("url", "URL")
          .addOption("source", "\"Source\"")
          .setValue(this.plugin.settings.linkLabel)
          .onChange(async (value: string) => {
            this.plugin.settings.linkLabel = value as LinkLabel;
            await this.plugin.saveSettings();
            updateLivePreview();
          })
      );

    containerEl.createEl("hr");
    containerEl.createEl("h3", { text: "Citation Template & Presets" });

    const descEl = containerEl.createEl("p", {
      text: "The text area below is the authoritative template evaluated at paste time. Presets allow you to quickly load, save, export, and import pre-configured citation formats.",
    });
    descEl.style.fontSize = "0.9em";
    descEl.style.color = "var(--text-muted)";

    // Live preview function reference
    let updateLivePreview: () => void = () => {};

    // Template Preset Selection Dropdown
    const allPresets = PresetManager.getAllPresets(this.plugin.settings.userPresets);
    let selectedPreset = PresetManager.getPresetById(this.plugin.settings.selectedPresetId, this.plugin.settings.userPresets) || allPresets[0];

    new Setting(containerEl)
      .setName("Template Preset")
      .setDesc("Choose a preset to load into the authoritative template box below")
      .addDropdown((dropdown) => {
        for (const preset of allPresets) {
          const prefix = preset.isBuiltIn ? "★ " : "✎ ";
          dropdown.addOption(preset.id, `${prefix}${preset.name}`);
        }
        dropdown.setValue(selectedPreset.id);
        dropdown.onChange(async (presetId) => {
          const chosen = PresetManager.getPresetById(presetId, this.plugin.settings.userPresets);
          if (chosen) {
            this.plugin.settings.selectedPresetId = chosen.id;
            this.plugin.settings.templateString = chosen.template;
            await this.plugin.saveSettings();
            this.display();
          }
        });
      });

    // Preset Action Toolbar
    const toolbarSetting = new Setting(containerEl)
      .setName("Preset Actions")
      .setDesc("Manage your custom presets and share them as JSON files");

    // Responsive layout: Stack info above controls and wrap buttons so text is never squished
    toolbarSetting.settingEl.style.display = "flex";
    toolbarSetting.settingEl.style.flexDirection = "column";
    toolbarSetting.settingEl.style.alignItems = "stretch";
    toolbarSetting.settingEl.style.gap = "8px";

    toolbarSetting.infoEl.style.width = "100%";
    toolbarSetting.infoEl.style.marginRight = "0";

    toolbarSetting.controlEl.style.display = "flex";
    toolbarSetting.controlEl.style.flexWrap = "wrap";
    toolbarSetting.controlEl.style.justifyContent = "flex-start";
    toolbarSetting.controlEl.style.gap = "8px";
    toolbarSetting.controlEl.style.width = "100%";

    const styleActionButton = (btn: any) => {
      if (btn && btn.buttonEl) {
        btn.buttonEl.style.whiteSpace = "nowrap";
        btn.buttonEl.style.flexShrink = "0";
      }
    };

    // Button: Save As New Preset
    toolbarSetting.addButton((btn) => {
      btn
        .setButtonText("Save As New")
        .setTooltip("Save current text box content as a new custom preset")
        .onClick(() => {
          new PresetNameModal(this.app, "My Custom Citation", async (name) => {
            const newPreset: TemplatePreset = {
              id: `user-preset-${Date.now()}`,
              name,
              template: this.plugin.settings.templateString,
              isBuiltIn: false,
            };
            this.plugin.settings.userPresets.push(newPreset);
            this.plugin.settings.selectedPresetId = newPreset.id;
            await this.plugin.saveSettings();
            new Notice(`Saved preset "${name}".`);
            this.display();
          }).open();
        });
      styleActionButton(btn);
    });

    // Button: Update Preset (disabled for built-ins)
    toolbarSetting.addButton((btn) => {
      btn
        .setButtonText("Update Preset")
        .setTooltip(selectedPreset.isBuiltIn ? "Built-in presets cannot be overwritten" : "Update selected preset with current text box content")
        .setDisabled(!!selectedPreset.isBuiltIn)
        .onClick(async () => {
          if (selectedPreset.isBuiltIn) return;
          selectedPreset.template = this.plugin.settings.templateString;
          await this.plugin.saveSettings();
          new Notice(`Updated preset "${selectedPreset.name}".`);
          this.display();
        });
      styleActionButton(btn);
    });

    // Button: Delete Preset (disabled for built-ins)
    toolbarSetting.addButton((btn) => {
      btn
        .setButtonText("Delete Preset")
        .setWarning()
        .setTooltip(selectedPreset.isBuiltIn ? "Built-in presets cannot be deleted" : "Delete selected custom preset")
        .setDisabled(!!selectedPreset.isBuiltIn)
        .onClick(async () => {
          if (selectedPreset.isBuiltIn) return;
          this.plugin.settings.userPresets = this.plugin.settings.userPresets.filter((p) => p.id !== selectedPreset.id);
          this.plugin.settings.selectedPresetId = "builtin-onenote";
          await this.plugin.saveSettings();
          new Notice(`Deleted preset "${selectedPreset.name}".`);
          this.display();
        });
      styleActionButton(btn);
    });

    // Button: Export JSON
    toolbarSetting.addButton((btn) => {
      btn
        .setButtonText("Export JSON")
        .setTooltip("Download selected preset as a standalone JSON file")
        .onClick(() => {
          PresetImportExportService.exportPreset(selectedPreset);
        });
      styleActionButton(btn);
    });

    // Button: Import JSON
    toolbarSetting.addButton((btn) => {
      btn
        .setButtonText("Import JSON")
        .setTooltip("Import a preset from a JSON file")
        .onClick(() => {
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = ".json";
          fileInput.style.display = "none";
          document.body.appendChild(fileInput);

          fileInput.onchange = async () => {
            if (fileInput.files && fileInput.files[0]) {
              try {
                const imported = await PresetImportExportService.importPresetFromFile(fileInput.files[0]);
                this.plugin.settings.userPresets.push(imported);
                this.plugin.settings.selectedPresetId = imported.id;
                this.plugin.settings.templateString = imported.template;
                await this.plugin.saveSettings();
                new Notice(`Successfully imported "${imported.name}"!`);
                this.display();
              } catch (err: any) {
                new Notice(`Failed to import preset: ${err.message || err}`);
              }
            }
            document.body.removeChild(fileInput);
          };

          fileInput.click();
        });
      styleActionButton(btn);
    });

    // Authoritative Template Text Area (Preset Slot A)
    new Setting(containerEl)
      .setName("Citation Template (Preset Slot A)")
      .setDesc("Directly edit the primary template string. This defines Preset Slot A (Ctrl+Alt+A). Literal newlines and \\n are evaluated when pasting.");

    const textAreaEl = containerEl.createEl("textarea", {
      cls: "paste-with-source-template-textarea",
    });
    textAreaEl.value = this.plugin.settings.templateString;
    textAreaEl.rows = 4;
    textAreaEl.style.width = "100%";
    textAreaEl.style.fontFamily = "var(--font-monospace)";
    textAreaEl.style.fontSize = "0.9em";
    textAreaEl.style.padding = "8px";
    textAreaEl.style.borderRadius = "4px";
    textAreaEl.style.border = "1px solid var(--background-modifier-border)";
    textAreaEl.style.backgroundColor = "var(--background-primary)";
    textAreaEl.style.color = "var(--text-normal)";
    textAreaEl.style.resize = "vertical";

    textAreaEl.addEventListener("input", async () => {
      this.plugin.settings.templateString = textAreaEl.value;
      await this.plugin.saveSettings();
      updateLivePreview();
    });

    // Clickable Variable Badges
    const pillsContainer = containerEl.createEl("div");
    pillsContainer.style.display = "flex";
    pillsContainer.style.flexWrap = "wrap";
    pillsContainer.style.alignItems = "center";
    pillsContainer.style.gap = "4px";
    pillsContainer.style.marginTop = "8px";
    pillsContainer.style.marginBottom = "15px";

    const pillsLabel = pillsContainer.createEl("span", { text: "Click to insert variable: " });
    pillsLabel.style.fontSize = "0.85em";
    pillsLabel.style.color = "var(--text-muted)";
    pillsLabel.style.marginRight = "4px";
    pillsLabel.style.flexShrink = "0";

    const variables = [
      { tag: "{url}", desc: "Origin URL" },
      { tag: "{domain}", desc: "Hostname" },
      { tag: "{page}", desc: "Page/Article Name" },
      { tag: "{title}", desc: "Page title, fetched from the page; the URL until it arrives" },
      { tag: "{path}", desc: "URL Path" },
      { tag: "{date}", desc: "Date (YYYY-MM-DD)" },
      { tag: "{time}", desc: "Local Time 24h with Timezone (HH:mm TZ)" },
      { tag: "{timez}", desc: "UTC/Zulu Time 24h (HH:mmZ)" },
      { tag: "{time12h}", desc: "Local Time 12h (hh:mm AM/PM)" },
      { tag: "{timezone}", desc: "Timezone Code (e.g. PDT, EST, UTC)" },
      { tag: "{datetime}", desc: "Local ISO 8601 24h with Offset (YYYY-MM-DDTHH:mm±HH:mm)" },
      { tag: "{datetimez}", desc: "UTC/Zulu ISO 8601 24h (YYYY-MM-DDTHH:mmZ)" },
      { tag: "{datetime12h}", desc: "Local Date & 12h Time (YYYY-MM-DD hh:mm AM/PM)" },
      { tag: "{iso}", desc: "Full UTC ISO 8601 Timestamp" },
      { tag: "{link}", desc: "Markdown Link" },
      { tag: "\\n", desc: "Newline" },
    ];

    for (const v of variables) {
      const pill = pillsContainer.createEl("button", { text: v.tag });
      pill.style.fontSize = "0.8em";
      pill.style.padding = "2px 6px";
      pill.style.margin = "0";
      pill.style.whiteSpace = "nowrap";
      pill.style.flexShrink = "0";
      pill.style.borderRadius = "3px";
      pill.style.cursor = "pointer";
      pill.title = v.desc;
      pill.addEventListener("click", async (e) => {
        e.preventDefault();
        const start = textAreaEl.selectionStart || 0;
        const end = textAreaEl.selectionEnd || 0;
        const curVal = textAreaEl.value;
        textAreaEl.value = curVal.substring(0, start) + v.tag + curVal.substring(end);
        textAreaEl.selectionStart = textAreaEl.selectionEnd = start + v.tag.length;
        textAreaEl.focus();

        this.plugin.settings.templateString = textAreaEl.value;
        await this.plugin.saveSettings();
        updateLivePreview();
      });
    }

    // Dynamic Live Preview Box
    const previewHeader = containerEl.createEl("div", { text: "👁️ Live Preview (Sample URL):" });
    previewHeader.style.fontWeight = "bold";
    previewHeader.style.fontSize = "0.9em";
    previewHeader.style.marginBottom = "5px";

    const previewBox = containerEl.createEl("pre");
    previewBox.style.padding = "10px";
    previewBox.style.borderRadius = "4px";
    previewBox.style.backgroundColor = "var(--background-secondary)";
    previewBox.style.border = "1px solid var(--background-modifier-border)";
    previewBox.style.whiteSpace = "pre-wrap";
    previewBox.style.wordBreak = "break-all";
    previewBox.style.fontFamily = "var(--font-monospace)";
    previewBox.style.fontSize = "0.85em";
    previewBox.style.margin = "0 0 20px 0";

    updateLivePreview = () => {
      const { templateString, linkLabel } = this.plugin.settings;
      // A fixed sample title stands in for a fetch, so the preview never makes a network request.
      const sampleTitle = TemplateEngine.templateNeedsTitle(templateString, linkLabel)
        ? "Obsidian (software) - Wikipedia"
        : undefined;
      const sampleContext = TemplateEngine.buildContext(
        "https://en.wikipedia.org/wiki/Obsidian_(software)",
        linkLabel,
        sampleTitle
      );
      const rendered = TemplateEngine.render(templateString, sampleContext);
      previewBox.textContent = rendered || "(Empty template - nothing will be appended)";
    };

    // Initial preview render
    updateLivePreview();

    // -----------------------------------------------------------------------
    // Quick Preset Hotkeys Section
    // -----------------------------------------------------------------------
    containerEl.createEl("hr");
    containerEl.createEl("h3", { text: "Quick Preset Hotkeys (Slots A, B, C)" });

    const hotkeysDescEl = containerEl.createEl("p", {
      text: "Switch the active citation preset on the fly using hotkeys without opening settings. Standard paste (Ctrl+V) will append the citation from whichever slot is currently active.",
    });
    hotkeysDescEl.style.fontSize = "0.9em";
    hotkeysDescEl.style.color = "var(--text-muted)";

    // Active Preset Slot Status & Quick Switcher Buttons
    const activeInfo = this.plugin.getActiveTemplate();
    const activeSlotSetting = new Setting(containerEl)
      .setName("Active Preset Slot")
      .setDesc(`Currently active: Slot ${this.plugin.settings.activeSlot} (${activeInfo.name})`);

    activeSlotSetting.addButton((btn) => {
      btn
        .setButtonText("Slot A")
        .setTooltip("Activate Preset Slot A (Editable Template)")
        .onClick(async () => {
          await this.plugin.switchToSlot("A");
        });
      if (this.plugin.settings.activeSlot === "A") btn.setCta();
      else btn.removeCta();
    });

    activeSlotSetting.addButton((btn) => {
      btn
        .setButtonText("Slot B")
        .setTooltip("Activate Preset Slot B")
        .onClick(async () => {
          await this.plugin.switchToSlot("B");
        });
      if (this.plugin.settings.activeSlot === "B") btn.setCta();
      else btn.removeCta();
    });

    activeSlotSetting.addButton((btn) => {
      btn
        .setButtonText("Slot C")
        .setTooltip("Activate Preset Slot C")
        .onClick(async () => {
          await this.plugin.switchToSlot("C");
        });
      if (this.plugin.settings.activeSlot === "C") btn.setCta();
      else btn.removeCta();
    });

    // Slot A information
    new Setting(containerEl)
      .setName("Preset Slot A (Ctrl+Alt+A)")
      .setDesc("Always uses the editable Citation Template above. Edits to the template take effect immediately.");

    // Slot B dropdown
    const presetB =
      PresetManager.getPresetById(this.plugin.settings.presetSlotB, this.plugin.settings.userPresets) ||
      PresetManager.getPresetById(DEFAULT_SETTINGS.presetSlotB, this.plugin.settings.userPresets) ||
      allPresets[0];

    const slotBSetting = new Setting(containerEl)
      .setName("Preset Slot B (Ctrl+Alt+B)")
      .setDesc(presetB.description || presetB.template.replace(/\\n/g, " ").trim())
      .addDropdown((dropdown) => {
        for (const preset of allPresets) {
          const prefix = preset.isBuiltIn ? "★ " : "✎ ";
          dropdown.addOption(preset.id, `${prefix}${preset.name}`);
        }
        dropdown.setValue(presetB.id);
        dropdown.onChange(async (presetId) => {
          this.plugin.settings.presetSlotB = presetId;
          await this.plugin.saveSettings();
          const chosen = PresetManager.getPresetById(presetId, this.plugin.settings.userPresets);
          if (chosen) {
            slotBSetting.setDesc(chosen.description || chosen.template.replace(/\\n/g, " ").trim());
          }
          if (this.plugin.settings.activeSlot === "B") {
            this.display();
          }
        });
      });

    // Slot C dropdown
    const presetC =
      PresetManager.getPresetById(this.plugin.settings.presetSlotC, this.plugin.settings.userPresets) ||
      PresetManager.getPresetById(DEFAULT_SETTINGS.presetSlotC, this.plugin.settings.userPresets) ||
      allPresets[0];

    const slotCSetting = new Setting(containerEl)
      .setName("Preset Slot C (Ctrl+Alt+C)")
      .setDesc(presetC.description || presetC.template.replace(/\\n/g, " ").trim())
      .addDropdown((dropdown) => {
        for (const preset of allPresets) {
          const prefix = preset.isBuiltIn ? "★ " : "✎ ";
          dropdown.addOption(preset.id, `${prefix}${preset.name}`);
        }
        dropdown.setValue(presetC.id);
        dropdown.onChange(async (presetId) => {
          this.plugin.settings.presetSlotC = presetId;
          await this.plugin.saveSettings();
          const chosen = PresetManager.getPresetById(presetId, this.plugin.settings.userPresets);
          if (chosen) {
            slotCSetting.setDesc(chosen.description || chosen.template.replace(/\\n/g, " ").trim());
          }
          if (this.plugin.settings.activeSlot === "C") {
            this.display();
          }
        });
      });
  }
}
