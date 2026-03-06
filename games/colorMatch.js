import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let targetColor, choices, score, combo, comboTimer
let feedback, feedbackTimer
let time = 0
let scorePopups = []
let particles = []
let bgShapes = []
let shakeX = 0, shakeY = 0, shakeAmount = 0
let roundNum = 0
let correctScale = 0
let wrongShakeIdx = -1, wrongShakeTime = 0
let audioCtx

const COMBO_WINDOW = 3.0

const PALETTE = [
  { name: "Red",    hex: "#ff6b6b", dark: "#d63031", light: "#ffaaaa" },
  { name: "Blue",   hex: "#54a0ff", dark: "#2e86de", light: "#a0cfff" },
  { name: "Green",  hex: "#26de81", dark: "#20bf6b", light: "#7af5b0" },
  { name: "Yellow", hex: "#feca57", dark: "#f0b723", light: "#fff3a0" },
  { name: "Purple", hex: "#a55eea", dark: "#8854d0", light: "#cfa8ff" },
  { name: "Orange", hex: "#ff9f43", dark: "#e67e22", light: "#ffc994" },
  { name: "Pink",   hex: "#ff9ff3", dark: "#f368e0", light: "#ffd1f9" },
  { name: "Teal",   hex: "#48dbfb", dark: "#0abde3", light: "#a0edff" }
]

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = ctx.canvas.width
    h = ctx.canvas.height
    score = 0
    combo = 0
    comboTimer = 0
    feedback = null
    feedbackTimer = 0
    time = 0
    roundNum = 0
    scorePopups = []
    particles = []
    correctScale = 0
    wrongShakeIdx = -1
    wrongShakeTime = 0

    // floating background shapes
    bgShapes = []
    for (let i = 0; i < 18; i++) {
      bgShapes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 15 + Math.random() * 40,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.5,
        driftX: (Math.random() - 0.5) * 12,
        driftY: (Math.random() - 0.5) * 8,
        type: Math.floor(Math.random() * 5), // circle, square, triangle, star, heart
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)].hex,
        alpha: 0.06 + Math.random() * 0.06
      })
    }

    newRound()

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
  },

  update(dt) {
    w = ctx.canvas.width
    h = ctx.canvas.height
    time += dt

    if (feedbackTimer > 0) {
      feedbackTimer -= dt
      if (feedbackTimer <= 0) feedback = null
    }

    // combo timer
    if (comboTimer > 0) {
      comboTimer -= dt
      if (comboTimer <= 0) { combo = 0; comboTimer = 0 }
    }

    // correct answer scale pulse
    if (correctScale > 0) correctScale -= dt * 4

    // wrong answer shake
    if (wrongShakeTime > 0) wrongShakeTime -= dt * 5

    // screen shake decay
    shakeAmount *= Math.pow(0.001, dt)
    if (shakeAmount < 0.3) shakeAmount = 0
    shakeX = (Math.random() - 0.5) * shakeAmount * 2
    shakeY = (Math.random() - 0.5) * shakeAmount * 2

    // score popups
    scorePopups = scorePopups.filter(p => {
      p.y -= 50 * dt
      p.life -= dt
      return p.life > 0
    })

    // particles
    particles = particles.filter(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 120 * dt
      p.life -= dt
      p.rot += p.rotSpeed * dt
      return p.life > 0
    })

    // bg shapes drift
    bgShapes.forEach(s => {
      s.x += s.driftX * dt
      s.y += s.driftY * dt
      s.rot += s.rotSpeed * dt
      if (s.x < -50) s.x = w + 50
      if (s.x > w + 50) s.x = -50
      if (s.y < -50) s.y = h + 50
      if (s.y > h + 50) s.y = -50
    })

    layoutChoices()
  },

  render() {
    ctx.save()
    ctx.translate(shakeX, shakeY)

    // rich gradient background
    const bg = ctx.createLinearGradient(0, 0, w * 0.3, h)
    bg.addColorStop(0, "#fff8f0")
    bg.addColorStop(0.5, "#fff0e6")
    bg.addColorStop(1, "#f0e6ff")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // subtle dot pattern
    ctx.fillStyle = "rgba(0,0,0,0.018)"
    for (let dx = 0; dx < w; dx += 24) {
      for (let dy = 0; dy < h; dy += 24) {
        ctx.beginPath()
        ctx.arc(dx, dy, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // floating bg shapes
    bgShapes.forEach(s => {
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rot)
      ctx.globalAlpha = s.alpha
      ctx.fillStyle = s.color
      drawBgShape(ctx, s.type, s.size)
      ctx.fill()
      ctx.restore()
    })
    ctx.globalAlpha = 1

    // top area: prompt
    const promptY = 50
    ctx.fillStyle = "#555"
    ctx.font = "600 22px 'Fredoka', 'Nunito', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("Tap the color:", w / 2, promptY)

    // target color name with colored shadow
    const nameY = promptY + 55
    ctx.font = "bold 48px 'Fredoka', 'Nunito', sans-serif"
    // text shadow
    ctx.fillStyle = targetColor.dark
    ctx.globalAlpha = 0.2
    ctx.fillText(targetColor.name, w / 2 + 2, nameY + 3)
    ctx.globalAlpha = 1
    ctx.fillStyle = targetColor.hex
    ctx.fillText(targetColor.name, w / 2, nameY)

    // bouncing color swatch under the name
    const swatchY = nameY + 18
    const swatchBounce = Math.sin(time * 3) * 3
    ctx.beginPath()
    ctx.roundRect(w / 2 - 30, swatchY + swatchBounce, 60, 8, 4)
    ctx.fillStyle = targetColor.hex
    ctx.fill()

    // choice buttons
    choices.forEach((c, i) => {
      ctx.save()

      // wrong shake
      let ox = 0
      if (wrongShakeIdx === i && wrongShakeTime > 0) {
        ox = Math.sin(wrongShakeTime * 30) * 6 * wrongShakeTime
      }

      // correct scale pulse
      let sc = 1
      if (c.hex === targetColor.hex && correctScale > 0) {
        sc = 1 + correctScale * 0.08
      }

      const cx = c.bx + c.bw / 2 + ox
      const cy = c.by + c.bh / 2
      ctx.translate(cx, cy)
      ctx.scale(sc, sc)

      // button shadow
      ctx.beginPath()
      roundRect(ctx, -c.bw / 2 + 3, -c.bh / 2 + 5, c.bw, c.bh, 22)
      ctx.fillStyle = "rgba(0,0,0,0.1)"
      ctx.fill()

      // button body gradient
      ctx.beginPath()
      roundRect(ctx, -c.bw / 2, -c.bh / 2, c.bw, c.bh, 22)
      const btnGrad = ctx.createLinearGradient(0, -c.bh / 2, 0, c.bh / 2)
      btnGrad.addColorStop(0, c.light || lighten(c.hex, 30))
      btnGrad.addColorStop(0.4, c.hex)
      btnGrad.addColorStop(1, c.dark || darken(c.hex, 20))
      ctx.fillStyle = btnGrad
      ctx.fill()

      // inner highlight
      ctx.beginPath()
      roundRect(ctx, -c.bw / 2 + 6, -c.bh / 2 + 4, c.bw - 12, c.bh * 0.4, 16)
      ctx.fillStyle = "rgba(255,255,255,0.25)"
      ctx.fill()

      // border
      ctx.beginPath()
      roundRect(ctx, -c.bw / 2, -c.bh / 2, c.bw, c.bh, 22)
      ctx.strokeStyle = "rgba(255,255,255,0.35)"
      ctx.lineWidth = 2.5
      ctx.stroke()

      // color name on button
      ctx.fillStyle = "rgba(255,255,255,0.95)"
      ctx.font = "bold 20px 'Fredoka', 'Nunito', sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      // text shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)"
      ctx.fillText(c.name, 1, 2)
      ctx.fillStyle = "#fff"
      ctx.fillText(c.name, 0, 0)
      ctx.textBaseline = "alphabetic"

      ctx.restore()
    })

    // combo display
    if (combo >= 2 && comboTimer > 0) {
      const comboY = h - 130
      const pulse = 1 + Math.sin(time * 8) * 0.05

      ctx.save()
      ctx.translate(w / 2, comboY)
      ctx.scale(pulse, pulse)

      // combo bar bg
      ctx.beginPath()
      ctx.roundRect(-80, -14, 160, 28, 14)
      ctx.fillStyle = "rgba(255,200,0,0.15)"
      ctx.fill()

      // combo bar fill
      const comboFrac = comboTimer / COMBO_WINDOW
      ctx.beginPath()
      ctx.roundRect(-78, -12, 156 * comboFrac, 24, 12)
      ctx.fillStyle = combo >= 5 ? "rgba(255,100,50,0.6)" : "rgba(255,200,0,0.4)"
      ctx.fill()

      // combo text
      ctx.font = "bold 20px 'Fredoka', 'Nunito', sans-serif"
      ctx.textAlign = "center"
      ctx.fillStyle = combo >= 5 ? "#ff4500" : "#ff8c00"
      ctx.fillText(`MATCH x${combo}!`, 0, 7)

      ctx.restore()
    }

    // score
    const scoreY = h - 40
    ctx.fillStyle = "#888"
    ctx.font = "bold 36px 'Fredoka', 'Nunito', sans-serif"
    ctx.textAlign = "center"
    const scorePulse = correctScale > 0 ? 1 + correctScale * 0.1 : 1
    ctx.save()
    ctx.translate(w / 2, scoreY)
    ctx.scale(scorePulse, scorePulse)
    ctx.fillStyle = "#555"
    ctx.fillText(score, 0, 0)
    ctx.restore()

    // streak stars
    if (combo >= 3) {
      const starCount = Math.min(combo, 8)
      for (let i = 0; i < starCount; i++) {
        const sx = w / 2 - (starCount - 1) * 12 + i * 24
        const sy = scoreY + 22
        const sp = 1 + Math.sin(time * 5 + i) * 0.15
        ctx.save()
        ctx.translate(sx, sy)
        ctx.scale(sp, sp)
        drawStar(ctx, 0, 0, 5, 7, 3.5)
        ctx.fillStyle = "#feca57"
        ctx.fill()
        ctx.restore()
      }
    }

    // score popups
    scorePopups.forEach(p => {
      const alpha = Math.min(1, p.life * 2.5)
      const scale = 0.5 + alpha * 0.5
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.scale(scale, scale)
      ctx.globalAlpha = alpha
      ctx.font = `bold ${p.size}px 'Fredoka', 'Nunito', sans-serif`
      ctx.textAlign = "center"
      ctx.fillStyle = p.color
      ctx.fillText(p.text, 0, 0)
      ctx.restore()
    })
    ctx.globalAlpha = 1

    // particles
    particles.forEach(p => {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = Math.min(1, p.life * 2)
      ctx.fillStyle = p.color

      if (p.type === "star") {
        drawStar(ctx, 0, 0, 5, p.size, p.size * 0.5)
        ctx.fill()
      } else if (p.type === "circle") {
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      }

      ctx.restore()
    })
    ctx.globalAlpha = 1

    // feedback overlay
    if (feedback) {
      const alpha = Math.min(1, feedbackTimer * 3)
      ctx.save()
      ctx.globalAlpha = alpha

      if (feedback === "yes") {
        // checkmark
        const fy = h * 0.42
        const checkScale = 1.2 - Math.max(0, feedbackTimer - 0.3) * 0.8
        ctx.save()
        ctx.translate(w / 2, fy)
        ctx.scale(checkScale, checkScale)

        // green circle bg
        ctx.beginPath()
        ctx.arc(0, 0, 40, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(38,222,129,0.2)"
        ctx.fill()

        ctx.strokeStyle = "#26de81"
        ctx.lineWidth = 6
        ctx.lineCap = "round"
        ctx.beginPath()
        ctx.moveTo(-15, 2)
        ctx.lineTo(-4, 14)
        ctx.lineTo(18, -10)
        ctx.stroke()

        ctx.restore()
      } else {
        // X mark
        const fy = h * 0.42
        const xScale = 1.2 - Math.max(0, feedbackTimer - 0.4) * 0.5
        ctx.save()
        ctx.translate(w / 2, fy)
        ctx.scale(xScale, xScale)

        ctx.beginPath()
        ctx.arc(0, 0, 40, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(255,107,107,0.2)"
        ctx.fill()

        ctx.strokeStyle = "#ff6b6b"
        ctx.lineWidth = 6
        ctx.lineCap = "round"
        ctx.beginPath()
        ctx.moveTo(-14, -14)
        ctx.lineTo(14, 14)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(14, -14)
        ctx.lineTo(-14, 14)
        ctx.stroke()

        ctx.restore()
      }

      ctx.restore()
    }

    ctx.restore() // shake
  }
}

function newRound() {
  roundNum++

  // pick target
  const shuffled = [...PALETTE].sort(() => Math.random() - 0.5)
  targetColor = shuffled[0]

  // difficulty: more choices as score grows
  const count = Math.min(6, 3 + Math.floor(roundNum / 6))
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
  const count = choices.length
  const cols = count <= 3 ? count : count <= 4 ? 2 : 3
  const rows = Math.ceil(count / cols)
  const pad = 16
  const maxBtnW = 170
  const btnW = Math.min(maxBtnW, (w - pad * (cols + 1)) / cols)
  const btnH = Math.min(130, (h - 300) / rows - pad)
  const totalW = cols * btnW + (cols - 1) * pad
  const totalH = rows * btnH + (rows - 1) * pad
  const startX = (w - totalW) / 2
  const startY = 160 + (h - 340 - totalH) / 2

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
  if (feedbackTimer > 0.1) return

  for (let i = 0; i < choices.length; i++) {
    const c = choices[i]
    if (x >= c.bx && x <= c.bx + c.bw && y >= c.by && y <= c.by + c.bh) {
      if (c.hex === targetColor.hex) {
        // correct!
        combo++
        comboTimer = COMBO_WINDOW
        const pts = combo >= 5 ? 3 : combo >= 3 ? 2 : 1
        score += pts
        correctScale = 1
        feedback = "yes"
        feedbackTimer = 0.5

        // screen shake
        shakeAmount = combo >= 3 ? 6 : 3

        // score popup
        const popText = pts > 1 ? `+${pts}` : "+1"
        scorePopups.push({
          x: c.bx + c.bw / 2,
          y: c.by + c.bh / 2,
          text: popText,
          color: c.hex,
          size: pts > 1 ? 36 : 28,
          life: 1.0
        })

        // burst particles
        const burstCount = combo >= 3 ? 18 : 10
        for (let j = 0; j < burstCount; j++) {
          const angle = (j / burstCount) * Math.PI * 2
          const speed = 80 + Math.random() * 120
          particles.push({
            x: c.bx + c.bw / 2,
            y: c.by + c.bh / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 40,
            size: 3 + Math.random() * 5,
            color: [c.hex, c.light, "#fff", "#feca57"][Math.floor(Math.random() * 4)],
            type: Math.random() > 0.5 ? "star" : "circle",
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 8,
            life: 0.6 + Math.random() * 0.5
          })
        }

        // sparkle stars around button
        for (let j = 0; j < 6; j++) {
          const sx = c.bx + Math.random() * c.bw
          const sy = c.by + Math.random() * c.bh
          particles.push({
            x: sx, y: sy,
            vx: (Math.random() - 0.5) * 60,
            vy: -40 - Math.random() * 60,
            size: 4 + Math.random() * 4,
            color: "#fff",
            type: "star",
            rot: 0,
            rotSpeed: 3,
            life: 0.8
          })
        }

        playCorrect()
        celebrate()
        if (combo >= 5 && combo % 5 === 0) celebrateBig()
        setTimeout(newRound, 350)
      } else {
        // wrong
        playWrong()
        combo = 0
        comboTimer = 0
        feedback = "no"
        feedbackTimer = 0.7
        wrongShakeIdx = i
        wrongShakeTime = 1
        shakeAmount = 2
      }
      return
    }
  }
}

function playCorrect() {
  if (!audioCtx) audioCtx = window._sharedAudioCtx || (window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)())
  if (audioCtx.state === 'suspended') audioCtx.resume()
  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(500, now)
  osc.frequency.linearRampToValueAtTime(1200, now + 0.1)
  gain.gain.setValueAtTime(0.3, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + 0.15)
}

function playWrong() {
  if (!audioCtx) audioCtx = window._sharedAudioCtx || (window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)())
  if (audioCtx.state === 'suspended') audioCtx.resume()
  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(150, now)
  gain.gain.setValueAtTime(0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + 0.2)
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

function drawStar(ctx, cx, cy, points, outer, inner) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i * Math.PI) / points - Math.PI / 2
    const method = i === 0 ? "moveTo" : "lineTo"
    ctx[method](cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  ctx.closePath()
}

function drawBgShape(ctx, type, size) {
  const s = size / 2
  if (type === 0) {
    ctx.beginPath()
    ctx.arc(0, 0, s, 0, Math.PI * 2)
  } else if (type === 1) {
    ctx.beginPath()
    ctx.rect(-s, -s, size, size)
  } else if (type === 2) {
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.lineTo(s, s)
    ctx.lineTo(-s, s)
    ctx.closePath()
  } else if (type === 3) {
    drawStar(ctx, 0, 0, 5, s, s * 0.4)
  } else {
    // heart
    ctx.beginPath()
    ctx.moveTo(0, s * 0.4)
    ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s, 0, -s * 0.4)
    ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.3, 0, s * 0.4)
    ctx.closePath()
  }
}

function lighten(hex, amt) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt)
  return `rgb(${r},${g},${b})`
}

function darken(hex, amt) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt)
  return `rgb(${r},${g},${b})`
}
