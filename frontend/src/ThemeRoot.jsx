import { useEffect, useMemo, useState } from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import App from './App.jsx'

const THEME_STORAGE_KEY = 'pi-todo-color-mode'

export default function ThemeRoot() {
  const [mode, setMode] = useState(() => (
    localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  ))
  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: mode === 'dark' ? '#8ab4f8' : '#1a73e8' },
      background: mode === 'dark'
        ? { default: '#101318', paper: '#191d24' }
        : { default: '#f7f8fc', paper: '#ffffff' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      button: { fontWeight: 700 },
    },
  }), [mode])

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#101318' : '#f7f8fc')
  }, [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App
        mode={mode}
        onToggleMode={() => setMode((current) => current === 'light' ? 'dark' : 'light')}
      />
    </ThemeProvider>
  )
}
