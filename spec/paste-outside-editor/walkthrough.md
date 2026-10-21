# Walkthrough: Paste Outside the Editor

The paste shortcut's keydown listener now does nothing unless the note's editor has keyboard focus. Before this change it took `workspace.activeEditor`, which follows the active view rather than focus. A paste into a field inside the note's own pane, such as the note title or the find bar, was then cited onto the note body, or redirected into it.

## What Was Implemented

### 1. Paste handling
- **`main.ts`**: The keydown listener in `onload` returns right after the editor lookup when `!editor.hasFocus()`. This happens before `canAddCitation` and before any `preventDefault()`, so a paste outside the editor is left entirely to Obsidian. The listener's TSDoc explains why the check is needed.

### 2. Tests
- **`test-paste-guard.ts`**: `pressPaste` takes a `focused` parameter (default `true`) that drives the editor stub's `hasFocus()`. Three new shortcut cases run with the editor unfocused:
  - content mode in prose;
  - content mode at a guarded position with the plain fallback;
  - default mode in prose.

  None of them calls `preventDefault()` or inserts anything.

### 3. Documentation
- **`README.md`**: In Keyboard Shortcuts, the Standard Paste bullet says the shortcut is intercepted only while a note's editor has focus.
- **`CHANGELOG.md`**: A `Fixed` entry under `[Unreleased]`.

## Verification & Test Results

### Automated Tests
Ran `npm run build`, then `node test-paste-guard.js`:
- **The three unfocused cases: Passed.** With the `hasFocus()` check removed from the compiled `main.js`, all three fail, so the tests do detect the bug.
- **The five existing shortcut cases, and every position and settings case: Passed.** 85 checks in total, 0 failures.

### Regression Testing
- `node test-templates.js`: 79 checks, **Passed**.
- `node test-bplist.js`: 8 checks, **Passed**.

## Manual Verification
These were run in a test vault, with text copied from a web page in Chrome or Edge and the cursor in the note body.

| Step | Build | Field | Result |
| --- | --- | --- | --- |
| 1–2 | 1.4.0 | Settings → Citation Template box | The box got a normal paste and the note was unchanged, in both modes. **The bug did not reproduce here.** While Settings is open, Obsidian evidently doesn't report the note as the active editor. |
| — | 1.4.0 | Note title; find bar (Ctrl+F) | **Bug reproduced in both modes.** In *Default handler + source* mode, the field got the text and a citation was added to the body. In *Paste content + source* mode, the field got nothing and the text plus citation went into the body. |
| 3–4 | Fix | Note title; find bar | **Passed in both modes.** The field got a normal paste and the body was unchanged. |
| 5–6 | Fix | Body in Live Preview, in Source mode, and in a second split pane | **Passed in both modes.** In *Default handler + source* mode the paste was followed by its citation, and in *Paste content + source* mode the text appeared once with its citation. |

The plan's Settings-box steps were written from reading the code rather than from a reproduction. The fields that actually show the bug are the ones inside the note's own pane, where the note stays the active editor, so the note title and the find bar were tested in their place. The search box (Ctrl+Shift+F) was listed in step 4 but wasn't separately reported. It probably behaves like the Settings box, since it sits in its own pane.

## Follow-ups
- Obsidian's `editor-paste` event would also avoid this class of bug, but it doesn't say which key started the paste, so it can't honor the "Intercept Shortcut" setting. That remains out of scope.
