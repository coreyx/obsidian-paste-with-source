# Walkthrough: Chromium Source URL Format

On Windows, a page that copies plain text only, such as a Copy button using `navigator.clipboard.writeText`, now gets a citation. The plugin reads the page address Chromium leaves in its "Chromium internal source URL" clipboard format whenever HTML Format has no `SourceURL`. A Windows-only setting, **Cite plain-text copies from Chromium apps**, turns this on and off, and it's on by default.

The request came from Corey, through the ai-chat-formatter session. The extension in that project writes Markdown to the clipboard as plain text only.

## What Was Implemented

### 1. Settings
- **`main.ts`, `PasteWithSourceSettings`**: a new `readChromiumSourceUrl: boolean`, defaulting to `true`. `loadSettings` resets anything that isn't a boolean.

### 2. Reading the format
- **`parseInternalSourceUrl(buf)`** (new, exported): decodes the buffer as UTF-8, removes Chromium's trailing NUL, trims, and accepts only `http(s)` addresses. That rejects Obsidian's own `app://obsidian.md/…` and VS Code's `vscode-file://…`, so copies inside Obsidian still get no citation.
- **`WindowsClipboardProvider`**:
  - It takes `readChromiumSourceUrl: () => boolean`, which is read at each paste, so the toggle applies without a reload.
  - `createClipboardProvider` passes it through, and `onload` supplies the setting.
  - `getSourceUrl` now reads, in order:
    1. HTML Format's `SourceURL`;
    2. if the setting is on, the Chromium format, trying the bare name and then Electron's prefixed `electron application/osclipboard;format="…"` name;
    3. the PowerShell fallback.
- **`WindowsClipboardProvider.powerShellScript(readChromiumSourceUrl)`** (new) builds the fallback script.
  - With the setting on, it also reads the format's `MemoryStream`, strips the NUL and prints the address if it's `http(s)`.
  - With it off, it's identical to the original script. That was checked against the previous commit's string.

### 3. Settings UI
- **`PasteWithSourceSettingTab`**: a **Cite plain-text copies from Chromium apps** toggle after Paste Mode, shown only when `process.platform === "win32"`.

### 4. Tests and docs
- **`test-windows-clipboard.ts`** (new), 27 checks:
  - the parser;
  - the read order, over a fake Electron clipboard with PowerShell stubbed out;
  - the setting applying at the next read;
  - a clipboard that throws;
  - the PowerShell script;
  - settings loading.
- **`README.md`**:
  - a Settings row for the toggle;
  - the Windows compatibility row says plain-text copies are cited from Chromium browsers, not Firefox;
  - the project tree.
- **`CHANGELOG.md`**: an `Added` entry under `[Unreleased]`.

## Verification & Test Results

### Automated Tests
Ran `npm test`. All six test files pass:
- **`test-windows-clipboard.js`: 27 checks, Passed.**
  - The "clipboard that throws" check made the provider log its warning, with a stack trace, into the test output. The test now silences `console.warn` for that one check.
- **Do the tests catch real bugs?** Three behaviors were removed from the compiled `main.js`, one at a time, and each was caught:
  - **Ignoring the setting:** caught by three checks.
  - **Keeping Chromium's NUL:** caught by four parser checks. The first attempt at this break never ran, because the shell quoting didn't match the code. It was redone with a script file.
  - **Skipping the prefixed format name:** caught by its check.

**Against a real clipboard.** PowerShell put a `MemoryStream` holding `https://example.com/test-page` and a NUL on the clipboard under "Chromium internal source URL", along with plain text. The plugin's actual `executePowerShellFallback` printed exactly that URL with the setting on, and nothing with it off.

The user's clipboard text was saved and restored around the check. The test data was gone afterward and 43 characters of text were back. But the comparison made right after restoring reported a mismatch, so an exact round trip isn't confirmed. Non-text clipboard formats weren't preserved.

### Regression Testing
These were re-run against this build:
- `test-page-title.js`: 38 checks, **Passed**.
- `test-templates.js`: 116 checks, **Passed**.
- `test-paste-guard.js`: 85 checks, **Passed**.
- `test-bplist.js`: 8 checks, **Passed**.
- `test-deploy.js`: 7 checks, **Passed**.

## Manual Verification
These were run by the user in the test vault, on Windows. The vault had moved to `I:\Obsidian\Plugin Test`. The deploy script refused the old path and listed the new one.

| Step | Check | Result |
| --- | --- | --- |
| 1 | A page's plain-text Copy button: the paste is cited with that page's address. This confirms Electron reads the format | Passed |
| 2 | An ordinary Ctrl+C selection copy is still cited | Passed |
| 3 | Copying inside Obsidian: no citation | Passed |
| 4 | The toggle appears after Paste Mode, and is on | Passed |
| 5 | Toggle off: the Copy button paste gets no citation. Back on: it's cited again, without a reload | Passed |

The plan's step 1 was to try the Copy button before installing the build. It was folded into step 5, because the build was already installed and turning the setting off restores the old behavior. Step 6, macOS, wasn't run because no Mac was available.

## Follow-ups
- **macOS isn't tested.** It already reads `org.chromium.source-url` for every Chrome copy, so plain-text copies there are probably cited too.
- **Which format name works isn't recorded.** Step 1 shows Electron accepts one of the two, bare or prefixed. If one is ever needed for debugging, a temporary log line would tell.
