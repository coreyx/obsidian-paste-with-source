# Paste with Source (Obsidian Plugin)

This Obsidian plugin enhances your clipboard pasting workflow by automatically appending a source URL—retrieved from a custom C# utility—to anything you paste.

## ✨ Features

- 📎 Appends the source URL of clipboard content when pasting
- 🧠 Detects source URL using a bundled native helper (`ClipboardReader.exe`)
- 🖱 Adds context menu options for source-aware pasting
- ⌨️ Optionally intercepts Ctrl+V / Shift+Insert to auto-append source
- 🧾 Supports multiple citation styles:
  - OneNote-style: `From <[url](url)>`
  - Markdown quote: `> — [Source](url)`
- 🔗 Option to use the raw URL as the link label or a generic "Source"

---

## Requirements

- ⚠️ This plugin requires `ClipboardReader.exe`, a small native helper to extract the source URL from the clipboard. It is bundled with the plugin and must be present in the plugin folder.

---

## 🧩 Compatibility

- ✅ Works with Obsidian Desktop (Windows)
- ⚠️ Not supported on macOS or Linux (due to native `.exe` dependency)
- 🧪 Requires clipboard content to include a source URL (e.g., copied from a browser)


---

## 📦 Installation

1. Clone or download this repository.
2. Run the build script:

   ```bash
   npm install
   npm run build
   ```

3. Run the deploy script:

   ```bash
   npm run deploy
   ```

4. Enable the plugin in Obsidian under `Settings → Community Plugins`.

---

## 🛠 Build Details

### TypeScript Plugin

- Source: `src/main.ts`
- Output: `main.js` (in root or `dist/`)
- Built using `tsc`

### C# Utility

- Project: `src/ClipboardReader/ClipboardReader.csproj`
- Output: `ClipboardReader.exe`
- Built using `dotnet build -c Release`

---

## ⚙️ Settings

| Setting | Description |
|--------|-------------|
| **Intercept Paste** | Replaces default paste shortcut with a source-aware paste |
| **Paste Mode** | Choose between default paste + source or clipboard text + source |
| **Citation Style** | Choose between OneNote-style or Markdown quote |
| **Use URL as Link Label** | Format links as `[url](url)` instead of `[Source](url)` |

---

## 🧪 Example

If you copy text from a webpage and paste it into Obsidian, the plugin can automatically append:

From <https://example.com>

Or, if using the "Source" style:

— [Source](https://example.com)

---

## 🧪 Commands

| Command Name                  | Description                                      |
|------------------------------|--------------------------------------------------|
| Paste with Source URL        | Clipboard content + source                       |
| Paste Source URL Only        | Just the source link                             |
| Paste (Default) + Source URL | Default paste + source link                      |

---

## 🖱 Context Menu Options

Right-click in the editor to access:

- Paste (Default Handler) + Source URL
- Paste Clipboard with Source URL

---

## ⌨️ Keyboard Shortcuts

If "Intercept Paste" is enabled, the plugin will override:

- `Ctrl+V` (Windows/Linux)
- `Cmd+V` (macOS)
- `Shift+Insert`

And append the source URL automatically based on your settings.

---

## 📁 Folder Structure

```
your-project/
├── src/
│   ├── main.ts
│   └── ClipboardReader/
│       └── ClipboardReader.csproj
├── manifest.json
├── tsconfig.json
├── build.ts
├── deploy.ts
├── dist/
```

---

## 🧠 Notes

- The plugin expects `ClipboardReader.exe` to be located in the same folder as `main.js`.
- The C# utility should return a valid `http` or `https` URL to be appended.
- Works only on desktop (Windows required for the `.exe`).

---

## 📣 Feedback & Contributions

Feel free to open issues or submit pull requests on the [GitHub repository](https://github.com/your-username/paste-with-source) to suggest improvements or report bugs.

---

## 🛡️ Disclaimer

This plugin is not affiliated with or endorsed by Microsoft OneNote or any browser vendor. Use at your own discretion and always back up your data.