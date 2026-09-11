# Release Notes: Paste with Source for Obsidian

Welcome to the official release of **Paste with Source** (v1.0.0), an Obsidian Desktop plugin that captures the origin URL of copied web content and appends formatted citations directly into your markdown notes.

---

## 🌟 Version 1.0.0 Release Highlights

### 📎 Native Clipboard Source URL Detection
When copying text, snippets, or articles from modern web browsers (Google Chrome, Microsoft Edge, Mozilla Firefox, Brave), the browser attaches metadata to the Windows clipboard containing the source webpage URL. **Paste with Source** leverages a bundled lightweight native companion utility (`ClipboardReader.exe`) to read the Win32 `CF_HTML` format and extract the `SourceURL` header without user intervention.

### ⌨️ Transparent Paste Interception
- **Default On**: Intercept paste events automatically when pressing `Ctrl+V` or `Shift+Insert`.
- **Granular Keystroke Filter**: Choose whether to intercept `Ctrl+V`, `Shift+Insert`, or both.
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
- **Command Palette**: Access actions via `Ctrl+P` / `Cmd+P` without overwriting default clipboard habits.

---

## 💻 System Requirements

| Requirement | Specification |
| :--- | :--- |
| **Obsidian Version** | Desktop App `v0.15.0` or later |
| **Operating System** | Microsoft Windows 10 or Windows 11 |
| **Architecture** | x64 or ARM64 (with Windows x64 emulation) |
| **Runtime Dependency** | [.NET 6.0 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/6.0) |
| **Browser Compatibility** | Any browser providing `CF_HTML` `SourceURL` on copy (Chrome, Edge, Firefox, Brave, Opera) |

> [!WARNING]  
> **Platform Restriction**: This plugin requires Windows and does not support macOS, Linux, or Obsidian Mobile (iOS/Android) due to its dependency on the native Win32 `ClipboardReader.exe` helper.

---

## 📦 Installation & Setup

### Building and Deploying from Source

1. Clone or download this repository into your development directory:
   ```powershell
   git clone https://github.com/your-username/paste-with-source.git
   cd paste-with-source
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Build the TypeScript plugin and compile the C# native helper:
   ```powershell
   npm run build
   ```

4. Deploy directly to your Obsidian vault:
   ```powershell
   npm run deploy
   ```
   *(By default, this copies files to `%USERPROFILE%\Documents\Obsidian Vault\.obsidian\plugins\paste-with-source`)*

5. In Obsidian, navigate to **Settings** > **Community Plugins**, reload plugins, and enable **Paste with Source**.

---

## ⚙️ Configuration Reference

Open Obsidian Settings and locate **Paste with Source Settings**:

| Option | Default | Description |
| :--- | :--- | :--- |
| **Intercept Paste** | `true` (Enabled) | Automatically replaces keyboard paste keystrokes with source-aware pasting. |
| **Intercept Shortcut** | `Both Ctrl+V and Shift+Insert` | Selects which shortcut to monitor: `Both`, `Ctrl+V only`, or `Shift+Insert only`. |
| **Paste Mode** | `Default handler + source` | Chooses between running Obsidian's rich paste first or inserting raw clipboard plain text. |
| **Citation Style** | `OneNote` | Formats citations either as OneNote-style `From <...>` or markdown quote `> — ...`. |
| **Use URL as Link Label** | `true` (Enabled) | Renders links as `[https://...](https://...)` instead of `[Source](https://...)`. |

---

## 🔍 Troubleshooting & Known Behaviors

- **Source URL not appending**: The application from which content was copied must write the registered Windows `CF_HTML` format with a `SourceURL` header to the clipboard. Web browsers do this when copying text; plain text editors (e.g. Notepad) or certain terminal apps do not.
- **Antivirus / Execution Warnings**: Because `ClipboardReader.exe` is a standalone executable invoked by Electron via Node `child_process.execFile`, enterprise security software or Windows Defender SmartScreen might inspect the local binary. Ensure the plugin directory is allowed in your local environment.
- **50ms Delay in Default Mode**: In `Default handler + source` mode, the citation is inserted with a 50ms delay to allow Obsidian's built-in paste pipeline to complete. On high-latency systems or during heavy vault indexing, if paste interleaves, switch to `Paste content + source` (`clipboard+source`) mode for immediate atomic replacement.
