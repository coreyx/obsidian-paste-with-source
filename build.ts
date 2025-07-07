import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const pluginOutDir = path.resolve(__dirname);
const csProjPath = path.resolve(__dirname, "ClipboardReader", "ClipboardReader.csproj");
const pluginSrc = path.resolve(__dirname, "src");
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

function buildCSharp() {
  run(`dotnet build "${csProjPath}" -c Release`);
}

function copyOutputs() {
  ensureDir(pluginOutDir);

  // Copy plugin files
  for (const file of pluginFiles) {
    copyFile(path.join(__dirname, file), path.join(pluginOutDir, file));
  }

  // Copy compiled .exe
  const exePath = path.join(
    __dirname,
    "ClipboardReader",
    "bin",
    "Release",
    "net6.0-windows",
    "ClipboardReader.exe"
  );
  copyFile(exePath, path.join(pluginOutDir, "ClipboardReader.exe"));
}

buildPlugin();
buildCSharp();
copyOutputs();
