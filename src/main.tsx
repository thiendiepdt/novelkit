import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initPersistentStore } from '@/shared/utils/persistentStore'

// The QT Web translator was removed; drop the dictionary cache it left in IndexedDB.
try {
  indexedDB.deleteDatabase('cv_translator_db')
} catch {
  // IndexedDB unavailable: nothing to clean up
}

// Settings are read synchronously while rendering, so the desktop store is loaded first.
void initPersistentStore().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
