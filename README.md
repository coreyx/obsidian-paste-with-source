# Paste with Source (Obsidian Plugin)

This Obsidian plugin enhances your clipboard pasting workflow by automatically appending a source URL to anything you paste from the web.

## ✨ Features

- 📎 **Source-Aware Pasting**: Appends the origin webpage URL when pasting content copied from browsers
- 🍎 **macOS Support**: In-process Electron clipboard extraction supporting Chromium browsers (Google Chrome, Arc, Microsoft Edge, Brave, Opera) and Apple Safari (via built-in `bplist00` WebArchive decoding)
- 🪟 **Windows Support**: In-process Electron clipboard extraction with native `CF_HTML` parsing and zero external binary dependencies
- 📝 **Link Source Templates**: Fully customizable citation template engine with `{var}` placeholders (`{url}`, `{domain}`, `{title}`, `{date}`, `{time}`, `{datetime}`, `{iso}`, `{link}`, `{source}`)
- 📦 **Presets & JSON Import/Export**: Built-in presets (OneNote, Markdown Quote, Academic), custom preset saving, and one-click JSON import/export
- 👁️ **Authoritative Text Box & Live Preview**: The editable text area is always the single source of truth, backed by interactive variable pills and real-time live preview
- ⌨️ **Keyboard Interception**: Optionally intercepts `Cmd+V` (macOS) or `Ctrl+V` / `Shift+Insert` (Windows) to auto-append source
- 🖱 **Context Menu Actions**: Adds right-click editor menu options for source-aware pasting
- 🔗 **Configurable Link Labels**: Format citations as `[url](url)` or generic `[Source](url)`

---

## 🧩 Compatibility & Requirements

| Platform | Supported | Details & Requirements |
| :--- | :---: | :--- |
| **macOS Desktop** | ✅ Yes | In-process Electron extraction. Zero external binary or runtime installation required. Works with Chrome, Safari, Arc, Edge, Brave. |
| **Windows Desktop** | ✅ Yes | In-process Electron extraction (`CF_HTML`). Zero external binary or runtime installation required (.NET no longer needed). Works with Chrome, Edge, Firefox, Brave, Arc, Opera. |
| **Linux Desktop** | ⚠️ No | Linux clipboard targets currently unsupported. |
| **Mobile (iOS/Android)**| ⚠️ No | Obsidian Mobile does not support native desktop clipboard APIs. |

---

## 📦 Installation

### Option 1: Copy Pre-Built Files
Copy `main.js` and `manifest.json` from the [`dist/`](dist/) folder into your Obsidian vault:
```bash
<Your-Vault>/.obsidian/plugins/paste-with-source/
```

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
| **Use URL as Link Label** | Format `{link}` as `[url](url)` instead of `[Source](url)` |
| **Template Preset** | Select from built-in presets (OneNote, Markdown Quote, Academic) or your custom presets |
| **Preset Actions** | Save As New, Update, Delete, Export JSON, and Import JSON |
| **Citation Template** | **Authoritative template box** evaluated on paste; accepts `{var}` tags and multi-line markdown |
| **Click to Insert Variable** | Quick-insertion buttons for `{url}`, `{domain}`, `{date}`, `{time}`, etc. |
| **Live Preview** | Real-time preview of the rendered citation using a sample URL |

---

## 📋 Template Variables Reference

| Variable | Description | Example Output |
| :--- | :--- | :--- |
| `{url}` | Full origin URL | `https://en.wikipedia.org/wiki/Obsidian_(software)` |
| `{domain}` | Hostname without `www.` | `en.wikipedia.org` |
| `{title}` | Page title or clean domain fallback | `en.wikipedia.org` |
| `{date}` | Current local date (`YYYY-MM-DD`) | `2026-09-11` |
| `{time}` | Current local time (`HH:mm`) | `14:30` |
| `{time_12}` | Current 12-hour time (`hh:mm A`) | `02:30 PM` |
| `{datetime}` | Combined date and time | `2026-09-11 14:30` |
| `{iso}` | UTC ISO-8601 timestamp | `2026-09-11T21:30:00.000Z` |
| `{link}` | Formatted markdown link | `[https://...](https://...)` or `[Source](https://...)` |
| `{source}` | Literal label `"Source"` | `Source` |
| `\n` | Newline character | Line break |

---

## 🧪 Citation Examples

If you copy text from a webpage and paste it into Obsidian:

**OneNote Style Preset (`\n\nFrom <{link}>`):**
```markdown
Pasted excerpt text...

From <https://example.com/article>
```

**Markdown Blockquote Preset (`\n\n> — [Source]({url})`):**
```markdown
Pasted excerpt text...

> — [Source](https://example.com/article)
```

**Academic Citation Preset (`\n\n> Source: [{domain}]({url}) (Accessed: {date})`):**
```markdown
Pasted excerpt text...

> Source: [example.com](https://example.com/article) (Accessed: 2026-09-11)
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

- **Pure TypeScript Architecture**: 100% in-process TypeScript transpiled to `main.js` using `tsc`. Zero external compilers, .NET SDKs, or native binaries required.
- **Cross-Platform**: Unified codebase running on both macOS and Windows via Electron's clipboard APIs.
- **Distribution**: Build outputs (`main.js` and `manifest.json`) are staged automatically into [`dist/`](dist/).

---

## 📁 Project Structure

```text
paste-with-source/
├── dist/                     # Distribution files (ready to copy to vault)
│   ├── main.js
│   └── manifest.json
├── spec/                     # Architecture, requirements, and tech specs
│   ├── paste-with-source/
│   ├── macos-support/
│   ├── windows-zero-binary/
│   └── link-source-templates/
├── main.ts                   # Core plugin logic, template engine & UI
├── manifest.json             # Obsidian plugin manifest
├── build.ts                  # Pure TypeScript build script
├── deploy.ts                 # Vault deployment script
├── test-bplist.ts            # Unit tests for macOS WebArchive & Windows CF_HTML parsers
└── test-templates.ts         # Unit tests for template engine & preset import/export
```

---

## 📣 Feedback & Contributions

Feel free to open issues or submit pull requests on the GitHub repository to suggest improvements or report bugs.

---

## 🛡️ Disclaimer

This plugin is not affiliated with or endorsed by Microsoft OneNote or any browser vendor. Use at your own discretion and always back up your data.