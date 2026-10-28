# Walkthrough: Default Paste Menu

The right-click item **Paste (Default Handler) + Source URL**, and its command **Paste (Default) + Source URL**, added the citation but never pasted the clipboard. Both now run Obsidian's own paste, then add the citation after the pasted content.

## What Was Implemented

### 1. Paste
- **`main.ts`, `requestNativePaste()`** (9522974): The request for Obsidian's own paste moved out of `pasteWithChromiumSource` into a helper. It listens for the next paste event, then calls Electron's `webContents.paste()`, the same call Obsidian's context-menu **Paste** makes. It resolves to whether the paste event arrived within a second, and is undefined when there is no `remote` to ask. The Ctrl+Alt+V command uses it with no change in behavior.
- **`main.ts`, `pasteDefaultPlusSource()`** (d7c9978): The cause of the bug. It only waited 50 ms and inserted the citation, assuming Obsidian's paste was already running, which is true after a key press but not after a menu click or a command. It had done that since the first version. Now it:
  - focuses the editor
  - requests the native paste
  - hands `finishPaste` a `"native+cite"` plan, or `"text+cite"` when there's no `remote`

  It doesn't consult `planPaste`, so the paste guard and Paste Mode still don't apply, as the README says. With no source URL, the clipboard is still pasted, without a citation. Before, nothing happened at all.

### 2. Tests
- **`test-windows-clipboard.ts`** (9de9c59): `loadOn` takes an `invoke` option. It can run the Chromium command, the default-paste command, or the default-paste menu item, through a stand-in for Obsidian's editor menu. A new group, "Default paste command and menu item", holds 8 checks.

### 3. Docs
- **`README.md`** (44b0329): **Commands & Menu Options** says what each paste entry inserts.
- **`CHANGELOG.md`** (44b0329): a `Fixed` entry under `[Unreleased]`.

## Verification & Test Results

### Automated Tests
Ran `npm test`, which builds the project and runs every test file. The new group:
- The menu item focuses the editor and requests one Electron paste: **Passed**
- The menu item lets Obsidian paste, then adds the citation: **Passed**
- The command does the same: **Passed**
- With no source URL, Obsidian's paste still goes in, without a citation: **Passed**
- Inside inline code, the citation is still added: **Passed**
- Paste Mode doesn't apply; it's still Obsidian's paste, then the citation: **Passed**
- Without Electron's `remote`, the plain text, then the citation: **Passed**
- When no paste event arrives, no citation: **Passed**

With the old `pasteDefaultPlusSource` put back temporarily, all 8 checks failed, each getting just the citation, as seen in the test vault. `main.ts` was restored afterwards and the suite passed again.

### Regression Testing
- The "Chromium paste command" group passed unchanged after the TASK-1 refactor: **Passed**
- Every other test file (unit, deploy, page title, paste position guard, TemplateEngine and presets, Windows clipboard): **Passed**

## Manual Verification
In the test vault on Windows, by the user, after copying part of a web page with a link in Chrome or Edge:
1. **Menu item:** **Paste (Default Handler) + Source URL** pasted the content with its link, then the citation: **Passed**
2. **Command:** **Paste (Default) + Source URL** from the command palette gave the same result: **Passed**
3. **No source:** text copied from Notepad pasted with no citation: **Passed**
4. **Ctrl+V:** a normal Ctrl+V pasted as before: **Passed**

## Follow-ups
None.
