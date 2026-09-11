# Release Notes: Paste with Source for Obsidian

Welcome to **Paste with Source** (v1.1.0), an Obsidian Desktop plugin that captures the origin URL of copied web content and appends formatted citations directly into your markdown notes.

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
| **Runtime Dependency** | *None* (runs in-process via Electron) | [.NET 6.0 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/6.0) |
| **Supported Browsers** | Chrome, Safari, Arc, Edge, Brave, Opera | Chrome, Edge, Firefox, Brave, Opera |

> [!NOTE]  
> Mobile platforms (iOS and Android) and Linux desktop clipboard targets are currently not supported.

---

## 📦 Installation & Quickstart

### Option 1: Copy Distribution Files
1. Copy `main.js` and `manifest.json` from [`dist/`](dist/) into:
   ```bash
   <Your-Obsidian-Vault>/.obsidian/plugins/paste-with-source/
   ```
   *(On Windows, also include `ClipboardReader.exe` in that directory).*
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
  - **Windows**: Content must be copied from an application that populates the `CF_HTML` format with a `SourceURL:` header. Ensure [.NET 6.0 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/6.0) is installed.
- **50ms Delay in Default Mode**: In `Default handler + source` mode, the citation is appended after a 50ms delay to allow Obsidian's internal markdown parser to finish. If cursor positioning feels inconsistent during heavy load, switch to `Paste content + source` (`clipboard+source`) mode for atomic paste replacement.

