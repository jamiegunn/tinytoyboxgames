import { celebrate, celebrateBig } from "../engine/celebrate.js"

let audioCtx
let ctx, input, w, h
let dragHandler, tapHandler
let shapes, score, time, allClean
let sparkles, particles, scorePopups, bubbles
let screenShake, brushTrail
let bgPattern, cleanProgress
let mudCanvas, mudCtx

function playSqueak() {
  if (!audioCtx) audioCtx = window._sharedAudioCtx || (window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)())
  if (audioCtx.state === 'suspended') audioCtx.resume()
  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(600, now)
  osc.frequency.linearRampToValueAtTime(900, now + 0.05)
  osc.frequency.linearRampToValueAtTime(600, now + 0.1)
  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + 0.12)
}

const BRUSH_RADIUS = 55

const SHAPE_TYPES = [
  { name: "sun", draw: drawSun, color: "#feca57" },
  { name: "star", draw: drawStar, color: "#feca57" },
  { name: "fish", draw: drawFish, color: "#54a0ff" },
  { name: "flower", draw: drawFlower, color: "#ff6b6b" },
  { name: "heart", draw: drawHeart, color: "#ff6b6b" },
  { name: "moon", draw: drawMoon, color: "#f0e6b8" },
  { name: "cloud", draw: drawCloud, color: "#b8dce6" },
  { name: "tree", draw: drawTree, color: "#26de81" },
  { name: "butterfly", draw: drawButterfly, color: "#ff9ff3" },
  { name: "rainbow", draw: drawRainbow, color: "#ff6b6b" },
  { name: "mushroom", draw: drawMushroom, color: "#e74c3c" },
  { name: "snail", draw: drawSnail, color: "#a55eea" },
]

const MUD_COLORS = [
  "#6B4F3A", "#7A5C42", "#8B6914", "#5E432E", "#9E8A68",
  "#4A3728", "#6e5d40", "#887550", "#7A6B50", "#5A4A30"
]

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = ctx.canvas.width
    h = ctx.canvas.height
    score = 0
    time = 0
    allClean = false
    screenShake = 0
    cleanProgress = 0
    sparkles = []
    particles = []
    scorePopups = []
    bubbles = []
    brushTrail = []

    // bg pattern tiles
    bgPattern = []
    for (let px = 20; px < w; px += 40) {
      for (let py = 20; py < h; py += 40) {
        bgPattern.push({
          x: px + (Math.random() - 0.5) * 10,
          y: py + (Math.random() - 0.5) * 10,
          size: 3 + Math.random() * 4,
          shape: Math.floor(Math.random() * 4),
          rot: Math.random() * Math.PI * 2,
          alpha: 0.02 + Math.random() * 0.02
        })
      }
    }

    setupRound()

    dragHandler = handleDrag
    tapHandler = handleTap
    input.onDragMove(dragHandler)
    input.onTap(tapHandler)
  },

  destroy() {
    input.offDragMove(dragHandler)
    input.offTap(tapHandler)
    shapes = []; sparkles = []; particles = []; scorePopups = []; bubbles = []
    mudCanvas = null; mudCtx = null
  },

  update(dt) {
    w = ctx.canvas.width
    h = ctx.canvas.height
    time += dt

    if (screenShake > 0) screenShake *= Math.pow(0.04, dt)
    if (screenShake < 0.3) screenShake = 0

    sparkles.forEach(s => {
      s.life -= dt * 2
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 40 * dt
      s.rot += (s.rotSpeed || 0) * dt
    })
    sparkles = sparkles.filter(s => s.life > 0)

    particles.forEach(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += (p.gravity || 80) * dt
      p.rot += (p.rotSpeed || 0) * dt
      p.life -= dt * (p.decay || 1.5)
    })
    particles = particles.filter(p => p.life > 0)

    scorePopups.forEach(p => { p.y -= 50 * dt; p.life -= dt })
    scorePopups = scorePopups.filter(p => p.life > 0)

    bubbles.forEach(b => {
      b.y -= b.speed * dt
      b.x += Math.sin(b.wobble + time * 2) * 0.5
      b.wobble += dt
      b.life -= dt * 0.5
    })
    bubbles = bubbles.filter(b => b.life > 0 && b.y > -20)

    brushTrail.forEach(t => { t.life -= dt * 3 })
    brushTrail = brushTrail.filter(t => t.life > 0)

    shapes.forEach(s => {
      s.revealScale = s.revealScale || 1
      if (s.revealed && s.revealScale < 1.15) {
        s.revealScale = Math.min(1.15, s.revealScale + dt * 2)
      } else if (s.revealed && s.revealScale > 1) {
        s.revealScale = Math.max(1, s.revealScale - dt * 0.5)
      }
      s.shimmer = (s.shimmer || 0) + dt * 3
    })

    const found = shapes.filter(s => s.revealed).length
    cleanProgress = found / shapes.length
  },

  render() {
    ctx.save()
    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake)
    }

    // background
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, "#e8f0ff")
    bg.addColorStop(0.5, "#dce8f5")
    bg.addColorStop(1, "#e5f0f8")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // subtle background pattern
    bgPattern.forEach(p => {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = "#a0b0c0"
      if (p.shape === 0) {
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.shape === 1) {
        ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2)
      } else if (p.shape === 2) {
        ctx.beginPath()
        ctx.moveTo(0, -p.size)
        ctx.lineTo(p.size, p.size)
        ctx.lineTo(-p.size, p.size)
        ctx.fill()
      } else {
        drawMiniStar(ctx, 0, 0, p.size)
      }
      ctx.globalAlpha = 1
      ctx.restore()
    })

    // progress bar
    const barW = w * 0.6
    const barH = 8
    const barX = (w - barW) / 2
    const barY = h - 22
    ctx.fillStyle = "rgba(0,0,0,0.08)"
    ctx.beginPath()
    ctx.roundRect(barX, barY, barW, barH, 4)
    ctx.fill()
    const progColor = cleanProgress >= 1 ? "#26de81" : "#54a0ff"
    ctx.fillStyle = progColor
    ctx.beginPath()
    ctx.roundRect(barX, barY, barW * cleanProgress, barH, 4)
    ctx.fill()
    if (cleanProgress > 0 && cleanProgress < 1) {
      const sparkX = barX + barW * cleanProgress
      ctx.beginPath()
      ctx.arc(sparkX, barY + barH / 2, 4, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.globalAlpha = 0.5 + Math.sin(time * 6) * 0.3
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // brush trail
    brushTrail.forEach(t => {
      ctx.globalAlpha = t.life * 0.15
      ctx.beginPath()
      ctx.arc(t.x, t.y, BRUSH_RADIUS * 0.8, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(200,230,255,0.3)"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // draw each shape
    shapes.forEach(s => {
      ctx.save()

      if (s.revealed) {
        ctx.translate(s.x, s.y)
        ctx.scale(s.revealScale, s.revealScale)
        ctx.translate(-s.x, -s.y)
      }

      if (s.revealed) {
        const glow = ctx.createRadialGradient(s.x, s.y, s.size * 0.3, s.x, s.y, s.size * 1.3)
        glow.addColorStop(0, `rgba(255,255,255,0.2)`)
        glow.addColorStop(1, `rgba(255,255,255,0)`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size * 1.3, 0, Math.PI * 2)
        ctx.fill()
      }

      s.type.draw(ctx, s.x, s.y, s.size)

      // checkmark on revealed
      if (s.revealed) {
        const cx = s.x + s.size * 0.6
        const cy = s.y - s.size * 0.6
        ctx.beginPath()
        ctx.arc(cx + 1, cy + 1, 16, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(0,0,0,0.1)"
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx, cy, 16, 0, Math.PI * 2)
        ctx.fillStyle = "#26de81"
        ctx.fill()
        ctx.strokeStyle = "#fff"
        ctx.lineWidth = 3.5
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.beginPath()
        ctx.moveTo(cx - 6, cy)
        ctx.lineTo(cx - 1, cy + 5)
        ctx.lineTo(cx + 7, cy - 5)
        ctx.stroke()

        const shimmerAlpha = Math.max(0, 1 - (time - (s.revealTime || 0)) / 3)
        if (shimmerAlpha > 0) {
          ctx.globalAlpha = shimmerAlpha * 0.5
          for (let i = 0; i < 4; i++) {
            const a = time * 2 + i * Math.PI / 2
            const r = s.size * 0.8
            drawSparkle(ctx, s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 4 + Math.sin(time * 4 + i) * 2)
          }
          ctx.globalAlpha = 1
        }
      }

      ctx.restore()
    })

    // draw the mud overlay on top of everything
    if (mudCanvas) {
      ctx.drawImage(mudCanvas, 0, 0)
    }

    // bubbles
    bubbles.forEach(b => {
      ctx.globalAlpha = b.life * 0.4
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(150,200,255,0.5)"
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(b.x - b.size * 0.2, b.y - b.size * 0.2, b.size * 0.25, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,0.3)"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // sparkles
    sparkles.forEach(s => {
      ctx.globalAlpha = Math.min(1, s.life)
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rot || 0)
      if (s.type === "star") {
        drawMiniStar(ctx, 0, 0, s.size)
      } else {
        drawSparkle(ctx, 0, 0, s.size)
      }
      ctx.restore()
    })
    ctx.globalAlpha = 1

    // particles
    particles.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot || 0)
      ctx.beginPath()
      ctx.arc(0, 0, p.size, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.fill()
      ctx.restore()
    })
    ctx.globalAlpha = 1

    // score popups
    scorePopups.forEach(p => {
      const alpha = Math.min(1, p.life * 2)
      const s = p.scale * (1 + (1.3 - p.life) * 0.15)
      ctx.globalAlpha = alpha
      ctx.font = `bold ${Math.round(22 * s)}px sans-serif`
      ctx.textAlign = "center"
      ctx.strokeStyle = "rgba(0,0,0,0.15)"
      ctx.lineWidth = 3
      ctx.strokeText(p.text, p.x, p.y)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y)
    })
    ctx.globalAlpha = 1

    // progress text
    const found = shapes.filter(s => s.revealed).length
    const total = shapes.length
    ctx.fillStyle = "rgba(0,0,0,0.08)"
    ctx.font = "bold 32px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(`${found} / ${total}`, w / 2 + 1, 15)
    ctx.fillStyle = "rgba(80,100,140,0.55)"
    ctx.fillText(`${found} / ${total}`, w / 2, 14)

    ctx.font = "16px sans-serif"
    ctx.fillStyle = "rgba(80,100,140,0.35)"
    ctx.fillText(`Round ${score + 1}`, w / 2, 50)

    if (allClean) {
      const ct = Math.min(1, (time - (allCleanTime || 0)) / 0.5)
      const scale = ct < 1 ? 0.5 + ct * 0.7 : 1.2 - Math.sin((time - (allCleanTime || 0) - 0.5) * 5) * 0.08
      ctx.save()
      ctx.translate(w / 2, h - 50)
      ctx.scale(scale, scale)
      ctx.font = "bold 26px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.strokeStyle = "rgba(0,0,0,0.1)"
      ctx.lineWidth = 3
      ctx.strokeText("All Clean! Tap for more!", 0, 0)
      ctx.fillStyle = "#26de81"
      ctx.fillText("All Clean! Tap for more!", 0, 0)
      ctx.restore()
    }

    if (score === 0 && !allClean && found === 0) {
      ctx.font = "17px sans-serif"
      ctx.fillStyle = "rgba(80,100,140,0.4)"
      ctx.textAlign = "center"
      ctx.fillText("Scrub the mud to find hidden pictures!", w / 2, h - 45)
    }

    ctx.restore()
  }
}

let allCleanTime = 0

function createMudOverlay() {
  mudCanvas = document.createElement("canvas")
  mudCanvas.width = w
  mudCanvas.height = h
  mudCtx = mudCanvas.getContext("2d", { willReadFrequently: true })

  // base mud color
  mudCtx.fillStyle = "#6B4F3A"
  mudCtx.fillRect(0, 0, w, h)

  // large splotchy layers for organic look
  for (let j = 0; j < 40; j++) {
    const sx = Math.random() * w
    const sy = Math.random() * h
    const sr = 40 + Math.random() * 120
    mudCtx.beginPath()
    mudCtx.arc(sx, sy, sr, 0, Math.PI * 2)
    mudCtx.fillStyle = MUD_COLORS[Math.floor(Math.random() * MUD_COLORS.length)]
    mudCtx.globalAlpha = 0.2 + Math.random() * 0.35
    mudCtx.fill()
  }

  // smaller splotches for texture
  for (let j = 0; j < 60; j++) {
    const sx = Math.random() * w
    const sy = Math.random() * h
    const sr = 10 + Math.random() * 50
    mudCtx.beginPath()
    mudCtx.arc(sx, sy, sr, 0, Math.PI * 2)
    mudCtx.fillStyle = MUD_COLORS[Math.floor(Math.random() * MUD_COLORS.length)]
    mudCtx.globalAlpha = 0.15 + Math.random() * 0.3
    mudCtx.fill()
  }

  // scratchy texture lines
  mudCtx.globalAlpha = 0.06
  mudCtx.strokeStyle = "#3a2810"
  mudCtx.lineWidth = 1
  for (let j = 0; j < 30; j++) {
    mudCtx.beginPath()
    mudCtx.moveTo(Math.random() * w, Math.random() * h)
    mudCtx.lineTo(Math.random() * w, Math.random() * h)
    mudCtx.stroke()
  }

  // small specks
  mudCtx.globalAlpha = 0.12
  mudCtx.fillStyle = "#3a2810"
  for (let j = 0; j < 80; j++) {
    mudCtx.beginPath()
    mudCtx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, Math.PI * 2)
    mudCtx.fill()
  }

  // lighter puddle highlights
  mudCtx.globalAlpha = 0.08
  mudCtx.fillStyle = "#C0A87A"
  for (let j = 0; j < 15; j++) {
    mudCtx.beginPath()
    mudCtx.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 15 + Math.random() * 30, Math.random() * Math.PI, 0, Math.PI * 2)
    mudCtx.fill()
  }

  mudCtx.globalAlpha = 1
}

function setupRound() {
  allClean = false
  shapes = []

  const count = Math.max(5, 5 + Math.min(3, Math.floor(score / 2)))
  const shuffled = [...SHAPE_TYPES].sort(() => Math.random() - 0.5)
  const picked = shuffled.slice(0, count)

  const margin = 80
  const shapeSize = Math.min(w, h) * 0.08
  const minDist = shapeSize * 3

  picked.forEach((type) => {
    let cx, cy, overlaps
    let attempts = 0
    do {
      cx = margin + Math.random() * (w - margin * 2)
      cy = margin + Math.random() * (h - margin * 2)
      overlaps = shapes.some(s => {
        const dx = s.x - cx
        const dy = s.y - cy
        return Math.sqrt(dx * dx + dy * dy) < minDist
      })
      attempts++
    } while (overlaps && attempts < 200)

    shapes.push({
      type, x: cx, y: cy, size: shapeSize,
      revealed: false, halfCelebrated: false,
      progress: 0, revealScale: 1, revealTime: 0, shimmer: 0
    })
  })

  createMudOverlay()
}

function handleDrag(x, y) {
  if (allClean) return

  brushTrail.push({ x, y, life: 1 })

  // erase from the single mud overlay
  if (mudCtx) {
    mudCtx.globalCompositeOperation = "destination-out"
    const grad = mudCtx.createRadialGradient(x, y, BRUSH_RADIUS * 0.3, x, y, BRUSH_RADIUS)
    grad.addColorStop(0, "rgba(0,0,0,1)")
    grad.addColorStop(0.7, "rgba(0,0,0,0.8)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    mudCtx.fillStyle = grad
    mudCtx.beginPath()
    mudCtx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2)
    mudCtx.fill()
    mudCtx.globalCompositeOperation = "source-over"
  }

  // check each shape for reveal progress
  shapes.forEach(s => {
    if (s.revealed) return
    checkShapeProgress(s)
  })

  // scrub sparkles
  for (let i = 0; i < 3; i++) {
    sparkles.push({
      x: x + (Math.random() - 0.5) * BRUSH_RADIUS,
      y: y + (Math.random() - 0.5) * BRUSH_RADIUS,
      vx: (Math.random() - 0.5) * 70,
      vy: -25 - Math.random() * 45,
      size: 2 + Math.random() * 4,
      life: 0.8,
      rot: 0, rotSpeed: (Math.random() - 0.5) * 5,
      type: Math.random() < 0.3 ? "star" : "sparkle"
    })
  }

  // soap bubbles
  if (Math.random() < 0.15) {
    bubbles.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 30,
      size: 4 + Math.random() * 8,
      speed: 15 + Math.random() * 25,
      wobble: Math.random() * Math.PI * 2,
      life: 2 + Math.random() * 2
    })
  }
}

function handleTap(x, y) {
  if (allClean) {
    score++
    setupRound()
    return
  }
  handleDrag(x, y)
}

function checkShapeProgress(s) {
  if (!mudCtx) return
  // sample the mud overlay in the area around the shape
  const r = s.size + 20
  const sx = Math.max(0, Math.floor(s.x - r))
  const sy = Math.max(0, Math.floor(s.y - r))
  const sw = Math.min(Math.ceil(r * 2), w - sx)
  const sh = Math.min(Math.ceil(r * 2), h - sy)
  if (sw <= 0 || sh <= 0) return

  const data = mudCtx.getImageData(sx, sy, sw, sh).data
  let cleared = 0
  const step = 8
  const total = (sw * sh)
  for (let i = 0; i < total; i += step) {
    if (data[i * 4 + 3] === 0) cleared++
  }
  const progress = cleared / (total / step)
  s.progress = progress

  if (progress > 0.4 && !s.halfCelebrated) {
    s.halfCelebrated = true
    celebrate()
    playSqueak()

    scorePopups.push({
      x: s.x, y: s.y - s.size - 10,
      text: "Almost!",
      life: 1, color: "#54a0ff", scale: 1
    })
  }

  if (progress > 0.65 && !s.revealed) {
    s.revealed = true
    s.revealTime = time
    s.revealScale = 0.8

    // clear mud around this shape completely
    if (mudCtx) {
      mudCtx.globalCompositeOperation = "destination-out"
      mudCtx.beginPath()
      mudCtx.arc(s.x, s.y, s.size + 25, 0, Math.PI * 2)
      mudCtx.fillStyle = "rgba(0,0,0,1)"
      mudCtx.fill()
      mudCtx.globalCompositeOperation = "source-over"
    }

    screenShake = 4

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      particles.push({
        x: s.x, y: s.y,
        vx: Math.cos(a) * (50 + Math.random() * 70),
        vy: Math.sin(a) * (50 + Math.random() * 70),
        size: 3 + Math.random() * 4,
        life: 0.8,
        color: s.type.color,
        rot: 0, rotSpeed: (Math.random() - 0.5) * 5,
        gravity: 50, decay: 1.5
      })
    }

    for (let i = 0; i < 8; i++) {
      sparkles.push({
        x: s.x + (Math.random() - 0.5) * s.size,
        y: s.y + (Math.random() - 0.5) * s.size,
        vx: (Math.random() - 0.5) * 80,
        vy: -30 - Math.random() * 60,
        size: 4 + Math.random() * 5,
        life: 1,
        rot: 0, rotSpeed: (Math.random() - 0.5) * 4,
        type: "star"
      })
    }

    scorePopups.push({
      x: s.x, y: s.y - s.size - 10,
      text: `Found: ${s.type.name}!`,
      life: 1.5, color: s.type.color, scale: 1.2
    })

    celebrate()
    playSqueak()

    if (shapes.every(sh => sh.revealed)) {
      allClean = true
      allCleanTime = time
      screenShake = 10
      mudCanvas = null
      mudCtx = null

      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2
        const speed = 80 + Math.random() * 120
        particles.push({
          x: w / 2, y: h / 2,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 40,
          size: 4 + Math.random() * 6,
          life: 1.5,
          color: ['#ff6b6b', '#54a0ff', '#feca57', '#26de81', '#a55eea', '#ff9ff3'][i % 6],
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 6,
          gravity: 50, decay: 0.8
        })
      }

      celebrateBig()
    }
  }
}

function drawSparkle(ctx, x, y, size) {
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.quadraticCurveTo(x + size * 0.15, y - size * 0.15, x + size, y)
  ctx.quadraticCurveTo(x + size * 0.15, y + size * 0.15, x, y + size)
  ctx.quadraticCurveTo(x - size * 0.15, y + size * 0.15, x - size, y)
  ctx.quadraticCurveTo(x - size * 0.15, y - size * 0.15, x, y - size)
  ctx.fill()
}

function drawMiniStar(ctx, x, y, size) {
  ctx.fillStyle = "rgba(160,180,210,0.8)"
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const outerA = (i / 5) * Math.PI * 2 - Math.PI / 2
    const innerA = outerA + Math.PI / 5
    if (i === 0) ctx.moveTo(x + Math.cos(outerA) * size, y + Math.sin(outerA) * size)
    else ctx.lineTo(x + Math.cos(outerA) * size, y + Math.sin(outerA) * size)
    ctx.lineTo(x + Math.cos(innerA) * size * 0.4, y + Math.sin(innerA) * size * 0.4)
  }
  ctx.closePath()
  ctx.fill()
}

// --- Shape drawings ---

function drawSun(ctx, x, y, size) {
  ctx.lineCap = "round"
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    const inner = size * 0.5
    const outer = size * (i % 2 === 0 ? 0.9 : 0.72)
    ctx.strokeStyle = i % 2 === 0 ? "#feca57" : "#ffe08a"
    ctx.lineWidth = size * (i % 2 === 0 ? 0.08 : 0.05)
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner)
    ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer)
    ctx.stroke()
  }
  const sg = ctx.createRadialGradient(x - size * 0.1, y - size * 0.1, size * 0.05, x, y, size * 0.45)
  sg.addColorStop(0, "#fff3b0")
  sg.addColorStop(1, "#feca57")
  ctx.beginPath()
  ctx.arc(x, y, size * 0.42, 0, Math.PI * 2)
  ctx.fillStyle = sg
  ctx.fill()
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.arc(x - size * 0.12, y - size * 0.08, size * 0.045, 0, Math.PI * 2)
  ctx.arc(x + size * 0.12, y - size * 0.08, size * 0.045, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y + size * 0.06, size * 0.16, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.strokeStyle = "#c08a20"
  ctx.lineWidth = size * 0.03
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x - size * 0.22, y + size * 0.04, size * 0.06, 0, Math.PI * 2)
  ctx.arc(x + size * 0.22, y + size * 0.04, size * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,150,100,0.25)"
  ctx.fill()
}

function drawStar(ctx, x, y, size) {
  const sg = ctx.createRadialGradient(x, y - size * 0.15, size * 0.1, x, y, size * 0.8)
  sg.addColorStop(0, "#fff3b0")
  sg.addColorStop(1, "#feca57")
  ctx.fillStyle = sg
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const innerAngle = outerAngle + Math.PI / 5
    const ox = x + Math.cos(outerAngle) * size * 0.8
    const oy = y + Math.sin(outerAngle) * size * 0.8
    const ix = x + Math.cos(innerAngle) * size * 0.35
    const iy = y + Math.sin(innerAngle) * size * 0.35
    if (i === 0) ctx.moveTo(ox, oy)
    else ctx.lineTo(ox, oy)
    ctx.lineTo(ix, iy)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.arc(x - size * 0.12, y - size * 0.06, size * 0.04, 0, Math.PI * 2)
  ctx.arc(x + size * 0.12, y - size * 0.06, size * 0.04, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y + size * 0.06, size * 0.1, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.strokeStyle = "#b89a20"
  ctx.lineWidth = size * 0.03
  ctx.lineCap = "round"
  ctx.stroke()
}

function drawFish(ctx, x, y, size) {
  ctx.beginPath()
  ctx.moveTo(x + size * 0.5, y)
  ctx.lineTo(x + size * 0.88, y - size * 0.28)
  ctx.lineTo(x + size * 0.88, y + size * 0.28)
  ctx.closePath()
  ctx.fillStyle = "#48dbfb"
  ctx.fill()
  const fg = ctx.createRadialGradient(x - size * 0.1, y - size * 0.05, size * 0.05, x, y, size * 0.6)
  fg.addColorStop(0, "#7ec8ff")
  fg.addColorStop(1, "#3d8ae6")
  ctx.beginPath()
  ctx.ellipse(x, y, size * 0.6, size * 0.38, 0, 0, Math.PI * 2)
  ctx.fillStyle = fg
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x, y - size * 0.3)
  ctx.quadraticCurveTo(x + size * 0.1, y - size * 0.6, x + size * 0.25, y - size * 0.35)
  ctx.fillStyle = "#48dbfb"
  ctx.fill()
  ctx.globalAlpha = 0.06
  for (let sx = -0.3; sx < 0.3; sx += 0.15) {
    for (let sy = -0.15; sy < 0.15; sy += 0.15) {
      ctx.beginPath()
      ctx.arc(x + sx * size, y + sy * size, size * 0.06, 0, Math.PI * 2)
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(x - size * 0.25, y - size * 0.06, size * 0.11, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.arc(x - size * 0.23, y - size * 0.06, size * 0.06, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(x - size * 0.21, y - size * 0.08, size * 0.025, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x - size * 0.45, y + size * 0.05, size * 0.06, 0.3, Math.PI * 0.7)
  ctx.strokeStyle = "#2d7dd2"
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawFlower(ctx, x, y, size) {
  ctx.strokeStyle = "#3a9a3a"
  ctx.lineWidth = size * 0.06
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(x, y + size * 0.2)
  ctx.lineTo(x, y + size * 0.8)
  ctx.stroke()
  ctx.fillStyle = "#26de81"
  ctx.beginPath()
  ctx.ellipse(x + size * 0.15, y + size * 0.55, size * 0.12, size * 0.06, 0.4, 0, Math.PI * 2)
  ctx.fill()
  const petalColors = ["#ff6b6b", "#ff9ff3", "#ff6b6b", "#ff9ff3", "#ff6b6b", "#ff8080"]
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
    const px = x + Math.cos(angle) * size * 0.32
    const py = y + Math.sin(angle) * size * 0.32
    ctx.beginPath()
    ctx.ellipse(px, py, size * 0.2, size * 0.28, angle, 0, Math.PI * 2)
    ctx.fillStyle = petalColors[i]
    ctx.fill()
  }
  const cg = ctx.createRadialGradient(x, y, size * 0.02, x, y, size * 0.2)
  cg.addColorStop(0, "#fff3a0")
  cg.addColorStop(1, "#feca57")
  ctx.beginPath()
  ctx.arc(x, y, size * 0.2, 0, Math.PI * 2)
  ctx.fillStyle = cg
  ctx.fill()
  ctx.fillStyle = "rgba(200,150,50,0.15)"
  for (let i = 0; i < 5; i++) {
    const a = i * 1.2 + 0.5
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * size * 0.08, y + Math.sin(a) * size * 0.08, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawHeart(ctx, x, y, size) {
  const s = size * 0.8
  const hg = ctx.createRadialGradient(x - s * 0.2, y - s * 0.1, s * 0.1, x, y + s * 0.2, s)
  hg.addColorStop(0, "#ff9a9a")
  hg.addColorStop(1, "#e74c3c")
  ctx.fillStyle = hg
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y - s * 0.1, x - s * 0.6, y - s * 0.4, x - s * 0.6, y - s * 0.1)
  ctx.bezierCurveTo(x - s * 0.6, y + s * 0.15, x, y + s * 0.5, x, y + s * 0.7)
  ctx.bezierCurveTo(x, y + s * 0.5, x + s * 0.6, y + s * 0.15, x + s * 0.6, y - s * 0.1)
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.4, x, y - s * 0.1, x, y + s * 0.3)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x - s * 0.2, y - s * 0.05, s * 0.12, s * 0.08, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.3)"
  ctx.fill()
}

function drawMoon(ctx, x, y, size) {
  const mg = ctx.createRadialGradient(x - size * 0.1, y - size * 0.1, size * 0.1, x, y, size * 0.5)
  mg.addColorStop(0, "#fff8d0")
  mg.addColorStop(1, "#f0e6b8")
  ctx.beginPath()
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = mg
  ctx.fill()
  ctx.globalAlpha = 0.08
  ctx.fillStyle = "#c0a060"
  ctx.beginPath()
  ctx.arc(x - size * 0.12, y + size * 0.1, size * 0.08, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + size * 0.15, y - size * 0.15, size * 0.06, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(x + size * 0.22, y - size * 0.12, size * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = "#e0ecf5"
  ctx.fill()
  ctx.strokeStyle = "rgba(0,0,0,0.15)"
  ctx.lineWidth = 1.5
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.arc(x - size * 0.08, y - size * 0.05, size * 0.06, Math.PI + 0.3, -0.3)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + size * 0.05, y - size * 0.05, size * 0.06, Math.PI + 0.3, -0.3)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x - size * 0.02, y + size * 0.1, size * 0.08, 0.2, Math.PI - 0.2)
  ctx.stroke()
}

function drawCloud(ctx, x, y, size) {
  const cg = ctx.createRadialGradient(x, y - size * 0.1, size * 0.1, x, y, size * 0.4)
  cg.addColorStop(0, "#daeef8")
  cg.addColorStop(1, "#b8dce6")
  ctx.fillStyle = cg
  ctx.beginPath()
  ctx.arc(x, y, size * 0.32, 0, Math.PI * 2)
  ctx.arc(x - size * 0.32, y + size * 0.06, size * 0.24, 0, Math.PI * 2)
  ctx.arc(x + size * 0.32, y + size * 0.06, size * 0.27, 0, Math.PI * 2)
  ctx.arc(x + size * 0.15, y - size * 0.18, size * 0.24, 0, Math.PI * 2)
  ctx.arc(x - size * 0.15, y - size * 0.12, size * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "rgba(0,0,0,0.12)"
  ctx.beginPath()
  ctx.arc(x - size * 0.1, y - size * 0.03, size * 0.03, 0, Math.PI * 2)
  ctx.arc(x + size * 0.1, y - size * 0.03, size * 0.03, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y + size * 0.08, size * 0.08, 0.2, Math.PI - 0.2)
  ctx.strokeStyle = "rgba(0,0,0,0.1)"
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawTree(ctx, x, y, size) {
  ctx.fillStyle = "#8b6914"
  ctx.beginPath()
  ctx.roundRect(x - size * 0.08, y + size * 0.1, size * 0.16, size * 0.55, 3)
  ctx.fill()
  ctx.fillStyle = "#26de81"
  ctx.beginPath()
  ctx.moveTo(x, y - size * 0.65)
  ctx.lineTo(x - size * 0.48, y + size * 0.18)
  ctx.lineTo(x + size * 0.48, y + size * 0.18)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = "#34d88a"
  ctx.beginPath()
  ctx.moveTo(x, y - size * 0.92)
  ctx.lineTo(x - size * 0.33, y - size * 0.22)
  ctx.lineTo(x + size * 0.33, y - size * 0.22)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = "rgba(255,255,255,0.12)"
  ctx.beginPath()
  ctx.moveTo(x, y - size * 0.92)
  ctx.lineTo(x - size * 0.15, y - size * 0.5)
  ctx.lineTo(x + size * 0.15, y - size * 0.5)
  ctx.fill()
  ctx.fillStyle = "#ff6b6b"
  ctx.beginPath()
  ctx.arc(x - size * 0.15, y - size * 0.1, 3, 0, Math.PI * 2)
  ctx.arc(x + size * 0.2, y - size * 0.3, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawButterfly(ctx, x, y, size) {
  ctx.fillStyle = "#ff9ff3"
  ctx.beginPath()
  ctx.ellipse(x - size * 0.3, y - size * 0.05, size * 0.35, size * 0.5, -0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#ffc4f8"
  ctx.beginPath()
  ctx.ellipse(x - size * 0.25, y - size * 0.05, size * 0.2, size * 0.3, -0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#ff9ff3"
  ctx.beginPath()
  ctx.ellipse(x + size * 0.3, y - size * 0.05, size * 0.35, size * 0.5, 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#ffc4f8"
  ctx.beginPath()
  ctx.ellipse(x + size * 0.25, y - size * 0.05, size * 0.2, size * 0.3, 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#e080d8"
  ctx.beginPath()
  ctx.ellipse(x - size * 0.2, y + size * 0.2, size * 0.22, size * 0.28, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + size * 0.2, y + size * 0.2, size * 0.22, size * 0.28, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "rgba(255,255,255,0.3)"
  ctx.beginPath()
  ctx.arc(x - size * 0.3, y - size * 0.1, size * 0.06, 0, Math.PI * 2)
  ctx.arc(x + size * 0.3, y - size * 0.1, size * 0.06, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#333"
  ctx.beginPath()
  ctx.ellipse(x, y, size * 0.06, size * 0.3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y - size * 0.32, size * 0.07, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "#333"
  ctx.lineWidth = 1.5
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(x, y - size * 0.35)
  ctx.quadraticCurveTo(x - size * 0.1, y - size * 0.55, x - size * 0.05, y - size * 0.58)
  ctx.moveTo(x, y - size * 0.35)
  ctx.quadraticCurveTo(x + size * 0.1, y - size * 0.55, x + size * 0.05, y - size * 0.58)
  ctx.stroke()
}

function drawRainbow(ctx, x, y, size) {
  const colors = ["#ff6b6b", "#ff9f43", "#feca57", "#26de81", "#54a0ff", "#a55eea"]
  const bandW = size * 0.08
  colors.forEach((c, i) => {
    ctx.beginPath()
    ctx.arc(x, y + size * 0.2, size * (0.8 - i * 0.1), Math.PI, 0)
    ctx.strokeStyle = c
    ctx.lineWidth = bandW
    ctx.stroke()
  })
  ctx.fillStyle = "#d8ecf4"
  ctx.beginPath()
  ctx.arc(x - size * 0.75, y + size * 0.2, size * 0.18, 0, Math.PI * 2)
  ctx.arc(x - size * 0.6, y + size * 0.22, size * 0.14, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + size * 0.75, y + size * 0.2, size * 0.18, 0, Math.PI * 2)
  ctx.arc(x + size * 0.6, y + size * 0.22, size * 0.14, 0, Math.PI * 2)
  ctx.fill()
}

function drawMushroom(ctx, x, y, size) {
  ctx.fillStyle = "#f5e6c8"
  ctx.beginPath()
  ctx.roundRect(x - size * 0.15, y, size * 0.3, size * 0.5, 5)
  ctx.fill()
  const mg = ctx.createRadialGradient(x - size * 0.1, y - size * 0.15, size * 0.05, x, y, size * 0.5)
  mg.addColorStop(0, "#ff8080")
  mg.addColorStop(1, "#d63031")
  ctx.beginPath()
  ctx.ellipse(x, y, size * 0.5, size * 0.35, 0, Math.PI, 0)
  ctx.fillStyle = mg
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(x - size * 0.2, y - size * 0.15, size * 0.07, 0, Math.PI * 2)
  ctx.arc(x + size * 0.15, y - size * 0.2, size * 0.06, 0, Math.PI * 2)
  ctx.arc(x + size * 0.05, y - size * 0.08, size * 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.arc(x - size * 0.06, y + size * 0.18, size * 0.03, 0, Math.PI * 2)
  ctx.arc(x + size * 0.06, y + size * 0.18, size * 0.03, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y + size * 0.26, size * 0.06, 0.2, Math.PI - 0.2)
  ctx.strokeStyle = "#c4872e"
  ctx.lineWidth = 1.5
  ctx.lineCap = "round"
  ctx.stroke()
}

function drawSnail(ctx, x, y, size) {
  ctx.fillStyle = "#c490f0"
  ctx.beginPath()
  ctx.ellipse(x, y + size * 0.15, size * 0.6, size * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
  const sg = ctx.createRadialGradient(x + size * 0.05, y - size * 0.1, size * 0.05, x + size * 0.05, y - size * 0.05, size * 0.4)
  sg.addColorStop(0, "#d4b5f7")
  sg.addColorStop(1, "#8854d0")
  ctx.beginPath()
  ctx.arc(x + size * 0.05, y - size * 0.05, size * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = sg
  ctx.fill()
  ctx.strokeStyle = "rgba(255,255,255,0.2)"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x + size * 0.05, y - size * 0.05, size * 0.2, 0, Math.PI * 1.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + size * 0.05, y - size * 0.05, size * 0.1, Math.PI, Math.PI * 2.5)
  ctx.stroke()
  ctx.fillStyle = "#c490f0"
  ctx.beginPath()
  ctx.arc(x - size * 0.45, y + size * 0.05, size * 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "#c490f0"
  ctx.lineWidth = 2.5
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(x - size * 0.5, y - size * 0.02)
  ctx.lineTo(x - size * 0.55, y - size * 0.2)
  ctx.moveTo(x - size * 0.4, y - size * 0.02)
  ctx.lineTo(x - size * 0.38, y - size * 0.2)
  ctx.stroke()
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.arc(x - size * 0.55, y - size * 0.22, size * 0.04, 0, Math.PI * 2)
  ctx.arc(x - size * 0.38, y - size * 0.22, size * 0.04, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x - size * 0.45, y + size * 0.12, size * 0.05, 0.2, Math.PI - 0.2)
  ctx.strokeStyle = "#8a50c0"
  ctx.lineWidth = 1.5
  ctx.stroke()
}
