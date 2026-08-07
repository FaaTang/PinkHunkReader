import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initPlatformChrome } from './utils/platform'

// Runs sync platform class before the first await, then refine via Wails.
void initPlatformChrome()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
