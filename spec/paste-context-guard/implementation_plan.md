---
status: approved
---

# Skip the citation when a paste lands inside code, math, comments, frontmatter or link syntax

An intercepted Ctrl/Cmd+V or Shift+Insert currently appends a citation wherever the cursor is, so a paste inside a code block, a formula, a wikilink or a link's URL gets a citation that breaks that markup. This change checks the cursor position before the plugin acts, and in those positions pastes without a citation. The check covers frontmatter, code fences, inline code with exact-length backtick matching, link syntax and HTML being typed, plus Obsidian's math and comment syntax. A new setting chooses what a guarded paste does in "Paste content + source" mode. It defaults to Obsidian's own paste, which is what Ctrl+V does with the plugin off.

## User Review Required

> [!IMPORTANT]
> **Only the intercepted keyboard paste is guarded.** The commands "Paste with Source URL" and "Paste (Default) + Source URL" and the two right-click menu items still append a citation wherever the cursor is. That way you can still force a citation into a guarded position. There is no setting to turn the guard off.

> [!IMPORTANT]
> **Existing paste fix: `preventDefault()` runs too late in "Paste content + source" mode.** The keydown handler calls `event.preventDefault()` after `await this.getClipboardSourceUrl()` (`main.ts:830-833`). At that point the event has already been dispatched, so the call likely doesn't stop Obsidian's native paste, and the clipboard would be pasted twice. TASK-4 moves `preventDefault()` before the first `await`. I'll reproduce the double paste on the current build first (Manual Verification step 1). The CHANGELOG only gets a `Fixed` entry if it reproduces.

> [!NOTE]
> **Stray openers err toward no citation.** An unclosed `$$` or `%%` makes everything after it count as math or a comment, and an unclosed backtick run counts as inline code still being typed. The cost of a mistake here is one paste that gets no citation. Inline `$…$` is the exception: it only counts when the line also has a valid closing `$` after the cursor, so currency like "paid $5 for " doesn't suppress citations.

> [!NOTE]
> **The position checked is the start of the primary selection,** taken synchronously at keydown, before any `await` and before the native paste moves the cursor. Additional cursors are ignored, as they are today.

## Open Questions

None at this time.

## Proposed Changes

### Paste position guard

The build is plain `tsc` with no bundler, and Obsidian loads only `main.js`. A separate module would compile to its own `.js` file that the plugin can't load, so the guard goes into `main.ts` as exported functions, next to `TemplateEngine`, where the tests can import it.

#### [MODIFY] `main.ts` · [NEW] `test-paste-guard.ts`
- [x] **TASK-1:** Add the position checks to `main.ts` as an exported `canAddCitation(doc: LineSource, line: number, ch: number): boolean`, with `test-paste-guard.ts` covering it.
  - `LineSource` is an exported interface `{ getLine(line): string; lineCount(): number }`. Obsidian's `Editor` satisfies it.
  - Add `stripContainer`, `isInsideFrontmatter`, `isInsideCodeFence` (``` ``` ``` and `~~~`, closer at least as long as the opener, inside blockquotes and lists), the fence-line check, `scanInlineCode` with `backtickRun`/`findBacktickRun`, `isInsideLinkSyntax`, and the HTML check `/(<|=["'])$/`. Document each with TSDoc, following this file's conventions.
  - `canAddCitation` returns `false` in any of these positions:
    - frontmatter
    - inside a code fence, or on a fence line
    - inside an open inline code span
    - after an unclosed `[`: link text, image alt text, `[[wikilink`, or a stray bracket
    - inside a link's `( )` destination, including balanced parentheses in the URL
    - right after `<` or `="`
  - `test-paste-guard.ts` uses the same `obsidian` module mock as `test-templates.ts`, a `pasteAt("…|…")` helper for one-line cases where `|` marks the cursor, and a `docAt([...lines], line, ch)` helper for multi-line cases. It prints pass/fail per case and exits non-zero on any failure.
  - It includes these refused and allowed cases: `- [ ]` and `- [x]` checkboxes, a finished link, `\[`, `[` inside finished inline code, ``` ``a`[`` and | ``` allowed, and ``` ``a`| ``` refused.
- [x] **TASK-2:** Extend `canAddCitation` with Obsidian math and comment syntax, with cases in `test-paste-guard.ts`.
  - One forward scan from the end of the frontmatter to the cursor tracks the cross-line states, so markers inside one construct don't count in another:
    - In a code fence, only the closer counts.
    - In a `%%` comment, only the next `%%` counts.
    - In a `$$` block, only the next `$$` counts.
    - Outside all three, fence openers, inline code spans (which hide any `%%`, `$$` and `$` inside them), `%%`, `$$` and inline `$` are recognized. Backslash-escaped markers don't count.
  - The scan replaces TASK-1's separate fence walk, so the fence rules live in one place.
  - Inline math follows Obsidian's rule:
    - An opening `$` is not part of `$$`, is unescaped, and is followed by a non-space character.
    - The closing `$` is preceded by a non-space character and not followed by a digit.
    - A paste is refused only when the cursor sits between such a pair on its line.
  - New cases:
    - Refused: inside a multi-line `$$` block, between `$$` and `$$` on one line, between `$` and `$` in `$x^2$`, inside a multi-line `%%` comment, between `%%` and `%%` on one line.
    - Allowed: after a closed `$$` block, after a closed comment, `paid $5 for |`, `$5 and $10 |`, `%%` inside inline code, `$$` inside a code fence.

### Paste handling

#### [MODIFY] `main.ts`
- [x] **TASK-3:** Add `guardedPasteFallback: GuardedPasteFallback` to `PasteWithSourceSettings`, where `type GuardedPasteFallback = "native" | "plain"`, and add `guardedPasteFallback: "native"` to `DEFAULT_SETTINGS`.
  - `loadSettings` already fills missing keys through `Object.assign` with the defaults, so existing installs get `"native"` with no migration code. Any other stored value is reset to `"native"`, the same way `activeSlot` is checked.
- [x] **TASK-4:** Rework the keydown listener in `onload` so it checks the position first and calls `preventDefault()` synchronously.
  - After `shouldIntercept` and the `editor` lookup, read `const from = editor.getCursor("from")` and `const citable = canAddCitation(editor, from.line, from.ch)`, all before any `await`.
  - In `default+source` mode, when `!citable`: return before reading the clipboard source. The native paste runs and nothing is added after it.
  - In `clipboard+source` mode:
    - When `!citable` and `guardedPasteFallback === "native"`: return without calling `preventDefault()`, so Obsidian pastes as if the plugin were off.
    - Otherwise: call `event.preventDefault()` immediately, then `await` the clipboard text. A guarded paste inserts the text alone. A citable one also awaits the source URL and inserts text plus citation, as today.
  - TSDoc comment on the listener saying why the position check and `preventDefault()` have to run before the first `await`.
- [x] **TASK-5:** Add the "When a citation can't be added" setting to `PasteWithSourceSettingTab.display()`, directly after "Paste Mode".
  - Dropdown options: `"native"` → "Obsidian's native paste (Default)", `"plain"` → "Plain clipboard text".
  - Description: "Pastes inside code, math, comments, frontmatter, links, and wikilinks get no citation. Choose what such a paste does: Obsidian's native paste, as if this plugin were off, or the clipboard's plain text."
  - Shown only when `pasteMode` is `"clipboard+source"`, because in "Default handler + source" mode Obsidian's own paste always runs. The "Paste Mode" dropdown's `onChange` calls `this.display()` after saving so the setting appears or disappears.

### Documentation

#### [MODIFY] `README.md` · [MODIFY] `CHANGELOG.md`
- [ ] **TASK-6:** Document the guard and the new setting.
  - `README.md`: a new "When no citation is added" section. It lists the guarded positions, says the list applies only to the intercepted keyboard paste and that the commands and context menu still add a citation anywhere, and explains the fallback setting.
  - `README.md`: a row for the new setting in the Settings table, and `test-paste-guard.ts` in the project structure tree.
  - `CHANGELOG.md`: under `[Unreleased]`, an `Added` entry for the guard and an `Added` entry for the setting. A `Fixed` entry for the double paste goes in only if Manual Verification step 1 reproduces it.

## Verification Plan

### Automated Tests
`npx ts-node test-paste-guard.ts`, run after each task. It verifies:
1. These cases are refused: link text, image alt text, `[|]`, `[[Note|`, a stray `[`, right after `](`, mid-URL, a URL with parentheses.
2. Code, frontmatter and HTML cases are refused: inside a fence (including in a blockquote and a list), on a fence line, inside a `~~~` fence, frontmatter, open inline code, mixed-length backtick runs, right after `<` and `="`.
3. Math and comment cases are refused: `$$` blocks (multi-line and one-line), inline `$…$`, `%%` comments (multi-line and inline).
4. Allowed positions return `true`: plain prose, checkboxes, after a finished link, `\[`, brackets inside finished code, after closed math and comments, currency, markers inside code.

Regression: `npx ts-node test-templates.ts` and `npx ts-node test-bplist.ts` still pass, and `npm run build` (the `tsc` typecheck plus staging to `dist/`) succeeds.

### Manual Verification
Use a vault with the plugin, Intercept Paste on, and some text copied from a web page in Chrome or Edge.

1. **Before installing this build**, set Paste Mode to "Paste content + source", then paste on a blank line with Ctrl/Cmd+V. Note whether the text appears twice. Record the result in the walkthrough.
2. Install this build. With Paste Mode set to "Default handler + source", paste in plain prose. The paste is followed by a citation, as before.
3. In the same mode, paste inside a ```` ``` ```` block, inside `` `code` ``, between `[[` and `]]`, inside a link's `( )`, inside a `$$` block, and inside `%% %%`. Each pastes normally with no citation.
4. Switch Paste Mode to "Paste content + source". "When a citation can't be added" appears below it, set to "Obsidian's native paste". Switch back: the setting disappears.
5. In "Paste content + source" mode, paste in prose. The plain text plus citation appears once.
6. With the fallback on "Obsidian's native paste", paste inside a code block. Obsidian's normal paste appears with no citation, the same as with the plugin disabled.
7. Set the fallback to "Plain clipboard text" and paste inside a code block. The clipboard's plain text appears once, with no citation.
8. Inside a code block, right-click → "Paste Clipboard with Source URL". The citation is added, because explicit commands are never guarded.
9. Type `I paid $5 for ` and paste. The citation is added.

## Visual design application
This adds one setting row in Obsidian's standard settings UI. The project has no `design-system.md` or `art-bible.md` to apply.
