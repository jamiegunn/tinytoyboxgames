import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let flies = []
let caught = []
let score = 0
let combo = 0, comboTimer = 0
let spawnTimer = 0
let stars = []
let time = 0
let scorePopups = []
let particles = []
let tapRipples = []
let shakeX = 0, shakeY = 0, shakeAmount = 0
let trees = []
let clouds = []
let shootingStars = []
let shootTimer = 0
let jarFlies = []

const COMBO_WINDOW = 3.5
const HIT_RADIUS = 50
const FLY_RADIUS = 7
const GLOW_RADIUS = 32
const JAR_W = 90
const JAR_H = 120
const MAX_JAR = 25

const FLY_COLORS = [
  { core: "#fff5a0", glow: "255,240,120", name: "yellow" },
  { core: "#a0ffc0", glow: "120,255,180", name: "green" },
  { core: "#a0d0ff", glow: "120,180,255", name: "blue" },
  { core: "#ffc0ff", glow: "255,160,255", name: "pink" },
  { core: "#ffe0a0", glow: "255,210,120", name: "amber" }
]

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = ctx.canvas.width
    h = ctx.canvas.height
    flies = []
    caught = []
    score = 0
    combo = 0
    comboTimer = 0
    spawnTimer = 0
    time = 0
    scorePopups = []
    particles = []
    tapRipples = []
    shakeAmount = 0
    shootingStars = []
    shootTimer = 0

    // static stars
    stars = []
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.55,
        r: 0.4 + Math.random() * 1.8,
        flicker: Math.random() * Math.PI * 2,
        twinkleSpeed: 1 + Math.random() * 2
      })
    }

    // silhouette trees
    trees = []
    const treeCount = Math.max(4, Math.floor(w / 120))
    for (let i = 0; i < treeCount; i++) {
      trees.push({
        x: (i / (treeCount - 1)) * w + (Math.random() - 0.5) * 40,
        height: 80 + Math.random() * 100,
        width: 40 + Math.random() * 50,
        type: Math.floor(Math.random() * 3) // pine, round, tall
      })
    }

    // clouds
    clouds = []
    for (let i = 0; i < 4; i++) {
      clouds.push({
        x: Math.random() * w,
        y: 20 + Math.random() * 80,
        w: 80 + Math.random() * 120,
        speed: 3 + Math.random() * 5,
        alpha: 0.03 + Math.random() * 0.04
      })
    }

    // jar flies (bouncing inside jar)
    jarFlies = []

    for (let i = 0; i < 5; i++) spawnFly()

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    flies = []
    caught = []
  },

  update(dt) {
    w = ctx.canvas.width
    h = ctx.canvas.height
    time += dt

    // combo timer
    if (comboTimer > 0) {
      comboTimer -= dt
      if (comboTimer <= 0) { combo = 0; comboTimer = 0 }
    }

    // screen shake decay
    shakeAmount *= Math.pow(0.001, dt)
    if (shakeAmount < 0.3) shakeAmount = 0
    shakeX = (Math.random() - 0.5) * shakeAmount * 2
    shakeY = (Math.random() - 0.5) * shakeAmount * 2

    // drift fireflies in gentle curves
    flies.forEach(f => {
      f.angle += f.turnSpeed * dt
      f.x += Math.cos(f.angle) * f.speed * dt
      f.y += Math.sin(f.angle) * f.speed * dt

      // trail particles
      f.trailTimer -= dt
      if (f.trailTimer <= 0) {
        f.trailTimer = 0.08
        particles.push({
          x: f.x, y: f.y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          size: 1.5 + Math.random() * 2,
          color: f.color.core,
          type: "glow",
          life: 0.3 + Math.random() * 0.3
        })
      }

      // soft bounce off edges
      const pad = 30
      if (f.x < pad) { f.x = pad; f.angle = Math.PI - f.angle }
      if (f.x > w - pad) { f.x = w - pad; f.angle = Math.PI - f.angle }
      if (f.y < pad) { f.y = pad; f.angle = -f.angle }
      if (f.y > h - JAR_H - 80) { f.y = h - JAR_H - 80; f.angle = -f.angle }

      f.glowPhase += dt * (1.5 + f.pulseSpeed)

      // wing flap
      f.wingPhase += dt * 12
    })

    // animate caught flies toward jar
    caught = caught.filter(c => {
      c.t += dt * 2.5
      if (c.t >= 1) {
        // add to jar
        if (jarFlies.length < MAX_JAR) {
          jarFlies.push({
            x: 0.2 + Math.random() * 0.6,
            y: 0.15 + Math.random() * 0.7,
            phase: Math.random() * Math.PI * 2,
            color: c.color,
            speed: 0.5 + Math.random() * 1
          })
        }
        return false
      }
      const ease = 1 - Math.pow(1 - c.t, 3)
      c.x = c.startX + (c.targetX - c.startX) * ease
      c.y = c.startY + (c.targetY - c.startY) * ease - 80 * Math.sin(c.t * Math.PI)
      return true
    })

    // spawn more
    spawnTimer += dt
    const maxFlies = Math.min(8, 4 + Math.floor(score / 5))
    if (spawnTimer > 1.2 && flies.length < maxFlies) {
      spawnTimer = 0
      spawnFly()
    }

    // clouds drift
    clouds.forEach(c => {
      c.x += c.speed * dt
      if (c.x > w + c.w) c.x = -c.w
    })

    // shooting stars
    shootTimer += dt
    if (shootTimer > 4 + Math.random() * 6) {
      shootTimer = 0
      shootingStars.push({
        x: Math.random() * w * 0.8,
        y: Math.random() * h * 0.3,
        vx: 200 + Math.random() * 200,
        vy: 80 + Math.random() * 80,
        life: 0.6 + Math.random() * 0.4,
        size: 1.5 + Math.random()
      })
    }
    shootingStars = shootingStars.filter(s => {
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.life -= dt
      return s.life > 0
    })

    // score popups
    scorePopups = scorePopups.filter(p => {
      p.y -= 45 * dt
      p.life -= dt
      return p.life > 0
    })

    // particles
    particles = particles.filter(p => {
      p.x += (p.vx || 0) * dt
      p.y += (p.vy || 0) * dt
      if (p.type !== "glow") p.vy += 80 * dt
      p.life -= dt
      return p.life > 0
    })

    // tap ripples
    tapRipples = tapRipples.filter(r => {
      r.t += dt * 2
      return r.t < 1
    })

    // jar flies bobble
    jarFlies.forEach(jf => {
      jf.phase += dt * jf.speed
    })
  },

  render() {
    ctx.save()
    ctx.translate(shakeX, shakeY)

    // night sky
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, "#050a1a")
    bg.addColorStop(0.3, "#0c1533")
    bg.addColorStop(0.6, "#141f45")
    bg.addColorStop(1, "#1a2a3a")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // subtle aurora at top
    const aurora = ctx.createLinearGradient(0, 0, w, h * 0.3)
    aurora.addColorStop(0, "rgba(50,200,150,0.02)")
    aurora.addColorStop(0.3, "rgba(80,120,220,0.03)")
    aurora.addColorStop(0.6, "rgba(150,80,200,0.02)")
    aurora.addColorStop(1, "rgba(50,200,150,0.01)")
    ctx.fillStyle = aurora
    ctx.fillRect(0, 0, w, h * 0.4)

    // stars
    stars.forEach(s => {
      const twinkle = 0.25 + 0.45 * Math.sin(time * s.twinkleSpeed + s.flicker)
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.globalAlpha = twinkle
      ctx.fill()

      // star glow
      if (s.r > 1.2) {
        const sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4)
        sg.addColorStop(0, `rgba(200,220,255,${twinkle * 0.15})`)
        sg.addColorStop(1, "rgba(200,220,255,0)")
        ctx.fillStyle = sg
        ctx.fillRect(s.x - s.r * 4, s.y - s.r * 4, s.r * 8, s.r * 8)
      }
    })
    ctx.globalAlpha = 1

    // shooting stars
    shootingStars.forEach(s => {
      const alpha = Math.min(1, s.life * 2)
      ctx.save()
      ctx.globalAlpha = alpha * 0.9
      ctx.strokeStyle = "#fff"
      ctx.lineWidth = s.size
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(s.x - s.vx * 0.08, s.y - s.vy * 0.08)
      ctx.stroke()

      // head glow
      const hg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 8)
      hg.addColorStop(0, `rgba(255,255,255,${alpha * 0.5})`)
      hg.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = hg
      ctx.fillRect(s.x - 8, s.y - 8, 16, 16)

      ctx.restore()
    })

    // clouds
    clouds.forEach(c => {
      ctx.globalAlpha = c.alpha
      ctx.fillStyle = "#8090b0"
      // fluffy cloud shapes
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.w * 0.2, 0, Math.PI * 2)
      ctx.arc(c.x + c.w * 0.2, c.y - c.w * 0.08, c.w * 0.25, 0, Math.PI * 2)
      ctx.arc(c.x + c.w * 0.45, c.y, c.w * 0.2, 0, Math.PI * 2)
      ctx.arc(c.x + c.w * 0.25, c.y + c.w * 0.05, c.w * 0.18, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // moon
    const moonX = w - 80
    const moonY = 75
    const moonR = 38

    // moon glow (large)
    const moonGlowBig = ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 4)
    moonGlowBig.addColorStop(0, "rgba(240,230,184,0.08)")
    moonGlowBig.addColorStop(1, "rgba(240,230,184,0)")
    ctx.fillStyle = moonGlowBig
    ctx.fillRect(moonX - moonR * 4, moonY - moonR * 4, moonR * 8, moonR * 8)

    // moon body
    ctx.beginPath()
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2)
    const moonGrad = ctx.createRadialGradient(moonX - 8, moonY - 8, 0, moonX, moonY, moonR)
    moonGrad.addColorStop(0, "#fff8e0")
    moonGrad.addColorStop(0.7, "#f0e6b8")
    moonGrad.addColorStop(1, "#e0d0a0")
    ctx.fillStyle = moonGrad
    ctx.fill()

    // moon craters
    ctx.globalAlpha = 0.12
    ctx.fillStyle = "#c0b080"
    ctx.beginPath(); ctx.arc(moonX - 10, moonY - 8, 6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(moonX + 8, moonY + 5, 8, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(moonX - 5, moonY + 12, 4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(moonX + 14, moonY - 12, 3, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1

    // rolling hills silhouette
    ctx.fillStyle = "#0a1a10"
    ctx.beginPath()
    ctx.moveTo(0, h - 55)
    for (let x = 0; x <= w; x += 5) {
      const y = h - 55 - Math.sin(x * 0.008) * 30 - Math.sin(x * 0.015 + 2) * 15
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()

    // second hill layer
    ctx.fillStyle = "#0d2015"
    ctx.beginPath()
    ctx.moveTo(0, h - 45)
    for (let x = 0; x <= w; x += 5) {
      const y = h - 45 - Math.sin(x * 0.012 + 1) * 20 - Math.sin(x * 0.02 + 3) * 10
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()

    // trees on hills
    trees.forEach(t => {
      const groundY = h - 50 - Math.sin(t.x * 0.008) * 30 - Math.sin(t.x * 0.015 + 2) * 15
      ctx.fillStyle = "#081510"

      if (t.type === 0) {
        // pine tree
        ctx.beginPath()
        ctx.moveTo(t.x, groundY - t.height)
        ctx.lineTo(t.x - t.width * 0.5, groundY)
        ctx.lineTo(t.x + t.width * 0.5, groundY)
        ctx.closePath()
        ctx.fill()
        // second layer
        ctx.beginPath()
        ctx.moveTo(t.x, groundY - t.height * 0.75)
        ctx.lineTo(t.x - t.width * 0.6, groundY - t.height * 0.15)
        ctx.lineTo(t.x + t.width * 0.6, groundY - t.height * 0.15)
        ctx.closePath()
        ctx.fill()
        // trunk
        ctx.fillRect(t.x - 4, groundY - 10, 8, 12)
      } else if (t.type === 1) {
        // round tree
        ctx.beginPath()
        ctx.arc(t.x, groundY - t.height * 0.6, t.width * 0.55, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(t.x - 5, groundY - t.height * 0.3, 10, t.height * 0.3)
      } else {
        // tall cypress
        ctx.beginPath()
        ctx.ellipse(t.x, groundY - t.height * 0.5, t.width * 0.25, t.height * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(t.x - 3, groundY - 8, 6, 10)
      }
    })

    // ground
    const ground = ctx.createLinearGradient(0, h - 50, 0, h)
    ground.addColorStop(0, "#152a18")
    ground.addColorStop(1, "#0a1a0d")
    ctx.fillStyle = ground
    ctx.fillRect(0, h - 50, w, 50)

    // grass tufts with wind
    ctx.lineCap = "round"
    for (let gx = 8; gx < w; gx += 18) {
      const gh = 8 + Math.sin(gx * 0.3) * 6
      const windSway = Math.sin(time * 1.5 + gx * 0.05) * 2

      ctx.strokeStyle = "#1e3a1a"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(gx, h - 50)
      ctx.quadraticCurveTo(gx + windSway, h - 50 - gh * 0.6, gx - 3 + windSway, h - 50 - gh)
      ctx.stroke()

      ctx.strokeStyle = "#254a22"
      ctx.beginPath()
      ctx.moveTo(gx + 3, h - 50)
      ctx.quadraticCurveTo(gx + 3 + windSway, h - 50 - gh * 0.5, gx + 7 + windSway, h - 50 - gh + 3)
      ctx.stroke()

      // occasional tiny flower
      if (Math.sin(gx * 7.7) > 0.85) {
        ctx.beginPath()
        ctx.arc(gx + windSway, h - 50 - gh - 2, 2, 0, Math.PI * 2)
        ctx.fillStyle = Math.sin(gx * 3.3) > 0 ? "#ffaaaa" : "#aaaaff"
        ctx.globalAlpha = 0.4
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    // tap ripples
    tapRipples.forEach(r => {
      const alpha = (1 - r.t) * 0.4
      const radius = r.t * 50
      ctx.beginPath()
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,240,150,${alpha})`
      ctx.lineWidth = 2 - r.t
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(r.x, r.y, radius * 0.6, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`
      ctx.lineWidth = 1
      ctx.stroke()
    })

    // fireflies
    flies.forEach(f => {
      const pulse = 0.4 + 0.6 * Math.sin(f.glowPhase)

      // outer glow (large, soft)
      const glow2 = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, GLOW_RADIUS * 2)
      glow2.addColorStop(0, `rgba(${f.color.glow},${0.06 * pulse})`)
      glow2.addColorStop(1, `rgba(${f.color.glow},0)`)
      ctx.fillStyle = glow2
      ctx.fillRect(f.x - GLOW_RADIUS * 2, f.y - GLOW_RADIUS * 2, GLOW_RADIUS * 4, GLOW_RADIUS * 4)

      // inner glow
      const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, GLOW_RADIUS)
      glow.addColorStop(0, `rgba(${f.color.glow},${0.35 * pulse})`)
      glow.addColorStop(0.5, `rgba(${f.color.glow},${0.1 * pulse})`)
      glow.addColorStop(1, `rgba(${f.color.glow},0)`)
      ctx.fillStyle = glow
      ctx.fillRect(f.x - GLOW_RADIUS, f.y - GLOW_RADIUS, GLOW_RADIUS * 2, GLOW_RADIUS * 2)

      // wings
      const wingFlap = Math.sin(f.wingPhase) * 0.6
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.globalAlpha = 0.2 + 0.15 * pulse

      // left wing
      ctx.save()
      ctx.rotate(-0.3)
      ctx.scale(1, 0.3 + wingFlap * 0.7)
      ctx.beginPath()
      ctx.ellipse(-6, -2, 8, 5, -0.4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${f.color.glow},0.3)`
      ctx.fill()
      ctx.restore()

      // right wing
      ctx.save()
      ctx.rotate(0.3)
      ctx.scale(1, 0.3 + wingFlap * 0.7)
      ctx.beginPath()
      ctx.ellipse(6, -2, 8, 5, 0.4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${f.color.glow},0.3)`
      ctx.fill()
      ctx.restore()

      ctx.globalAlpha = 1
      ctx.restore()

      // body
      ctx.save()
      ctx.translate(f.x, f.y)

      // dark body (tiny insect body)
      ctx.beginPath()
      ctx.ellipse(0, 0, 3, FLY_RADIUS, Math.atan2(Math.sin(f.angle), Math.cos(f.angle)), 0, Math.PI * 2)
      ctx.fillStyle = "#4a3520"
      ctx.globalAlpha = 0.5
      ctx.fill()
      ctx.globalAlpha = 1

      ctx.restore()

      // glowing abdomen
      ctx.beginPath()
      ctx.arc(f.x, f.y, FLY_RADIUS * 0.8, 0, Math.PI * 2)
      const abdGrad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, FLY_RADIUS * 0.8)
      abdGrad.addColorStop(0, "#fff")
      abdGrad.addColorStop(0.3, f.color.core)
      abdGrad.addColorStop(1, `rgba(${f.color.glow},${0.4 + 0.4 * pulse})`)
      ctx.fillStyle = abdGrad
      ctx.globalAlpha = 0.6 + 0.4 * pulse
      ctx.fill()
      ctx.globalAlpha = 1

      // bright center dot
      ctx.beginPath()
      ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.globalAlpha = 0.7 + 0.3 * pulse
      ctx.fill()
      ctx.globalAlpha = 1

      // rare golden fly sparkle ring
      if (f.rare) {
        ctx.save()
        ctx.translate(f.x, f.y)
        ctx.rotate(time * 2)
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2
          const sr = 14 + Math.sin(time * 3 + i) * 3
          ctx.beginPath()
          ctx.arc(Math.cos(a) * sr, Math.sin(a) * sr, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,215,0,${0.5 + 0.3 * Math.sin(time * 4 + i * 2)})`
          ctx.fill()
        }
        ctx.restore()
      }
    })

    // caught flies animating to jar
    caught.forEach(c => {
      const alpha = 1 - c.t * 0.5
      // trail
      const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 12)
      glow.addColorStop(0, `rgba(${c.color.glow},${0.3 * alpha})`)
      glow.addColorStop(1, `rgba(${c.color.glow},0)`)
      ctx.fillStyle = glow
      ctx.fillRect(c.x - 12, c.y - 12, 24, 24)

      ctx.beginPath()
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = c.color.core
      ctx.globalAlpha = alpha
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // jar
    const jarX = w / 2 - JAR_W / 2
    const jarY = h - JAR_H - 25

    // jar glow from captured flies
    if (score > 0) {
      const jarGlow = ctx.createRadialGradient(w / 2, jarY + JAR_H / 2, 10, w / 2, jarY + JAR_H / 2, JAR_W * 1.2)
      const intensity = Math.min(0.25, score * 0.015)
      jarGlow.addColorStop(0, `rgba(255,240,120,${intensity})`)
      jarGlow.addColorStop(0.5, `rgba(200,255,200,${intensity * 0.3})`)
      jarGlow.addColorStop(1, "rgba(255,240,120,0)")
      ctx.fillStyle = jarGlow
      ctx.fillRect(jarX - 50, jarY - 50, JAR_W + 100, JAR_H + 100)
    }

    // jar body (glass) - nicer shape
    ctx.beginPath()
    ctx.moveTo(jarX + 12, jarY + 20)
    ctx.quadraticCurveTo(jarX + 2, jarY + 30, jarX + 4, jarY + JAR_H - 12)
    ctx.quadraticCurveTo(jarX + 4, jarY + JAR_H + 2, jarX + 18, jarY + JAR_H + 2)
    ctx.lineTo(jarX + JAR_W - 18, jarY + JAR_H + 2)
    ctx.quadraticCurveTo(jarX + JAR_W - 4, jarY + JAR_H + 2, jarX + JAR_W - 4, jarY + JAR_H - 12)
    ctx.quadraticCurveTo(jarX + JAR_W - 2, jarY + 30, jarX + JAR_W - 12, jarY + 20)
    ctx.closePath()
    ctx.fillStyle = "rgba(180,220,240,0.06)"
    ctx.fill()
    ctx.strokeStyle = "rgba(180,220,240,0.25)"
    ctx.lineWidth = 2
    ctx.stroke()

    // jar neck
    ctx.beginPath()
    ctx.moveTo(jarX + 12, jarY + 20)
    ctx.lineTo(jarX + 14, jarY + 10)
    ctx.lineTo(jarX + JAR_W - 14, jarY + 10)
    ctx.lineTo(jarX + JAR_W - 12, jarY + 20)
    ctx.strokeStyle = "rgba(180,220,240,0.2)"
    ctx.lineWidth = 1.5
    ctx.stroke()

    // flies inside jar
    jarFlies.forEach((jf, i) => {
      const bobX = Math.sin(time * jf.speed + jf.phase) * 8
      const bobY = Math.cos(time * jf.speed * 0.7 + jf.phase + 1) * 6
      const fx = jarX + 16 + jf.x * (JAR_W - 32) + bobX
      const fy = jarY + 22 + jf.y * (JAR_H - 30) + bobY
      const pulse = 0.3 + 0.5 * Math.sin(time * 2 + jf.phase)

      // tiny glow
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 10)
      g.addColorStop(0, `rgba(${jf.color.glow},${0.25 * pulse})`)
      g.addColorStop(1, `rgba(${jf.color.glow},0)`)
      ctx.fillStyle = g
      ctx.fillRect(fx - 10, fy - 10, 20, 20)

      ctx.beginPath()
      ctx.arc(fx, fy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = jf.color.core
      ctx.globalAlpha = 0.5 + 0.4 * pulse
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // jar glass highlights
    ctx.beginPath()
    ctx.moveTo(jarX + 16, jarY + 28)
    ctx.quadraticCurveTo(jarX + 12, jarY + JAR_H * 0.5, jarX + 14, jarY + JAR_H - 15)
    ctx.strokeStyle = "rgba(255,255,255,0.08)"
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.stroke()

    // second highlight
    ctx.beginPath()
    ctx.moveTo(jarX + 20, jarY + 30)
    ctx.lineTo(jarX + 18, jarY + 50)
    ctx.strokeStyle = "rgba(255,255,255,0.12)"
    ctx.lineWidth = 2
    ctx.stroke()

    // cork lid with grain
    ctx.beginPath()
    ctx.roundRect(jarX + 10, jarY + 2, JAR_W - 20, 14, 4)
    const corkGrad = ctx.createLinearGradient(0, jarY + 2, 0, jarY + 16)
    corkGrad.addColorStop(0, "rgba(200,170,120,0.7)")
    corkGrad.addColorStop(0.5, "rgba(180,150,100,0.65)")
    corkGrad.addColorStop(1, "rgba(160,130,90,0.6)")
    ctx.fillStyle = corkGrad
    ctx.fill()
    ctx.strokeStyle = "rgba(160,130,90,0.5)"
    ctx.lineWidth = 1
    ctx.stroke()

    // cork grain lines
    ctx.strokeStyle = "rgba(140,110,70,0.2)"
    ctx.lineWidth = 0.5
    for (let cx = jarX + 16; cx < jarX + JAR_W - 16; cx += 6) {
      ctx.beginPath()
      ctx.moveTo(cx, jarY + 4)
      ctx.lineTo(cx + 1, jarY + 14)
      ctx.stroke()
    }

    // combo display
    if (combo >= 2 && comboTimer > 0) {
      const comboY = 90
      const pulse = 1 + Math.sin(time * 8) * 0.05

      ctx.save()
      ctx.translate(w / 2, comboY)
      ctx.scale(pulse, pulse)

      // combo bar bg
      ctx.beginPath()
      ctx.roundRect(-70, -12, 140, 24, 12)
      ctx.fillStyle = "rgba(255,220,80,0.15)"
      ctx.fill()

      // combo bar fill
      const comboFrac = comboTimer / COMBO_WINDOW
      ctx.beginPath()
      ctx.roundRect(-68, -10, 136 * comboFrac, 20, 10)
      ctx.fillStyle = combo >= 5 ? "rgba(255,150,50,0.5)" : "rgba(255,220,80,0.35)"
      ctx.fill()

      ctx.font = "bold 16px 'Fredoka', 'Nunito', sans-serif"
      ctx.textAlign = "center"
      ctx.fillStyle = combo >= 5 ? "#ffa040" : "#ffdd60"
      ctx.fillText(`CATCH x${combo}!`, 0, 6)

      ctx.restore()
    }

    // particles
    particles.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life * 3)

      if (p.type === "glow") {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2)
        g.addColorStop(0, p.color)
        g.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = g
        ctx.globalAlpha *= 0.4
        ctx.fillRect(p.x - p.size * 2, p.y - p.size * 2, p.size * 4, p.size * 4)
      } else if (p.type === "star") {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot || 0)
        drawStar(ctx, 0, 0, 4, p.size, p.size * 0.4)
        ctx.fillStyle = p.color
        ctx.fill()
        ctx.restore()
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      }
    })
    ctx.globalAlpha = 1

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
      ctx.fillStyle = "#000"
      ctx.globalAlpha = alpha * 0.3
      ctx.fillText(p.text, 1, 2)
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.fillText(p.text, 0, 0)
      ctx.restore()
    })
    ctx.globalAlpha = 1

    // score
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    ctx.font = "bold 30px 'Fredoka', 'Nunito', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(score, w / 2, 38)

    // tiny jar icon next to score
    ctx.globalAlpha = 0.5
    ctx.font = "16px sans-serif"
    ctx.fillText("jar", w / 2 + 30, 38)
    ctx.globalAlpha = 1

    ctx.restore() // shake
  }
}

function spawnFly() {
  const isRare = Math.random() < 0.08
  const colorIdx = isRare ? 0 : Math.floor(Math.random() * FLY_COLORS.length)

  flies.push({
    x: 60 + Math.random() * (ctx.canvas.width - 120),
    y: 60 + Math.random() * (ctx.canvas.height - 280),
    angle: Math.random() * Math.PI * 2,
    speed: 20 + Math.random() * 40,
    turnSpeed: (Math.random() - 0.5) * 2.5,
    glowPhase: Math.random() * Math.PI * 2,
    pulseSpeed: Math.random() * 1.5,
    wingPhase: Math.random() * Math.PI * 2,
    trailTimer: 0,
    color: isRare
      ? { core: "#ffd700", glow: "255,215,0", name: "golden" }
      : FLY_COLORS[colorIdx],
    rare: isRare,
    points: isRare ? 5 : 1
  })
}

function handleTap(x, y) {
  // always show tap ripple
  tapRipples.push({ x, y, t: 0 })

  let didCatch = false
  let totalPoints = 0

  flies = flies.filter(f => {
    const dx = f.x - x
    const dy = f.y - y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const hit = dist < HIT_RADIUS

    if (hit) {
      didCatch = true
      combo++
      comboTimer = COMBO_WINDOW

      const pts = f.points * (combo >= 5 ? 3 : combo >= 3 ? 2 : 1)
      totalPoints += pts
      score += pts

      // score popup
      const popText = pts > 1 ? `+${pts}` : "+1"
      scorePopups.push({
        x: f.x,
        y: f.y - 15,
        text: f.rare ? `+${pts} GOLDEN!` : popText,
        color: f.rare ? "#ffd700" : f.color.core,
        size: f.rare ? 30 : (pts > 1 ? 28 : 22),
        life: 1.2
      })

      // burst particles
      const burstCount = f.rare ? 20 : 12
      for (let j = 0; j < burstCount; j++) {
        const angle = (j / burstCount) * Math.PI * 2
        const speed = 50 + Math.random() * 80
        particles.push({
          x: f.x, y: f.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 20,
          size: 2 + Math.random() * 3,
          color: f.rare ? "#ffd700" : f.color.core,
          type: j % 3 === 0 ? "star" : "circle",
          rot: Math.random() * Math.PI * 2,
          life: 0.5 + Math.random() * 0.4
        })
      }

      // animate to jar
      caught.push({
        startX: f.x,
        startY: f.y,
        targetX: w / 2,
        targetY: h - JAR_H / 2 - 25,
        x: f.x,
        y: f.y,
        t: 0,
        color: f.color
      })
    }

    return !hit
  })

  if (didCatch) {
    shakeAmount = combo >= 3 ? 5 : 2
    celebrate()
    if (combo >= 5 && combo % 5 === 0) celebrateBig()
  }
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
