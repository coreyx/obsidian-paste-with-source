---
status: approved
---

# Intercept only the exact paste shortcuts

The paste listener checks for Ctrl or Cmd plus the V key, and for Shift plus Insert, but ignores any other modifier held with them. So Ctrl+Shift+V and Cmd+Shift+V, which are Obsidian's "paste as plain text", are intercepted too, and so is Ctrl+Shift+Insert. This change intercepts only the shortcuts the plugin documents, with no other modifier held: Ctrl+V and Shift+Insert on Windows, and Cmd+V on macOS. Any other combination is left to Obsidian.

## User Review Required

> [!IMPORTANT]
> **"Paste as plain text" no longer gets a citation.** Today, in *Default handler + source* mode, Ctrl+Shift+V or Cmd+Shift+V runs Obsidian's plain-text paste and then the plugin adds a citation. In *Paste content + source* mode, the plugin takes the paste over. On macOS, Obsidian's own paste may also run in that mode, which would paste twice. That's unconfirmed, since no Mac is available to test. After this change, the plugin leaves those shortcuts entirely to Obsidian, so you get a plain-text paste with no citation. **Paste with Source URL**, or Ctrl+Alt+V on Windows, still gives a citation when you want one.

> [!NOTE]
> **The modifiers are checked exactly.**
> - Ctrl+V means Ctrl with no Shift, Alt or Meta.
> - Cmd+V means Cmd with no Shift, Option or Ctrl.
> - Shift+Insert means Shift with no Ctrl, Alt or Meta.
>
> This covers the Ctrl+Alt+V exclusion added in 1.7.0, which stays.

## Open Questions

None at this time.

## Proposed Changes

### Paste listener

#### [MODIFY] `main.ts`
- [ ] **TASK-1:** Add `pasteShortcut(event: KeyboardEvent, isMac: boolean): "v" | "shift+insert" | null`, documented in TSDoc, next to `isNativePaste`.
  - It returns `"v"` for exactly Cmd+V on macOS, or exactly Ctrl+V elsewhere.
  - It returns `"shift+insert"` for exactly Shift+Insert, outside macOS.
  - It returns `null` for anything else.
  - The keydown listener uses it in place of `isCmdV`, `isCtrlV` and `isShiftInsert`, matched against **Intercept Shortcut** as today.
  - The comment about Ctrl+Alt+V belonging to the Chromium command moves into the TSDoc.

### Tests

#### [MODIFY] `test-paste-guard.ts`
- [ ] **TASK-2:** `pressPaste` takes the modifiers and key as an object, in place of its `alt` flag. New shortcut cases, run on the current platform:
  - **Ignored, with nothing inserted and no `preventDefault()`, in both Paste Modes:**
    - Ctrl+Shift+V, or Cmd+Shift+V on macOS
    - Ctrl+Shift+Insert, outside macOS
    - Ctrl+Alt+Shift+V, outside macOS
  - **Still intercepted:**
    - plain Ctrl+V, or Cmd+V on macOS
    - Shift+Insert, outside macOS
  - The existing cases keep their expectations.

### Docs

#### [MODIFY] `README.md`, `CHANGELOG.md`
- [ ] **TASK-3:** Docs:
  - In the README's **Keyboard Shortcuts**, the Standard Paste entry says that other combinations, such as Ctrl+Shift+V for Obsidian's "paste as plain text", are left to Obsidian.
  - The CHANGELOG gets a `Fixed` entry under `[Unreleased]`.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file. It verifies:
1. The new shortcut cases from TASK-2.
2. Every existing shortcut and guard case passes unchanged.
3. All other test files pass unchanged.

### Manual Verification
On Windows, in the test vault, copy text from a web page in Chrome or Edge. Check each step in *Default handler + source* mode, then again in *Paste content + source* mode:
1. **Ctrl+Shift+V:** the clipboard is pasted as plain text, once, with no citation.
2. **Ctrl+V:** the paste is cited as before.
3. **Shift+Insert:** the paste is cited as before.

## Visual design application
No UI changes.
