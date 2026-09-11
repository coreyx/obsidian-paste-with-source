# Technology Architecture: Link Source Templates

This document details the technology stack, data models, template variable substitution engine, import/export formats, and architectural principles for the **Link Source Templates** feature in **Paste with Source**.

---

## 1. Architectural Philosophy: The "Bolted-On" Preset Model

A core design requirement is that presets are an **assistive convenience system bolted on top of a direct text editor**, rather than an opaque or restrictive configuration system.

```
+-------------------------------------------------------------------------+
|                       Obsidian Settings Storage                         |
|                                                                         |
|   settings.templateString  <── [AUTHORITATIVE SOURCE OF TRUTH]          |
|             │                                                           |
|             ▼                                                           |
|     TemplateEngine.render(templateString, context)                     |
|             │                                                           |
|             ▼                                                           |
|   Appended to Pasted Content in Editor                                  |
+-------------------------------------------------------------------------+
                               ▲
                 (loads into)  │  (saves from)
                               │
+──────────────────────────────┴──────────────────────────────────────────+
|                    Bolted-On Presets Subsystem                          |
|                                                                         |
|   Built-in Presets:                  User-Defined Presets:              |
|   - "OneNote"                        - "Academic Citation"              |
|   - "Markdown Quote"                 - "Clean URL Only"                 |
|                                      - Custom JSON Imports              |
|                                                                         |
|   Operations:                                                           |
|   [Apply to Textbox]  [Save As New]  [Update Preset]  [Delete]          |
|   [Export to JSON]    [Import from JSON]                                |
+─────────────────────────────────────────────────────────────────────────+
```

### Key Architectural Tenets
1. **The Text Box is Sovereign**: The plugin always evaluates `settings.templateString` at paste time. The active template is not bound to a preset ID. If a user modifies the text in the setting textarea, that exact text string is saved and used immediately.
2. **Presets as Templates for the Template**: Presets simply store and restore text strings into the authoritative textarea.
3. **Zero Mutation without User Action**: Selecting a preset replaces the textarea text with the preset's template. Editing the textarea does *not* automatically alter the preset definition unless the user explicitly clicks **"Update Preset"**.
4. **Built-In Preservation**: Built-in presets (OneNote and Markdown Quote) are immutable and cannot be deleted or overwritten.

---

## 2. Technology Stack Matrix

| Dimension | Component / Technology | Specification | Purpose / Role |
| :--- | :--- | :--- | :--- |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `^5.8.3` | Implementation of template parser, presets, and UI |
| **Compiler Target** | ECMAScript 2020 (`ES2020`) | Target: `ES2020`, Module: `CommonJS` | Compatibility with Obsidian runtime |
| **Template Engine** | In-Memory Token Interpolator | Custom Pure TypeScript Regex Engine | Fast, zero-dependency `{var}` string substitution |
| **External Dependencies** | *None* | Zero 3rd-party dependencies | No Handlebars, Mustache, or external compilers |
| **Host Application** | [Obsidian](https://obsidian.md) | Minimum App Version `0.15.0` | Desktop host runtime & UI components |
| **Persistence** | Obsidian Plugin Data API | `this.loadData()` / `this.saveData()` | Vault-local storage in `data.json` |
| **File Import / Export** | Browser Blob API & HTML5 File Input | `Blob`, `URL.createObjectURL()`, `<input type="file">` | Cross-platform JSON file download and upload |
| **Serialization** | JSON Schema | `paste-with-source-preset/v1` | Standardized transport format for preset sharing |

---

## 3. Template Variable Specification

The template engine scans the template string for `{variable_name}` placeholders (case-insensitive) and replaces them with contextual values extracted during the paste operation.

### 3.1 Variable Catalog

| Variable | Type | Description | Example Output |
| :--- | :--- | :--- | :--- |
| `{url}` | `string` | The complete, unescaped origin URL captured from clipboard | `https://en.wikipedia.org/wiki/Obsidian_(software)` |
| `{domain}` | `string` | Hostname / domain parsed from the URL (without `www.`) | `en.wikipedia.org` |
| `{title}` | `string` | Human-readable title (defaults to domain or path segment if unavailable) | `Obsidian (software)` |
| `{link}` | `string` | Markdown link formatting based on configured label preferences | `[en.wikipedia.org](https://en.wikipedia.org/...)` |
| `{source}` | `string` | Standardized label string (`"Source"`) | `Source` |
| `{date}` | `string` | Current local date in ISO standard format (`YYYY-MM-DD`) | `2026-09-11` |
| `{time}` | `string` | Current local time in 24-hour format (`HH:mm`) | `14:35` |
| `{time_12}` | `string` | Current local time in 12-hour format (`hh:mm a`) | `02:35 PM` |
| `{year}` | `string` | Current 4-digit calendar year (`YYYY`) | `2026` |
| `{month}` | `string` | Current 2-digit calendar month (`MM`) | `09` |
| `{day}` | `string` | Current 2-digit calendar day (`DD`) | `11` |
| `{datetime}` | `string` | Full local date and time (`YYYY-MM-DD HH:mm`) | `2026-09-11 14:35` |
| `{iso}` | `string` | Standard ISO-8601 UTC timestamp | `2026-09-11T21:35:00.000Z` |

### 3.2 Whitespace & Newline Mechanics
- **Literal Newlines**: Newlines entered in the Obsidian setting textarea are preserved verbatim.
- **Escape Sequences**: The engine parses `\n` and `\t` escape sequences if entered as literal text.
- **Leading/Trailing Padding**: Templates can specify exact spacing before or after citations (e.g. starting with two newlines `\n\n` to cleanly detach from pasted paragraph text).

---

## 4. Preset Architecture & Schema

### 4.1 In-Memory Data Structures

```typescript
export interface TemplatePreset {
  /** Unique stable identifier */
  id: string;
  /** Human-readable display name in dropdown */
  name: string;
  /** The raw template string containing {var} placeholders */
  template: string;
  /** True for system built-in presets (cannot be deleted or overwritten) */
  isBuiltIn?: boolean;
  /** Optional brief description of the citation style */
  description?: string;
}

export interface PasteWithSourceSettings {
  interceptPaste: boolean;
  interceptShortcut: "ctrl+v" | "shift+insert" | "both";
  pasteMode: "default+source" | "clipboard+source";
  useUrlAsLinkLabel: boolean;

  /** Authoritative active template string evaluated at paste time */
  templateString: string;

  /** ID of the most recently loaded preset (informational UI state only) */
  selectedPresetId: string;

  /** User-defined presets list */
  userPresets: TemplatePreset[];
}
```

### 4.2 Built-In Presets Specification

The system ships with two immutable built-in presets corresponding to the existing legacy styles:

1. **OneNote Preset (`builtin-onenote`)**:
   - **Name**: `OneNote Style`
   - **Template**:
     ```text
     \n\nFrom <{url}>
     ```
   - **Description**: Replicates Microsoft OneNote's classic web paste format.

2. **Markdown Quote Preset (`builtin-markdown-quote`)**:
   - **Name**: `Markdown Quote`
   - **Template**:
     ```text
     \n\n> — [Source]({url})
     ```
   - **Description**: Formats citations as a blockquoted markdown attribution link.

3. **Academic Reference Preset (`builtin-academic`)**:
   - **Name**: `Academic Citation`
   - **Template**:
     ```text
     \n\n> Source: [{domain}]({url}) (Accessed: {date})
     ```
   - **Description**: Includes origin domain and retrieval date.

---

## 5. Preset JSON Interchange Format

To enable seamless sharing across vaults, users, and community forums, presets can be exported and imported as standalone `.json` files.

### 5.1 JSON File Schema (`paste-with-source-preset/v1`)

```json
{
  "$schema": "https://paste-with-source.obsidian.md/schemas/preset-v1.json",
  "format": "paste-with-source-preset",
  "version": 1,
  "name": "Wikipedia Academic Citation",
  "description": "Clean citation with domain and access date",
  "template": "\n\n> Source: [{domain}]({url}) (Accessed: {date})",
  "createdAt": "2026-09-11T00:20:00.000Z"
}
```

### 5.2 Export Pipeline
- Serializes the selected preset (or the current active template) into the JSON format.
- Uses `new Blob([jsonText], { type: "application/json" })`.
- Dynamically creates an invisible `<a>` element with `download="preset-name.json"` and triggers `.click()`.
- Works identically across macOS, Windows, and Linux without native filesystem permissions.

### 5.3 Import Pipeline
- Dynamically injects a hidden `<input type="file" accept=".json">` into the DOM.
- On file selection, reads file contents via `FileReader` as text.
- Validates the JSON schema:
  - Must be valid JSON.
  - Must contain non-empty string `name`.
  - Must contain string `template`.
- Assigns a new unique `id` (`preset-${Date.now()}`).
- Appends to `settings.userPresets` and automatically sets the active template textarea to the imported template.

---

## 6. Migration Strategy & Backward Compatibility

Existing users have settings configured with:
```json
{
  "citationStyle": "OneNote",
  "useUrlAsLinkLabel": true
}
```

During `loadSettings()`:
1. If `templateString` is undefined in stored settings, evaluate legacy `citationStyle`:
   - If `citationStyle === "OneNote"`: set `templateString = "\n\nFrom <{link}>"` (or `\n\nFrom <{url}>` depending on `useUrlAsLinkLabel`).
   - If `citationStyle === "Source"`: set `templateString = "\n\n> — {link}"`.
   - Default `selectedPresetId` to `builtin-onenote` or `builtin-markdown-quote`.
2. Initialize `userPresets` to `[]` if not present.
3. Keep legacy properties (`citationStyle`) for backward compatibility with third-party sync or older plugin versions.
