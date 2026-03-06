import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let score = 0
let time = 0
let spots = []
let peekers = []
let foundAnim = []
let maxPeekers = 1
let clouds = []

const ANIMALS = [
  { name: "bunny", color: "#f0f0f0", earColor: "#ffb8c6", draw: drawBunny },
  { name: "cat",   color: "#ff9f43", earColor: "#e67e22", draw: drawCat },
  { name: "bear",  color: "#a0522d", earColor: "#8b4513", draw: drawBear },
  { name: "frog",  color: "#26de81", earColor: "#1abc60", draw: drawFrog },
]

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = ctx.canvas.width
    h = ctx.canvas.height
    score = 0
    time = 0
    peekers = []
    foundAnim = []
    maxPeekers = 1

    buildScene()
    spawnPeeker()

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    peekers = []
    foundAnim = []
  },

  update(dt) {
    w = ctx.canvas.width
    h = ctx.canvas.height
    time += dt

    // update peekers
    peekers.forEach(p => {
      p.timer += dt

      if (p.state === "entering") {
        p.peek = Math.min(1, p.peek + dt * 2)
        if (p.peek >= 1) { p.state = "showing"; p.timer = 0 }
      } else if (p.state === "showing") {
        if (p.timer > p.showDuration) { p.state = "leaving"; p.timer = 0 }
      } else if (p.state === "leaving") {
        p.peek = Math.max(0, p.peek - dt * 2)
        if (p.peek <= 0) { p.state = "gone"; p.timer = 0 }
      }
    })

    peekers = peekers.filter(p => p.state !== "gone")

    // spawn new peekers
    const activePeekers = peekers.filter(p => p.state !== "gone").length
    if (activePeekers < maxPeekers && Math.random() < dt * 0.8) {
      spawnPeeker()
    }

    // found animations
    foundAnim.forEach(f => {
      f.t += dt * 3
      f.y = f.startY - 40 * Math.sin(f.t * Math.PI)
    })
    foundAnim = foundAnim.filter(f => f.t < 1)

    // increase difficulty slowly
    if (score >= 5) maxPeekers = 2
    if (score >= 12) maxPeekers = 3

    // clouds
    clouds.forEach(c => { c.x += c.speed * dt })
    clouds.forEach(c => { if (c.x > w + 100) { c.x = -100 } })
  },

  render() {
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6)
    sky.addColorStop(0, "#5bc0eb")
    sky.addColorStop(1, "#9be3f7")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // sun
    ctx.beginPath()
    ctx.arc(80, 70, 40, 0, Math.PI * 2)
    ctx.fillStyle = "#feca57"
    ctx.fill()
    const sunGlow = ctx.createRadialGradient(80, 70, 35, 80, 70, 80)
    sunGlow.addColorStop(0, "rgba(254,202,87,0.2)")
    sunGlow.addColorStop(1, "rgba(254,202,87,0)")
    ctx.fillStyle = sunGlow
    ctx.fillRect(0, 0, 160, 150)

    // clouds
    clouds.forEach(c => {
      ctx.globalAlpha = 0.7
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
      ctx.arc(c.x + c.r * 0.8, c.y - c.r * 0.3, c.r * 0.7, 0, Math.PI * 2)
      ctx.arc(c.x - c.r * 0.6, c.y - c.r * 0.1, c.r * 0.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // hills
    ctx.fillStyle = "#6abf69"
    ctx.beginPath()
    ctx.moveTo(0, h * 0.55)
    ctx.quadraticCurveTo(w * 0.25, h * 0.42, w * 0.5, h * 0.5)
    ctx.quadraticCurveTo(w * 0.75, h * 0.58, w, h * 0.48)
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()

    // grass
    const grass = ctx.createLinearGradient(0, h * 0.55, 0, h)
    grass.addColorStop(0, "#4caf50")
    grass.addColorStop(1, "#388e3c")
    ctx.fillStyle = grass
    ctx.fillRect(0, h * 0.58, w, h * 0.42)

    // draw hiding spots and peekers
    spots.forEach((spot, si) => {
      // check if a peeker is at this spot
      const peeker = peekers.find(p => p.spotIndex === si)

      // draw animal BEHIND the spot (clipped)
      if (peeker && peeker.peek > 0) {
        ctx.save()
        ctx.beginPath()
        // clip region: area beside the hiding spot
        const peekX = spot.x + (peeker.side === "left" ? -peeker.peek * 35 : peeker.peek * 35)
        const peekY = spot.y - 10
        ctx.rect(0, 0, w, h)
        ctx.clip()
        peeker.animal.draw(ctx, peekX, peekY, 30 * peeker.peek)
        ctx.restore()
      }

      // draw the hiding spot on top
      spot.draw(ctx, spot.x, spot.y, spot.size)
    })

    // found animations
    foundAnim.forEach(f => {
      ctx.globalAlpha = 1 - f.t
      f.animal.draw(ctx, f.x, f.y, 30)
      ctx.globalAlpha = 1
    })

    // score
    ctx.fillStyle = "#fff"
    ctx.font = "bold 28px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2, 16)

    if (score === 0) {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.7)"
      ctx.fillText("Find the hiding animals!", w / 2, 52)
    }
  }
}

function buildScene() {
  spots = []
  clouds = []

  const groundY = h * 0.58
  const positions = [
    { xPct: 0.15, yOff: 0 },
    { xPct: 0.40, yOff: -20 },
    { xPct: 0.65, yOff: 10 },
    { xPct: 0.85, yOff: -10 },
    { xPct: 0.30, yOff: 60 },
    { xPct: 0.70, yOff: 50 },
  ]

  const spotTypes = [drawTree, drawRock, drawBush, drawTree, drawBush, drawRock]

  positions.forEach((pos, i) => {
    const size = 50 + Math.random() * 20
    spots.push({
      x: pos.xPct * w,
      y: groundY + pos.yOff,
      size,
      draw: spotTypes[i % spotTypes.length]
    })
  })

  for (let i = 0; i < 3; i++) {
    clouds.push({
      x: Math.random() * w,
      y: 40 + Math.random() * 60,
      r: 20 + Math.random() * 20,
      speed: 8 + Math.random() * 12
    })
  }
}

function spawnPeeker() {
  // pick a spot that doesn't already have a peeker
  const usedSpots = peekers.map(p => p.spotIndex)
  const available = spots.map((_, i) => i).filter(i => !usedSpots.includes(i))
  if (available.length === 0) return

  const spotIndex = available[Math.floor(Math.random() * available.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]

  peekers.push({
    spotIndex,
    animal,
    side: Math.random() < 0.5 ? "left" : "right",
    peek: 0,
    state: "entering",
    timer: 0,
    showDuration: 2 + Math.random() * 1.5
  })
}

function handleTap(x, y) {
  let found = false

  peekers = peekers.filter(p => {
    if (p.state === "gone" || p.peek < 0.3) return true

    const spot = spots[p.spotIndex]
    const peekX = spot.x + (p.side === "left" ? -p.peek * 35 : p.peek * 35)
    const peekY = spot.y - 10

    const dx = peekX - x
    const dy = peekY - y
    if (Math.sqrt(dx * dx + dy * dy) < 50) {
      found = true
      score++

      foundAnim.push({
        x: peekX,
        y: peekY,
        startY: peekY,
        animal: p.animal,
        t: 0
      })

      return false
    }
    return true
  })

  if (found) {
    celebrate()
    if (score % 5 === 0) celebrateBig()
  }
}

// --- Hiding spot drawings ---

function drawTree(ctx, x, y, size) {
  // trunk
  ctx.fillStyle = "#8b6914"
  ctx.fillRect(x - 8, y - 10, 16, size * 0.6)

  // foliage
  ctx.beginPath()
  ctx.moveTo(x, y - size * 1.1)
  ctx.lineTo(x - size * 0.7, y - 5)
  ctx.lineTo(x + size * 0.7, y - 5)
  ctx.closePath()
  ctx.fillStyle = "#2d8a4e"
  ctx.fill()

  // second layer
  ctx.beginPath()
  ctx.moveTo(x, y - size * 1.4)
  ctx.lineTo(x - size * 0.5, y - size * 0.5)
  ctx.lineTo(x + size * 0.5, y - size * 0.5)
  ctx.closePath()
  ctx.fillStyle = "#34a853"
  ctx.fill()
}

function drawRock(ctx, x, y, size) {
  ctx.beginPath()
  ctx.ellipse(x, y, size * 0.6, size * 0.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#8a8a8a"
  ctx.fill()

  // highlight
  ctx.beginPath()
  ctx.ellipse(x - size * 0.15, y - size * 0.12, size * 0.3, size * 0.15, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.12)"
  ctx.fill()
}

function drawBush(ctx, x, y, size) {
  ctx.fillStyle = "#2e9e50"
  ctx.beginPath()
  ctx.arc(x, y - size * 0.25, size * 0.45, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x - size * 0.3, y - size * 0.1, size * 0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + size * 0.3, y - size * 0.1, size * 0.35, 0, Math.PI * 2)
  ctx.fill()

  // darker accents
  ctx.fillStyle = "#268d45"
  ctx.beginPath()
  ctx.arc(x + size * 0.15, y - size * 0.3, size * 0.2, 0, Math.PI * 2)
  ctx.fill()
}

// --- Animal face drawings ---

function drawBunny(ctx, x, y, size) {
  const s = size / 30

  // ears
  ctx.fillStyle = "#f0f0f0"
  ctx.beginPath()
  ctx.ellipse(x - 10 * s, y - 30 * s, 7 * s, 18 * s, -0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + 10 * s, y - 30 * s, 7 * s, 18 * s, 0.15, 0, Math.PI * 2)
  ctx.fill()
  // inner ears
  ctx.fillStyle = "#ffb8c6"
  ctx.beginPath()
  ctx.ellipse(x - 10 * s, y - 30 * s, 4 * s, 12 * s, -0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + 10 * s, y - 30 * s, 4 * s, 12 * s, 0.15, 0, Math.PI * 2)
  ctx.fill()

  // head
  ctx.beginPath()
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2)
  ctx.fillStyle = "#f0f0f0"
  ctx.fill()

  // eyes
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.arc(x - 7 * s, y - 4 * s, 3 * s, 0, Math.PI * 2)
  ctx.arc(x + 7 * s, y - 4 * s, 3 * s, 0, Math.PI * 2)
  ctx.fill()

  // nose
  ctx.fillStyle = "#ffb8c6"
  ctx.beginPath()
  ctx.arc(x, y + 4 * s, 3 * s, 0, Math.PI * 2)
  ctx.fill()
}

function drawCat(ctx, x, y, size) {
  const s = size / 30

  // ears (triangles)
  ctx.fillStyle = "#ff9f43"
  ctx.beginPath()
  ctx.moveTo(x - 16 * s, y - 12 * s)
  ctx.lineTo(x - 10 * s, y - 28 * s)
  ctx.lineTo(x - 2 * s, y - 12 * s)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + 16 * s, y - 12 * s)
  ctx.lineTo(x + 10 * s, y - 28 * s)
  ctx.lineTo(x + 2 * s, y - 12 * s)
  ctx.fill()

  // head
  ctx.beginPath()
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2)
  ctx.fillStyle = "#ff9f43"
  ctx.fill()

  // eyes
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.ellipse(x - 7 * s, y - 3 * s, 3 * s, 4 * s, 0, 0, Math.PI * 2)
  ctx.ellipse(x + 7 * s, y - 3 * s, 3 * s, 4 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  // nose
  ctx.fillStyle = "#e67e22"
  ctx.beginPath()
  ctx.moveTo(x, y + 2 * s)
  ctx.lineTo(x - 3 * s, y + 6 * s)
  ctx.lineTo(x + 3 * s, y + 6 * s)
  ctx.fill()

  // whiskers
  ctx.strokeStyle = "#c0c0c0"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x - 10 * s, y + 3 * s); ctx.lineTo(x - 24 * s, y)
  ctx.moveTo(x - 10 * s, y + 5 * s); ctx.lineTo(x - 24 * s, y + 6 * s)
  ctx.moveTo(x + 10 * s, y + 3 * s); ctx.lineTo(x + 24 * s, y)
  ctx.moveTo(x + 10 * s, y + 5 * s); ctx.lineTo(x + 24 * s, y + 6 * s)
  ctx.stroke()
}

function drawBear(ctx, x, y, size) {
  const s = size / 30

  // ears
  ctx.fillStyle = "#a0522d"
  ctx.beginPath()
  ctx.arc(x - 14 * s, y - 16 * s, 8 * s, 0, Math.PI * 2)
  ctx.arc(x + 14 * s, y - 16 * s, 8 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#cd853f"
  ctx.beginPath()
  ctx.arc(x - 14 * s, y - 16 * s, 5 * s, 0, Math.PI * 2)
  ctx.arc(x + 14 * s, y - 16 * s, 5 * s, 0, Math.PI * 2)
  ctx.fill()

  // head
  ctx.beginPath()
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2)
  ctx.fillStyle = "#a0522d"
  ctx.fill()

  // snout
  ctx.beginPath()
  ctx.ellipse(x, y + 5 * s, 10 * s, 7 * s, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#cd853f"
  ctx.fill()

  // eyes
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.arc(x - 7 * s, y - 4 * s, 3 * s, 0, Math.PI * 2)
  ctx.arc(x + 7 * s, y - 4 * s, 3 * s, 0, Math.PI * 2)
  ctx.fill()

  // nose
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.ellipse(x, y + 2 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawFrog(ctx, x, y, size) {
  const s = size / 30

  // head
  ctx.beginPath()
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2)
  ctx.fillStyle = "#26de81"
  ctx.fill()

  // eye bumps
  ctx.fillStyle = "#26de81"
  ctx.beginPath()
  ctx.arc(x - 12 * s, y - 16 * s, 10 * s, 0, Math.PI * 2)
  ctx.arc(x + 12 * s, y - 16 * s, 10 * s, 0, Math.PI * 2)
  ctx.fill()

  // eyes
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(x - 12 * s, y - 16 * s, 7 * s, 0, Math.PI * 2)
  ctx.arc(x + 12 * s, y - 16 * s, 7 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#222"
  ctx.beginPath()
  ctx.arc(x - 12 * s, y - 16 * s, 4 * s, 0, Math.PI * 2)
  ctx.arc(x + 12 * s, y - 16 * s, 4 * s, 0, Math.PI * 2)
  ctx.fill()

  // smile
  ctx.beginPath()
  ctx.arc(x, y + 4 * s, 10 * s, 0.1 * Math.PI, 0.9 * Math.PI)
  ctx.strokeStyle = "#1a9960"
  ctx.lineWidth = 2 * s
  ctx.stroke()
}
