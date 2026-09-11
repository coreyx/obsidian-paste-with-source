# Requirements Specification: macOS Support Feature

This document specifies the reverse-engineered requirements for introducing native macOS support to the **Paste with Source** Obsidian plugin. Requirements are formatted using the **EARS (Easy Approach to Requirements Syntax)** methodology, agile user stories, and numbered acceptance criteria.

---

## EARS Notation Reference
- **Ubiquitous**: *The `<system>` shall `<response>`.*
- **Event-Driven**: *When `<trigger>`, the `<system>` shall `<response>`.*
- **State-Driven**: *While `<state>`, the `<system>` shall `<response>`.*
- **Optional Feature**: *Where `<condition/feature>`, the `<system>` shall `<response>`.*
- **Unwanted Behavior**: *If `<error/condition>`, then the `<system>` shall `<response>`.*
- **Complex / Composite**: *While `<state>`, when `<trigger>`, the `<system>` shall `<response>`.*

---

## 1.0 Operating System Detection and Provider Routing

### User Story
> **As an** Obsidian user on macOS or Windows,  
> **I want** the plugin to automatically detect my operating system and select the appropriate clipboard extraction strategy,  
> **So that** the plugin functions correctly on my operating system without manual environment configuration.

### EARS Requirement Statement
- **Ubiquitous**: The `PasteWithSourcePlugin` shall query the host environment platform (`process.platform`) to determine clipboard provider delegation.
- **State-Driven**: While running on macOS (`process.platform === "darwin"`), the plugin shall route clipboard retrieval requests to `MacOSClipboardProvider`.
- **State-Driven**: While running on Windows (`process.platform === "win32"`), the plugin shall route clipboard retrieval requests to `WindowsClipboardProvider` (`ClipboardReader.exe`).
- **Unwanted Behavior**: If running on an unsupported operating system (such as Linux or mobile runtimes), then the plugin shall return an empty source URL string `""` without throwing runtime exceptions.

### Subsections and Acceptance Criteria

#### 1.1 Platform Runtime Detection
- **AC 1.1.1**: The plugin shall evaluate `process.platform` during initialization to select the active clipboard provider.
- **AC 1.1.2**: On Darwin/macOS systems, the plugin shall instantiate `MacOSClipboardProvider` and not attempt to execute `ClipboardReader.exe`.

#### 1.2 Provider Dispatch Abstraction
- **AC 1.2.1**: Both Windows and macOS clipboard implementations shall conform to a shared asynchronous interface `IClipboardSourceProvider` with signature `getSourceUrl(): Promise<string>`.
- **AC 1.2.2**: The core pasting and citation formatting pipeline shall depend exclusively on `IClipboardSourceProvider`, decoupling citation logic from OS-specific clipboard details.

#### 1.3 Windows Backward Compatibility Preservation
- **AC 1.3.1**: The introduction of macOS provider routing shall introduce zero regressions to existing Windows functionality.
- **AC 1.3.2**: When running on Windows, all existing `ClipboardReader.exe` behaviors, arguments, and exit code handlings shall remain intact.

---

## 2.0 Chromium Browser Source URL Extraction on macOS

### User Story
> **As a** macOS user copying information from Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Arc, Opera, Vivaldi),  
> **I want** the plugin to extract the origin URL from the `org.chromium.source-url` pasteboard type,  
> **So that** pasted snippets from Chromium browsers automatically include source links.

### EARS Requirement Statement
- **Event-Driven**: When a source URL is requested on macOS, the `MacOSClipboardProvider` shall query the Electron clipboard API for the `"org.chromium.source-url"` pasteboard type.
- **Event-Driven**: When `"org.chromium.source-url"` data is retrieved and starts with `"http"`, the provider shall return the trimmed URL string.
- **Unwanted Behavior**: If `"org.chromium.source-url"` is absent, empty, or fails URL prefix validation, then the provider shall fall through to Safari WebArchive inspection.

### Subsections and Acceptance Criteria

#### 2.1 In-Process Electron Clipboard Access
- **AC 2.1.1**: The provider shall access Electron's clipboard via `require("electron").clipboard` without spawning any child processes.
- **AC 2.1.2**: The provider shall call `clipboard.read("org.chromium.source-url")` to retrieve the origin URL as a string.

#### 2.2 String Sanitization and URL Validation
- **AC 2.2.1**: The returned string shall have leading and trailing whitespace trimmed.
- **AC 2.2.2**: The string shall be validated to confirm it begins with `"http://"` or `"https://"`.
- **AC 2.2.3**: If the string passes validation, it shall be returned immediately without querying subsequent fallback formats.

---

## 3.0 Safari WebKit WebArchive Property List Decoding

### User Story
> **As a** macOS user researching in Apple Safari,  
> **I want** the plugin to decode the `com.apple.webarchive` clipboard data to extract `WebResourceURL`,  
> **So that** content copied from Safari generates the correct source citation.

### EARS Requirement Statement
- **Event-Driven**: When `"org.chromium.source-url"` is not present on macOS, the `MacOSClipboardProvider` shall inspect the clipboard for the `"com.apple.webarchive"` pasteboard type.
- **State-Driven**: While `"com.apple.webarchive"` binary data is available, the provider shall parse the binary property list (`bplist00`) to extract the `WebResourceURL` key from the `WebMainResource` dictionary.
- **Unwanted Behavior**: If the `com.apple.webarchive` buffer is missing, malformed, or does not contain `WebResourceURL`, then the provider shall fall through to `public.url` inspection or return an empty string.

### Subsections and Acceptance Criteria

#### 3.1 WebArchive Buffer Retrieval
- **AC 3.1.1**: The provider shall request the binary buffer from Electron using `clipboard.readBuffer("com.apple.webarchive")`.
- **AC 3.1.2**: If the returned buffer is empty or shorter than the 8-byte magic header, parsing shall abort safely.

#### 3.2 Binary Property List (`bplist00`) Parsing
- **AC 3.2.1**: The parser shall verify that the first 8 bytes match the ASCII signature `bplist00`.
- **AC 3.2.2**: The parser shall read the 32-byte trailer at the end of the buffer to locate the offset table, object count, and root object index.
- **AC 3.2.3**: The parser shall traverse the root dictionary to locate the child dictionary named `"WebMainResource"`.
- **AC 3.2.4**: The parser shall traverse the `"WebMainResource"` dictionary to locate the string entry keyed by `"WebResourceURL"`.

#### 3.3 Extracted Safari URL Validation
- **AC 3.3.1**: The extracted `WebResourceURL` shall be converted into a standard UTF-8 JavaScript string.
- **AC 3.3.2**: The URL string shall be trimmed and verified to start with `"http"`.
- **AC 3.3.3**: Any internal decoding exception or parse failure shall be caught, logged as a warning, and safely resolve to an empty string `""` without crashing the plugin.

---

## 4.0 macOS Keyboard Shortcut Interception & Keybindings

### User Story
> **As a** Mac user,  
> **I want** standard macOS paste shortcuts (`Cmd+V`) to trigger source-aware paste operations,  
> **So that** I do not have to press Windows-style `Ctrl+V` or configure custom hotkeys.

### EARS Requirement Statement
- **State-Driven**: While running on macOS and `interceptPaste` is enabled, when the user presses `Cmd+V` in an active markdown editor, the plugin shall intercept the paste event.
- **State-Driven**: While running on macOS, the plugin shall ignore the `Shift+Insert` keystroke (which is non-standard on macOS keyboards).
- **Optional Feature**: Where `interceptShortcut` is set to `"cmd+v"` or `"both"`, `Cmd+V` shall be intercepted on macOS.

### Subsections and Acceptance Criteria

#### 4.1 Native `Cmd+V` Keystroke Recognition
- **AC 4.1.1**: On macOS, a paste keystroke shall be detected when `event.metaKey === true && event.key.toLowerCase() === "v"`.
- **AC 4.1.2**: Keystrokes with `event.ctrlKey` shall **not** trigger paste interception on macOS unless explicitly mapped.
- **AC 4.1.3**: The keystroke interception handler shall operate consistently across both `default+source` and `clipboard+source` paste modes.

#### 4.2 Shortcut Mode Filtering on macOS
- **AC 4.2.1**: When running on macOS, the shortcut filtering logic shall evaluate `Cmd+V` against the active `interceptShortcut` setting.
- **AC 4.2.2**: If the user has disabled paste interception (`interceptPaste === false`), `Cmd+V` shall execute standard Obsidian editor paste.

---

## 5.0 Plugin Configuration, Settings UI & Manifest Compliance

### User Story
> **As a** Mac user opening plugin settings,  
> **I want** the configuration options to display Mac-appropriate terminology (e.g., `Cmd+V` instead of `Ctrl+V`),  
> **So that** the settings tab feels native to the macOS desktop.

### EARS Requirement Statement
- **Ubiquitous**: The plugin manifest `manifest.json` shall declare `"isDesktopOnly": true` to permit Node.js and Electron clipboard usage.
- **State-Driven**: While rendering the settings tab on macOS, the plugin shall display `"Cmd+V"` instead of `"Ctrl+V"` in shortcut descriptions and options.

### Subsections and Acceptance Criteria

#### 5.1 Desktop Only Manifest Declaration
- **AC 5.1.1**: `manifest.json` shall include `"isDesktopOnly": true`.
- **AC 5.1.2**: Attempting to load the plugin on Obsidian Mobile shall be prevented by Obsidian's community plugin loader.

#### 5.2 Dynamic Settings UI Adaptation
- **AC 5.2.1**: The setting description for `"Intercept Shortcut"` shall dynamically display `"Cmd+V"` when `Platform.isMacOS` is true, and `"Ctrl+V"` when false.
- **AC 5.2.2**: The dropdown option labels shall adapt:
  - macOS: `"Cmd+V only"`
  - Windows: `"Ctrl+V only"`
  - Shared: `"Both Cmd+V and Shift+Insert"` (or platform-specific equivalent).

#### 5.3 Build Pipeline Platform Agnosticism
- **AC 5.3.1**: `build.ts` shall detect whether `dotnet` is available or if running on macOS, compiling `main.ts` successfully even when .NET build tools are not present on the host Mac.
