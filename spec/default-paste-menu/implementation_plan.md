---
status: approved
---

# Make "Paste (Default Handler) + Source URL" paste the clipboard

The right-click item **Paste (Default Handler) + Source URL**, and its command **Paste (Default) + Source URL**, add the citation but never paste the clipboard. That's been true since the first version. `pasteDefaultPlusSource` only waits 50 ms and inserts the citation. It assumes Obsidian's own paste is already running, which is true for a key press but not for a menu item or a command. This change makes both run Obsidian's own paste first, then add the citation after the pasted content.

## User Review Required

> [!IMPORTANT]
> **Both entry points now paste the clipboard.** They request Obsidian's own paste from Electron, the same way the **Paste, citing Chromium plain-text copies** command (Ctrl+Alt+V) already does. Obsidian's context-menu **Paste** uses the same call. So links and formatting come through as they do with Ctrl+V. The citation waits for that paste, and is left out if the paste never happens within a second.

> [!NOTE]
> - **With no source URL on the clipboard,** the clipboard is still pasted, just without a citation. Today nothing happens at all.
> - **The paste guard still doesn't apply here,** as the README says. A menu item or command adds a citation wherever the cursor is, so you can still force one into a guarded position.
> - **Where Electron's `remote` isn't available,** the clipboard's plain text is pasted with the citation. That's the same fallback Obsidian's own context-menu Paste and the Ctrl+Alt+V command use.
> - **The keyboard paste and Paste Mode are unchanged.**

## Open Questions

None at this time.

## Proposed Changes

### Paste

#### [MODIFY] `main.ts`
- [x] **TASK-1:** Move the native-paste request out of `pasteWithChromiumSource` into a documented helper, `requestNativePaste(): Promise<boolean> | undefined`. It starts listening with `nextPasteEvent(activeDocument, 1000)`, then calls `webContents.paste()`, and returns undefined when `currentWebContents()` finds no `remote`. `pasteWithChromiumSource` uses it with no change in behavior.
- [ ] **TASK-2:** Rewrite `pasteDefaultPlusSource(editor, info)`, with TSDoc saying why it requests the paste:
  - It focuses the editor first, since from the command palette the editor isn't focused, and a paste goes wherever focus is.
  - It calls `requestNativePaste()`. With a request, it runs `finishPaste(editor, info, "native+cite", () => this.getClipboardSourceUrl(), pasted)`.
  - Without one, it runs `finishPaste` with `"text+cite"`, so the plain text and the citation are inserted.
  - It doesn't consult `planPaste`, so the guard and Paste Mode don't apply, as before.

### Tests

#### [MODIFY] `test-windows-clipboard.ts`
- [ ] **TASK-3:** Add a "Default paste menu item" group using the existing `loadOn` fakes for `activeDocument`, `remote` and the delayed native paste:
  - The pasted content lands, and the citation comes after it.
  - With no source URL, the content lands and no citation is added.
  - With no `remote`, the plain text and the citation are inserted.
  - When the paste event never arrives, no citation is added.
  - At a guarded position, such as inside inline code, the citation is still added.
  - The command and the menu item both run this path.

### Docs

#### [MODIFY] `README.md`, `CHANGELOG.md`
- [ ] **TASK-4:** Docs:
  - The README's **Commands & Menu Options** section says both entries paste the clipboard with Obsidian's own paste, then add the citation.
  - The CHANGELOG gets a `Fixed` entry under `[Unreleased]`.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file. It verifies:
1. The new group from TASK-3.
2. The existing "Chromium paste command" group passes unchanged after the TASK-1 refactor.
3. All other test files pass unchanged.

### Manual Verification
In the test vault, copy part of a web page that holds a link, in Chrome or Edge:
1. **Menu item:** Right-click in a note and choose **Paste (Default Handler) + Source URL**. The content pastes with its link, and the citation follows it.
2. **Command:** Run **Paste (Default) + Source URL** from the command palette. Same result.
3. **No source:** Copy text from Notepad and use the menu item. The text pastes with no citation.
4. **Ctrl+V:** A normal Ctrl+V still pastes as before.
