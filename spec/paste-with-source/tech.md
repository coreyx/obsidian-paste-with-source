# Technology Stack: Paste with Source

This document outlines the complete technology stack, runtime environments, libraries, operating system integrations, and development tooling powering the **Paste with Source** Obsidian plugin.

---

## 1. System & Architecture Overview

The **Paste with Source** project is a hybrid desktop application extension comprising two primary sub-systems:
1. **Frontend Extension Layer**: An [Obsidian](https://obsidian.md) plugin executing within Obsidian's Chromium/Electron desktop runtime. Written in TypeScript and transpiled to CommonJS JavaScript.
2. **Native Win32 Helper Utility (`ClipboardReader.exe`)**: A lightweight standalone .NET Windows console binary compiled with Windows Forms integration. Responsible for accessing the low-level Win32 clipboard format (`CF_HTML`) to extract origin metadata (`SourceURL`).

```
+-------------------------------------------------------------------------+
|                           Obsidian Desktop                              |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                 Paste with Source Plugin (main.js)                |  |
|  |   - Event Listeners (keydown, editor-menu)                        |  |
|  |   - Settings Tab & Persistence (data.json)                        |  |
|  |   - Markdown Citation Formatter                                   |  |
|  +---------------------------------+---------------------------------+  |
|                                    |                                    |
|                       child_process.execFile()                          |
|                       (process.noAsar = true)                           |
|                                    v                                    |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  Windows Native Helper Subsystem                        |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                     ClipboardReader.exe                           |  |
|  |   - .NET 6.0 (net6.0-windows) STA Application                     |  |
|  |   - System.Windows.Forms.Clipboard.GetText(CF_HTML)               |  |
|  |   - Header line scanner -> Extract 'SourceURL:<url>'              |  |
|  +---------------------------------+---------------------------------+  |
|                                    |                                    |
|                                    v                                    |
|                    Win32 System Clipboard Subsystem                     |
|                    (CF_HTML registered clipboard format)                |
+-------------------------------------------------------------------------+
```

---

## 2. Technology Stack Matrix

| Layer / Concern | Technology / Component | Version / Specification | Purpose |
| :--- | :--- | :--- | :--- |
| **Host Application** | [Obsidian](https://obsidian.md) | Minimum App Version `0.15.0` | Target Knowledge Base / Markdown editor platform |
| **Host Runtime** | [Electron](https://www.electronjs.org/) / Chromium | V8 / Node.js embedded | Host desktop container running Obsidian |
| **Language (Plugin)** | [TypeScript](https://www.typescriptlang.org/) | `^5.8.3` | Typed implementation of plugin logic, UI, and IPC |
| **Compilation Target**| ECMAScript 2020 (`ES2020`) | Target: `ES2020`, Module: `CommonJS` | Compatibility with Node.js and Obsidian plugin loader |
| **Runtime (Helper)** | [.NET SDK / Runtime](https://dotnet.microsoft.com/) | `net6.0-windows` | Windows execution environment for native helper binary |
| **Language (Helper)** | [C#](https://learn.microsoft.com/en-us/dotnet/csharp/) | C# 10.0 (.NET 6.0 SDK) | Source code for `ClipboardReader` executable |
| **Desktop Framework**| Windows Forms (`UseWindowsForms`) | Integrated in `net6.0-windows` | Provides `System.Windows.Forms.Clipboard` Win32 API access |
| **IPC Mechanism** | Node.js `child_process.execFile` | Node.js Core API (`@types/node ^18.19.115`) | Asynchronously executes `ClipboardReader.exe` and reads stdout |
| **Script Execution** | `ts-node` | `^10.9.2` | Runs build and deployment scripts directly in TypeScript |
| **Package Manager** | npm | `package.json` lockfile v3 | Manages development dependencies and scripts |

---

## 3. Core Libraries and Dependencies

### 3.1 Production Dependencies
The plugin purposefully ships with zero third-party production npm dependencies, keeping the bundled footprint minimal and performant:
- **`obsidian` (latest)**: Type definitions and public API contract for plugin lifecycle (`Plugin`, `PluginSettingTab`, `Setting`, `Editor`, `Menu`, `FileSystemAdapter`).
- **Node.js Core APIs**:
  - `child_process`: Specifically `execFile` for executing `ClipboardReader.exe` asynchronously and `execSync` for build automation.
  - `path`: Cross-platform path resolution and file joining.
  - `fs`: File system inspection and copying.

### 3.2 Development Dependencies (`package.json`)
```json
{
  "devDependencies": {
    "@types/node": "^18.19.115",
    "obsidian": "latest",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.3"
  }
}
```

- **`typescript` (`^5.8.3`)**: TypeScript compiler (`tsc`) translating `main.ts` into `main.js`.
- **`ts-node` (`^10.9.2`)**: TypeScript execution engine used to run `build.ts` and `deploy.ts` directly from `npm run build` and `npm run deploy`.
- **`@types/node` (`^18.19.115`)**: Type definitions for Node.js standard modules (`child_process`, `fs`, `path`, `process`).

---

## 4. Native Windows Subsystem (`ClipboardReader`)

### 4.1 Target Framework and Project Specification
Defined in [`ClipboardReader/ClipboardReader.csproj`](../../ClipboardReader/ClipboardReader.csproj):
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net6.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
  </PropertyGroup>
</Project>
```

### 4.2 Windows Forms Clipboard API (`CF_HTML`)
Standard browser copy operations (Chrome, Edge, Firefox, Brave) place formatted content on the Windows Clipboard in the registered format `CF_HTML` (`TextDataFormat.Html`).

The payload includes an RFC-like header containing metadata:
```text
Version:0.9
StartHTML:0000000105
EndHTML:0000000780
StartFragment:0000000141
EndFragment:0000000744
SourceURL:https://example.com/article/sample-post
<html>
<body>
<!--StartFragment-->...copied text...<!--EndFragment-->
</body>
</html>
```

### 4.3 C# Implementation Attributes
- **Threading Model**: `[STAThread]` single-threaded apartment model required by OLE/COM and Win32 Clipboard APIs.
- **Header Parsing**: `System.IO.StringReader` iterates line by line looking for prefix `SourceURL:`.
- **Exit Status**:
  - `0`: Success, URL written to standard output (`Console.WriteLine`).
  - `1`: Failure (missing HTML, missing `SourceURL`, or exception).

---

## 5. Build and Automation Pipeline

The build lifecycle is managed via two custom TypeScript automation scripts:

### 5.1 Build Pipeline (`build.ts`)
1. **Transpile TypeScript**: Invokes `tsc` to compile `main.ts` into `main.js` targeting ES2020.
2. **Compile Native C# Helper**: Invokes `dotnet build ClipboardReader/ClipboardReader.csproj -c Release`.
3. **Assemble Bundle**: Copies required distribution assets into root / plugin output directory:
   - `main.js`
   - `manifest.json`
   - `ClipboardReader.exe` (from `ClipboardReader/bin/Release/net6.0-windows/ClipboardReader.exe`)

### 5.2 Deployment Pipeline (`deploy.ts`)
1. Resolves default local user vault path:
   ```typescript
   path.join(process.env.HOME || process.env.USERPROFILE || "", "Documents", "Obsidian Vault")
   ```
2. Targets plugin destination: `<Vault>/.obsidian/plugins/paste-with-source/`.
3. Recursively synchronizes build artifacts from `dist/` directly into the Obsidian vault for immediate testing and live reload.

---

## 6. Runtime Configuration & TypeScript Settings

### `tsconfig.json` Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```
- **`target: "ES2020"`**: Leverages modern ECMAScript features (async/await, optional chaining, nullish coalescing) natively supported in modern Chromium/Node runtimes.
- **`module: "CommonJS"`**: Matches Obsidian's native plugin loader specification.
- **`strict: true`**: Enforces strict null checks, type safety, and no-implicit-any.
- **`esModuleInterop: true`**: Enables seamless imports from Node CommonJS modules.

---

## 7. Platform Constraints & Compatibility

- **Host Operating System**: **Windows only** (`net6.0-windows` executable dependency).
- **Architecture**: x64 / ARM64 Windows (running x64 emulation or native .NET runtime).
- **Unsupported Environments**:
  - macOS (cannot execute `.exe`)
  - Linux (cannot execute `.exe` without Wine; native clipboard uses X11/Wayland targets)
  - Obsidian Mobile (iOS / Android do not support child process spawning or native executables)
