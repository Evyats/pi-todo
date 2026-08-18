import { useState } from 'react'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Modal from '@mui/material/Modal'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { dateKey } from '../dates'
import { remainingNoticeDays } from '../hooks/useNotices'

export function TemplatesManager({ emptyText, templates, onAdd, onUpdate, onDelete, onMove = null }) {
  const [newTitle, setNewTitle] = useState('')
  const [newMinutes, setNewMinutes] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingMinutes, setEditingMinutes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function addSuggestion(event) {
    event.preventDefault()
    if (await onAdd(newTitle, newMinutes)) {
      setNewTitle('')
      setNewMinutes('')
    }
  }

  async function saveSuggestion(event) {
    event?.preventDefault()
    const valid = editingTitle.trim() && (editingMinutes === '' || (editingMinutes >= 1 && editingMinutes <= 90))
    if (!valid || savingEdit) return
    setSavingEdit(true)
    if (await onUpdate(editingId, editingTitle, editingMinutes)) setEditingId(null)
    setSavingEdit(false)
  }

  return (
    <Box sx={{ px: 2, pb: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack component="form" direction="row" spacing={1} onSubmit={addSuggestion} sx={{ pt: 2, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="New suggestion"
            value={newTitle}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            onChange={(event) => setNewTitle(event.target.value)}
          />
          <TextField
            type="number"
            size="small"
            label="Minutes"
            value={newMinutes}
            slotProps={{ htmlInput: { min: 1, max: 90 } }}
            onChange={(event) => setNewMinutes(event.target.value === '' ? '' : Number(event.target.value))}
            sx={{ width: 105, flexShrink: 0 }}
          />
          <Button type="submit" variant="contained" disabled={!newTitle.trim() || (newMinutes !== '' && (newMinutes < 1 || newMinutes > 90))} aria-label="Add suggestion">
            +
          </Button>
        </Stack>

        {templates.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            {emptyText}
          </Typography>
        ) : (
          <List disablePadding>
            {templates.map((template, index) => (
              <ListItem key={template.id} disableGutters divider sx={{ gap: 1, '&:last-child': { borderBottom: 0 } }}>
                <Button
                  color="inherit"
                  onClick={() => {
                    setEditingId(template.id)
                    setEditingTitle(template.title)
                    setEditingMinutes(template.estimated_minutes ?? '')
                  }}
                  sx={{ flex: 1, justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  <Box sx={{ width: '100%', textAlign: 'left' }}>
                    {template.title}
                    {template.estimated_minutes && (
                      <LinearProgress
                        variant="determinate"
                        value={(template.estimated_minutes / 90) * 100}
                        aria-label={`${template.estimated_minutes} minute estimate`}
                        sx={{ height: 5, mt: 0.75, borderRadius: 99 }}
                      />
                    )}
                  </Box>
                </Button>
                {onMove && (
                  <Stack direction="row" spacing={0}>
                    <IconButton disabled={index === 0} aria-label={`Move ${template.title} up`} onClick={() => onMove(template.id, -1)}><KeyboardArrowUpRoundedIcon /></IconButton>
                    <IconButton disabled={index === templates.length - 1} aria-label={`Move ${template.title} down`} onClick={() => onMove(template.id, 1)}><KeyboardArrowDownRoundedIcon /></IconButton>
                  </Stack>
                )}
                <IconButton
                  color="error"
                  aria-label={`Delete suggestion ${template.title}`}
                  onClick={() => onDelete(template.id)}
                >
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </ListItem>
            ))}
          </List>
        )}

        <Modal
          open={editingId !== null}
          onClose={(_, reason) => {
            if (reason === 'backdropClick') saveSuggestion()
          }}
          aria-labelledby="template-editor-title"
        >
          <Paper
            component="form"
            onSubmit={saveSuggestion}
            elevation={8}
            sx={{
              position: 'fixed',
              top: { xs: 'max(16px, env(safe-area-inset-top))', sm: '50%' },
              left: '50%',
              width: 'min(520px, calc(100vw - 24px))',
              maxHeight: 'calc(100dvh - 32px)',
              overflowY: 'auto',
              transform: { xs: 'translateX(-50%)', sm: 'translate(-50%, -50%)' },
              p: { xs: 2, sm: 2.5 },
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography id="template-editor-title" variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
              Edit task
            </Typography>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              maxRows={7}
              label="Task text"
              value={editingTitle}
              slotProps={{ htmlInput: { maxLength: 300 } }}
              onChange={(event) => setEditingTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  saveSuggestion()
                }
              }}
            />
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 1.5 }}>
              <TextField
                type="number"
                size="small"
                label="Minutes"
                value={editingMinutes}
                slotProps={{ htmlInput: { min: 1, max: 90 } }}
                onChange={(event) => setEditingMinutes(event.target.value === '' ? '' : Number(event.target.value))}
                sx={{ width: 120 }}
              />
              <Button type="submit" variant="contained" disabled={savingEdit || !editingTitle.trim() || (editingMinutes !== '' && (editingMinutes < 1 || editingMinutes > 90))} sx={{ ml: 'auto !important' }}>
                Save
              </Button>
            </Stack>
          </Paper>
        </Modal>
    </Box>
  )
}

export function NoticesManager({ notices, onAdd, onUpdate, onDelete, onMove }) {
  const [newTitle, setNewTitle] = useState('')
  const [newDays, setNewDays] = useState(1)
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDays, setEditingDays] = useState(1)
  const [saving, setSaving] = useState(false)
  const today = dateKey()
  const validDays = (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 365

  async function addNotice(event) {
    event.preventDefault()
    if (!newTitle.trim() || !validDays(newDays)) return
    if (await onAdd(newTitle, Number(newDays))) {
      setNewTitle('')
      setNewDays(1)
    }
  }

  function startEditing(notice) {
    setEditingId(notice.id)
    setEditingTitle(notice.title)
    setEditingDays(remainingNoticeDays(notice.expires_on, today))
  }

  async function saveNotice(event) {
    event?.preventDefault()
    if (!editingTitle.trim() || !validDays(editingDays) || saving) return
    setSaving(true)
    if (await onUpdate(editingId, editingTitle, Number(editingDays))) setEditingId(null)
    setSaving(false)
  }

  return (
    <Box sx={{ px: 2, pb: 2, borderTop: 1, borderColor: 'divider' }}>
      <Stack component="form" direction="row" spacing={1} onSubmit={addNotice} sx={{ pt: 2, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="New notice"
          value={newTitle}
          slotProps={{ htmlInput: { maxLength: 300 } }}
          onChange={(event) => setNewTitle(event.target.value)}
        />
        <TextField
          type="number"
          size="small"
          label="Days"
          value={newDays}
          slotProps={{ htmlInput: { min: 1, max: 365 } }}
          onChange={(event) => setNewDays(event.target.value)}
          sx={{ width: 92, flexShrink: 0 }}
        />
        <Button type="submit" variant="contained" disabled={!newTitle.trim() || !validDays(newDays)} aria-label="Add notice">+</Button>
      </Stack>

      {notices.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No active notices.</Typography>
      ) : (
        <List disablePadding>
          {notices.map((notice, index) => {
            const daysLeft = remainingNoticeDays(notice.expires_on, today)
            return (
              <ListItem key={notice.id} disableGutters divider sx={{ gap: 1, '&:last-child': { borderBottom: 0 } }}>
                <Button color="inherit" onClick={() => startEditing(notice)} sx={{ minWidth: 0, flex: 1, justifyContent: 'flex-start', textTransform: 'none', textAlign: 'left' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ overflowWrap: 'anywhere' }}>{notice.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</Typography>
                  </Box>
                </Button>
                <Stack direction="row" spacing={0}>
                  <IconButton disabled={index === 0} aria-label={`Move ${notice.title} up`} onClick={() => onMove(notice.id, -1)}><KeyboardArrowUpRoundedIcon /></IconButton>
                  <IconButton disabled={index === notices.length - 1} aria-label={`Move ${notice.title} down`} onClick={() => onMove(notice.id, 1)}><KeyboardArrowDownRoundedIcon /></IconButton>
                </Stack>
                <IconButton color="error" aria-label={`Delete notice ${notice.title}`} onClick={() => onDelete(notice.id)}><DeleteOutlineRoundedIcon /></IconButton>
              </ListItem>
            )
          })}
        </List>
      )}

      <Modal open={editingId !== null} onClose={(_, reason) => { if (reason === 'backdropClick') saveNotice() }} aria-labelledby="notice-editor-title">
        <Paper component="form" onSubmit={saveNotice} elevation={8} sx={{ position: 'fixed', top: { xs: 'max(16px, env(safe-area-inset-top))', sm: '50%' }, left: '50%', width: 'min(520px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', transform: { xs: 'translateX(-50%)', sm: 'translate(-50%, -50%)' }, p: { xs: 2, sm: 2.5 }, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Typography id="notice-editor-title" variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>Edit notice</Typography>
          <TextField autoFocus fullWidth multiline minRows={3} maxRows={7} label="Notice text" value={editingTitle} slotProps={{ htmlInput: { maxLength: 300 } }} onChange={(event) => setEditingTitle(event.target.value)} />
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 1.5 }}>
            <TextField type="number" size="small" label="Days remaining" value={editingDays} slotProps={{ htmlInput: { min: 1, max: 365 } }} onChange={(event) => setEditingDays(event.target.value)} sx={{ width: 150 }} />
            <Button type="submit" variant="contained" disabled={saving || !editingTitle.trim() || !validDays(editingDays)} sx={{ ml: 'auto !important' }}>Save</Button>
          </Stack>
        </Paper>
      </Modal>
    </Box>
  )
}

export function SettingsSection({ title, expanded, onToggle, divider = true, children }) {
  return (
    <Box sx={{ borderTop: divider ? 1 : 0, borderColor: 'divider' }}>
      <Button
        color="inherit"
        fullWidth
        onClick={onToggle}
        aria-expanded={expanded}
        sx={{ justifyContent: 'space-between', px: 2, py: 1.5, fontSize: 15, fontWeight: 500, textTransform: 'none' }}
      >
        {title}
        <ExpandMoreRoundedIcon
          sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}
        />
      </Button>
      <Collapse in={expanded}>{children}</Collapse>
    </Box>
  )
}
