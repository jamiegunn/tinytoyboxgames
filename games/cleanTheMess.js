import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let dragHandler, tapHandler
let shapes = []
let score = 0
let sparkles = []
let time = 0
let allClean = false

const BRUSH_RADIUS = 50

const SHAPE_TYPES = [
  { name: "sun", draw: drawSun, color: "#feca57" },
  { name: "star", draw: drawStar, color: "#feca57" },
  { name: "fish", draw: drawFish, color: "#54a0ff" },
  { name: "flower", draw: drawFlower, color: "#ff6b6b" },
  { name: "heart", draw: drawHeart, color: "#ff6b6b" },
  { name: "moon", draw: drawMoon, color: "#f0e6b8" },
  { name: "cloud", draw: drawCloud, color: "#b8dce6" },
  { name: "tree", draw: drawTree, color: "#26de81" },
]

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    score = 0
    sparkles = []
    time = 0

    setupRound()

    dragHandler = handleDrag
    tapHandler = handleTap
    input.onDragMove(dragHandler)
    input.onTap(tapHandler)
  },

  destroy() {
    input.offDragMove(dragHandler)
    input.offTap(tapHandler)
    shapes.forEach(s => { s.dirtyCanvas = null; s.dirtyCtx = null })
    shapes = []
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight
    time += dt

    sparkles.forEach(s => {
      s.life -= dt * 2
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 40 * dt
    })
    sparkles = sparkles.filter(s => s.life > 0)
  },

  render() {
    // background
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, "#e8f4f8")
    bg.addColorStop(1, "#d0e8f0")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // draw each shape
    shapes.forEach(s => {
      // hidden picture underneath
      s.type.draw(ctx, s.x, s.y, s.size)

      // dirty overlay on top
      if (s.dirtyCanvas && !s.revealed) {
        ctx.drawImage(s.dirtyCanvas, s.dx, s.dy)
      }

      // outline hint (subtle dashed border around the dirty area)
      if (!s.revealed) {
        ctx.setLineDash([6, 6])
        ctx.strokeStyle = "rgba(0,0,0,0.1)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size + 8, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // checkmark on revealed shapes
      if (s.revealed) {
        ctx.beginPath()
        ctx.arc(s.x + s.size * 0.6, s.y - s.size * 0.6, 14, 0, Math.PI * 2)
        ctx.fillStyle = "#26de81"
        ctx.fill()
        ctx.strokeStyle = "#fff"
        ctx.lineWidth = 3
        ctx.lineCap = "round"
        ctx.beginPath()
        ctx.moveTo(s.x + s.size * 0.6 - 5, s.y - s.size * 0.6)
        ctx.lineTo(s.x + s.size * 0.6 - 1, s.y - s.size * 0.6 + 4)
        ctx.lineTo(s.x + s.size * 0.6 + 6, s.y - s.size * 0.6 - 4)
        ctx.stroke()
      }
    })

    // sparkles
    sparkles.forEach(s => {
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${s.life})`
      ctx.fill()
    })

    // progress: shapes found
    const found = shapes.filter(s => s.revealed).length
    const total = shapes.length
    ctx.fillStyle = "rgba(0,0,0,0.45)"
    ctx.font = "bold 26px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(`${found} / ${total}`, w / 2, 16)

    // round score
    ctx.font = "18px sans-serif"
    ctx.fillStyle = "rgba(0,0,0,0.3)"
    ctx.fillText(`Round ${score + 1}`, w / 2, 48)

    if (allClean) {
      ctx.font = "bold 28px sans-serif"
      ctx.fillStyle = "#26de81"
      ctx.fillText("All clean! Tap for more!", w / 2, h - 40)
    }
  }
}

function setupRound() {
  allClean = false
  shapes = []

  const count = 3 + Math.min(2, Math.floor(score / 2)) // 3-5 shapes
  const shuffled = [...SHAPE_TYPES].sort(() => Math.random() - 0.5)
  const picked = shuffled.slice(0, count)

  // place shapes in a grid-like layout with some randomness
  const cols = Math.min(count, 3)
  const rows = Math.ceil(count / cols)
  const cellW = w / (cols + 1)
  const cellH = (h - 120) / (rows + 1)
  const shapeSize = Math.min(cellW, cellH) * 0.35
  const dirtyPad = 20

  picked.forEach((type, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = cellW * (col + 1) + (Math.random() - 0.5) * cellW * 0.2
    const cy = 90 + cellH * (row + 0.5) + (Math.random() - 0.5) * cellH * 0.2

    // create a small dirty canvas covering just this shape
    const dirtSize = (shapeSize + dirtyPad) * 2
    const dirtyCanvas = document.createElement("canvas")
    dirtyCanvas.width = dirtSize
    dirtyCanvas.height = dirtSize
    const dirtyCtx = dirtyCanvas.getContext("2d")

    // fill with splotchy mess
    const messColors = ["#8B7355", "#A0896C", "#96805A", "#7A6B50", "#B8A88A"]
    dirtyCtx.beginPath()
    dirtyCtx.arc(dirtSize / 2, dirtSize / 2, dirtSize / 2, 0, Math.PI * 2)
    dirtyCtx.fillStyle = "#9a8a6a"
    dirtyCtx.fill()

    for (let j = 0; j < 15; j++) {
      const sx = Math.random() * dirtSize
      const sy = Math.random() * dirtSize
      const sr = 15 + Math.random() * 30
      dirtyCtx.beginPath()
      dirtyCtx.arc(sx, sy, sr, 0, Math.PI * 2)
      dirtyCtx.fillStyle = messColors[Math.floor(Math.random() * messColors.length)]
      dirtyCtx.globalAlpha = 0.3 + Math.random() * 0.4
      dirtyCtx.fill()
    }
    dirtyCtx.globalAlpha = 1

    shapes.push({
      type,
      x: cx,
      y: cy,
      size: shapeSize,
      dx: cx - dirtSize / 2,
      dy: cy - dirtSize / 2,
      dirtyCanvas,
      dirtyCtx,
      dirtSize,
      revealed: false,
      halfCelebrated: false
    })
  })
}

function handleDrag(x, y) {
  if (allClean) return

  shapes.forEach(s => {
    if (s.revealed) return

    // check if brush is near this shape
    const localX = x - s.dx
    const localY = y - s.dy

    if (localX < -BRUSH_RADIUS || localX > s.dirtSize + BRUSH_RADIUS) return
    if (localY < -BRUSH_RADIUS || localY > s.dirtSize + BRUSH_RADIUS) return

    // erase
    s.dirtyCtx.globalCompositeOperation = "destination-out"
    s.dirtyCtx.beginPath()
    s.dirtyCtx.arc(localX, localY, BRUSH_RADIUS, 0, Math.PI * 2)
    s.dirtyCtx.fill()
    s.dirtyCtx.globalCompositeOperation = "source-over"

    // check progress for this shape
    checkShapeProgress(s)
  })

  // sparkles
  for (let i = 0; i < 2; i++) {
    sparkles.push({
      x: x + (Math.random() - 0.5) * BRUSH_RADIUS,
      y: y + (Math.random() - 0.5) * BRUSH_RADIUS,
      vx: (Math.random() - 0.5) * 60,
      vy: -20 - Math.random() * 40,
      size: 2 + Math.random() * 3,
      life: 1
    })
  }
}

function handleTap(x, y) {
  if (allClean) {
    score++
    setupRound()
  }
}

function checkShapeProgress(s) {
  const data = s.dirtyCtx.getImageData(0, 0, s.dirtSize, s.dirtSize).data
  let cleared = 0
  const step = 20
  const total = data.length / 4
  for (let i = 0; i < total; i += step) {
    if (data[i * 4 + 3] === 0) cleared++
  }
  const progress = cleared / (total / step)

  if (progress > 0.5 && !s.halfCelebrated) {
    s.halfCelebrated = true
    celebrate()
  }

  if (progress > 0.7 && !s.revealed) {
    s.revealed = true
    s.dirtyCtx.clearRect(0, 0, s.dirtSize, s.dirtSize)
    celebrate()

    // check if all shapes are revealed
    if (shapes.every(sh => sh.revealed)) {
      allClean = true
      celebrateBig()
    }
  }
}

// --- Shape drawings ---

function drawSun(ctx, x, y, size) {
  ctx.strokeStyle = "#feca57"
  ctx.lineWidth = size * 0.08
  ctx.lineCap = "round"
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(angle) * size * 0.5, y + Math.sin(angle) * size * 0.5)
    ctx.lineTo(x + Math.cos(angle) * size * 0.85, y + Math.sin(angle) * size * 0.85)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(x, y, size * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = "#feca57"
  ctx.fill()
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.arc(x - size * 0.12, y - size * 0.08, size * 0.04, 0, Math.PI * 2)
  ctx.arc(x + size * 0.12, y - size * 0.08, size * 0.04, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y + size * 0.04, size * 0.15, 0.1 * Math.PI, 0.9 * Math.PI)
  ctx.strokeStyle = "#222"
  ctx.lineWidth = size * 0.03
  ctx.stroke()
}

function drawStar(ctx, x, y, size) {
  ctx.fillStyle = "#feca57"
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
}

function drawFish(ctx, x, y, size) {
  ctx.beginPath()
  ctx.ellipse(x, y, size * 0.6, size * 0.35, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#54a0ff"
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.5, y)
  ctx.lineTo(x + size * 0.85, y - size * 0.25)
  ctx.lineTo(x + size * 0.85, y + size * 0.25)
  ctx.closePath()
  ctx.fillStyle = "#48dbfb"
  ctx.fill()
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(x - size * 0.25, y - size * 0.05, size * 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.arc(x - size * 0.23, y - size * 0.05, size * 0.05, 0, Math.PI * 2)
  ctx.fill()
}

function drawFlower(ctx, x, y, size) {
  const petalColors = ["#ff6b6b", "#ff9ff3", "#ff6b6b", "#ff9ff3", "#ff6b6b"]
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const px = x + Math.cos(angle) * size * 0.3
    const py = y + Math.sin(angle) * size * 0.3
    ctx.beginPath()
    ctx.arc(px, py, size * 0.25, 0, Math.PI * 2)
    ctx.fillStyle = petalColors[i]
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(x, y, size * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = "#feca57"
  ctx.fill()
}

function drawHeart(ctx, x, y, size) {
  const s = size * 0.8
  ctx.fillStyle = "#ff6b6b"
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y - s * 0.1, x - s * 0.6, y - s * 0.4, x - s * 0.6, y - s * 0.1)
  ctx.bezierCurveTo(x - s * 0.6, y + s * 0.15, x, y + s * 0.5, x, y + s * 0.7)
  ctx.bezierCurveTo(x, y + s * 0.5, x + s * 0.6, y + s * 0.15, x + s * 0.6, y - s * 0.1)
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.4, x, y - s * 0.1, x, y + s * 0.3)
  ctx.fill()
}

function drawMoon(ctx, x, y, size) {
  ctx.beginPath()
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = "#f0e6b8"
  ctx.fill()
  // crescent cutout
  ctx.beginPath()
  ctx.arc(x + size * 0.2, y - size * 0.1, size * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = "#e8f4f8"
  ctx.fill()
}

function drawCloud(ctx, x, y, size) {
  ctx.fillStyle = "#b8dce6"
  ctx.beginPath()
  ctx.arc(x, y, size * 0.3, 0, Math.PI * 2)
  ctx.arc(x - size * 0.3, y + size * 0.05, size * 0.22, 0, Math.PI * 2)
  ctx.arc(x + size * 0.3, y + size * 0.05, size * 0.25, 0, Math.PI * 2)
  ctx.arc(x + size * 0.15, y - size * 0.15, size * 0.22, 0, Math.PI * 2)
  ctx.fill()
}

function drawTree(ctx, x, y, size) {
  // trunk
  ctx.fillStyle = "#8b6914"
  ctx.fillRect(x - size * 0.08, y + size * 0.1, size * 0.16, size * 0.5)
  // foliage
  ctx.beginPath()
  ctx.moveTo(x, y - size * 0.6)
  ctx.lineTo(x - size * 0.45, y + size * 0.15)
  ctx.lineTo(x + size * 0.45, y + size * 0.15)
  ctx.closePath()
  ctx.fillStyle = "#26de81"
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x, y - size * 0.9)
  ctx.lineTo(x - size * 0.3, y - size * 0.25)
  ctx.lineTo(x + size * 0.3, y - size * 0.25)
  ctx.closePath()
  ctx.fillStyle = "#34a853"
  ctx.fill()
}
