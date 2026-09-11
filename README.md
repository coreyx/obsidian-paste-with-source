# Paste with Source (Obsidian Plugin)

This Obsidian plugin enhances your clipboard pasting workflow by automatically appending a source URL to anything you paste from the web.

## ✨ Features

- 📎 **Source-Aware Pasting**: Appends the origin webpage URL when pasting content copied from browsers
- 🍎 **macOS Support**: In-process Electron clipboard extraction supporting Chromium browsers (Google Chrome, Arc, Microsoft Edge, Brave, Opera) and Apple Safari (via built-in `bplist00` WebArchive decoding)
- 🪟 **Windows Support**: Native extraction via bundled lightweight helper (`ClipboardReader.exe`)
- ⌨️ **Keyboard Interception**: Optionally intercepts `Cmd+V` (macOS) or `Ctrl+V` / `Shift+Insert` (Windows) to auto-append source
- 🖱 **Context Menu Actions**: Adds right-click editor menu options for source-aware pasting
- 🧾 **Multiple Citation Styles**:
  - OneNote-style: `From <[url](url)>`
  - Markdown quote: `> — [Source](url)`
- 🔗 **Configurable Link Labels**: Format citations as `[url](url)` or generic `[Source](url)`

---

## 🧩 Compatibility & Requirements

| Platform | Supported | Details & Requirements |
| :--- | :---: | :--- |
| **macOS Desktop** | ✅ Yes | In-process Electron extraction. No external binary or runtime installation required. Works with Chrome, Safari, Arc, Edge, Brave. |
| **Windows Desktop** | ✅ Yes | Uses bundled `ClipboardReader.exe`. Requires [.NET 6 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/6.0). |
| **Linux Desktop** | ⚠️ No | Linux clipboard targets currently unsupported. |
| **Mobile (iOS/Android)**| ⚠️ No | Obsidian Mobile does not support native desktop clipboard APIs. |

---

## 📦 Installation

### Option 1: Copy Pre-Built Files
Copy `main.js` and `manifest.json` from the [`dist/`](dist/) folder into your Obsidian vault:
```bash
<Your-Vault>/.obsidian/plugins/paste-with-source/
```
*(On Windows, also copy `ClipboardReader.exe` into that folder).*

Then enable the plugin in Obsidian under **Settings → Community Plugins**.

### Option 2: Build from Source

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/paste-with-source.git
   cd paste-with-source
   ```

2. Install dependencies and compile:
   ```bash
   npm install
   npm run build
   ```

3. Deploy to your local vault:
   ```bash
   npm run deploy
   ```

4. Enable the plugin in Obsidian under **Settings → Community Plugins**.

---

## ⚙️ Settings

| Setting | Description |
| :--- | :--- |
| **Intercept Paste** | Automatically replaces standard paste with a source-aware paste |
| **Intercept Shortcut** | Choose which shortcut to intercept (`Cmd+V` on macOS; `Both`, `Ctrl+V only`, or `Shift+Insert only` on Windows) |
| **Paste Mode** | Choose between default handler + source link or plain clipboard text + source link |
| **Citation Style** | Choose between OneNote-style (`From <...>`) or Markdown blockquote (`> — ...`) |
| **Use URL as Link Label** | Format links as `[url](url)` instead of `[Source](url)` |

---

## 🧪 Citation Examples

If you copy text from a webpage and paste it into Obsidian:

**OneNote Style:**
```markdown
Pasted excerpt text...

From <https://example.com/article>
```

**Markdown Blockquote Style:**
```markdown
Pasted excerpt text...

> — [Source](https://example.com/article)
```

---

## 🧪 Commands & Menu Options

### Commands (Command Palette)
- `Paste (Default) + Source URL`
- `Paste with Source URL`

### Context Menu (Editor Right-Click)
- `Paste (Default Handler) + Source URL`
- `Paste Clipboard with Source URL`

### Keyboard Shortcuts
If "Intercept Paste" is enabled, the plugin intercepts:
- `Cmd+V` (macOS)
- `Ctrl+V` (Windows)
- `Shift+Insert` (Windows)

---

## 🛠 Build Details

- **TypeScript Plugin**: Transpiles `main.ts` into `main.js` using `tsc`.
- **Windows Companion**: Compiles `ClipboardReader/ClipboardReader.csproj` into `ClipboardReader.exe` using `dotnet build -c Release` (automatically skipped when building on macOS).
- **Distribution**: Artifacts are automatically staged into the `dist/` directory.

---

## 📁 Project Structure

```text
paste-with-source/
├── ClipboardReader/          # Native C# helper for Windows CF_HTML
│   ├── ClipboardReader.csproj
│   └── Program.cs
├── dist/                     # Distribution files (ready to copy to vault)
│   ├── main.js
│   ├── manifest.json
│   └── ClipboardReader.exe   # (Windows only)
├── spec/                     # Architecture, requirements, and tech specs
│   ├── paste-with-source/
│   └── macos-support/
├── main.ts                   # Core plugin logic & macOS Electron provider
├── manifest.json             # Obsidian plugin manifest
├── build.ts                  # Cross-platform build script
├── deploy.ts                 # Vault deployment script
└── test-bplist.ts            # Unit tests for Safari WebArchive decoder
```

---

## 📣 Feedback & Contributions

Feel free to open issues or submit pull requests on the GitHub repository to suggest improvements or report bugs.

---

## 🛡️ Disclaimer

This plugin is not affiliated with or endorsed by Microsoft OneNote or any browser vendor. Use at your own discretion and always back up your data.