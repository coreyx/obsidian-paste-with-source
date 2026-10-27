---
status: approved
---

# Skip the citation after an unclosed parenthesis on the same line

An intercepted paste after an unclosed `(` on the cursor's line gets no citation. A citation there lands inside the parenthetical, as in `(see this` followed by `From: …`, which reads as part of the aside. This works like the existing rule for an unclosed `[`, and parentheses closed before the cursor don't count.

## User Review Required

> [!IMPORTANT]
> **Parentheses in code, math and comments don't count.** These are skipped:
> - inline code and fenced code
> - `$$` blocks and closed inline `$…$` math, as in `$f(x$`
> - `%%` comments
> - escaped `\(`
>
> Only the cursor's own line is read, so a `(` left open on an earlier line doesn't count.

> [!NOTE]
> **Prose with a stray `(` loses its citation.** For example, "Options: (a) red, (b" gets no citation on that line. That's the same trade the `[` rule makes. The **Paste with Source URL** commands still add a citation wherever the cursor is.

> [!NOTE]
> **A `)` with no opener is ignored**, so text like `1)` or `:)` doesn't hide a later unclosed `(`. In `:) and (see`, the `(` is still unclosed.

## Open Questions

None at this time.

## Proposed Changes

### Paste guard

#### [MODIFY] `main.ts`
- [x] **TASK-1:** Add `isInsideParentheses(prose: string): boolean`, next to `isInsideLinkSyntax`.
  - It takes the cursor line's prose up to the cursor, with code spans, `%%` comments and `$$` math already removed by `scanSpans`. It returns whether a `(` is still open.
  - It scans left to right:
    - A backslash skips the next character.
    - A `$` that opens closed inline math, per `findInlineMathClose`, skips to its closing `$`.
    - `(` counts up, and `)` counts down but never below zero.
  - It's documented in TSDoc, like its neighbors.
- [x] **TASK-2:** In `canAddCitation`, refuse when `isInsideParentheses(scan.prose)` is true, alongside the `isInsideLinkSyntax` check. Add parentheses to the function's TSDoc list of refused positions.
  - A link destination is unaffected. `[a](url` is already refused by the link rule, and `[a](url)` is balanced.

### Tests

#### [MODIFY] `test-paste-guard.ts`
- [ ] **TASK-3:** Add a refused group, "An unclosed parenthesis refuses a citation":
  - `see (this |`
  - `((a) |`
  - `(a) and (b |`
  - `:) and (see |`
  - `(see [link](https://example.com) |`
  - `- (item |`
  - `> (quoted |`
- [ ] **TASK-4:** Add an accepted group, "Closed, escaped or hidden parentheses accept a citation":
  - `(a) and |`
  - `(a)) |`
  - `\( |`
  - `` `(` and | ``
  - `$f(x$ and |`
  - `%% ( %% and |`
  - `$$ ( $$ and |`
  - `(\n|`
  - `1) item |`
### Docs

#### [MODIFY] `README.md`
- [ ] **TASK-5:** Under **When No Citation Is Added**, add a **Parentheses** item: after an unclosed `(` on the same line. Closed pairs and escaped `\(` don't count, and neither do parentheses inside code, math or comments.
- [ ] **TASK-6:** Add an `Added` entry under `[Unreleased]` in `CHANGELOG.md`.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file. It verifies:
1. The new refused and accepted cases from TASK-3 and TASK-4.
2. All existing guard cases still pass unchanged. That includes `[W](https://en.wikipedia.org/wiki/Foo_(bar)) |`, whose URL holds balanced parentheses.
3. All other test files pass unchanged.

### Manual Verification
In the test vault, copy text from a web page in Chrome or Edge, then paste with Ctrl+V:
1. **Unclosed:** Type `See (this ` and paste. You get no citation.
2. **Closed:** Type `See (this) and ` and paste. You get a citation.
3. **Earlier line:** Type `(` on one line, press Enter, and paste on the next line. You get a citation.
4. **In code:** Type `` `f(` `` and a space, then paste after the closing backtick. You get a citation.

## Visual design application
No UI changes.
