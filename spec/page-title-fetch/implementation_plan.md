---
status: approved
---

# Label citations with the page's fetched title

Replace the **Use URL as Link Label** toggle with a **Link Label** dropdown. It has four options:
- *URL*
- *"Source"*
- *Page name*, the name guessed from the URL, as `{page}` gives today
- *Page title*, fetched from the page

The seven built-in presets that write `[{page}]({url})` switch to `{link}`, so one setting decides how every preset labels its link. A `{title}` template variable is added as well.

When the active template needs the page title, the paste goes in at once with the URL as a placeholder, the page is requested from its site, and the placeholder is swapped for the title when it arrives. The title fetcher is written from scratch for this plugin.

## User Review Required

> [!IMPORTANT]
> **Page title is the default, so out of the box the plugin makes a network request for every paste.** The request goes from Obsidian to the copied page's site, which can log it.
> - Nothing is requested unless the active template contains `{title}`, or contains `{link}` with Link Label set to *Page title*.
> - *Page name*, *URL* and *"Source"* never make a request.
> - The README and the setting's description both say so. This is the plugin's first network use, and Obsidian's plugin guidelines require disclosing it.

> [!IMPORTANT]
> **The citation can change a moment after the paste.** It goes in with the URL in place of the title, both as `{link}`'s label and as `{title}`. It then becomes the title once the page responds, which is usually under a second and never later than the 10-second timeout.
> - The swap is a separate edit, so undo first takes the citation back to the URL.
> - If the citation was edited or deleted, or its pane switched to another note before the title arrived, it is left as it is.

> [!NOTE]
> **There's no migration, since the plugin has no existing users.** The old `useUrlAsLinkLabel` setting is ignored and dropped from `data.json` on the next save. Any install without a valid `linkLabel`, including a test vault set up before this change, starts on *Page title*.

> [!NOTE]
> **Some sites hand an automated request a sign-in or bot-check page**, so the title can come back as something like "Just a moment…". This plan can't get past that. A page with no title, or a failed or timed-out request, leaves the URL in place.

> [!NOTE]
> **`jsdom` becomes a dev dependency**, pinned to `30.1.2` along with `@types/jsdom` `30.0.0`. It's used only so the tests can run the title parser. Nothing new ships to users.

## Open Questions

None at this time.

## Proposed Changes

### Settings

#### [MODIFY] `main.ts`
- [x] **TASK-1:** Replace the `useUrlAsLinkLabel: boolean` setting with `linkLabel: LinkLabel`, where `type LinkLabel = "url" | "source" | "page" | "title"`.
  - `DEFAULT_SETTINGS.linkLabel` is `"title"`.
  - In `loadSettings`, a missing or invalid `linkLabel` resets to the default, as `guardedPasteFallback` already does. A stored `useUrlAsLinkLabel` is deleted from `this.settings`, so `saveSettings` stops writing it.
  - Update the TSDoc on `PasteWithSourceSettings` for the new field.

### Template engine

#### [MODIFY] `main.ts`
- [x] **TASK-2:** Make `TemplateEngine` aware of page titles.
  - `buildContext(url, linkLabel: LinkLabel = "url", title?: string, now: Date = new Date())`.
    - Passing `now` lets the swap re-render the citation with the same date and time it was first inserted with.
  - `TemplateContext` gains `title`: the escaped fetched title, or the URL when there is none. The URL is shown as it is, unescaped, the same text `{url}` gives.
  - `link`:
    - `"url"`: `[url](url)`
    - `"source"`: `[Source](url)`
    - `"page"`: `[<escaped page>](url)`. For the presets in TASK-3, this is the same text `[{page}]({url})` gave, apart from escaping brackets in the rare page name that has them.
    - `"title"`: `[<escaped title>](url)` when a title is given, otherwise `[url](url)`
  - New `escapeLinkText(text)`:
    - It collapses runs of whitespace to one space, trims, and backslash-escapes `\`, `[` and `]`, so a title can't end the link text early.
    - In prose, Obsidian renders `\[` as `[`, so the escaped `{title}` reads correctly outside links too.
  - New `templateNeedsTitle(template, linkLabel)`: true when the template contains `{title}`, or when it contains `{link}` and `linkLabel` is `"title"`. Matching is case-insensitive, like `render`.
- [x] **TASK-3:** Change the seven `{page}` presets in `BUILTIN_PRESETS` to use `{link}`, leaving the rest of each template as it is:

  | Preset | New `template` |
  | :--- | :--- |
  | Italic Attribution | `\n\n— *Source: {link}*` |
  | Parenthetical | `\n\n(Source: {link})` |
  | Academic Citation | `\n\nSource: {link} via {domain} (Accessed: {date} at {time12h})` |
  | Obsidian Callout | `\n\n> [!info] Source: {link}\n> Accessed on {datetime12h}` |
  | Timestamped (ISO 8601) | `\n\n— *Source: {link}* [{datetime}]` |
  | Zulu / UTC Research Log | `\n\nSource: {link} (Retrieved: {datetimez})` |
  | 12-Hour Casual | `\n\nSource: {link} ({date} at {time12h})` |

  - Each preset's `description` that says "page link" becomes "link".
  - OneNote Style, Minimal Domain, Markdown Quote and Raw URL are unchanged.

### Title fetching

#### [MODIFY] `main.ts`
- [x] **TASK-4:** Add a title fetcher, written from scratch, as exported functions near the clipboard providers.
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
- [x] **TASK-5:** Insert the citation with the URL as a placeholder, then swap in the fetched title.
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
- [x] **TASK-6:** Update `PasteWithSourceSettingTab`.
  - Replace the **Use URL as Link Label** toggle with a **Link Label** dropdown. Options:
    - `title` "Page title (fetched from the page)"
    - `page` "Page name (from the URL)"
    - `url` "URL"
    - `source` "\"Source\""
  - Its description: "How {link} is labeled in every template. Page title requests each pasted page from its website to read its title, showing the URL until the title arrives or if it can't be read. The other options make no network requests."
  - Add a `{title}` variable pill ("Page title, fetched from the page; the URL until it arrives"), placed after `{page}`.
  - The live preview passes `this.plugin.settings.linkLabel` and a sample title of `Obsidian (software) - Wikipedia` for its sample URL whenever `templateNeedsTitle` is true, so no request is made from settings.

### Build and tests

#### [MODIFY] `package.json` · `package-lock.json`
- [ ] **TASK-7:** Add the exact dev dependencies `jsdom@30.1.2` and `@types/jsdom@30.0.0`.
  - Pinned rather than `^`, and older than two weeks, so the test setup doesn't drift to a just-published release.
  - jsdom 30 requires Node `^22.22.2`, `^24.15.0` or `>=26`, which this machine's Node 22.23.2 meets.

#### [NEW] `test-page-title.ts`
- [ ] **TASK-8:** Tests for the fetcher and the swap, run by `npm test` like the other `test-*.ts` files.
  - Before importing `./main`, it installs jsdom's `DOMParser` globally and mocks the `obsidian` module the way `test-paste-guard.ts` does.
  - It builds pages as bytes, so the charset decoding is exercised.
  - It uses a small in-memory editor stub (`getValue`, `posToOffset`, `offsetToPos`, `replaceRange`) for the swap.
  - The cases are listed under Verification Plan.

#### [MODIFY] `test-templates.ts`
- [ ] **TASK-9:** Update the template tests.
  - Move the `buildContext(url, true/false)` calls to `buildContext(url, "url")` / `buildContext(url, "source")`.
  - Add cases for:
    - `"page"`;
    - `"title"` with and without a title;
    - `{title}` falling back to the URL;
    - `escapeLinkText`;
    - the seven presets rendering through `{link}`.

### Documentation

#### [MODIFY] `README.md` · `CHANGELOG.md`
- [ ] **TASK-10:** Document the change.
  - `README.md`:
    - The Settings table's **Use URL as Link Label** row becomes **Link Label**.
    - The Template Variables table gains `{title}`, and its `{link}` row lists the four labels.
    - The Features bullet on link labels mentions page names and titles.
    - The Built-In Preset Examples show `{link}` in the seven changed templates. They also fix two examples that are already out of date: Academic Citation's access time, and Obsidian Callout's `{datetime12h}`.
    - A new "Network Use" section says when the plugin requests a page, from where, and that nothing else is sent anywhere.
  - `CHANGELOG.md`, under `[Unreleased]`:
    - `Added`: the Page name and Page title labels, and `{title}`.
    - `Changed`: the toggle becoming a dropdown that defaults to *Page title*, and the seven presets now using `{link}`.

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
4. **Settings loading:**
   - No stored data → `"title"`.
   - A stored valid `linkLabel` is kept.
   - An invalid or missing `linkLabel` → `"title"`.
   - A stored `useUrlAsLinkLabel` is gone after loading.
5. **`buildContext` and `escapeLinkText`:**
   - `"page"` gives `[Obsidian (software)](url)` for the Wikipedia sample.
   - `"title"` with title `A [b] c` gives `[A \[b\] c](url)`.
   - `"title"` with no title gives `[url](url)`.
   - `{title}` without a title renders as the URL.
6. **Presets:**
   - In *Page name* mode, each of the seven changed presets renders the same text its old `[{page}]({url})` template did.
   - In *Page title* mode they show the title.
7. **`templateNeedsTitle`:**
   - True for `{TITLE}` in any label mode.
   - True for `{link}` only in title mode.
   - False for `{page}`.
8. **The swap:**
   - The placeholder citation is replaced by the titled one in the stub editor.
   - It is left alone when the user edited it first, or when the note's path changed.
   - When two identical citations exist, the one nearest the insertion offset is the one replaced.
   - The fetcher is never called when the template doesn't need a title.

Regression: `test-templates.ts` (with the TASK-9 changes), `test-paste-guard.ts`, `test-bplist.ts` and `test-deploy.ts` still pass.

### Manual Verification
These run in a test vault, with text copied from a web page in Chrome or Edge.

1. **Default:**
   - Install the build in the test vault and reload.
   - **Link Label** shows *Page title*, even though the vault's `data.json` predates this change.
2. **Page title with the default preset:**
   - Keep **Link Label** on *Page title*, with the OneNote Style preset.
   - Paste text copied from a Wikipedia article, in each Paste Mode.
   - The citation appears with the URL, then changes to the article's title, such as `From <[Obsidian (software) - Wikipedia](https://…)>`.
3. **A changed preset, in each mode:**
   - Put Academic Citation in the active slot and paste once with each **Link Label**:
     - *Page title*: the article's title.
     - *Page name*: `Obsidian (software)`, as before this change.
     - *URL*: the full address.
     - *"Source"*: `Source`.
4. **`{title}` in a template:**
   - Set **Link Label** to *URL* and the Citation Template to `\n\nSource: [{title}]({url})`.
   - Paste. The link text becomes the page title.
5. **No network:**
   - Disconnect from the network and paste as in step 2.
   - The paste and its citation appear at once and keep the URL. Nothing errors.
6. **Edited before the title arrives:**
   - Take the network down, paste, then reconnect.
   - Within a few seconds, edit the citation's text.
   - When the title arrives, or the request times out, the edited citation is left alone.
7. **Another note:**
   - Paste, then switch the pane to another note at once.
   - Neither note gets a stray edit.
8. **Live preview:**
   - With *Page title* selected, the settings preview shows `Obsidian (software) - Wikipedia` as the label, without a network request.
9. **Other paths:**
   - Use the **Paste with Source URL** command and the **Paste (Default Handler) + Source URL** context menu item.
   - Both get the title.

## Visual design application
No design system or art bible exists for this product. The change replaces one settings control with a dropdown and adds a variable pill, both using the existing settings components and styling.
