import * as fs from "fs";
import * as path from "path";

const pluginId = "paste-with-source";
const distDir = path.resolve(__dirname, "dist");

/** A deploy failure the user can fix by pointing the script at a vault; printed without a stack trace. */
export class DeployError extends Error {}

const usage = 'Pass a vault with `npm run deploy -- --vault "<path to vault>"`, or set OBSIDIAN_VAULT to it.';

/**
 * Works out which vault to deploy into: a `--vault <path>` or `--vault=<path>`
 * argument first, then the OBSIDIAN_VAULT environment variable. There is no
 * default, because a guessed folder that isn't a vault would silently receive
 * a plugin folder nothing ever loads. The folder must exist and hold a
 * `.obsidian` folder, for the same reason.
 */
export function resolveVaultPath(argv: string[], env: NodeJS.ProcessEnv): string {
  let fromArgs: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--vault") fromArgs = argv[i + 1];
    else if (argv[i].startsWith("--vault=")) fromArgs = argv[i].slice("--vault=".length);
  }

  const vaultPath = fromArgs || env.OBSIDIAN_VAULT;
  if (!vaultPath) {
    throw new DeployError(`No vault given: neither --vault nor OBSIDIAN_VAULT is set.\n${usage}`);
  }

  const source = fromArgs ? "--vault" : "OBSIDIAN_VAULT";
  const resolved = path.resolve(vaultPath);
  if (!fs.existsSync(resolved)) {
    throw new DeployError(`The vault from ${source} doesn't exist: ${resolved}\n${usage}`);
  }
  if (!fs.existsSync(path.join(resolved, ".obsidian"))) {
    throw new DeployError(`The folder from ${source} isn't an Obsidian vault (it has no .obsidian folder): ${resolved}\n${usage}`);
  }
  return resolved;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src: string, dest: string) {
  ensureDir(dest);
  for (const file of fs.readdirSync(src)) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Deployed: ${file}`);
    }
  }
}

const vaultPath = resolveVaultPath(process.argv.slice(2), process.env);
const pluginDest = path.join(vaultPath, ".obsidian", "plugins", pluginId);
copyRecursive(distDir, pluginDest);
console.log(`✅ Plugin deployed to: ${pluginDest}`);
