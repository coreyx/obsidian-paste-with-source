# Walkthrough: Preset Delete Reset

Deleting a custom preset now works the same as choosing the default preset from the dropdown. The Citation Template box shows Paste with Source's template, and a Slot B or C that held the deleted preset goes back to its default. Before, the box kept the deleted preset's text, which pastes went on using under the default preset's name. A slot that held the preset kept pointing at a preset that no longer existed.

## What Was Implemented

### 1. Settings (`main.ts`)
- **`PresetManager.withoutPreset(settings, presetId)`** (new): returns the settings changes for deleting a custom preset, without modifying `settings`:
  - `userPresets` without that preset
  - the default `selectedPresetId` and `templateString`, taken from `DEFAULT_SETTINGS`
  - `presetSlotB` and `presetSlotC` reset to their defaults if they held the deleted preset
- **Delete Preset handler**: it applies `withoutPreset` in place of its two old assignments, then saves and redraws as before.

### 2. Tests (`test-templates.ts`)
- **"Preset deletion"** (8 checks):
  - the preset is removed, and the other custom presets are kept
  - the default preset is selected, with its template in the box
  - Slot B and Slot C each go back to their default when they held the deleted preset, and are left alone when they held another one
  - the settings passed in aren't modified

### 3. Docs
- **`CHANGELOG.md`**: a `Fixed` entry under `[Unreleased]`.

### Commit type
`withoutPreset`'s commit was first typed `feat`. It only adds a helper, and that type would have made the next release a minor bump for what is a bug fix. The commit hadn't been pushed, so it was retyped `refactor` (`9338b9a`). The resulting tree was confirmed identical.

## Verification & Test Results

### Automated Tests
I ran `npm test`, which builds and runs every test file. **`test-templates.js`: Passed**, including the 8 new checks.

**Do the tests catch real bugs?** I broke two things on purpose:
- Leaving the template box alone failed "Deleting a preset puts the default preset's template in the template box".
- Leaving the slots alone failed "A Slot B that held the deleted preset goes back to its default".

My first run of these checks reported both as not caught. The cause was my script, not the tests: `test-templates.ts` prints failures to stderr, and the script only read stdout. Once it read stderr too, both were caught.

### Regression Testing
These passed unchanged:
- `test-paste-guard.js`
- `test-page-title.js`
- `test-windows-clipboard.js`
- `test-bplist.js`
- `test-deploy.js`

## Manual Verification
The user ran these in the test vault's plugin settings, and every step passed:

| Step | Check | Result |
| --- | --- | --- |
| 1 | Save a custom "Test Preset" and assign it to Preset Slot B | Passed |
| 2 | After Delete Preset, the dropdown shows Paste with Source and the box reads `From: {link} – {domain}` | Passed |
| 3 | Preset Slot B shows *Minimal Domain* | Passed |
| 4 | A paste uses Paste with Source | Passed |
| 5 | After reloading the plugin, steps 2 and 3 still hold | Passed |

## Follow-ups
- **The settings page scrolls to the top after Delete Preset.** It does the same after every action that redraws the page, such as the preset dropdown, Save As New, Update, Import JSON and the slot controls. That predates this fix, and the user noticed it during testing. It's planned as its own fix.
