---
status: approved
---

# Let `npm run deploy` target any vault

`deploy.ts` always copies the build into `~/Documents/Obsidian Vault`. On a machine whose vaults live elsewhere, that folder doesn't exist, so `npm run deploy` creates a stray folder instead of installing the plugin anywhere useful. This change makes the script take the vault from a `--vault` argument or an `OBSIDIAN_VAULT` environment variable, and fail with a clear message when it has neither.

**Related documents**
- [Paste context guard walkthrough](../paste-context-guard/walkthrough.md)

## User Review Required

> [!IMPORTANT]
> **No default vault any more.** `npm run deploy` with neither `--vault` nor `OBSIDIAN_VAULT` set now exits with an error instead of copying to `~/Documents/Obsidian Vault`. If you rely on that path, set `OBSIDIAN_VAULT` to it once.

> [!NOTE]
> **It refuses a folder that isn't a vault.** The target must exist and contain a `.obsidian` folder, so a typo can't scatter a new plugin folder somewhere random. The error lists the vaults Obsidian knows about, read from its `obsidian.json`, to copy from.

## Open Questions

None at this time.

## Proposed Changes

### Deploy script

#### [MODIFY] `deploy.ts`
- [x] **TASK-1:** Replace the hard-coded `vaultPath` with an exported `resolveVaultPath(argv: string[], env: NodeJS.ProcessEnv): string`.
  - It takes `--vault <path>` or `--vault=<path>` from `argv` first, then `env.OBSIDIAN_VAULT`, and throws a `DeployError` when neither is set.
  - It also throws a `DeployError` when the path doesn't exist or has no `.obsidian` folder.
  - Each error says what was tried and how to fix it: `npm run deploy -- --vault "<path>"` or `OBSIDIAN_VAULT`.
- [ ] **TASK-2:** Add an exported `knownVaults(): string[]` that reads Obsidian's `obsidian.json` and returns the `path` of each vault.
  - The file is at `%APPDATA%\obsidian\` on Windows, `~/Library/Application Support/obsidian/` on macOS, and `~/.config/obsidian/` elsewhere.
  - It returns `[]` if the file is missing or unreadable.
  - When the script fails to resolve a vault, it prints this list under the error.
- [ ] **TASK-3:** Move the copy into a `main()` that runs only when the file is executed directly (`require.main === module`), so tests can import it without deploying.
  - `main()` fails with "run `npm run build` first" when `dist/main.js` is missing.
  - On a `DeployError`, it prints the message and exits with code 1. Other errors are left to fail as they do today.

#### [NEW] `test-deploy.ts`
- [ ] **TASK-4:** Test `resolveVaultPath` against a temporary folder with and without `.obsidian`. The script prints pass/fail per case and exits non-zero on any failure. Cases:
  - `--vault <path>` resolves.
  - `--vault=<path>` resolves.
  - The argument wins over `OBSIDIAN_VAULT`.
  - `OBSIDIAN_VAULT` alone resolves.
  - Neither set: throws.
  - A missing path: throws.
  - A folder without `.obsidian`: throws.

### Documentation

#### [MODIFY] `README.md` · [MODIFY] `CHANGELOG.md`
- [ ] **TASK-5:** Document the new deploy usage.
  - `README.md`, Option 3 step 3: `npm run deploy -- --vault "<path to vault>"`, or set `OBSIDIAN_VAULT` once.
  - `README.md` project tree: add `test-deploy.ts`.
  - `CHANGELOG.md`, under `[Unreleased]`: a `Changed` entry saying the deploy script needs a vault path and no longer defaults to `~/Documents/Obsidian Vault`.

## Verification Plan

### Automated Tests
`npm run build`, then `node test-deploy.js`. It verifies:
1. The argument forms and `OBSIDIAN_VAULT` resolve, and the argument takes priority.
2. A missing setting, a missing path and a non-vault folder are each refused with an error.

Regression: `node test-paste-guard.js`, `node test-templates.js` and `node test-bplist.js` still pass.

### Manual Verification
1. Run `npm run deploy` with nothing set. It exits with code 1, explains how to pass a vault, and lists your vaults, including the test vault. No folder is created.
2. Run `npm run deploy -- --vault "<test vault>"`. It copies `main.js` and `manifest.json` into that vault's `.obsidian/plugins/paste-with-source/`, and the plugin loads after a reload.
3. Run `npm run deploy -- --vault "<folder containing the test vault>"`, the parent folder, which isn't a vault. It's refused with an explanation.
4. Set `OBSIDIAN_VAULT` to the test vault's path and run `npm run deploy`. It deploys there.

## Visual design application
No UI changes.
