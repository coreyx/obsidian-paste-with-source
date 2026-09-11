# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Cross-platform support investigation for macOS and Linux clipboard providers.
- Custom citation template engine allowing custom prefix, suffix, and date variables.
- Direct Chromium/Edge browser extension companion integration.

---

## [1.0.0] - 2025-07-08

### Added
- **Native Helper Utility (`ClipboardReader.exe`)**:
  - Standalone .NET 6 console executable targeting `net6.0-windows`.
  - Single-Threaded Apartment (`[STAThread]`) Win32 clipboard reader using `System.Windows.Forms.Clipboard`.
  - Line-by-line parsing of Windows `CF_HTML` registered clipboard format to extract `SourceURL:`.
- **Obsidian IPC Bridge**:
  - Asynchronous invocation of `ClipboardReader.exe` via `child_process.execFile`.
  - Electron ASAR bypass (`process.noAsar = true`) for reliable native binary execution.
  - Subprocess exit code validation, URL prefix checking (`http`), and graceful fallback on non-zero exit codes.
- **Paste Interception Engine**:
  - Global DOM `keydown` listener capturing paste operations.
  - Cross-platform key recognition (`Ctrl+V` and `Shift+Insert` on Windows, `Cmd+V` on macOS).
  - Configurable `interceptShortcut` option supporting `"both"`, `"ctrl+v"`, and `"shift+insert"`.
  - Dual paste handling modes:
    - `"default+source"`: Lets native editor paste complete before appending citation via a 50ms delayed callback.
    - `"clipboard+source"`: Reads plain text from `navigator.clipboard` and performs a clean atomic text-plus-citation replacement.
- **Customizable Citation Formatting**:
  - OneNote citation style: `\n\nFrom <[url](url)>`.
  - Markdown blockquote citation style: `\n\n> — [Source](url)`.
  - Configurable link label: toggle between full target URL or generic `[Source]` text.
- **UI & Command Integration**:
  - Command palette command: `Paste (Default) + Source URL`.
  - Command palette command: `Paste with Source URL`.
  - Context menu items on editor right-click:
    - `Paste (Default Handler) + Source URL` (with `clipboard` icon).
    - `Paste Clipboard with Source URL` (with `paste` icon).
  - Standalone method `pasteSourceOnly` for pasting solely the source link.
  - Settings tab `PasteWithSourceSettingTab` in Obsidian Preferences.
  - Settings persistence in vault `data.json`.
- **Build & Deployment Automation**:
  - `build.ts`: Unified pipeline compiling TypeScript (`tsc`) and C# (.NET Release configuration), assembling distribution artifacts in root.
  - `deploy.ts`: Automated script deploying built assets directly to the local user's Obsidian Vault plugin folder.
  - Development tooling with `ts-node` and `typescript` 5.8+.

### Changed
- Default setting `interceptPaste` set to `true` by default.
- Added dedicated `interceptShortcut` dropdown setting in preference UI allowing users to restrict interception to `Ctrl+V` only, `Shift+Insert` only, or both.
- Improved setting description clarity for `"Intercept Paste"` and `"Citation Style"`.

---

## [0.1.0] - 2025-07-07

### Added
- Initial project scaffolding and repository structure.
- Basic TypeScript configuration and manifest for Obsidian plugin.
- Initial implementation of `ClipboardReader` C# utility.
- Preliminary paste interception and settings tab.
