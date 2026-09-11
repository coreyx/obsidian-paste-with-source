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
  if (process.platform !== "win32") {
    console.log("> Skipping C# build (ClipboardReader.exe is only needed on Windows)");
    return;
  }
  try {
    run(`dotnet build "${csProjPath}" -c Release`);
  } catch (e) {
    console.warn("Warning: dotnet build failed. ClipboardReader.exe may not be updated.");
  }
}

const distDir = path.resolve(__dirname, "dist");

function copyOutputs() {
  ensureDir(distDir);

  // Copy plugin files to dist/
  for (const file of pluginFiles) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(distDir, file));
    }
  }

  // Copy compiled .exe if it exists (for Windows root and dist)
  const exePath = path.join(
    __dirname,
    "ClipboardReader",
    "bin",
    "Release",
    "net6.0-windows",
    "ClipboardReader.exe"
  );
  if (fs.existsSync(exePath)) {
    copyFile(exePath, path.join(__dirname, "ClipboardReader.exe"));
    copyFile(exePath, path.join(distDir, "ClipboardReader.exe"));
  }
}

buildPlugin();
buildCSharp();
copyOutputs();
