import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler, dragHandler, dragEndHandler
let slots, pieces, dragging, dragX, dragY, dragOffsetX, dragOffsetY
let score, time, complete, completeTimer
let particles, scorePopups, snapAnims, bgShapes
let combo, comboTimer, lastSnapTime
let screenShake, puzzleIndex
let starsEarned, piecesPlaced, puzzleStartTime

const SNAP_DIST = 65

const SHAPE_DEFS = {
  circle:   { color: "#ff6b6b", accent: "#e05555", highlight: "#ff9a9a" },
  square:   { color: "#54a0ff", accent: "#3d8ae6", highlight: "#8ac0ff" },
  triangle: { color: "#26de81", accent: "#1bc06e", highlight: "#6aeaaa" },
  star:     { color: "#feca57", accent: "#e6b440", highlight: "#ffe08a" },
  heart:    { color: "#ff9ff3", accent: "#e680d8", highlight: "#ffc4f8" },
  diamond:  { color: "#ff9f43", accent: "#e68830", highlight: "#ffc080" },
  hexagon:  { color: "#00cec9", accent: "#00b5b0", highlight: "#5eeae6" },
  cross:    { color: "#a55eea", accent: "#8e45d0", highlight: "#c490f0" },
}

const PUZZLES = [
  { name: "House", slots: [
    { shape: "square",   x: 0.5,  y: 0.52, size: 80 },
    { shape: "triangle", x: 0.5,  y: 0.33, size: 70 },
    { shape: "circle",   x: 0.5,  y: 0.56, size: 22 },
  ]},
  { name: "Smiley", slots: [
    { shape: "circle",   x: 0.5,  y: 0.42, size: 80 },
    { shape: "circle",   x: 0.42, y: 0.38, size: 18 },
    { shape: "circle",   x: 0.58, y: 0.38, size: 18 },
    { shape: "heart",    x: 0.5,  y: 0.48, size: 18 },
  ]},
  { name: "Rocket", slots: [
    { shape: "square",   x: 0.5,  y: 0.48, size: 55 },
    { shape: "triangle", x: 0.5,  y: 0.32, size: 50 },
    { shape: "diamond",  x: 0.38, y: 0.6,  size: 28 },
    { shape: "diamond",  x: 0.62, y: 0.6,  size: 28 },
    { shape: "circle",   x: 0.5,  y: 0.48, size: 18 },
  ]},
  { name: "Crown", slots: [
    { shape: "square",   x: 0.5,  y: 0.5,  size: 65 },
    { shape: "triangle", x: 0.36, y: 0.38, size: 32 },
    { shape: "triangle", x: 0.5,  y: 0.34, size: 35 },
    { shape: "triangle", x: 0.64, y: 0.38, size: 32 },
    { shape: "star",     x: 0.5,  y: 0.46, size: 22 },
  ]},
  { name: "Flower", slots: [
    { shape: "circle",   x: 0.5,  y: 0.4,  size: 28 },
    { shape: "heart",    x: 0.5,  y: 0.29, size: 26 },
    { shape: "heart",    x: 0.41, y: 0.34, size: 26 },
    { shape: "heart",    x: 0.59, y: 0.34, size: 26 },
    { shape: "heart",    x: 0.43, y: 0.47, size: 26 },
    { shape: "heart",    x: 0.57, y: 0.47, size: 26 },
  ]},
  { name: "Butterfly", slots: [
    { shape: "circle",   x: 0.5,  y: 0.42, size: 18 },
    { shape: "heart",    x: 0.36, y: 0.36, size: 38 },
    { shape: "heart",    x: 0.64, y: 0.36, size: 38 },
    { shape: "diamond",  x: 0.38, y: 0.52, size: 28 },
    { shape: "diamond",  x: 0.62, y: 0.52, size: 28 },
  ]},
  { name: "Robot", slots: [
    { shape: "square",   x: 0.5,  y: 0.34, size: 40 },
    { shape: "square",   x: 0.5,  y: 0.52, size: 55 },
    { shape: "circle",   x: 0.44, y: 0.32, size: 12 },
    { shape: "circle",   x: 0.56, y: 0.32, size: 12 },
    { shape: "square",   x: 0.5,  y: 0.38, size: 14 },
    { shape: "diamond",  x: 0.36, y: 0.52, size: 22 },
    { shape: "diamond",  x: 0.64, y: 0.52, size: 22 },
  ]},
  { name: "Fish", slots: [
    { shape: "circle",   x: 0.48, y: 0.42, size: 50 },
    { shape: "triangle", x: 0.32, y: 0.42, size: 40 },
    { shape: "circle",   x: 0.55, y: 0.38, size: 12 },
    { shape: "triangle", x: 0.42, y: 0.28, size: 22 },
  ]},
  { name: "Castle", slots: [
    { shape: "square",   x: 0.5,  y: 0.52, size: 70 },
    { shape: "square",   x: 0.34, y: 0.38, size: 30 },
    { shape: "square",   x: 0.66, y: 0.38, size: 30 },
    { shape: "triangle", x: 0.34, y: 0.28, size: 28 },
    { shape: "triangle", x: 0.66, y: 0.28, size: 28 },
    { shape: "circle",   x: 0.5,  y: 0.56, size: 18 },
  ]},
  { name: "Star Ship", slots: [
    { shape: "star",     x: 0.5,  y: 0.35, size: 40 },
    { shape: "square",   x: 0.5,  y: 0.52, size: 45 },
    { shape: "triangle", x: 0.35, y: 0.58, size: 25 },
    { shape: "triangle", x: 0.65, y: 0.58, size: 25 },
    { shape: "circle",   x: 0.5,  y: 0.52, size: 14 },
    { shape: "diamond",  x: 0.5,  y: 0.65, size: 20 },
  ]},
]

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = ctx.canvas.width
    h = ctx.canvas.height
    score = 0
    time = 0
    complete = false
    completeTimer = 0
    combo = 0
    comboTimer = 0
    lastSnapTime = 0
    screenShake = 0
    puzzleIndex = -1
    starsEarned = 0
    piecesPlaced = 0
    particles = []
    scorePopups = []
    snapAnims = []
    dragging = null

    // floating bg shapes
    bgShapes = []
    for (let i = 0; i < 12; i++) {
      bgShapes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        shape: Object.keys(SHAPE_DEFS)[Math.floor(Math.random() * Object.keys(SHAPE_DEFS).length)],
        size: 10 + Math.random() * 20,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 8,
        alpha: 0.04 + Math.random() * 0.04
      })
    }

    setupPuzzle()

    tapHandler = handleTap
    dragHandler = handleDragMove
    dragEndHandler = handleDragEnd
    input.onTap(tapHandler)
    input.onDragMove(dragHandler)
    input.onDragEnd(dragEndHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    input.offDragMove(dragHandler)
    input.offDragEnd(dragEndHandler)
    slots = []; pieces = []; particles = []; scorePopups = []; snapAnims = []; bgShapes = []
  },

  update(dt) {
    w = ctx.canvas.width
    h = ctx.canvas.height
    time += dt

    // screen shake
    if (screenShake > 0) screenShake *= Math.pow(0.03, dt)
    if (screenShake < 0.3) screenShake = 0

    // combo timer
    if (comboTimer > 0) {
      comboTimer -= dt
      if (comboTimer <= 0) { combo = 0; comboTimer = 0 }
    }

    if (complete) {
      completeTimer += dt
      if (completeTimer > 2.5) {
        score++
        setupPuzzle()
      }
    }

    // pieces bob in tray
    pieces.forEach(p => {
      if (p === dragging) return
      p.bobPhase += dt * (2 + p.bobSpeed)
      p.wobble *= Math.pow(0.05, dt)
      p.wobblePhase += dt * 12
    })

    // snap animations
    snapAnims.forEach(a => {
      a.t += dt * 4
      if (a.t > 1) a.t = 1
      // ease out bounce
      const t = a.t
      const ease = t < 0.6 ? (t / 0.6) * 1.15 : 1.15 - Math.sin((t - 0.6) / 0.4 * Math.PI) * 0.15
      a.currentX = a.fromX + (a.toX - a.fromX) * Math.min(1, ease)
      a.currentY = a.fromY + (a.toY - a.fromY) * Math.min(1, ease)
      a.currentScale = 0.8 + ease * 0.2
      if (a.t >= 1) a.done = true
    })
    snapAnims = snapAnims.filter(a => !a.done)

    // particles
    particles.forEach(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += (p.gravity || 100) * dt
      p.rot += (p.rotSpeed || 0) * dt
      p.life -= dt * (p.decay || 1.5)
    })
    particles = particles.filter(p => p.life > 0)

    // score popups
    scorePopups.forEach(p => { p.y -= 50 * dt; p.life -= dt })
    scorePopups = scorePopups.filter(p => p.life > 0)

    // bg shapes float
    bgShapes.forEach(s => {
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.rot += s.rotSpeed * dt
      if (s.x < -30) s.x = w + 30
      if (s.x > w + 30) s.x = -30
      if (s.y < -30) s.y = h + 30
      if (s.y > h + 30) s.y = -30
    })

    // slots glow pulse for unfilled
    slots.forEach(s => {
      s.glowPhase = (s.glowPhase || 0) + dt * 2.5
    })
  },

  render() {
    ctx.save()

    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake)
    }

    // background gradient
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, "#e8d5f5")
    bg.addColorStop(0.5, "#d4e6ff")
    bg.addColorStop(1, "#fde8ef")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // subtle grid pattern
    ctx.globalAlpha = 0.03
    ctx.strokeStyle = "#8060a0"
    ctx.lineWidth = 1
    for (let gx = 0; gx < w; gx += 40) {
      ctx.beginPath()
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, h)
      ctx.stroke()
    }
    for (let gy = 0; gy < h; gy += 40) {
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.lineTo(w, gy)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // floating background shapes
    bgShapes.forEach(s => {
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rot)
      ctx.globalAlpha = s.alpha
      drawShapeFilled(ctx, 0, 0, s.size, s.shape, "#a080c0")
      ctx.globalAlpha = 1
      ctx.restore()
    })

    // puzzle area — card style
    const cardX = w * 0.06
    const cardY = h * 0.06
    const cardW = w * 0.88
    const cardH = h * 0.58
    // card shadow
    ctx.fillStyle = "rgba(0,0,0,0.06)"
    ctx.beginPath()
    ctx.roundRect(cardX + 3, cardY + 3, cardW, cardH, 18)
    ctx.fill()
    // card
    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH)
    cardGrad.addColorStop(0, "rgba(255,255,255,0.55)")
    cardGrad.addColorStop(1, "rgba(255,255,255,0.35)")
    ctx.fillStyle = cardGrad
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, cardH, 18)
    ctx.fill()
    // card border
    ctx.strokeStyle = "rgba(160,130,200,0.15)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, cardH, 18)
    ctx.stroke()

    // puzzle name
    ctx.font = "bold 15px sans-serif"
    ctx.fillStyle = "rgba(120,80,160,0.35)"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    const puzzleName = PUZZLES[puzzleIndex] ? PUZZLES[puzzleIndex].name : ""
    ctx.fillText(puzzleName, w / 2, cardY + 8)

    // slot outlines (unfilled)
    slots.forEach(s => {
      if (s.filled) return
      const def = SHAPE_DEFS[s.shape]
      const glow = 0.15 + Math.sin(s.glowPhase || 0) * 0.08

      // proximity glow when dragging matching shape nearby
      let proximity = 0
      if (dragging && dragging.shape === s.shape) {
        const dx = dragX - s.x
        const dy = dragY - s.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        proximity = Math.max(0, 1 - dist / (SNAP_DIST * 2.5))
      }

      if (proximity > 0) {
        // glow ring
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size + 15, 0, Math.PI * 2)
        const glowGrad = ctx.createRadialGradient(s.x, s.y, s.size * 0.5, s.x, s.y, s.size + 15)
        glowGrad.addColorStop(0, `rgba(${hexToRgb(def.color)}, ${proximity * 0.3})`)
        glowGrad.addColorStop(1, `rgba(${hexToRgb(def.color)}, 0)`)
        ctx.fillStyle = glowGrad
        ctx.fill()
      }

      // filled background hint
      ctx.globalAlpha = glow
      drawShapeFilled(ctx, s.x, s.y, s.size, s.shape, def.color)
      ctx.globalAlpha = 1

      // animated dashed outline
      const dashOffset = time * 15
      ctx.setLineDash([8, 6])
      ctx.lineDashOffset = dashOffset
      drawShapeStroke(ctx, s.x, s.y, s.size, s.shape, def.color, 0.5 + proximity * 0.4, 3)
      ctx.setLineDash([])
      ctx.lineDashOffset = 0
    })

    // snap animations (pieces flying to slots)
    snapAnims.forEach(a => {
      const def = SHAPE_DEFS[a.shape]
      ctx.save()
      ctx.translate(a.currentX, a.currentY)
      ctx.scale(a.currentScale, a.currentScale)
      drawShapeRich(ctx, 0, 0, a.size, a.shape, def)
      ctx.restore()
    })

    // filled slots (with sparkle)
    slots.forEach(s => {
      if (!s.filled) return
      const def = SHAPE_DEFS[s.shape]
      drawShapeRich(ctx, s.x, s.y, s.size, s.shape, def)

      // settled sparkle
      if (time - (s.fillTime || 0) < 1.5) {
        const t = time - (s.fillTime || 0)
        const sparkleAlpha = Math.max(0, 1 - t / 1.5)
        ctx.globalAlpha = sparkleAlpha * 0.6
        for (let i = 0; i < 3; i++) {
          const a = time * 3 + i * 2.1
          const r = s.size * 0.6 + Math.sin(a) * 10
          drawSparkle(ctx, s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 4 + Math.sin(time * 5 + i) * 2)
        }
        ctx.globalAlpha = 1
      }
    })

    // piece tray
    const trayX = w * 0.04
    const trayY2 = h * 0.7
    const trayW = w * 0.92
    const trayH2 = h * 0.26
    // tray shadow
    ctx.fillStyle = "rgba(0,0,0,0.04)"
    ctx.beginPath()
    ctx.roundRect(trayX + 2, trayY2 + 2, trayW, trayH2, 14)
    ctx.fill()
    // tray bg — warm wooden feel
    const trayGrad = ctx.createLinearGradient(trayX, trayY2, trayX, trayY2 + trayH2)
    trayGrad.addColorStop(0, "rgba(210,190,160,0.2)")
    trayGrad.addColorStop(0.5, "rgba(200,180,150,0.15)")
    trayGrad.addColorStop(1, "rgba(190,170,140,0.2)")
    ctx.fillStyle = trayGrad
    ctx.beginPath()
    ctx.roundRect(trayX, trayY2, trayW, trayH2, 14)
    ctx.fill()
    // tray border
    ctx.strokeStyle = "rgba(160,140,110,0.15)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(trayX, trayY2, trayW, trayH2, 14)
    ctx.stroke()
    // wood grain lines
    ctx.globalAlpha = 0.03
    ctx.strokeStyle = "#8a6a3a"
    ctx.lineWidth = 1
    for (let ly = trayY2 + 8; ly < trayY2 + trayH2 - 5; ly += 12) {
      ctx.beginPath()
      ctx.moveTo(trayX + 10, ly)
      for (let lx = trayX + 10; lx < trayX + trayW - 10; lx += 20) {
        ctx.lineTo(lx, ly + Math.sin(lx * 0.05 + ly * 0.1) * 2)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // pieces in tray (not dragging)
    pieces.forEach(p => {
      if (p === dragging) return
      const def = SHAPE_DEFS[p.shape]
      const bobY = Math.sin(p.bobPhase) * 3
      const wobbleRot = Math.sin(p.wobblePhase) * p.wobble

      // shadow
      ctx.beginPath()
      ctx.ellipse(p.x, p.y + p.size * 0.55 + bobY, p.size * 0.45, 5, 0, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(0,0,0,0.07)"
      ctx.fill()

      ctx.save()
      ctx.translate(p.x, p.y + bobY)
      ctx.rotate(wobbleRot)
      drawShapeRich(ctx, 0, 0, p.size, p.shape, def)
      ctx.restore()
    })

    // particles
    particles.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot || 0)
      if (p.type === "shape") {
        drawShapeFilled(ctx, 0, 0, p.size, p.shapeName || "circle", p.color)
      } else if (p.type === "sparkle") {
        drawSparkle(ctx, 0, 0, p.size)
      } else if (p.type === "star") {
        drawStarShape(ctx, 0, 0, p.size, p.color)
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      }
      ctx.restore()
    })
    ctx.globalAlpha = 1

    // dragged piece on top
    if (dragging) {
      const def = SHAPE_DEFS[dragging.shape]
      // large shadow
      ctx.globalAlpha = 0.12
      drawShapeFilled(ctx, dragX + 5, dragY + 6, dragging.size, dragging.shape, "#000")
      ctx.globalAlpha = 1

      // drag trail sparkles
      ctx.globalAlpha = 0.4
      drawSparkle(ctx, dragX + (Math.random() - 0.5) * 10, dragY + (Math.random() - 0.5) * 10, 4 + Math.random() * 3)
      ctx.globalAlpha = 1

      // piece itself — slightly bigger when lifted
      ctx.save()
      ctx.translate(dragX, dragY)
      ctx.scale(1.08, 1.08)
      drawShapeRich(ctx, 0, 0, dragging.size, dragging.shape, def)
      ctx.restore()
    }

    // score popups
    scorePopups.forEach(p => {
      const alpha = Math.min(1, p.life * 2)
      const s = p.scale * (1 + (1.5 - p.life) * 0.15)
      ctx.globalAlpha = alpha
      ctx.font = `bold ${Math.round(22 * s)}px sans-serif`
      ctx.textAlign = "center"
      ctx.strokeStyle = "rgba(0,0,0,0.2)"
      ctx.lineWidth = 3
      ctx.strokeText(p.text, p.x, p.y)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y)
    })
    ctx.globalAlpha = 1

    // progress dots
    const totalSlots = slots.length
    const filled = slots.filter(s => s.filled).length
    const dotY = h * 0.67
    for (let i = 0; i < totalSlots; i++) {
      ctx.beginPath()
      ctx.arc(w / 2 + (i - (totalSlots - 1) / 2) * 16, dotY, 4, 0, Math.PI * 2)
      ctx.fillStyle = i < filled ? "#a55eea" : "rgba(160,130,200,0.25)"
      ctx.fill()
    }

    // combo bar
    if (combo > 1 && comboTimer > 0) {
      const barW = 100
      const barH = 6
      const bx = w / 2 - barW / 2
      const by = dotY + 14
      ctx.fillStyle = "rgba(0,0,0,0.1)"
      ctx.beginPath()
      ctx.roundRect(bx, by, barW, barH, 3)
      ctx.fill()
      const fill = comboTimer / 4
      const cc = combo >= 4 ? "#ff6b6b" : combo >= 2 ? "#feca57" : "#a55eea"
      ctx.fillStyle = cc
      ctx.beginPath()
      ctx.roundRect(bx, by, barW * fill, barH, 3)
      ctx.fill()
      ctx.font = "bold 12px sans-serif"
      ctx.fillStyle = cc
      ctx.textAlign = "center"
      ctx.fillText(`SNAP x${combo}`, w / 2, by - 4)
    }

    // complete celebration text
    if (complete) {
      const ct = Math.min(1, completeTimer / 0.4)
      const scale = ct < 1 ? 0.5 + ct * 0.7 : 1.2 - Math.sin((completeTimer - 0.4) * 5) * 0.1
      ctx.save()
      ctx.translate(w / 2, h * 0.67 - 10)
      ctx.scale(scale, scale)
      ctx.font = "bold 28px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.strokeStyle = "rgba(0,0,0,0.15)"
      ctx.lineWidth = 4
      ctx.strokeText("Complete!", 0, 0)
      ctx.fillStyle = "#a55eea"
      ctx.fillText("Complete!", 0, 0)

      // stars
      for (let i = 0; i < starsEarned; i++) {
        const sx = (i - (starsEarned - 1) / 2) * 30
        const delay = 0.5 + i * 0.2
        if (completeTimer > delay) {
          const starScale = Math.min(1, (completeTimer - delay) * 4)
          ctx.save()
          ctx.translate(sx, 25)
          ctx.scale(starScale, starScale)
          ctx.rotate(Math.sin(time * 3 + i) * 0.15)
          drawStarShape(ctx, 0, 0, 12, "#feca57")
          ctx.restore()
        }
      }
      ctx.restore()
    }

    // score
    ctx.fillStyle = "rgba(0,0,0,0.08)"
    ctx.font = "bold 32px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2 + 1, 15)
    ctx.fillStyle = "rgba(120,80,160,0.7)"
    ctx.fillText(score, w / 2, 14)

    if (score === 0 && !dragging && pieces.length > 0 && !complete) {
      ctx.font = "17px sans-serif"
      ctx.fillStyle = "rgba(120,80,160,0.35)"
      ctx.fillText("Drag shapes to the outlines!", w / 2, dotY + 28)
    }

    ctx.restore()
  }
}

function setupPuzzle() {
  complete = false
  completeTimer = 0
  piecesPlaced = 0
  puzzleStartTime = time

  puzzleIndex = (puzzleIndex + 1) % PUZZLES.length
  const puzzle = PUZZLES[puzzleIndex]

  slots = puzzle.slots.map(s => ({
    shape: s.shape,
    x: s.x * w,
    y: s.y * h,
    size: s.size,
    filled: false,
    fillTime: 0,
    glowPhase: Math.random() * Math.PI * 2
  }))

  const trayY = h * 0.84
  const shuffled = [...slots].sort(() => Math.random() - 0.5)
  const spacing = w / (shuffled.length + 1)

  pieces = shuffled.map((s, i) => ({
    shape: s.shape,
    x: spacing * (i + 1),
    y: trayY + (Math.random() - 0.5) * 15,
    homeX: spacing * (i + 1),
    homeY: trayY,
    size: s.size * 0.75,
    slotIndex: -1,
    bobPhase: Math.random() * Math.PI * 2,
    bobSpeed: Math.random() * 0.6,
    wobble: 0,
    wobblePhase: Math.random() * Math.PI * 2
  }))

  // assign unique slot
  const claimed = new Set()
  pieces.forEach(p => {
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].shape === p.shape && !claimed.has(i)) {
        p.slotIndex = i
        claimed.add(i)
        break
      }
    }
  })
}

function handleTap(x, y) {
  if (complete) return
  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i]
    const dx = p.x - x
    const dy = p.y - y
    if (Math.sqrt(dx * dx + dy * dy) < p.size + 25) {
      dragging = p
      dragX = p.x
      dragY = p.y
      dragOffsetX = p.x - x
      dragOffsetY = p.y - y
      return
    }
  }
}

function handleDragMove(x, y) {
  if (!dragging) return
  dragX = x + (dragOffsetX || 0)
  dragY = y + (dragOffsetY || 0)
}

function handleDragEnd() {
  if (!dragging) return

  const slot = slots[dragging.slotIndex]
  const dx = dragX - slot.x
  const dy = dragY - slot.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < SNAP_DIST) {
    // snap!
    slot.filled = true
    slot.fillTime = time
    piecesPlaced++

    // snap animation
    snapAnims.push({
      shape: dragging.shape,
      size: slot.size,
      fromX: dragX, fromY: dragY,
      toX: slot.x, toY: slot.y,
      currentX: dragX, currentY: dragY,
      currentScale: 0.8,
      t: 0,
      done: false
    })

    pieces = pieces.filter(p => p !== dragging)

    // combo
    const timeSince = time - lastSnapTime
    if (timeSince < 4 && lastSnapTime > 0) {
      combo++
      comboTimer = 4
    } else {
      combo = 1
      comboTimer = 4
    }
    lastSnapTime = time

    const points = Math.max(1, combo)

    // score popup
    scorePopups.push({
      x: slot.x, y: slot.y - slot.size - 10,
      text: combo > 1 ? `SNAP x${combo}!` : "Nice!",
      life: 1.3,
      color: combo >= 3 ? '#feca57' : SHAPE_DEFS[slot.shape].color,
      scale: combo >= 3 ? 1.3 : 1
    })

    // burst particles matching shape color
    const def = SHAPE_DEFS[slot.shape]
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      particles.push({
        x: slot.x, y: slot.y,
        vx: Math.cos(a) * (50 + Math.random() * 80),
        vy: Math.sin(a) * (50 + Math.random() * 80),
        size: 3 + Math.random() * 4,
        life: 0.8,
        color: def.color,
        rot: 0, rotSpeed: (Math.random() - 0.5) * 5,
        type: "dot", gravity: 60
      })
    }
    // mini shape particles
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: slot.x + (Math.random() - 0.5) * 30,
        y: slot.y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 100,
        vy: -40 - Math.random() * 80,
        size: 6 + Math.random() * 6,
        life: 1,
        color: def.highlight,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
        type: "shape", shapeName: slot.shape,
        gravity: 80, decay: 1.2
      })
    }

    screenShake = Math.min(8, 2 + combo * 1.5)
    celebrate()

    // check complete
    if (slots.every(s => s.filled)) {
      complete = true
      completeTimer = 0

      // star rating based on speed
      const elapsed = time - puzzleStartTime
      const slotCount = slots.length
      if (elapsed < slotCount * 2) starsEarned = 3
      else if (elapsed < slotCount * 4) starsEarned = 2
      else starsEarned = 1

      screenShake = 10

      // big celebration particles
      for (let i = 0; i < 25; i++) {
        const a = (i / 25) * Math.PI * 2
        const speed = 80 + Math.random() * 120
        const shapeKeys = Object.keys(SHAPE_DEFS)
        particles.push({
          x: w / 2, y: h * 0.4,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 50,
          size: 5 + Math.random() * 8,
          life: 1.5,
          color: SHAPE_DEFS[shapeKeys[i % shapeKeys.length]].color,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 6,
          type: "shape",
          shapeName: shapeKeys[i % shapeKeys.length],
          gravity: 60, decay: 0.8
        })
      }
      // sparkles
      for (let i = 0; i < 15; i++) {
        particles.push({
          x: w / 2 + (Math.random() - 0.5) * w * 0.6,
          y: h * 0.35 + (Math.random() - 0.5) * h * 0.3,
          vx: (Math.random() - 0.5) * 40,
          vy: -20 - Math.random() * 40,
          size: 4 + Math.random() * 5,
          life: 1.2,
          color: "#feca57",
          rot: 0, rotSpeed: 0,
          type: "sparkle", gravity: 30, decay: 1
        })
      }

      celebrateBig()
    }
  } else {
    // snap back with wobble
    dragging.x = dragging.homeX
    dragging.y = dragging.homeY
    dragging.wobble = 0.3
  }

  dragging = null
}

// --- Rich shape drawing (gradient + highlight + shadow) ---

function drawShapeRich(ctx, x, y, size, shape, def) {
  // inner shadow
  ctx.globalAlpha = 0.08
  drawShapeFilled(ctx, x + 2, y + 2, size, shape, "#000")
  ctx.globalAlpha = 1

  // main fill with gradient feel
  drawShapeFilled(ctx, x, y, size, shape, def.color)

  // highlight overlay
  ctx.globalAlpha = 0.25
  drawShapeFilledClip(ctx, x, y, size, shape, () => {
    ctx.beginPath()
    ctx.ellipse(x - size * 0.2, y - size * 0.25, size * 0.6, size * 0.4, -0.3, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()
  })
  ctx.globalAlpha = 1

  // edge highlight
  ctx.globalAlpha = 0.12
  drawShapeStroke(ctx, x, y, size * 0.96, shape, "#fff", 1, 2)
  ctx.globalAlpha = 1
}

function drawShapeFilledClip(ctx, x, y, size, shape, drawFn) {
  ctx.save()
  ctx.beginPath()
  buildShapePath(ctx, x, y, size, shape)
  ctx.clip()
  drawFn()
  ctx.restore()
}

function buildShapePath(ctx, x, y, size, shape) {
  if (shape === "circle") {
    ctx.arc(x, y, size, 0, Math.PI * 2)
  } else if (shape === "square") {
    ctx.roundRect(x - size, y - size, size * 2, size * 2, 6)
  } else if (shape === "triangle") {
    ctx.moveTo(x, y - size)
    ctx.lineTo(x - size, y + size * 0.7)
    ctx.lineTo(x + size, y + size * 0.7)
    ctx.closePath()
  } else if (shape === "star") {
    for (let i = 0; i < 5; i++) {
      const outerA = (i / 5) * Math.PI * 2 - Math.PI / 2
      const innerA = outerA + Math.PI / 5
      if (i === 0) ctx.moveTo(x + Math.cos(outerA) * size, y + Math.sin(outerA) * size)
      else ctx.lineTo(x + Math.cos(outerA) * size, y + Math.sin(outerA) * size)
      ctx.lineTo(x + Math.cos(innerA) * size * 0.45, y + Math.sin(innerA) * size * 0.45)
    }
    ctx.closePath()
  } else if (shape === "heart") {
    const s = size
    ctx.moveTo(x, y + s * 0.4)
    ctx.bezierCurveTo(x, y - s * 0.1, x - s, y - s * 0.6, x - s, y)
    ctx.bezierCurveTo(x - s, y + s * 0.3, x, y + s * 0.7, x, y + s)
    ctx.bezierCurveTo(x, y + s * 0.7, x + s, y + s * 0.3, x + s, y)
    ctx.bezierCurveTo(x + s, y - s * 0.6, x, y - s * 0.1, x, y + s * 0.4)
  } else if (shape === "diamond") {
    ctx.moveTo(x, y - size)
    ctx.lineTo(x + size * 0.6, y)
    ctx.lineTo(x, y + size)
    ctx.lineTo(x - size * 0.6, y)
    ctx.closePath()
  } else if (shape === "hexagon") {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      const px = x + Math.cos(a) * size
      const py = y + Math.sin(a) * size
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
  } else if (shape === "cross") {
    const arm = size * 0.35
    ctx.moveTo(x - arm, y - size)
    ctx.lineTo(x + arm, y - size)
    ctx.lineTo(x + arm, y - arm)
    ctx.lineTo(x + size, y - arm)
    ctx.lineTo(x + size, y + arm)
    ctx.lineTo(x + arm, y + arm)
    ctx.lineTo(x + arm, y + size)
    ctx.lineTo(x - arm, y + size)
    ctx.lineTo(x - arm, y + arm)
    ctx.lineTo(x - size, y + arm)
    ctx.lineTo(x - size, y - arm)
    ctx.lineTo(x - arm, y - arm)
    ctx.closePath()
  }
}

function drawShapeFilled(ctx, x, y, size, shape, color) {
  ctx.beginPath()
  buildShapePath(ctx, x, y, size, shape)
  ctx.fillStyle = color
  ctx.fill()
}

function drawShapeStroke(ctx, x, y, size, shape, color, alpha, lineWidth) {
  ctx.globalAlpha = alpha
  ctx.beginPath()
  buildShapePath(ctx, x, y, size, shape)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawSparkle(ctx, x, y, size) {
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  // 4-point sparkle
  ctx.moveTo(x, y - size)
  ctx.quadraticCurveTo(x + size * 0.15, y - size * 0.15, x + size, y)
  ctx.quadraticCurveTo(x + size * 0.15, y + size * 0.15, x, y + size)
  ctx.quadraticCurveTo(x - size * 0.15, y + size * 0.15, x - size, y)
  ctx.quadraticCurveTo(x - size * 0.15, y - size * 0.15, x, y - size)
  ctx.fill()
}

function drawStarShape(ctx, x, y, size, color) {
  ctx.fillStyle = color
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

function hexToRgb(hex) {
  const num = parseInt(hex.slice(1), 16)
  return `${(num >> 16) & 0xff},${(num >> 8) & 0xff},${num & 0xff}`
}
