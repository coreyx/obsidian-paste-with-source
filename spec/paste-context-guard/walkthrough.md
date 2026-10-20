# Walkthrough: Paste Context Guard

An intercepted Ctrl/Cmd+V or Shift+Insert no longer adds a citation where it would break the surrounding markup. That covers code, math, comments, frontmatter, wikilinks, link syntax, and HTML being typed. A new setting chooses what such a paste does in "Paste content + source" mode, defaulting to Obsidian's native paste. The keydown listener now calls `preventDefault()` before its first `await`, which fixes a double paste in that mode that was confirmed on the old build.

**Related documents**
- [Implementation plan](implementation_plan.md)

## What Was Implemented

### 1. Paste position guard (TASK-1, TASK-2)
- **`main.ts`**: new exported `canAddCitation(doc: LineSource, line, ch)`, placed next to `TemplateEngine`. The build is plain `tsc` and Obsidian loads only `main.js`, so a separate module would never be loaded.
  - The position checks cover frontmatter, `stripContainer` for blockquotes and lists, exact-length backtick run matching, `isInsideLinkSyntax`, and the HTML tag/attribute check.
  - A single forward scan from the end of the frontmatter to the cursor tracks code fences, `%%` comments and `$$` blocks. Each one hides the others' markers, and inline code hides all three. Backslash-escaped markers don't count.
  - Fences close only on the same character, at least the same length, and no info string, as in CommonMark.
  - Inline `$…$` follows Obsidian's rule: the opener is followed by a non-space, and the closer is preceded by a non-space and not followed by a digit. It counts only when a closer follows the cursor, so a price like `I paid $5 for ` still gets a citation.
  - An unclosed `$$`, `%%` or backtick run on the cursor line errs toward no citation.

### 2. Paste handling (TASK-3, TASK-4)
- **`main.ts` settings**:
  - New `type GuardedPasteFallback = "native" | "plain"` and `guardedPasteFallback` setting, defaulting to `"native"`.
  - `loadSettings` resets any other stored value to `"native"`.
  - Existing installs pick up the default through the existing `Object.assign` merge.
- **`main.ts` keydown listener**:
  - Reads the primary selection's start and runs `canAddCitation` synchronously, before any `await`.
  - In "Default handler + source" mode, a guarded paste returns before reading the clipboard source, so Obsidian's paste runs and nothing is appended.
  - In "Paste content + source" mode, a guarded paste with the native fallback returns without `preventDefault()`. Otherwise `preventDefault()` runs immediately, and the plugin inserts either the plain text (guarded) or the text plus citation.
  - Fixes the double paste: the old code called `preventDefault()` after `await this.getClipboardSourceUrl()`, when the browser had already performed the native paste.

### 3. Settings UI (TASK-5)
- **`PasteWithSourceSettingTab.display()`**:
  - New dropdown "When a citation can't be added", directly after Paste Mode, with "Obsidian's native paste (Default)" and "Plain clipboard text". Its description lists the guarded positions and explains both choices.
  - Shown only in "Paste content + source" mode. The Paste Mode dropdown now calls `this.display()` after saving, so the row appears and disappears as the mode changes.

### 4. Documentation (TASK-6)
- **`README.md`**:
  - New "🛡️ Markup-Safe Pasting" feature bullet.
  - New Settings table row for the fallback setting.
  - New "🛡️ When No Citation Is Added" section. It lists the contexts, how markers inside one construct are ignored by another, the behavior in each mode, and that the commands and context menu are never guarded.
  - `test-paste-guard.ts` and this spec folder added to the project tree.
- **`CHANGELOG.md`**: `Added` entries for Markup-Safe Pasting and the new setting, written during TASK-6. The `Fixed` entry for the double paste was added at wrap-up, once Manual Verification step 1 confirmed it.

### 5. Tests
- **`test-paste-guard.ts`** (new): 82 checks.
  - Uses the same `obsidian` mock as `test-templates.ts`, with a `pasteAt("…|…")` helper where the first `|` marks the cursor and the text can span lines.
  - Groups cover link syntax, inline code, HTML, fences and frontmatter, math, comments, constructs hiding each other's markers, closed math and comments, currency, and prose.
  - Also covers the four `loadSettings` cases for the fallback.
  - Five keydown listener cases run against stubbed Obsidian APIs, and each one checks whether `preventDefault()` ran before the listener first yielded.

## Verification & Test Results

### Automated Tests
Ran `npm run build` (the `tsc` typecheck plus staging to `dist/`), then `node test-paste-guard.js`:
- Build: **Passed**.
- `test-paste-guard`, 82 checks: **Passed**, 0 failed.
  - Link syntax, inline code (including mixed-length backtick runs), HTML, fences (in blockquotes and lists, `~~~`, longer closers, info-string lines), frontmatter, `$$` and inline math, and `%%` comments are refused.
  - Markers hidden inside another construct, closed math and comments, currency (`I paid $5 for `, `$5 and $10 `), checkboxes, finished links and plain prose are allowed.
  - The fallback setting loads correctly for a fresh install, an install from before the setting, a stored `plain`, and an invalid stored value.
  - Listener: `preventDefault()` runs before the first yield in both content-mode cases that need it and never in the others, and each case inserts exactly what it should.

Problems hit during implementation, and what was done:
- **`node_modules/.bin` was missing**, so `npm run build` and `npx ts-node` failed with "'tsc' is not recognized". `npm rebuild` restored the links; no tracked files changed.
- **The tests import the compiled `main.js`, not `main.ts`.** An early run picked up a stale `main.js` from 2026-09-11 and failed with `canAddCitation is not a function`. Run `npm run build` (or `tsc`) before any `test-*.js`. The plan's `npx ts-node test-paste-guard.ts` hits the same problem, because the test's `import "./main"` resolves to `main.js` first.
- **Two test expectations were wrong**, not the code:
  - `$a$ and $b |$` isn't math, because the closer is preceded by a space. Changed to `$a$ and $b |c$`.
  - `` `$x|$` `` is correctly refused, because the cursor is inside inline code. Changed to `` `$x$` and | ``.

### Regression Testing
- `test-templates`, 79 checks: **Passed**.
- `test-bplist`, 8 checks: **Passed**.

## Manual Verification
Done by the user in a test vault on Windows, with text copied from a web page.

1. **Old build** (main at `3221fe5`), "Paste content + source" mode, paste on a blank line: **the text appeared twice.** This confirms the `preventDefault()`-after-`await` bug and is why the CHANGELOG has a `Fixed` entry.
   - The first attempt to load the old build failed with `SyntaxError: Cannot use import statement outside a module`. The vault's `main.js` was a byte-for-byte copy of `main.ts`, because only the TypeScript source is on GitHub (`*.js` is gitignored). Building `main` with `npm run build` and copying `dist/main.js` into the vault fixed it.
2. Branch build, "Default handler + source", paste in prose: citation added after the text. **Passed.**
3. Same mode, paste inside a ```` ``` ```` block, `` `code` ``, `[[…]]`, a link's `( )`, a `$$` block and `%% %%`: normal paste, no citation. **Passed.**
4. "When a citation can't be added" appears under Paste Mode in "Paste content + source", set to "Obsidian's native paste", and disappears on switching back. **Passed.**
5. "Paste content + source", paste in prose: text plus citation, inserted once. **Passed.**
6. Native fallback, paste inside a code block: Obsidian's normal paste, no citation. **Passed.**
7. Plain fallback, paste inside a code block: plain text inserted once, no citation. **Passed.**
8. Right-click → "Paste Clipboard with Source URL" inside a code block: citation added. **Passed.**
9. `I paid $5 for ` then paste: citation added. **Passed.**

To repeat this on another machine: run `npm run build`, copy `dist/main.js` and `dist/manifest.json` into `<vault>/.obsidian/plugins/paste-with-source/`, and reload the plugin.

## Follow-ups
- **Paste outside the editor:**
  - The keydown listener takes `workspace.activeEditor?.editor`, which follows the active view, not keyboard focus.
  - With focus in another field (the search box, or the plugin's own Citation Template textarea), Ctrl+V in "Default handler + source" mode pastes into that field and then appends a citation to the note.
  - In "Paste content + source" mode, the field gets nothing and the note gets the paste.
  - Proposed fix: return early unless `editor.hasFocus()`. It needs its own spec, for example `spec/paste-outside-editor`, branched from this one.
- **`deploy.ts` targets `~/Documents/Obsidian Vault`**, which doesn't exist on this machine, so `npm run deploy` can't install the plugin in any real vault. A configurable vault path (an env var or an argument) would fix it.
- **No installable build on GitHub.** `main.js` is gitignored and there are no release assets, so anyone installing from the repo gets `main.ts` and the `import` error above. Attaching `main.js` and `manifest.json` to a GitHub release, for example through `prepare-release`, would close that gap.
- **The plan's test command** (`npx ts-node test-paste-guard.ts`) only works after a build, as noted above. The same is true of the existing test files.
- **The guard can't be turned off.** The explicit commands and context menu are the way to force a citation into a guarded position. A toggle could be added if anyone needs it.
