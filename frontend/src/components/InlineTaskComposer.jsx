import { useCallback, useEffect, useRef } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import ListItem from '@mui/material/ListItem'
import TextField from '@mui/material/TextField'

export function InlineTaskComposer({ title, suggestions, onTitleChange, onAdd, onAddDivider, onCancel }) {
  const rowRef = useRef(null)
  const savingRef = useRef(false)
  const cancelledRef = useRef(false)

  const save = useCallback(async (event, suggestion = null) => {
    event?.preventDefault()
    if (savingRef.current) return
    const value = (suggestion?.title ?? title).trim()
    savingRef.current = true
    if (value) await onAdd(null, suggestion)
    else await onAddDivider()
    savingRef.current = false
  }, [onAdd, onAddDivider, title])

  useEffect(() => {
    let outsidePointerActive = false

    function belongsToComposer(target) {
      if (!(target instanceof Element)) return false
      return Boolean(
        rowRef.current?.contains(target)
        || target.closest('[role="option"], .MuiAutocomplete-popper'),
      )
    }

    function consume(event) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    function handlePointerDown(event) {
      if (belongsToComposer(event.target)) {
        outsidePointerActive = false
        return
      }
      outsidePointerActive = true
      consume(event)
    }

    function handleClick(event) {
      if (!outsidePointerActive && belongsToComposer(event.target)) return
      outsidePointerActive = false
      consume(event)
      save()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('click', handleClick, true)
    }
  }, [save])

  function handleBlur(event) {
    if (cancelledRef.current) return
    if (rowRef.current?.contains(event.relatedTarget)) return
    if (event.relatedTarget?.closest?.('[role="option"]')) return
    window.setTimeout(() => {
      if (!rowRef.current?.contains(document.activeElement)) save()
    }, 0)
  }

  return (
    <ListItem
      ref={rowRef}
      component="form"
      disableGutters
      onSubmit={save}
      onBlur={handleBlur}
      sx={{ minHeight: 56, gap: { xs: 0.15, sm: 0.5 }, py: 0.35 }}
    >
      <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0 }} />
      <Autocomplete
        freeSolo
        autoHighlight
        fullWidth
        options={suggestions}
        inputValue={title}
        getOptionLabel={(option) => typeof option === 'string' ? option : option.title}
        filterOptions={(options, state) => {
          const prefix = state.inputValue.trim().toLocaleLowerCase()
          return prefix ? options.filter((option) => option.title.toLocaleLowerCase().startsWith(prefix)) : []
        }}
        onInputChange={(_, value) => onTitleChange(value)}
        onChange={(_, value) => {
          if (value && typeof value !== 'string') save(null, value)
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus
            placeholder="New task"
            variant="standard"
            slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, maxLength: 300, dir: 'auto' } }}
            sx={{ '& input': { textAlign: 'start' } }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelledRef.current = true
                onCancel()
              }
            }}
          />
        )}
      />
      <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0 }} />
      <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0 }} />
    </ListItem>
  )
}
