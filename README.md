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
- 🛡️ **Markup-Safe Pasting**: Skips the citation when you paste inside code, math, comments, frontmatter, links, or wikilinks, where it would break the markup
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

Requires Obsidian **1.1.1** or later.

---

## 📦 Installation

Paste with Source isn't listed in Obsidian's Community Plugins browser yet. Install it with BRAT, which also keeps it updated, or from a GitHub release by hand.

> [!NOTE]
> Don't download `main.ts` from the repository and rename it to `main.js`. That file is the TypeScript source, and Obsidian fails to load it with `SyntaxError: Cannot use import statement outside a module`. The installable `main.js` is attached to each [release](https://github.com/coreyx/paste-with-source/releases).

### Option 1: BRAT (Recommended)
[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) installs plugins straight from their GitHub releases and checks for new versions.

1. In Obsidian, open **Settings → Community plugins**, turn off **Restricted mode** if it's on, then **Browse**, search for **BRAT**, and install and enable it.
2. Open the command palette (`Ctrl+P` / `Cmd+P`) and run **BRAT: Add a beta plugin for testing**.
3. Enter the repository `coreyx/paste-with-source` (or `https://github.com/coreyx/paste-with-source`), choose the latest version, and select **Add Plugin**.
4. Enable **Paste with Source** under **Settings → Community plugins**.

BRAT installs the files from the newest GitHub release and updates the plugin when a new release is published. You can also check for updates with **BRAT: Check for updates to all beta plugins**.

### Option 2: Download a Release
1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/coreyx/paste-with-source/releases/latest).
2. Put both files in your vault's plugin folder, creating it if needed:
   ```text
   <Your-Vault>/.obsidian/plugins/paste-with-source/
   ```
3. Reload Obsidian, then enable **Paste with Source** under **Settings → Community plugins**.

To update, replace the two files with the ones from a newer release.

### Option 3: Build from Source

1. Clone this repository:
   ```bash
   git clone https://github.com/coreyx/paste-with-source.git
   cd paste-with-source
   ```

2. Install dependencies and compile:
   ```bash
   npm install
   npm run build
   ```
   This stages `main.js` and `manifest.json` in `dist/`.

3. Copy `dist/main.js` and `dist/manifest.json` into `<Your-Vault>/.obsidian/plugins/paste-with-source/`. `npm run deploy -- --vault "<path to vault>"` does this for you, or set the `OBSIDIAN_VAULT` environment variable to the vault once and run `npm run deploy`. The script refuses a folder without a `.obsidian` folder, and with no vault given it lists the vaults Obsidian knows about.

4. Enable the plugin in Obsidian under **Settings → Community Plugins**.

---

## ⚙️ Settings

| Setting | Description |
| :--- | :--- |
| **Intercept Paste** | Automatically replaces standard paste with a source-aware paste |
| **Intercept Shortcut** | Choose which shortcut to intercept (`Cmd+V` on macOS; `Both`, `Ctrl+V only`, or `Shift+Insert only` on Windows) |
| **Paste Mode** | Choose between default handler + source link or plain clipboard text + source link |
| **When a citation can't be added** | Shown only with Paste Mode set to *Paste content + source*. Chooses what a paste does where no citation is added (see **When No Citation Is Added** below): *Obsidian's native paste* (default), exactly as if the plugin were off, or *Plain clipboard text* |
| **Use URL as Link Label** | Format `{link}` as `[url](url)` instead of `[Source](url)` |
| **Template Preset** | Select from 11 built-in presets (OneNote, Italic Attribution, Minimal Domain, Parenthetical, Academic, Obsidian Callout, Timestamped ISO 8601, Zulu Log, 12h Casual, Markdown Quote, Raw URL) or your custom presets |
| **Preset Actions** | Save As New, Update, Delete, Export JSON, and Import JSON |
| **Citation Template** | **Authoritative template box** (Preset Slot A) evaluated on paste; accepts `{var}` tags and multi-line markdown |
| **Click to Insert Variable** | Quick-insertion buttons for `{url}`, `{domain}`, `{page}`, `{path}`, `{date}`, etc. |
| **Live Preview** | Real-time preview of the rendered citation using a sample URL |
| **Quick Preset Hotkeys** | **Active Preset Slot** picks which slot pastes use; **Preset Slot B** and **Preset Slot C** choose the preset each slot holds (Slot A is always the Citation Template). Switch slots on the fly with `Ctrl+Alt+A`, `B`, `C` |

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

From <[https://example.com/article](https://example.com/article)>
```
With **Use URL as Link Label** turned off, `{link}` becomes `[Source](https://example.com/article)` instead.

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
- `Activate Citation Preset A (Editable Template)` (`Ctrl+Alt+A` / `Cmd+Opt+A`)
- `Activate Citation Preset B` (`Ctrl+Alt+B` / `Cmd+Opt+B`)
- `Activate Citation Preset C` (`Ctrl+Alt+C` / `Cmd+Opt+C`)
- `Paste (Default) + Source URL`
- `Paste with Source URL`

### Context Menu (Editor Right-Click)
- `Paste (Default Handler) + Source URL`
- `Paste Clipboard with Source URL`

### Keyboard Shortcuts
- **Standard Paste**: If "Intercept Paste" is enabled, intercepts `Cmd+V` (macOS), `Ctrl+V` (Windows), or `Shift+Insert` (Windows) to append the currently active citation preset. The shortcut is intercepted only while a note's editor has keyboard focus. A paste into any other field, such as the search box, the find bar or a settings field, is left to Obsidian, and nothing is added to the open note.
- **Preset Switcher Hotkeys**:
  - `Ctrl+Alt+A` (`Cmd+Opt+A`): Activate Preset Slot A (Always uses the editable Citation Template from settings)
  - `Ctrl+Alt+B` (`Cmd+Opt+B`): Activate Preset Slot B (Configurable preset, default: *Minimal Domain*)
  - `Ctrl+Alt+C` (`Cmd+Opt+C`): Activate Preset Slot C (Configurable preset, default: *Academic Citation*)
  - *Activating a slot displays a brief Obsidian notification. Normal paste (`Ctrl+V`) always pastes using the active preset.*
  - *All hotkeys can be customized or cleared in Obsidian's **Settings → Hotkeys** menu.*

---

## 🛡️ When No Citation Is Added

An intercepted paste (`Cmd+V`, `Ctrl+V`, or `Shift+Insert`) adds no citation when the cursor is somewhere a citation would break the surrounding markup:

- **Code**: inside a fenced code block (```` ``` ```` or `~~~`, including in blockquotes and lists), on a fence line, or inside `` `inline code` ``
- **Math**: inside a `$$` block, or inside inline `$…$`. A lone dollar sign, as in "paid $5 for", is treated as a price, not math.
- **Comments**: inside an Obsidian `%% comment %%`, on one line or several
- **Frontmatter**: anywhere in the YAML properties block at the top of the note
- **Links**: inside `[[wikilink]]`, a link's `[text]`, an image's `![alt]`, or a link's `(url)`, or after an unclosed `[` on the same line. Task checkboxes like `- [ ]` and escaped `\[` don't count.
- **HTML**: right after `<` or `="` while you type a tag or attribute

Markers inside one construct don't count in another: a `%%` in a code block doesn't start a comment. An unclosed `$$` or `%%` makes the rest of the note count as math or a comment, so a stray marker leaves later pastes without a citation instead of breaking anything.

What the paste does instead depends on **Paste Mode**:

- **Default handler + source**: Obsidian's own paste always runs; only the citation is skipped.
- **Paste content + source**: set by **When a citation can't be added**. *Obsidian's native paste* (the default) behaves exactly as if the plugin were off. *Plain clipboard text* inserts the clipboard's text, as this mode does elsewhere, but without the citation.

This applies only to the intercepted keyboard paste. The **Paste with Source URL** and **Paste (Default) + Source URL** commands and context menu items add a citation wherever the cursor is, so you can still add one deliberately.

---

## 🛠 Build Details

- **Pure TypeScript Architecture**: 100% in-process TypeScript transpiled to `main.js` using `tsc`. Zero external compilers, .NET SDKs, or native binaries required.
- **Cross-Platform**: Unified codebase running on both macOS and Windows via Electron's clipboard APIs.
- **Distribution**: Build outputs (`main.js` and `manifest.json`) are staged automatically into `dist/`. That folder isn't committed; each GitHub release carries the same two files as assets, tagged with the version in `manifest.json`, which is the layout BRAT installs from.
- **Tests**: `npm test` compiles the project with `tsc`, runs every `test-*.ts` file in the project root, and prints a `PASS`/`FAIL` summary, exiting non-zero if anything failed. The test files load the compiled `main.js`, not `main.ts`, so to run one directly, run `tsc` first and then `node test-<name>.js`.

---

## 📁 Project Structure

```text
paste-with-source/
├── dist/                     # Build output, not committed (ready to copy to vault)
│   ├── main.js
│   └── manifest.json
├── spec/                     # Architecture, requirements, plans, and walkthroughs, one folder per change
│   ├── paste-with-source/
│   ├── macos-support/
│   ├── windows-zero-binary/
│   ├── link-source-templates/
│   ├── paste-context-guard/
│   ├── paste-outside-editor/
│   ├── deploy-vault-path/
│   └── npm-test-script/
├── main.ts                   # Core plugin logic, template engine & UI
├── manifest.json             # Obsidian plugin manifest
├── package.json              # npm scripts: build, deploy, test
├── tsconfig.json             # TypeScript compiler settings
├── CHANGELOG.md              # Change history by version
├── RELEASE_NOTES.md          # What's new in each release
├── LICENSE                   # MIT license
├── build.ts                  # Pure TypeScript build script
├── deploy.ts                 # Vault deployment script
├── run-tests.ts              # Test runner behind `npm test`
├── test-bplist.ts            # Unit tests for macOS WebArchive & Windows CF_HTML parsers
├── test-deploy.ts            # Unit tests for the deploy script's vault path resolution
├── test-paste-guard.ts       # Unit tests for the paste position guard & paste shortcut handling
└── test-templates.ts         # Unit tests for template engine & preset import/export
```

---

## 📣 Feedback & Contributions

Feel free to open issues or submit pull requests on the GitHub repository to suggest improvements or report bugs.

---

## 📄 License

Released under the [MIT License](LICENSE). Copyright (c) 2025-2026 Corey Struzan.

---

## 🛡️ Disclaimer

This plugin is not affiliated with or endorsed by Microsoft OneNote or any browser vendor. Use at your own discretion and always back up your data.