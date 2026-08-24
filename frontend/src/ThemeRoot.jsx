import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
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
      primary: { main: mode === 'dark' ? '#3478ff' : '#1a73e8' },
      background: mode === 'dark'
        ? { default: '#0b0d12', paper: '#151820' }
        : { default: '#f7f8fc', paper: '#ffffff' },
    },
    shape: { borderRadius: 6 },
    typography: {
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      button: { fontWeight: 700 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: mode === 'dark' ? {
            backgroundColor: '#0b0d12',
          } : {},
        },
      },
    },
  }), [mode])

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#0b0d12' : '#f7f8fc')
  }, [mode])

  function toggleMode() {
    const updateMode = () => setMode((current) => current === 'light' ? 'dark' : 'light')
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updateMode()
      return
    }
    document.startViewTransition(() => {
      flushSync(updateMode)
    })
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App
        mode={mode}
        onToggleMode={toggleMode}
      />
    </ThemeProvider>
  )
}
