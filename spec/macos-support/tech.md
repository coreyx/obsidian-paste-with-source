# Technology Stack: macOS Support

This document details the technology stack, APIs, operating system integrations, runtime constraints, and binary data specifications for extending **Paste with Source** to macOS.

---

## 1. System & Architecture Overview

Unlike the Windows implementation—which executes a standalone .NET 6 binary (`ClipboardReader.exe`) to read the Win32 `CF_HTML` clipboard format—macOS support is engineered as an **in-process extension** utilizing Obsidian's embedded Electron desktop APIs.

```
+-------------------------------------------------------------------------+
|                        Obsidian Desktop (macOS)                         |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                 Paste with Source Plugin                          |  |
|  |   - Keyboard Event Listener (Cmd+V / metaKey)                     |  |
|  |   - Platform Router (process.platform === 'darwin')               |  |
|  |   - Settings Manager & Platform UI Adaptation                     |  |
|  +---------------------------------+---------------------------------+  |
|                                    |                                    |
|                      In-Process API Call (Direct)                       |
|                                    v                                    |
|  +-------------------------------------------------------------------+  |
|  |               MacOSClipboardProvider (TypeScript)                 |  |
|  |   - Electron clipboard.read('org.chromium.source-url')            |  |
|  |   - Electron clipboard.readBuffer('com.apple.webarchive')         |  |
|  |   - Lightweight Apple 'bplist00' binary parser                    |  |
|  +---------------------------------+---------------------------------+  |
|                                    |                                    |
|                  Native Electron / Cocoa Pasteboard                     |
|                                    v                                    |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                      macOS Cocoa Subsystem                              |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                  NSPasteboard.general Pasteboard                  |  |
|  |   - "org.chromium.source-url"  (Chrome, Edge, Brave, Arc, Opera)  |  |
|  |   - "com.apple.webarchive"     (Apple Safari / WebKit)            |  |
|  |   - "public.url"               (Hyperlink fallback)               |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 2. Technology Stack Matrix

| Dimension | Technology / Standard | Target / Version | Role in macOS Support |
| :--- | :--- | :--- | :--- |
| **Operating System** | macOS | macOS 10.15 (Catalina) through macOS 15+ (Sequoia) | Target OS platform |
| **CPU Architecture** | Apple Silicon & Intel | `arm64` (M1–M4) / `x86_64` (Universal) | Runs identically in Electron without native architecture binaries |
| **Host Runtime** | Electron (via Obsidian Desktop) | Electron 25+ / Chromium 114+ / Node.js 18+ | Host container providing desktop capabilities |
| **Language** | TypeScript | `^5.8.3` | Implementation language for provider and bplist parser |
| **Compilation Target** | ECMAScript 2020 (`ES2020`) | Target: `ES2020`, Module: `CommonJS` | Compiles to `main.js` |
| **Clipboard Bridge** | Electron `clipboard` API | `require('electron').clipboard` | In-process access to native `NSPasteboard` flavors |
| **Chromium Pasteboard Type** | `org.chromium.source-url` | Registered Cocoa Pasteboard Type | Provides source URL for Chrome, Edge, Brave, Arc |
| **Safari Pasteboard Type** | `com.apple.webarchive` | Uniform Type Identifier (UTI) | Apple WebArchive containing page metadata |
| **Metadata Serialization** | Apple Binary Plist (`bplist00`) | Binary Property List v0.0 | Format of `com.apple.webarchive` containing `WebResourceURL` |
| **Binary Parsing** | Node.js `Buffer` API | Native Node.js embedded | Zero-dependency decoding of the binary plist stream |
| **Manifest Contract** | Obsidian Plugin Manifest | `isDesktopOnly: true` | Required by Obsidian when importing Electron modules |

---

## 3. macOS Pasteboard Data Specifications

### 3.1 Chromium Pasteboard Flavor (`org.chromium.source-url`)
Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Arc, Opera, Vivaldi) on macOS automatically write an explicit origin URL to the system pasteboard whenever a selection is copied:
- **Type Identifier**: `"org.chromium.source-url"`
- **Encoding**: UTF-8 plain string
- **Electron Extraction**:
  ```typescript
  const { clipboard } = require("electron");
  const sourceUrl = clipboard.read("org.chromium.source-url");
  ```
- **Payload Example**: `https://github.com/obsidianmd/obsidian-api`

### 3.2 Safari WebArchive Flavor (`com.apple.webarchive`)
Apple Safari does not write `org.chromium.source-url`. Instead, copying formatted web content populates `com.apple.webarchive` (UTI: `com.apple.webarchive`):
- **Type Identifier**: `"com.apple.webarchive"`
- **File Signature / Magic Bytes**: `bplist00` (ASCII: `0x62 0x70 0x6C 0x69 0x73 0x74 0x30 0x30`)
- **Structure**:
  ```text
  Root Dictionary:
  └── "WebMainResource" (Dictionary)
      ├── "WebResourceURL" (String: e.g. "https://developer.apple.com/documentation/")
      ├── "WebResourceMIMEType" (String: "text/html")
      ├── "WebResourceTextEncodingName" (String: "UTF-8")
      └── "WebResourceData" (Data: HTML payload)
  ```
- **Electron Extraction**:
  ```typescript
  const buffer: Buffer = clipboard.readBuffer("com.apple.webarchive");
  ```

---

## 4. Binary Property List (`bplist00`) Decoder Architecture

To parse `WebResourceURL` without adding heavy external dependencies, a lightweight in-memory decoder inspects the `Buffer`:

```
+-------------------------------------------------------------------------+
|                  Apple Binary Property List (bplist00)                  |
|                                                                         |
|  [0..7]   Magic Header: "bplist00"                                      |
|  [8..N]   Object Table (Strings, Dictionaries, Arrays, Integers)        |
|  [N..M]   Offset Table (Pointers to individual objects)                 |
|  [M..End] 32-byte Trailer:                                              |
|           - offsetTableOffset (uint64)                                  |
|           - numObjects (uint64)                                         |
|           - rootObjectOffset (uint64)                                   |
+-------------------------------------------------------------------------+
```

### Parsing Pipeline
1. Verify header equals `bplist00`.
2. Read the 32-byte trailer at the end of the buffer.
3. Locate the `offsetTableOffset` and object references.
4. Locate dictionary key `"WebMainResource"`, then locate key `"WebResourceURL"`.
5. Extract the ASCII or UTF-16 string value of `WebResourceURL`.

---

## 5. Technology Comparison: Windows vs. macOS

| Characteristic | Windows Implementation | macOS Implementation |
| :--- | :--- | :--- |
| **Execution Mode** | Out-of-process (`child_process.execFile`) | In-process (`require('electron').clipboard`) |
| **Native Dependency** | `ClipboardReader.exe` (.NET 6.0 SDK/Runtime) | None (Pure JavaScript / TypeScript) |
| **Spawning Latency** | 20ms – 60ms | < 1ms (Direct memory access) |
| **Security / Sandbox** | Subprocess invocation, antivirus scans | Fully contained within Electron sandbox |
| **OS Maintenance** | Requires compiling `.exe` via `dotnet` | Included in standard `npm run build` (`tsc`) |
| **Apple Silicon (M1–M4)**| N/A | Supported natively out-of-the-box |

---

## 6. Development & Build Tooling

- **Compiler**: `tsc` (TypeScript Compiler `5.8.3`) transpiles the provider and parser into `main.js`.
- **Packaging**: Zero native binaries are compiled for macOS. `build.ts` continues to compile `main.ts` into `main.js`. On Windows systems, it builds `ClipboardReader.exe`; on macOS, it safely bypasses `dotnet build`.
- **Type Checking**: `@types/node` provides definitions for `Buffer` and `process.platform`.
