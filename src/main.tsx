import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initPersistentStore } from '@/shared/utils/persistentStore'

// Settings are read synchronously while rendering, so the desktop store is loaded first.
void initPersistentStore().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
