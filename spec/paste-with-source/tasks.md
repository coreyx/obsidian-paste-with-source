# Development Tasks: Paste with Source

This document contains a reverse-engineered development checklist detailing the concrete engineering steps required to construct the **Paste with Source** plugin. Each task cross-references the section, subsection numbers, and acceptance criteria defined in [requirements.md](../../spec/paste-with-source/requirements.md).

---

## Task Checklist Overview

- [x] **Task 1: Initialize Project Scaffolding and Node.js Configuration**
- [x] **Task 2: Develop Native Windows ClipboardReader Utility**
- [x] **Task 3: Build Multi-Target Build Automation Script (`build.ts`)**
- [x] **Task 4: Implement Subprocess IPC Bridge in Obsidian Plugin**
- [x] **Task 5: Implement Citation Formatting Engine**
- [x] **Task 6: Implement Core Editor Paste Handlers**
- [x] **Task 7: Implement Global Keystroke Paste Interception**
- [x] **Task 8: Implement Command Palette and Context Menu Integration**
- [x] **Task 9: Implement Settings UI Tab and Persistence Layer**
- [x] **Task 10: Implement Automated Vault Deployment Pipeline (`deploy.ts`)**
- [x] **Task 11: Shortcut Customization and Interception Refinements**

---

## Detailed Task Specifications

### Task 1: Initialize Project Scaffolding and Node.js Configuration
- **Status**: Completed
- **Implements**:
  - Requirement 7.0 (Build Automation and Packaging)
  - Section 7.1 (Multi-Target Compilation)
  - Section 7.3 (Plugin Manifest Specification)
  - Acceptance Criteria: **AC 7.1.1**, **AC 7.3.1**
- **Concrete Steps**:
  1. Create `package.json` specifying package name (`source-link`), version (`1.0.0`), scripts (`build`, `deploy`), and devDependencies (`@types/node`, `obsidian`, `ts-node`, `typescript`).
  2. Create `tsconfig.json` targeting `ES2020`, CommonJS modules (`module: "CommonJS"`), `strict: true`, and `outDir: "./"`.
  3. Create `manifest.json` defining metadata:
     - `id`: `"paste-with-source"`
     - `name`: `"Paste With Source"`
     - `version`: `"1.0.0"`
     - `minAppVersion`: `"0.15.0"`
     - `description`: `"Add source links when pasting content from the web."`
     - `main`: `"main.js"`
  4. Create `.gitignore` to exclude `node_modules`, `dist/`, `*.js`, `*.exe`, `*.dll`, and temporary build artifacts.

---

### Task 2: Develop Native Windows ClipboardReader Utility
- **Status**: Completed
- **Implements**:
  - Requirement 1.0 (Native Windows Clipboard URL Extraction)
  - Section 1.1 (Win32 Clipboard Format Detection & Retrieval)
  - Section 1.2 (`CF_HTML` Header Parsing)
  - Section 1.3 (Console Output Protocol & Process Exit Status)
  - Acceptance Criteria: **AC 1.1.1**, **AC 1.1.2**, **AC 1.1.3**, **AC 1.2.1**, **AC 1.2.2**, **AC 1.2.3**, **AC 1.3.1**, **AC 1.3.2**
- **Concrete Steps**:
  1. Create directory `ClipboardReader/` and define project file `ClipboardReader.csproj`:
     - Set `<OutputType>Exe</OutputType>`.
     - Set `<TargetFramework>net6.0-windows</TargetFramework>`.
     - Set `<UseWindowsForms>true</UseWindowsForms>` for clipboard API access.
  2. Implement `ClipboardReader/Program.cs`:
     - Annotate entry point `Main()` with `[STAThread]`.
     - Request HTML format data using `Clipboard.GetText(TextDataFormat.Html)`.
     - Check if string is null or empty; if so, print `"No HTML content in clipboard."` and exit with code `1`.
     - Use `System.IO.StringReader` to iterate lines.
     - Detect line starting with `"SourceURL:"`.
     - Extract URL payload via `line.Substring("SourceURL:".Length)`.
     - Output extracted URL via `Console.WriteLine()` and exit with code `0`.
     - If loop completes without matching `SourceURL:`, print `"SourceURL not found."` and exit with code `1`.
     - Wrap execution in `try / catch`, printing error message to `Console.Error` and exiting with code `1` on failure.

---

### Task 3: Build Multi-Target Build Automation Script (`build.ts`)
- **Status**: Completed
- **Implements**:
  - Requirement 7.0 (Build Automation and Packaging)
  - Section 7.1 (Multi-Target Compilation)
  - Section 7.2 (Artifact Assembly and Deployment)
  - Acceptance Criteria: **AC 7.1.1**, **AC 7.1.2**, **AC 7.2.1**
- **Concrete Steps**:
  1. Create `build.ts` utilizing Node.js `child_process.execSync`, `fs`, and `path`.
  2. Implement `buildPlugin()` to execute `tsc` and transpile `main.ts` to `main.js`.
  3. Implement `buildCSharp()` to execute `dotnet build "ClipboardReader/ClipboardReader.csproj" -c Release`.
  4. Implement `copyOutputs()` to:
     - Ensure plugin output directory exists.
     - Copy `main.js` and `manifest.json` into output directory.
     - Copy compiled `ClipboardReader.exe` from `ClipboardReader/bin/Release/net6.0-windows/` to output directory.
  5. Add npm script `"build": "ts-node build.ts"` to `package.json`.

---

### Task 4: Implement Subprocess IPC Bridge in Obsidian Plugin
- **Status**: Completed
- **Implements**:
  - Requirement 2.0 (Obsidian Inter-Process Communication Bridge)
  - Section 2.1 (Dynamic Executable Path Resolution)
  - Section 2.2 (Subprocess Invocation & Electron ASAR Handling)
  - Section 2.3 (URL Sanitization and Validation)
  - Acceptance Criteria: **AC 2.1.1**, **AC 2.1.2**, **AC 2.2.1**, **AC 2.2.2**, **AC 2.3.1**, **AC 2.3.2**, **AC 2.3.3**
- **Concrete Steps**:
  1. In `main.ts`, import `execFile` from `child_process` and `path` from `path`.
  2. Implement `getClipboardSourceUrl(): Promise<string>` in `PasteWithSourcePlugin`.
  3. Set `(process as any).noAsar = true` to prevent Electron ASAR resolution errors.
  4. Query `this.app.vault.adapter` to obtain the filesystem base path via `getBasePath()`.
  5. Construct the path to `.obsidian/plugins/paste-with-source/ClipboardReader.exe`.
  6. Execute binary via `execFile(exePath, [], (error, stdout, stderr) => ...)`.
  7. If error occurs, log to `console.error` and resolve `""`.
  8. If successful, trim `stdout` and verify `sourceUrl.startsWith("http")`.
  9. Resolve with verified URL or `""`.

---

### Task 5: Implement Citation Formatting Engine
- **Status**: Completed
- **Implements**:
  - Requirement 5.0 (Citation Formatting and Markdown Synthesis)
  - Section 5.1 (Citation Style Variations)
  - Section 5.2 (Link Anchor Label Formatting)
  - Section 5.3 (Spacing and Document Layout)
  - Acceptance Criteria: **AC 5.1.1**, **AC 5.1.2**, **AC 5.1.3**, **AC 5.1.4**, **AC 5.2.1**, **AC 5.2.2**
- **Concrete Steps**:
  1. Implement `formatSourceLink(url: string): string` in `PasteWithSourcePlugin`:
     - Return `[${url}](${url})` if `useUrlAsLinkLabel` is true.
     - Return `[Source](${url})` if `useUrlAsLinkLabel` is false.
  2. Implement `getSourceLinkMarkdown(url: string): string` in `PasteWithSourcePlugin`:
     - Return `\n\nFrom <${this.formatSourceLink(url)}>` if `citationStyle === "OneNote"`.
     - Return `\n\n> — ${this.formatSourceLink(url)}` if `citationStyle === "Source"`.
  3. Ensure citations prepend double newlines (`\n\n`) for clean separation.

---

### Task 6: Implement Core Editor Paste Handlers
- **Status**: Completed
- **Implements**:
  - Requirement 3.0 (Keyboard Shortcut Paste Interception)
  - Section 3.3 (Paste Mode Execution - Replace vs. Default)
  - Requirement 4.0 (Context Menu and Command Palette Integration)
  - Section 4.3 (Standalone Source URL Insertion)
  - Acceptance Criteria: **AC 3.3.1**, **AC 3.3.2**, **AC 4.3.1**, **AC 4.3.2**
- **Concrete Steps**:
  1. Implement `pasteWithSource(editor: Editor)`:
     - Read plain text via `await navigator.clipboard.readText()`.
     - Read URL via `await this.getClipboardSourceUrl()`.
     - Format link with `getSourceLinkMarkdown()`.
     - Replace editor selection via `editor.replaceSelection(clipboardText + sourceLink)`.
  2. Implement `pasteDefaultPlusSource(editor: Editor)`:
     - Query source URL via `await this.getClipboardSourceUrl()`.
     - If URL exists, invoke `setTimeout(() => editor.replaceSelection(this.getSourceLinkMarkdown(sourceUrl)), 50)`.
  3. Implement `pasteSourceOnly(editor: Editor)`:
     - Query source URL; if present, insert formatted link directly via `editor.replaceSelection(this.formatSourceLink(sourceUrl))`.
     - If missing, log warning `"No valid SourceURL found."`.

---

### Task 7: Implement Global Keystroke Paste Interception
- **Status**: Completed
- **Implements**:
  - Requirement 3.0 (Keyboard Shortcut Paste Interception)
  - Section 3.1 (Keystroke Detection & Platform Awareness)
  - Section 3.2 (Configurable Shortcut Filtering)
  - Section 3.3 (Paste Mode Execution - Replace vs. Default)
  - Acceptance Criteria: **AC 3.1.1**, **AC 3.1.2**, **AC 3.1.3**, **AC 3.1.4**, **AC 3.2.1**, **AC 3.2.2**, **AC 3.2.3**, **AC 3.3.1**, **AC 3.3.2**
- **Concrete Steps**:
  1. In `onload()`, register DOM event listener `this.registerDomEvent(document, "keydown", async (event: KeyboardEvent) => ...)`.
  2. Verify `this.settings.interceptPaste` is true; exit early if false.
  3. Detect platform via `navigator.platform.toUpperCase().includes("MAC")`.
  4. Evaluate shortcut flags:
     - `isCtrlV`: `(isMac && metaKey && key == 'v') || (!isMac && ctrlKey && key == 'v')`.
     - `isShiftInsert`: `!isMac && shiftKey && key == 'Insert'`.
  5. Check active editor availability (`this.app.workspace.activeEditor?.editor`).
  6. In `"clipboard+source"` mode: invoke `event.preventDefault()`, read clipboard text, append source link, replace selection.
  7. In `"default+source"` mode: let native event proceed, queue 50ms timeout to append citation link.

---

### Task 8: Implement Command Palette and Context Menu Integration
- **Status**: Completed
- **Implements**:
  - Requirement 4.0 (Context Menu and Command Palette Integration)
  - Section 4.1 (Editor Context Menu Registration)
  - Section 4.2 (Obsidian Command Palette Commands)
  - Acceptance Criteria: **AC 4.1.1**, **AC 4.1.2**, **AC 4.1.3**, **AC 4.1.4**, **AC 4.1.5**, **AC 4.2.1**, **AC 4.2.2**, **AC 4.2.3**
- **Concrete Steps**:
  1. In `onload()`, register command `paste-default-plus-source` ("Paste (Default) + Source URL").
  2. Register command `paste-with-source-url` ("Paste with Source URL").
  3. Register workspace event `this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => ...)`.
  4. Add context menu item `"Paste (Default Handler) + Source URL"` with icon `"clipboard"`.
  5. Add context menu item `"Paste Clipboard with Source URL"` with icon `"paste"`.

---

### Task 9: Implement Settings UI Tab and Persistence Layer
- **Status**: Completed
- **Implements**:
  - Requirement 6.0 (User Configuration & Settings Management)
  - Section 6.1 (Settings Tab Interface & Interactive Controls)
  - Section 6.2 (Settings Persistence & Defaults)
  - Acceptance Criteria: **AC 6.1.1**, **AC 6.1.2**, **AC 6.2.1**, **AC 6.2.2**
- **Concrete Steps**:
  1. Define type definitions: `InterceptShortcut`, `PasteMode`, `CitationStyle`.
  2. Define `interface PasteWithSourceSettings` and constant `DEFAULT_SETTINGS`.
  3. Implement `loadSettings()` and `saveSettings()` on `PasteWithSourcePlugin`.
  4. Create class `PasteWithSourceSettingTab` extending `PluginSettingTab`.
  5. Implement `display()`:
     - Clear container and append header `<h2>Paste with Source Settings</h2>`.
     - Add Toggle setting for `"Intercept Paste"`.
     - Add Dropdown setting for `"Paste Mode"` (`"default+source"`, `"clipboard+source"`).
     - Add Dropdown setting for `"Citation Style"` (`"OneNote"`, `"Source"`).
     - Add Toggle setting for `"Use URL as Link Label"`.
  6. In `onload()`, invoke `this.addSettingTab(new PasteWithSourceSettingTab(this))`.

---

### Task 10: Implement Automated Vault Deployment Pipeline (`deploy.ts`)
- **Status**: Completed
- **Implements**:
  - Requirement 7.0 (Build Automation and Packaging)
  - Section 7.2 (Artifact Assembly and Deployment)
  - Acceptance Criteria: **AC 7.2.2**
- **Concrete Steps**:
  1. Create `deploy.ts` using Node.js `fs` and `path`.
  2. Resolve target vault path from environment variables:
     `path.join(process.env.HOME || process.env.USERPROFILE || "", "Documents", "Obsidian Vault")`.
  3. Target `.obsidian/plugins/paste-with-source/`.
  4. Implement `copyRecursive(src, dest)` to mirror `dist/` directory contents into the vault plugin folder.
  5. Add npm script `"deploy": "ts-node deploy.ts"` to `package.json`.

---

### Task 11: Shortcut Customization and Interception Refinements
- **Status**: Completed (Commit `8da8660`)
- **Implements**:
  - Requirement 3.0 (Keyboard Shortcut Paste Interception)
  - Section 3.1 (Keystroke Detection & Platform Awareness)
  - Section 3.2 (Configurable Shortcut Filtering)
  - Requirement 6.0 (User Configuration & Settings Management)
  - Section 6.1 (Settings Tab Interface & Interactive Controls)
  - Acceptance Criteria: **AC 3.1.1**, **AC 3.2.1**, **AC 6.1.1**, **AC 6.2.1**
- **Concrete Steps**:
  1. Update `type InterceptShortcut = "ctrl+v" | "shift+insert" | "both"`.
  2. Add `interceptShortcut` to `PasteWithSourceSettings` interface.
  3. Change `DEFAULT_SETTINGS`: set `interceptPaste: true` and `interceptShortcut: "both"`.
  4. Update keydown listener logic:
     - Calculate `shouldIntercept`:
       - `(interceptShortcut === "both" && (isCtrlV || isShiftInsert))`
       - `(interceptShortcut === "ctrl+v" && isCtrlV)`
       - `(interceptShortcut === "shift+insert" && isShiftInsert)`
     - Skip interception if `shouldIntercept` is false.
  5. Update `PasteWithSourceSettingTab`:
     - Add Dropdown setting for `"Intercept Shortcut"` with options `"both"`, `"ctrl+v"`, and `"shift+insert"`.
     - Update descriptive text for `"Intercept Paste"` to `"Automatically replace paste operation with a source-aware paste"`.
     - Clarify `"Citation Style"` option description for `"Source"` as `"Simple 'Source' markdown link"`.
