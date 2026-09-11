# Release Notes: Paste with Source for Obsidian

Welcome to **Paste with Source** (v1.3.0), an Obsidian Desktop plugin that captures the origin URL of copied web content and appends formatted citations directly into your markdown notes.

---

## 🌟 What's New in Version 1.3.0: Link Source Templates & Preset System

### 📝 Customizable Citation Templates
Take full control over how citations are formatted in your notes!
- **`{var}` Variable Substitution**: Compose custom citation formats using intuitive placeholders:
  - `{url}`: Full source URL
  - `{domain}`: Clean hostname (e.g. `en.wikipedia.org`)
  - `{page}`: Cleaned page/article name derived from URL path slug (e.g. `Obsidian (software)`)
  - `{path}`: Raw URL pathname (e.g. `/wiki/Obsidian_(software)`)
  - `{date}`: Current local date (`YYYY-MM-DD`)
  - `{time}`: Current local 24-hour time with timezone (e.g. `14:30 PDT`)
  - `{timez}`: Current UTC/Zulu 24-hour time in ISO 8601 (`HH:mmZ`, e.g. `21:30Z`)
  - `{time12h}`: Current 12-hour time (`hh:mm AM/PM`, e.g. `02:30 PM`)
  - `{time_12}`: Alias for `{time12h}` (backwards compatibility)
  - `{timezone}`: Current timezone code / abbreviation (e.g. `PDT`, `EST`, `UTC`)
  - `{datetime}`: Local ISO 8601 24h date/time with timezone offset (e.g. `2026-09-11T14:30-07:00`)
  - `{datetimez}`: UTC/Zulu ISO 8601 24h date/time (`YYYY-MM-DDTHH:mmZ`, e.g. `2026-09-11T21:30Z`)
  - `{datetime12h}`: Local 12-hour date and time (`YYYY-MM-DD hh:mm AM/PM`)
  - `{iso}`: Full UTC ISO-8601 timestamp with milliseconds
  - `{link}`: Formatted markdown link (`[url](url)` or `[Source](url)`)
  - `\n`: Multi-line formatting and line breaks
- **Authoritative Text Box**: The editable text area in Settings is always the single source of truth for your active citation template. Edits take effect immediately.
- **Interactive Insertion Pills**: Click handy variable badges below the template box to insert tags at your cursor position instantly.
- **Dynamic Live Preview**: See exactly how your citation will look in real-time as you type, rendered with a sample URL.

### 📦 Bolted-On Presets & JSON Import/Export
- **Built-In Presets (11 Curated Options)**:
  - `OneNote Style` (`\n\nFrom <{link}>`): Replicates classic Microsoft OneNote web paste behavior.
  - `Italic Attribution` (`\n\n— *Source: [{page}]({url})*`): Clean editorial dash with italicized page link.
  - `Minimal Domain` (`\n\nSource: [{domain}]({url})`): Clean source link using the domain name.
  - `Parenthetical` (`\n\n(Source: [{page}]({url}))`): Unobtrusive parenthetical citation.
  - `Academic Citation` (`\n\nSource: [{page}]({url}) via {domain} (Accessed: {date})`): Formal attribution with access date.
  - `Obsidian Callout` (`\n\n> [!info] Source: [{page}]({url})\n> Accessed on {date}`): Native styled Obsidian callout.
  - `Timestamped (ISO 8601)` (`\n\n— *Source: [{page}]({url})* [{datetime}]`): Editorial citation with ISO 8601 local timestamp and timezone offset.
  - `Zulu / UTC Research Log` (`\n\nSource: [{page}]({url}) (Retrieved: {datetimez})`): Research citation formatted in 24h UTC/Zulu ISO 8601.
  - `12-Hour Casual` (`\n\nSource: [{page}]({url}) ({date} at {time12h})`): Human-friendly citation with 12-hour AM/PM access timestamp.
  - `Markdown Quote` (`\n\n> — [Source]({url})`): Blockquoted markdown attribution.
  - `Raw URL` (`\n\n{url}`): Plain origin URL without markdown links.
- **Preset Management**: Save the current text area as a new named preset, update custom presets, or delete presets you no longer need (built-in presets are protected).
- **JSON File Import & Export**:
  - Export any preset as a standalone `.json` file to backup or share with your team.
  - Import `.json` preset files with automatic schema validation.

### ⚡ Quick Preset Switcher Hotkeys (Slots A, B, C)
Switch between citation styles on the fly with dedicated hotkeys, keeping your workflow frictionless:
- **`Ctrl+Shift+A` (`Cmd+Shift+A`)**: Activate Preset Slot A (Always uses your editable Citation Template from settings).
- **`Ctrl+Shift+B` (`Cmd+Shift+B`)**: Activate Preset Slot B (Configurable preset, defaults to *Minimal Domain*).
- **`Ctrl+Shift+C` (`Cmd+Shift+C`)**: Activate Preset Slot C (Configurable preset, defaults to *Academic Citation*).
- **Native Paste Fidelity**: Standard paste (<kbd>Ctrl+V</kbd>) continues through Obsidian's native paste handler, preserving rich HTML conversion (headings `#`, bold `**`, tables, lists, links) with 100% fidelity while appending the currently active citation format.
- **Instant Visual Feedback**: Switching slots triggers a brief Obsidian notification showing the activated preset name.
- **Customizable**: Rebind or clear hotkeys at any time in Obsidian's **Settings → Hotkeys**.

---

## 🌟 What's New in Version 1.2.0: Windows Zero-Binary Architecture

### 🪟 In-Process Windows Clipboard Integration
We have eliminated the native compiled binary (`ClipboardReader.exe`) and [.NET 6.0 Desktop Runtime] dependency entirely on Windows!
- **Pure In-Process Execution**: Windows clipboard extraction now directly accesses Electron's in-process `clipboard.readBuffer("HTML Format")` API, reading Win32 `CF_HTML` streams in sub-microseconds (< 1 µs) — over 60,000x faster than out-of-process process spawning.
- **Zero Runtime Dependencies**: Windows users no longer need to install the Microsoft .NET 6 Desktop Runtime. The plugin runs out-of-the-box with zero setup friction.
- **Zero Antivirus Friction**: Eliminating external `.exe` binaries prevents false-positive flags or sandboxing delays from corporate endpoint security scanners.
- **Inline PowerShell Fallback**: Includes a built-in, zero-binary fallback using Windows PowerShell (`powershell.exe`) and `System.Windows.Forms.Clipboard` for maximum resilience if Electron buffers are temporarily unavailable.
- **100% Pure TypeScript**: The entire codebase is now unified in TypeScript across both Windows and macOS, simplifying builds, debugging, and community contributions.

---

## 🌟 What's New in Version 1.1.0: Native macOS Support

### 🍎 In-Process macOS Clipboard Integration
We are excited to bring full native macOS support to **Paste with Source**! 
- **Chromium Browsers**: Automatically extracts the canonical source URL via `org.chromium.source-url` for **Google Chrome**, **Arc**, **Microsoft Edge**, **Brave**, and **Opera**.
- **Apple Safari**: Embedded a zero-dependency in-memory Apple Binary Property List (`bplist00`) parser to extract the `WebResourceURL` directly from Safari's `com.apple.webarchive` clipboard data.
- **Zero Native Binaries on macOS**: Operates entirely in-process using Obsidian's embedded Electron clipboard API. No native helper executable, no Gatekeeper security warnings, and no codesigning or notarization issues.
- **Universal Architecture**: Runs natively on both **Apple Silicon** (M1/M2/M3/M4) and **Intel** Macs.

### ⌨️ Native `Cmd+V` Keyboard Interception
- Automatically intercepts `Cmd+V` on macOS keyboards when paste interception is enabled.
- Settings UI dynamically displays Mac-specific keybindings (`Cmd+V only` / `Cmd+V (Default)`).

### 📦 Enhanced Cross-Platform Build & Distribution
- The build script now outputs clean distribution artifacts directly to [`dist/`](dist/).
- On macOS developer machines, `npm run build` gracefully skips Windows `.NET` builds.

---

## 🌟 Core Features (v1.0.0 & v1.1.0)

### 📎 Source-Aware Pasting
Whenever you copy text or articles from web browsers, the plugin identifies the origin URL and appends it to your pasted notes.

### ⌨️ Transparent Paste Interception
- **Default On**: Intercept paste events automatically when pressing `Cmd+V` (macOS) or `Ctrl+V` / `Shift+Insert` (Windows).
- **Flexible Modes**:
  - **Default Handler + Source** (`default+source`): Permits Obsidian's native rich markdown paste processing to run normally, then appends the citation link 50ms later.
  - **Clipboard Text + Source** (`clipboard+source`): Intercepts the raw plain text from `navigator.clipboard` and pastes text and citation in a single atomic editor replacement.

### 🧾 Flexible Citation Formatting
- **OneNote Citation Style**:
  ```markdown
  From <https://example.com/article>
  ```
  or
  ```markdown
  From <[Source](https://example.com/article)>
  ```
- **Markdown Quote Style**:
  ```markdown
  > — [https://example.com/article](https://example.com/article)
  ```
  or
  ```markdown
  > — [Source](https://example.com/article)
  ```
- **Link Label Customization**: Toggle between displaying the full raw URL as the link title or a clean, generic `[Source]` label.

### 🖱 Context Menu & Command Palette Integration
- **Context Menu**: Right-click anywhere in the Obsidian editor to trigger:
  - `Paste (Default Handler) + Source URL`
  - `Paste Clipboard with Source URL`
- **Command Palette**: Access actions via `Cmd+P` (macOS) / `Ctrl+P` (Windows).

---

## 💻 System Compatibility

| Requirement | macOS | Windows |
| :--- | :--- | :--- |
| **Obsidian Version** | Desktop App `v0.15.0`+ | Desktop App `v0.15.0`+ |
| **Operating System** | macOS 10.15 (Catalina) through macOS 15+ (Sequoia) | Windows 10 or Windows 11 |
| **Architecture** | Apple Silicon (`arm64`) & Intel (`x86_64`) | x64 & ARM64 |
| **Runtime Dependency** | *None* (runs in-process via Electron) | *None* (runs in-process via Electron) |
| **Supported Browsers** | Chrome, Safari, Arc, Edge, Brave, Opera | Chrome, Edge, Firefox, Brave, Arc, Opera |

> [!NOTE]  
> Mobile platforms (iOS and Android) and Linux desktop clipboard targets are currently not supported.

---

## 📦 Installation & Quickstart

### Option 1: Copy Distribution Files
1. Copy `main.js` and `manifest.json` from [`dist/`](dist/) into:
   ```bash
   <Your-Obsidian-Vault>/.obsidian/plugins/paste-with-source/
   ```
2. Open Obsidian, go to **Settings → Community Plugins**, click **Reload plugins**, and enable **Paste with Source**.

### Option 2: Build from Source
```bash
git clone https://github.com/your-username/paste-with-source.git
cd paste-with-source
npm install
npm run build
npm run deploy
```

---

## ⚙️ Configuration Reference

Open Obsidian Settings and locate **Paste with Source Settings**:

| Option | Default | Description |
| :--- | :--- | :--- |
| **Intercept Paste** | `true` (Enabled) | Automatically replaces keyboard paste keystrokes with source-aware pasting. |
| **Intercept Shortcut** | Platform default (`Cmd+V` on macOS; `Both` on Windows) | Choose which shortcut to monitor (`Cmd+V`, `Both`, `Ctrl+V only`, or `Shift+Insert only`). |
| **Paste Mode** | `Default handler + source` | Chooses between running Obsidian's rich paste first or inserting raw clipboard plain text. |
| **Citation Style** | `OneNote` | Formats citations either as OneNote-style `From <...>` or markdown quote `> — ...`. |
| **Use URL as Link Label** | `true` (Enabled) | Renders links as `[https://...](https://...)` instead of `[Source](https://...)`. |

---

## 🔍 Troubleshooting & Known Behaviors

- **Source URL not appearing**:
  - **macOS**: Ensure you are copying from a supported browser (Google Chrome, Apple Safari, Arc, Microsoft Edge, Brave, Opera). Browsers that do not populate `org.chromium.source-url` or `com.apple.webarchive` (such as Mozilla Firefox for regular text selections) cannot provide source URLs.
  - **Windows**: Content must be copied from an application that populates the `CF_HTML` format with a `SourceURL:` header (Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, Arc, Opera).
- **50ms Delay in Default Mode**: In `Default handler + source` mode, the citation is appended after a 50ms delay to allow Obsidian's internal markdown parser to finish. If cursor positioning feels inconsistent during heavy load, switch to `Paste content + source` (`clipboard+source`) mode for atomic paste replacement.

