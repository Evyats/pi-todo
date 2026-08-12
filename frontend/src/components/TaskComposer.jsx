import AddRoundedIcon from '@mui/icons-material/AddRounded'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Fab from '@mui/material/Fab'
import TextField from '@mui/material/TextField'

export function TaskComposer({ open, title, suggestions, onTitleChange, onAdd, onClose, onEntered }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" disableScrollLock slotProps={{ transition: { onEntered } }} sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' }, '& .MuiDialog-paper': { mt: { xs: 2, sm: 6 }, maxHeight: 'calc(100dvh - 32px)' } }}>
      <DialogTitle>Add task</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={onAdd} sx={{ display: 'flex', gap: 1, pt: 1 }}>
          <Autocomplete
            freeSolo autoHighlight fullWidth options={suggestions} inputValue={title}
            getOptionLabel={(option) => typeof option === 'string' ? option : option.title}
            filterOptions={(options, state) => {
              const prefix = state.inputValue.trim().toLocaleLowerCase()
              return prefix ? options.filter((option) => option.title.toLocaleLowerCase().startsWith(prefix)) : []
            }}
            onInputChange={(_, value) => onTitleChange(value)}
            onChange={(_, value) => { if (value && typeof value !== 'string') onAdd(null, value) }}
            renderInput={(params) => <TextField {...params} label="Task" slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, maxLength: 300 } }} />}
          />
          <Fab type="submit" size="small" color="primary" disabled={!title.trim()} aria-label="Save task" sx={{ mt: 0.75, flexShrink: 0 }}><AddRoundedIcon /></Fab>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
