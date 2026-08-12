export const SOUND_OPTIONS = [
  ['glass-clink', 'Glass clink'],
  ['soft-bell', 'Soft bell'],
  ['coin-pickup', 'Coin pickup'],
  ['digital-success', 'Digital success'],
  ['crystal-sparkle', 'Crystal sparkle'],
  ['soft-marimba', 'Soft marimba'],
]

export const SOUND_OPTION_VALUES = new Set(SOUND_OPTIONS.map(([value]) => value))

export function playCompletionSound(style = 'glass-clink') {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  const context = new AudioContext()
  const presets = {
    'glass-clink': [[1350, 0, .16, 'sine'], [1900, .035, .2, 'sine']],
    'soft-bell': [[660, 0, .42, 'sine'], [990, .04, .36, 'sine']],
    'coin-pickup': [[880, 0, .1, 'square'], [1320, .065, .11, 'square'], [1760, .13, .14, 'sine']],
    'digital-success': [[523, 0, .12, 'sine'], [659, .075, .13, 'sine'], [784, .15, .18, 'sine']],
    'crystal-sparkle': [[1760, 0, .14, 'sine'], [2349, .055, .15, 'sine'], [2093, .12, .2, 'sine']],
    'soft-marimba': [[440, 0, .2, 'sine'], [880, 0, .11, 'sine']],
  }
  const notes = presets[style] || presets['glass-clink']
  let finishAt = 0
  notes.forEach(([frequency, delay, duration, type, endFrequency]) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        context.currentTime + delay + duration,
      )
    }
    oscillator.connect(gain)
    gain.connect(context.destination)
    const startsAt = context.currentTime + delay
    gain.gain.setValueAtTime(0.0001, startsAt)
    gain.gain.exponentialRampToValueAtTime(0.11, startsAt + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration)
    oscillator.start(startsAt)
    oscillator.stop(startsAt + duration)
    finishAt = Math.max(finishAt, delay + duration)
  })
  window.setTimeout(() => context.close(), (finishAt + 0.15) * 1000)
}
