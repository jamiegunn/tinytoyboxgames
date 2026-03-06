import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler, dragHandler
let balloons = []
let launched = []
let score = 0
let time = 0
let clouds = []
let grabId = null
let grabStartY = 0
let grabCurrentY = 0

const COLORS = [
  "#ff6b6b", "#54a0ff", "#feca57", "#26de81", "#a55eea",
  "#ff9ff3", "#ff9f43", "#48dbfb"
]

const BALLOON_W = 55
const BALLOON_H = 68

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    score = 0
    time = 0
    balloons = []
    launched = []
    grabId = null

    clouds = []
    for (let i = 0; i < 4; i++) {
      clouds.push({
        x: Math.random() * w,
        y: 40 + Math.random() * 120,
        r: 20 + Math.random() * 25,
        speed: 6 + Math.random() * 10
      })
    }

    spawnRow()

    tapHandler = handleTap
    dragHandler = handleDrag
    input.onTap(tapHandler)
    input.onDragMove(dragHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    input.offDragMove(dragHandler)
    balloons = []
    launched = []
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight
    time += dt

    // launched balloons float up
    launched.forEach(b => {
      b.y -= b.speed * dt
      b.wobble += dt * 3
      b.x += Math.sin(b.wobble) * 0.8
      b.speed += 20 * dt
      b.scale = Math.max(0.2, b.scale - dt * 0.15)
    })
    launched = launched.filter(b => b.y + BALLOON_H > -50)

    // balloon being dragged - stretch upward
    if (grabId !== null) {
      const b = balloons.find(b => b.id === grabId)
      if (b) {
        const pull = Math.max(0, grabStartY - grabCurrentY)
        b.stretch = Math.min(1, pull / 150)
      }
    }

    // idle balloons bob
    balloons.forEach(b => {
      if (b.id !== grabId) {
        b.bob += dt * 2
        b.stretch = 0
      }
    })

    // clouds
    clouds.forEach(c => {
      c.x += c.speed * dt
      if (c.x > w + 80) c.x = -80
    })

    // respawn if all gone
    if (balloons.length === 0 && grabId === null) {
      spawnRow()
    }
  },

  render() {
    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, "#4facfe")
    sky.addColorStop(1, "#a8edea")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // clouds
    clouds.forEach(c => {
      ctx.globalAlpha = 0.6
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
      ctx.arc(c.x + c.r * 0.8, c.y - c.r * 0.3, c.r * 0.7, 0, Math.PI * 2)
      ctx.arc(c.x - c.r * 0.6, c.y + c.r * 0.1, c.r * 0.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // ground
    ctx.fillStyle = "#7ec87e"
    ctx.fillRect(0, h - 40, w, 40)
    ctx.fillStyle = "#6bb86b"
    ctx.fillRect(0, h - 40, w, 6)

    // launched balloons (behind idle ones, shrinking)
    launched.forEach(b => {
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.scale(b.scale, b.scale)
      drawBalloon(ctx, 0, 0, b.color, 0, 0)
      ctx.restore()
    })

    // idle balloons
    balloons.forEach(b => {
      const bobY = Math.sin(b.bob) * 4
      const pullY = b.stretch * -40
      drawBalloon(ctx, b.x, b.y + bobY + pullY, b.color, b.stretch, b.id === grabId)
    })

    // score
    ctx.fillStyle = "#fff"
    ctx.font = "bold 30px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2, 16)

    if (score === 0) {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.fillText("Swipe a balloon up!", w / 2, 52)
    }
  }
}

function spawnRow() {
  const count = 3 + Math.floor(Math.random() * 2)
  const spacing = w / (count + 1)
  for (let i = 0; i < count; i++) {
    balloons.push({
      id: Date.now() + i,
      x: spacing * (i + 1),
      y: h - 120 - Math.random() * 40,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      bob: Math.random() * Math.PI * 2,
      stretch: 0
    })
  }
}

function handleTap(x, y) {
  // find tapped balloon
  for (const b of balloons) {
    const dx = b.x - x
    const dy = b.y - y
    if (Math.abs(dx) < BALLOON_W && Math.abs(dy) < BALLOON_H) {
      grabId = b.id
      grabStartY = y
      grabCurrentY = y
      return
    }
  }
}

function handleDrag(x, y) {
  if (grabId === null) return
  grabCurrentY = y

  const pull = grabStartY - y
  // release if pulled up enough
  if (pull > 60) {
    launchBalloon(grabId, pull)
  }
}

function launchBalloon(id, power) {
  const idx = balloons.findIndex(b => b.id === id)
  if (idx === -1) return

  const b = balloons[idx]
  balloons.splice(idx, 1)
  grabId = null

  launched.push({
    x: b.x,
    y: b.y,
    color: b.color,
    speed: 100 + power * 1.5,
    wobble: Math.random() * Math.PI * 2,
    scale: 1
  })

  score++
  celebrate()
  if (score % 10 === 0) celebrateBig()
}

function drawBalloon(ctx, x, y, color, stretch, grabbed) {
  const bw = BALLOON_W / 2
  const bh = BALLOON_H / 2

  // string
  ctx.strokeStyle = "rgba(0,0,0,0.2)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y + bh)
  ctx.quadraticCurveTo(x + 4, y + bh + 25, x - 2, y + bh + 45)
  ctx.stroke()

  // balloon body (oval)
  ctx.save()
  ctx.translate(x, y)
  if (stretch > 0) ctx.scale(1, 1 + stretch * 0.15)

  ctx.beginPath()
  ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // shine
  ctx.beginPath()
  ctx.ellipse(-bw * 0.3, -bh * 0.3, bw * 0.25, bh * 0.2, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.fill()

  // knot
  ctx.beginPath()
  ctx.moveTo(-5, bh)
  ctx.lineTo(0, bh + 8)
  ctx.lineTo(5, bh)
  ctx.fillStyle = color
  ctx.fill()

  ctx.restore()

  // grab indicator
  if (grabbed) {
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = "rgba(255,255,255,0.5)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(x, y, bw + 6, bh + 6, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
}
