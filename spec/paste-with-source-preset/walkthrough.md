# Walkthrough: Paste with Source Preset

There's a new built-in preset, **Paste with Source**, with the template `\n\nFrom: {link} – {domain}`. It's first in the preset dropdown and it's the default for a fresh install. Because it uses `{link}`, it follows **Link Label**. With the default *Page title*, a paste ends with `From: [Article Title](https://example.com/article) – example.com`.

## What Was Implemented

### 1. Presets and defaults (`main.ts`)
- **`BUILTIN_PRESETS`**: the preset `builtin-paste-with-source` is first in the list.
  - The separator is an en dash, chosen during review, so it reads apart from the hyphens in many page titles. A comment in the code says so.
- **`DEFAULT_SETTINGS`**: `templateString` and `selectedPresetId` now name the new preset.
- **`loadSettings`**: an install with no stored `templateString` that isn't the legacy `"Source"` style now gets `DEFAULT_SETTINGS`. Previously it got the OneNote literals.
- **Delete Preset handler**: deleting a custom preset selects `DEFAULT_SETTINGS.selectedPresetId`. Previously it selected `"builtin-onenote"`.
- **OneNote Style** stays as a built-in preset. The defaults for slots B and C are unchanged.

### 2. Tests (`test-templates.ts`)
- The built-in count is now 12, and the new id is among the expected ones.
- New checks:
  - The preset is first.
  - It renders with the *URL* label and with a fetched title.
  - `DEFAULT_SETTINGS` names it.
  - A fresh `loadSettings` selects it, along with its template.
- Changed checks:
  - It joins the list of presets that never used `{page}`.
  - The slot A check of `getSourceLinkMarkdown` expects the new default citation.

### 3. Docs
- **`README.md`**:
  - The Features line now names the preset.
  - The **Template Preset** row says 12 built-in presets, with Paste with Source as the default.
  - **Built-In Preset Examples** shows it as example 1, and the other examples are renumbered 2 to 12.
- **`CHANGELOG.md`**: an `Added` entry for the preset and a `Changed` entry for the new default, under `[Unreleased]`.
  - The plan asked for a single `Added` entry. A changed default belongs under `Changed` in Keep a Changelog, so it got its own entry.

### Commits
TASK-1 to TASK-3 went into one commit, `8b6cf90`, with a `Task:` line for each. TASK-1 and TASK-2 break the existing assertions for the preset count and the default citation, and those assertions are only updated in TASK-3. Committing them separately would have left two commits with a failing suite. TASK-4 is `d544116` and TASK-5 is `01a98b3`.

## Verification & Test Results

### Automated Tests
Ran `npm test`, which builds the project and runs every test file:
- **`test-templates.js`**: **Passed**, including the new preset and default checks.
- **Do the tests catch a regression?** In `loadSettings`, I put back the old OneNote preset id as the fresh-install default. "A fresh install selects the Paste with Source preset and its template" then failed, and `test-templates.js` exited 1. Restoring the change made it pass again.
  - A first attempt at this check also replaced the template literal with `sed`, and its quoting broke the build, so no tests ran. The second attempt changed only the preset id.

### Regression Testing
These all passed unchanged in the same run:
- `test-paste-guard.js`
- `test-page-title.js`
- `test-windows-clipboard.js`
- `test-bplist.js`
- `test-deploy.js`

## Manual Verification
The user ran these in the test vault, and every step passed:

| Step | Check | Result |
| --- | --- | --- |
| 1 | With `data.json` set aside, **Paste with Source** is selected and first, and the Citation Template box reads `From: {link} – {domain}` after two blank lines | Passed |
| 2 | A paste from a web page in Chrome or Edge ends with `From: [<page title>](<url>) – <domain>` | Passed |
| 3 | With Link Label on *URL*, the link text is the URL | Passed |
| 4 | Restoring the original `data.json` and reloading the plugin | Passed |

## Follow-ups
- **Delete Preset leaves the old template:** deleting a custom preset changes only `selectedPresetId`. The Citation Template box keeps the deleted preset's text. That was already the case before this change, and it's out of scope here.
