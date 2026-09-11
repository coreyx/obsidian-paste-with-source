# Technology Stack: Windows Zero-Binary Architecture

This document details the technology stack, APIs, operating system integrations, binary removal rationale, and runtime specifications for the zero-binary Windows architecture of **Paste with Source**.

---

## 1. System & Architecture Evolution

Previously, the plugin executed a compiled C# binary (`ClipboardReader.exe`) via Node.js `child_process.execFile` on Windows to read the registered clipboard format `CF_HTML`. The zero-binary architecture replaces out-of-process subprocess execution with an **in-process Electron clipboard bridge**.

```
+-------------------------------------------------------------------------+
|                  Before: Hybrid Out-of-Process Model                    |
|                                                                         |
|  Obsidian (Node.js)                                                     |
|    └─► child_process.execFile("ClipboardReader.exe")                    |
|          └─► Spawns .NET 6.0 Process (30-60ms)                          |
|                └─► System.Windows.Forms.Clipboard.GetText(Html)         |
|                      └─► Reads Win32 CF_HTML                            |
+-------------------------------------------------------------------------+

                                    │
                                    ▼

+-------------------------------------------------------------------------+
|                   After: Unified In-Process Model                       |
|                                                                         |
|  Obsidian (Electron Desktop Runtime)                                    |
|    └─► require('electron').clipboard.readBuffer("HTML Format")          |
|          └─► In-Process Memory Read (< 1ms)                             |
|                └─► Direct Win32 CF_HTML Buffer                          |
|                      └─► In-Memory Regex Parse ("SourceURL:<url>")      |
+-------------------------------------------------------------------------+
```

---

## 2. Technology Stack Matrix

| Dimension | Component / Technology | Specification | Purpose / Role |
| :--- | :--- | :--- | :--- |
| **Host Application** | [Obsidian](https://obsidian.md) | Minimum App Version `0.15.0` | Markdown knowledge base host |
| **Host Runtime** | [Electron](https://www.electronjs.org/) / Chromium | Electron 25+ (Chromium engine) | Desktop container providing native APIs |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `^5.8.3` | Implementation language for provider and parser |
| **Compiler Target** | ECMAScript 2020 (`ES2020`) | Target: `ES2020`, Module: `CommonJS` | Compatibility with Obsidian plugin loader |
| **Clipboard Bridge** | Electron `clipboard` Module | `require('electron').clipboard` | In-process access to native Win32 clipboard formats |
| **Win32 Clipboard Format**| `"HTML Format"` (`CF_HTML`) | Windows Registered Clipboard Format | Data container populated by browsers on copy |
| **Format Descriptor** | `electron application/osclipboard;format="HTML Format"` | Electron Custom Format Token | Standard Electron identifier for native Windows HTML format |
| **Buffer Decoding** | Node.js `Buffer` API | Core Node.js Embedded API | Converts raw byte stream to UTF-8 text |
| **Header Parsing** | JavaScript RegExp Engine | V8 Native Regular Expressions | Fast in-memory pattern matching for `SourceURL:` |
| **Fallback Shell** | Windows PowerShell | `powershell.exe` (Built-in) | Zero-binary subprocess fallback if Electron buffer is empty |
| **External Dependencies**| *None* | Zero third-party runtime dependencies | Eliminates .NET SDK, .NET Runtime, and native binaries |

---

## 3. Win32 `CF_HTML` ("HTML Format") Specification

When content is copied from modern browsers on Windows (Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, Arc, Opera), the browser registers and populates the format `"HTML Format"`.

### 3.1 Raw Buffer Structure
The format begins with a standardized ASCII/UTF-8 description block followed by the HTML markup:
```text
Version:0.9\r\n
StartHTML:0000000105\r\n
EndHTML:0000000780\r\n
StartFragment:0000000141\r\n
EndFragment:0000000744\r\n
SourceURL:https://en.wikipedia.org/wiki/Obsidian_(software)\r\n
<html>\r\n
<body>\r\n
<!--StartFragment-->Obsidian is a personal knowledge base...<!--EndFragment-->\r\n
</body>\r\n
</html>
```

### 3.2 In-Process Retrieval API
In Electron, passing `"HTML Format"` to `clipboard.readBuffer()` directly invokes Chromium's Win32 clipboard provider (`ui/base/clipboard/clipboard_win.cc`), which calls `RegisterClipboardFormat(L"HTML Format")` and reads the global memory handle (`HGLOBAL`):
```typescript
const buf: Buffer = clipboard.readBuffer("HTML Format");
```

### 3.3 Parsing Mechanism
```typescript
const text = buf.toString("utf8");
const match = text.match(/SourceURL:(https?:\/\/[^\r\n]+)/i);
if (match) {
  const url = match[1].trim();
}
```

---

## 4. Technology Footprint Comparison

| Characteristic | Previous Windows Architecture | Zero-Binary Windows Architecture |
| :--- | :--- | :--- |
| **Language Stack** | TypeScript + C# 10 | **Pure TypeScript** |
| **Build Tools** | `tsc` + `dotnet build` | **`tsc` only** |
| **User Prerequisites**| .NET 6.0 Desktop Runtime (~60 MB install) | **Zero prerequisites** |
| **Execution Mode** | Child process (`execFile`) | **In-process memory read** |
| **Execution Latency** | 30ms – 60ms | **< 1ms** |
| **Binary Artifacts** | `ClipboardReader.exe` (~150 KB) | **None (0 KB)** |
| **Antivirus Risks** | Heuristic false positives on unsigned `.exe` | **Zero risk** (no executable spawned) |
| **Cross-Platform Fit**| Asymmetric (C# on Win, Electron on Mac) | **Symmetric (Electron in-process on both)** |

---

## 5. Development & Build Tooling

- **Compiler**: `tsc` compiles `main.ts` directly to `main.js`.
- **Build Script (`build.ts`)**: Eliminates `buildCSharp()`, removes `dotnet build` execution, and packages only `main.js` and `manifest.json`.
- **Packaging (`dist/`)**: Distribution footprint drops from ~170 KB down to ~20 KB.

---

## 6. Electron Renderer Clipboard Deprecation & Scoped Suppression

For detailed investigation notes, architectural constraints, and root cause analysis, see [electron-renderer-clipboard-findings.md](../../spec/windows-zero-binary/electron-renderer-clipboard-findings.md).

### 6.1 Summary of Deprecation
In modern Electron versions, accessing `clipboard` methods from renderer processes triggers an advisory notice:
```text
(electron) Accessing 'clipboard.readBuffer' from the renderer process is deprecated and will be removed.
Please use the 'contextBridge' API to access the clipboard API from the renderer.
```

### 6.2 Obsidian Host Constraints & Solution
Because community plugins run strictly in Obsidian's renderer window and cannot modify Obsidian's preload scripts or register `contextBridge` handlers, direct access via `window.require("electron").clipboard` is required to read raw Win32 `CF_HTML` and macOS WebArchive buffers.

To prevent DevTools console clutter without side effects, calls are wrapped with `safelyReadClipboard<T>()`:
- Temporarily scopes `process.noDeprecation = true` during the synchronous read.
- Intercepts `console.warn` for clipboard deprecations.
- Immediately restores process and logger state in a `finally` block.
- Backed by an asynchronous zero-binary PowerShell CLI fallback if future Electron versions ever restrict renderer access entirely.

