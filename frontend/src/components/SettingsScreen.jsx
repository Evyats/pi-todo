import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Paper from '@mui/material/Paper'
import Radio from '@mui/material/Radio'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { SOUND_OPTIONS, playCompletionSound } from '../completionSound'
import { NoticesManager, SettingsSection, TemplatesManager } from './SettingsComponents'

export function SettingsScreen({
  mode, onToggleMode, onClose, section, onSectionChange,
  completionSound, onCompletionSoundChange,
  completionSoundStyle, onCompletionSoundStyleChange,
  suggestionsStore, recurringStore, noticesStore,
}) {
  const toggleSection = (value) => onSectionChange(section === value ? null : value)
  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 34 }}>
          <Box aria-hidden sx={{ width: 34, flexShrink: 0 }} />
          <Typography
            variant="h2"
            sx={{ flex: 1, minWidth: 0, textAlign: 'center', fontFamily: '"Space Grotesk", sans-serif', fontSize: { xs: 23, sm: 27 }, fontWeight: 800, letterSpacing: '-.045em' }}
          >
            Settings
          </Typography>
          <IconButton
            aria-label="Back to tasks"
            onClick={onClose}
            sx={{ width: 34, height: 34, flexShrink: 0, border: 1, borderColor: 'divider', '& svg': { fontSize: 20 } }}
          >
            <ArrowBackRoundedIcon />
          </IconButton>
        </Box>
        <Typography sx={{ color: 'text.secondary', fontSize: { xs: 12, sm: 13 }, fontWeight: 400, textAlign: 'center' }}>
          Some settings are device-specific
        </Typography>
      </Stack>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Button color="inherit" fullWidth onClick={onToggleMode} sx={{ justifyContent: 'space-between', px: 2, py: 1.5, borderRadius: 0, fontSize: 15, fontWeight: 500, textTransform: 'none' }}>
          Dark mode
          {mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.75, borderTop: 1, borderColor: 'divider' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 500 }}>Completion sound</Typography>
          <Switch checked={completionSound} onChange={(event) => onCompletionSoundChange(event.target.checked)} slotProps={{ input: { 'aria-label': 'Completion sound' } }} />
        </Box>
        <SettingsSection title="Sound style" expanded={section === 'sound'} onToggle={() => toggleSection('sound')}>
          <List disablePadding sx={{ borderTop: 1, borderColor: 'divider' }}>
            {SOUND_OPTIONS.map(([value, label]) => (
              <ListItem key={value} divider sx={{ py: 0.35, '&:last-child': { borderBottom: 0 } }}>
                <Radio checked={completionSoundStyle === value} onChange={() => onCompletionSoundStyleChange(value)} value={value} name="completion-sound-style" slotProps={{ input: { 'aria-label': `Choose ${label}` } }} />
                <Typography sx={{ flex: 1 }}>{label}</Typography>
                <IconButton aria-label={`Preview ${label}`} onClick={() => playCompletionSound(value)}><VolumeUpRoundedIcon /></IconButton>
              </ListItem>
            ))}
          </List>
        </SettingsSection>
      </Paper>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <SettingsSection title="Suggestions" divider={false} expanded={section === 'suggestions'} onToggle={() => toggleSection('suggestions')}>
          <TemplatesManager emptyText="No suggestions yet." templates={suggestionsStore.items} onAdd={suggestionsStore.add} onUpdate={suggestionsStore.update} onDelete={suggestionsStore.remove} />
        </SettingsSection>
        <SettingsSection title="Recurring tasks" expanded={section === 'recurring'} onToggle={() => toggleSection('recurring')}>
          <TemplatesManager emptyText="No recurring tasks yet." templates={recurringStore.items} onAdd={recurringStore.add} onUpdate={recurringStore.update} onDelete={recurringStore.remove} onMove={recurringStore.move} />
        </SettingsSection>
        <SettingsSection title="Notices" expanded={section === 'notices'} onToggle={() => toggleSection('notices')}>
          <NoticesManager notices={noticesStore.items} onAdd={noticesStore.add} onUpdate={noticesStore.update} onDelete={noticesStore.remove} onMove={noticesStore.move} />
        </SettingsSection>
      </Paper>
    </Stack>
  )
}
