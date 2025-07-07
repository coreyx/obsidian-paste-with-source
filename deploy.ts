import * as fs from "fs";
import * as path from "path";

const vaultPath = path.join(process.env.HOME || process.env.USERPROFILE || "", "Documents", "Obsidian Vault");
const pluginId = "paste-with-source";
const pluginDest = path.join(vaultPath, ".obsidian", "plugins", pluginId);
const distDir = path.resolve(__dirname, "dist");

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

copyRecursive(distDir, pluginDest);
console.log(`✅ Plugin deployed to: ${pluginDest}`);
