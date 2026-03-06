import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let flies = []
let caught = []
let score = 0
let spawnTimer = 0
let stars = []
let time = 0

const HIT_RADIUS = 45
const FLY_RADIUS = 8
const GLOW_RADIUS = 28
const JAR_W = 80
const JAR_H = 110
const MAX_JAR = 20

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    flies = []
    caught = []
    score = 0
    spawnTimer = 0
    time = 0

    // static stars
    stars = []
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.6,
        r: 0.5 + Math.random() * 1.5,
        flicker: Math.random() * Math.PI * 2
      })
    }

    for (let i = 0; i < 4; i++) spawnFly()

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    flies = []
    caught = []
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight
    time += dt

    // drift fireflies in gentle curves
    flies.forEach(f => {
      f.angle += f.turnSpeed * dt
      f.x += Math.cos(f.angle) * f.speed * dt
      f.y += Math.sin(f.angle) * f.speed * dt

      // soft bounce off edges
      const pad = 30
      if (f.x < pad) { f.x = pad; f.angle = Math.PI - f.angle }
      if (f.x > w - pad) { f.x = w - pad; f.angle = Math.PI - f.angle }
      if (f.y < pad) { f.y = pad; f.angle = -f.angle }
      if (f.y > h - JAR_H - 60) { f.y = h - JAR_H - 60; f.angle = -f.angle }

      f.glowPhase += dt * 2
    })

    // animate caught flies toward jar
    caught = caught.filter(c => {
      c.t += dt * 3
      if (c.t >= 1) return false
      c.x = c.startX + (c.targetX - c.startX) * c.t
      c.y = c.startY + (c.targetY - c.startY) * c.t - 60 * Math.sin(c.t * Math.PI)
      return true
    })

    // spawn more
    spawnTimer += dt
    if (spawnTimer > 1.5 && flies.length < 6) {
      spawnTimer = 0
      spawnFly()
    }
  },

  render() {
    // night sky
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, "#0a0e27")
    bg.addColorStop(0.5, "#141938")
    bg.addColorStop(1, "#1a1f3a")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // moon
    ctx.beginPath()
    ctx.arc(w - 70, 70, 35, 0, Math.PI * 2)
    ctx.fillStyle = "#f0e6b8"
    ctx.globalAlpha = 0.8
    ctx.fill()
    ctx.globalAlpha = 1
    // moon glow
    const moonGlow = ctx.createRadialGradient(w - 70, 70, 30, w - 70, 70, 90)
    moonGlow.addColorStop(0, "rgba(240,230,184,0.15)")
    moonGlow.addColorStop(1, "rgba(240,230,184,0)")
    ctx.fillStyle = moonGlow
    ctx.fillRect(w - 160, 0, 180, 180)

    // stars
    stars.forEach(s => {
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(time * 1.5 + s.flicker)
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // ground
    const ground = ctx.createLinearGradient(0, h - 50, 0, h)
    ground.addColorStop(0, "#1a2a15")
    ground.addColorStop(1, "#0f1a0d")
    ctx.fillStyle = ground
    ctx.fillRect(0, h - 50, w, 50)

    // grass tufts
    ctx.strokeStyle = "#2a4a20"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    for (let gx = 10; gx < w; gx += 30) {
      const gh = 8 + Math.sin(gx * 0.3) * 5
      ctx.beginPath()
      ctx.moveTo(gx, h - 50)
      ctx.lineTo(gx - 4, h - 50 - gh)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(gx, h - 50)
      ctx.lineTo(gx + 5, h - 50 - gh + 2)
      ctx.stroke()
    }

    // fireflies
    flies.forEach(f => {
      const pulse = 0.5 + 0.5 * Math.sin(f.glowPhase)

      // outer glow
      const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, GLOW_RADIUS)
      glow.addColorStop(0, `rgba(255,240,120,${0.3 * pulse})`)
      glow.addColorStop(1, "rgba(255,240,120,0)")
      ctx.fillStyle = glow
      ctx.fillRect(f.x - GLOW_RADIUS, f.y - GLOW_RADIUS, GLOW_RADIUS * 2, GLOW_RADIUS * 2)

      // core
      ctx.beginPath()
      ctx.arc(f.x, f.y, FLY_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,245,150,${0.6 + 0.4 * pulse})`
      ctx.fill()

      // bright center
      ctx.beginPath()
      ctx.arc(f.x, f.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.fill()
    })

    // caught flies animating to jar
    caught.forEach(c => {
      const alpha = 1 - c.t
      ctx.beginPath()
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,245,150,${alpha})`
      ctx.fill()
    })

    // jar
    const jarX = w / 2 - JAR_W / 2
    const jarY = h - JAR_H - 20

    // jar glow from captured flies
    if (score > 0) {
      const jarGlow = ctx.createRadialGradient(w / 2, jarY + JAR_H / 2, 10, w / 2, jarY + JAR_H / 2, JAR_W)
      const intensity = Math.min(0.2, score * 0.02)
      jarGlow.addColorStop(0, `rgba(255,240,120,${intensity})`)
      jarGlow.addColorStop(1, "rgba(255,240,120,0)")
      ctx.fillStyle = jarGlow
      ctx.fillRect(jarX - 30, jarY - 30, JAR_W + 60, JAR_H + 60)
    }

    // jar body (glass)
    ctx.beginPath()
    ctx.moveTo(jarX + 10, jarY + 16)
    ctx.lineTo(jarX + 4, jarY + JAR_H - 10)
    ctx.quadraticCurveTo(jarX + 4, jarY + JAR_H, jarX + 14, jarY + JAR_H)
    ctx.lineTo(jarX + JAR_W - 14, jarY + JAR_H)
    ctx.quadraticCurveTo(jarX + JAR_W - 4, jarY + JAR_H, jarX + JAR_W - 4, jarY + JAR_H - 10)
    ctx.lineTo(jarX + JAR_W - 10, jarY + 16)
    ctx.closePath()
    ctx.fillStyle = "rgba(180,220,240,0.08)"
    ctx.fill()
    ctx.strokeStyle = "rgba(180,220,240,0.3)"
    ctx.lineWidth = 2
    ctx.stroke()

    // jar lid
    ctx.beginPath()
    ctx.roundRect(jarX + 6, jarY, JAR_W - 12, 18, 4)
    ctx.fillStyle = "rgba(160,140,120,0.5)"
    ctx.fill()
    ctx.strokeStyle = "rgba(160,140,120,0.6)"
    ctx.lineWidth = 1.5
    ctx.stroke()

    // flies inside jar
    const flyCount = Math.min(score, MAX_JAR)
    for (let i = 0; i < flyCount; i++) {
      const seed = i * 137.5
      const fx = jarX + 18 + ((seed * 7.3) % (JAR_W - 36))
      const fy = jarY + 28 + ((seed * 3.7) % (JAR_H - 40))
      const pulse = 0.4 + 0.4 * Math.sin(time * 2 + i * 1.3)

      // tiny glow
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 12)
      g.addColorStop(0, `rgba(255,240,120,${0.2 * pulse})`)
      g.addColorStop(1, "rgba(255,240,120,0)")
      ctx.fillStyle = g
      ctx.fillRect(fx - 12, fy - 12, 24, 24)

      ctx.beginPath()
      ctx.arc(fx, fy, 3, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,245,150,${0.5 + 0.3 * pulse})`
      ctx.fill()
    }

    // jar glass highlight
    ctx.beginPath()
    ctx.moveTo(jarX + 14, jarY + 24)
    ctx.lineTo(jarX + 12, jarY + JAR_H - 20)
    ctx.strokeStyle = "rgba(255,255,255,0.1)"
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.stroke()

    // score
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    ctx.font = "bold 28px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(score, w / 2, 40)
  }
}

function spawnFly() {
  flies.push({
    x: 60 + Math.random() * (window.innerWidth - 120),
    y: 60 + Math.random() * (window.innerHeight - 250),
    angle: Math.random() * Math.PI * 2,
    speed: 25 + Math.random() * 35,
    turnSpeed: (Math.random() - 0.5) * 2,
    glowPhase: Math.random() * Math.PI * 2
  })
}

function handleTap(x, y) {
  let didCatch = false

  flies = flies.filter(f => {
    const dx = f.x - x
    const dy = f.y - y
    const hit = Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS

    if (hit) {
      didCatch = true
      score++

      // animate to jar
      caught.push({
        startX: f.x,
        startY: f.y,
        targetX: w / 2,
        targetY: h - JAR_H / 2 - 20,
        x: f.x,
        y: f.y,
        t: 0
      })
    }

    return !hit
  })

  if (didCatch) {
    celebrate()
    if (score % 5 === 0) celebrateBig()
  }
}
