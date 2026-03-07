import { getCtx } from '../engine/sound.js'

// Music-box lullaby (Web Audio API)
;(function() {
  let audioCtx = null
  let masterGain = null
  let playing = false
  let loopTimer = null
  let noteTimers = []
  let started = false
  let fadingOut = false

  // Twinkle Twinkle + gentle original bridge, in a music-box pentatonic style
  // Notes as [semitone offset from C4, duration in beats]
  const C=0, D=2, E=4, F=5, G=7, A=9, B=11
  const melody = [
    // Twinkle twinkle little star
    [C,1],[C,1],[G,1],[G,1],[A,1],[A,1],[G,2],
    [F,1],[F,1],[E,1],[E,1],[D,1],[D,1],[C,2],
    // How I wonder what you are
    [G,1],[G,1],[F,1],[F,1],[E,1],[E,1],[D,2],
    [G,1],[G,1],[F,1],[F,1],[E,1],[E,1],[D,2],
    // Twinkle twinkle little star
    [C,1],[C,1],[G,1],[G,1],[A,1],[A,1],[G,2],
    [F,1],[F,1],[E,1],[E,1],[D,1],[D,1],[C,2],
    // gentle pause
    [-1,2],
  ]

  // Also play a soft bass note every 4 beats
  const bassPattern = [
    [C-12,4],[F-12,4],[G-12,4],[C-12,4],
    [F-12,4],[G-12,4],[C-12,4],[F-12,4],
  ]

  const BPM = 90
  const beatDur = 60 / BPM

  function initAudio() {
    if (audioCtx) return
    audioCtx = getCtx()
    masterGain = audioCtx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(audioCtx.destination)
  }

  function noteFreq(semitone) {
    // C4 = MIDI 60 = 261.63 Hz
    return 261.63 * Math.pow(2, semitone / 12)
  }

  function playMusicBoxNote(semitone, time, duration, volume) {
    if (!audioCtx || semitone < -24) return

    const freq = noteFreq(semitone)

    // Music box timbre: fundamental + soft octave + quiet 3rd harmonic
    const osc1 = audioCtx.createOscillator()
    const osc2 = audioCtx.createOscillator()
    const osc3 = audioCtx.createOscillator()
    const gain1 = audioCtx.createGain()
    const gain2 = audioCtx.createGain()
    const gain3 = audioCtx.createGain()

    osc1.type = 'sine'
    osc1.frequency.value = freq
    osc2.type = 'sine'
    osc2.frequency.value = freq * 2
    osc3.type = 'sine'
    osc3.frequency.value = freq * 3

    const vol = volume || 0.25
    const attack = 0.005
    const decay = Math.min(duration * beatDur * 0.8, 1.2)
    const sustain = vol * 0.15
    const release = duration * beatDur * 0.5

    // Fundamental envelope (music box: quick attack, medium decay)
    gain1.gain.setValueAtTime(0, time)
    gain1.gain.linearRampToValueAtTime(vol, time + attack)
    gain1.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.001), time + attack + decay)
    gain1.gain.linearRampToValueAtTime(0.001, time + duration * beatDur)

    // Octave (softer, decays faster - gives the "sparkle")
    gain2.gain.setValueAtTime(0, time)
    gain2.gain.linearRampToValueAtTime(vol * 0.3, time + attack)
    gain2.gain.exponentialRampToValueAtTime(0.001, time + attack + decay * 0.5)

    // 3rd harmonic (very soft bell quality)
    gain3.gain.setValueAtTime(0, time)
    gain3.gain.linearRampToValueAtTime(vol * 0.1, time + attack)
    gain3.gain.exponentialRampToValueAtTime(0.001, time + attack + decay * 0.3)

    osc1.connect(gain1); gain1.connect(masterGain)
    osc2.connect(gain2); gain2.connect(masterGain)
    osc3.connect(gain3); gain3.connect(masterGain)

    osc1.start(time)
    osc2.start(time)
    osc3.start(time)

    const stopTime = time + duration * beatDur + 0.1
    osc1.stop(stopTime)
    osc2.stop(stopTime)
    osc3.stop(stopTime)
  }

  function scheduleLoop() {
    if (!playing || !audioCtx) return

    const now = audioCtx.currentTime + 0.05
    let t = 0

    // Schedule melody
    melody.forEach(([note, dur]) => {
      if (note >= -12) {
        playMusicBoxNote(note, now + t, dur, 0.2)
      }
      t += dur * beatDur
    })

    // Schedule bass (very soft, low)
    let bt = 0
    bassPattern.forEach(([note, dur]) => {
      if (bt < t) {
        playMusicBoxNote(note, now + bt, dur, 0.08)
      }
      bt += dur * beatDur
    })

    // Schedule next loop
    const loopDuration = t
    loopTimer = setTimeout(scheduleLoop, (loopDuration - 0.5) * 1000)
  }

  function startMusic() {
    if (playing) return
    initAudio()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    playing = true
    fadingOut = false
    // Fade in
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime)
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime)
    masterGain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 1.5)
    scheduleLoop()
  }

  function stopMusic() {
    if (!playing || !audioCtx) return
    playing = false
    fadingOut = true
    // Fade out
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime)
    masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime)
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8)
    clearTimeout(loopTimer)
  }

  // Expose for music box and game start/stop
  window._toyboxMusic = {
    start() {
      initAudio()
      startMusic()
      const box = document.getElementById('music-box')
      if (box) box.classList.add('open')
    },
    stop() {
      stopMusic()
      const box = document.getElementById('music-box')
      if (box) box.classList.remove('open')
    },
    toggle() {
      initAudio()
      if (playing) {
        stopMusic()
        const box = document.getElementById('music-box')
        if (box) box.classList.remove('open')
      } else {
        startMusic()
        const box = document.getElementById('music-box')
        if (box) box.classList.add('open')
      }
    },
    isPlaying() { return playing }
  }

  // Also unlock audio context on any first interaction (needed for toggle to work)
  function unlockAudio() {
    initAudio()
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()
    document.removeEventListener('click', unlockAudio)
    document.removeEventListener('touchstart', unlockAudio)
  }
  document.addEventListener('click', unlockAudio)
  document.addEventListener('touchstart', unlockAudio)
})()
