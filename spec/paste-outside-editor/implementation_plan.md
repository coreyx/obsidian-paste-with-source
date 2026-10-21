---
status: approved
---

# Ignore the paste shortcut when the note's editor doesn't have focus

The keydown listener takes `workspace.activeEditor?.editor`. That property follows the active view, not keyboard focus, so Ctrl/Cmd+V or Shift+Insert typed into another field still targets the note behind it. The fields include the search box, the editor's find bar, and the plugin's own Citation Template box. In "Default handler + source" mode, the field gets the paste and then a citation is appended to the note. In "Paste content + source" mode, the field gets nothing and the note gets the paste. This change makes the listener return, untouched, unless that editor has focus.

**Related documents**
- [Paste context guard walkthrough](../paste-context-guard/walkthrough.md)

## User Review Required

> [!IMPORTANT]
> **The shortcut now acts only when the note's editor has keyboard focus.** Anywhere else, Ctrl/Cmd+V and Shift+Insert do exactly what they do with the plugin off. The check uses Obsidian's `Editor.hasFocus()`. If some editor surface reports no focus while you're typing in it, a paste there would get no citation. Manual step 6 checks the common surfaces.

> [!NOTE]
> **The explicit commands and the right-click menu are unchanged.** They act on the editor you invoked them from, so focus doesn't matter there.

> [!NOTE]
> **Not using Obsidian's `editor-paste` event.** It fires only for pastes into an editor, so it would also solve this. But it doesn't say which key started the paste, so the "Intercept Shortcut" setting would stop working. That's a larger redesign and out of scope here.

## Open Questions

None at this time.

## Proposed Changes

### Paste handling

#### [MODIFY] `main.ts`
- [x] **TASK-1:** In the keydown listener in `onload`, return right after the `editor` lookup when `!editor.hasFocus()`.
  - This runs before `canAddCitation` and before any `preventDefault()`, so a paste outside the editor is left entirely to Obsidian.
  - Extend the listener's TSDoc with one sentence on why: `activeEditor` follows the active view, not keyboard focus.

#### [MODIFY] `test-paste-guard.ts`
- [x] **TASK-2:** Give `pressPaste` a `focused` parameter, defaulting to `true`, that sets the editor stub's `hasFocus()`, and add three shortcut cases:
  - Content mode, prose, unfocused: no `preventDefault()`, nothing inserted.
  - Content mode, guarded position with the plain fallback, unfocused: no `preventDefault()`, nothing inserted.
  - Default mode, prose, unfocused: nothing inserted after the 50 ms timer.
  - The five existing cases keep passing unchanged, with the editor focused.

### Documentation

#### [MODIFY] `README.md` · [MODIFY] `CHANGELOG.md`
- [ ] **TASK-3:** Document the focus rule.
  - `README.md`, Keyboard Shortcuts: the Standard Paste bullet says the shortcut is intercepted only while a note's editor has focus, and that pastes into other fields are left alone.
  - `CHANGELOG.md`, under `[Unreleased]`: a `Fixed` entry saying that pasting into a search box, the find bar or a settings field no longer adds a citation to the open note or pastes into it.

## Verification Plan

### Automated Tests
`npm run build`, then `node test-paste-guard.js`. It verifies:
1. With the editor unfocused, neither mode calls `preventDefault()` or inserts anything, including at a guarded position with the plain fallback.
2. The five existing shortcut cases, and every position and settings case, still pass.

Regression: `node test-templates.js` and `node test-bplist.js` still pass.

### Manual Verification
In a test vault, with a note open and text copied from a web page in Chrome or Edge:

1. **On 1.4.0, before installing this build**, in "Default handler + source" mode:
   - Open Settings → Paste with Source, click in the Citation Template box, and press Ctrl/Cmd+V.
   - Expected bug: the text pastes into the box, and a citation is added to the note.
   - Record what happens in the walkthrough.
2. On 1.4.0, switch to "Paste content + source" and repeat step 1.
   - Expected bug: the box gets nothing, and the note gets the paste.
   - Record what happens.
3. Install this build and repeat steps 1 and 2. In both modes, the box gets a normal paste and the note is unchanged.
4. Paste into the search box (Ctrl/Cmd+Shift+F) and into the note's find bar (Ctrl/Cmd+F), in both modes. Each gets a normal paste, and the note is unchanged.
5. Click back into the note and paste in prose, in both modes. The citation is added as before.
6. Paste in prose in Live Preview, in Source mode, and in a note opened in a second pane. Each gets a citation.

## Visual design application
No UI changes.
