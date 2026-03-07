// Shared sound utility — single source of truth for AudioContext and tone generation

let audioCtx = null

export function getCtx() {
  if (!audioCtx) {
    audioCtx = window._sharedAudioCtx ||
      (window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)())
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

export function playTone({ type = 'sine', freq, freqEnd, ramp = 'exp', duration = 0.12, gain = 0.3, delay = 0 }) {
  const ctx = getCtx()
  const now = ctx.currentTime + delay

  const osc = ctx.createOscillator()
  const g = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (freqEnd) {
    if (ramp === 'linear') osc.frequency.linearRampToValueAtTime(freqEnd, now + duration)
    else osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration)
  }

  g.gain.setValueAtTime(gain, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + duration)

  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.01)
  osc.onended = () => { g.disconnect(); osc.disconnect() }
}

export function playChord(tones) {
  tones.forEach(t => playTone(t))
}
