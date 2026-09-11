# Development Tasks: Windows Zero-Binary Architecture

This document provides a reverse-engineered implementation checklist for eliminating the native compiled binary from the Windows pathway in **Paste with Source**. Each task specifies concrete technical steps and cross-references the section, subsection numbers, and acceptance criteria in [requirements.md](../../spec/windows-zero-binary/requirements.md).

---

## Task Checklist Overview

- [x] **Task 1: Refactor `WindowsClipboardProvider` for In-Process `readBuffer("HTML Format")`**
- [x] **Task 2: Implement Inline PowerShell CLI Resilience Fallback**
- [x] **Task 3: Decouple Provider Factory from Vault Filesystem Path**
- [x] **Task 4: Streamline Build Pipeline (`build.ts`) to Pure TypeScript**
- [x] **Task 5: Decommission and Remove Legacy C# Source Tree (`ClipboardReader/`)**
- [x] **Task 6: Update Automated Vault Deployment Script (`deploy.ts`)**
- [x] **Task 7: In-Process Validation and Performance Benchmarking on Windows**
- [x] **Task 8: Update Documentation Suite (`README.md`, `RELEASE_NOTES.md`, `CHANGELOG.md`)**

---

## Detailed Task Specifications

### Task 1: Refactor `WindowsClipboardProvider` for In-Process `readBuffer("HTML Format")`
- **Status**: Completed
- **Implements**:
  - Requirement 1.0 (In-Process Windows HTML Format Clipboard Ingestion)
  - Section 1.1 (Registered Format Identification)
  - Section 1.2 (Electron Buffer Acquisition)
  - Section 1.3 (Error Containment)
  - Requirement 2.0 (Windows `CF_HTML` Header Parsing & URL Extraction)
  - Section 2.1 (UTF-8 Buffer Decoding)
  - Section 2.2 (Header Pattern Matching & URL Sanitization)
  - Acceptance Criteria: **AC 1.1.1**, **AC 1.1.2**, **AC 1.2.1**, **AC 1.2.2**, **AC 1.3.1**, **AC 2.1.1**, **AC 2.1.2**, **AC 2.2.1**, **AC 2.2.2**, **AC 2.2.3**
- **Concrete Steps**:
  1. In `main.ts`, update `WindowsClipboardProvider`:
     - Obtain Electron clipboard via `(window as any).require ? (window as any).require("electron").clipboard : require("electron").clipboard`.
     - Call `electron.clipboard.readBuffer("HTML Format")`.
     - If buffer is empty, call `electron.clipboard.readBuffer('electron application/osclipboard;format="HTML Format"')`.
  2. Implement `parseSourceUrlFromBuffer(buf: Buffer): string`:
     - Convert buffer to UTF-8 text using `buf.toString("utf8")`.
     - Execute regular expression match: `const match = text.match(/SourceURL:(https?:\/\/[^\r\n]+)/i)`.
     - Return trimmed URL string if match succeeds, else return `""`.
  3. Wrap in `try / catch` to ensure clipboard errors never crash the editor.

---

### Task 2: Implement Inline PowerShell CLI Resilience Fallback
- **Status**: Completed
- **Implements**:
  - Requirement 3.0 (Zero-Binary Fallback and Resilience Strategy)
  - Section 3.1 (Inline PowerShell Command Construction)
  - Section 3.2 (Subprocess Safety)
  - Acceptance Criteria: **AC 3.1.1**, **AC 3.1.2**, **AC 3.1.3**, **AC 3.2.1**, **AC 3.2.2**
- **Concrete Steps**:
  1. Add private method `executePowerShellFallback(): Promise<string>` to `WindowsClipboardProvider`.
  2. If in-process Electron buffer extraction returns an empty URL, invoke the fallback.
  3. Execute via Node.js `child_process.exec`:
     ```powershell
     powershell.exe -NoProfile -NonInteractive -Command "Add-Type -AssemblyName System.Windows.Forms; $h = [System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::Html); if ($h -match 'SourceURL:(https?://[^\r\n]+)') { $matches[1] }"
     ```
  4. Trim output, verify `startsWith("http")`, and resolve safely.

---

### Task 3: Decouple Provider Factory from Vault Filesystem Path
- **Status**: Completed
- **Implements**:
  - Requirement 4.0 (Elimination of Native Companion Executable & Build Simplification)
  - Section 4.1 (Decommissioning of `ClipboardReader.exe`)
  - Acceptance Criteria: **AC 4.1.1**
- **Concrete Steps**:
  1. Remove `app: App` parameter from `WindowsClipboardProvider` constructor.
  2. Update `createClipboardProvider()` signature to take zero arguments.
  3. Remove `FileSystemAdapter` and `getBasePath()` lookups from clipboard provider creation in `onload()`.
  4. Remove `(process as any).noAsar = true` and `path.join(basePath, ..., "ClipboardReader.exe")`.

---

### Task 4: Streamline Build Pipeline (`build.ts`) to Pure TypeScript
- **Status**: Completed
- **Implements**:
  - Requirement 4.0 (Elimination of Native Companion Executable & Build Simplification)
  - Section 4.2 (Build Automation Streamlining)
  - Acceptance Criteria: **AC 4.2.1**, **AC 4.2.2**, **AC 4.2.3**
- **Concrete Steps**:
  1. In `build.ts`, delete `buildCSharp()` and all references to `csProjPath` and `dotnet build`.
  2. Delete logic copying `ClipboardReader.exe`.
  3. Configure `copyOutputs()` to copy only `main.js` and `manifest.json` into `dist/`.
  4. Verify that `npm run build` executes `tsc` only and completes in under 2 seconds.

---

### Task 5: Decommission and Remove Legacy C# Source Tree (`ClipboardReader/`)
- **Status**: Completed
- **Implements**:
  - Requirement 4.0 (Elimination of Native Companion Executable & Build Simplification)
  - Section 4.3 (Clean Source Tree)
  - Acceptance Criteria: **AC 4.3.1**, **AC 4.3.2**
- **Concrete Steps**:
  1. Remove `ClipboardReader/ClipboardReader.csproj`.
  2. Remove `ClipboardReader/Program.cs`.
  3. Remove `ClipboardReader/.gitignore`.
  4. Remove `ClipboardReader/` directory.
  5. Delete any remaining `ClipboardReader.exe` binaries from root and `dist/`.
  6. Clean up `.gitignore` to remove .NET-specific rules (`*.runtimeconfig.json`, `*.deps.json`).

---

### Task 6: Update Automated Vault Deployment Script (`deploy.ts`)
- **Status**: Completed
- **Implements**:
  - Requirement 4.0 (Elimination of Native Companion Executable & Build Simplification)
  - Section 4.1 (Decommissioning of `ClipboardReader.exe`)
  - Section 4.2 (Build Automation Streamlining)
  - Acceptance Criteria: **AC 4.1.2**, **AC 4.2.1**
- **Concrete Steps**:
  1. Review `deploy.ts` to ensure it only deploys `main.js` and `manifest.json` from `dist/` into target vaults.
  2. Verify deployment script succeeds with zero errors.

---

### Task 7: In-Process Validation and Performance Benchmarking on Windows
- **Status**: Completed
- **Implements**:
  - Requirement 5.0 (Cross-Platform Performance and Regression Parity)
  - Section 5.1 (Sub-Millisecond Windows Latency)
  - Section 5.2 (Citation Formatting Parity)
  - Acceptance Criteria: **AC 5.1.1**, **AC 5.2.1**, **AC 5.2.2**
- **Concrete Steps**:
  1. Benchmark `parseSourceUrlFromBuffer` execution time using `console.time` / `process.hrtime()`.
  2. Verify that `CF_HTML` buffers from Google Chrome, Edge, and Firefox extract accurately.
  3. Verify that empty buffers and plain text copies resolve to `""` without errors.
  4. Verify citation generation in both OneNote style and Markdown quote style.

---

### Task 8: Update Documentation Suite (`README.md`, `RELEASE_NOTES.md`, `CHANGELOG.md`)
- **Status**: Completed
- **Implements**:
  - Requirement 4.0 (Elimination of Native Companion Executable & Build Simplification)
  - Acceptance Criteria: **AC 4.1.1**, **AC 4.2.1**
- **Concrete Steps**:
  1. Update `README.md` to declare zero-binary, pure TypeScript architecture across both Windows and macOS.
  2. Remove all references to .NET 6 Desktop Runtime requirements for Windows users.
  3. Update `RELEASE_NOTES.md` to highlight the elimination of native binaries.
  4. Update `CHANGELOG.md` with entries detailing the zero-binary refactor.
