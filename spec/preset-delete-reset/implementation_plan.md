---
status: approved
---

# Reset the template box and slots when a custom preset is deleted

**Delete Preset** removes the selected custom preset and selects the default preset, Paste with Source, but it leaves the deleted preset's text in the Citation Template box. That box is Slot A's template, so pastes keep using the deleted preset's text under the default preset's name. If the deleted preset was also assigned to Slot B or C, that slot keeps pointing at a preset that no longer exists. After this change, deleting a preset behaves as if you'd chosen the default preset from the dropdown: the box shows the default preset's template, and any slot that held the deleted preset goes back to its default.

## User Review Required

> [!IMPORTANT]
> **Deleting a preset replaces the text in the template box.** Any edits made in the box since the deleted preset was selected go with it. That's the same thing choosing another preset from the dropdown does today.

> [!NOTE]
> **Pastes from a slot don't change.** A Slot B or C pointing at a deleted preset already falls back to that slot's default when you paste. This change only corrects what's saved, so the stored setting matches what pastes and the Slot B and C dropdowns already show.

## Open Questions

None at this time.

## Proposed Changes

### Settings

#### [MODIFY] `main.ts`
- [x] **TASK-1:** Add `PresetManager.withoutPreset(settings, presetId)`, documented in TSDoc. It returns the settings changes for deleting a custom preset:
  - `userPresets` without that preset.
  - `selectedPresetId` and `templateString` set to the default preset's id and template, from `DEFAULT_SETTINGS`.
  - `presetSlotB` reset to `DEFAULT_SETTINGS.presetSlotB` if it named the deleted preset, and `presetSlotC` reset the same way.
  - It's a plain function of the settings, so it can be tested without the settings tab.
- [x] **TASK-2:** The settings tab's **Delete Preset** handler applies `withoutPreset` in place of its two assignments, then saves and redraws as before.

### Tests

#### [MODIFY] `test-templates.ts`
- [ ] **TASK-3:** Add "Preset deletion" checks for `withoutPreset`:
  - The preset is removed, and other custom presets are kept.
  - The default preset is selected, and the template box holds its template.
  - A Slot B or C holding the deleted preset goes back to its default.
  - A slot holding another preset is left alone.
  - The settings passed in aren't modified.

### Docs

#### [MODIFY] `CHANGELOG.md`
- [ ] **TASK-4:** Add a `Fixed` entry under `[Unreleased]`.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file. It verifies:
1. The preset deletion checks from TASK-3.
2. All other test files pass unchanged.

### Manual Verification
In the test vault, in the plugin's settings:
1. **Set up:** Type a template such as `\n\nVia {url}` into the Citation Template box, click **Save As New**, and name it "Test Preset". Set **Preset Slot B** to Test Preset.
2. **Delete:** With Test Preset selected, click **Delete Preset**. The dropdown shows **Paste with Source**, and the box reads `From: {link} – {domain}` after two blank lines.
3. **Slot B:** **Preset Slot B** shows *Minimal Domain*.
4. **Paste:** Paste from a web page. The citation uses Paste with Source.
5. **Reload:** Reload the plugin and reopen its settings. Steps 2 and 3 still hold.

## Visual design application
No new UI. Delete Preset's existing button and the existing dropdowns only show corrected values, so there is no design system to apply.
