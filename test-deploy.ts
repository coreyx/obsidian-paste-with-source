import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { DeployError, resolveVaultPath } from "./deploy";

let failures = 0;

const root = fs.mkdtempSync(path.join(os.tmpdir(), "paste-with-source-deploy-"));
const vault = path.join(root, "vault");
const otherVault = path.join(root, "other-vault");
const notAVault = path.join(root, "not-a-vault");
fs.mkdirSync(path.join(vault, ".obsidian"), { recursive: true });
fs.mkdirSync(path.join(otherVault, ".obsidian"), { recursive: true });
fs.mkdirSync(notAVault);

/** Records a pass when resolveVaultPath returns `expected` for these inputs. */
function expectResolves(name: string, argv: string[], env: NodeJS.ProcessEnv, expected: string) {
  let result: string | Error;
  try {
    result = resolveVaultPath(argv, env);
  } catch (error) {
    result = error as Error;
  }
  const ok = result === expected;
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${ok ? "" : ` (got ${result})`}`);
}

/** Records a pass when resolveVaultPath refuses these inputs with a DeployError. */
function expectRefuses(name: string, argv: string[], env: NodeJS.ProcessEnv) {
  let result: unknown;
  try {
    result = resolveVaultPath(argv, env);
  } catch (error) {
    result = error;
  }
  const ok = result instanceof DeployError;
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${ok ? "" : ` (got ${result})`}`);
}

try {
  console.log("\nVault path resolution");
  expectResolves("--vault <path> resolves", ["--vault", vault], {}, vault);
  expectResolves("--vault=<path> resolves", [`--vault=${vault}`], {}, vault);
  expectResolves("the argument wins over OBSIDIAN_VAULT", ["--vault", vault], { OBSIDIAN_VAULT: otherVault }, vault);
  expectResolves("OBSIDIAN_VAULT alone resolves", [], { OBSIDIAN_VAULT: otherVault }, otherVault);
  expectRefuses("neither set: refused", [], {});
  expectRefuses("a missing path: refused", ["--vault", path.join(root, "missing")], {});
  expectRefuses("a folder without .obsidian: refused", ["--vault", notAVault], {});
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} deploy test(s) failed.\n`);
  process.exit(1);
}
console.log("\nAll deploy tests passed successfully! 🎉\n");
