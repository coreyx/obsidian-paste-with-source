import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const projectDir = __dirname;

/**
 * Runs `script` with this Node binary and inherited output, returning its exit
 * code. A process killed by a signal has no exit code and counts as a failure.
 */
function runNode(script: string, args: string[] = []): number {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: projectDir, stdio: "inherit" });
  return result.status ?? 1;
}

/**
 * Compiles the project, then runs every root `test-*.ts` from its compiled
 * `.js`. The tests import `./main`, which resolves to `main.js`, so without the
 * compile they would silently check whatever was built last. Each file gets
 * its own process because the tests replace globals and call process.exit.
 */
function main(): number {
  // The project's own compiler, so a different global tsc on the PATH can't be picked up.
  const tsc = require.resolve("typescript/bin/tsc", { paths: [projectDir] });
  console.log("> tsc");
  const compileCode = runNode(tsc, ["-p", projectDir]);
  if (compileCode !== 0) {
    console.error(`\nFAIL  tsc (exit ${compileCode}); no tests were run.`);
    return 1;
  }

  // Only .js files built from a .ts source count, so a stale output whose source was deleted is skipped.
  const testFiles = fs
    .readdirSync(projectDir)
    .filter((file) => /^test-.*\.ts$/.test(file) && !file.endsWith(".d.ts"))
    .sort()
    .map((file) => file.replace(/\.ts$/, ".js"));

  const results: [string, number][] = [];
  for (const file of testFiles) {
    console.log(`\n> node ${file}`);
    results.push([file, runNode(path.join(projectDir, file))]);
  }

  console.log("\nTest summary");
  for (const [file, code] of results) {
    console.log(code === 0 ? `  PASS  ${file}` : `  FAIL  ${file} (exit ${code})`);
  }
  return results.every(([, code]) => code === 0) ? 0 : 1;
}

process.exit(main());
