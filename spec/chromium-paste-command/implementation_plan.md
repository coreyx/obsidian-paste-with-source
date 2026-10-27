---
status: approved
---

# Add a Windows command that always cites Chromium plain-text copies

On Windows, a new command, **Paste with Source URL (Chromium plain text)**, pastes the clipboard text with a citation. It reads Chromium's "Chromium internal source URL" format even when **Cite plain-text copies from Chromium apps** is off. Its default hotkey is Ctrl+Alt+V, which can be changed under Settings → Hotkeys. You can keep the setting off for everyday pastes and still cite a page's Copy button on demand.

## User Review Required

> [!IMPORTANT]
> **Ctrl+Alt+V is AltGr+V on keyboards with an AltGr key.** On those keyboards Windows reports AltGr as Ctrl+Alt. Some layouts type a character with AltGr+V, such as `@` on the Czech layout, and Obsidian would run the command instead of typing it. The hotkey stays Ctrl+Alt+V as you chose. The README will say how to rebind or clear it.

> [!NOTE]
> **It behaves like "Paste with Source URL"** except for the Chromium format:
> - It reads HTML Format's `SourceURL` first.
> - Then it reads Chromium's format, whatever the setting says.
> - Then it falls back to PowerShell, with Chromium's format included.
> - With no source URL found, it pastes the text alone.
> - Like the other paste commands, it adds a citation wherever the cursor is, with no paste guard.

> [!NOTE]
> **Windows only.** The command is registered only on Windows, so it doesn't appear in the command palette elsewhere. macOS already reads Chromium's format for every paste.

## Open Questions

None at this time.

## Proposed Changes

### Command

#### [MODIFY] `main.ts`
- [x] **TASK-1:** Add `chromiumClipboardProvider?: IClipboardSourceProvider` to the plugin, documented in TSDoc.
  - On Windows, `onload` sets it to `new WindowsClipboardProvider(() => true)`.
  - On other platforms it stays undefined.
  - A second provider avoids a flag shared with the main provider, which an intercepted paste could read mid-command.
- [x] **TASK-2:** Add `pasteWithChromiumSource(editor, info)`. It reads the clipboard text and the source URL from `chromiumClipboardProvider`, then calls `insertWithCitation`, as `pasteWithSource` does.
- [x] **TASK-3:** On Windows only, register the command in `onload`:
  - `id: "paste-with-source-url-chromium"`
  - `name: "Paste with Source URL (Chromium plain text)"`
  - `hotkeys: [{ modifiers: ["Mod", "Alt"], key: "V" }]`. On Windows, `Mod` is Ctrl.
  - Its callback uses the active editor, as the existing paste commands do.
- [x] **TASK-4:** In the settings tab, extend the Windows-only toggle's description with one sentence: when it's off, the "Paste with Source URL (Chromium plain text)" command (Ctrl+Alt+V) still reads the format.

### Tests

#### [MODIFY] `test-windows-clipboard.ts`
- [x] **TASK-5:** Add a "Chromium paste command" group. It loads the plugin with `process.platform` stubbed as `win32`, with `addCommand` and the other Obsidian APIs stubbed, and checks:
  - The command is registered, with its id, name and the `Mod`+`Alt`+`V` hotkey.
  - With `readChromiumSourceUrl` off, running it over a fake clipboard that holds only Chromium's format inserts the text with a citation for that address.
  - With HTML Format's `SourceURL` also present, that address wins.
  - With the platform stubbed as `darwin`, the command isn't registered.
  - The main provider still ignores Chromium's format with the setting off, so the command doesn't change ordinary pastes.

### Docs

#### [MODIFY] `README.md`
- [x] **TASK-6:** Document the command:
  - It joins the command list as `Paste with Source URL (Chromium plain text)` (`Ctrl+Alt+V`, Windows only).
  - It gets an entry under **Keyboard Shortcuts** saying what it does, and that AltGr+V can trigger it on keyboards with AltGr, so rebind it under Settings → Hotkeys if that types a character on your layout.
  - The **Cite plain-text copies from Chromium apps** settings row mentions it.
- [ ] **TASK-7:** Add an `Added` entry under `[Unreleased]` in `CHANGELOG.md`.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file. It verifies:
1. The command group from TASK-5.
2. All existing Windows clipboard checks pass unchanged.
3. All other test files pass unchanged.

### Manual Verification
On Windows, in the test vault:
1. **Setting off, normal paste:** Turn **Cite plain-text copies from Chromium apps** off. Copy from a page's plain-text Copy button in Chrome or Edge, then paste with Ctrl+V. You get no citation.
2. **Setting off, command:** With the same copy, press Ctrl+Alt+V. You get the text and a citation for that page.
3. **Ordinary copy:** Select text on a page, press Ctrl+C, then press Ctrl+Alt+V. You get a citation.
4. **Hotkey listed:** Settings → Hotkeys lists the command with Ctrl+Alt+V, and it can be rebound.
5. **Setting description:** The toggle's description mentions the command.
6. **Restore:** Turn the setting back on.

## Visual design application
The only UI change is one sentence added to an existing setting's description, so there is no design system to apply.
