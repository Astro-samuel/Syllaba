import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'Syllaba-Desktop-Windows');

console.log('🚀 Building Production Web Assets...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

console.log('📦 Assembling Standalone Desktop Package...');

// Clean destination directory
if (fs.existsSync(outDir)) {
  fs.removeSync(outDir);
}
fs.mkdirSync(outDir, { recursive: true });

// Copy built web app files and electron main script
fs.copySync(path.join(rootDir, 'dist'), path.join(outDir, 'dist'));
fs.copySync(path.join(rootDir, 'electron'), path.join(outDir, 'electron'));

// Write package manifest for desktop app
const desktopPackageJson = {
  name: "syllaba-desktop",
  version: "1.0.0",
  main: "electron/main.cjs",
  description: "Syllaba Desktop AI Syllabus Tracker"
};
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(desktopPackageJson, null, 2));

// Compile native C# .exe launcher
console.log('⚡ Compiling standalone Syllaba-Desktop.exe executable...');
const cscPath = `C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe`;
const launcherCs = path.join(rootDir, 'scripts', 'Launcher.cs');
const targetExe = path.join(outDir, 'Syllaba-Desktop.exe');

try {
  execSync(`"${cscPath}" /target:winexe /out:"${targetExe}" /r:System.Windows.Forms.dll "${launcherCs}"`, { stdio: 'inherit' });
  console.log(`✨ Native Executable Compiled: ${targetExe}`);
} catch (err) {
  console.warn('Fallback to batch launcher...');
  const batContent = `@echo off\ntitle Syllaba Desktop\nstart "" npx electron .\n`;
  fs.writeFileSync(path.join(outDir, 'Syllaba-Desktop.bat'), batContent, 'utf-8');
}

console.log(`\n🎉 Desktop app ready at:\n   ${targetExe}`);
