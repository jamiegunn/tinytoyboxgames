// Simple background music for games using Web Audio oscillators
// Each game gets a short looping melody

const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, B = 11

const GAME_MELODIES = {
  bubblePop: {
    bpm: 120, key: 0,
    notes: [[E,1],[G,1],[A,1],[G,1],[E,1],[D,1],[C,2],[D,1],[E,1],[G,1],[E,1],[D,1],[C,1],[D,2],[-1,1]],
    bass:  [[C-12,4],[F-12,4],[G-12,4],[C-12,4]],
  },
  feedAnimal: {
    bpm: 110, key: 0,
    notes: [[C,1],[E,1],[G,1],[E,1],[C,1],[D,1],[F,1],[D,1],[E,1],[G,1],[A,1],[G,1],[E,1],[C,2],[-1,1]],
    bass:  [[C-12,4],[F-12,4],[G-12,4],[C-12,4]],
  },
  colorMatch: {
    bpm: 130, key: 2,
    notes: [[D,1],[F+1,1],[A,1],[F+1,1],[D,1],[E,1],[G,1],[E,1],[F+1,1],[A,1],[B,1],[A,1],[F+1,1],[D,2],[-1,1]],
    bass:  [[D-12,4],[G-12,4],[A-12,4],[D-12,4]],
  },
  fireflies: {
    bpm: 80, key: 0,
    notes: [[E,2],[G,1],[A,2],[G,1],[E,2],[D,1],[C,3],[D,2],[E,1],[G,2],[A,1],[G,3],[-1,2]],
    bass:  [[C-12,6],[A-12-12,6],[F-12,6],[G-12,6]],
  },
  balloonRace: {
    bpm: 140, key: 5,
    notes: [[F,1],[A,1],[C+12,1],[A,1],[F,1],[G,1],[B,1],[G,1],[A,1],[C+12,1],[D+12,1],[C+12,1],[A,1],[F,2],[-1,1]],
    bass:  [[F-12,4],[B-12,4],[C,4],[F-12,4]],
  },
  babyShark: {
    bpm: 130, key: 0,
    notes: [[C,1],[D,1],[E,1],[E,1],[E,1],[E,1],[D,1],[C,1],[D,1],[E,1],[D,1],[C,2],[-1,1]],
    bass:  [[C-12,4],[G-12,4],[A-12,4],[G-12,4]],
  },
  puppyFetch: {
    bpm: 135, key: 7,
    notes: [[G,1],[B,1],[D+12,1],[B,1],[G,1],[A,1],[C+12,1],[A,1],[B,1],[D+12,1],[E+12,1],[D+12,1],[B,1],[G,2],[-1,1]],
    bass:  [[G-12,4],[C,4],[D,4],[G-12,4]],
  },
  shapeBuilder: {
    bpm: 100, key: 0,
    notes: [[C,1],[E,1],[G,1],[C+12,1],[G,1],[E,1],[D,1],[F,1],[A,1],[F,1],[D,1],[C,2],[-1,2]],
    bass:  [[C-12,4],[F-12,4],[G-12,4],[C-12,4]],
  },
  cleanTheMess: {
    bpm: 115, key: 5,
    notes: [[F,1],[A,1],[C+12,1],[A,1],[G,1],[B,1],[G,1],[F,1],[A,1],[G,1],[F,1],[E,1],[F,2],[-1,1]],
    bass:  [[F-12,4],[C,4],[D-12,4],[C,4]],
  },
  hideAndSeek: {
    bpm: 90, key: 0,
    notes: [[E,2],[D,1],[C,2],[D,1],[E,2],[G,1],[A,2],[G,1],[E,2],[D,1],[C,3],[-1,2]],
    bass:  [[C-12,6],[A-12-12,6],[F-12,6],[G-12,6]],
  },
  monsterTruck: {
    bpm: 150, key: 0,
    notes: [[C,1],[C,1],[E,1],[G,1],[G,1],[E,1],[C,1],[D,1],[D,1],[F,1],[A,1],[G,1],[E,1],[C,2],[-1,1]],
    bass:  [[C-12,2],[C-12,2],[F-12,2],[F-12,2],[G-12,2],[G-12,2],[C-12,2],[C-12,2]],
  },
  elephantSplash: {
    bpm: 105, key: 0,
    notes: [[C,1],[E,1],[G,1],[A,1],[G,1],[E,1],[D,1],[F,1],[A,1],[G,1],[E,1],[C,2],[-1,2]],
    bass:  [[C-12,4],[F-12,4],[G-12,4],[C-12,4]],
  },
}

import { getCtx } from './sound.js'

let audioCtx = null
let masterGain = null
let playing = false
let loopTimer = null
let currentMelody = null

function initAudio() {
  if (audioCtx) return
  audioCtx = getCtx()
  masterGain = audioCtx.createGain()
  masterGain.gain.value = 0
  masterGain.connect(audioCtx.destination)
}

function noteFreq(semitone) {
  return 261.63 * Math.pow(2, semitone / 12)
}

function playNote(semitone, time, duration, volume, beatDur) {
  if (!audioCtx || semitone < -24) return
  const freq = noteFreq(semitone)
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const vol = volume || 0.12
  const attack = 0.01
  const decay = Math.min(duration * beatDur * 0.7, 0.8)
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(vol, time + attack)
  gain.gain.exponentialRampToValueAtTime(Math.max(vol * 0.1, 0.001), time + attack + decay)
  gain.gain.linearRampToValueAtTime(0.001, time + duration * beatDur)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start(time)
  osc.stop(time + duration * beatDur + 0.1)
  osc.onended = () => { gain.disconnect(); osc.disconnect() }
}

function scheduleLoop() {
  if (!playing || !audioCtx || !currentMelody) return
  const m = currentMelody
  const beatDur = 60 / m.bpm
  const now = audioCtx.currentTime + 0.05

  let t = 0
  m.notes.forEach(([note, dur]) => {
    if (note >= -12) playNote(note + (m.key || 0), now + t, dur, 0.12, beatDur)
    t += dur * beatDur
  })

  let bt = 0
  if (m.bass) {
    m.bass.forEach(([note, dur]) => {
      if (bt < t) playNote(note + (m.key || 0), now + bt, dur, 0.05, beatDur)
      bt += dur * beatDur
    })
  }

  loopTimer = setTimeout(scheduleLoop, (t - 0.3) * 1000)
}

export function startGameMusic(gameId) {
  stopGameMusic()
  currentMelody = GAME_MELODIES[gameId]
  if (!currentMelody) return
  initAudio()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  playing = true
  masterGain.gain.cancelScheduledValues(audioCtx.currentTime)
  masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime)
  masterGain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 1.5)
  scheduleLoop()
}

export function stopGameMusic() {
  if (!playing || !audioCtx) { playing = false; return }
  playing = false
  masterGain.gain.cancelScheduledValues(audioCtx.currentTime)
  masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime)
  masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5)
  clearTimeout(loopTimer)
  currentMelody = null
}
