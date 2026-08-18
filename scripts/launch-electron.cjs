// Launches Electron with a clean environment.
//
// If ELECTRON_RUN_AS_NODE=1 is present in the environment (common when a
// parent dev-tooling process is itself Electron-based and the variable
// leaks down through inherited env vars), Electron's own binary runs as
// plain Node instead of booting the app runtime — `require('electron')`
// then resolves to the binary's file path instead of the {app, BrowserWindow, ...}
// object, and main.cjs crashes on `app.whenReady()`. Stripping the var
// before spawning electron.exe avoids that regardless of what set it.
const { spawn } = require('child_process');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code === null ? 1 : code));
child.on('error', (err) => {
  console.error('Failed to launch Electron:', err);
  process.exit(1);
});
