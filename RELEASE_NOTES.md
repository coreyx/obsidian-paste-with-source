# Release Notes: Paste with Source for Obsidian

Welcome to **Paste with Source** (v1.8.0), an Obsidian Desktop plugin that captures the origin URL of copied web content and appends formatted citations directly into your markdown notes.

---

## 🌟 What's New in Version 1.8.0: Real Reddit Titles and Smoother Pasting

### 🧵 Reddit Posts Get Their Real Titles
Pasting from a Reddit post used to give a citation labeled just "Reddit". It now reads the way the post appears on the site:

```markdown
From: [An Example Post - r/ExampleSub](https://www.reddit.com/r/ExampleSub/comments/…) – www.reddit.com
```

That works for comment links too, which get their post's title. A subreddit's front page reads `r/ExampleSub`, straight away. For any other Reddit page, such as a share link, the citation keeps the URL rather than the unhelpful "Reddit".

Reddit answers a plain request for a post with a bot-check page, so the plugin asks Reddit's oEmbed service for the title instead. It's still a single request to reddit.com, made only when your citation uses the page title. If it fails, the URL stays, as it does for any page without a title.

### 🐛 Fixed
- **Paste (Default Handler) + Source URL now pastes.** The right-click item and its command **Paste (Default) + Source URL** used to add the citation without pasting anything. They now paste with Obsidian's own paste, links and formatting included, and then add the citation.
- **Paste as plain text is left alone.** Ctrl+Shift+V (Cmd+Shift+V on macOS) is Obsidian's "paste as plain text", and the plugin was treating it as an ordinary paste. Only Ctrl+V, Cmd+V and Shift+Insert, pressed on their own, are intercepted now.
- **Deleting a preset really switches back.** After **Delete Preset**, the template box kept the deleted preset's text, so pastes kept using it. It now loads the default preset, and a Slot B or C that held the deleted preset goes back to its default.
- **The settings page stays put.** Choosing, saving or deleting a preset, or changing a slot, no longer jumps the settings page back to the top.

---

## 🌟 What's New in Version 1.7.0: A Signature Citation, Smarter Pasting and a Citation Shortcut

### 🔖 New Default: the "Paste with Source" Preset
The plugin now has a citation style of its own, and it's the default on a fresh install:

```markdown
From: [Article Title](https://example.com/article) – example.com
```

It shows the page's title as the link, then the site it came from. The en dash keeps the separator apart from the hyphens many page titles contain, as in "Obsidian - Wikipedia". Like the other link presets, it follows **Link Label**, so you can show the URL, the page name or "Source" instead of the title. If you already chose a template, nothing changes for you. OneNote Style is still in the preset list.

### 🛡️ No Citation Inside an Open Parenthesis
If you're in the middle of a parenthetical, as in "(see this", and paste, the citation is now left out, instead of landing inside your aside. This works like the existing rule for an open `[`. Parentheses you've already closed don't count, and neither do escaped `\(` or parentheses inside code, math or comments. Obsidian's auto-paired `)` after the cursor doesn't matter, because only what's before the cursor is read.

### ⌨️ Ctrl+Alt+V: Cite It Anyway (Windows)
**Cite plain-text copies from Chromium apps** can now stay off for everyday pastes, while you still get the citation when you want it. Press **Ctrl+Alt+V**, or run **Paste, citing Chromium plain-text copies** from the command palette. It pastes exactly as Ctrl+V does, with the same formatting, links and rules. The only difference is that when the citation would otherwise be missing, such as after a site's plain-text Copy button, it also reads the page address Chrome, Edge and other Chromium browsers leave behind.

On keyboards with an AltGr key, Windows treats AltGr as Ctrl+Alt, so AltGr+V runs the command too. If that's a key you type with, rebind it under **Settings → Hotkeys**.

### 🐛 Fixed
Ctrl+Alt+V was treated as an ordinary Ctrl+V paste. It's now left to the new command.

---

## 🌟 What's New in Version 1.6.0: Citations for Copy Buttons on Windows

### 📋 Plain-Text Copies Now Get Their Source
Many sites have a Copy button that puts only plain text on the clipboard, such as ChatGPT's reply copy icon or GitHub's code-block button. On Windows, pasting from one of these used to give no citation, because the clipboard held no web content for the plugin to read the address from.

Chrome, Edge, Brave and other browsers built on Chromium still note the page's address for every copy, including plain-text ones, and Paste with Source now reads it. Pastes from those buttons are cited with the page they came from, just like an ordinary copy. Firefox doesn't record the address for these copies, so they still get no citation there.

### ⚙️ New Setting: "Cite plain-text copies from Chromium apps"
This is on by default and appears only on Windows. Desktop apps built on Chromium, such as Slack or Teams, record their own page address too, so their plain-text copies get a citation as well while the setting is on. Turn it off if you'd rather they didn't. Copies made inside Obsidian never get one.

---

## 🌟 What's New in Version 1.5.0: Real Page Titles in Your Citations

### 🏷️ Links Labeled With the Page's Title
Citations can now show the page's actual title instead of its URL:

```markdown
From <[Obsidian (software) - Wikipedia](https://en.wikipedia.org/wiki/Obsidian_(software))>
```

The paste itself never waits. It goes in at once with the URL where the title will go, and the title replaces it as soon as the page answers, usually within a second. If the page can't be reached, isn't a web page or has no title, the URL simply stays. If you edit the citation or switch notes before the title arrives, your note is left exactly as you made it.

### 🔽 New "Link Label" Setting
The **Use URL as Link Label** toggle is now a **Link Label** dropdown. It decides how links are labeled in every template:
- **Page title** (default): the title fetched from the page.
- **Page name**: a name taken from the URL, such as "Obsidian (software)".
- **URL**: the address itself.
- **"Source"**: the word Source.

Seven built-in presets now follow this setting too:
- Italic Attribution
- Parenthetical
- Academic Citation
- Obsidian Callout
- Timestamped (ISO 8601)
- Zulu / UTC Research Log
- 12-Hour Casual

Choose **Page name** to keep their previous look.

### 🧩 New `{title}` Variable
Put the page's title anywhere in your own templates, for example `Source: [{title}]({url})`. Until the title arrives, it shows the URL.

### 🌐 About Network Requests
To read a title, the plugin requests the copied page from its website, once per paste. It does this only with **Page title** selected and a template using `{link}`, or when a template uses `{title}`. Choose another Link Label, and avoid `{title}`, and the plugin makes no network requests at all. See **Network Use** in the README for the details.

---

## 🌟 What's New in Version 1.4.2: Correct Minimum Version and an Open-Source License

### 🐞 Fixed: Requires Obsidian 1.1.1 or Later
The plugin said it worked with Obsidian 0.15.0 and up. On versions before 1.1.1, the paste shortcut and both **Paste … Source URL** commands quietly did nothing, because they rely on an Obsidian feature added in 1.1.1. The plugin now declares 1.1.1 as its minimum, so Obsidian won't install it on a version it can't run on. Nothing changes for anyone already on 1.1.1 or later.

### 📄 MIT License
Paste with Source is now released under the [MIT License](LICENSE).

---

## 🌟 What's New in Version 1.4.1: Pasting Into the Right Field

### 🐞 Fixed: Pastes Into the Note Title or Find Bar Went to the Note
The paste shortcut used to act on the open note even when you were typing somewhere else in its pane:
- In **Default handler + source** mode, pasting into the note's title or the find bar (`Ctrl+F`) pasted there, but also added a citation to the note body.
- In **Paste content + source** mode, the title or find bar got nothing, and the text and its citation landed in the note body instead.

The shortcut now acts only while the note's editor has keyboard focus. Every other field gets a normal paste, and your note is left alone.

### 🛠️ For Contributors
- **`npm test`** compiles the project and runs every test file, then prints a pass/fail summary.
- **`npm run deploy`** now needs to be told which vault to deploy to, with `-- --vault "<path to vault>"` or the `OBSIDIAN_VAULT` environment variable. It used to write into `~/Documents/Obsidian Vault`, and created that folder if it didn't exist. With no vault given, it lists the vaults Obsidian knows about.

---

## 🌟 What's New in Version 1.4.0: Markup-Safe Pasting

### 🛡️ No More Citations Where They Break Your Markup
The intercepted paste shortcut (`Cmd+V`, `Ctrl+V`, `Shift+Insert`) now checks where the cursor is before adding a citation. It pastes without one inside:
- code blocks and inline code
- `$$` math blocks and inline `$…$` math
- `%%` comments
- the frontmatter
- wikilinks, a link's text or its `(url)`
- an HTML tag or attribute you're typing

Each construct hides the others' markers, so a `%%` inside a code block doesn't start a comment. A lone `$`, as in "I paid $5 for", isn't treated as math, so ordinary prose still gets its citation.

Need a citation in one of those places anyway? The **Paste with Source URL** commands and right-click menu items still add one wherever the cursor is.

### ⚙️ New Setting: "When a citation can't be added"
In **Paste content + source** mode, choose what a paste in one of those places does:
- **Obsidian's native paste** (default): exactly what Ctrl+V does with the plugin turned off.
- **Plain clipboard text**: the clipboard's plain text, without the citation.

The setting is hidden in **Default handler + source** mode, where Obsidian's own paste always runs.

### 🐞 Fixed: Double Paste in "Paste content + source" Mode
Pasting in this mode used to insert the clipboard text twice, once from Obsidian and once with the citation. It now inserts it once.

### 📦 Install and Update with BRAT
Each release now carries the built `main.js` and `manifest.json`, so you can install Paste with Source with [BRAT](https://github.com/TfTHacker/obsidian42-brat) using the repository `coreyx/obsidian-paste-with-source`, and BRAT keeps it up to date. See [Installation & Quickstart](#-installation--quickstart).

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
- **`Ctrl+Alt+A` (`Cmd+Opt+A`)**: Activate Preset Slot A (Always uses your editable Citation Template from settings).
- **`Ctrl+Alt+B` (`Cmd+Opt+B`)**: Activate Preset Slot B (Configurable preset, defaults to *Minimal Domain*).
- **`Ctrl+Alt+C` (`Cmd+Opt+C`)**: Activate Preset Slot C (Configurable preset, defaults to *Academic Citation*).
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
| **Obsidian Version** | Desktop App `v1.1.1`+ | Desktop App `v1.1.1`+ |
| **Operating System** | macOS 10.15 (Catalina) through macOS 15+ (Sequoia) | Windows 10 or Windows 11 |
| **Architecture** | Apple Silicon (`arm64`) & Intel (`x86_64`) | x64 & ARM64 |
| **Runtime Dependency** | *None* (runs in-process via Electron) | *None* (runs in-process via Electron) |
| **Supported Browsers** | Chrome, Safari, Arc, Edge, Brave, Opera | Chrome, Edge, Firefox, Brave, Arc, Opera |

> [!NOTE]  
> Mobile platforms (iOS and Android) and Linux desktop clipboard targets are currently not supported.

---

## 📦 Installation & Quickstart

### Option 1: BRAT (Recommended)
1. Install and enable **BRAT** from **Settings → Community plugins → Browse**.
2. Run **BRAT: Add a beta plugin for testing** from the command palette.
3. Enter `coreyx/obsidian-paste-with-source`, choose the latest version, and select **Add Plugin**.
4. Enable **Paste with Source** under **Settings → Community plugins**.

### Option 2: Download a Release
1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/coreyx/obsidian-paste-with-source/releases/latest) into:
   ```text
   <Your-Obsidian-Vault>/.obsidian/plugins/paste-with-source/
   ```
2. Open Obsidian, go to **Settings → Community Plugins**, click **Reload plugins**, and enable **Paste with Source**.

### Option 3: Build from Source
```bash
git clone https://github.com/coreyx/obsidian-paste-with-source.git
cd obsidian-paste-with-source
npm install
npm run build
```
Then copy `dist/main.js` and `dist/manifest.json` into the plugin folder above.

---

## ⚙️ Configuration Reference

Open Obsidian Settings and locate **Paste with Source Settings**:

| Option | Default | Description |
| :--- | :--- | :--- |
| **Intercept Paste** | `true` (Enabled) | Automatically replaces keyboard paste keystrokes with source-aware pasting. |
| **Intercept Shortcut** | Platform default (`Cmd+V` on macOS; `Both` on Windows) | Choose which shortcut to monitor (`Cmd+V`, `Both`, `Ctrl+V only`, or `Shift+Insert only`). |
| **Paste Mode** | `Default handler + source` | Chooses between running Obsidian's rich paste first or inserting raw clipboard plain text. |
| **When a citation can't be added** | `Obsidian's native paste` | *Paste content + source* mode only. What a paste inside code, math, comments, frontmatter, links or wikilinks does: Obsidian's native paste, or the clipboard's plain text. |
| **Use URL as Link Label** | `true` (Enabled) | Renders `{link}` as `[https://...](https://...)` instead of `[Source](https://...)`. |
| **Template Preset** | `OneNote Style` | Loads one of the 11 built-in presets, or one of your own, into the Citation Template. |
| **Citation Template** | `\n\nFrom <{link}>` | The citation added after a paste, with `{var}` placeholders such as `{url}`, `{domain}`, `{page}` and `{date}`. This replaced the old **Citation Style** setting in 1.3.0. |
| **Active Preset Slot** | `A` | Which slot pastes use: A is the Citation Template, B and C hold presets you choose (defaults *Minimal Domain* and *Academic Citation*). Switch with `Ctrl+Alt+A`, `B`, `C`. |

---

## 🔍 Troubleshooting & Known Behaviors

- **Source URL not appearing**:
  - **macOS**: Ensure you are copying from a supported browser (Google Chrome, Apple Safari, Arc, Microsoft Edge, Brave, Opera). Browsers that do not populate `org.chromium.source-url` or `com.apple.webarchive` (such as Mozilla Firefox for regular text selections) cannot provide source URLs.
  - **Windows**: Content must be copied from an application that populates the `CF_HTML` format with a `SourceURL:` header (Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, Arc, Opera).
- **Pasting outside the note's text**: The paste shortcut is intercepted only while the note's editor has keyboard focus. Pasting into the note title, the find bar, the search box or a settings field is a normal paste with no citation.
- **50ms Delay in Default Mode**: In `Default handler + source` mode, the citation is appended after a 50ms delay to allow Obsidian's internal markdown parser to finish. If cursor positioning feels inconsistent during heavy load, switch to `Paste content + source` (`clipboard+source`) mode for atomic paste replacement.

