import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

export const SCREEN_TOGGLE_WIDTH = 72

export function ScreenToggle({ screen, onChange }) {
  const handleChange = (_, nextScreen) => {
    if (nextScreen && nextScreen !== screen) onChange(nextScreen)
  }

  return (
    <ToggleButtonGroup
      value={screen}
      exclusive
      onChange={handleChange}
      aria-label="Choose screen"
      sx={{
        direction: 'ltr',
        width: SCREEN_TOGGLE_WIDTH,
        height: 34,
        flexShrink: 0,
        borderRadius: 999,
        overflow: 'hidden',
        '& .MuiToggleButtonGroup-grouped': {
          width: 36,
          height: 34,
          p: 0,
          borderColor: 'divider',
          color: 'text.secondary',
          '&:first-of-type': { borderRadius: '999px 0 0 999px' },
          '&:last-of-type': { borderRadius: '0 999px 999px 0' },
          '&.Mui-selected': {
            color: 'text.primary',
            bgcolor: 'action.selected',
          },
          '&.Mui-selected:hover': { bgcolor: 'action.selected' },
        },
        '& svg': { fontSize: 19 },
      }}
    >
      <ToggleButton value="settings" aria-label="Settings">
        <SettingsOutlinedIcon />
      </ToggleButton>
      <ToggleButton value="tasks" aria-label="Tasks">
        <CheckRoundedIcon />
      </ToggleButton>
    </ToggleButtonGroup>
  )
}
