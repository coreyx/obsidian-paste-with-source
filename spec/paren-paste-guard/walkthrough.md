# Walkthrough: Paren Paste Guard

An intercepted paste after an unclosed `(` on the cursor's line now gets no citation, because the citation would land inside the parenthetical. This works like the existing rule for an unclosed `[`. Pairs closed before the cursor don't count, and neither do escaped `\(` or parentheses inside code, math or comments.

## What Was Implemented

### 1. Paste guard (`main.ts`)
- **`isInsideParentheses(prose)`** (new, next to `isInsideLinkSyntax`):
  - It reads the cursor line's prose up to the cursor. `scanSpans` has already removed code spans, `%%` comments and `$$` math from that prose.
  - In one left-to-right scan:
    - A backslash skips the next character.
    - A `$` that opens closed inline math, per `findInlineMathClose`, jumps to its closing `$`.
    - `(` counts up, and `)` counts down but never below zero.
  - Never going below zero means a `)` with no opener, as in `1)` or `:)`, can't hide a later unclosed `(`.
- **`canAddCitation`**:
  - It refuses when `isInsideParentheses(scan.prose)` is true, alongside the link syntax check.
  - Its TSDoc lists the new refused position.
  - Link destinations are unaffected: `[a](url` was already refused, and `[a](url)` is balanced.

### 2. Tests (`test-paste-guard.ts`)
- **"An unclosed parenthesis refuses a citation"**, 7 cases:
  - `see (this |`
  - `((a) |`
  - `(a) and (b |`
  - `:) and (see |`
  - `(see [link](https://example.com) |`
  - `- (item |`
  - `> (quoted |`
- **"Closed, escaped or hidden parentheses accept a citation"**, 9 cases:
  - `(a) and |`
  - `(a)) |`
  - `\( |`
  - `` `(` and | ``
  - `$f(x$ and |`
  - `%% ( %% and |`
  - `$$ ( $$ and |`
  - `(\n|`
  - `1) item |`

### 3. Docs
- **`README.md`**:
  - **When No Citation Is Added** has a new **Parentheses** item.
  - The **Markup-Safe Pasting** feature line mentions an open parenthesis.
- **`CHANGELOG.md`**: an `Added` entry under `[Unreleased]`.

## Verification & Test Results

### Automated Tests
I ran `npm test`, which builds the project and runs every test file. **`test-paste-guard.js`: Passed**, including all 16 new cases.

**Do the tests catch real bugs?** I broke three parts of the code, one at a time, and each break was caught:

| Break | What caught it |
| --- | --- |
| Remove the rule from `canAddCitation` | All 7 refused cases failed |
| Remove the inline-math skip | `$f(x$ and |` failed |
| Remove the escape skip | `\( |` failed |

One problem came up while doing this. The first run of the mutation script crashed: Windows' console encoding couldn't print the test output's `→`. That left the first mutation in `main.ts`. I restored the file from a backup, confirmed it matched, and reran the checks with ASCII output and a guaranteed restore. Nothing mutated was committed.

### Regression Testing
These all passed unchanged in the same runs:
- the existing guard cases, including the link with balanced parentheses in its URL, `[W](https://en.wikipedia.org/wiki/Foo_(bar)) |`
- `test-templates.js`
- `test-page-title.js`
- `test-windows-clipboard.js`
- `test-bplist.js`
- `test-deploy.js`

## Manual Verification
The user ran these in the test vault. Each one copied text from a web page in Chrome or Edge, then pasted with Ctrl+V.

Obsidian auto-pairs brackets as you type, outside code: typing `(` gives `()`, with the cursor between them. The rule reads only the text before the cursor, so the auto-inserted `)` doesn't affect it.

| Step | Check | Result |
| --- | --- | --- |
| 1 | `See (this ` and paste. With auto-pairing, the cursor is inside `(this |)`, and there's no citation | Passed |
| 2 | `See (this) and ` and paste. The citation is added | Passed |
| 3 | `(`, Enter, then paste on the new line. The `)` moves down with the cursor, nothing before the cursor on the new line is open, and the citation is added | Passed |
| 4 | `` `f(` ``, End, a space, then paste after the closing backtick. The citation is added | Passed |

**Step 4 had to be corrected.** As first written, the step assumed the cursor would end up after the closing backtick. In practice it stayed inside the code span, and possibly inside the parentheses too, so the paste correctly got no citation. Inside backticks, Obsidian doesn't auto-pair `(`, so the corrected step presses **End** to move past the closing backtick before pasting.

While testing, the user saw selected text turned into a link on paste. That comes from another plugin in the test vault, which keeps the selection as the link title. This plugin doesn't touch the selection, and this change doesn't affect that behavior.

## Follow-ups
- **Only the same line counts.** A `(` left open on an earlier line doesn't count, so with auto-pairing, `(`, Enter, paste is cited. That's the scope the plan chose.
