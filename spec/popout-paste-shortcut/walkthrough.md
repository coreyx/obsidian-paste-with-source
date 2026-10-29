# Walkthrough: Pop-Out Window Paste Shortcut

The paste shortcut now adds a citation in pop-out windows, not just the main window. The plugin used to listen for Ctrl+V, Cmd+V and Shift+Insert only on the main window's document. It now listens on every window's document, including pop-outs restored when Obsidian starts. This fixes [issue #1](https://github.com/coreyx/obsidian-paste-with-source/issues/1).

## What Was Implemented

### 1. Paste shortcut listener
- **`main.ts`**:
  - The keydown handler moved out of `onload` into `onPasteKeydown(event)`, with no change to its body. It works in any window because it reads the focused editor and the active window, never the window the event came from.
  - New: `listenForPasteShortcut(doc)` registers that handler on one document through `registerDomEvent`, so unloading the plugin removes it. A `WeakSet<Document>`, `pasteShortcutDocs`, skips a document that's already registered, because a second listener would paste and cite twice.
  - `onload` listens in three places:
    - on the main `document`
    - on each pop-out announced by the workspace's `window-open` event
    - once the layout is ready, on every leaf's container document (`iterateAllLeaves` → `leaf.getContainer().doc`)

    The last one covers pop-outs that Obsidian restored before the plugin loaded, and pop-outs already open when the plugin is turned on, since `window-open` fires only for windows that open after the plugin starts listening.

### 2. Tests
- **`test-paste-guard.ts`**:
  - The harness is split into `loadPlugin`, which records every DOM listener and keeps the `window-open` handler and the layout-ready callback, and `press`, which presses a key through one listener. `pressPaste` is built on them, so the existing checks run as before.
  - New group, "Pop-out windows", with 6 checks.
- **`test-windows-clipboard.ts`**: `loadOn`'s fake workspace has do-nothing `onLayoutReady` and `iterateAllLeaves`.

### 3. Docs
- **`CHANGELOG.md`**: A `Fixed` entry under `[Unreleased]`, linking #1.

## Verification & Test Results

### Automated Tests
Ran `npm test`. Every test file passed:
- **Pop-out windows** in `test-paste-guard.ts`:
  - Loading listens on the main window's document, once: **Passed**
  - A pop-out window that opens gets one listener: **Passed**
  - Paste (Default) + Source: a paste in a pop-out leaves the default action alone and adds the citation: **Passed**
  - Clipboard + Source: a paste in a pop-out prevents the default and inserts the text with its citation: **Passed**
  - Layout-ready listens on a restored pop-out and on no document twice, with several leaves per window: **Passed**
  - The same window announced twice gets one listener: **Passed**

Mutation check, run by hand and not committed: each change below was made to `main.ts` in turn, and `main.ts` was restored afterward.
- **Removing the `window-open` registration:** "a pop-out window that opens gets one listener" fails with 0 listeners. The next check then throws, because there is no pop-out listener to press, so the run fails either way.
- **Removing the `WeakSet` check:** the layout-ready check fails with counts of 3, 2 and 2 listeners on the main window, the opened pop-out and the restored pop-out, and the "announced twice" check fails with 2.
- **Removing the layout-ready scan:** the layout-ready check fails with 0 listeners on the restored pop-out.

### Regression Testing
Every other check in the suite passed unchanged:
- `test-paste-guard.ts`: the paste position guard, the shortcut recognition and the shortcut handling checks
- `test-windows-clipboard.ts`
- `test-page-title.ts`
- `test-templates.ts`
- `test-bplist.ts`
- `test-deploy.ts`

## Manual Verification
The build is deployed to the test vault. Reload the plugin, or restart Obsidian, then copy a paragraph from a web page in Chrome or Edge:
1. **Main window:** With Paste (Default) + Source, press Ctrl+V in a note. The paste is followed by the "From: …" line, and one undo removes both, as before.
2. **Pop-out:** Drag a note's tab out into its own window, or use **Move to new window**, then press Ctrl+V there. The note gets the same paste and the same "From: …" line, and nothing is pasted twice.
3. **Clipboard + Source in a pop-out:** Switch Paste Mode to Clipboard + Source and press Ctrl+V in the pop-out. You get the plain text with its citation. Inside inline code, the "When a citation can't be added" setting applies.
4. **Menu in a pop-out:** In the pop-out, right-click and choose **Paste (Default Handler) + Source URL**. It pastes and cites.
5. **Restored pop-out:** Leave the pop-out open, quit Obsidian and reopen it. Then press Ctrl+V in the restored pop-out. It gets the citation, once.
6. **Other fields:** In the pop-out, press Ctrl+V in the search box. Nothing is cited into the note.

These steps hadn't been run yet when this walkthrough was written.

## Follow-ups
None.
