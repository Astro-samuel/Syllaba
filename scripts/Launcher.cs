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
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string rootDir = Path.GetFullPath(Path.Combine(baseDir, ".."));

                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c npx electron .",
                    WorkingDirectory = rootDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to launch Syllaba Desktop App: " + ex.Message, "Syllaba Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
