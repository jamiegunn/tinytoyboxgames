import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let targetColor, choices, score, streak
let feedback, feedbackTimer

const PALETTE = [
  { name: "Red",    hex: "#ff6b6b" },
  { name: "Blue",   hex: "#54a0ff" },
  { name: "Green",  hex: "#26de81" },
  { name: "Yellow", hex: "#feca57" },
  { name: "Purple", hex: "#a55eea" },
  { name: "Orange", hex: "#ff9f43" },
  { name: "Pink",   hex: "#ff9ff3" }
]

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    score = 0
    streak = 0
    feedback = null
    feedbackTimer = 0

    newRound()

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight

    if (feedbackTimer > 0) {
      feedbackTimer -= dt
      if (feedbackTimer <= 0) feedback = null
    }

    // recalc button positions on resize
    layoutChoices()
  },

  render() {
    // soft warm background
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, "#2c2042")
    bg.addColorStop(1, "#3d2960")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // target prompt
    ctx.fillStyle = "#fff"
    ctx.font = "bold 28px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("Tap the color:", w / 2, 60)

    ctx.font = "bold 44px sans-serif"
    ctx.fillStyle = targetColor.hex
    ctx.fillText(targetColor.name, w / 2, 115)

    // choice buttons
    choices.forEach(c => {
      roundRect(ctx, c.bx, c.by, c.bw, c.bh, 20)
      ctx.fillStyle = c.hex
      ctx.fill()
    })

    // score
    ctx.fillStyle = "#fff"
    ctx.font = "bold 32px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(score, w / 2, h - 40)

    // streak
    if (streak >= 3) {
      ctx.font = "22px sans-serif"
      ctx.fillStyle = "#feca57"
      ctx.fillText(streak + " in a row!", w / 2, h - 70)
    }

    // feedback
    if (feedback) {
      ctx.font = "bold 36px sans-serif"
      ctx.fillStyle = feedback === "yes" ? "#26de81" : "#ff6b6b"
      ctx.textAlign = "center"
      ctx.globalAlpha = Math.min(1, feedbackTimer * 3)
      ctx.fillText(feedback === "yes" ? "Yes!" : "Try again!", w / 2, h / 2)
      ctx.globalAlpha = 1
    }
  }
}

function newRound() {
  // pick target
  const shuffled = [...PALETTE].sort(() => Math.random() - 0.5)
  targetColor = shuffled[0]

  // pick 3-4 choices including the target
  const count = Math.min(4, PALETTE.length)
  choices = shuffled.slice(0, count)

  // ensure target is in choices
  if (!choices.find(c => c.hex === targetColor.hex)) {
    choices[Math.floor(Math.random() * count)] = targetColor
  }

  // shuffle choices
  choices = choices.sort(() => Math.random() - 0.5).map(c => ({
    ...c,
    bx: 0, by: 0, bw: 0, bh: 0
  }))

  layoutChoices()
}

function layoutChoices() {
  const cols = 2
  const rows = Math.ceil(choices.length / cols)
  const pad = 20
  const btnW = Math.min(200, (w - pad * 3) / cols)
  const btnH = Math.min(160, (h - 260) / rows - pad)
  const totalW = cols * btnW + (cols - 1) * pad
  const startX = (w - totalW) / 2
  const startY = 160

  choices.forEach((c, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    c.bx = startX + col * (btnW + pad)
    c.by = startY + row * (btnH + pad)
    c.bw = btnW
    c.bh = btnH
  })
}

function handleTap(x, y) {
  if (feedbackTimer > 0) return

  for (const c of choices) {
    if (x >= c.bx && x <= c.bx + c.bw && y >= c.by && y <= c.by + c.bh) {
      if (c.hex === targetColor.hex) {
        score++
        streak++
        feedback = "yes"
        feedbackTimer = 0.6
        celebrate()
        if (streak >= 5 && streak % 5 === 0) celebrateBig()
        setTimeout(newRound, 400)
      } else {
        streak = 0
        feedback = "no"
        feedbackTimer = 0.8
      }
      return
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
