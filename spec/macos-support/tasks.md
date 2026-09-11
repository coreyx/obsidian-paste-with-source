# Development Tasks: macOS Support Feature

This document provides a reverse-engineered implementation checklist for delivering native macOS support to the **Paste with Source** Obsidian plugin. Each task specifies concrete technical steps and cross-references the section, subsection numbers, and acceptance criteria in [requirements.md](../../spec/macos-support/requirements.md).

---

## Task Checklist Overview

- [ ] **Task 1: Update Plugin Manifest for Desktop API Access**
- [ ] **Task 2: Define Platform Provider Abstraction Layer (`IClipboardSourceProvider`)**
- [ ] **Task 3: Encapsulate Existing Windows Logic into `WindowsClipboardProvider`**
- [ ] **Task 4: Implement In-Memory Binary Plist (`bplist00`) Parser for Safari**
- [ ] **Task 5: Implement `MacOSClipboardProvider` for Chromium and Safari**
- [ ] **Task 6: Refactor Plugin Lifecycle to Initialize Active Platform Provider**
- [ ] **Task 7: Refactor Keystroke Interceptor for Native macOS `Cmd+V`**
- [ ] **Task 8: Adapt Settings Tab UI for macOS Platform Keybindings**
- [ ] **Task 9: Update Build Script (`build.ts`) for Cross-Platform Environments**
- [ ] **Task 10: Multi-Browser End-to-End Verification on macOS**

---

## Detailed Task Specifications

### Task 1: Update Plugin Manifest for Desktop API Access
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 5.0 (Plugin Configuration, Settings UI & Manifest Compliance)
  - Section 5.1 (Desktop Only Manifest Declaration)
  - Acceptance Criteria: **AC 5.1.1**, **AC 5.1.2**
- **Concrete Steps**:
  1. Open `manifest.json`.
  2. Add `"isDesktopOnly": true` property.
  3. Validate JSON formatting to ensure compatibility with Obsidian Community Plugin guidelines.

---

### Task 2: Define Platform Provider Abstraction Layer (`IClipboardSourceProvider`)
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 1.0 (Operating System Detection and Provider Routing)
  - Section 1.1 (Platform Runtime Detection)
  - Section 1.2 (Provider Dispatch Abstraction)
  - Acceptance Criteria: **AC 1.1.1**, **AC 1.2.1**, **AC 1.2.2**
- **Concrete Steps**:
  1. Define interface `IClipboardSourceProvider`:
     ```typescript
     export interface IClipboardSourceProvider {
       getSourceUrl(): Promise<string>;
     }
     ```
  2. Create factory function `createClipboardProvider(app: App, pluginDir: string): IClipboardSourceProvider` that inspects `process.platform`:
     - If `process.platform === "darwin"`: return `new MacOSClipboardProvider()`.
     - If `process.platform === "win32"`: return `new WindowsClipboardProvider(pluginDir)`.
     - Else: return `new NullClipboardProvider()` that always resolves `""`.

---

### Task 3: Encapsulate Existing Windows Logic into `WindowsClipboardProvider`
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 1.0 (Operating System Detection and Provider Routing)
  - Section 1.2 (Provider Dispatch Abstraction)
  - Section 1.3 (Windows Backward Compatibility Preservation)
  - Acceptance Criteria: **AC 1.2.1**, **AC 1.3.1**, **AC 1.3.2**
- **Concrete Steps**:
  1. Extract existing `getClipboardSourceUrl()` logic from `main.ts` into class `WindowsClipboardProvider` implementing `IClipboardSourceProvider`.
  2. Pass `pluginDir` as a constructor argument.
  3. Retain `(process as any).noAsar = true` and `child_process.execFile` calling `ClipboardReader.exe`.
  4. Ensure all existing error logs and URL validations (`startsWith("http")`) remain identical.

---

### Task 4: Implement In-Memory Binary Plist (`bplist00`) Parser for Safari
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 3.0 (Safari WebKit WebArchive Property List Decoding)
  - Section 3.1 (WebArchive Buffer Retrieval)
  - Section 3.2 (Binary Property List Parsing)
  - Section 3.3 (Extracted Safari URL Validation)
  - Acceptance Criteria: **AC 3.1.1**, **AC 3.1.2**, **AC 3.2.1**, **AC 3.2.2**, **AC 3.2.3**, **AC 3.2.4**, **AC 3.3.1**, **AC 3.3.2**, **AC 3.3.3**
- **Concrete Steps**:
  1. Create class `BplistParser` with static method `extractSourceUrl(buf: Buffer): string`.
  2. Verify buffer length >= 40 and magic header `bplist00`.
  3. Parse 32-byte trailer at `buf.length - 32`:
     - Read `offsetIntSize` (byte 6).
     - Read `objectRefSize` (byte 7).
     - Read `numObjects` (uint64 Big Endian at byte 8).
     - Read `topObject` (uint64 Big Endian at byte 16).
     - Read `offsetTableOffset` (uint64 Big Endian at byte 24).
  4. Implement recursive `parseObject(objIndex: number)` supporting:
     - ASCII string tokens (`0x50` marker).
     - Dictionary tokens (`0xd0` marker).
  5. Traverse root dictionary to locate `"WebMainResource"`, and within it find `"WebResourceURL"`.
  6. Return trimmed string if it starts with `"http"`, otherwise return `""`.
  7. Wrap entire parsing logic in `try / catch` to ensure malformed buffers never throw exceptions.

---

### Task 5: Implement `MacOSClipboardProvider` for Chromium and Safari
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 2.0 (Chromium Browser Source URL Extraction on macOS)
  - Section 2.1 (In-Process Electron Clipboard Access)
  - Section 2.2 (String Sanitization and URL Validation)
  - Requirement 3.0 (Safari WebKit WebArchive Property List Decoding)
  - Section 3.1 (WebArchive Buffer Retrieval)
  - Acceptance Criteria: **AC 2.1.1**, **AC 2.1.2**, **AC 2.2.1**, **AC 2.2.2**, **AC 2.2.3**, **AC 3.1.1**
- **Concrete Steps**:
  1. Create class `MacOSClipboardProvider` implementing `IClipboardSourceProvider`.
  2. In `getSourceUrl()`, dynamically acquire Electron clipboard: `const { clipboard } = require("electron")`.
  3. Step 1 (Chromium): Read `clipboard.read("org.chromium.source-url")`. If valid URL, return immediately.
  4. Step 2 (Safari): Read `clipboard.readBuffer("com.apple.webarchive")`. If present, pass buffer to `BplistParser.extractSourceUrl(buf)`. If valid URL, return.
  5. Step 3 (Fallback): Read `clipboard.read("public.url")`. If valid URL, return.
  6. If all checks fail, return `""`.

---

### Task 6: Refactor Plugin Lifecycle to Initialize Active Platform Provider
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 1.0 (Operating System Detection and Provider Routing)
  - Section 1.1 (Platform Runtime Detection)
  - Section 1.2 (Provider Dispatch Abstraction)
  - Acceptance Criteria: **AC 1.1.1**, **AC 1.1.2**, **AC 1.2.1**, **AC 1.2.2**
- **Concrete Steps**:
  1. Add member `clipboardProvider!: IClipboardSourceProvider` to `PasteWithSourcePlugin`.
  2. In `onload()`, initialize `this.clipboardProvider = createClipboardProvider(this.app, pluginDir)`.
  3. Update `getClipboardSourceUrl()` to delegate directly: `return this.clipboardProvider.getSourceUrl()`.
  4. Ensure `pasteWithSource`, `pasteDefaultPlusSource`, and `pasteSourceOnly` work seamlessly through the provider.

---

### Task 7: Refactor Keystroke Interceptor for Native macOS `Cmd+V`
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 4.0 (macOS Keyboard Shortcut Interception & Keybindings)
  - Section 4.1 (Native `Cmd+V` Keystroke Recognition)
  - Section 4.2 (Shortcut Mode Filtering on macOS)
  - Acceptance Criteria: **AC 4.1.1**, **AC 4.1.2**, **AC 4.1.3**, **AC 4.2.1**, **AC 4.2.2**
- **Concrete Steps**:
  1. In `registerDomEvent(document, "keydown", ...)`, determine `isMac = process.platform === "darwin"`.
  2. Compute `isCmdV = isMac && event.metaKey && event.key.toLowerCase() === "v"`.
  3. Compute `isCtrlV = !isMac && event.ctrlKey && event.key.toLowerCase() === "v"`.
  4. Compute `isShiftInsert = !isMac && event.shiftKey && event.key === "Insert"`.
  5. Adjust `shouldIntercept` condition to treat `isCmdV` on macOS as the primary paste shortcut when `interceptShortcut` is `"both"` or `"ctrl+v"`.

---

### Task 8: Adapt Settings Tab UI for macOS Platform Keybindings
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 5.0 (Plugin Configuration, Settings UI & Manifest Compliance)
  - Section 5.2 (Dynamic Settings UI Adaptation)
  - Acceptance Criteria: **AC 5.2.1**, **AC 5.2.2**
- **Concrete Steps**:
  1. In `PasteWithSourceSettingTab.display()`:
     - Check `Platform.isMacOS` or `process.platform === "darwin"`.
     - Update description for `"Intercept Shortcut"`: if on Mac, note that `Cmd+V` is intercepted.
     - Dynamically label dropdown option `"ctrl+v"` as `"Cmd+V only"` on macOS, and `"Ctrl+V only"` on Windows.

---

### Task 9: Update Build Script (`build.ts`) for Cross-Platform Environments
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 5.0 (Plugin Configuration, Settings UI & Manifest Compliance)
  - Section 5.3 (Build Pipeline Platform Agnosticism)
  - Acceptance Criteria: **AC 5.3.1**
- **Concrete Steps**:
  1. In `build.ts`, inspect `process.platform`.
  2. If running on macOS or Linux, check if `dotnet` CLI is present in `PATH`.
  3. If `dotnet` is not installed, log a helpful warning: `"> Skipping C# build (not on Windows and dotnet not available)"` and proceed to compile `main.ts` with `tsc`.
  4. Ensure `npm run build` succeeds on macOS developer machines without throwing exit errors.

---

### Task 10: Multi-Browser End-to-End Verification on macOS
- **Status**: Ready for Execution
- **Implements**:
  - Requirement 2.0 (Chromium Browser Source URL Extraction on macOS)
  - Requirement 3.0 (Safari WebKit WebArchive Property List Decoding)
  - Requirement 4.0 (macOS Keyboard Shortcut Interception & Keybindings)
  - Acceptance Criteria: **AC 2.1.2**, **AC 3.1.1**, **AC 4.1.1**
- **Concrete Steps**:
  1. Test copy-paste from Google Chrome on macOS -> Verify `org.chromium.source-url` extracts and pastes OneNote and Source style citations.
  2. Test copy-paste from Apple Safari on macOS -> Verify `com.apple.webarchive` parses `WebResourceURL` correctly.
  3. Test copy-paste from Arc and Microsoft Edge on macOS.
  4. Test plain text paste from TextEdit / Notes -> Verify fallback behavior (no citation appended, no errors).
  5. Verify Windows regression testing: compile and run on Windows 10/11 to ensure `ClipboardReader.exe` continues to function.
