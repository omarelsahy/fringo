import { contextBridge, ipcRenderer } from 'electron'
import type { DevScenario } from '../../../src/dev/scenarios'

contextBridge.exposeInMainWorld('fringoLauncher', {
  checkDevServer: (url: string) => ipcRenderer.invoke('check-dev-server', url) as Promise<boolean>,
  applyScenario: (gameId: string, scenario: DevScenario) =>
    ipcRenderer.invoke('apply-scenario', { gameId, scenario }) as Promise<void>,
})

export type FringoLauncherApi = {
  checkDevServer: (url: string) => Promise<boolean>
  applyScenario: (gameId: string, scenario: DevScenario) => Promise<void>
}

declare global {
  interface Window {
    fringoLauncher: FringoLauncherApi
  }
}
