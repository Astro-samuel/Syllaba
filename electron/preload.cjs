const { contextBridge, ipcRenderer } = require('electron');

// Exposes a narrow, explicit bridge instead of the whole ipcRenderer/node
// API — contextIsolation stays on, the renderer only gets this one method.
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Mirrors the app's current courses/assignments to ~/.syllaba/data.json
   * so the MCP server (a separate process) can read them. Fire-and-forget
   * from the caller's perspective — failures are logged in the main
   * process, not surfaced to the UI, since this is a best-effort export
   * and the app's real data (localStorage) is unaffected either way.
   */
  syncSyllabaData: (payload) => ipcRenderer.invoke('syllaba:sync', payload)
});
