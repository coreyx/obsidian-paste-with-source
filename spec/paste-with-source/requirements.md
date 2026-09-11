# Requirements Specification: Paste with Source

This document specifies the reverse-engineered requirements for the **Paste with Source** Obsidian plugin. Requirements are specified using the **EARS (Easy Approach to Requirements Syntax)** methodology along with agile user stories and numbered acceptance criteria.

---

## EARS Notation Reference
Requirements in this document follow standard EARS pattern structures:
- **Ubiquitous**: *The `<system>` shall `<response>`.*
- **Event-Driven**: *When `<trigger>`, the `<system>` shall `<response>`.*
- **State-Driven**: *While `<state>`, the `<system>` shall `<response>`.*
- **Optional Feature**: *Where `<feature/condition>`, the `<system>` shall `<response>`.*
- **Unwanted Behavior**: *If `<condition/error>`, then the `<system>` shall `<response>`.*
- **Complex / Composite**: *While `<state>`, when `<trigger>`, the `<system>` shall `<response>`.*

---

## 1.0 Native Windows Clipboard URL Extraction

### User Story
> **As an** Obsidian desktop user copying information from web browsers,  
> **I want** the system to automatically inspect rich clipboard content and extract the original webpage URL,  
> **So that** I do not have to manually switch back to the browser to copy and paste references.

### EARS Requirement Statement
- **Ubiquitous**: The `ClipboardReader` utility shall read the native Windows clipboard and parse the registered HTML clipboard format (`CF_HTML`) to identify source web URLs.
- **Event-Driven**: When `ClipboardReader.exe` is invoked, the `ClipboardReader` utility shall attempt to read `TextDataFormat.Html` from the system clipboard.
- **Unwanted Behavior**: If no HTML data exists in the clipboard, then the `ClipboardReader` utility shall print an error message to standard output and terminate with exit code `1`.
- **Unwanted Behavior**: If HTML data is present but does not contain a `SourceURL:` header, then the `ClipboardReader` utility shall output `"SourceURL not found."` and terminate with exit code `1`.

### Subsections and Acceptance Criteria

#### 1.1 Win32 Clipboard Format Detection & Retrieval
- **AC 1.1.1**: The helper binary shall execute inside a Single-Threaded Apartment (`[STAThread]`) to maintain compatibility with Win32 OLE/COM clipboard APIs.
- **AC 1.1.2**: The utility shall request `TextDataFormat.Html` via `System.Windows.Forms.Clipboard.GetText()`.
- **AC 1.1.3**: If the clipboard is unpopulated or contains plain text only, the process shall exit with non-zero status `1` and output `"No HTML content in clipboard."`.

#### 1.2 `CF_HTML` Header Parsing
- **AC 1.2.1**: The utility shall parse the raw HTML clipboard data stream line-by-line using `System.IO.StringReader`.
- **AC 1.2.2**: The parser shall evaluate whether any line begins with the exact prefix `SourceURL:`.
- **AC 1.2.3**: Upon finding `SourceURL:`, the parser shall extract the substring following the prefix and stop scanning subsequent lines.

#### 1.3 Console Output Protocol & Process Exit Status
- **AC 1.3.1**: On successfully locating a source URL, the utility shall print the extracted URL to `stdout` via `Console.WriteLine()` and exit with code `0`.
- **AC 1.3.2**: On unhandled runtime exceptions, the utility shall write the exception message to `stderr` (`Console.Error.WriteLine`) and exit with code `1`.

---

## 2.0 Obsidian Inter-Process Communication Bridge

### User Story
> **As an** Obsidian note-taker,  
> **I want** the plugin to query the native Windows clipboard utility asynchronously in the background,  
> **So that** my editor interface never hangs or stutters during paste operations.

### EARS Requirement Statement
- **Ubiquitous**: The `PasteWithSourcePlugin` shall provide an asynchronous method `getClipboardSourceUrl()` that spawns `ClipboardReader.exe` and returns a Promise resolving to a URL string.
- **Event-Driven**: When `getClipboardSourceUrl()` is called, the `PasteWithSourcePlugin` shall locate the executable in the vault's plugin directory and invoke it via Node.js `child_process.execFile`.
- **Unwanted Behavior**: If `ClipboardReader.exe` encounters an execution failure or exits with a non-zero code, then the `PasteWithSourcePlugin` shall log the error to the console and resolve with an empty string `""`.
- **Unwanted Behavior**: If the process stdout does not start with `"http"`, then the `PasteWithSourcePlugin` shall discard the value and resolve with `""`.

### Subsections and Acceptance Criteria

#### 2.1 Dynamic Executable Path Resolution
- **AC 2.1.1**: The plugin shall retrieve the vault root path using `this.app.vault.adapter.getBasePath()` when running on a `FileSystemAdapter`.
- **AC 2.1.2**: The plugin shall resolve the executable path to `.obsidian/plugins/paste-with-source/ClipboardReader.exe` relative to the vault root.

#### 2.2 Subprocess Invocation & Electron ASAR Handling
- **AC 2.2.1**: The plugin shall set `process.noAsar = true` prior to subprocess creation to ensure Electron does not treat the executable path as an ASAR archive.
- **AC 2.2.2**: The subprocess shall be launched asynchronously using `child_process.execFile` with no additional arguments.

#### 2.3 URL Sanitization and Validation
- **AC 2.3.1**: The plugin shall trim leading and trailing whitespace from the subprocess `stdout`.
- **AC 2.3.2**: The plugin shall verify that the trimmed output starts with `"http"` (accommodating `http://` and `https://`).
- **AC 2.3.3**: If the URL fails the prefix validation, the plugin shall resolve the promise to an empty string.

---

## 3.0 Keyboard Shortcut Paste Interception

### User Story
> **As a** user who relies on keyboard shortcuts,  
> **I want** my standard paste keystrokes (`Ctrl+V` or `Shift+Insert`) to automatically append source citations,  
> **So that** I do not have to learn new hotkeys or alter my muscle memory.

### EARS Requirement Statement
- **State-Driven**: While the `interceptPaste` setting is enabled (`true`), when the user triggers a registered paste keystroke in an active editor, the `PasteWithSourcePlugin` shall intercept the keystroke and append source citation metadata.
- **State-Driven**: While `interceptPaste` is disabled (`false`), when a paste keystroke is detected, the `PasteWithSourcePlugin` shall take no action and allow standard editor behavior.
- **Optional Feature**: Where `interceptShortcut` is set to `"ctrl+v"`, the system shall only intercept `Ctrl+V` (or `Cmd+V` on macOS).
- **Optional Feature**: Where `interceptShortcut` is set to `"shift+insert"`, the system shall only intercept `Shift+Insert`.
- **Optional Feature**: Where `interceptShortcut` is set to `"both"`, the system shall intercept either `Ctrl+V` or `Shift+Insert`.

### Subsections and Acceptance Criteria

#### 3.1 Keystroke Detection & Platform Awareness
- **AC 3.1.1**: The plugin shall register a global DOM `keydown` event listener using `this.registerDomEvent(document, "keydown", ...)`.
- **AC 3.1.2**: On macOS platforms (`navigator.platform` containing `"MAC"`), the plugin shall detect `Cmd+V` via `event.metaKey && event.key === "v"`.
- **AC 3.1.3**: On non-Mac platforms, the plugin shall detect `Ctrl+V` via `event.ctrlKey && event.key === "v"`.
- **AC 3.1.4**: On non-Mac platforms, the plugin shall detect `Shift+Insert` via `event.shiftKey && event.key === "Insert"`.

#### 3.2 Configurable Shortcut Filtering
- **AC 3.2.1**: The plugin shall evaluate `this.settings.interceptShortcut` against the detected key combination.
- **AC 3.2.2**: If the detected keystroke is not permitted by `interceptShortcut`, the event shall pass through unprocessed.
- **AC 3.2.3**: If there is no active markdown editor (`this.app.workspace.activeEditor?.editor`), the plugin shall terminate interception immediately.

#### 3.3 Paste Mode Execution - Replace vs. Default
- **AC 3.3.1**: When `pasteMode` is `"clipboard+source"`:
  - The plugin shall immediately prevent default event propagation via `event.preventDefault()`.
  - The plugin shall read plain text from the clipboard via `navigator.clipboard.readText()`.
  - The plugin shall retrieve the source URL and generate the citation markdown.
  - The plugin shall replace the current editor selection with `clipboardText + sourceLink`.
- **AC 3.3.2**: When `pasteMode` is `"default+source"`:
  - The plugin shall **not** call `event.preventDefault()`, allowing Obsidian's default rich paste handler to run.
  - The plugin shall query the source URL asynchronously.
  - After a 50ms delay (`setTimeout`), if a source URL exists, the plugin shall insert the citation markdown via `editor.replaceSelection()`.

---

## 4.0 Context Menu and Command Palette Integration

### User Story
> **As an** Obsidian user who uses menus and command palettes,  
> **I want** dedicated commands and context menu actions for source-aware pasting,  
> **So that** I can trigger source-aware paste operations explicitly on demand.

### EARS Requirement Statement
- **Ubiquitous**: The `PasteWithSourcePlugin` shall register source-aware paste commands into Obsidian's command palette.
- **Event-Driven**: When an editor context menu is displayed (`editor-menu` event), the `PasteWithSourcePlugin` shall add source-aware paste options to the context menu.

### Subsections and Acceptance Criteria

#### 4.1 Editor Context Menu Registration
- **AC 4.1.1**: The plugin shall register a handler for `this.app.workspace.on("editor-menu", ...)`.
- **AC 4.1.2**: The context menu shall display an item titled `"Paste (Default Handler) + Source URL"` with the icon `"clipboard"`.
- **AC 4.1.3**: Clicking `"Paste (Default Handler) + Source URL"` shall invoke `pasteDefaultPlusSource(editor)`.
- **AC 4.1.4**: The context menu shall display an item titled `"Paste Clipboard with Source URL"` with the icon `"paste"`.
- **AC 4.1.5**: Clicking `"Paste Clipboard with Source URL"` shall invoke `pasteWithSource(editor)`.

#### 4.2 Obsidian Command Palette Commands
- **AC 4.2.1**: The plugin shall register a command with ID `paste-default-plus-source` and display name `"Paste (Default) + Source URL"`.
- **AC 4.2.2**: The plugin shall register a command with ID `paste-with-source-url` and display name `"Paste with Source URL"`.
- **AC 4.2.3**: Each registered command shall safely verify the presence of an active editor before executing.

#### 4.3 Standalone Source URL Insertion
- **AC 4.3.1**: The plugin class shall provide a helper method `pasteSourceOnly(editor)` to insert only the source link into the editor.
- **AC 4.3.2**: If no valid source URL is found when `pasteSourceOnly` is called, the plugin shall log a warning `"No valid SourceURL found."` and make no modifications to the editor.

---

## 5.0 Citation Formatting and Markdown Synthesis

### User Story
> **As an** academic or personal knowledge base maintainer,  
> **I want** flexibility in how pasted citations are formatted (OneNote style vs Markdown quote, full URL vs label),  
> **So that** my generated notes adhere to my preferred formatting standards.

### EARS Requirement Statement
- **Optional Feature**: Where `citationStyle` is `"OneNote"`, the `PasteWithSourcePlugin` shall format citations using the OneNote format `\n\nFrom <{link}>`.
- **Optional Feature**: Where `citationStyle` is `"Source"`, the `PasteWithSourcePlugin` shall format citations using the blockquote format `\n\n> — {link}`.
- **Optional Feature**: Where `useUrlAsLinkLabel` is `true`, the `PasteWithSourcePlugin` shall render the link as `[{url}]({url})`.
- **Optional Feature**: Where `useUrlAsLinkLabel` is `false`, the `PasteWithSourcePlugin` shall render the link as `[Source]({url})`.

### Subsections and Acceptance Criteria

#### 5.1 Citation Style Variations
- **AC 5.1.1**: In `"OneNote"` mode with URL label enabled, a URL of `https://example.com` shall produce:
  ```markdown


  From <[https://example.com](https://example.com)>
  ```
- **AC 5.1.2**: In `"OneNote"` mode with URL label disabled, a URL of `https://example.com` shall produce:
  ```markdown


  From <[Source](https://example.com)>
  ```
- **AC 5.1.3**: In `"Source"` mode with URL label enabled, a URL of `https://example.com` shall produce:
  ```markdown


  > — [https://example.com](https://example.com)
  ```
- **AC 5.1.4**: In `"Source"` mode with URL label disabled, a URL of `https://example.com` shall produce:
  ```markdown


  > — [Source](https://example.com)
  ```

#### 5.2 Spacing and Document Layout
- **AC 5.2.1**: All generated citations shall be preceded by two newline characters (`\n\n`) to ensure separation from pasted body content.
- **AC 5.2.2**: If the retrieved source URL is empty (`""`), the generated citation string shall be completely empty (`""`), preventing extraneous blank lines.

---

## 6.0 User Configuration & Settings Management

### User Story
> **As an** Obsidian user,  
> **I want** a graphical settings panel to configure shortcut interception and citation preferences,  
> **So that** my configuration is saved across Obsidian sessions.

### EARS Requirement Statement
- **Ubiquitous**: The `PasteWithSourcePlugin` shall display a settings tab `PasteWithSourceSettingTab` inside Obsidian settings.
- **Event-Driven**: When any setting value is updated in the settings tab, the plugin shall persist the configuration to `data.json`.
- **State-Driven**: While no prior settings exist, the plugin shall initialize configuration with pre-defined defaults.

### Subsections and Acceptance Criteria

#### 6.1 Settings Tab Interface & Interactive Controls
- **AC 6.1.1**: The settings tab shall provide the following configuration controls:
  1. **Intercept Paste** (Toggle): Enables or disables keyboard paste interception.
  2. **Intercept Shortcut** (Dropdown): Selects between `"both"` ("Both Ctrl+V and Shift+Insert"), `"ctrl+v"` ("Ctrl+V only"), and `"shift+insert"` ("Shift+Insert only").
  3. **Paste Mode** (Dropdown): Selects between `"default+source"` ("Default handler + source") and `"clipboard+source"` ("Paste content + source").
  4. **Citation Style** (Dropdown): Selects between `"OneNote"` ("OneNote-style From <...> links") and `"Source"` ("Simple 'Source' markdown link").
  5. **Use URL as Link Label** (Toggle): Formats links as `[url](url)` when true, or `[Source](url)` when false.
- **AC 6.1.2**: Modifying any control in the UI shall immediately update `this.plugin.settings` and invoke `await this.plugin.saveSettings()`.

#### 6.2 Settings Persistence & Defaults
- **AC 6.2.1**: Default settings shall be defined as:
  ```typescript
  {
    interceptPaste: true,
    interceptShortcut: "both",
    pasteMode: "default+source",
    citationStyle: "OneNote",
    useUrlAsLinkLabel: true
  }
  ```
- **AC 6.2.2**: The plugin shall merge existing `data.json` content over `DEFAULT_SETTINGS` during `onload()`.

---

## 7.0 Build Automation and Distribution Packaging

### User Story
> **As a** developer maintaining the codebase,  
> **I want** single-command build and deployment automation,  
> **So that** TypeScript code and the C# native helper compile and bundle seamlessly into a working plugin.

### EARS Requirement Statement
- **Event-Driven**: When `npm run build` is executed, the build script `build.ts` shall compile TypeScript code, compile the C# .NET solution in Release configuration, and copy required distribution files to the plugin directory.
- **Event-Driven**: When `npm run deploy` is executed, the deploy script `deploy.ts` shall copy the plugin distribution into the user's Obsidian Vault.

### Subsections and Acceptance Criteria

#### 7.1 Multi-Target Compilation
- **AC 7.1.1**: Running `buildPlugin()` shall invoke `tsc` to compile `main.ts` into `main.js`.
- **AC 7.1.2**: Running `buildCSharp()` shall invoke `dotnet build ClipboardReader/ClipboardReader.csproj -c Release`.

#### 7.2 Artifact Assembly & Deployment
- **AC 7.2.1**: The build script shall copy `main.js`, `manifest.json`, and `ClipboardReader.exe` into the target plugin output directory.
- **AC 7.2.2**: `deploy.ts` shall detect the user's documents directory via `HOME` or `USERPROFILE` environment variables and copy artifacts to `Documents/Obsidian Vault/.obsidian/plugins/paste-with-source/`.

#### 7.3 Plugin Manifest Specification
- **AC 7.3.1**: `manifest.json` shall declare plugin ID `paste-with-source`, name `"Paste With Source"`, version `"1.0.0"`, and minimum app version `"0.15.0"`.
