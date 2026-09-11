# Paste with Source (Obsidian Plugin)

This Obsidian plugin enhances your clipboard pasting workflow by automatically appending a source URL to anything you paste from the web.

## ✨ Features

- 📎 **Source-Aware Pasting**: Appends the origin webpage URL when pasting content copied from browsers
- 🍎 **macOS Support**: In-process Electron clipboard extraction supporting Chromium browsers (Google Chrome, Arc, Microsoft Edge, Brave, Opera) and Apple Safari (via built-in `bplist00` WebArchive decoding)
- 🪟 **Windows Support**: In-process Electron clipboard extraction with native `CF_HTML` parsing and zero external binary dependencies
- 📝 **Link Source Templates**: Fully customizable citation template engine with `{var}` placeholders (`{url}`, `{domain}`, `{page}`, `{path}`, `{date}`, `{time}`, `{datetime}`, `{iso}`, `{link}`)
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
| **Template Preset** | Select from 11 built-in presets (OneNote, Italic Attribution, Minimal Domain, Parenthetical, Academic, Obsidian Callout, Timestamped ISO 8601, Zulu Log, 12h Casual, Markdown Quote, Raw URL) or your custom presets |
| **Preset Actions** | Save As New, Update, Delete, Export JSON, and Import JSON |
| **Citation Template** | **Authoritative template box** (Preset Slot A) evaluated on paste; accepts `{var}` tags and multi-line markdown |
| **Click to Insert Variable** | Quick-insertion buttons for `{url}`, `{domain}`, `{page}`, `{path}`, `{date}`, etc. |
| **Live Preview** | Real-time preview of the rendered citation using a sample URL |
| **Quick Preset Hotkeys** | Switch active citation preset on the fly via hotkeys (`Ctrl+Shift+A`, `B`, `C`) |

---

## 📋 Template Variables Reference

| Variable | Description | Example Output |
| :--- | :--- | :--- |
| `{url}` | Full origin URL | `https://en.wikipedia.org/wiki/Obsidian_(software)` |
| `{domain}` | Hostname without `www.` | `en.wikipedia.org` |
| `{page}` | Cleaned page/article name from URL path slug | `Obsidian (software)` |
| `{path}` | Raw URL pathname | `/wiki/Obsidian_(software)` |
| `{date}` | Current local date (`YYYY-MM-DD`) | `2026-09-11` |
| `{time}` | Current local 24h time with timezone | `14:30 PDT` |
| `{timez}` | Current UTC/Zulu 24h time (`HH:mmZ`) | `21:30Z` |
| `{time12h}` | Current 12-hour time (`hh:mm AM/PM`) | `02:30 PM` |
| `{time_12}` | Alias for `{time12h}` (backwards compatibility) | `02:30 PM` |
| `{timezone}` | Current timezone code / abbreviation | `PDT` |
| `{datetime}` | Local ISO 8601 24h date/time with timezone offset | `2026-09-11T14:30-07:00` |
| `{datetimez}` | UTC/Zulu ISO 8601 24h date/time (`YYYY-MM-DDTHH:mmZ`) | `2026-09-11T21:30Z` |
| `{datetime12h}` | Local 12-hour date and time (`YYYY-MM-DD hh:mm AM/PM`) | `2026-09-11 02:30 PM` |
| `{iso}` | Full UTC ISO 8601 timestamp with milliseconds | `2026-09-11T21:30:00.000Z` |
| `{link}` | Formatted markdown link | `[https://...](https://...)` or `[Source](https://...)` |
| `\n` | Newline character | Line break |

---

## 🧪 Built-In Preset Examples

If you copy text from a webpage and paste it into Obsidian:

**1. OneNote Style (`\n\nFrom <{link}>`):**
```markdown
Pasted excerpt text...

From <https://example.com/article>
```

**2. Italic Attribution (`\n\n— *Source: [{page}]({url})*`):**
```markdown
Pasted excerpt text...

— *Source: [Article Name](https://example.com/article)*
```

**3. Minimal Domain (`\n\nSource: [{domain}]({url})`):**
```markdown
Pasted excerpt text...

Source: [example.com](https://example.com/article)
```

**4. Parenthetical (`\n\n(Source: [{page}]({url}))`):**
```markdown
Pasted excerpt text...

(Source: [Article Name](https://example.com/article))
```

**5. Academic Citation (`\n\nSource: [{page}]({url}) via {domain} (Accessed: {date})`):**
```markdown
Pasted excerpt text...

Source: [Article Name](https://example.com/article) via example.com (Accessed: 2026-09-11)
```

**6. Obsidian Callout (`\n\n> [!info] Source: [{page}]({url})\n> Accessed on {date}`):**
```markdown
Pasted excerpt text...

> [!info] Source: [Article Name](https://example.com/article)
> Accessed on 2026-09-11
```

**7. Markdown Quote (`\n\n> — [Source]({url})`):**
```markdown
Pasted excerpt text...

> — [Source](https://example.com/article)
```

**8. Raw URL (`\n\n{url}`):**
```markdown
Pasted excerpt text...

https://example.com/article
```

**9. Timestamped (ISO 8601) (`\n\n— *Source: [{page}]({url})* [{datetime}]`):**
```markdown
Pasted excerpt text...

— *Source: [Article Name](https://example.com/article)* [2026-09-11T14:30-07:00]
```

**10. Zulu / UTC Research Log (`\n\nSource: [{page}]({url}) (Retrieved: {datetimez})`):**
```markdown
Pasted excerpt text...

Source: [Article Name](https://example.com/article) (Retrieved: 2026-09-11T21:30Z)
```

**11. 12-Hour Casual (`\n\nSource: [{page}]({url}) ({date} at {time12h})`):**
```markdown
Pasted excerpt text...

Source: [Article Name](https://example.com/article) (2026-09-11 at 02:30 PM)
```

---

## 🧪 Commands & Menu Options

### Commands (Command Palette)
- `Activate Citation Preset A (Editable Template)` (`Ctrl+Shift+A` / `Cmd+Shift+A`)
- `Activate Citation Preset B` (`Ctrl+Shift+B` / `Cmd+Shift+B`)
- `Activate Citation Preset C` (`Ctrl+Shift+C` / `Cmd+Shift+C`)
- `Paste (Default) + Source URL`
- `Paste with Source URL`

### Context Menu (Editor Right-Click)
- `Paste (Default Handler) + Source URL`
- `Paste Clipboard with Source URL`

### Keyboard Shortcuts
- **Standard Paste**: If "Intercept Paste" is enabled, intercepts `Cmd+V` (macOS), `Ctrl+V` (Windows), or `Shift+Insert` (Windows) to append the currently active citation preset.
- **Preset Switcher Hotkeys**:
  - `Ctrl+Shift+A` (`Cmd+Shift+A`): Activate Preset Slot A (Always uses the editable Citation Template from settings)
  - `Ctrl+Shift+B` (`Cmd+Shift+B`): Activate Preset Slot B (Configurable preset, default: *Minimal Domain*)
  - `Ctrl+Shift+C` (`Cmd+Shift+C`): Activate Preset Slot C (Configurable preset, default: *Academic Citation*)
  - *Activating a slot displays a brief Obsidian notification. Normal paste (`Ctrl+V`) always pastes using the active preset.*
  - *All hotkeys can be customized or cleared in Obsidian's **Settings → Hotkeys** menu.*

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