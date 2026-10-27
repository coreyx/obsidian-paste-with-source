---
status: approved
---

# Add a "Paste with Source" built-in preset and make it the default

This adds a built-in preset named after the plugin, with the template `\n\nFrom: {link} – {domain}`, and makes it the default citation for new installs. Because it uses `{link}`, it follows **Link Label** like the other `{link}` presets. With the default *Page title* label, a paste from a page titled "Article Title" ends with:

```markdown
From: [Article Title](https://example.com/article) – example.com
```

## User Review Required

> [!IMPORTANT]
> **The default citation changes** from OneNote Style (`From <{link}>`) to Paste with Source (`From: {link} – {domain}`) on a fresh install. An existing install keeps its stored template and selected preset, since both are saved settings. There is no existing user base, so nothing is migrated.

> [!NOTE]
> **The separator is an en dash** (` – `), so it reads apart from the hyphens many page titles hold, as in `From: [Obsidian - Wikipedia](…) – en.wikipedia.org`.

> [!NOTE]
> **OneNote Style stays** as a built-in preset, and so do the slot B and C defaults (Minimal Domain and Academic Citation).

## Open Questions

None at this time.

## Proposed Changes

### Presets and defaults

#### [MODIFY] `main.ts`
- [x] **TASK-1:** Add the preset to the top of `BUILTIN_PRESETS`, so it's listed first in the preset dropdown:
  - `id: "builtin-paste-with-source"`
  - `name: "Paste with Source"`
  - `template: "\n\nFrom: {link} – {domain}"`
  - `isBuiltIn: true`
  - `description: "The plugin's own style: the link, then the site's domain"`
- [x] **TASK-2:** Make it the default everywhere the OneNote preset is the default today:
  - In `DEFAULT_SETTINGS`, `templateString` becomes `"\n\nFrom: {link} – {domain}"` and `selectedPresetId` becomes `"builtin-paste-with-source"`.
  - In `loadSettings`, the branch for an install with no stored `templateString` that isn't the legacy `"Source"` style now uses `DEFAULT_SETTINGS.templateString` and `DEFAULT_SETTINGS.selectedPresetId` in place of the OneNote literals. The legacy `"Source"` branch is unchanged.
  - In the settings tab's **Delete Preset** handler, deleting a custom preset selects `DEFAULT_SETTINGS.selectedPresetId` in place of the literal `"builtin-onenote"`.

### Tests

#### [MODIFY] `test-templates.ts`
- [x] **TASK-3:** Update and extend the preset checks:
  - The built-in count becomes 12, and `"builtin-paste-with-source"` joins the expected ids.
  - The new preset renders `\n\nFrom: [https://obsidian.md](https://obsidian.md) – obsidian.md` with the *URL* label, and shows the fetched title with the *Page title* label.
  - It's the first entry in `BUILTIN_PRESETS`.
  - `DEFAULT_SETTINGS.selectedPresetId` names it, and `DEFAULT_SETTINGS.templateString` equals its template.
  - Loading settings with nothing stored selects it.
  - The slot A check of `getSourceLinkMarkdown` expects the new default citation.
  - It joins the "never used {page}" list.

### Docs

#### [MODIFY] `README.md`
- [x] **TASK-4:** Document the preset:
  - The **Template Preset** settings row says 12 built-in presets, with Paste with Source first.
  - The Features line lists it among the built-in presets.
  - **Built-In Preset Examples** gets Paste with Source as example 1, with the others renumbered after it.
- [x] **TASK-5:** Add an `Added` entry under `[Unreleased]` in `CHANGELOG.md` for the preset and the new default.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file. It verifies:
1. The new preset exists, is first, and renders as above with the *URL* and *Page title* labels.
2. A fresh install selects it and uses its template.
3. All other test files pass unchanged.

### Manual Verification
In the test vault:
1. **Fresh settings:** Rename the plugin's `data.json` in `<vault>/.obsidian/plugins/paste-with-source/`, then reload the plugin. The preset dropdown shows **Paste with Source** selected and first, and the Citation Template box reads `From: {link} – {domain}` after two blank lines.
2. **Paste:** Copy text from a web page in Chrome or Edge and paste it into a note. The citation reads `From: [<page title>](<url>) – <domain>`.
3. **Link Label:** Set Link Label to *URL*, then paste again. The link text is the URL.
4. **Restore:** Put your original `data.json` back and reload the plugin.

## Visual design application
The only UI change is one more entry in the existing preset dropdown, so there is no design system to apply.
