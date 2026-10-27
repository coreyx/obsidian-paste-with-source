---
status: approved
---

# Keep the settings page's scroll position when it redraws

Several settings actions redraw the whole settings page by calling `display()`. That empties the page and rebuilds it, so it jumps back to the top. The page scrolls in Obsidian's `.vertical-tab-content` element, which is the tab's `containerEl`. This change adds a `redraw()` that saves that element's scroll position, rebuilds the page, and restores it. The plugin's own redraws use it. Opening the settings tab still starts at the top, because Obsidian calls `display()` directly for that.

## User Review Required

> [!NOTE]
> **These actions keep the scroll position:**
> - choosing a preset from **Template Preset**
> - **Save As New**
> - **Update Preset**
> - **Delete Preset**
> - **Import JSON**
> - **Active Preset Slot**, **Preset Slot B** and **Preset Slot C**
> - switching slots with the Ctrl+Alt+A/B/C hotkeys while the settings are open
>
> When a redraw makes the page shorter, the browser limits the restored position to what still exists.

## Open Questions

None at this time.

## Proposed Changes

### Settings tab

#### [MODIFY] `main.ts`
- [x] **TASK-1:** Add `redraw()` to `PasteWithSourceSettingTab`, documented in TSDoc. It reads `containerEl.scrollTop`, calls `display()`, then sets `scrollTop` back. Its TSDoc says why it's separate from `display()`: Obsidian calls `display()` to open the tab, and that should start at the top.
- [x] **TASK-2:** Replace every `this.display()` inside the settings tab with `this.redraw()`. In `switchToSlot`, replace `this.settingTab.display()` with `this.settingTab.redraw()`.

### Tests

#### [MODIFY] `test-templates.ts`
- [x] **TASK-3:** Add a "Settings redraw" check. It uses a settings tab whose `display()` is stubbed to reset a fake `containerEl.scrollTop` to 0, and checks two things:
  - `redraw()` brings back the earlier position.
  - `switchToSlot` keeps it too.

### Docs

#### [MODIFY] `CHANGELOG.md`
- [ ] **TASK-4:** Add a `Fixed` entry under `[Unreleased]`.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file. It verifies:
1. The redraw check from TASK-3.
2. All other test files pass unchanged.

### Manual Verification
In the test vault, open the plugin's settings and scroll down to **Template Preset**:
1. **Dropdown:** Choose another preset. The page stays where it was.
2. **Delete:** Save a custom preset with **Save As New**, then click **Delete Preset**. The page stays where it was after each.
3. **Slots:** Scroll to the bottom and change **Preset Slot B**. The page stays at the bottom.
4. **Opening:** Close the settings and open them again. The page starts at the top.

## Visual design application
No visual changes. Existing settings controls only stop jumping, so there is no design system to apply.
