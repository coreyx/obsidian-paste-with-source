# Requirements Specification: Link Source Templates

This document specifies the requirements for the **Link Source Templates** feature in **Paste with Source**, enabling customizable `{var}`-style citation formats, preset management, JSON import/export, and an authoritative editable template text box. Requirements are defined using the **EARS (Easy Approach to Requirements Syntax)** methodology, agile user stories, and numbered acceptance criteria.

---

## EARS Notation Reference
- **Ubiquitous**: *The `<system>` shall `<response>`.*
- **Event-Driven**: *When `<trigger>`, the `<system>` shall `<response>`.*
- **State-Driven**: *While `<state>`, the `<system>` shall `<response>`.*
- **Optional Feature**: *Where `<condition/feature>`, the `<system>` shall `<response>`.*
- **Unwanted Behavior**: *If `<error/condition>`, then the `<system>` shall `<response>`.*
- **Complex / Composite**: *While `<state>`, when `<trigger>`, the `<system>` shall `<response>`.*

---

## 1.0 Template Variable Replacement Engine

### User Story
> **As a** knowledge worker pasting web citations into Obsidian,  
> **I want** to compose citation formats using `{variable}` placeholders (such as `{url}`, `{domain}`, and `{date}`),  
> **So that** my pasted citations automatically reflect my preferred markdown structure without manual editing.

### EARS Requirement Statement
- **Ubiquitous**: The `TemplateEngine` shall replace `{var}` tokens within the active template string using runtime values extracted from the clipboard and system environment.
- **Event-Driven**: When a paste operation occurs with a valid source URL, the engine shall resolve all known placeholders in the template string and return the interpolated citation markdown.
- **State-Driven**: While scanning for template variables, the parser shall evaluate token identifiers in a case-insensitive manner (e.g., `{url}`, `{URL}`, `{Url}`).
- **Unwanted Behavior**: If an unknown or malformed `{token}` is encountered in the template string, then the engine shall leave the token unchanged without throwing an error.

### Subsections and Acceptance Criteria

#### 1.1 Supported Variable Identifiers
- **AC 1.1.1**: The engine shall substitute `{url}` with the complete origin URL.
- **AC 1.1.2**: The engine shall substitute `{domain}` with the extracted hostname (e.g., `wikipedia.org`, omitting leading `www.`).
- **AC 1.1.3**: The engine shall substitute `{page}` with a human-readable page/article name derived from the URL path slug (e.g., `Obsidian (software)`), falling back to domain for root URLs.
- **AC 1.1.4**: The engine shall substitute `{path}` with the raw URL pathname (e.g., `/wiki/Obsidian_(software)`).
- **AC 1.1.5**: The engine shall substitute `{date}` with the current local date in `YYYY-MM-DD` format.
- **AC 1.1.6**: The engine shall substitute `{time}` with the current local 24-hour time in `HH:mm` format.
- **AC 1.1.7**: The engine shall substitute `{datetime}` with `YYYY-MM-DD HH:mm`.
- **AC 1.1.8**: The engine shall substitute `{iso}` with an ISO-8601 UTC timestamp string.
- **AC 1.1.9**: The engine shall substitute `{link}` with a markdown link formatted as `[{domain}]({url})` or `[{url}]({url})` based on user settings.

#### 1.2 Multi-Line and Escape Handling
- **AC 1.2.1**: Literal newline characters entered in the settings textarea shall be preserved in the rendered output.
- **AC 1.2.2**: String escape sequences `\n` and `\t` entered by users shall be converted to actual line breaks and tabs.

---

## 2.0 Authoritative Active Template Text Box

### User Story
> **As an** Obsidian user configuring my citations,  
> **I want** the editable template text box in settings to be the sole authoritative source of truth for my active citation format,  
> **So that** my edits are immediately used when pasting without being forced to manage or bind to a named preset.

### EARS Requirement Statement
- **Ubiquitous**: The plugin shall use `settings.templateString` as the single authoritative source of truth for all citation formatting.
- **Event-Driven**: When the user edits the template string in the settings text area, the plugin shall persist the updated string immediately to `data.json`.
- **State-Driven**: While the user is editing the template string in settings, the UI shall render a dynamic live preview showing how the citation will appear when pasted.
- **Optional Feature**: Where the user modifies the text area, the active template string shall be completely decoupled from any previously selected preset name.

### Subsections and Acceptance Criteria

#### 2.1 Settings UI Text Area
- **AC 2.1.1**: The settings tab shall provide a prominent, multi-line, monospace text area bound to `settings.templateString`.
- **AC 2.1.2**: The text area shall accept arbitrary markdown formatting and multi-line content.
- **AC 2.1.3**: Changes in the text area shall be persisted via `this.saveSettings()` on change or blur.

#### 2.2 Live Preview & Interactive Variable Pills
- **AC 2.2.1**: The settings tab shall display a live preview box below the text area demonstrating the rendered output using sample URL data.
- **AC 2.2.2**: The settings tab shall provide clickable variable badges/buttons (e.g., `+{url}`, `+{date}`, `+{domain}`) that append or insert the variable tag at the current cursor position in the text area.

---

## 3.0 Bolted-On Preset Management

### User Story
> **As an** Obsidian user who switches between writing academic notes and casual reading logs,  
> **I want** to select from a list of citation presets, save new presets, and update or delete my custom presets,  
> **So that** I can reuse complex citation templates without re-typing them.

### EARS Requirement Statement
- **Event-Driven**: When the user selects a preset from the preset dropdown, the system shall copy that preset's template string into the authoritative text area.
- **State-Driven**: While the text area content is modified, the system shall not mutate the stored preset definition unless the user explicitly triggers an update action.
- **Event-Driven**: When the user clicks "Save As New Preset", the system shall prompt for a preset name and save the current text area content as a new user preset.
- **Event-Driven**: When the user clicks "Update Preset", the system shall overwrite the currently selected user preset with the current text area content.
- **Event-Driven**: When the user clicks "Delete Preset", the system shall remove the selected user preset after user confirmation.
- **Unwanted Behavior**: If the user attempts to delete or overwrite a built-in system preset, then the system shall disable or reject the operation and notify the user.

### Subsections and Acceptance Criteria

#### 3.1 Preset Selection
- **AC 3.1.1**: The settings tab shall display a dropdown populated with built-in presets and user-created presets.
- **AC 3.1.2**: Selecting a preset shall update the textarea and live preview immediately without requiring a plugin reload.

#### 3.2 Preset Creation & Updates
- **AC 3.2.1**: Clicking "Save As New Preset" shall prompt the user for a non-empty name and generate a unique preset ID.
- **AC 3.2.2**: Clicking "Update Preset" on an active user preset shall update its stored template string and persist settings.
- **AC 3.2.3**: "Update Preset" and "Delete Preset" buttons shall be disabled or hidden when a built-in preset is active.

#### 3.3 Preset Deletion
- **AC 3.3.1**: Deleting a user preset shall remove it from `settings.userPresets` and update the dropdown.
- **AC 3.3.2**: Deleting a preset shall NOT clear the text area; the text area remains populated with the current template string.

---

## 4.0 Built-in Preset Preservations

### User Story
> **As an** existing user of Paste with Source,  
> **I want** the original OneNote style and Markdown quote style preserved as built-in presets,  
> **So that** I can easily revert to the classic behaviors at any time.

### EARS Requirement Statement
- **Ubiquitous**: The system shall provide immutable built-in presets: `OneNote Style`, `Italic Attribution`, `Minimal Domain`, `Parenthetical`, `Academic Citation`, `Obsidian Callout`, `Markdown Quote`, and `Raw URL`.
- **State-Driven**: Built-in presets shall have `isBuiltIn: true` and cannot be deleted, renamed, or overwritten.
- **Optional Feature**: Where a user customizes a built-in preset in the text area, they may save their changes as a new user preset without affecting the built-in preset.

### Subsections and Acceptance Criteria

#### 4.1 OneNote Built-In Preset
- **AC 4.1.1**: The OneNote preset shall have template string: `\n\nFrom <{url}>` (or `\n\nFrom <{link}>`).
- **AC 4.1.2**: The OneNote preset shall be identified by ID `builtin-onenote`.

#### 4.2 Markdown Quote Built-In Preset
- **AC 4.2.1**: The Markdown Quote preset shall have template string: `\n\n> — [Source]({url})` (or `\n\n> — {link}`).
- **AC 4.2.2**: The Markdown Quote preset shall be identified by ID `builtin-markdown-quote`.

---

## 5.0 Preset Import and Export

### User Story
> **As a** researcher or team member sharing Obsidian vaults,  
> **I want** to export presets as individual `.json` files and import presets created by others,  
> **So that** I can backup, share, and distribute custom citation styles.

### EARS Requirement Statement
- **Event-Driven**: When the user clicks "Export Preset", the system shall package the selected preset into a standardized JSON file and trigger a browser download.
- **Event-Driven**: When the user clicks "Import Preset", the system shall prompt the user to select a JSON file, validate the schema, and append the imported preset to `settings.userPresets`.
- **Unwanted Behavior**: If an imported file contains invalid JSON or missing required fields (`name`, `template`), then the system shall display an error notification and abort without modifying settings.

### Subsections and Acceptance Criteria

#### 5.1 JSON Export Specification
- **AC 5.1.1**: The exported JSON shall contain: `format`, `version`, `name`, `template`, `description`, and `createdAt`.
- **AC 5.1.2**: The downloaded file shall be named using the sanitized preset name (e.g., `citation-academic-v1.json`).
- **AC 5.1.3**: Export shall execute via Web Blob download without requiring desktop file system privileges.

#### 5.2 JSON Import Specification
- **AC 5.2.1**: The import interface shall accept `.json` files via an HTML `<input type="file">`.
- **AC 5.2.2**: The imported preset shall be assigned a new unique ID to avoid collisions with existing presets.
- **AC 5.2.3**: Upon successful import, the imported preset shall be added to `userPresets`, selected in the dropdown, and loaded into the authoritative text area.
- **AC 5.2.4**: A confirmation notification (`new Notice("Preset imported successfully")`) shall alert the user.

---

## 6.0 Backward Compatibility & Migration

### User Story
> **As an** existing user upgrading to the new template version,  
> **I want** my existing citation style and link preferences automatically migrated to the new template system,  
> **So that** my paste workflow continues functioning seamlessly without manual reconfiguration.

### EARS Requirement Statement
- **Event-Driven**: When the plugin initializes, if `settings.templateString` is not present, the system shall construct an initial `templateString` reflecting the legacy `settings.citationStyle` and `settings.useUrlAsLinkLabel`.
- **State-Driven**: Existing legacy settings attributes shall be maintained in memory to prevent breaking existing third-party integrations or vault synchronization.

### Subsections and Acceptance Criteria

#### 6.1 Automatic Migration
- **AC 6.1.1**: If legacy `citationStyle === "OneNote"` and `useUrlAsLinkLabel === true`, migrate to `\n\nFrom <{url}>`.
- **AC 6.1.2**: If legacy `citationStyle === "OneNote"` and `useUrlAsLinkLabel === false`, migrate to `\n\nFrom <[Source]({url})>`.
- **AC 6.1.3**: If legacy `citationStyle === "Source"` and `useUrlAsLinkLabel === true`, migrate to `\n\n> — [{url}]({url})`.
- **AC 6.1.4**: If legacy `citationStyle === "Source"` and `useUrlAsLinkLabel === false`, migrate to `\n\n> — [Source]({url})`.
- **AC 6.1.5**: Legacy commands (`Paste (Default) + Source URL`, `Paste with Source URL`) shall utilize the new `templateString` evaluation engine.
