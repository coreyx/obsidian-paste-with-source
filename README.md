# Paste with Source (Obsidian Plugin)

This Obsidian plugin enhances your clipboard pasting workflow by automatically appending a source URL to anything you paste from the web.

## ✨ Features

- 📎 **Source-Aware Pasting**: Appends the origin webpage URL when pasting content copied from browsers
- 🍎 **macOS Support**: In-process Electron clipboard extraction supporting Chromium browsers (Google Chrome, Arc, Microsoft Edge, Brave, Opera) and Apple Safari (via built-in `bplist00` WebArchive decoding)
- 🪟 **Windows Support**: In-process Electron clipboard extraction with native `CF_HTML` parsing and zero external binary dependencies
- 📝 **Link Source Templates**: Fully customizable citation template engine with `{var}` placeholders (`{url}`, `{domain}`, `{page}`, `{title}`, `{path}`, `{date}`, `{time}`, `{datetime}`, `{iso}`, `{link}`)
- 📦 **Presets & JSON Import/Export**: Built-in presets (Paste with Source, OneNote, Markdown Quote, Academic), custom preset saving, and one-click JSON import/export
- 👁️ **Authoritative Text Box & Live Preview**: The editable text area is always the single source of truth, backed by interactive variable pills and real-time live preview
- ⌨️ **Keyboard Interception**: Optionally intercepts `Cmd+V` (macOS) or `Ctrl+V` / `Shift+Insert` (Windows) to auto-append source
- 🛡️ **Markup-Safe Pasting**: Skips the citation when you paste inside code, math, comments, frontmatter, links, wikilinks, or an open parenthesis, where it would break the markup
- 🖱 **Context Menu Actions**: Adds right-click editor menu options for source-aware pasting
- 🔗 **Configurable Link Labels**: Label every citation's link with the page's real title (fetched from the page), the page name from its URL, the URL itself, or a generic `[Source]`

---

## 🧩 Compatibility & Requirements

| Platform | Supported | Details & Requirements |
| :--- | :---: | :--- |
| **macOS Desktop** | ✅ Yes | In-process Electron extraction. Zero external binary or runtime installation required. Works with Chrome, Safari, Arc, Edge, Brave. |
| **Windows Desktop** | ✅ Yes | In-process Electron extraction (`CF_HTML`). Zero external binary or runtime installation required (.NET no longer needed). Works with Chrome, Edge, Firefox, Brave, Arc, Opera. Plain-text-only copies, such as a site's Copy button, are cited from Chromium browsers (Chrome, Edge, Brave, Arc, Opera), not from Firefox. |
| **Linux Desktop** | ⚠️ No | Linux clipboard targets currently unsupported. |
| **Mobile (iOS/Android)**| ⚠️ No | Obsidian Mobile does not support native desktop clipboard APIs. |

Requires Obsidian **1.1.1** or later.

---

## 📦 Installation

Paste with Source isn't listed in Obsidian's Community Plugins browser yet. Install it with BRAT, which also keeps it updated, or from a GitHub release by hand.

> [!NOTE]
> Don't download `main.ts` from the repository and rename it to `main.js`. That file is the TypeScript source, and Obsidian fails to load it with `SyntaxError: Cannot use import statement outside a module`. The installable `main.js` is attached to each [release](https://github.com/coreyx/obsidian-paste-with-source/releases).

### Option 1: BRAT (Recommended)
[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tool) installs plugins straight from their GitHub releases and checks for new versions.

1. In Obsidian, open **Settings → Community plugins**, turn off **Restricted mode** if it's on, then **Browse**, search for **BRAT**, and install and enable it.
2. Open the command palette (`Ctrl+P` / `Cmd+P`) and run **BRAT: Add a beta plugin for testing**.
3. Enter the repository `coreyx/obsidian-paste-with-source` (or `https://github.com/coreyx/obsidian-paste-with-source`), choose the latest version, and select **Add Plugin**.
4. Enable **Paste with Source** under **Settings → Community plugins**.

BRAT installs the files from the newest GitHub release and updates the plugin when a new release is published. You can also check for updates with **BRAT: Check for updates to all beta plugins**.

### Option 2: Download a Release
1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/coreyx/obsidian-paste-with-source/releases/latest).
2. Put both files in your vault's plugin folder, creating it if needed:
   ```text
   <Your-Vault>/.obsidian/plugins/paste-with-source/
   ```
3. Reload Obsidian, then enable **Paste with Source** under **Settings → Community plugins**.

To update, replace the two files with the ones from a newer release.

### Option 3: Build from Source

1. Clone this repository:
   ```bash
   git clone https://github.com/coreyx/obsidian-paste-with-source.git
   cd obsidian-paste-with-source
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
| **Cite plain-text copies from Chromium apps** | Windows only, on by default. When a browser or app built on Chromium copies plain text only, such as from a Copy button, reads the page address Chromium leaves on the clipboard, so the paste is still cited. Turn off if plain-text copies from desktop apps such as Slack get citations you don't want. When it's off, the **Paste, citing Chromium plain-text copies** command (`Ctrl+Alt+V`) still reads it |
| **Link Label** | How `{link}` is labeled in every template: *Page title* (default), the title fetched from the page, which shows the URL until it arrives; *Page name*, guessed from the URL; *URL*; or *"Source"*. Only *Page title* makes a network request (see **Network Use** below) |
| **Template Preset** | Select from 12 built-in presets (Paste with Source, the default; OneNote, Italic Attribution, Minimal Domain, Parenthetical, Academic, Obsidian Callout, Timestamped ISO 8601, Zulu Log, 12h Casual, Markdown Quote, Raw URL) or your custom presets |
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
| `{title}` | The page's title, fetched from the page (its `og:title`, `twitter:title` or `<title>`). Shows the URL until the title arrives, or if it can't be read. A Reddit post reads `<post title> - r/<subreddit>` (see **Network Use**). Using it makes a network request | `Obsidian (software) - Wikipedia` |
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
| `{link}` | Markdown link labeled as **Link Label** says | `[Obsidian (software) - Wikipedia](https://...)`, `[Obsidian (software)](https://...)`, `[https://...](https://...)` or `[Source](https://...)` |
| `\n` | Newline character | Line break |

---

## 🧪 Built-In Preset Examples

If you copy text from a webpage titled "Article Title" and paste it into Obsidian, with **Link Label** on its default, *Page title*:

**1. Paste with Source, the default (`

From: {link} – {domain}`):**
```markdown
Pasted excerpt text...

From: [Article Title](https://example.com/article) – example.com
```

**2. OneNote Style (`

From <{link}>`):**
```markdown
Pasted excerpt text...

From <[Article Title](https://example.com/article)>
```

**3. Italic Attribution (`

— *Source: {link}*`):**
```markdown
Pasted excerpt text...

— *Source: [Article Title](https://example.com/article)*
```

**4. Minimal Domain (`

Source: [{domain}]({url})`):**
```markdown
Pasted excerpt text...

Source: [example.com](https://example.com/article)
```

**5. Parenthetical (`

(Source: {link})`):**
```markdown
Pasted excerpt text...

(Source: [Article Title](https://example.com/article))
```

**6. Academic Citation (`

Source: {link} via {domain} (Accessed: {date} at {time12h})`):**
```markdown
Pasted excerpt text...

Source: [Article Title](https://example.com/article) via example.com (Accessed: 2026-09-11 at 02:30 PM)
```

**7. Obsidian Callout (`

> [!info] Source: {link}
> Accessed on {datetime12h}`):**
```markdown
Pasted excerpt text...

> [!info] Source: [Article Title](https://example.com/article)
> Accessed on 2026-09-11 02:30 PM
```

**8. Markdown Quote (`

> — [Source]({url})`):**
```markdown
Pasted excerpt text...

> — [Source](https://example.com/article)
```

**9. Raw URL (`

{url}`):**
```markdown
Pasted excerpt text...

https://example.com/article
```

**10. Timestamped (ISO 8601) (`

— *Source: {link}* [{datetime}]`):**
```markdown
Pasted excerpt text...

— *Source: [Article Title](https://example.com/article)* [2026-09-11T14:30-07:00]
```

**11. Zulu / UTC Research Log (`

Source: {link} (Retrieved: {datetimez})`):**
```markdown
Pasted excerpt text...

Source: [Article Title](https://example.com/article) (Retrieved: 2026-09-11T21:30Z)
```

**12. 12-Hour Casual (`

Source: {link} ({date} at {time12h})`):**
```markdown
Pasted excerpt text...

Source: [Article Title](https://example.com/article) (2026-09-11 at 02:30 PM)
```

Every preset that uses `{link}` follows **Link Label**. With *Page name* the link reads `[Article](https://example.com/article)`, the name taken from the URL; with *URL* it reads `[https://example.com/article](https://example.com/article)`; and with *"Source"* it reads `[Source](https://example.com/article)`.

---

## 🧪 Commands & Menu Options

### Commands (Command Palette)
- `Activate Citation Preset A (Editable Template)` (`Ctrl+Alt+A` / `Cmd+Opt+A`)
- `Activate Citation Preset B` (`Ctrl+Alt+B` / `Cmd+Opt+B`)
- `Activate Citation Preset C` (`Ctrl+Alt+C` / `Cmd+Opt+C`)
- `Paste (Default) + Source URL`
- `Paste with Source URL`
- `Paste, citing Chromium plain-text copies` (`Ctrl+Alt+V`, Windows only)

### Context Menu (Editor Right-Click)
- `Paste (Default Handler) + Source URL`
- `Paste Clipboard with Source URL`

`Paste (Default Handler) + Source URL` and the `Paste (Default) + Source URL` command paste with Obsidian's own paste, the same one its context-menu **Paste** runs, so links and formatting come through as they do with `Ctrl+V`. The citation follows the pasted content. With no source URL on the clipboard, the clipboard is still pasted, without a citation. `Paste Clipboard with Source URL` and the `Paste with Source URL` command paste the clipboard's plain text instead.

### Keyboard Shortcuts
- **Standard Paste**: If "Intercept Paste" is enabled, intercepts `Cmd+V` (macOS), `Ctrl+V` (Windows), or `Shift+Insert` (Windows) to append the currently active citation preset. The shortcut is intercepted only while a note's editor has keyboard focus. A paste into any other field, such as the search box, the find bar or a settings field, is left to Obsidian, and nothing is added to the open note. Only those exact shortcuts are intercepted. With any other modifier held, the key is left to Obsidian, so `Ctrl+Shift+V` (`Cmd+Shift+V`), Obsidian's "paste as plain text", pastes plain text with no citation.
- **Preset Switcher Hotkeys**:
  - `Ctrl+Alt+A` (`Cmd+Opt+A`): Activate Preset Slot A (Always uses the editable Citation Template from settings)
  - `Ctrl+Alt+B` (`Cmd+Opt+B`): Activate Preset Slot B (Configurable preset, default: *Minimal Domain*)
  - `Ctrl+Alt+C` (`Cmd+Opt+C`): Activate Preset Slot C (Configurable preset, default: *Academic Citation*)
  - *Activating a slot displays a brief Obsidian notification. Normal paste (`Ctrl+V`) always pastes using the active preset.*
  - *All hotkeys can be customized or cleared in Obsidian's **Settings → Hotkeys** menu.*
- **Chromium Plain-Text Paste** (Windows only): `Ctrl+Alt+V` runs **Paste, citing Chromium plain-text copies**. It pastes exactly as `Ctrl+V` does, following **Paste Mode** and the rules in **When No Citation Is Added**. The only difference is where it looks for the citation's address: when the clipboard's HTML has none, it also reads the page address Chromium leaves for plain-text copies, such as from a site's Copy button, even when **Cite plain-text copies from Chromium apps** is off. For an ordinary copy the two shortcuts give the same result. Keep the setting off for everyday pastes and use this when a citation is missing.
  - *On keyboards with an AltGr key, Windows reports AltGr as Ctrl+Alt, so AltGr+V runs this command too. If your layout types a character with AltGr+V, such as `@` on the Czech layout, rebind or clear the command in **Settings → Hotkeys**.*

---

## 🛡️ When No Citation Is Added

An intercepted paste (`Cmd+V`, `Ctrl+V`, or `Shift+Insert`), or the **Paste, citing Chromium plain-text copies** command (`Ctrl+Alt+V`), adds no citation when the cursor is somewhere a citation would break the surrounding markup:

- **Code**: inside a fenced code block (```` ``` ```` or `~~~`, including in blockquotes and lists), on a fence line, or inside `` `inline code` ``
- **Math**: inside a `$$` block, or inside inline `$…$`. A lone dollar sign, as in "paid $5 for", is treated as a price, not math.
- **Comments**: inside an Obsidian `%% comment %%`, on one line or several
- **Frontmatter**: anywhere in the YAML properties block at the top of the note
- **Links**: inside `[[wikilink]]`, a link's `[text]`, an image's `![alt]`, or a link's `(url)`, or after an unclosed `[` on the same line. Task checkboxes like `- [ ]` and escaped `\[` don't count.
- **Parentheses**: after an unclosed `(` on the same line, as in `(see this`, where the citation would land inside the aside. Pairs closed before the cursor and escaped `\(` don't count, and neither do parentheses inside code, math or comments.
- **HTML**: right after `<` or `="` while you type a tag or attribute

Markers inside one construct don't count in another: a `%%` in a code block doesn't start a comment. An unclosed `$$` or `%%` makes the rest of the note count as math or a comment, so a stray marker leaves later pastes without a citation instead of breaking anything.

What the paste does instead depends on **Paste Mode**:

- **Default handler + source**: Obsidian's own paste always runs; only the citation is skipped.
- **Paste content + source**: set by **When a citation can't be added**. *Obsidian's native paste* (the default) behaves exactly as if the plugin were off. *Plain clipboard text* inserts the clipboard's text, as this mode does elsewhere, but without the citation.

This applies only to the intercepted keyboard paste and `Ctrl+V`'s counterpart, `Ctrl+Alt+V`. The **Paste with Source URL** and **Paste (Default) + Source URL** commands and the context menu items add a citation wherever the cursor is, so you can still add one deliberately.

---

## 🌐 Network Use

To show a page's real title, the plugin requests that page from its website. It does this only when the citation needs the title: when the active template contains `{title}`, or contains `{link}` while **Link Label** is *Page title*, the default.

- **What is sent:** a single `GET` request for the copied page's URL, made through Obsidian when you paste. The site sees the request the way it would see a visit, and may log it. Nothing else is sent, and nothing goes anywhere but the copied page's own site.
- **What is read:** only the page's title, from its `og:title`, `twitter:title` or `<title>`. The page is parsed without running any of its scripts or loading anything it links to.
- **Reddit:** Reddit answers a request for a post with a bot check titled just "Reddit", so for a post, comment links included, the request goes to Reddit's oEmbed endpoint on `www.reddit.com` instead, and the citation reads `<post title> - r/<subreddit>`. A subreddit's front page is titled `r/<subreddit>` from its URL, with no request. Any other Reddit page, such as a share link or a user page, keeps the URL rather than the label "Reddit".
- **While it loads:** the paste goes in at once, with the URL where the title will go, and the title replaces it when the page answers. If the page doesn't answer within 10 seconds, isn't HTML or has no title, the URL stays. If you edit the citation before the title arrives, it's left as you made it.
- **To turn it off:** set **Link Label** to *Page name*, *URL* or *"Source"*, and don't use `{title}`. The plugin then makes no network requests at all.

Some sites answer automated requests with a sign-in or bot-check page, so the title can come back as that page's title instead, such as "Just a moment…".

---

## 🛠 Build Details

- **Pure TypeScript Architecture**: 100% in-process TypeScript transpiled to `main.js` using `tsc`. Zero external compilers, .NET SDKs, or native binaries required.
- **Cross-Platform**: Unified codebase running on both macOS and Windows via Electron's clipboard APIs.
- **Distribution**: Build outputs (`main.js` and `manifest.json`) are staged automatically into `dist/`. That folder isn't committed; each GitHub release carries the same two files as assets, tagged with the version in `manifest.json`, which is the layout BRAT installs from.
- **Tests**: `npm test` compiles the project with `tsc`, runs every `test-*.ts` file in the project root, and prints a `PASS`/`FAIL` summary, exiting non-zero if anything failed. The test files load the compiled `main.js`, not `main.ts`, so to run one directly, run `tsc` first and then `node test-<name>.js`.

---

## 📁 Project Structure

```text
obsidian-paste-with-source/
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
│   ├── npm-test-script/
│   ├── page-title-fetch/
│   └── chromium-source-url-format/
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
├── test-page-title.ts        # Unit tests for page title fetching & swapping titles into citations
├── test-paste-guard.ts       # Unit tests for the paste position guard & paste shortcut handling
├── test-templates.ts         # Unit tests for template engine & preset import/export
└── test-windows-clipboard.ts # Unit tests for reading the source URL from the Windows clipboard
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