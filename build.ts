import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const distDir = path.resolve(__dirname, "dist");
const pluginFiles = ["main.js", "manifest.json"];

function run(command: string) {
  console.log(`> ${command}`);
  execSync(command, { stdio: "inherit" });
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src: string, dest: string) {
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${src} → ${dest}`);
}

function buildPlugin() {
  run("tsc");
}

function copyOutputs() {
  ensureDir(distDir);

  // Copy distribution files to dist/
  for (const file of pluginFiles) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(distDir, file));
    }
  }
}

buildPlugin();
copyOutputs();
console.log("✅ Build complete. Distribution staged in dist/");
