using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace SyllabaLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                // baseDir IS the self-contained app folder -- package-desktop.js
                // copies dist/, electron/, and package.json (main: electron/main.cjs)
                // directly into it. This folder has no node_modules of its own
                // (package-desktop.js never copies one), so it can't run
                // `npx electron .` from here without npm trying to download
                // Electron over the network on every launch. Instead, run the
                // Electron binary already installed in the main repo's
                // node_modules directly, pointed at this folder as the app to load.
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string repoRoot = Path.GetFullPath(Path.Combine(baseDir, ".."));
                string electronExe = Path.Combine(repoRoot, "node_modules", "electron", "dist", "electron.exe");

                if (!File.Exists(electronExe))
                {
                    MessageBox.Show(
                        "Could not find the Electron runtime at:\n" + electronExe +
                        "\n\nRun 'npm install' in the main Syllaba project folder first.",
                        "Syllaba Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = electronExe,
                    Arguments = "\"" + baseDir + "\"",
                    WorkingDirectory = baseDir,
                    UseShellExecute = false
                };
                // Required, not cosmetic: without it, main.cjs's
                // `!app.isPackaged && NODE_ENV !== 'production'` is true (running
                // the electron.exe binary directly against a plain folder is never
                // "packaged" in Electron's sense), so it tries to load the Vite dev
                // server on localhost:5173 -- which isn't running for an end user --
                // instead of the built dist/index.html. That produced a silent
                // blank white window with no error message at all.
                psi.EnvironmentVariables["NODE_ENV"] = "production";

                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to launch Syllaba Desktop App: " + ex.Message, "Syllaba Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
