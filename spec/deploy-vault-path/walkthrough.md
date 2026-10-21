# Walkthrough: Deploy Vault Path

`npm run deploy` no longer copies the build into a hard-coded `~/Documents/Obsidian Vault`, which it created when that folder didn't exist. It now takes the vault from `--vault <path>` or the `OBSIDIAN_VAULT` environment variable, and refuses anything that isn't a vault. With no vault given, it lists the vaults Obsidian knows about.

## What Was Implemented

### 1. Deploy script
- **`deploy.ts`**:
  - `resolveVaultPath(argv, env)` reads `--vault <path>` or `--vault=<path>`, then `OBSIDIAN_VAULT`. The argument wins. It throws a `DeployError` when neither is set, when the path doesn't exist, or when the folder has no `.obsidian` folder. Each message names where the path came from.
  - `knownVaults()` reads Obsidian's own `obsidian.json` (from `%APPDATA%` on Windows, `~/Library/Application Support` on macOS, and `$XDG_CONFIG_HOME` or `~/.config` elsewhere). It returns an empty list if that file can't be read.
  - `main()` refuses to run when `dist/main.js` is missing and says to run `npm run build`. A vault error is followed by the list of known vaults.
  - The script deploys only when run directly (`require.main === module`), so importing it from a test copies nothing. A `DeployError` prints as one `❌` line and exits with code 1; any other error still throws.

### 2. Tests
- **`test-deploy.ts`** (new): Builds a temporary folder holding two vaults and one plain folder, and removes it afterwards. Seven cases cover both argument forms, `OBSIDIAN_VAULT`, the argument taking priority over the variable, and the three refusals.

### 3. Documentation
- **`README.md`**: Option 3, step 3 describes `npm run deploy -- --vault "<path to vault>"` and `OBSIDIAN_VAULT`. `test-deploy.ts` is added to the file tree.
- **`CHANGELOG.md`**: A `Changed` entry under `[Unreleased]`.

## Verification & Test Results

### Automated Tests
Ran `npm run build`, then `node test-deploy.js`:
- **Argument forms, `OBSIDIAN_VAULT`, and argument priority: Passed.**
- **Missing setting, missing path and non-vault folder are each refused: Passed.** 7 checks in total, 0 failures.

### Regression Testing
These were re-run after the branch was rebased onto `main`, which now includes the paste-outside-editor fix:
- `node test-paste-guard.js`: 85 checks, **Passed**.
- `node test-templates.js`: 79 checks, **Passed**.
- `node test-bplist.js`: 8 checks, **Passed**.

## Manual Verification

| Step | Command | Result |
| --- | --- | --- |
| 1 | `npm run deploy` with nothing set | **Passed.** It exits with code 1, explains how to pass a vault, and lists the five vaults Obsidian knows about, including the test vault. No folder was created. |
| 2 | `npm run deploy -- --vault "<test vault>"` | **Passed.** It exits with code 0 and copies `main.js` and `manifest.json` into the vault's `.obsidian/plugins/paste-with-source/`. Both files are byte-identical to `dist/`. `data.json` was left alone. |
| 3 | `npm run deploy -- --vault "<folder containing the test vault>"` (not a vault) | **Passed.** It's refused because the folder has no `.obsidian` folder. |
| 4 | `OBSIDIAN_VAULT="<test vault>" npm run deploy` | **Passed.** It exits with code 0 and reports deploying to the test vault. |

Notes:
- On Windows, a file copy keeps the source's modified time, so step 4's copy can't be seen from timestamps. The evidence is the vault path the script reports.
- Step 2 also asks that the plugin load after a reload. This branch doesn't touch `main.ts`, so the deployed `main.js` is built from the same source the paste-outside-editor manual tests had just loaded and run in that vault.

## Follow-ups
- `~/Documents/Obsidian Vault/` still exists on the development machine. The old script created it at 17:43 when an outdated compiled `deploy.js` ran during this session. It holds only `.obsidian/plugins/paste-with-source/main.js` and `manifest.json`, and is safe to delete.
