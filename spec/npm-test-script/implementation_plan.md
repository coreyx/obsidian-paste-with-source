---
status: draft
---

# Add an `npm test` that builds first and runs every test file

The test files import `./main`, which resolves to the compiled `main.js`, not `main.ts`. Running a test without building first silently checks whatever `main.js` was last built. During paste-context-guard that was a copy from a month earlier, and the run failed with `canAddCitation is not a function`. The documented `npx ts-node test-*.ts` command has the same problem. This change adds `npm test`, which compiles and then runs every `test-*.ts` file, and fails if any of them fails.

**Related documents**
- [Paste context guard walkthrough](../paste-context-guard/walkthrough.md)

## User Review Required

> [!NOTE]
> **Test files are found by name.** Any `test-*.ts` file in the project root runs, so a new test file needs no registration. That includes `test-deploy.ts`, if the deploy-vault-path change lands first.

> [!NOTE]
> **`npm test` runs `tsc`, not `npm run build`.** The tests only need the compiled files, so `dist/` isn't touched.

## Open Questions

None at this time.

## Proposed Changes

### Test runner

#### [NEW] `run-tests.ts`
- [ ] **TASK-1:** Add a runner script.
  - It runs the project's own TypeScript compiler, found with `require.resolve("typescript/bin/tsc")` and run with `node`, so it never picks up some other `tsc` on the `PATH`.
  - It then runs each `test-*.js` built from a `test-*.ts` in the project root, alphabetically, each in its own `node` process with inherited output.
  - It ends with one summary line per file, `PASS` or `FAIL` with the exit code, and exits with code 1 if the compile or any file failed.
  - A compile failure stops the run before any test.
  - Each test file runs in a separate process because `test-paste-guard.ts` replaces globals such as `navigator` and `document`, and calls `process.exit`.

#### [MODIFY] `package.json`
- [ ] **TASK-2:** Add `"test": "ts-node run-tests.ts"` to `scripts`.

### Documentation

#### [MODIFY] `README.md` · [MODIFY] `CHANGELOG.md`
- [ ] **TASK-3:** Document `npm test`.
  - `README.md`, Build Details: a "Tests" bullet saying `npm test` compiles and runs every `test-*.ts`. It notes that the test files load the compiled `main.js`, so running one directly needs `tsc` first.
  - `README.md` project tree: add `run-tests.ts`.
  - `CHANGELOG.md`, under `[Unreleased]`: an `Added` entry for `npm test`.

## Verification Plan

### Automated Tests
`npm test` is itself the check. It verifies:
1. From a fresh clone state, with every `*.js` deleted, `npm test` compiles and runs all three test files, and exits 0.
2. With a deliberately failing check in a temporary `test-zz-fail.ts`, `npm test` reports that file as `FAIL` and exits 1. The temporary file is deleted afterwards.
3. With a type error in a temporary edit to `main.ts`, `npm test` stops after the compile and exits 1, running no tests. The edit is reverted afterwards.

### Manual Verification
1. Run `npm test` in a terminal. All test files run, followed by a summary with one `PASS` line each, and `echo $?` (or `$LASTEXITCODE` in PowerShell) prints `0`.

## Visual design application
No UI changes.
