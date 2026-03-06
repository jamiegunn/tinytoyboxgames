import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler, dragHandler, dragEndHandler
let slots = []
let pieces = []
let dragging = null
let dragX = 0, dragY = 0
let score = 0
let complete = false
let completeTimer = 0

const SNAP_DIST = 60

const SHAPE_DEFS = {
  circle:   { color: "#ff6b6b", draw: drawCircle, drawOutline: drawCircleOutline },
  square:   { color: "#54a0ff", draw: drawSquare, drawOutline: drawSquareOutline },
  triangle: { color: "#26de81", draw: drawTriangle, drawOutline: drawTriangleOutline },
  star:     { color: "#feca57", draw: drawStar, drawOutline: drawStarOutline },
  heart:    { color: "#ff9ff3", draw: drawHeart, drawOutline: drawHeartOutline },
  diamond:  { color: "#ff9f43", draw: drawDiamond, drawOutline: drawDiamondOutline },
}

const PUZZLES = [
  // house
  { name: "house", slots: [
    { shape: "square",   x: 0.5,  y: 0.55, size: 80 },
    { shape: "triangle", x: 0.5,  y: 0.35, size: 70 },
    { shape: "circle",   x: 0.5,  y: 0.58, size: 25 },
  ]},
  // face
  { name: "face", slots: [
    { shape: "circle",   x: 0.5,  y: 0.42, size: 80 },
    { shape: "circle",   x: 0.42, y: 0.38, size: 20 },
    { shape: "circle",   x: 0.58, y: 0.38, size: 20 },
    { shape: "heart",    x: 0.5,  y: 0.48, size: 20 },
  ]},
  // rocket
  { name: "rocket", slots: [
    { shape: "square",   x: 0.5,  y: 0.48, size: 60 },
    { shape: "triangle", x: 0.5,  y: 0.32, size: 55 },
    { shape: "diamond",  x: 0.38, y: 0.6,  size: 30 },
    { shape: "diamond",  x: 0.62, y: 0.6,  size: 30 },
  ]},
  // crown
  { name: "crown", slots: [
    { shape: "square",   x: 0.5,  y: 0.5,  size: 70 },
    { shape: "triangle", x: 0.38, y: 0.38, size: 35 },
    { shape: "triangle", x: 0.5,  y: 0.35, size: 35 },
    { shape: "triangle", x: 0.62, y: 0.38, size: 35 },
    { shape: "star",     x: 0.5,  y: 0.45, size: 25 },
  ]},
  // flower
  { name: "flower", slots: [
    { shape: "circle",   x: 0.5,  y: 0.4,  size: 30 },
    { shape: "heart",    x: 0.5,  y: 0.3,  size: 28 },
    { shape: "heart",    x: 0.42, y: 0.35, size: 28 },
    { shape: "heart",    x: 0.58, y: 0.35, size: 28 },
    { shape: "heart",    x: 0.44, y: 0.46, size: 28 },
    { shape: "heart",    x: 0.56, y: 0.46, size: 28 },
  ]},
]

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    score = 0
    complete = false

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
    slots = []
    pieces = []
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight

    if (complete) {
      completeTimer += dt
      if (completeTimer > 2) {
        score++
        setupPuzzle()
      }
    }
  },

  render() {
    // background
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, "#f0e6ff")
    bg.addColorStop(1, "#e0d4f0")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // target area background
    ctx.fillStyle = "rgba(255,255,255,0.3)"
    ctx.beginPath()
    ctx.roundRect(w * 0.1, h * 0.08, w * 0.8, h * 0.58, 20)
    ctx.fill()

    // draw slot outlines
    slots.forEach(s => {
      if (s.filled) {
        // draw solid filled shape
        const def = SHAPE_DEFS[s.shape]
        def.draw(ctx, s.x, s.y, s.size, def.color)
      } else {
        // draw dashed outline
        const def = SHAPE_DEFS[s.shape]
        def.drawOutline(ctx, s.x, s.y, s.size, def.color)
      }
    })

    // piece tray background
    ctx.fillStyle = "rgba(0,0,0,0.06)"
    ctx.beginPath()
    ctx.roundRect(w * 0.05, h * 0.72, w * 0.9, h * 0.24, 16)
    ctx.fill()

    // draw pieces (not being dragged)
    pieces.forEach(p => {
      if (p === dragging) return
      const def = SHAPE_DEFS[p.shape]
      ctx.globalAlpha = 0.9
      def.draw(ctx, p.x, p.y, p.size, def.color)
      ctx.globalAlpha = 1
      // shadow
      ctx.beginPath()
      ctx.ellipse(p.x, p.y + p.size * 0.6, p.size * 0.4, 4, 0, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(0,0,0,0.08)"
      ctx.fill()
    })

    // draw dragged piece on top
    if (dragging) {
      const def = SHAPE_DEFS[dragging.shape]
      // drop shadow
      ctx.globalAlpha = 0.15
      def.draw(ctx, dragX + 4, dragY + 4, dragging.size, "#000")
      ctx.globalAlpha = 1
      def.draw(ctx, dragX, dragY, dragging.size, def.color)
    }

    // score
    ctx.fillStyle = "rgba(80,50,120,0.6)"
    ctx.font = "bold 26px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2, 16)

    if (complete) {
      ctx.font = "bold 30px sans-serif"
      ctx.fillStyle = "#26de81"
      ctx.fillText("Complete!", w / 2, h * 0.68)
    }

    if (score === 0 && !dragging && pieces.length > 0) {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(80,50,120,0.4)"
      ctx.fillText("Drag shapes to the outlines!", w / 2, h * 0.68)
    }
  }
}

function setupPuzzle() {
  complete = false
  completeTimer = 0

  const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)]

  // build slots with absolute positions
  slots = puzzle.slots.map(s => ({
    shape: s.shape,
    x: s.x * w,
    y: s.y * h,
    size: s.size,
    filled: false
  }))

  // build pieces for each slot, arranged in the tray
  const trayY = h * 0.84
  const shuffled = [...slots].sort(() => Math.random() - 0.5)
  const spacing = w / (shuffled.length + 1)

  pieces = shuffled.map((s, i) => ({
    shape: s.shape,
    x: spacing * (i + 1),
    y: trayY + (Math.random() - 0.5) * 20,
    homeX: spacing * (i + 1),
    homeY: trayY,
    size: s.size * 0.8,
    slotIndex: slots.indexOf(slots.find(sl => sl.shape === s.shape && !sl._claimed))
  }))

  // assign each piece to a unique slot
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

  // pick up piece
  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i]
    const dx = p.x - x
    const dy = p.y - y
    if (Math.sqrt(dx * dx + dy * dy) < p.size + 20) {
      dragging = p
      dragX = p.x
      dragY = p.y
      return
    }
  }
}

function handleDragMove(x, y) {
  if (!dragging) return
  dragX = x
  dragY = y
}

function handleDragEnd() {
  if (!dragging) return

  // check if near the correct slot
  const slot = slots[dragging.slotIndex]
  const dx = dragX - slot.x
  const dy = dragY - slot.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < SNAP_DIST) {
    // snap!
    slot.filled = true
    pieces = pieces.filter(p => p !== dragging)
    celebrate()

    // check if all slots filled
    if (slots.every(s => s.filled)) {
      complete = true
      completeTimer = 0
      celebrateBig()
    }
  } else {
    // return to tray
    dragging.x = dragging.homeX
    dragging.y = dragging.homeY
  }

  dragging = null
}

// --- Shape draw functions ---

function drawCircle(ctx, x, y, size, color) {
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

function drawCircleOutline(ctx, x, y, size, color) {
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.setLineDash([])
}

function drawSquare(ctx, x, y, size, color) {
  ctx.beginPath()
  ctx.roundRect(x - size, y - size, size * 2, size * 2, 6)
  ctx.fillStyle = color
  ctx.fill()
}

function drawSquareOutline(ctx, x, y, size, color) {
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.roundRect(x - size, y - size, size * 2, size * 2, 6)
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.setLineDash([])
}

function drawTriangle(ctx, x, y, size, color) {
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.lineTo(x - size, y + size * 0.7)
  ctx.lineTo(x + size, y + size * 0.7)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function drawTriangleOutline(ctx, x, y, size, color) {
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.lineTo(x - size, y + size * 0.7)
  ctx.lineTo(x + size, y + size * 0.7)
  ctx.closePath()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.setLineDash([])
}

function drawStar(ctx, x, y, size, color) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const outerA = (i / 5) * Math.PI * 2 - Math.PI / 2
    const innerA = outerA + Math.PI / 5
    const ox = x + Math.cos(outerA) * size
    const oy = y + Math.sin(outerA) * size
    const ix = x + Math.cos(innerA) * size * 0.45
    const iy = y + Math.sin(innerA) * size * 0.45
    if (i === 0) ctx.moveTo(ox, oy)
    else ctx.lineTo(ox, oy)
    ctx.lineTo(ix, iy)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function drawStarOutline(ctx, x, y, size, color) {
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const outerA = (i / 5) * Math.PI * 2 - Math.PI / 2
    const innerA = outerA + Math.PI / 5
    const ox = x + Math.cos(outerA) * size
    const oy = y + Math.sin(outerA) * size
    const ix = x + Math.cos(innerA) * size * 0.45
    const iy = y + Math.sin(innerA) * size * 0.45
    if (i === 0) ctx.moveTo(ox, oy)
    else ctx.lineTo(ox, oy)
    ctx.lineTo(ix, iy)
  }
  ctx.closePath()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.setLineDash([])
}

function drawHeart(ctx, x, y, size, color) {
  const s = size
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.4)
  ctx.bezierCurveTo(x, y - s * 0.1, x - s, y - s * 0.6, x - s, y)
  ctx.bezierCurveTo(x - s, y + s * 0.3, x, y + s * 0.7, x, y + s)
  ctx.bezierCurveTo(x, y + s * 0.7, x + s, y + s * 0.3, x + s, y)
  ctx.bezierCurveTo(x + s, y - s * 0.6, x, y - s * 0.1, x, y + s * 0.4)
  ctx.fill()
}

function drawHeartOutline(ctx, x, y, size, color) {
  const s = size
  ctx.setLineDash([6, 5])
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.4)
  ctx.bezierCurveTo(x, y - s * 0.1, x - s, y - s * 0.6, x - s, y)
  ctx.bezierCurveTo(x - s, y + s * 0.3, x, y + s * 0.7, x, y + s)
  ctx.bezierCurveTo(x, y + s * 0.7, x + s, y + s * 0.3, x + s, y)
  ctx.bezierCurveTo(x + s, y - s * 0.6, x, y - s * 0.1, x, y + s * 0.4)
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.setLineDash([])
}

function drawDiamond(ctx, x, y, size, color) {
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.lineTo(x + size * 0.6, y)
  ctx.lineTo(x, y + size)
  ctx.lineTo(x - size * 0.6, y)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function drawDiamondOutline(ctx, x, y, size, color) {
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.lineTo(x + size * 0.6, y)
  ctx.lineTo(x, y + size)
  ctx.lineTo(x - size * 0.6, y)
  ctx.closePath()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.setLineDash([])
}
