# Requirements Specification: Windows Zero-Binary Update

This document specifies the reverse-engineered requirements for eliminating native compiled executables from the Windows implementation of **Paste with Source**, transitioning the plugin to a 100% in-process TypeScript architecture. Requirements are specified using the **EARS (Easy Approach to Requirements Syntax)** methodology, agile user stories, and numbered acceptance criteria.

---

## EARS Notation Reference
- **Ubiquitous**: *The `<system>` shall `<response>`.*
- **Event-Driven**: *When `<trigger>`, the `<system>` shall `<response>`.*
- **State-Driven**: *While `<state>`, the `<system>` shall `<response>`.*
- **Optional Feature**: *Where `<condition/feature>`, the `<system>` shall `<response>`.*
- **Unwanted Behavior**: *If `<error/condition>`, then the `<system>` shall `<response>`.*
- **Complex / Composite**: *While `<state>`, when `<trigger>`, the `<system>` shall `<response>`.*

---

## 1.0 In-Process Windows HTML Format Clipboard Ingestion

### User Story
> **As an** Obsidian Windows user,  
> **I want** the plugin to read raw clipboard HTML data in-process without launching external executables,  
> **So that** paste operations execute instantly without requiring the .NET runtime or triggering antivirus scans.

### EARS Requirement Statement
- **Ubiquitous**: The `WindowsClipboardProvider` shall query Electron's in-process clipboard API for the registered Windows `"HTML Format"` buffer.
- **Event-Driven**: When a source URL is requested on Windows, the provider shall attempt to retrieve the raw clipboard buffer using `clipboard.readBuffer("HTML Format")`.
- **Optional Feature**: Where `clipboard.readBuffer("HTML Format")` returns an empty buffer, the provider shall query the alias identifier `clipboard.readBuffer('electron application/osclipboard;format="HTML Format"')`.
- **Unwanted Behavior**: If no HTML buffer exists on the clipboard, then the provider shall attempt zero-binary fallback handling or resolve to an empty string `""`.

### Subsections and Acceptance Criteria

#### 1.1 Registered Format Identification
- **AC 1.1.1**: The provider shall target the Win32 registered clipboard format `"HTML Format"` (`CF_HTML`).
- **AC 1.1.2**: The provider shall execute inside the Obsidian desktop process using `require("electron").clipboard` without spawning any child processes.

#### 1.2 Electron Buffer Acquisition
- **AC 1.2.1**: The provider shall call `clipboard.readBuffer("HTML Format")` returning a Node.js `Buffer`.
- **AC 1.2.2**: If the returned buffer has a length of zero, the provider shall attempt retrieval via `'electron application/osclipboard;format="HTML Format"'`.

#### 1.3 Error Containment
- **AC 1.3.1**: Any exception thrown by Electron's clipboard module shall be caught and logged as a warning, safely resolving to an empty string without interrupting the editor paste action.

---

## 2.0 Windows `CF_HTML` Header Parsing & URL Extraction

### User Story
> **As a** researcher pasting web citations on Windows,  
> **I want** the plugin to accurately parse the `SourceURL:` field from the unstripped `CF_HTML` clipboard stream,  
> **So that** full web links are correctly extracted across all Windows web browsers.

### EARS Requirement Statement
- **Event-Driven**: When a non-empty `CF_HTML` buffer is acquired on Windows, the provider shall decode the byte stream into UTF-8 text and scan for the `SourceURL:` header.
- **State-Driven**: While evaluating the decoded buffer, the provider shall perform a case-insensitive regular expression match against `/SourceURL:(https?:\/\/[^\r\n]+)/i`.
- **Unwanted Behavior**: If the decoded buffer contains HTML markup but lacks a valid `SourceURL:` header, then the provider shall return `""`.

### Subsections and Acceptance Criteria

#### 2.1 UTF-8 Buffer Decoding
- **AC 2.1.1**: The buffer shall be decoded to string using UTF-8 character encoding (`buf.toString("utf8")`).
- **AC 2.1.2**: Decoding shall tolerate carriage-return line-feed (`\r\n`) and standalone line-feed (`\n`) newline conventions.

#### 2.2 Header Pattern Matching & URL Sanitization
- **AC 2.2.1**: The parser shall match the token `SourceURL:` followed by an HTTP or HTTPS web address.
- **AC 2.2.2**: The extracted URL shall be trimmed of leading and trailing whitespace.
- **AC 2.2.3**: The extracted URL shall be verified to begin with `"http://"` or `"https://"`.

---

## 3.0 Zero-Binary Fallback and Resilience Strategy

### User Story
> **As an** Obsidian user on Windows,  
> **I want** a resilient fallback mechanism if in-process buffer retrieval is temporarily unavailable,  
> **So that** source URL extraction continues to succeed without requiring pre-compiled third-party binaries.

### EARS Requirement Statement
- **Optional Feature**: Where in-process Electron buffer extraction returns empty, the provider shall execute an inline PowerShell command utilizing the OS-bundled `System.Windows.Forms.Clipboard` class as a secondary fallback.
- **Unwanted Behavior**: If the PowerShell fallback command fails, times out, or encounters execution policy restrictions, then the provider shall catch the error and resolve to `""` without crashing.

### Subsections and Acceptance Criteria

#### 3.1 Inline PowerShell Command Construction
- **AC 3.1.1**: The fallback shall invoke `powershell.exe` with `-NoProfile -Command`.
- **AC 3.1.2**: The script shall load `System.Windows.Forms` assembly and query `[System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::Html)`.
- **AC 3.1.3**: The script shall extract the matching `SourceURL` regex group and print to stdout.

#### 3.2 Subprocess Safety
- **AC 3.2.1**: The subprocess shall be launched asynchronously via `child_process.exec`.
- **AC 3.2.2**: A non-zero exit code or stderr output shall resolve gracefully to `""`.

---

## 4.0 Elimination of Native Companion Executable & Build Simplification

### User Story
> **As a** developer or user installing from source,  
> **I want** the plugin to build exclusively with TypeScript and contain no compiled binaries,  
> **So that** I do not need the .NET SDK or .NET Desktop Runtime installed on my system.

### EARS Requirement Statement
- **Ubiquitous**: The plugin distribution shall contain zero binary executables (`.exe`), zero dynamic link libraries (`.dll`), and zero .NET dependency files.
- **Event-Driven**: When `npm run build` is executed, the build script shall invoke `tsc` only, with no invocation of `dotnet build`.
- **Ubiquitous**: The `ClipboardReader/` source directory and references in `package.json` shall be decommissioned.

### Subsections and Acceptance Criteria

#### 4.1 Decommissioning of `ClipboardReader.exe`
- **AC 4.1.1**: `main.ts` shall not contain any references to `ClipboardReader.exe` or `(process as any).noAsar = true`.
- **AC 4.1.2**: The compiled distribution bundle (`dist/`) shall contain only `main.js` and `manifest.json`.

#### 4.2 Build Automation Streamlining
- **AC 4.2.1**: `build.ts` shall execute `tsc` and copy `main.js` and `manifest.json` to `dist/`.
- **AC 4.2.2**: `build.ts` shall contain zero checks for `dotnet` or C# project files.
- **AC 4.2.3**: `npm run build` shall complete in under 3 seconds on any platform.

#### 4.3 Clean Source Tree
- **AC 4.3.1**: The directory `ClipboardReader/` (`ClipboardReader.csproj`, `Program.cs`, `.gitignore`) shall be removed from the repository.
- **AC 4.3.2**: `.gitignore` shall be updated to remove .NET-specific patterns.

---

## 5.0 Cross-Platform Performance and Regression Parity

### User Story
> **As an** Obsidian user on Windows or macOS,  
> **I want** identical high-speed performance and citation formatting on both operating systems,  
> **So that** my note-taking experience is unified regardless of the machine I use.

### EARS Requirement Statement
- **Ubiquitous**: Source URL extraction on Windows shall execute in under 5 milliseconds.
- **Ubiquitous**: Citation formatting (OneNote style and Markdown blockquote style) shall produce identical output across Windows and macOS.
- **Ubiquitous**: The macOS provider implementation (`MacOSClipboardProvider`) shall suffer zero regressions from Windows changes.

### Subsections and Acceptance Criteria

#### 5.1 Sub-Millisecond Windows Latency
- **AC 5.1.1**: Normal in-process clipboard extraction on Windows shall execute in less than 5ms (compared to 30–60ms with `ClipboardReader.exe`).

#### 5.2 Citation Formatting Parity
- **AC 5.2.1**: Formatting for OneNote (`From <[url](url)>`) and Markdown (`> — [Source](url)`) shall remain byte-for-byte identical to existing behavior.
- **AC 5.2.2**: The 50ms delay in `default+source` mode and the atomic replacement in `clipboard+source` mode shall operate identically on Windows and macOS.
