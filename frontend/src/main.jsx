import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ThemeRoot from './ThemeRoot.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeRoot />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/todo/sw.js', { scope: '/todo/' }))
}
