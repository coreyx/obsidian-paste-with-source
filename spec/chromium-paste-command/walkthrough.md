# Walkthrough: Chromium Paste Command

On Windows, the command **Paste, citing Chromium plain-text copies** is bound to Ctrl+Alt+V by default. It pastes exactly as Ctrl+V does. The only difference is where it looks for the citation's address. When the clipboard's HTML has none, it also reads the address Chromium leaves for plain-text copies, even with **Cite plain-text copies from Chromium apps** off. For an ordinary copy, the two shortcuts give the same result.

## What Was Implemented

### Revision 1 (TASK-1 to TASK-7): a plain-text command
- **`chromiumClipboardProvider`**: on Windows only, this is a second `WindowsClipboardProvider` that always reads Chromium's format. It's separate from the main provider, so an ordinary paste running at the same moment still follows the setting.
- **The command**:
  - id `paste-with-source-url-chromium`, hotkey `Mod`+`Alt`+`V`, registered on Windows only.
  - At first it pasted the clipboard's plain text plus a citation, like **Paste with Source URL**.
- **Docs**:
  - The setting's description mentions the command.
  - The README has a command-list entry, a Keyboard Shortcuts entry with the AltGr caveat, and a mention in the settings table.
  - The CHANGELOG has an `Added` entry.

Manual testing showed the plain-text paste dropped the links and formatting Ctrl+V keeps for an ordinary copy. The user's intent was that Ctrl+Alt+V should change nothing unless a citation would be missing. So the plan was reopened and revised.

### Revision 2 (TASK-8 to TASK-12): paste as Ctrl+V does
- **Why not `htmlToMarkdown`?** I checked how Obsidian 1.14.5 pastes:
  - Its own **Paste** command reads plain text only.
  - Ctrl+V's handling runs only inside a real paste event. It respects **Auto convert HTML**, treats copies from Obsidian itself specially, uses a Markdown flavor when there is one, resolves images and media, handles attachments, and runs other plugins' paste handlers.
  - A conversion of our own would only approximate that.
  - Obsidian's right-click **Paste** item, though, asks Electron for a real paste with `electron.remote.getCurrentWebContents().paste()`.
- **`planPaste(editor)`** and **`finishPaste(editor, info, plan, sourceUrl, nativePasted?)`** (`main.ts`):
  - Ctrl+V's decisions moved out of the keydown listener into these, so both paths share them.
  - A `PastePlan` is one of `"native+cite"`, `"native"`, `"text+cite"` and `"text"`.
  - The listener still decides `preventDefault()` before its first `await`.
- **`pasteWithChromiumSource`**:
  1. It focuses the editor, so running it from the command palette pastes into the note.
  2. It makes the same plan Ctrl+V would.
  3. For a native plan, it starts listening for the next `paste` event, then requests Electron's paste.
  4. The citation goes in 50 ms after that event. If none arrives within 1 s, there's no citation.
  - Without `remote`, a native plan falls back to plain text, as Obsidian's own context menu does, and still adds the citation.
  - `currentWebContents()` and `nextPasteEvent()` are new helpers for this.
- **The new name** replaces "Paste with Source URL (Chromium plain text)", which no longer described it. The id is unchanged, so a rebound hotkey keeps working.
- **Docs**:
  - The README describes the new behavior.
  - The command is listed with the guarded pastes instead of the unguarded ones.
  - The CHANGELOG entry is rewritten.

### A fix found along the way
- **The paste listener matched Ctrl+V with Alt held.** Ctrl+Alt+V would also have run the intercepted paste:
  - In *Paste content + source*, the text would have been pasted twice.
  - In the default mode, a stray citation would have been added.
- The listener now ignores Ctrl+V with Alt held (`1e5b86d`). This wasn't a planned task. It has a `Fixed` entry in the CHANGELOG, and the CHANGELOG's sections were put back in Keep a Changelog's order.

### Commits
TASK-9 to TASK-11 went into one commit, `8815558`. The reworked command broke revision 1's tests, which TASK-11 replaces, so separate commits would have left a failing suite.

## Verification & Test Results

### Automated Tests
Ran `npm test`, which builds the project and runs every test file:
- **`test-windows-clipboard.js`, "Chromium paste command" (13 checks): Passed.**
  - It covers:
    - registration and the hotkey
    - in the default mode, a single Electron paste followed by the Chromium citation, with the setting off
    - HTML Format's address winning
    - no address at all
    - content mode
    - a guarded position in inline code
    - no `remote`
    - no paste event arriving
    - macOS
  - The fake Electron paste fires a paste event, and the fake `activeDocument` records listeners.
- **`test-paste-guard.js`: Passed.** Every Ctrl+V case passed unchanged after the TASK-8 refactor. Two new cases check that Ctrl+Alt+V isn't intercepted.

**Do the tests catch real bugs?** I broke one thing at a time, and each break was caught:

| Break | Caught by |
| --- | --- |
| The command's provider follows the setting (revision 1) | The setting-off citation check |
| The command registered on macOS (revision 1) | "It isn't registered on macOS" |
| The listener matches Ctrl+V with Alt held | Both Ctrl+Alt+V shortcut cases |
| No wait for the paste event | The ordering check, HTML Format's check, and the timeout check |
| No `editor.focus()` | The focus check |
| No plain-text fallback without `remote` | The no-`remote` check |
| Citing when no paste arrived | The timeout check |

The no-wait break was at first caught only by the timeout check. The fake paste arrived after 5 ms, well inside Ctrl+V's fixed 50 ms. It now arrives after 70 ms, so the ordering check proves the citation waits for the paste.

### Regression Testing
These all passed unchanged:
- `test-templates.js`
- `test-page-title.js`
- `test-bplist.js`
- `test-deploy.js`

## Manual Verification
The user ran these on Windows in the test vault, with the setting off and Paste Mode on *Default handler + source*. All of them passed.

| Step | Check | Result |
| --- | --- | --- |
| 1 | A plain-text Copy button, then Ctrl+V: no citation | Passed |
| 2 | The same copy, then Ctrl+Alt+V: the text once, plus the page's citation | Passed |
| 3 | An ordinary copy with a link, pasted with Ctrl+V and with Ctrl+Alt+V: identical results, with the link kept in both | Passed |
| 4 | Run from the command palette: the paste and its citation land in the note | Passed |
| 5 | Ctrl+Alt+V inside inline code: no citation | Passed |
| 6 | *Paste content + source*, step 2 again: the text once, plus the citation | Passed |
| 7 | Settings → Hotkeys shows the new name on Ctrl+Alt+V, and the setting's description names it | Passed |
| 8 | The setting turned back on | Passed |

Revision 1 was tested first, and that's how the dropped links were found. In its step 3, an ordinary copy pasted with Ctrl+Alt+V lost its links, while Ctrl+V kept them.

## Follow-ups
- **`remote` isn't in Obsidian's documented plugin API.** If a future Obsidian removes it, the command falls back to plain text plus the citation.
- **The listener also matches Ctrl+Shift+V,** which is Obsidian's "paste as plain text". That was already true before this change and is left alone here.
