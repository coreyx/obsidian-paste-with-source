# Development Tasks: Link Source Templates

This document provides a detailed implementation checklist for the **Link Source Templates** feature in **Paste with Source**. Each task specifies concrete technical steps and cross-references the requirements and acceptance criteria in [requirements.md](../../spec/link-source-templates/requirements.md).

---

## Task Checklist Overview

- [ ] **Task 1: Implement `TemplateEngine` with Context Generator and `{var}` Replacement**
- [ ] **Task 2: Define Built-In Presets (OneNote & Markdown Quote) and `PresetManager`**
- [ ] **Task 3: Migrate Plugin Settings Schema & Backward Compatibility Loader**
- [ ] **Task 4: Refactor Plugin Citation Generation Pipeline to use `TemplateEngine`**
- [ ] **Task 5: Implement `PresetImportExportService` (JSON File Export & Import)**
- [ ] **Task 6: Build Rich Settings UI (Dropdown, Action Toolbar, Textarea, Variable Badges, Live Preview)**
- [ ] **Task 7: Comprehensive Unit Testing & Benchmarking Suite (`test-templates.ts`)**
- [ ] **Task 8: Update Documentation Suite (`README.md`, `RELEASE_NOTES.md`, `CHANGELOG.md`)**

---

## Detailed Task Specifications

### Task 1: Implement `TemplateEngine` with Context Generator and `{var}` Replacement
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 1.0 (Template Variable Replacement Engine)
  - Section 1.1 (Supported Variable Identifiers)
  - Section 1.2 (Multi-Line and Escape Handling)
  - Acceptance Criteria: **AC 1.1.1** – **AC 1.1.9**, **AC 1.2.1**, **AC 1.2.2**
- **Concrete Steps**:
  1. In `main.ts` (or modular helper), define `TemplateContext` interface.
  2. Implement `TemplateEngine.buildContext(url: string, useUrlAsLinkLabel?: boolean): TemplateContext`:
     - Extract clean domain without `www.` via `extractDomain(url)`.
     - Compute formatted date (`YYYY-MM-DD`), 24h time (`HH:mm`), 12h time (`hh:mm a`), full datetime, and ISO string.
     - Compute `{link}` respecting `useUrlAsLinkLabel`.
     - Set `{source}` to `"Source"`.
  3. Implement `TemplateEngine.render(template: string, context: TemplateContext): string`:
     - Convert literal `\n` and `\t` escape sequences to actual characters.
     - Execute case-insensitive token replacement `/\{([a-zA-Z0-9_]+)\}/g`.
     - Preserve unmatched tokens untouched.
  4. Ensure zero external dependencies.

---

### Task 2: Define Built-In Presets (OneNote & Markdown Quote) and `PresetManager`
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 3.0 (Bolted-On Preset Management)
  - Requirement 4.0 (Built-in Preset Preservations)
  - Section 4.1 (OneNote Built-In Preset)
  - Section 4.2 (Markdown Quote Built-In Preset)
  - Acceptance Criteria: **AC 3.1.1**, **AC 4.1.1**, **AC 4.1.2**, **AC 4.2.1**, **AC 4.2.2**
- **Concrete Steps**:
  1. Define `TemplatePreset` interface (`id`, `name`, `template`, `isBuiltIn`, `description`).
  2. Create `PresetManager` with immutable `BUILTIN_PRESETS`:
     - `builtin-onenote`: `OneNote Style` -> `\n\nFrom <{link}>`
     - `builtin-markdown-quote`: `Markdown Quote` -> `\n\n> — [Source]({url})`
     - `builtin-academic`: `Academic Citation` -> `\n\n> Source: [{domain}]({url}) (Accessed: {date})`
  3. Implement `PresetManager.getAllPresets(userPresets)` combining built-in and user presets.
  4. Implement `PresetManager.getPresetById(id, userPresets)`.

---

### Task 3: Migrate Plugin Settings Schema & Backward Compatibility Loader
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 2.0 (Authoritative Active Template Text Box)
  - Requirement 6.0 (Backward Compatibility & Migration)
  - Section 6.1 (Automatic Migration)
  - Acceptance Criteria: **AC 2.1.3**, **AC 6.1.1** – **AC 6.1.4**
- **Concrete Steps**:
  1. Update `PasteWithSourceSettings` interface to add:
     - `templateString: string`
     - `selectedPresetId: string`
     - `userPresets: TemplatePreset[]`
  2. Update `DEFAULT_SETTINGS` with default OneNote template string.
  3. In `loadSettings()`:
     - Detect if `templateString` is missing from stored data.
     - If missing, migrate from legacy `citationStyle` (`"OneNote"` vs `"Source"`) and `useUrlAsLinkLabel` to corresponding template string.
     - Ensure `userPresets` defaults to empty array `[]`.

---

### Task 4: Refactor Plugin Citation Generation Pipeline to use `TemplateEngine`
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 1.0 (Template Variable Replacement Engine)
  - Requirement 2.0 (Authoritative Active Template Text Box)
  - Section 6.1 (Automatic Migration)
  - Acceptance Criteria: **AC 2.1.1**, **AC 6.1.5**
- **Concrete Steps**:
  1. Refactor `getSourceLinkMarkdown(url: string): string` in `PasteWithSourcePlugin`:
     - Call `TemplateEngine.buildContext(url, this.settings.useUrlAsLinkLabel)`.
     - Return `TemplateEngine.render(this.settings.templateString, context)`.
  2. Verify that `pasteWithSource`, `pasteDefaultPlusSource`, and keyboard interception invoke the refactored method.
  3. Verify that empty or missing URLs continue to resolve gracefully to empty string `""`.

---

### Task 5: Implement `PresetImportExportService` (JSON File Export & Import)
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 5.0 (Preset Import and Export)
  - Section 5.1 (JSON Export Specification)
  - Section 5.2 (JSON Import Specification)
  - Acceptance Criteria: **AC 5.1.1** – **AC 5.1.3**, **AC 5.2.1** – **AC 5.2.4**
- **Concrete Steps**:
  1. Implement `PresetImportExportService.exportPreset(preset: TemplatePreset): void`:
     - Serialize JSON with format header (`paste-with-source-preset`, version `1`).
     - Trigger browser download via dynamic `<a>` tag and `URL.createObjectURL(blob)`.
  2. Implement `PresetImportExportService.importPresetFromFile(file: File): Promise<TemplatePreset>`:
     - Parse JSON safely.
     - Validate presence of non-empty `template` string.
     - Assign unique ID (`user-preset-${Date.now()}`).
     - Display `new Notice()` confirmation on success or error notification on failure.

---

### Task 6: Build Rich Settings UI (Dropdown, Action Toolbar, Textarea, Variable Badges, Live Preview)
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 2.0 (Authoritative Active Template Text Box)
  - Requirement 3.0 (Bolted-On Preset Management)
  - Section 2.1 (Settings UI Text Area)
  - Section 2.2 (Live Preview & Interactive Variable Pills)
  - Section 3.1 (Preset Selection)
  - Section 3.2 (Preset Creation & Updates)
  - Section 3.3 (Preset Deletion)
  - Acceptance Criteria: **AC 2.1.1**, **AC 2.1.2**, **AC 2.2.1**, **AC 2.2.2**, **AC 3.1.1**, **AC 3.1.2**, **AC 3.2.1** – **AC 3.3.2**
- **Concrete Steps**:
  1. In `PasteWithSourceSettingTab.display()`:
     - Add Preset Selection Dropdown.
     - Add Preset Actions Toolbar:
       - `[Save As New Preset]`: Opens custom modal / prompt for preset name.
       - `[Update Preset]`: Updates selected custom preset (disabled for built-ins).
       - `[Delete Preset]`: Confirms and removes selected custom preset (disabled for built-ins).
       - `[Export JSON]`: Exports active preset.
       - `[Import JSON]`: Injects file input and imports JSON preset.
  2. Add Authoritative Template Text Area:
     - Multi-line textarea bound directly to `this.plugin.settings.templateString`.
     - Updates live preview on every keystroke (`input` event).
  3. Add Clickable Variable Badges:
     - Buttons for `{url}`, `{domain}`, `{title}`, `{date}`, `{time}`, `{datetime}`, `{link}`.
     - Clicking inserts variable tag at current cursor position in textarea.
  4. Add Dynamic Live Preview:
     - Real-time rendered citation box demonstrating output with sample URL data.

---

### Task 7: Comprehensive Unit Testing & Benchmarking Suite (`test-templates.ts`)
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 1.0 (Template Variable Replacement Engine)
  - Requirement 5.0 (Preset Import and Export)
  - Acceptance Criteria: **AC 1.1.1** – **AC 1.1.9**, **AC 1.2.1**, **AC 1.2.2**, **AC 5.1.1**, **AC 5.2.2**
- **Concrete Steps**:
  1. Create test runner `test-templates.ts`.
  2. Test variable substitutions:
     - `{url}`, `{domain}`, `{date}`, `{time}`, `{datetime}`, `{iso}`, `{link}`.
  3. Test edge cases:
     - Malformed URLs, unknown tokens, multi-line templates, escaped `\n`.
  4. Test JSON import/export validation (valid schemas, malformed JSON, missing fields).
  5. Run 10,000-iteration performance benchmark for `TemplateEngine.render()`.
  6. Verify script runs via `npx ts-node test-templates.ts`.

---

### Task 8: Update Documentation Suite (`README.md`, `RELEASE_NOTES.md`, `CHANGELOG.md`)
- **Status**: Ready for Execution
- **Implements**:
  - General Documentation & Feature Discoverability
- **Concrete Steps**:
  1. Update `README.md` with Link Source Templates documentation, variable reference table, and preset guide.
  2. Add `[1.3.0]` release notes to `RELEASE_NOTES.md` and `CHANGELOG.md`.
  3. Bump version in `manifest.json` and `package.json`.
