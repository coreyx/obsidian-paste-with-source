---
status: approved
---

# Cite plain-text copies from Chromium apps on Windows

When a page copies plain text with `navigator.clipboard.writeText`, Chromium puts no "HTML Format" on the Windows clipboard, so the `SourceURL` header the plugin reads isn't there and the paste gets no citation. Examples are the Copy buttons on ChatGPT and GitHub, and the ai-chat-formatter extension. Chromium does still leave the page's address in its own "Chromium internal source URL" clipboard format. This change reads that format when HTML Format has no `SourceURL`. A new Windows-only setting, **Cite plain-text copies from Chromium apps**, turns it on and off, and it's on by default.

## User Review Required

> [!IMPORTANT]
> **Plain-text copies from other Chromium-based apps get citations too, while the setting is on.** Slack, Teams, Discord and other desktop apps built on Chromium write this format with the address of the page they show, for example `https://app.slack.com/client/…`.
> - Selection copies from those apps are already cited today, through HTML Format. This extends that to their plain-text copies.
> - Addresses that aren't `http(s)` are ignored, including Obsidian's own `app://obsidian.md/…` and VS Code's `vscode-file://…`. So copying text inside Obsidian still gets no citation.
> - Turning the setting off restores 1.5.0's behavior exactly.

> [!NOTE]
> **Windows only.** On macOS the plugin already reads Chromium's equivalent, `org.chromium.source-url`, as its main source for every Chrome copy. A toggle there would switch off Chrome citations altogether, so the setting is hidden on macOS and macOS behavior doesn't change. Whether macOS already cites text-only copies is untested and out of scope.

> [!NOTE]
> **Fewer PowerShell runs.** Today every Windows paste without HTML Format, which includes every text-only copy, falls through to the PowerShell fallback, a separate process taking a few hundred milliseconds. Text-only copies from Chromium will now resolve in-process instead.

## Open Questions

None at this time. Which name Electron expects for the format is settled during implementation by trying both (see TASK-2), and confirmed by manual step 2.

## Proposed Changes

### Settings

#### [MODIFY] `main.ts`
- [x] **TASK-1:** Add `readChromiumSourceUrl: boolean` to `PasteWithSourceSettings`, with TSDoc.
  - `DEFAULT_SETTINGS.readChromiumSourceUrl` is `true`.
  - `loadSettings` resets anything that isn't a boolean to the default, as it does for the other validated settings.

### Clipboard reading

#### [MODIFY] `main.ts`
- [x] **TASK-2:** Read the format in `WindowsClipboardProvider`.
  - New exported `parseInternalSourceUrl(buf: Buffer): string`.
    - It decodes the buffer as UTF-8, removes NUL characters (Chromium writes a trailing one), and trims.
    - It returns the result only if it starts with `http://` or `https://`, case-insensitively. Otherwise it returns `""`.
  - `WindowsClipboardProvider` gets a constructor parameter `readChromiumSourceUrl: () => boolean`, which defaults to `() => true`.
    - It's a function rather than a value, so a change in settings applies to the next paste without rebuilding the provider.
    - `createClipboardProvider(readChromiumSourceUrl)` passes it through. `onload` passes `() => this.settings.readChromiumSourceUrl`.
  - `getSourceUrl` order:
    1. "HTML Format" `SourceURL`, unchanged.
    2. If the setting is on: `readBuffer("Chromium internal source URL")`, then `readBuffer('electron application/osclipboard;format="Chromium internal source URL"')` if that's empty. Both run inside `safelyReadClipboard`, the same pair of names the HTML read already tries, and the result goes through `parseInternalSourceUrl`.
    3. The PowerShell fallback.
- [ ] **TASK-3:** Teach the PowerShell fallback the same format.
  - The script moves into a new static `WindowsClipboardProvider.powerShellScript(readChromiumSourceUrl: boolean): string`.
  - When the setting is on and the HTML check finds no `SourceURL`, the script also reads `[System.Windows.Forms.Clipboard]::GetData('Chromium internal source URL')`. That's a `MemoryStream`; the script decodes its `.ToArray()` as UTF-8, removes NUL characters, and prints the result only if it starts with `http`.
  - It's still one PowerShell process, and the existing `startsWith("http")` check on its output stays.

### Settings UI

#### [MODIFY] `main.ts`
- [ ] **TASK-4:** Add a **Cite plain-text copies from Chromium apps** toggle to `PasteWithSourceSettingTab`, placed after **Paste Mode** and its guarded-paste option.
  - Shown only when `process.platform === "win32"`.
  - Description: "When a browser or app built on Chromium (Chrome, Edge, Brave, Slack, …) copies plain text only, such as from a Copy button, read the page address it leaves on the clipboard. Turn off if plain-text copies from desktop apps get citations you don't want."

### Tests

#### [NEW] `test-windows-clipboard.ts`
- [ ] **TASK-5:** Tests for `parseInternalSourceUrl`, the provider's read order, and the PowerShell script, run by `npm test`.
  - The provider is tested against a stub `window.require("electron")` whose `clipboard.readBuffer` answers from a map of format names. Its PowerShell fallback is replaced with a recorder, so nothing is spawned.
  - The cases are listed under Verification Plan.

### Documentation

#### [MODIFY] `README.md` · `CHANGELOG.md`
- [ ] **TASK-6:** Document the change.
  - `README.md`:
    - A Settings table row for the new toggle, marked Windows only.
    - The Windows row of the Compatibility table says plain-text copies from Chromium browsers are cited too.
    - The project tree gains `test-windows-clipboard.ts` and `spec/chromium-source-url-format/`.
  - `CHANGELOG.md`, under `[Unreleased]`: an `Added` entry.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file, including the new `test-windows-clipboard.ts`. It verifies:
1. **`parseInternalSourceUrl`:**
   - A URL with a trailing NUL returns the URL.
   - A URL without a NUL returns the URL.
   - Surrounding whitespace is trimmed.
   - An empty buffer, a non-URL value, `app://obsidian.md/index.html` and `vscode-file://…` all return `""`.
2. **Read order:**
   - HTML Format with a `SourceURL` wins over the internal format.
   - With no HTML Format, the internal format is used, and PowerShell isn't run.
   - The prefixed format name is used when the bare one is empty.
   - With the setting off, the internal format is ignored and PowerShell runs.
   - An internal value that isn't `http(s)` falls through to PowerShell.
   - Changing the setting after the provider is built takes effect on the next read.
3. **`powerShellScript`:** it includes the `Chromium internal source URL` check only when asked to.
4. **Settings loading:** a missing or non-boolean `readChromiumSourceUrl` loads as `true`, and a stored `false` is kept.

Regression: `test-page-title.ts`, `test-templates.ts`, `test-paste-guard.ts`, `test-bplist.ts` and `test-deploy.ts` still pass.

**Run during implementation:** the PowerShell script is checked against a real clipboard on this machine. PowerShell writes a `MemoryStream` holding `https://example.com/test-page` plus a trailing NUL under "Chromium internal source URL", then the script runs and must print exactly that URL. This is repeated with the setting off, and then the script must print nothing.

### Manual Verification
These run in the test vault on Windows, with **Intercept Paste** on.

1. **Before installing this build:** click a Copy button that writes plain text only, such as a ChatGPT reply's copy icon or a GitHub code block's copy button, and paste. It gets no citation.
2. **With this build:** repeat step 1. The citation uses that page's address. This confirms the format name Electron accepts.
3. **Ordinary copies:** select text on a web page, copy it with Ctrl+C, and paste. It's still cited, through HTML Format.
4. **Inside Obsidian:** copy text from a note and paste it into another note. No citation.
5. **Setting off:** turn off **Cite plain-text copies from Chromium apps** and repeat step 2. No citation. Turn it back on and the citation returns, without reloading.
6. **macOS** (only if a Mac is at hand): the setting doesn't appear in the settings tab.

## Visual design application
No design system or art bible exists for this product. The change adds one toggle using the existing settings components.
