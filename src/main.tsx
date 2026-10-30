// Entry point: mounts <App/> and exposes the store for scripts.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Dev/test hook: lets scripts drive the app (e.g. __store.getState().requestTeleport(150, 300, -90)).
import { useStore } from './store'
;(window as unknown as { __store: typeof useStore }).__store = useStore
