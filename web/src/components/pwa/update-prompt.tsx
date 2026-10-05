import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_ID = 'pwa-update'
const OFFLINE_ID = 'pwa-offline-ready'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!offlineReady) return
    toast.success('Ready to work offline', { id: OFFLINE_ID })
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady])

  useEffect(() => {
    if (!needRefresh) return
    toast('A new version is available', {
      action: { label: 'Reload', onClick: () => void updateServiceWorker(true) },
      duration: Infinity,
      id: UPDATE_ID,
    })
  }, [needRefresh, updateServiceWorker])

  return null
}
