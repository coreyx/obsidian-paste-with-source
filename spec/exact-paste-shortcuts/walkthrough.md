# Walkthrough: Exact Paste Shortcuts

The paste listener now intercepts only the shortcuts the plugin documents, each with no other modifier held: Ctrl+V and Shift+Insert on Windows, and Cmd+V on macOS. Ctrl+Shift+V or Cmd+Shift+V, which is Obsidian's "paste as plain text", was being intercepted too. It's now left to Obsidian, along with Ctrl+Shift+Insert and every other combination.

## What Was Implemented

### 1. Paste listener (`main.ts`)
- **`pasteShortcut(event, isMac)`** (new, exported for its tests): returns which shortcut a key press is.
  - `"v"`: exactly Cmd+V on macOS, or exactly Ctrl+V elsewhere.
  - `"shift+insert"`: exactly Shift+Insert, outside macOS.
  - `null`: anything else.
  - Its TSDoc names what this leaves to Obsidian: paste as plain text, the Ctrl+Alt+V Chromium command, and AltGr+V, which arrives as Ctrl+Alt+V.
- **The keydown listener** uses it in place of `isCmdV`, `isCtrlV` and `isShiftInsert`, matched against **Intercept Shortcut** as before.

The over-broad check dated from the plugin's first macOS commit. It tested Ctrl or Cmd and the V key, but no other modifier.

### 2. Tests (`test-paste-guard.ts`)
- **`pressPaste`** takes a key press, `Keys`, in place of its `alt` flag. It defaults to this platform's paste shortcut. It used to send Ctrl and Cmd together so one event worked on any platform, but exact matching rejects that.
- **"Paste shortcut recognition, on both platforms"** has 15 direct checks of `pasteShortcut`, for macOS and for Windows. These cover the Mac rules, which can't be tested by hand here. I added them on top of the plan's cases, which ran on the current platform only.
- **"Paste shortcut handling"** has new cases. Each modifier combination below is checked in both Paste Modes:
  - These are left to Obsidian:
    - Ctrl+Shift+V
    - Ctrl+Alt+V
    - Ctrl+Alt+Shift+V
    - Ctrl+Shift+Insert
  - Shift+Insert is still intercepted.
- TASK-1 and TASK-2 went into one commit, `00e5274`, because exact matching broke the old test events until the harness changed.

### 3. Docs
- **`README.md`**: the Standard Paste entry says only the exact shortcuts are intercepted, so "paste as plain text" pastes plain text with no citation.
- **`CHANGELOG.md`**: a `Fixed` entry under `[Unreleased]`.

## Verification & Test Results

### Automated Tests
Ran `npm test`, which builds and runs every test file. **`test-paste-guard.js`: Passed**, including the 25 new checks.

**Do the tests catch real bugs?** Each break below was caught:

| Break | Caught by |
| --- | --- |
| Allow Shift with V | both platforms' recognition checks and the two Ctrl+Shift+V handling cases |
| Allow Ctrl with Shift+Insert | the recognition check and both Ctrl+Shift+Insert cases |
| Allow Ctrl with Cmd+V on macOS | the Cmd+Ctrl+V recognition check |

### Regression Testing
These passed unchanged:
- every existing shortcut and guard case
- `test-templates.js`
- `test-page-title.js`
- `test-windows-clipboard.js`
- `test-bplist.js`
- `test-deploy.js`

## Manual Verification
The user ran these on Windows in the test vault, in both Paste Modes, after copying text from a web page. Every step passed:

| Step | Check | Result |
| --- | --- | --- |
| 1 | Ctrl+Shift+V pastes plain text, once, with no citation | Passed |
| 2 | Ctrl+V pastes with a citation, as before | Passed |
| 3 | Shift+Insert pastes with a citation, as before | Passed |

While testing, the user noticed that in *Paste content + source* mode, inline links from the page come through as plain text. That's the mode's design: it inserts the clipboard's plain text plus the citation. *Default handler + source* keeps links and formatting.

## Follow-ups
- **Two cases are unconfirmed on macOS.** The double paste that Cmd+Shift+V may have caused in *Paste content + source* mode is one. That Cmd+Shift+V is now left alone is the other. The direct checks cover the logic, but no Mac was available to try either one.
