import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ensureMonaco } from './monaco'
import { initPlatformChrome } from './utils/platform'

// Runs sync platform class before the first await, then refine via Wails.
void initPlatformChrome()
// Warm up Monaco in the background so New File / first text tab does not stall on bundle load.
void ensureMonaco()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
