---
status: approved
---

# Intercept the paste shortcut in pop-out windows

Pressing Ctrl+V (or Cmd+V or Shift+Insert) in a note in a pop-out window doesn't add a citation. The pop-out is either a tab dragged out of the main window or a tab opened with **Move to new window**. Obsidian pastes as usual, but the plugin never sees the key press, because it listens for the shortcut only on the main window's `document` (`registerDomEvent(document, "keydown", …)` in `onload`). Each pop-out window has its own `document`. This change listens on every window's document. Reported in [issue #1](https://github.com/coreyx/obsidian-paste-with-source/issues/1).

## User Review Required

> [!NOTE]
> **Both Paste Modes are affected, and both are fixed.**
> - **Paste (Default) + Source:** a Ctrl+V in a pop-out pastes but gets no citation.
> - **Clipboard + Source:** a Ctrl+V in a pop-out isn't intercepted at all. Obsidian pastes as if the plugin weren't there.
>
> After the fix, a pop-out behaves exactly like the main window, including the cursor-position guard and the "When a citation can't be added" setting.

> [!NOTE]
> **The rest of the paste path already uses the focused window, so only the listener changes.**
> - `currentWebContents()` reads `activeWindow`.
> - `requestNativePaste()` waits on `activeDocument`.
> - The handler reads `workspace.activeEditor` and requires `editor.hasFocus()`.
>
> The commands and the editor-menu items should therefore already work in pop-outs. Manual check 4 confirms this.
>
> The remaining direct uses of `document` are preset export and import. They run from the settings tab, which always opens in the main window, so they're left alone.

## Open Questions

None at this time.

## Proposed Changes

### Paste shortcut listener

#### [MODIFY] `main.ts`
- [x] **TASK-1:** Move the keydown listener's body out of `onload` into a method, `onPasteKeydown(event: KeyboardEvent): Promise<void>`. The body doesn't change.
  - The method's TSDoc takes over the listener's current doc comment.
  - It adds that the same method listens in every window, and that it works there because it reads the focused editor rather than the window the key event came from.
- [x] **TASK-2:** Add `listenForPasteShortcut(doc: Document): void`, documented in TSDoc. It registers `onPasteKeydown` for `keydown` on `doc` through `registerDomEvent`, so unloading the plugin removes the listener. It records `doc` in a `WeakSet<Document>`, named `pasteShortcutDocs`, and returns early for a document already in the set, so no window ever gets a second listener. A second listener would paste and cite twice.
- [ ] **TASK-3:** In `onload`, set up the listeners:
  - Call `listenForPasteShortcut(document)` where the `registerDomEvent` call is now.
  - Register `this.app.workspace.on("window-open", (_win, popout) => this.listenForPasteShortcut(popout.document))`, which covers each pop-out opened from then on.
  - In `this.app.workspace.onLayoutReady(…)`, call `this.app.workspace.iterateAllLeaves((leaf) => this.listenForPasteShortcut(leaf.getContainer().doc))`. This covers pop-outs that Obsidian restored with the workspace before the plugin loaded, and pop-outs already open when the plugin is turned on mid-session. If the layout is already ready, Obsidian runs the callback at once.
  - A short comment says why both are needed: `window-open` fires only for windows that open after the plugin registers for it.

### Tests

#### [MODIFY] `test-paste-guard.ts`
- [ ] **TASK-4:** Record every `registerDomEvent` call as a `(target, type, callback)` triple, and give the mocked workspace `on` and `onLayoutReady`.
  - The mock `on` keeps the `window-open` handler.
  - The mock `onLayoutReady` keeps its callback, and a fake `iterateAllLeaves` serves leaves whose `getContainer().doc` is a chosen document.
  - The existing `pressPaste` checks keep working: they use the keydown listener on the main `document`.

  Add a group, "Pop-out windows", that checks:
  1. `onload` registers exactly one keydown listener, on the main document.
  2. A `window-open` for a pop-out document registers one keydown listener on that document.
  3. A Ctrl+V through the pop-out's listener behaves like the main window's. With Paste (Default) + Source, it leaves the default action alone and adds the citation. With Clipboard + Source, it prevents the default and inserts the text with the citation.
  4. Layout-ready registers a listener on a restored pop-out's document. It registers no second listener on the main document, or on a pop-out that `window-open` already covered, even when several leaves share a window.
  5. A second `window-open` for the same document registers nothing.

#### [MODIFY] `test-windows-clipboard.ts`
- [ ] **TASK-5:** Give `loadOn`'s mocked workspace no-op `onLayoutReady` and `iterateAllLeaves`, so `onload` still runs. Its checks don't change.

### Docs

#### [MODIFY] `CHANGELOG.md`
- [ ] **TASK-6:** Add a `Fixed` entry under `[Unreleased]`: the paste shortcut adds a citation in pop-out windows too (#1).

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file. It verifies:
1. The "Pop-out windows" group from TASK-4.
2. Every existing paste-guard and shortcut check passes unchanged.
3. `test-windows-clipboard.ts` and all other test files pass unchanged.

A mutation check is run once by hand and not committed: removing the `window-open` registration has to fail check 2, and removing the `WeakSet` check has to fail checks 4 and 5.

### Manual Verification
In the test vault, after installing the build, copy a paragraph from a web page in Chrome or Edge:
1. **Main window:** With Paste (Default) + Source, press Ctrl+V in a note. The paste is followed by the "From: …" line, and one undo removes both, as before.
2. **Pop-out:** Drag a note's tab out into its own window, or use **Move to new window**, then press Ctrl+V there. The note gets the same paste and the same "From: …" line, and nothing is pasted twice.
3. **Clipboard + Source in a pop-out:** Switch Paste Mode to Clipboard + Source and press Ctrl+V in the pop-out. You get the plain text with its citation. Inside inline code, the "When a citation can't be added" setting applies.
4. **Menu in a pop-out:** In the pop-out, right-click and choose **Paste (Default Handler) + Source URL**. It pastes and cites.
5. **Restored pop-out:** Leave the pop-out open, quit Obsidian and reopen it. Then press Ctrl+V in the restored pop-out. It gets the citation, once.
6. **Other fields:** In the pop-out, press Ctrl+V in the search box. Nothing is cited into the note.

## Visual design application
No UI changes.
