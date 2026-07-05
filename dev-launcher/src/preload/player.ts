import { contextBridge, ipcRenderer } from 'electron'
import type { DevPlayerReadyPayload } from '../shared/types'

contextBridge.exposeInMainWorld('fringoDev', {
  playerReady: (payload: DevPlayerReadyPayload) => {
    ipcRenderer.send('player-ready', payload)
  },
})
