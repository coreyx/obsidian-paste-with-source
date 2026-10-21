---
status: draft
---

# Label citations with the page's fetched title

Replace the **Use URL as Link Label** toggle with a **Link Label** dropdown: *URL*, *"Source"* or *Page title*. Add a `{title}` template variable as well. When the active template needs the page title, the paste goes in at once with a fallback label, the page is requested from its site, and the fallback is swapped for the title when it arrives. The title fetcher is written from scratch for this plugin.

## User Review Required

> [!IMPORTANT]
> **Page title mode and `{title}` make a network request for every paste that uses them.** The request goes from Obsidian to the copied page's site, which can log it. Nothing is requested unless the active template contains `{title}`, or contains `{link}` with Link Label set to *Page title*. The README and the setting's description both say so. This is the plugin's first network use, and Obsidian's plugin guidelines require disclosing it.

> [!IMPORTANT]
> **The citation can change a moment after the paste.** It goes in with the URL in place of the title, both as `{link}`'s label and as `{title}`, then becomes the title once the page responds, which is usually under a second and never later than the 10-second timeout. The swap is a separate edit, so undo first takes the citation back to its fallback label. If the citation was edited, moved too far, or its note closed before the title arrived, it is left as it is.

> [!NOTE]
> **Saved settings carry over.** `useUrlAsLinkLabel: true` becomes *URL* and `false` becomes *"Source"*, and the old key is dropped from `data.json` on the next save.

> [!NOTE]
> **Some sites hand an automated request a sign-in or bot-check page**, so the title can come back as something like "Just a moment…". This plan can't get past that. A page with no title, or a failed or timed-out request, leaves the fallback label in place.

> [!NOTE]
> **`jsdom` becomes a dev dependency** (pinned to `30.1.2`, plus `@types/jsdom` `30.0.0`), used only so the tests can run the title parser. Nothing new ships to users.

## Open Questions

1. **Should any built-in presets switch from `{page}` to `{title}`?** Seven presets put `{page}`, a name guessed from the URL's last path segment, in the visible link text. A real title reads better in each:
   - **Italic Attribution**: `— *Source: [{page}]({url})*`
   - **Parenthetical**: `(Source: [{page}]({url}))`
   - **Academic Citation**: `Source: [{page}]({url}) via {domain} (Accessed: {date} at {time12h})`
   - **Obsidian Callout**: `> [!info] Source: [{page}]({url})`
   - **Timestamped (ISO 8601)**: `— *Source: [{page}]({url})* [{datetime}]`
   - **Zulu / UTC Research Log**: `Source: [{page}]({url}) (Retrieved: {datetimez})`
   - **12-Hour Casual**: `Source: [{page}]({url}) ({date} at {time12h})`

   Switching a preset turns on fetching for everyone who uses it. This plan leaves all seven unchanged; each one you choose to switch becomes a one-line change to its `template` in `BUILTIN_PRESETS`. **Minimal Domain**, **Markdown Quote**, **Raw URL** and **OneNote Style** don't use `{page}`.

## Proposed Changes

### Settings

#### [MODIFY] `main.ts`
- [ ] **TASK-1:** Replace the `useUrlAsLinkLabel: boolean` setting with `linkLabel: LinkLabel`, where `type LinkLabel = "url" | "source" | "title"`.
  - `DEFAULT_SETTINGS.linkLabel` is `"url"`, the current default.
  - In `loadSettings`, an invalid or missing `linkLabel` is derived from a stored `useUrlAsLinkLabel` (`false` → `"source"`, anything else → `"url"`). The legacy key is then deleted from `this.settings`, so `saveSettings` stops writing it.
  - Update the TSDoc on `PasteWithSourceSettings` for the new field.

### Template engine

#### [MODIFY] `main.ts`
- [ ] **TASK-2:** Make `TemplateEngine` aware of page titles.
  - `buildContext(url, linkLabel: LinkLabel = "url", title?: string, now: Date = new Date())`.
    - Passing `now` lets the swap re-render the citation with the same date and time it was first inserted with.
  - `TemplateContext` gains `title`: the escaped fetched title, or the URL when there is none. The URL is shown as it is, unescaped, the same text `{url}` gives.
  - `link`:
    - `"url"`: `[url](url)`
    - `"source"`: `[Source](url)`
    - `"title"`: `[<escaped title>](url)` when a title is given, otherwise `[url](url)`
  - New `escapeLinkText(text)`: collapses runs of whitespace to one space, trims, and backslash-escapes `\`, `[` and `]`, so a title can't end the link text early. In prose, Obsidian renders `\[` as `[`, so the escaped `{title}` reads correctly outside links too.
  - New `templateNeedsTitle(template, linkLabel)`: true when the template contains `{title}`, or when it contains `{link}` and `linkLabel` is `"title"`. Matching is case-insensitive, like `render`.

### Title fetching

#### [MODIFY] `main.ts`
- [ ] **TASK-3:** Add a title fetcher, written from scratch, as exported functions near the clipboard providers.
  - `decodeHtml(bytes: ArrayBuffer, contentType?: string): string`
    - Decodes with the `charset` from the `Content-Type` header if it names one that `TextDecoder` accepts.
    - Otherwise it uses the charset a `<meta charset>` or `<meta http-equiv="Content-Type">` names in the first 4 KB, read as `windows-1252` so every byte maps to a character.
    - Otherwise UTF-8.
  - `extractPageTitle(html: string): string | undefined`
    - Parses with `DOMParser` as `text/html`, which builds an inert document: no scripts run and nothing loads.
    - Returns the first non-empty of `meta[property="og:title"]`, `meta[name="twitter:title"]` and `document.title`, with whitespace collapsed.
  - `fetchPageTitle(url, request: TitleRequester = requestPage, timeoutMs = 10_000): Promise<string | undefined>`
    - Resolves to `undefined`, and never throws, when any of these hold: the URL isn't `http`/`https`, the request fails or outlives `timeoutMs`, the status isn't 2xx, the `Content-Type` is present and isn't HTML, or the page has no title.
    - `TitleRequester` is a `(url) => Promise<{ status, headers, arrayBuffer }>` seam for tests.
    - The default `requestPage` wraps Obsidian's `requestUrl` (imported from `obsidian`) with `method: "GET"`, `Accept: text/html,application/xhtml+xml` and `throw: false`. `requestUrl` is used because a plain `fetch` from the app would be blocked by the sites' CORS rules.
    - The timeout uses `setTimeout`/`clearTimeout`, since `requestUrl` has no timeout of its own.

### Paste flows

#### [MODIFY] `main.ts`
- [ ] **TASK-4:** Insert the citation with fallbacks, then swap in the fetched title.
  - New `prepareCitation(url)`, which returns `{ template, url, now }`.
    - The active template is captured at paste time, so switching slots while the page loads doesn't change the result.
    - `getSourceLinkMarkdown(url)` keeps its signature and renders a fresh `prepareCitation` with no title. The existing tests and the paste guard's stub keep working.
  - New `renderCitation(citation, title?)`, which renders with `buildContext(citation.url, this.settings.linkLabel, title, citation.now)`.
  - New `swapInTitle(info: MarkdownFileInfo, citation, inserted: string, offset: number)`. It returns at once, without fetching, unless `templateNeedsTitle(citation.template, this.settings.linkLabel)`. Otherwise:
    1. Awaits `fetchPageTitle(citation.url)`, and stops if there is no title or if re-rendering with it gives the same text as `inserted`.
    2. Checks that `info.file?.path` still matches the path captured at paste time. If it doesn't, the note was closed or replaced in that pane, so it stops.
    3. Finds every occurrence of `inserted` in `info.editor.getValue()`, and takes the one closest to `offset`.
    4. Replaces it with the titled citation using `editor.replaceRange`.

    If `inserted` no longer appears (the citation was edited or deleted), nothing changes. A paste with no source URL never reaches this.
  - Wire it into every path that adds a citation, recording the offset where the citation starts:
    - The keydown listener's *Paste content + source* branch: the offset is the selection start plus the clipboard text's length.
    - Its *Default handler + source* 50 ms timer: the cursor's offset just before `replaceSelection`.
    - `pasteWithSource` and `pasteDefaultPlusSource`.

    These are reached from the commands (via `workspace.activeEditor`) and from the `editor-menu` items, whose callback already receives the `MarkdownFileInfo` to pass through.
  - `formatSourceLink`, used only by the unused `pasteSourceOnly`, takes its label from `linkLabel`. *Page title* falls back to the URL there, because that path inserts synchronously.

### Settings UI

#### [MODIFY] `main.ts`
- [ ] **TASK-5:** Update `PasteWithSourceSettingTab`.
  - Replace the **Use URL as Link Label** toggle with a **Link Label** dropdown. Options: `url` "URL", `source` "\"Source\"", `title` "Page title".
    - Description: "How {link} is labeled. Page title requests each pasted page from its website to read its title, and uses the URL until the title arrives or if it can't be read."
  - Add a `{title}` variable pill ("Page title, fetched from the page; the URL until it arrives"), placed after `{page}`.
  - The live preview passes `this.plugin.settings.linkLabel` and a sample title of `Obsidian (software) - Wikipedia` for its sample URL whenever `templateNeedsTitle` is true, so no request is made from settings.

### Build and tests

#### [MODIFY] `package.json` · `package-lock.json`
- [ ] **TASK-6:** Add the exact dev dependencies `jsdom@30.1.2` and `@types/jsdom@30.0.0`.
  - Pinned rather than `^`, and older than two weeks, so the test setup doesn't drift to a just-published release.
  - jsdom 30 requires Node `^22.22.2`, `^24.15.0` or `>=26`, which this machine's Node 22.23.2 meets.

#### [NEW] `test-page-title.ts`
- [ ] **TASK-7:** Tests for the fetcher and the swap, run by `npm test` like the other `test-*.ts` files.
  - Before importing `./main`, it installs jsdom's `DOMParser` globally and mocks the `obsidian` module the way `test-paste-guard.ts` does.
  - It builds pages as bytes, so the charset decoding is exercised.
  - It uses a small in-memory editor stub (`getValue`, `posToOffset`, `offsetToPos`, `replaceRange`) for the swap.
  - The cases are listed under Verification Plan.

#### [MODIFY] `test-templates.ts`
- [ ] **TASK-8:** Move the `buildContext(url, true/false)` calls to `buildContext(url, "url")` / `buildContext(url, "source")`.
  - Add cases for `"title"` with and without a title, for `{title}` falling back to the URL, and for `escapeLinkText`.

### Documentation

#### [MODIFY] `README.md` · `CHANGELOG.md`
- [ ] **TASK-9:** Document the change.
  - `README.md`:
    - The Settings table's **Use URL as Link Label** row becomes **Link Label**.
    - The Template Variables table gains `{title}`.
    - The Features bullet on link labels mentions page titles.
    - A new "Network Use" section says when the plugin requests a page, from where, and that nothing else is sent anywhere.
  - `CHANGELOG.md`, under `[Unreleased]`: an `Added` entry for the Page title label and `{title}`, and a `Changed` entry for the toggle becoming a dropdown, with its migration.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file, including the new `test-page-title.ts`. It verifies:
1. **`extractPageTitle`:**
   - `og:title` wins over `twitter:title`, which wins over `<title>`.
   - Whitespace collapses.
   - Entities such as `&amp;` decode.
   - A page with no title, or only blank ones, gives `undefined`.
2. **`decodeHtml`:**
   - Shift_JIS bytes decode correctly, whether the charset is named in the header or only in a `<meta charset>`.
   - Unknown or missing charsets fall back to UTF-8.
3. **`fetchPageTitle`** resolves to `undefined`, without throwing, for:
   - a 404;
   - an `application/json` response;
   - a requester that rejects;
   - a requester that never settles, with a 50 ms timeout;
   - a `file:` URL, for which no request is made at all.
4. **Settings migration:**
   - Stored `useUrlAsLinkLabel: false` → `"source"`; `true` or missing → `"url"`; an invalid `linkLabel` → `"url"`.
   - The legacy key is gone after loading.
5. **`buildContext` and `escapeLinkText`:**
   - `"title"` with title `A [b] c` gives `[A \[b\] c](url)`.
   - `"title"` with no title gives `[url](url)`.
   - `{title}` without a title renders as the URL.
6. **`templateNeedsTitle`:**
   - True for `{TITLE}` in any label mode.
   - True for `{link}` only in title mode.
   - False for `{page}`.
7. **The swap:**
   - The fallback citation is replaced by the titled one in the stub editor.
   - It is left alone when the user edited it first, or when the note's path changed.
   - When two identical citations exist, the one nearest the insertion offset is the one replaced.
   - The fetcher is never called when the template doesn't need a title.

Regression: `test-templates.ts` (with the TASK-8 changes), `test-paste-guard.ts`, `test-bplist.ts` and `test-deploy.ts` still pass.

### Manual Verification
These run in a test vault, with text copied from a web page in Chrome or Edge.

1. **Migration:**
   - Before installing this build, turn **Use URL as Link Label** off.
   - Install the build and reload.
   - **Link Label** shows *"Source"*.
2. **Page title with the default preset:**
   - Set **Link Label** to *Page title*, with the OneNote Style preset.
   - Paste text copied from a Wikipedia article, in each Paste Mode.
   - The citation appears with the URL label, then changes to the article's title, such as `From <[Obsidian (software) - Wikipedia](https://…)>`.
3. **`{title}` in a template:**
   - Set **Link Label** to *URL* and the Citation Template to `\n\nSource: [{title}]({url})`.
   - Paste. The link text becomes the page title.
4. **No network:**
   - Disconnect from the network and paste as in step 2.
   - The paste and its citation appear at once and keep the URL label. Nothing errors.
5. **Edited before the title arrives:**
   - Take the network down, paste, then reconnect.
   - Within a few seconds, edit the citation's text.
   - When the title arrives, or the request times out, the edited citation is left alone.
6. **Another note:**
   - Paste, then switch the pane to another note at once.
   - Neither note gets a stray edit.
7. **Live preview:**
   - With *Page title* selected, the settings preview shows `Obsidian (software) - Wikipedia` as the label, without a network request.
8. **Other paths:**
   - Use the **Paste with Source URL** command and the **Paste (Default Handler) + Source URL** context menu item.
   - Both get the title.

## Visual design application
No design system or art bible exists for this product. The change replaces one settings control with a dropdown and adds a variable pill, both using the existing settings components and styling.
