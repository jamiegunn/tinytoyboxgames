import { celebrate } from "../engine/celebrate.js"

let ctx, input, w, h
let bubbles = []
let score = 0
let spawnTimer = 0
let tapHandler
let audioCtx

function ensureAudio() {
  if (!audioCtx) audioCtx = window._sharedAudioCtx || (window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)())
  if (audioCtx.state === 'suspended') audioCtx.resume()
}

function playPop() {
  ensureAudio()
  const now = audioCtx.currentTime

  // High sine that drops in pitch quickly — bubbly pop
  const osc = audioCtx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1200 + Math.random() * 400, now)
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.1)

  const gain = audioCtx.createGain()
  gain.gain.setValueAtTime(0.4, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + 0.12)
}

const COLORS = ["#48dbfb", "#ff9ff3", "#feca57", "#54a0ff", "#5f27cd"]
const RADIUS = 45

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = ctx.canvas.width
    h = ctx.canvas.height
    bubbles = []
    score = 0
    spawnTimer = 0

    // Unlock audio on first canvas touch (iOS requires gesture-triggered resume)
    const canvas = ctx.canvas
    const unlock = () => { ensureAudio(); canvas.removeEventListener('touchstart', unlock); canvas.removeEventListener('mousedown', unlock) }
    canvas.addEventListener('touchstart', unlock)
    canvas.addEventListener('mousedown', unlock)

    for (let i = 0; i < 5; i++) spawn()

    tapHandler = popBubble
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    bubbles = []
  },

  update(dt) {
    w = ctx.canvas.width
    h = ctx.canvas.height

    bubbles.forEach(b => {
      b.y -= b.speed * dt
      b.wobble += dt * 2
      b.x += Math.sin(b.wobble) * 0.5
    })

    bubbles = bubbles.filter(b => b.y + RADIUS > 0)

    spawnTimer += dt
    if (spawnTimer > 0.8) {
      spawnTimer = 0
      spawn()
    }
  },

  render() {
    // soft gradient sky
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, "#1b2a4a")
    bg.addColorStop(1, "#2d4a7a")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    bubbles.forEach(b => {
      ctx.beginPath()
      ctx.arc(b.x, b.y, RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = b.color
      ctx.globalAlpha = 0.8
      ctx.fill()
      ctx.globalAlpha = 1

      // shine highlight
      ctx.beginPath()
      ctx.arc(b.x - 12, b.y - 12, 10, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,0.4)"
      ctx.fill()
    })

    // score
    ctx.fillStyle = "#fff"
    ctx.font = "bold 32px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(score, w / 2, 50)
  }
}

function spawn() {
  bubbles.push({
    x: RADIUS + Math.random() * (ctx.canvas.width - RADIUS * 2),
    y: ctx.canvas.height + RADIUS,
    speed: 40 + Math.random() * 60,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    wobble: Math.random() * Math.PI * 2
  })
}

function popBubble(x, y) {
  let popped = false

  bubbles = bubbles.filter(b => {
    const dx = b.x - x
    const dy = b.y - y
    const hit = Math.sqrt(dx * dx + dy * dy) < RADIUS

    if (hit) {
      popped = true
      score++
      spawn()
    }
    return !hit
  })

  if (popped) {
    playPop()
    celebrate()
  }
}
