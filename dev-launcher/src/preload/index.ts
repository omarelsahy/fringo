import { contextBridge, ipcRenderer } from 'electron'
import type { DevPlayerReadyPayload, LauncherStatus, SessionConfig } from '../shared/types'

contextBridge.exposeInMainWorld('fringoLauncher', {
  launchSession: (config: SessionConfig) => ipcRenderer.invoke('launch-session', config),
  navigateAll: (route: string) => ipcRenderer.invoke('navigate-all', route),
  reloadAll: () => ipcRenderer.invoke('reload-all'),
  resetSession: () => ipcRenderer.invoke('reset-session'),
  checkDevServer: (url: string) => ipcRenderer.invoke('check-dev-server', url),
  onStatus: (callback: (status: LauncherStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: LauncherStatus) => callback(status)
    ipcRenderer.on('launcher-status', listener)
    return () => ipcRenderer.removeListener('launcher-status', listener)
  },
})

export type FringoLauncherApi = {
  launchSession: (config: SessionConfig) => Promise<void>
  navigateAll: (route: string) => Promise<void>
  reloadAll: () => Promise<void>
  resetSession: () => Promise<void>
  checkDevServer: (url: string) => Promise<boolean>
  onStatus: (callback: (status: LauncherStatus) => void) => () => void
}

declare global {
  interface Window {
    fringoLauncher: FringoLauncherApi
  }
}

export type { DevPlayerReadyPayload }
