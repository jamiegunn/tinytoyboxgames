import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler, dragHandler
let elephant, targets, splashes, score, time
let sprayParticles, ripples

const TARGET_TYPES = [
  { type: "flower", color: "#ff6b6b", petalColor: "#ff9ff3" },
  { type: "flower", color: "#feca57", petalColor: "#fff" },
  { type: "flower", color: "#a55eea", petalColor: "#d4b5f7" },
  { type: "butterfly", color: "#54a0ff", wingColor: "#a8d8ff" },
  { type: "butterfly", color: "#ff9f43", wingColor: "#feca57" },
  { type: "bird", color: "#e74c3c", wingColor: "#ff6b6b" },
  { type: "giraffe", color: "#f0b429", spotColor: "#c4872e" },
  { type: "monkey", color: "#a0522d", bellyColor: "#deb887" },
  { type: "frog", color: "#26de81", bellyColor: "#a8f0c8" },
]

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    score = 0
    time = 0
    sprayParticles = []
    splashes = []
    ripples = []

    elephant = {
      x: w * 0.5,
      y: h * 0.62,
      trunkAngle: -0.8,
      trunkTarget: -0.8,
      spraying: false,
      size: 60,
      earPhase: 0
    }

    targets = []
    for (let i = 0; i < 4; i++) spawnTarget()

    tapHandler = handleTap
    dragHandler = handleDrag
    input.onTap(tapHandler)
    input.onDragMove(dragHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    input.offDragMove(dragHandler)
    targets = []
    sprayParticles = []
    splashes = []
    ripples = []
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight
    time += dt
    elephant.earPhase += dt * 2

    // trunk follows target angle
    const angleDiff = elephant.trunkTarget - elephant.trunkAngle
    elephant.trunkAngle += angleDiff * 8 * dt

    // spray particles
    if (elephant.spraying) {
      const trunkTipX = elephant.x + Math.cos(elephant.trunkAngle) * 90
      const trunkTipY = elephant.y - 40 + Math.sin(elephant.trunkAngle) * 90

      for (let i = 0; i < 4; i++) {
        const spread = (Math.random() - 0.5) * 0.3
        const speed = 600 + Math.random() * 400
        sprayParticles.push({
          x: trunkTipX,
          y: trunkTipY,
          vx: Math.cos(elephant.trunkAngle + spread) * speed,
          vy: Math.sin(elephant.trunkAngle + spread) * speed,
          life: 1,
          size: 3 + Math.random() * 5
        })
      }
    }

    // update spray particles
    sprayParticles.forEach(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 200 * dt // gentle gravity
      p.life -= dt * 1.2
    })
    sprayParticles = sprayParticles.filter(p => p.life > 0 && p.y < h)

    // check spray hitting targets
    targets.forEach(t => {
      if (t.hit) return
      sprayParticles.forEach(p => {
        const dx = p.x - t.x
        const dy = p.y - t.y
        if (Math.sqrt(dx * dx + dy * dy) < t.size + 25) {
          t.wetness += 0.04
          if (t.wetness >= 1 && !t.hit) {
            t.hit = true
            score++
            celebrate()
            if (score % 5 === 0) celebrateBig()

            // splash effect
            for (let i = 0; i < 8; i++) {
              splashes.push({
                x: t.x, y: t.y,
                vx: (Math.random() - 0.5) * 200,
                vy: -100 - Math.random() * 150,
                life: 1,
                size: 3 + Math.random() * 3
              })
            }
          }
        }
      })
    })

    // update splashes
    splashes.forEach(s => {
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 300 * dt
      s.life -= dt * 2
    })
    splashes = splashes.filter(s => s.life > 0)

    // remove hit targets and respawn
    targets = targets.filter(t => !t.hit)
    while (targets.length < 3 + Math.min(Math.floor(score / 3), 4)) {
      spawnTarget()
    }

    // water ripples
    if (Math.random() < dt * 2) {
      ripples.push({
        x: elephant.x + (Math.random() - 0.5) * 120,
        y: elephant.y + 20 + Math.random() * 30,
        r: 0, maxR: 15 + Math.random() * 20,
        life: 1
      })
    }
    ripples.forEach(r => {
      r.r += dt * 30
      r.life -= dt * 1.5
    })
    ripples = ripples.filter(r => r.life > 0)

    // targets float/move
    targets.forEach(t => {
      if (t.type === "butterfly") {
        t.x += Math.sin(time * 2 + t.phase) * 30 * dt
        t.y += Math.cos(time * 1.5 + t.phase) * 20 * dt
        t.wingPhase += dt * 12
      } else if (t.type === "bird") {
        t.x += t.moveDir * 40 * dt
        t.y += Math.sin(time * 3 + t.phase) * 15 * dt
        t.wingPhase += dt * 8
        if (t.x < 30 || t.x > w - 30) t.moveDir *= -1
      } else if (t.type === "giraffe") {
        // slow wander
        t.x += t.moveDir * 15 * dt
        if (t.x < 50 || t.x > w - 50) t.moveDir *= -1
      } else if (t.type === "monkey") {
        // bouncy movement
        t.x += Math.sin(time * 1.8 + t.phase) * 40 * dt
        t.y += Math.cos(time * 2.5 + t.phase) * 25 * dt
      } else if (t.type === "frog") {
        // little hops
        t.x += Math.sin(time * 1.2 + t.phase) * 20 * dt
        t.y += Math.cos(time * 3 + t.phase) * 10 * dt
      } else {
        // flowers sway
        t.sway = Math.sin(time * 1.5 + t.phase) * 0.1
      }
    })
  },

  render() {
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, "#56bfea")
    sky.addColorStop(0.5, "#8ed8f0")
    sky.addColorStop(1, "#c4ecf5")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // clouds
    drawCloud(ctx, w * 0.12, h * 0.08, 28)
    drawCloud(ctx, w * 0.6, h * 0.05, 22)
    drawCloud(ctx, w * 0.88, h * 0.12, 18)

    // background grass/bank
    ctx.fillStyle = "#5cb85c"
    ctx.beginPath()
    ctx.moveTo(0, h * 0.5)
    for (let x = 0; x <= w; x += 30) {
      ctx.lineTo(x, h * 0.5 - Math.sin(x * 0.01 + 1) * 15)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.fill()

    // lake water
    const waterY = h * 0.55
    const water = ctx.createLinearGradient(0, waterY, 0, h)
    water.addColorStop(0, "#3a9fd8")
    water.addColorStop(0.4, "#2d8bc9")
    water.addColorStop(1, "#1a6fa0")
    ctx.fillStyle = water
    ctx.beginPath()
    ctx.moveTo(0, waterY)
    for (let x = 0; x <= w; x += 20) {
      ctx.lineTo(x, waterY + Math.sin(x * 0.03 + time * 2) * 4)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.fill()

    // water shimmer
    ctx.globalAlpha = 0.08
    for (let i = 0; i < 6; i++) {
      const sx = (i * w / 5 + time * 20) % (w + 60) - 30
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.ellipse(sx, waterY + 20 + i * 18, 30, 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // ripples
    ripples.forEach(r => {
      ctx.globalAlpha = r.life * 0.3
      ctx.strokeStyle = "rgba(255,255,255,0.5)"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    })

    // reeds on edges
    for (let rx = 10; rx < 60; rx += 18) {
      drawReed(ctx, rx, waterY + 5)
    }
    for (let rx = w - 50; rx < w - 5; rx += 18) {
      drawReed(ctx, rx, waterY + 5)
    }

    // targets behind elephant
    targets.filter(t => t.y < elephant.y).forEach(t => drawTarget(ctx, t))

    // elephant
    drawElephant(ctx, elephant)

    // targets in front
    targets.filter(t => t.y >= elephant.y).forEach(t => drawTarget(ctx, t))

    // spray particles
    sprayParticles.forEach(p => {
      ctx.globalAlpha = p.life
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(100, 180, 255, ${p.life * 0.8})`
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // splashes
    splashes.forEach(s => {
      ctx.globalAlpha = s.life
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fillStyle = "#7ec8f0"
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // score
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    ctx.font = "bold 30px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2, 16)

    if (score === 0) {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.fillText("Tap to spray water!", w / 2, 52)
    }
  }
}

function handleTap(x, y) {
  elephant.spraying = true
  aimTrunk(x, y)
}

function handleDrag(x, y) {
  elephant.spraying = true
  aimTrunk(x, y)
  // stop spraying after a delay when drag ends
  clearTimeout(elephant._stopTimer)
  elephant._stopTimer = setTimeout(() => { elephant.spraying = false }, 150)
}

function aimTrunk(x, y) {
  const dx = x - elephant.x
  const dy = y - (elephant.y - 40)
  elephant.trunkTarget = Math.atan2(dy, dx)
  // clamp to upper hemisphere
  if (elephant.trunkTarget > 0.3) elephant.trunkTarget = 0.3
  if (elephant.trunkTarget < -Math.PI + 0.3) elephant.trunkTarget = -Math.PI + 0.3
}

function spawnTarget() {
  const def = TARGET_TYPES[Math.floor(Math.random() * TARGET_TYPES.length)]
  const margin = 60
  const t = {
    type: def.type,
    color: def.color,
    x: margin + Math.random() * (w - margin * 2),
    y: h * 0.12 + Math.random() * (h * 0.35),
    size: def.type === "flower" ? 18 + Math.random() * 10 : 22 + Math.random() * 14,
    hit: false,
    wetness: 0,
    phase: Math.random() * Math.PI * 2,
    sway: 0,
    wingPhase: Math.random() * Math.PI * 2,
    moveDir: Math.random() < 0.5 ? 1 : -1
  }
  if (def.petalColor) t.petalColor = def.petalColor
  if (def.wingColor) t.wingColor = def.wingColor
  targets.push(t)
}

function drawElephant(ctx, e) {
  ctx.save()
  ctx.translate(e.x, e.y)
  const sz = e.size

  // body (in water)
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.3, sz * 0.9, sz * 0.6, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#8a8a9a"
  ctx.fill()

  // belly highlight
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.15, sz * 0.6, sz * 0.35, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#a0a0b0"
  ctx.fill()

  // ears
  const earBob = Math.sin(e.earPhase) * 0.15
  ctx.save()
  ctx.translate(-sz * 0.6, -sz * 0.65)
  ctx.rotate(-0.2 + earBob)
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.35, sz * 0.45, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = "#7a7a8a"
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(sz * 0.05, sz * 0.05, sz * 0.2, sz * 0.3, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = "#c0889a"
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.translate(sz * 0.6, -sz * 0.65)
  ctx.rotate(0.2 - earBob)
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.35, sz * 0.45, 0.2, 0, Math.PI * 2)
  ctx.fillStyle = "#7a7a8a"
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-sz * 0.05, sz * 0.05, sz * 0.2, sz * 0.3, 0.2, 0, Math.PI * 2)
  ctx.fillStyle = "#c0889a"
  ctx.fill()
  ctx.restore()

  // head
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.7, sz * 0.45, sz * 0.42, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#8a8a9a"
  ctx.fill()

  // trunk
  ctx.save()
  ctx.translate(0, -sz * 0.55)
  const segments = 8
  const trunkLen = sz * 1.5
  ctx.strokeStyle = "#8a8a9a"
  ctx.lineWidth = 14
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(0, 0)
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const curl = Math.sin(t * Math.PI * 0.5) * 0.2
    const tx = Math.cos(e.trunkAngle + curl) * trunkLen * t
    const ty = Math.sin(e.trunkAngle + curl) * trunkLen * t
    ctx.lineTo(tx, ty)
  }
  ctx.stroke()

  // trunk underside
  ctx.strokeStyle = "#a0a0b0"
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(0, 0)
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const curl = Math.sin(t * Math.PI * 0.5) * 0.2
    const tx = Math.cos(e.trunkAngle + curl) * trunkLen * t
    const ty = Math.sin(e.trunkAngle + curl) * trunkLen * t + 2
    ctx.lineTo(tx, ty)
  }
  ctx.stroke()

  // trunk tip (water comes from here)
  if (e.spraying) {
    const tipX = Math.cos(e.trunkAngle) * trunkLen
    const tipY = Math.sin(e.trunkAngle) * trunkLen
    ctx.beginPath()
    ctx.arc(tipX, tipY, 5, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(100,180,255,0.6)"
    ctx.fill()
  }
  ctx.restore()

  // eyes
  ctx.beginPath()
  ctx.arc(-sz * 0.18, -sz * 0.78, sz * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-sz * 0.15, -sz * 0.78, sz * 0.07, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-sz * 0.13, -sz * 0.8, sz * 0.03, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()

  ctx.beginPath()
  ctx.arc(sz * 0.18, -sz * 0.78, sz * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.21, -sz * 0.78, sz * 0.07, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.23, -sz * 0.8, sz * 0.03, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()

  // cheek blush
  ctx.beginPath()
  ctx.arc(-sz * 0.32, -sz * 0.6, sz * 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,150,170,0.25)"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.32, -sz * 0.6, sz * 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,150,170,0.25)"
  ctx.fill()

  // water line around body
  ctx.beginPath()
  for (let i = -sz; i <= sz; i += 4) {
    const wy = Math.sin(i * 0.1 + time * 3) * 3
    if (i === -sz) ctx.moveTo(i, wy)
    else ctx.lineTo(i, wy)
  }
  ctx.strokeStyle = "rgba(255,255,255,0.3)"
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.restore()
}

function drawTarget(ctx, t) {
  ctx.save()
  ctx.translate(t.x, t.y)

  // wetness glow
  if (t.wetness > 0) {
    ctx.beginPath()
    ctx.arc(0, 0, t.size + 8, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(100,180,255,${t.wetness * 0.3})`
    ctx.fill()
  }

  if (t.type === "flower") {
    ctx.rotate(t.sway || 0)
    // stem
    ctx.strokeStyle = "#3a9a3a"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, t.size * 0.5)
    ctx.lineTo(0, t.size * 1.2)
    ctx.stroke()
    // petals
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      ctx.beginPath()
      ctx.ellipse(
        Math.cos(a) * t.size * 0.4,
        Math.sin(a) * t.size * 0.4,
        t.size * 0.35, t.size * 0.2, a, 0, Math.PI * 2
      )
      ctx.fillStyle = t.petalColor || t.color
      ctx.fill()
    }
    // center
    ctx.beginPath()
    ctx.arc(0, 0, t.size * 0.25, 0, Math.PI * 2)
    ctx.fillStyle = t.color
    ctx.fill()
  } else if (t.type === "butterfly") {
    const wingFlap = Math.sin(t.wingPhase) * 0.4
    // left wing
    ctx.save()
    ctx.scale(1, Math.cos(wingFlap))
    ctx.beginPath()
    ctx.ellipse(-t.size * 0.4, 0, t.size * 0.5, t.size * 0.7, -0.2, 0, Math.PI * 2)
    ctx.fillStyle = t.wingColor
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-t.size * 0.35, 0, t.size * 0.25, t.size * 0.35, -0.2, 0, Math.PI * 2)
    ctx.fillStyle = t.color
    ctx.fill()
    ctx.restore()
    // right wing
    ctx.save()
    ctx.scale(1, Math.cos(wingFlap + 0.5))
    ctx.beginPath()
    ctx.ellipse(t.size * 0.4, 0, t.size * 0.5, t.size * 0.7, 0.2, 0, Math.PI * 2)
    ctx.fillStyle = t.wingColor
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(t.size * 0.35, 0, t.size * 0.25, t.size * 0.35, 0.2, 0, Math.PI * 2)
    ctx.fillStyle = t.color
    ctx.fill()
    ctx.restore()
    // body
    ctx.beginPath()
    ctx.ellipse(0, 0, 3, t.size * 0.4, 0, 0, Math.PI * 2)
    ctx.fillStyle = "#333"
    ctx.fill()
    // antennae
    ctx.strokeStyle = "#333"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -t.size * 0.3)
    ctx.quadraticCurveTo(-6, -t.size * 0.6, -10, -t.size * 0.65)
    ctx.moveTo(0, -t.size * 0.3)
    ctx.quadraticCurveTo(6, -t.size * 0.6, 10, -t.size * 0.65)
    ctx.stroke()
  } else if (t.type === "bird") {
    const wingUp = Math.sin(t.wingPhase) * 0.6
    // body
    ctx.beginPath()
    ctx.ellipse(0, 0, t.size * 0.5, t.size * 0.3, 0, 0, Math.PI * 2)
    ctx.fillStyle = t.color
    ctx.fill()
    // wing
    ctx.save()
    ctx.rotate(wingUp)
    ctx.beginPath()
    ctx.ellipse(0, -t.size * 0.25, t.size * 0.6, t.size * 0.2, -0.3, 0, Math.PI * 2)
    ctx.fillStyle = t.wingColor
    ctx.fill()
    ctx.restore()
    // head
    ctx.beginPath()
    ctx.arc(t.size * 0.4, -t.size * 0.1, t.size * 0.2, 0, Math.PI * 2)
    ctx.fillStyle = t.color
    ctx.fill()
    // eye
    ctx.beginPath()
    ctx.arc(t.size * 0.48, -t.size * 0.15, 2, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()
    // beak
    ctx.beginPath()
    ctx.moveTo(t.size * 0.58, -t.size * 0.1)
    ctx.lineTo(t.size * 0.75, -t.size * 0.05)
    ctx.lineTo(t.size * 0.58, 0)
    ctx.fillStyle = "#ff9f43"
    ctx.fill()
  } else if (t.type === "giraffe") {
    const sz = t.size
    // neck
    ctx.fillStyle = t.color
    ctx.beginPath()
    ctx.roundRect(-sz * 0.15, -sz * 0.9, sz * 0.3, sz * 1.2, 4)
    ctx.fill()
    // body
    ctx.beginPath()
    ctx.ellipse(0, sz * 0.3, sz * 0.5, sz * 0.35, 0, 0, Math.PI * 2)
    ctx.fill()
    // head
    ctx.beginPath()
    ctx.ellipse(0, -sz * 0.9, sz * 0.25, sz * 0.2, 0, 0, Math.PI * 2)
    ctx.fill()
    // spots
    ctx.fillStyle = t.spotColor
    const spots = [[0, -0.3], [-0.1, 0.1], [0.1, 0], [0, 0.5], [-0.2, 0.4]]
    spots.forEach(([sx, sy]) => {
      ctx.beginPath()
      ctx.arc(sx * sz, sy * sz, sz * 0.08, 0, Math.PI * 2)
      ctx.fill()
    })
    // horns
    ctx.strokeStyle = t.spotColor
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(-sz * 0.1, -sz * 1.05)
    ctx.lineTo(-sz * 0.12, -sz * 1.2)
    ctx.moveTo(sz * 0.1, -sz * 1.05)
    ctx.lineTo(sz * 0.12, -sz * 1.2)
    ctx.stroke()
    // horn tips
    ctx.fillStyle = t.spotColor
    ctx.beginPath()
    ctx.arc(-sz * 0.12, -sz * 1.22, 3, 0, Math.PI * 2)
    ctx.arc(sz * 0.12, -sz * 1.22, 3, 0, Math.PI * 2)
    ctx.fill()
    // eye
    ctx.beginPath()
    ctx.arc(sz * 0.1, -sz * 0.92, sz * 0.07, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(sz * 0.12, -sz * 0.92, sz * 0.04, 0, Math.PI * 2)
    ctx.fillStyle = "#222"
    ctx.fill()
    // legs
    ctx.fillStyle = t.color
    for (const lx of [-0.25, -0.1, 0.1, 0.25]) {
      ctx.fillRect(lx * sz - 3, sz * 0.55, 6, sz * 0.35)
    }
  } else if (t.type === "monkey") {
    const sz = t.size
    // body
    ctx.beginPath()
    ctx.ellipse(0, 0, sz * 0.4, sz * 0.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = t.color
    ctx.fill()
    // belly
    ctx.beginPath()
    ctx.ellipse(0, sz * 0.05, sz * 0.25, sz * 0.3, 0, 0, Math.PI * 2)
    ctx.fillStyle = t.bellyColor
    ctx.fill()
    // head
    ctx.beginPath()
    ctx.arc(0, -sz * 0.5, sz * 0.32, 0, Math.PI * 2)
    ctx.fillStyle = t.color
    ctx.fill()
    // face
    ctx.beginPath()
    ctx.ellipse(0, -sz * 0.42, sz * 0.22, sz * 0.2, 0, 0, Math.PI * 2)
    ctx.fillStyle = t.bellyColor
    ctx.fill()
    // ears
    ctx.beginPath()
    ctx.arc(-sz * 0.3, -sz * 0.5, sz * 0.12, 0, Math.PI * 2)
    ctx.arc(sz * 0.3, -sz * 0.5, sz * 0.12, 0, Math.PI * 2)
    ctx.fillStyle = t.bellyColor
    ctx.fill()
    // eyes
    ctx.beginPath()
    ctx.arc(-sz * 0.1, -sz * 0.5, sz * 0.06, 0, Math.PI * 2)
    ctx.arc(sz * 0.1, -sz * 0.5, sz * 0.06, 0, Math.PI * 2)
    ctx.fillStyle = "#222"
    ctx.fill()
    // mouth
    ctx.beginPath()
    ctx.arc(0, -sz * 0.35, sz * 0.08, 0.2, Math.PI - 0.2)
    ctx.strokeStyle = "#5a3520"
    ctx.lineWidth = 1.5
    ctx.stroke()
    // tail (curly)
    ctx.beginPath()
    ctx.moveTo(-sz * 0.3, sz * 0.2)
    ctx.quadraticCurveTo(-sz * 0.7, sz * 0.1, -sz * 0.6, -sz * 0.2)
    ctx.quadraticCurveTo(-sz * 0.5, -sz * 0.4, -sz * 0.35, -sz * 0.25)
    ctx.strokeStyle = t.color
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.stroke()
  } else if (t.type === "frog") {
    const sz = t.size
    // body
    ctx.beginPath()
    ctx.ellipse(0, 0, sz * 0.45, sz * 0.35, 0, 0, Math.PI * 2)
    ctx.fillStyle = t.color
    ctx.fill()
    // belly
    ctx.beginPath()
    ctx.ellipse(0, sz * 0.05, sz * 0.3, sz * 0.2, 0, 0, Math.PI * 2)
    ctx.fillStyle = t.bellyColor
    ctx.fill()
    // eyes (big, on top)
    ctx.beginPath()
    ctx.arc(-sz * 0.2, -sz * 0.3, sz * 0.16, 0, Math.PI * 2)
    ctx.arc(sz * 0.2, -sz * 0.3, sz * 0.16, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-sz * 0.18, -sz * 0.3, sz * 0.08, 0, Math.PI * 2)
    ctx.arc(sz * 0.18, -sz * 0.3, sz * 0.08, 0, Math.PI * 2)
    ctx.fillStyle = "#222"
    ctx.fill()
    // mouth
    ctx.beginPath()
    ctx.arc(0, sz * 0.05, sz * 0.2, 0.1, Math.PI - 0.1)
    ctx.strokeStyle = "#1a9960"
    ctx.lineWidth = 2
    ctx.stroke()
    // front legs
    ctx.fillStyle = t.color
    ctx.beginPath()
    ctx.ellipse(-sz * 0.4, sz * 0.2, sz * 0.12, sz * 0.06, -0.3, 0, Math.PI * 2)
    ctx.ellipse(sz * 0.4, sz * 0.2, sz * 0.12, sz * 0.06, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawCloud(ctx, x, y, r) {
  ctx.globalAlpha = 0.7
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.arc(x + r * 0.8, y - r * 0.2, r * 0.7, 0, Math.PI * 2)
  ctx.arc(x - r * 0.6, y + r * 0.1, r * 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawReed(ctx, x, y) {
  ctx.strokeStyle = "#3a8a3a"
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  const sway = Math.sin(time * 1.5 + x * 0.3) * 6
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(x + sway, y - 25, x + sway * 1.2, y - 45)
  ctx.stroke()
  // leaf tip
  ctx.beginPath()
  ctx.ellipse(x + sway * 1.2, y - 47, 4, 8, sway * 0.02, 0, Math.PI * 2)
  ctx.fillStyle = "#4aaa4a"
  ctx.fill()
}
