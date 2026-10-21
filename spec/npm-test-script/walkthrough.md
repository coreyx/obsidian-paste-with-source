# Walkthrough: npm test

`npm test` now compiles the project and then runs every `test-*.ts` file in the project root, each in its own process, ending with a `PASS`/`FAIL` line per file. It exits 1 if the compile or any test failed. Before this, running a test without building first silently checked whatever `main.js` had last been built.

**Related documents**
- [Implementation plan](implementation_plan.md)

## What Was Implemented

### 1. Test runner (TASK-1)
- **`run-tests.ts`** (new):
  - Runs the project's own compiler, found with `require.resolve("typescript/bin/tsc")` and started with the current `node`, so a global `tsc` on the `PATH` can't be used by mistake. A compile failure prints `FAIL  tsc (exit <n>); no tests were run.` and stops.
  - Lists root files matching `test-*.ts`, sorts them, and runs each one's compiled `.js` in its own `node` process with inherited output. Selecting by `.ts` source means a stale `.js` whose source is gone (such as a `test-deploy.js` left by another branch) is skipped.
  - Prints a summary and exits 1 if anything failed. A process killed by a signal counts as a failure.

### 2. npm script (TASK-2)
- **`package.json`**: `"test": "ts-node run-tests.ts"`.

### 3. Documentation (TASK-3)
- **`README.md`**: a "Tests" bullet under Build Details, including how to run a single test file (`tsc`, then `node test-<name>.js`), and `run-tests.ts` in the project tree.
- **`CHANGELOG.md`**: an `Added` entry under `[Unreleased]`.

## Verification & Test Results

### Automated Tests
`npm test` is itself the check:
- **Fresh state**: with all eight compiled `.js` files moved out of the project root, `npm test` compiled the project, ran `test-bplist`, `test-paste-guard` and `test-templates`, printed three `PASS` lines, and exited 0. **Passed.** The files were moved to the scratchpad rather than deleted. `tsc` regenerated them, except `test-deploy.js`, which has no source on this branch.
- **Failing test**: a temporary `test-zz-fail.ts` that exits 3 was reported as `FAIL  test-zz-fail.js (exit 3)` after the other three passed, and the run exited 1. **Passed.** The temporary file and its `.js` were removed.
- **Type error**: a temporary `const deliberateTypeError: number = "x";` appended to `main.ts` printed the `tsc` error and `FAIL  tsc (exit 2); no tests were run.`, and the run exited 1. **Passed.** `main.ts` was restored with `git checkout`.

### Regression Testing
The three existing test files all pass under the runner, as above.

## Manual Verification
1. Run `npm test` in a terminal. Each test file's output appears, then a summary with one `PASS` line per file, and `echo $?` (Git Bash) or `$LASTEXITCODE` (PowerShell) prints `0`. Run during implementation: **Passed**, exit code 0.

## Follow-ups
- Once `deploy-vault-path` is merged, `test-deploy.ts` will be picked up automatically, with no change to the runner.
- `tsc` also compiles `run-tests.ts` into `run-tests.js`, which calls `process.exit` when loaded. Nothing imports it, but it's another gitignored output in the project root.
