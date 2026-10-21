# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Page Title Links**: Citations can label their link with the page's real title. The plugin requests the copied page through Obsidian and reads its `og:title`, `twitter:title` or `<title>`, decoding the page in the character set it declares. The paste goes in at once with the URL where the title will go, and the title replaces it when the page answers. A citation edited, deleted or moved to a different note in the meantime is left alone. A page that doesn't answer within 10 seconds, isn't HTML or has no title keeps the URL. The README's new **Network Use** section explains exactly when a request is made.
- **`{title}` Variable**: The fetched page title, usable anywhere in a template. It shows the URL until the title arrives.
- **Page Name Link Label**: Labels `{link}` with the name taken from the URL's path, what `{page}` gives, and makes no network request.

### Changed
- **Link Label Dropdown**: The **Use URL as Link Label** toggle is now a **Link Label** dropdown: *Page title* (the default), *Page name*, *URL* or *"Source"*. The old setting isn't carried over.
- **Presets Use `{link}`**: Italic Attribution, Parenthetical, Academic Citation, Obsidian Callout, Timestamped (ISO 8601), Zulu / UTC Research Log and 12-Hour Casual now write `{link}` where they had `[{page}]({url})`, so **Link Label** decides their link text too. With *Page name* they read exactly as before.
- **Repository Renamed**: The GitHub repository is now `coreyx/obsidian-paste-with-source`. GitHub redirects the old `coreyx/paste-with-source` URLs. The plugin id is still `paste-with-source`, so installed copies and their settings are unaffected.

### Planned
- Direct Chromium/Edge browser extension companion integration.

---

## [1.4.2] - 2026-10-20

### Added
- **License**: The project is released under the MIT License (`LICENSE`), also declared in `package.json`.

### Changed
- **npm Package Name**: The npm package is now `paste-with-source`, matching the plugin id, instead of `source-link`. It isn't published to npm, so nothing depends on the old name.

### Fixed
- **Minimum Obsidian Version**: `minAppVersion` said `0.15.0`, but the paste shortcut and both paste commands read `workspace.activeEditor`, which Obsidian added in 1.1.1. On older versions they silently did nothing. The manifest now requires 1.1.1, so Obsidian won't install the plugin on a version it can't run on.

---

## [1.4.1] - 2026-10-20

### Added
- **`npm test`**: Compiles the project, then runs every `test-*.ts` file in its own process and prints a `PASS`/`FAIL` summary, exiting non-zero if the compile or any test failed. The tests load the compiled `main.js`, so running them without a build used to check whatever was built last.

### Changed
- **Deploy Script Needs a Vault Path**: `npm run deploy` no longer copies the build into `~/Documents/Obsidian Vault`, which created a stray folder on machines whose vaults live elsewhere. Pass the vault with `npm run deploy -- --vault "<path>"` or set `OBSIDIAN_VAULT`. The script refuses a folder that isn't a vault, says when `npm run build` hasn't been run, and with no vault given lists the vaults Obsidian knows about. Covered by the new `test-deploy.ts`.

### Fixed
- **Pasting Outside the Editor**: The paste shortcut followed the active note rather than keyboard focus. Pasting into a field in the note's own pane, such as the note title or the find bar, added a citation to the open note (*Default handler + source* mode) or sent the paste into the note instead of the field (*Paste content + source* mode). The shortcut is now intercepted only while the note's editor has focus, so other fields get a normal paste and the note is left unchanged.

---

## [1.4.0] - 2026-10-20

### Added
- **Markup-Safe Pasting**: An intercepted paste (`Cmd+V`, `Ctrl+V`, `Shift+Insert`) no longer adds a citation where it would break the surrounding markup: inside fenced code blocks and fence lines, inline code, `$$` math blocks and inline `$…$` math, `%%` comments, the frontmatter, wikilinks, a link's text or `(url)`, after an unclosed `[`, or while typing an HTML tag or attribute. Inline code spans pair backtick runs by length, as in CommonMark, and a lone `$` (a price) doesn't count as math. The explicit paste commands and context menu items still add a citation anywhere.
- **"When a citation can't be added" Setting**: In *Paste content + source* mode, chooses what such a paste does: *Obsidian's native paste* (default), as if the plugin were off, or *Plain clipboard text* without the citation. The setting is hidden in *Default handler + source* mode, where Obsidian's own paste always runs.
- **BRAT Installation**: GitHub releases now carry the built `main.js` and `manifest.json` as assets, tagged with the manifest version, so the plugin can be installed and updated through BRAT. The README describes installing with BRAT, from a release by hand, or from source.

### Fixed
- **Double Paste in *Paste content + source* Mode**: The intercepted shortcut called `preventDefault()` only after waiting for the clipboard's source URL. By then Obsidian's native paste had already run, so the clipboard text appeared twice, once from Obsidian and once with the citation. `preventDefault()` now runs before the listener waits on anything, so the text is inserted once.

---

## [1.3.0] - 2026-09-11

### Added
- **Link Source Templates & Variable Interpolation**:
  - Stateless in-memory `TemplateEngine` supporting `{url}`, `{domain}`, `{page}`, `{path}`, `{date}`, `{time}`, `{timez}`, `{time12h}`, `{time_12}`, `{timezone}`, `{datetime}`, `{datetimez}`, `{datetime12h}`, `{iso}`, and `{link}`.
  - Case-insensitive token replacement with safe retention of unrecognized variables.
  - Multi-line textarea support with literal line breaks and `\n` / `\t` escape sequences.
  - Interactive clickable variable badges in the settings tab for quick tag insertion at the cursor.
  - Real-time live preview box rendering the active citation format against a sample URL.
- **Bolted-On Preset Management**:
  - Authoritative text box architecture: `settings.templateString` is always the single source of truth for active citations.
  - Presets subsystem serving as an assistive UI layer without rigid binding or forced synchronization.
  - Eleven built-in presets: `OneNote Style`, `Italic Attribution`, `Minimal Domain`, `Parenthetical`, `Academic Citation`, `Obsidian Callout`, `Timestamped (ISO 8601)`, `Zulu / UTC Research Log`, `12-Hour Casual`, `Markdown Quote`, and `Raw URL`.
  - Full CRUD operations for custom user presets: Save As New (via modal), Update Preset, and Delete Preset.
  - Built-in presets are protected and immutable.
- **Preset JSON Import & Export**:
  - Export any preset or current template as a standardized `.json` file (`paste-with-source-preset/v1`) via browser Blob download.
  - Import `.json` preset files via HTML5 file input with full schema and error validation.
- **Quick Preset Switcher Hotkeys (Slots A, B, C)**:
  - Hotkeys to switch active citation preset on the fly: <kbd>Ctrl+Alt+A</kbd> (Slot A: editable template), <kbd>Ctrl+Alt+B</kbd> (Slot B: configurable preset, default Minimal Domain), and <kbd>Ctrl+Alt+C</kbd> (Slot C: configurable preset, default Academic Citation).
  - Preserves 100% native Obsidian paste fidelity for HTML headings, bold, tables, lists, and links through standard <kbd>Ctrl+V</kbd>.
  - Instant visual feedback via Obsidian notices on slot activation.
  - Configurable in settings with reactive slot indicators and preset dropdowns.
- **Automated Settings Migration**:
  - Transparent backward-compatible migration of legacy `citationStyle` into equivalent `templateString` and slot defaults.
- **Unit Testing & Benchmarks**:
  - Created `test-templates.ts` covering variable substitutions, case-insensitivity, escapes, domain extraction, schema validation, slot switching and resolution, and high-throughput benchmark (2.8 µs per render).

---

## [1.2.0] - 2026-09-10

### Changed
- **Windows Zero-Binary Architecture**:
  - Replaced out-of-process `ClipboardReader.exe` execution with in-process Electron clipboard bridge (`WindowsClipboardProvider`) reading native `CF_HTML` via `clipboard.readBuffer("HTML Format")`.
  - Achieved sub-microsecond (< 1 µs) URL extraction latency, eliminating process startup overhead.
  - Decoupled clipboard provider factory from the Obsidian vault filesystem and `App` instance.
  - Streamlined `build.ts` to pure TypeScript transpilation, eliminating C# compilation and .NET SDK dependencies.
  - Completely removed the `ClipboardReader/` C# project and all compiled native binaries.
  - Eliminated the requirement for Windows users to install the Microsoft .NET 6 Desktop Runtime.
  - Added zero-binary inline PowerShell fallback (`powershell.exe` querying `System.Windows.Forms.Clipboard`) for maximum resilience.
  - Expanded `test-bplist.ts` suite with Windows `CF_HTML` parser unit tests and performance benchmarks.

---

## [1.1.0] - 2026-09-10

### Added
- **Native macOS Support**:
  - In-process Electron clipboard integration (`MacOSClipboardProvider`) using `require('electron').clipboard`.
  - Chromium browser support: extracts origin URL directly from `org.chromium.source-url` for Google Chrome, Arc, Microsoft Edge, Brave, and Opera.
  - Safari browser support: built-in lightweight zero-dependency Apple binary property list (`bplist00`) decoder (`BplistParser`) to extract `WebResourceURL` from `com.apple.webarchive`.
  - Zero native binary dependencies on macOS (no compilation, codesigning, or Gatekeeper friction).
  - Native `Cmd+V` keyboard paste interception on macOS with settings UI localized for Mac.
  - Added `"isDesktopOnly": true` to `manifest.json`.
  - Updated `build.ts` to output clean distribution bundle in `dist/` and handle cross-platform builds gracefully.

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
