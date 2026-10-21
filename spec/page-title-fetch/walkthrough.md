# Walkthrough: Page Title Fetch

Citations can now label their link with the page's real title, fetched from the page when you paste. A **Link Label** dropdown replaces the **Use URL as Link Label** toggle. It offers *Page title* (the default), *Page name*, *URL* and *"Source"*. A new `{title}` variable is available to any template. The seven built-in presets that wrote `[{page}]({url})` now use `{link}`, so the one setting decides every preset's link text.

## What Was Implemented

### 1. Settings
- **`main.ts`, `PasteWithSourceSettings`**: `useUrlAsLinkLabel: boolean` is replaced by `linkLabel: LinkLabel` (`"url" | "source" | "page" | "title"`), defaulting to `"title"`. `loadSettings` resets a missing or invalid value to the default and deletes the old key. The plugin has no existing users, so the old toggle isn't carried over.

### 2. Template engine
- **`TemplateEngine.buildContext(url, linkLabel, title?, now?)`**:
  - Labels `{link}` with the URL, `Source`, the escaped page name, or the escaped title. The title label shows the URL until a title is known.
  - Adds `{title}`: the escaped title, or the URL.
  - Takes `now`, so a citation re-rendered with its title keeps the date and time it was inserted with.
- **`TemplateEngine.escapeLinkText`** collapses whitespace and backslash-escapes `\`, `[` and `]`.
- **`TemplateEngine.templateNeedsTitle`** decides whether a paste fetches at all: when the template has `{title}`, or has `{link}` with the title label.
- **`BUILTIN_PRESETS`**: these seven presets use `{link}` where they had `[{page}]({url})`:
  - Italic Attribution
  - Parenthetical
  - Academic Citation
  - Obsidian Callout
  - Timestamped (ISO 8601)
  - Zulu / UTC Research Log
  - 12-Hour Casual

  Three descriptions that said "page link" now say "link".

### 3. Title fetching
These are written from scratch. The obsidian-link-or-card fork's approach was studied, but none of its code was used.
- **`fetchPageTitle`**:
  - Requests the page through Obsidian's `requestUrl` with a 10-second timeout.
  - Resolves to `undefined`, and never throws, for:
    - a URL that isn't `http(s)`;
    - a failed or unanswered request;
    - a status that isn't 2xx;
    - a response that isn't HTML;
    - a page with no title.
  - Parses only the first 1 MB of the page.
- **`decodeHtml`**: uses the charset from the `Content-Type` header, then one named by a `<meta>` tag in the first 4 KB, then UTF-8.
- **`extractPageTitle`**: takes `og:title`, then `twitter:title`, then `<title>`, from an inert `DOMParser` document.

### 4. Paste flows
- **`PasteWithSourcePlugin.insertWithCitation`** inserts the citation with the URL where the title belongs.
- **`swapInTitle`** replaces that citation with the titled one when the page answers:
  - It finds the citation again with `findNearestOccurrence`, nearest where it was inserted.
  - It does nothing if the citation was edited or deleted, or the pane now shows another note.
- **`PendingCitation`** records the template, link label and moment at paste time, so switching slots or settings mid-fetch doesn't change the result.
- **Where it's used:** the keydown listener in both paste modes, both commands and both right-click items.
- **`titleFetcher`** is the seam tests replace.

### 5. Settings UI
- **`PasteWithSourceSettingTab`**:
  - The toggle becomes the **Link Label** dropdown, with a description saying which option makes network requests.
  - A `{title}` variable pill is added.
  - The live preview shows a fixed sample title instead of fetching one.

### 6. Build, tests and docs
- **`package.json`**: `jsdom@30.1.2` and `@types/jsdom@30.0.0` are added as exact dev dependencies, for the title tests.
- **`test-page-title.ts`** (new), 38 checks:
  - title extraction;
  - Shift_JIS decoding;
  - fetch failures, including a request that never answers;
  - settings loading;
  - the swap, in an in-memory editor.
- **`test-templates.ts`**:
  - moved to the new `buildContext` signature;
  - preset checks render with the page-name label;
  - new checks for the labels, `{title}`, escaping, `templateNeedsTitle`, and the seven presets.
- **`test-paste-guard.ts`**: stubs `renderCitation`, now the rendering entry point, and answers title lookups at once.
- **`README.md`**:
  - the Link Label setting, `{title}` and the four `{link}` labels;
  - preset examples updated to `{link}`, also fixing the out-of-date Academic Citation and Obsidian Callout examples;
  - a new **Network Use** section;
  - the project tree.
- **`CHANGELOG.md`**: `Added` and `Changed` entries under `[Unreleased]`.

## Verification & Test Results

### Automated Tests
Ran `npm test`, which builds with `tsc` and then runs every test file:
- **`test-page-title.js`: 38 checks, Passed.**
  - The first run had one failure, and it was a mistake in the test. The page name for `/a` is `A`, because `extractPage` capitalizes it, not `a`. The expected value was corrected.
- **`test-templates.js`: 116 checks, Passed**, up from 79.
  - TASK-3 made the old Italic Attribution, Obsidian Callout, Timestamped, Zulu and 12-Hour Casual checks fail. That was expected: they rendered the presets with the URL label but expected page names. They now render with the page-name label.
  - The new Test 7b compares each changed preset against its old template, across three URLs, and finds them identical.

**Do the tests catch real bugs?** Three behaviors were removed from the compiled `main.js`, one at a time:
- **The note check:** caught, by "a pane that switched notes is left alone".
- **Nearest-occurrence matching:** caught, by "of two identical citations, the one just pasted is updated".
- **The HTML content-type check:** *not caught at first.* The JSON response in that test had an empty body, so it gave no title either way. The test now uses a JSON body containing `<title>` markup, and it catches the removal.

### Regression Testing
- `test-paste-guard.js`: 85 checks, **Passed**.
- `test-bplist.js`: 8 checks, **Passed**.
- `test-deploy.js`: 7 checks, **Passed**.
- `npm audit` reports the same three findings with and without jsdom. They're in `diff` (from ts-node) and `moment` (from the obsidian typings), both dev-only.

## Manual Verification
These were run by the user in a test vault on Windows, with text copied from a Wikipedia article. All passed.

| Step | Check | Result |
| --- | --- | --- |
| 1 | **Link Label** starts on *Page title* | Passed |
| 2 | OneNote Style, both Paste Modes: the URL label becomes the article's title | Passed |
| 3 | Academic Citation with each Link Label: title, page name, URL, `Source` | Passed |
| 4 | Link Label *URL* with `\n\nSource: [{title}]({url})`: the link text becomes the title | Passed |
| 5 | Offline: the citation appears at once, keeps the URL, no errors | Passed |
| 6 | Citation edited before the title arrives: the edit is kept | Passed |
| 7 | Pane switched to another note right after pasting: no stray edit | Passed |
| 8 | Live preview shows the sample title, with no request | Passed |
| 9 | **Paste with Source URL** command and **Paste (Default Handler) + Source URL** menu item get the title | Passed |

## Follow-ups
- **No title cache.** Pasting the same URL twice fetches it twice.
- **Bot checks.** Sites that answer automated requests with a sign-in or bot-check page give that page's title. The README's Network Use section says so.
- **Dead code.** `pasteSourceOnly` (and the `formatSourceLink` it uses) still has no caller. It was updated for the new setting, not removed.
