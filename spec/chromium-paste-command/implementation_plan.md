---
status: approved
---

# Add a Windows command that always cites Chromium plain-text copies

On Windows, a new command, **Paste, citing Chromium plain-text copies**, gets a default hotkey of Ctrl+Alt+V, which can be changed under Settings → Hotkeys. It pastes exactly as Ctrl+V does. The one difference is where it looks for the citation's address: it also reads Chromium's "Chromium internal source URL" format, even when **Cite plain-text copies from Chromium apps** is off. So you can keep the setting off for everyday pastes and still cite a page's Copy button on demand. For an ordinary copy, the clipboard's HTML already carries the address, so Ctrl+Alt+V and Ctrl+V give the same result.

> [!NOTE]
> **Revision 2.** TASK-1 to TASK-7 built a first version that pasted the clipboard's plain text, like **Paste with Source URL**. Manual testing showed that drops the links and formatting Ctrl+V keeps for an ordinary copy. TASK-8 to TASK-12 make the command paste exactly as Ctrl+V does. TASK-2's plain-text paste is replaced by TASK-9.

## User Review Required

> [!IMPORTANT]
> **How it pastes like Ctrl+V.** A plugin can't run Ctrl+V's paste directly. Obsidian's own **Paste** command reads plain text only, and its HTML conversion runs only inside a real paste event. So the command asks Electron for a real paste, `electron.remote.getCurrentWebContents().paste()`, as Obsidian's own right-click **Paste** item does. That paste goes through all of Obsidian's paste handling:
> - the **Auto convert HTML** setting
> - copies from inside Obsidian
> - images, media and attachments
> - other plugins' paste handlers
>
> `remote` isn't part of Obsidian's documented plugin API. If a future Obsidian removes it, the command falls back to pasting plain text, as Obsidian's right-click **Paste** does, and still adds the citation.

> [!IMPORTANT]
> **It follows the same rules as Ctrl+V:**
> - **Paste Mode:**
>   - *Default handler + source*: Obsidian's paste, then the citation.
>   - *Paste content + source*: plain text plus the citation.
> - **The paste guard:** no citation inside code, math, comments, frontmatter, links or an open parenthesis. A guarded paste does what **When a citation can't be added** says, as Ctrl+V does.
> - **Not followed:** **Intercept Paste** and **Intercept Shortcut**. Those choose whether Ctrl+V is intercepted at all. A command you press on purpose always runs.

> [!NOTE]
> **The command's name changes** from "Paste with Source URL (Chromium plain text)" to **Paste, citing Chromium plain-text copies**. The old name said it pasted plain text, which is no longer true. Its id, `paste-with-source-url-chromium`, stays, so a rebound hotkey keeps working.

> [!NOTE]
> **Waiting for the paste, not a fixed delay.** Ctrl+V adds its citation 50 ms after the key press. That works because the browser's paste runs as soon as the key handler returns. A paste requested through Electron arrives a little later. So the command waits for the editor's `paste` event and then adds the citation 50 ms later, as Ctrl+V does. If no paste event arrives within one second, it adds no citation. That happens, for example, when the clipboard is empty.

> [!IMPORTANT]
> **Ctrl+Alt+V is AltGr+V on keyboards with an AltGr key.** On those keyboards Windows reports AltGr as Ctrl+Alt. Some layouts type a character with AltGr+V, such as `@` on the Czech layout, and Obsidian would run the command instead of typing it. The hotkey stays Ctrl+Alt+V as you chose. The README will say how to rebind or clear it.

> [!NOTE]
> **The citation's address is looked up as for Ctrl+V,** with the Chromium format always included:
> - It reads HTML Format's `SourceURL` first.
> - Then it reads Chromium's format, whatever the setting says.
> - Then it falls back to PowerShell, with Chromium's format included.
> - With no address found, the paste goes in without a citation, as with Ctrl+V.

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
- [x] **TASK-7:** Add an `Added` entry under `[Unreleased]` in `CHANGELOG.md`.

### Revision 2: paste exactly as Ctrl+V does

#### [MODIFY] `main.ts`
- [x] **TASK-8:** Move the intercepted paste's decisions out of the keydown listener into shared methods, so Ctrl+V and the command can't drift apart:
  - **`planPaste(editor): PastePlan`** decides from the cursor position, Paste Mode and **When a citation can't be added**. It doesn't wait on anything. The plan is one of:
    - `"native+cite"`: Obsidian's paste, then a citation.
    - `"native"`: Obsidian's paste alone.
    - `"text+cite"`: plain text plus a citation.
    - `"text"`: plain text alone.
  - **`finishPaste(editor, info, plan, provider)`** does what the plan says, apart from Obsidian's paste itself. It reads the text and the source URL from `provider`, inserts them, and for `"native+cite"` adds the citation after Obsidian's paste.
  - The keydown listener calls `planPaste` and calls `preventDefault()` before its first `await` unless the plan is native, exactly as now. Then it calls `finishPaste` with the main provider.
  - The existing Ctrl+V tests in `test-paste-guard.ts` must pass unchanged, which confirms that Ctrl+V's behavior doesn't change.
- [x] **TASK-9:** Rework `pasteWithChromiumSource(editor, info)` to paste as Ctrl+V does, using `chromiumClipboardProvider`:
  - It calls `editor.focus()` first. Run from the command palette, the paste has to reach the editor.
  - For a native plan, it requests Obsidian's paste with `electron.remote.getCurrentWebContents().paste()`, then waits for the next `paste` event on the editor's document. After that event it adds the citation 50 ms later, as Ctrl+V does. If no event arrives within 1 s, it adds no citation.
  - If `remote` isn't available, a native plan falls back to the plain clipboard text through `replaceSelection`, and still adds the citation for `"native+cite"`.
  - For a text plan, it does what Ctrl+V does, through `finishPaste`.
- [x] **TASK-10:** Rename the command to **Paste, citing Chromium plain-text copies**, keeping its id. The settings toggle's description names the new command name.

#### [MODIFY] `test-windows-clipboard.ts`
- [x] **TASK-11:** Rework the "Chromium paste command" group for the new behavior. The `remote` paste is stubbed so it fires a fake `paste` event, and the checks are:
  - **Registration:** the name, id and hotkey.
  - **Default handler + source:**
    - The command requests one Electron paste and doesn't insert the text itself.
    - After the paste event, it adds a citation for the Chromium address, with the setting off.
    - HTML Format's `SourceURL` still wins.
  - **Paste content + source:** plain text plus the citation, with no Electron paste.
  - **A guarded position,** such as inside inline code: no citation. The paste follows **When a citation can't be added**.
  - **No `remote`:** the plain text goes in, followed by the citation.
  - **No paste event within the timeout:** no citation.
  - **macOS:** not registered, as before.

#### [MODIFY] `README.md`, `CHANGELOG.md`
- [ ] **TASK-12:** Update the README and the `[Unreleased]` entry for the new name and behavior:
  - It pastes as Ctrl+V does, following Paste Mode and the paste guard.
  - It only adds the Chromium source address when the clipboard's HTML has none.
  - The README's line on unguarded paste commands drops it, since the command now follows the guard.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file. It verifies:
1. The reworked command group from TASK-11.
2. Every existing Ctrl+V case in `test-paste-guard.ts` passes unchanged after TASK-8.
3. All other test files pass unchanged.

### Manual Verification
On Windows, in the test vault, with **Cite plain-text copies from Chromium apps** off and Paste Mode on *Default handler + source*:
1. **Plain-text copy, Ctrl+V:** Use a page's plain-text Copy button in Chrome or Edge, then press Ctrl+V. You get no citation.
2. **Plain-text copy, Ctrl+Alt+V:** With the same copy, press Ctrl+Alt+V. You get the text, pasted once, and a citation for that page.
3. **Ordinary copy:** Select text that contains a link on a page, and press Ctrl+C. Paste it once with Ctrl+V and once with Ctrl+Alt+V. The two results are identical, with the link kept in both and a citation in both.
4. **Command palette:** Run **Paste, citing Chromium plain-text copies** from the command palette. The paste lands in the note, with the citation.
5. **Guarded position:** Inside inline code, press Ctrl+Alt+V. The paste goes in with no citation.
6. **Content mode:** Switch Paste Mode to *Paste content + source*, then repeat step 2. You get the text once, plus the citation. Then switch it back.
7. **Hotkey and description:** Settings → Hotkeys lists the command under its new name with Ctrl+Alt+V. The settings toggle's description names it.
8. **Restore:** Turn the setting back on.

## Visual design application
The only UI change is one sentence added to an existing setting's description, so there is no design system to apply.
