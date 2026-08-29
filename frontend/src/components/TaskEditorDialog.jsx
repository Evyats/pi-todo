import { createPortal } from 'react-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { SlideUpTransition } from './SlideUpTransition'

export function TaskEditorDialog({ open, title, onTitleChange, onSave, onCancel }) {
  if (!open) return null
  return createPortal(
    <Box role="presentation" onClick={onSave} sx={{ position: 'fixed', zIndex: 1400, inset: 0, bgcolor: 'rgba(0, 0, 0, .42)' }}>
      <SlideUpTransition in appear>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'center', px: 1.5, pt: { xs: 'max(16px, env(safe-area-inset-top))', sm: 0 }, pointerEvents: 'none' }}>
          <Paper
            component="form"
            role="dialog"
            aria-modal="true"
            aria-label="Edit task text"
            elevation={10}
            onSubmit={onSave}
            onClick={onSave}
            sx={{ width: 'min(520px, 100%)', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', p: { xs: 2, sm: 2.5 }, border: 1, borderColor: 'divider', borderRadius: 2, pointerEvents: 'auto' }}
          >
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              maxRows={8}
              label="Task text"
              value={title}
              slotProps={{ htmlInput: { maxLength: 300, dir: 'auto' } }}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onTitleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  onCancel()
                } else if (event.key === 'Enter' && !event.shiftKey) {
                  onSave(event)
                }
              }}
              sx={{ '& textarea': { textAlign: 'right' } }}
            />
            <Typography sx={{ mt: 1.25, color: 'text.secondary', fontSize: 12, textAlign: 'center' }}>
              Press Enter or tap outside to save
            </Typography>
          </Paper>
        </Box>
      </SlideUpTransition>
    </Box>,
    document.body,
  )
}
