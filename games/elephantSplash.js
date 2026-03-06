import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler, dragHandler, dragEndHandler
let elephant, targets, sprayParticles, splashes, ripples, lilypads
let dragonflies, scorePopups, puddles, mist
let score, time, combo, comboTimer, lastHitTime
let screenShake, slowMo
let sunbeamPhase

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
  { type: "toucan", color: "#2d3436", beakColor: "#ff9f43", chestColor: "#fff" },
  { type: "parrot", color: "#e74c3c", wingColor: "#26de81", tailColor: "#0984e3" },
  { type: "hippo", color: "#636e72", earColor: "#b2bec3" },
]

// rare golden butterfly
const GOLDEN_BUTTERFLY = { type: "butterfly", color: "#ffd700", wingColor: "#fff3a0", golden: true }

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    score = 0
    time = 0
    combo = 0
    comboTimer = 0
    lastHitTime = 0
    screenShake = 0
    slowMo = 1
    sunbeamPhase = 0
    sprayParticles = []
    splashes = []
    ripples = []
    lilypads = []
    dragonflies = []
    scorePopups = []
    puddles = []
    mist = []

    elephant = {
      x: w * 0.5,
      y: h * 0.62,
      trunkAngle: -0.8,
      trunkTarget: -0.8,
      spraying: false,
      size: 65,
      earPhase: 0,
      bounceY: 0,
      bounceVel: 0,
      happiness: 0,
      sprayPower: 1,
      trumpeting: 0,
      eyeSquint: 0
    }

    targets = []
    for (let i = 0; i < 4; i++) spawnTarget()

    // spawn lily pads
    for (let i = 0; i < 5; i++) {
      lilypads.push({
        x: Math.random() * w,
        y: h * 0.58 + Math.random() * (h * 0.35),
        size: 18 + Math.random() * 14,
        rot: Math.random() * Math.PI * 2,
        hasFlower: Math.random() < 0.4,
        flowerColor: ['#ff6b9d', '#fff', '#feca57', '#a55eea'][Math.floor(Math.random() * 4)]
      })
    }

    // spawn dragonflies
    for (let i = 0; i < 4; i++) {
      dragonflies.push({
        x: Math.random() * w,
        y: h * 0.2 + Math.random() * h * 0.35,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 40,
        wingPhase: Math.random() * Math.PI * 2,
        color: ['#54a0ff', '#26de81', '#a55eea', '#ff6b6b'][Math.floor(Math.random() * 4)],
        size: 6 + Math.random() * 4
      })
    }

    tapHandler = handleTap
    dragHandler = handleDrag
    dragEndHandler = () => { elephant.spraying = false }
    input.onTap(tapHandler)
    input.onDragMove(dragHandler)
    input.onDragEnd(dragEndHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    input.offDragMove(dragHandler)
    input.offDragEnd(dragEndHandler)
    targets = []; sprayParticles = []; splashes = []; ripples = []
    lilypads = []; dragonflies = []; scorePopups = []; puddles = []; mist = []
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight

    // slow mo decay
    if (slowMo < 1) slowMo = Math.min(1, slowMo + dt * 2)
    dt *= slowMo

    time += dt
    sunbeamPhase += dt * 0.3
    elephant.earPhase += dt * 2.5

    // screen shake decay
    if (screenShake > 0) screenShake *= Math.pow(0.05, dt)
    if (screenShake < 0.3) screenShake = 0

    // combo timer
    if (comboTimer > 0) {
      comboTimer -= dt
      if (comboTimer <= 0) { combo = 0; comboTimer = 0 }
    }

    // elephant bounce (celebration)
    elephant.bounceVel += (-elephant.bounceY) * 600 * dt
    elephant.bounceVel *= Math.pow(0.02, dt)
    elephant.bounceY += elephant.bounceVel * dt
    elephant.happiness *= Math.pow(0.3, dt)
    elephant.trumpeting *= Math.pow(0.1, dt)
    elephant.eyeSquint *= Math.pow(0.15, dt)

    // trunk follows target angle
    const angleDiff = elephant.trunkTarget - elephant.trunkAngle
    elephant.trunkAngle += angleDiff * 10 * dt

    // spray particles — more volume, better physics
    if (elephant.spraying) {
      elephant.eyeSquint = Math.min(0.5, elephant.eyeSquint + dt * 3)
      const trunkTipX = elephant.x + Math.cos(elephant.trunkAngle) * 95
      const trunkTipY = elephant.y - 40 + elephant.bounceY + Math.sin(elephant.trunkAngle) * 95

      const count = Math.floor(6 * elephant.sprayPower)
      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 0.35
        const speed = (650 + Math.random() * 450) * elephant.sprayPower
        const isDroplet = Math.random() < 0.3
        sprayParticles.push({
          x: trunkTipX,
          y: trunkTipY,
          vx: Math.cos(elephant.trunkAngle + spread) * speed,
          vy: Math.sin(elephant.trunkAngle + spread) * speed,
          life: 1,
          size: isDroplet ? (5 + Math.random() * 4) : (2 + Math.random() * 4),
          isDroplet,
          shimmer: Math.random()
        })
      }

      // mist from trunk tip
      if (Math.random() < 0.3) {
        mist.push({
          x: trunkTipX + (Math.random() - 0.5) * 20,
          y: trunkTipY + (Math.random() - 0.5) * 20,
          size: 8 + Math.random() * 15,
          life: 1,
          vx: Math.cos(elephant.trunkAngle) * 40,
          vy: Math.sin(elephant.trunkAngle) * 40 - 10
        })
      }
    }

    // update spray particles
    sprayParticles.forEach(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 180 * dt
      p.life -= dt * 1.1
      // ground splash
      if (p.y > h * 0.55 && p.vy > 0 && p.isDroplet) {
        puddles.push({ x: p.x, y: p.y, size: p.size * 0.5, life: 1 })
        // bounce
        p.vy *= -0.3
        p.vx *= 0.5
        p.size *= 0.6
      }
    })
    sprayParticles = sprayParticles.filter(p => p.life > 0 && p.y < h + 20)

    // update mist
    mist.forEach(m => {
      m.x += m.vx * dt
      m.y += m.vy * dt
      m.size += dt * 15
      m.life -= dt * 1.5
    })
    mist = mist.filter(m => m.life > 0)

    // update puddles
    puddles.forEach(p => { p.life -= dt * 3 })
    puddles = puddles.filter(p => p.life > 0)

    // check spray hitting targets
    targets.forEach(t => {
      if (t.hit) return
      sprayParticles.forEach(p => {
        const dx = p.x - t.x
        const dy = p.y - t.y
        if (Math.sqrt(dx * dx + dy * dy) < t.size + 28) {
          t.wetness += 0.035
          t.shakeAmount = 3
          if (t.wetness >= 1 && !t.hit) {
            t.hit = true
            t.hitTime = time

            // combo logic
            const timeSinceHit = time - lastHitTime
            if (timeSinceHit < 2.5) {
              combo++
              comboTimer = 3
            } else {
              combo = 1
              comboTimer = 3
            }
            lastHitTime = time

            const points = Math.max(1, combo) * (t.golden ? 5 : 1)
            score += points
            celebrate()

            // score popup
            const label = t.golden ? `+${points} GOLDEN!` : (combo > 1 ? `+${points} x${combo}!` : `+${points}`)
            scorePopups.push({
              x: t.x, y: t.y,
              text: label,
              life: 1.5,
              color: t.golden ? '#ffd700' : (combo > 2 ? '#ff6b6b' : '#fff'),
              scale: combo > 2 ? 1.4 : 1
            })

            if (score % 5 === 0) celebrateBig()
            if (combo >= 3) {
              slowMo = 0.3
              screenShake = 8
            }

            // elephant celebration
            elephant.bounceVel = -200
            elephant.happiness = 1
            if (combo >= 3 || t.golden) elephant.trumpeting = 1

            // big splash ring
            for (let i = 0; i < 14; i++) {
              const a = (i / 14) * Math.PI * 2
              splashes.push({
                x: t.x, y: t.y,
                vx: Math.cos(a) * (120 + Math.random() * 100),
                vy: Math.sin(a) * (120 + Math.random() * 100) - 60,
                life: 1,
                size: 3 + Math.random() * 4
              })
            }

            // water fountain burst on big combos
            if (combo >= 3) {
              for (let i = 0; i < 20; i++) {
                splashes.push({
                  x: t.x, y: t.y,
                  vx: (Math.random() - 0.5) * 250,
                  vy: -200 - Math.random() * 300,
                  life: 1.2,
                  size: 4 + Math.random() * 5
                })
              }
            }
          }
        }
      })
    })

    // update splashes
    splashes.forEach(s => {
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 350 * dt
      s.life -= dt * 1.8
    })
    splashes = splashes.filter(s => s.life > 0)

    // remove hit targets with delay for reaction animation, then respawn
    targets = targets.filter(t => {
      if (!t.hit) return true
      return (time - t.hitTime) < 0.6
    })
    const maxTargets = 3 + Math.min(Math.floor(score / 3), 5)
    while (targets.filter(t => !t.hit).length < maxTargets) {
      // rare golden butterfly chance
      if (score > 5 && Math.random() < 0.06) {
        spawnTarget(GOLDEN_BUTTERFLY)
      } else {
        spawnTarget()
      }
    }

    // water ripples
    if (Math.random() < dt * 3) {
      ripples.push({
        x: elephant.x + (Math.random() - 0.5) * 140,
        y: elephant.y + 15 + Math.random() * 35,
        r: 0, maxR: 15 + Math.random() * 25,
        life: 1
      })
    }
    ripples.forEach(r => {
      r.r += dt * 35
      r.life -= dt * 1.3
    })
    ripples = ripples.filter(r => r.life > 0)

    // target movement & reactions
    targets.forEach(t => {
      // shake when wet
      if (t.shakeAmount > 0) t.shakeAmount *= Math.pow(0.01, dt)

      // hit reaction animation
      if (t.hit) {
        t.hitScale = (t.hitScale || 1) + dt * 3
        t.hitAlpha = Math.max(0, 1 - (time - t.hitTime) / 0.6)
        return
      }

      if (t.type === "butterfly") {
        t.x += Math.sin(time * 2 + t.phase) * 35 * dt
        t.y += Math.cos(time * 1.5 + t.phase) * 25 * dt
        t.wingPhase += dt * 14
        // keep in bounds
        if (t.x < 40) t.x = 40
        if (t.x > w - 40) t.x = w - 40
        if (t.y < 30) t.y = 30
        if (t.y > h * 0.48) t.y = h * 0.48
      } else if (t.type === "bird" || t.type === "toucan" || t.type === "parrot") {
        t.x += t.moveDir * 50 * dt
        t.y += Math.sin(time * 3 + t.phase) * 18 * dt
        t.wingPhase += dt * 10
        if (t.x < 30 || t.x > w - 30) t.moveDir *= -1
      } else if (t.type === "giraffe") {
        t.x += t.moveDir * 18 * dt
        t.bobPhase = (t.bobPhase || 0) + dt * 2
        if (t.x < 60 || t.x > w - 60) t.moveDir *= -1
      } else if (t.type === "monkey") {
        t.x += Math.sin(time * 1.8 + t.phase) * 45 * dt
        t.y += Math.cos(time * 2.5 + t.phase) * 30 * dt
        if (t.x < 50) t.x = 50
        if (t.x > w - 50) t.x = w - 50
      } else if (t.type === "frog") {
        // hop every few seconds
        t.hopTimer = (t.hopTimer || 0) + dt
        if (t.hopTimer > 2 + Math.sin(t.phase) * 0.5) {
          t.hopTimer = 0
          t.hopVY = -120
          t.hopVX = (Math.random() - 0.5) * 80
        }
        if (t.hopVY) {
          t.hopVY += 300 * dt
          t.x += (t.hopVX || 0) * dt
          t.y += t.hopVY * dt
          if (t.y > t.baseY) {
            t.y = t.baseY
            t.hopVY = 0
            t.hopVX = 0
          }
        }
      } else if (t.type === "hippo") {
        // bob in water
        t.bobPhase = (t.bobPhase || 0) + dt * 1.5
        t.y = t.baseY + Math.sin(t.bobPhase) * 8
      } else {
        // flowers sway
        t.sway = Math.sin(time * 1.5 + t.phase) * 0.12
      }
    })

    // dragonflies
    dragonflies.forEach(d => {
      d.wingPhase += dt * 30
      d.x += d.vx * dt
      d.y += d.vy * dt
      // wander
      d.vx += (Math.random() - 0.5) * 200 * dt
      d.vy += (Math.random() - 0.5) * 150 * dt
      d.vx *= 0.98
      d.vy *= 0.98
      // bounds
      if (d.x < 20) d.vx += 50 * dt
      if (d.x > w - 20) d.vx -= 50 * dt
      if (d.y < 20) d.vy += 50 * dt
      if (d.y > h * 0.55) d.vy -= 50 * dt
    })

    // score popups
    scorePopups.forEach(p => {
      p.y -= 60 * dt
      p.life -= dt
    })
    scorePopups = scorePopups.filter(p => p.life > 0)

    // lily pad drift
    lilypads.forEach(lp => {
      lp.x += Math.sin(time * 0.3 + lp.rot) * 3 * dt
      lp.rot += dt * 0.1
    })
  },

  render() {
    ctx.save()

    // screen shake
    if (screenShake > 0) {
      const sx = (Math.random() - 0.5) * screenShake
      const sy = (Math.random() - 0.5) * screenShake
      ctx.translate(sx, sy)
    }

    // sunset sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6)
    sky.addColorStop(0, "#3a7bd5")
    sky.addColorStop(0.35, "#56bfea")
    sky.addColorStop(0.7, "#8ed8f0")
    sky.addColorStop(1, "#c4ecf5")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // sun
    const sunX = w * 0.82
    const sunY = h * 0.08
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 80)
    sunGlow.addColorStop(0, "rgba(255,240,150,0.9)")
    sunGlow.addColorStop(0.4, "rgba(255,220,100,0.3)")
    sunGlow.addColorStop(1, "rgba(255,200,50,0)")
    ctx.fillStyle = sunGlow
    ctx.fillRect(sunX - 80, sunY - 80, 160, 160)
    ctx.beginPath()
    ctx.arc(sunX, sunY, 22, 0, Math.PI * 2)
    ctx.fillStyle = "#ffe066"
    ctx.fill()

    // sunbeams
    ctx.save()
    ctx.globalAlpha = 0.04
    for (let i = 0; i < 5; i++) {
      const a = sunbeamPhase + i * 1.2
      ctx.beginPath()
      ctx.moveTo(sunX, sunY)
      ctx.lineTo(sunX + Math.cos(a) * w, sunY + Math.sin(a) * h)
      ctx.lineTo(sunX + Math.cos(a + 0.15) * w, sunY + Math.sin(a + 0.15) * h)
      ctx.fillStyle = "#ffe066"
      ctx.fill()
    }
    ctx.restore()

    // clouds with depth
    drawCloud(ctx, w * 0.08, h * 0.06, 32, 0.6)
    drawCloud(ctx, w * 0.35, h * 0.03, 20, 0.4)
    drawCloud(ctx, w * 0.65, h * 0.09, 26, 0.5)
    drawCloud(ctx, w * 0.9, h * 0.05, 22, 0.45)

    // distant mountains
    ctx.fillStyle = "#7ab89a"
    ctx.globalAlpha = 0.3
    ctx.beginPath()
    ctx.moveTo(0, h * 0.42)
    ctx.lineTo(w * 0.15, h * 0.3)
    ctx.lineTo(w * 0.3, h * 0.38)
    ctx.lineTo(w * 0.5, h * 0.28)
    ctx.lineTo(w * 0.7, h * 0.35)
    ctx.lineTo(w * 0.85, h * 0.25)
    ctx.lineTo(w, h * 0.38)
    ctx.lineTo(w, h * 0.5)
    ctx.lineTo(0, h * 0.5)
    ctx.fill()
    ctx.globalAlpha = 1

    // background trees (baobabs)
    drawBaobab(ctx, w * 0.05, h * 0.46, 0.6)
    drawBaobab(ctx, w * 0.92, h * 0.44, 0.5)
    drawBaobab(ctx, w * 0.75, h * 0.47, 0.4)

    // grass bank with texture
    const bankY = h * 0.5
    ctx.fillStyle = "#5cb85c"
    ctx.beginPath()
    ctx.moveTo(0, bankY)
    for (let x = 0; x <= w; x += 20) {
      ctx.lineTo(x, bankY - Math.sin(x * 0.012 + 1) * 18 - Math.sin(x * 0.03) * 5)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.fill()

    // grass tufts along bank
    ctx.fillStyle = "#4aaa4a"
    for (let gx = 5; gx < w; gx += 25) {
      const gy = bankY - Math.sin(gx * 0.012 + 1) * 18 - Math.sin(gx * 0.03) * 5
      for (let b = -2; b <= 2; b++) {
        const sway = Math.sin(time * 1.5 + gx * 0.1 + b) * 3
        ctx.beginPath()
        ctx.moveTo(gx + b * 3, gy)
        ctx.quadraticCurveTo(gx + b * 3 + sway, gy - 10, gx + b * 4 + sway, gy - 14 - Math.random() * 4)
        ctx.strokeStyle = b % 2 === 0 ? "#4aaa4a" : "#5cb85c"
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    // small flowers in grass
    for (let fx = 30; fx < w; fx += 80) {
      const fy = bankY - Math.sin(fx * 0.012 + 1) * 18 + 8
      drawSmallFlower(ctx, fx, fy, time)
    }

    // lake water
    const waterY = h * 0.55
    const water = ctx.createLinearGradient(0, waterY, 0, h)
    water.addColorStop(0, "#3a9fd8")
    water.addColorStop(0.3, "#2d8bc9")
    water.addColorStop(0.7, "#1a6fa0")
    water.addColorStop(1, "#145a85")
    ctx.fillStyle = water
    ctx.beginPath()
    ctx.moveTo(0, waterY)
    for (let x = 0; x <= w; x += 15) {
      ctx.lineTo(x, waterY + Math.sin(x * 0.03 + time * 2) * 5 + Math.sin(x * 0.07 + time * 3) * 2)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.fill()

    // water shimmer lines
    ctx.globalAlpha = 0.07
    for (let i = 0; i < 10; i++) {
      const sx = ((i * w / 8 + time * (15 + i * 3)) % (w + 80)) - 40
      const sy = waterY + 15 + i * 22
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.ellipse(sx, sy, 25 + i * 2, 2.5, Math.sin(time + i) * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // lily pads
    lilypads.forEach(lp => drawLilypad(ctx, lp))

    // puddles (from spray)
    puddles.forEach(p => {
      ctx.globalAlpha = p.life * 0.3
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, p.size * 3, p.size, 0, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(100,180,255,0.4)"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // ripples
    ripples.forEach(r => {
      ctx.globalAlpha = r.life * 0.35
      ctx.strokeStyle = "rgba(255,255,255,0.6)"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, Math.PI * 2)
      ctx.stroke()
    })
    ctx.globalAlpha = 1

    // reeds on edges (more lush)
    for (let rx = 5; rx < 70; rx += 14) {
      drawReed(ctx, rx, waterY + 5, 1)
    }
    for (let rx = w - 65; rx < w - 5; rx += 14) {
      drawReed(ctx, rx, waterY + 5, -1)
    }

    // targets behind elephant
    targets.filter(t => t.y < elephant.y).forEach(t => drawTarget(ctx, t))

    // dragonflies behind elephant
    dragonflies.filter(d => d.y < elephant.y).forEach(d => drawDragonfly(ctx, d))

    // elephant
    drawElephant(ctx, elephant)

    // targets in front
    targets.filter(t => t.y >= elephant.y).forEach(t => drawTarget(ctx, t))

    // dragonflies in front
    dragonflies.filter(d => d.y >= elephant.y).forEach(d => drawDragonfly(ctx, d))

    // mist
    mist.forEach(m => {
      ctx.globalAlpha = m.life * 0.15
      ctx.beginPath()
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(200,230,255,0.5)"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // spray particles with shimmer
    sprayParticles.forEach(p => {
      ctx.globalAlpha = p.life * 0.85
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      if (p.isDroplet) {
        // larger droplets with highlight
        ctx.fillStyle = `rgba(80, 170, 255, ${p.life * 0.9})`
        ctx.fill()
        ctx.beginPath()
        ctx.arc(p.x - p.size * 0.2, p.y - p.size * 0.2, p.size * 0.3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.life * 0.6})`
        ctx.fill()
      } else {
        const shimmer = Math.sin(p.shimmer * 20 + time * 10) * 0.2 + 0.8
        ctx.fillStyle = `rgba(100, 190, 255, ${p.life * shimmer})`
        ctx.fill()
      }
    })
    ctx.globalAlpha = 1

    // splashes
    splashes.forEach(s => {
      ctx.globalAlpha = s.life * 0.9
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fillStyle = "#7ec8f0"
      ctx.fill()
      // highlight
      ctx.beginPath()
      ctx.arc(s.x - 1, s.y - 1, s.size * 0.4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${s.life * 0.5})`
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // score popups
    scorePopups.forEach(p => {
      const alpha = Math.min(1, p.life * 2)
      const s = p.scale * (1 + (1 - Math.min(1, p.life / 1.2)) * 0.3)
      ctx.globalAlpha = alpha
      ctx.font = `bold ${Math.round(24 * s)}px 'Fredoka', sans-serif`
      ctx.textAlign = "center"
      ctx.strokeStyle = "rgba(0,0,0,0.4)"
      ctx.lineWidth = 3
      ctx.strokeText(p.text, p.x, p.y)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y)
    })
    ctx.globalAlpha = 1

    // combo bar
    if (combo > 1 && comboTimer > 0) {
      const barW = 120
      const barH = 8
      const bx = w / 2 - barW / 2
      const by = 58
      ctx.fillStyle = "rgba(0,0,0,0.2)"
      ctx.beginPath()
      ctx.roundRect(bx, by, barW, barH, 4)
      ctx.fill()
      const fill = comboTimer / 3
      const comboColor = combo >= 5 ? "#ff6b6b" : combo >= 3 ? "#feca57" : "#54a0ff"
      ctx.fillStyle = comboColor
      ctx.beginPath()
      ctx.roundRect(bx, by, barW * fill, barH, 4)
      ctx.fill()
      ctx.font = "bold 14px 'Fredoka', sans-serif"
      ctx.fillStyle = comboColor
      ctx.textAlign = "center"
      ctx.fillText(`COMBO x${combo}`, w / 2, by - 4)
    }

    // trumpet visual
    if (elephant.trumpeting > 0.1) {
      ctx.globalAlpha = elephant.trumpeting * 0.6
      const tx = elephant.x + Math.cos(elephant.trunkAngle) * 110
      const ty = elephant.y - 40 + elephant.bounceY + Math.sin(elephant.trunkAngle) * 110
      for (let i = 0; i < 3; i++) {
        const r = 10 + i * 12 + (1 - elephant.trumpeting) * 30
        ctx.beginPath()
        ctx.arc(tx, ty, r, elephant.trunkAngle - 0.4, elephant.trunkAngle + 0.4)
        ctx.strokeStyle = "#ffe066"
        ctx.lineWidth = 3
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // score
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    ctx.font = "bold 34px 'Fredoka', sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    // score shadow
    ctx.fillStyle = "rgba(0,0,0,0.15)"
    ctx.fillText(score, w / 2 + 1, 17)
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    ctx.fillText(score, w / 2, 16)

    if (score === 0) {
      ctx.font = "18px 'Fredoka', sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.fillText("Tap and drag to spray water!", w / 2, 56)
    }

    ctx.restore()
  }
}

function handleTap(x, y) {
  elephant.spraying = true
  aimTrunk(x, y)
  // auto-stop after short delay for taps
  clearTimeout(elephant._stopTimer)
  elephant._stopTimer = setTimeout(() => { elephant.spraying = false }, 300)
}

function handleDrag(x, y) {
  elephant.spraying = true
  aimTrunk(x, y)
  clearTimeout(elephant._stopTimer)
}

function aimTrunk(x, y) {
  const dx = x - elephant.x
  const dy = y - (elephant.y - 40 + elephant.bounceY)
  elephant.trunkTarget = Math.atan2(dy, dx)
  // clamp to upper hemisphere mostly
  if (elephant.trunkTarget > 0.4) elephant.trunkTarget = 0.4
  if (elephant.trunkTarget < -Math.PI + 0.3) elephant.trunkTarget = -Math.PI + 0.3
}

function spawnTarget(forceDef) {
  const def = forceDef || TARGET_TYPES[Math.floor(Math.random() * TARGET_TYPES.length)]
  const margin = 60
  const baseY = h * 0.1 + Math.random() * (h * 0.38)
  const t = {
    type: def.type,
    color: def.color,
    golden: def.golden || false,
    x: margin + Math.random() * (w - margin * 2),
    y: baseY,
    baseY: baseY,
    size: def.type === "flower" ? 18 + Math.random() * 10 : 22 + Math.random() * 14,
    hit: false,
    hitTime: 0,
    hitScale: 1,
    hitAlpha: 1,
    wetness: 0,
    shakeAmount: 0,
    phase: Math.random() * Math.PI * 2,
    sway: 0,
    wingPhase: Math.random() * Math.PI * 2,
    moveDir: Math.random() < 0.5 ? 1 : -1,
    bobPhase: Math.random() * Math.PI * 2,
    hopTimer: 0,
    hopVY: 0,
    hopVX: 0
  }
  if (def.petalColor) t.petalColor = def.petalColor
  if (def.wingColor) t.wingColor = def.wingColor
  if (def.beakColor) t.beakColor = def.beakColor
  if (def.chestColor) t.chestColor = def.chestColor
  if (def.tailColor) t.tailColor = def.tailColor
  if (def.bellyColor) t.bellyColor = def.bellyColor
  if (def.spotColor) t.spotColor = def.spotColor
  if (def.earColor) t.earColor = def.earColor

  // hippos spawn near water
  if (def.type === "hippo") {
    t.y = h * 0.54 + Math.random() * 0.06 * h
    t.baseY = t.y
    t.size = 30 + Math.random() * 10
  }

  targets.push(t)
}

function drawElephant(ctx, e) {
  ctx.save()
  ctx.translate(e.x, e.y + e.bounceY)
  const sz = e.size
  const happyScale = 1 + e.happiness * 0.08

  ctx.scale(happyScale, happyScale)

  // shadow under elephant in water
  ctx.beginPath()
  ctx.ellipse(0, sz * 0.15, sz * 1.1, sz * 0.15, 0, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(0,0,0,0.1)"
  ctx.fill()

  // body
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.3, sz * 0.95, sz * 0.65, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#8a8a9a"
  ctx.fill()

  // belly highlight
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.15, sz * 0.65, sz * 0.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#a0a0b2"
  ctx.fill()

  // ears with animation
  const earBob = Math.sin(e.earPhase) * 0.18
  const earFlap = e.happiness * 0.3
  // left ear
  ctx.save()
  ctx.translate(-sz * 0.65, -sz * 0.65)
  ctx.rotate(-0.25 + earBob - earFlap)
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.38, sz * 0.5, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = "#7a7a8a"
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(sz * 0.05, sz * 0.05, sz * 0.22, sz * 0.32, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = "#c0889a"
  ctx.fill()
  ctx.restore()
  // right ear
  ctx.save()
  ctx.translate(sz * 0.65, -sz * 0.65)
  ctx.rotate(0.25 - earBob + earFlap)
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.38, sz * 0.5, 0.2, 0, Math.PI * 2)
  ctx.fillStyle = "#7a7a8a"
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-sz * 0.05, sz * 0.05, sz * 0.22, sz * 0.32, 0.2, 0, Math.PI * 2)
  ctx.fillStyle = "#c0889a"
  ctx.fill()
  ctx.restore()

  // head
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.72, sz * 0.48, sz * 0.45, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#8a8a9a"
  ctx.fill()

  // trunk (segmented for curl)
  ctx.save()
  ctx.translate(0, -sz * 0.58)
  const segments = 10
  const trunkLen = sz * 1.6
  // trunk shadow
  ctx.strokeStyle = "#7a7a8a"
  ctx.lineWidth = 16
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(0, 2)
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const curl = Math.sin(t * Math.PI * 0.5) * 0.2 + (e.spraying ? Math.sin(time * 8 + t * 4) * 0.03 : 0)
    const tx = Math.cos(e.trunkAngle + curl) * trunkLen * t
    const ty = Math.sin(e.trunkAngle + curl) * trunkLen * t + 2
    ctx.lineTo(tx, ty)
  }
  ctx.stroke()

  // main trunk
  ctx.strokeStyle = "#8a8a9a"
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.moveTo(0, 0)
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const curl = Math.sin(t * Math.PI * 0.5) * 0.2 + (e.spraying ? Math.sin(time * 8 + t * 4) * 0.03 : 0)
    const tx = Math.cos(e.trunkAngle + curl) * trunkLen * t
    const ty = Math.sin(e.trunkAngle + curl) * trunkLen * t
    ctx.lineTo(tx, ty)
  }
  ctx.stroke()

  // trunk underside highlight
  ctx.strokeStyle = "#a0a0b2"
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(0, 0)
  for (let i = 1; i <= segments; i++) {
    const t = i / segments
    const curl = Math.sin(t * Math.PI * 0.5) * 0.2 + (e.spraying ? Math.sin(time * 8 + t * 4) * 0.03 : 0)
    const tx = Math.cos(e.trunkAngle + curl) * trunkLen * t
    const ty = Math.sin(e.trunkAngle + curl) * trunkLen * t + 3
    ctx.lineTo(tx, ty)
  }
  ctx.stroke()

  // trunk ridges
  ctx.strokeStyle = "rgba(0,0,0,0.06)"
  ctx.lineWidth = 12
  for (let i = 2; i < segments; i += 2) {
    const t = i / segments
    const curl = Math.sin(t * Math.PI * 0.5) * 0.2
    const tx = Math.cos(e.trunkAngle + curl) * trunkLen * t
    const ty = Math.sin(e.trunkAngle + curl) * trunkLen * t
    const perpAngle = e.trunkAngle + curl + Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(tx + Math.cos(perpAngle) * 6, ty + Math.sin(perpAngle) * 6)
    ctx.lineTo(tx - Math.cos(perpAngle) * 6, ty - Math.sin(perpAngle) * 6)
    ctx.stroke()
  }

  // trunk tip glow when spraying
  if (e.spraying) {
    const tipX = Math.cos(e.trunkAngle) * trunkLen
    const tipY = Math.sin(e.trunkAngle) * trunkLen
    const glow = ctx.createRadialGradient(tipX, tipY, 2, tipX, tipY, 18)
    glow.addColorStop(0, "rgba(100,200,255,0.5)")
    glow.addColorStop(1, "rgba(100,200,255,0)")
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(tipX, tipY, 18, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // eyes
  const squint = e.eyeSquint
  const eyeH = sz * 0.12 * (1 - squint * 0.6)
  // left eye
  ctx.beginPath()
  ctx.ellipse(-sz * 0.2, -sz * 0.82, sz * 0.13, eyeH, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-sz * 0.17, -sz * 0.82, sz * 0.07, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-sz * 0.15, -sz * 0.84, sz * 0.03, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  // right eye
  ctx.beginPath()
  ctx.ellipse(sz * 0.2, -sz * 0.82, sz * 0.13, eyeH, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.23, -sz * 0.82, sz * 0.07, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.25, -sz * 0.84, sz * 0.03, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()

  // happy mouth
  if (e.happiness > 0.1) {
    ctx.beginPath()
    ctx.arc(0, -sz * 0.58, sz * 0.15, 0.2, Math.PI - 0.2)
    ctx.strokeStyle = `rgba(80,60,60,${e.happiness * 0.6})`
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.stroke()
  }

  // cheek blush
  ctx.beginPath()
  ctx.arc(-sz * 0.35, -sz * 0.62, sz * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,150,170,0.3)"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.35, -sz * 0.62, sz * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,150,170,0.3)"
  ctx.fill()

  // water line around body
  ctx.beginPath()
  for (let i = -sz; i <= sz; i += 3) {
    const wy = Math.sin(i * 0.12 + time * 3) * 4
    if (i === -sz) ctx.moveTo(i, wy)
    else ctx.lineTo(i, wy)
  }
  ctx.strokeStyle = "rgba(255,255,255,0.35)"
  ctx.lineWidth = 2.5
  ctx.stroke()

  // water drops on body (when spraying a lot)
  if (e.spraying) {
    ctx.fillStyle = "rgba(100,190,255,0.3)"
    for (let i = 0; i < 5; i++) {
      const dx = Math.sin(time * 3 + i * 2) * sz * 0.6
      const dy = -sz * 0.3 + Math.cos(time * 2 + i * 3) * sz * 0.3
      ctx.beginPath()
      ctx.arc(dx, dy, 2 + Math.sin(time + i) * 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}

function drawTarget(ctx, t) {
  ctx.save()
  ctx.translate(t.x, t.y)

  // hit reaction
  if (t.hit) {
    const s = t.hitScale || 1
    ctx.scale(s, s)
    ctx.globalAlpha = t.hitAlpha || 1
  }

  // shake when getting wet
  if (t.shakeAmount > 0.1) {
    ctx.translate(Math.sin(time * 40) * t.shakeAmount, Math.cos(time * 35) * t.shakeAmount * 0.5)
  }

  // golden glow
  if (t.golden && !t.hit) {
    const gg = ctx.createRadialGradient(0, 0, t.size * 0.5, 0, 0, t.size * 2)
    gg.addColorStop(0, "rgba(255,215,0,0.3)")
    gg.addColorStop(1, "rgba(255,215,0,0)")
    ctx.fillStyle = gg
    ctx.beginPath()
    ctx.arc(0, 0, t.size * 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // wetness glow
  if (t.wetness > 0) {
    ctx.beginPath()
    ctx.arc(0, 0, t.size + 10, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(100,180,255,${t.wetness * 0.35})`
    ctx.fill()
    // drips
    for (let i = 0; i < 3; i++) {
      const dx = Math.sin(i * 2.1 + time * 2) * t.size * 0.5
      const dripY = t.size * 0.3 + t.wetness * 15 + Math.sin(time * 3 + i) * 3
      ctx.beginPath()
      ctx.ellipse(dx, dripY, 2, 3 + t.wetness * 2, 0, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(100,180,255,${t.wetness * 0.5})`
      ctx.fill()
    }
  }

  if (t.type === "flower") {
    drawFlower(ctx, t)
  } else if (t.type === "butterfly") {
    drawButterfly(ctx, t)
  } else if (t.type === "bird") {
    drawBird(ctx, t)
  } else if (t.type === "giraffe") {
    drawGiraffe(ctx, t)
  } else if (t.type === "monkey") {
    drawMonkey(ctx, t)
  } else if (t.type === "frog") {
    drawFrog(ctx, t)
  } else if (t.type === "toucan") {
    drawToucan(ctx, t)
  } else if (t.type === "parrot") {
    drawParrot(ctx, t)
  } else if (t.type === "hippo") {
    drawHippo(ctx, t)
  }

  ctx.restore()
}

function drawFlower(ctx, t) {
  ctx.rotate(t.sway || 0)
  // stem
  ctx.strokeStyle = "#3a9a3a"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, t.size * 0.5)
  ctx.quadraticCurveTo(Math.sin(time + t.phase) * 3, t.size * 0.8, 0, t.size * 1.3)
  ctx.stroke()
  // leaf
  ctx.fillStyle = "#4aaa4a"
  ctx.beginPath()
  ctx.ellipse(t.size * 0.2, t.size * 0.9, t.size * 0.2, t.size * 0.08, 0.4, 0, Math.PI * 2)
  ctx.fill()
  // petals with depth
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.sin(time * 0.5 + t.phase) * 0.05
    ctx.beginPath()
    ctx.ellipse(
      Math.cos(a) * t.size * 0.4,
      Math.sin(a) * t.size * 0.4,
      t.size * 0.35, t.size * 0.2, a, 0, Math.PI * 2
    )
    ctx.fillStyle = t.petalColor || t.color
    ctx.fill()
    // petal vein
    ctx.strokeStyle = "rgba(0,0,0,0.06)"
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * t.size * 0.55, Math.sin(a) * t.size * 0.55)
    ctx.stroke()
  }
  // center with texture
  ctx.beginPath()
  ctx.arc(0, 0, t.size * 0.28, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // center dots
  ctx.fillStyle = "rgba(0,0,0,0.1)"
  for (let i = 0; i < 4; i++) {
    const a = i * 1.5 + t.phase
    ctx.beginPath()
    ctx.arc(Math.cos(a) * t.size * 0.12, Math.sin(a) * t.size * 0.12, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawButterfly(ctx, t) {
  const wingFlap = Math.sin(t.wingPhase) * 0.5
  // trail sparkles for golden
  if (t.golden) {
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.3 + Math.sin(time * 5 + i) * 0.2
      ctx.beginPath()
      ctx.arc(
        Math.sin(time * 3 + i * 2) * 8,
        Math.cos(time * 2 + i * 3) * 8,
        1.5 + Math.sin(time * 8 + i) * 1, 0, Math.PI * 2
      )
      ctx.fillStyle = "#ffd700"
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  // left wings
  ctx.save()
  ctx.scale(1, Math.cos(wingFlap))
  // outer wing
  ctx.beginPath()
  ctx.ellipse(-t.size * 0.42, -t.size * 0.05, t.size * 0.55, t.size * 0.75, -0.15, 0, Math.PI * 2)
  ctx.fillStyle = t.wingColor
  ctx.fill()
  // inner pattern
  ctx.beginPath()
  ctx.ellipse(-t.size * 0.38, -t.size * 0.05, t.size * 0.3, t.size * 0.4, -0.15, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // wing dots
  ctx.beginPath()
  ctx.arc(-t.size * 0.5, -t.size * 0.2, t.size * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  ctx.fill()
  // lower wing
  ctx.beginPath()
  ctx.ellipse(-t.size * 0.3, t.size * 0.25, t.size * 0.35, t.size * 0.4, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = t.wingColor
  ctx.globalAlpha = 0.8
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
  // right wings
  ctx.save()
  ctx.scale(1, Math.cos(wingFlap + 0.5))
  ctx.beginPath()
  ctx.ellipse(t.size * 0.42, -t.size * 0.05, t.size * 0.55, t.size * 0.75, 0.15, 0, Math.PI * 2)
  ctx.fillStyle = t.wingColor
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(t.size * 0.38, -t.size * 0.05, t.size * 0.3, t.size * 0.4, 0.15, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  ctx.beginPath()
  ctx.arc(t.size * 0.5, -t.size * 0.2, t.size * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(t.size * 0.3, t.size * 0.25, t.size * 0.35, t.size * 0.4, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = t.wingColor
  ctx.globalAlpha = 0.8
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, 3.5, t.size * 0.42, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#333"
  ctx.fill()
  // head
  ctx.beginPath()
  ctx.arc(0, -t.size * 0.4, t.size * 0.08, 0, Math.PI * 2)
  ctx.fill()
  // antennae with curls
  ctx.strokeStyle = "#333"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, -t.size * 0.38)
  ctx.bezierCurveTo(-4, -t.size * 0.6, -12, -t.size * 0.7, -8, -t.size * 0.75)
  ctx.moveTo(0, -t.size * 0.38)
  ctx.bezierCurveTo(4, -t.size * 0.6, 12, -t.size * 0.7, 8, -t.size * 0.75)
  ctx.stroke()
  // antenna tips
  ctx.beginPath()
  ctx.arc(-8, -t.size * 0.75, 2, 0, Math.PI * 2)
  ctx.arc(8, -t.size * 0.75, 2, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
}

function drawBird(ctx, t) {
  const wingUp = Math.sin(t.wingPhase) * 0.6
  // tail feathers
  ctx.fillStyle = t.wingColor
  ctx.beginPath()
  ctx.moveTo(-t.size * 0.45, 0)
  ctx.lineTo(-t.size * 0.8, t.size * 0.15)
  ctx.lineTo(-t.size * 0.7, -t.size * 0.1)
  ctx.lineTo(-t.size * 0.85, 0)
  ctx.fill()
  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, t.size * 0.5, t.size * 0.32, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // chest
  ctx.beginPath()
  ctx.ellipse(t.size * 0.1, t.size * 0.08, t.size * 0.25, t.size * 0.2, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#ffbcbc"
  ctx.fill()
  // wing
  ctx.save()
  ctx.rotate(wingUp)
  ctx.beginPath()
  ctx.ellipse(-t.size * 0.05, -t.size * 0.28, t.size * 0.55, t.size * 0.22, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = t.wingColor
  ctx.fill()
  ctx.restore()
  // head
  ctx.beginPath()
  ctx.arc(t.size * 0.4, -t.size * 0.12, t.size * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // eye
  ctx.beginPath()
  ctx.arc(t.size * 0.48, -t.size * 0.17, 3, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(t.size * 0.5, -t.size * 0.17, 1.5, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  // beak
  ctx.beginPath()
  ctx.moveTo(t.size * 0.6, -t.size * 0.12)
  ctx.lineTo(t.size * 0.8, -t.size * 0.06)
  ctx.lineTo(t.size * 0.6, 0)
  ctx.fillStyle = "#ff9f43"
  ctx.fill()
}

function drawGiraffe(ctx, t) {
  const sz = t.size
  const bob = Math.sin((t.bobPhase || 0)) * 3
  // legs
  ctx.fillStyle = t.color
  for (const lx of [-0.28, -0.12, 0.12, 0.28]) {
    ctx.fillRect(lx * sz - 3, sz * 0.55, 7, sz * 0.4)
    // hooves
    ctx.fillStyle = "#8a6a2e"
    ctx.fillRect(lx * sz - 3, sz * 0.9, 7, 5)
    ctx.fillStyle = t.color
  }
  // body
  ctx.beginPath()
  ctx.ellipse(0, sz * 0.3, sz * 0.52, sz * 0.38, 0, 0, Math.PI * 2)
  ctx.fill()
  // neck
  ctx.beginPath()
  ctx.roundRect(-sz * 0.15, -sz * 0.9 + bob, sz * 0.3, sz * 1.3, 6)
  ctx.fill()
  // mane
  ctx.strokeStyle = "#c4872e"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, -sz * 0.8 + bob)
  ctx.lineTo(0, sz * 0.2)
  ctx.stroke()
  // head
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.95 + bob, sz * 0.28, sz * 0.22, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // spots
  ctx.fillStyle = t.spotColor
  const spots = [[0, -0.3], [-0.12, 0.1], [0.12, 0], [0.05, 0.5], [-0.15, 0.4], [0.15, 0.35]]
  spots.forEach(([sx, sy]) => {
    ctx.beginPath()
    ctx.ellipse(sx * sz, sy * sz, sz * 0.09, sz * 0.07, sx * 0.5, 0, Math.PI * 2)
    ctx.fill()
  })
  // horns (ossicones)
  ctx.strokeStyle = t.color
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(-sz * 0.1, -sz * 1.1 + bob)
  ctx.lineTo(-sz * 0.12, -sz * 1.3 + bob)
  ctx.moveTo(sz * 0.1, -sz * 1.1 + bob)
  ctx.lineTo(sz * 0.12, -sz * 1.3 + bob)
  ctx.stroke()
  ctx.fillStyle = "#c4872e"
  ctx.beginPath()
  ctx.arc(-sz * 0.12, -sz * 1.32 + bob, 4, 0, Math.PI * 2)
  ctx.arc(sz * 0.12, -sz * 1.32 + bob, 4, 0, Math.PI * 2)
  ctx.fill()
  // eyes
  ctx.beginPath()
  ctx.arc(-sz * 0.1, -sz * 0.98 + bob, sz * 0.07, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-sz * 0.08, -sz * 0.98 + bob, sz * 0.04, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.1, -sz * 0.98 + bob, sz * 0.07, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.12, -sz * 0.98 + bob, sz * 0.04, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  // nostrils
  ctx.fillStyle = "#8a6a2e"
  ctx.beginPath()
  ctx.arc(-sz * 0.05, -sz * 0.85 + bob, 2, 0, Math.PI * 2)
  ctx.arc(sz * 0.05, -sz * 0.85 + bob, 2, 0, Math.PI * 2)
  ctx.fill()
}

function drawMonkey(ctx, t) {
  const sz = t.size
  // tail (curly)
  ctx.beginPath()
  ctx.moveTo(-sz * 0.3, sz * 0.2)
  ctx.bezierCurveTo(-sz * 0.8, sz * 0.1, -sz * 0.7, -sz * 0.4, -sz * 0.4, -sz * 0.3)
  ctx.bezierCurveTo(-sz * 0.3, -sz * 0.2, -sz * 0.5, -sz * 0.5, -sz * 0.3, -sz * 0.45)
  ctx.strokeStyle = t.color
  ctx.lineWidth = 3.5
  ctx.lineCap = "round"
  ctx.stroke()
  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.42, sz * 0.52, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // belly
  ctx.beginPath()
  ctx.ellipse(0, sz * 0.08, sz * 0.28, sz * 0.32, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.bellyColor
  ctx.fill()
  // arms
  ctx.strokeStyle = t.color
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(-sz * 0.35, -sz * 0.1)
  ctx.quadraticCurveTo(-sz * 0.6, sz * 0.1, -sz * 0.55, sz * 0.3)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(sz * 0.35, -sz * 0.1)
  ctx.quadraticCurveTo(sz * 0.6, sz * 0.1, sz * 0.55, sz * 0.3)
  ctx.stroke()
  // head
  ctx.beginPath()
  ctx.arc(0, -sz * 0.52, sz * 0.34, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // face
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.44, sz * 0.24, sz * 0.22, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.bellyColor
  ctx.fill()
  // ears
  ctx.beginPath()
  ctx.arc(-sz * 0.32, -sz * 0.52, sz * 0.14, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-sz * 0.32, -sz * 0.52, sz * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = t.bellyColor
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.32, -sz * 0.52, sz * 0.14, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.32, -sz * 0.52, sz * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = t.bellyColor
  ctx.fill()
  // eyes
  ctx.beginPath()
  ctx.arc(-sz * 0.12, -sz * 0.52, sz * 0.07, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-sz * 0.1, -sz * 0.52, sz * 0.04, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.12, -sz * 0.52, sz * 0.07, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.14, -sz * 0.52, sz * 0.04, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  // smile
  ctx.beginPath()
  ctx.arc(0, -sz * 0.38, sz * 0.1, 0.2, Math.PI - 0.2)
  ctx.strokeStyle = "#5a3520"
  ctx.lineWidth = 2
  ctx.stroke()
  // nose
  ctx.fillStyle = "#5a3520"
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.44, sz * 0.05, sz * 0.03, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawFrog(ctx, t) {
  const sz = t.size
  // back legs
  ctx.fillStyle = t.color
  ctx.beginPath()
  ctx.ellipse(-sz * 0.35, sz * 0.25, sz * 0.22, sz * 0.1, -0.5, 0, Math.PI * 2)
  ctx.ellipse(sz * 0.35, sz * 0.25, sz * 0.22, sz * 0.1, 0.5, 0, Math.PI * 2)
  ctx.fill()
  // feet
  ctx.fillStyle = "#1db954"
  ctx.beginPath()
  ctx.ellipse(-sz * 0.5, sz * 0.3, sz * 0.15, sz * 0.06, -0.3, 0, Math.PI * 2)
  ctx.ellipse(sz * 0.5, sz * 0.3, sz * 0.15, sz * 0.06, 0.3, 0, Math.PI * 2)
  ctx.fill()
  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.48, sz * 0.38, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // belly
  ctx.beginPath()
  ctx.ellipse(0, sz * 0.08, sz * 0.32, sz * 0.22, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.bellyColor
  ctx.fill()
  // spots on back
  ctx.fillStyle = "#1db954"
  ctx.beginPath()
  ctx.arc(-sz * 0.15, -sz * 0.1, sz * 0.06, 0, Math.PI * 2)
  ctx.arc(sz * 0.1, -sz * 0.05, sz * 0.05, 0, Math.PI * 2)
  ctx.arc(sz * 0.2, -sz * 0.15, sz * 0.04, 0, Math.PI * 2)
  ctx.fill()
  // eyes (big, on top)
  ctx.beginPath()
  ctx.arc(-sz * 0.22, -sz * 0.32, sz * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.22, -sz * 0.32, sz * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  // pupils
  ctx.beginPath()
  ctx.ellipse(-sz * 0.2, -sz * 0.32, sz * 0.06, sz * 0.1, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(sz * 0.2, -sz * 0.32, sz * 0.06, sz * 0.1, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  // eye shines
  ctx.beginPath()
  ctx.arc(-sz * 0.24, -sz * 0.36, sz * 0.04, 0, Math.PI * 2)
  ctx.arc(sz * 0.18, -sz * 0.36, sz * 0.04, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  // mouth
  ctx.beginPath()
  ctx.arc(0, sz * 0.08, sz * 0.22, 0.1, Math.PI - 0.1)
  ctx.strokeStyle = "#1a9960"
  ctx.lineWidth = 2
  ctx.stroke()
  // front legs
  ctx.fillStyle = t.color
  ctx.beginPath()
  ctx.ellipse(-sz * 0.42, sz * 0.22, sz * 0.14, sz * 0.07, -0.3, 0, Math.PI * 2)
  ctx.ellipse(sz * 0.42, sz * 0.22, sz * 0.14, sz * 0.07, 0.3, 0, Math.PI * 2)
  ctx.fill()
}

function drawToucan(ctx, t) {
  const sz = t.size
  const wingUp = Math.sin(t.wingPhase) * 0.4
  // tail
  ctx.fillStyle = t.color
  ctx.beginPath()
  ctx.moveTo(-sz * 0.4, sz * 0.1)
  ctx.lineTo(-sz * 0.7, sz * 0.25)
  ctx.lineTo(-sz * 0.65, 0)
  ctx.fill()
  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.45, sz * 0.35, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // chest
  ctx.beginPath()
  ctx.ellipse(sz * 0.05, sz * 0.08, sz * 0.28, sz * 0.22, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.chestColor
  ctx.fill()
  // wing
  ctx.save()
  ctx.rotate(wingUp)
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.2, sz * 0.5, sz * 0.18, -0.15, 0, Math.PI * 2)
  ctx.fillStyle = "#3d3d3d"
  ctx.fill()
  ctx.restore()
  // head
  ctx.beginPath()
  ctx.arc(sz * 0.35, -sz * 0.15, sz * 0.25, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // big beak!
  const beakGrad = ctx.createLinearGradient(sz * 0.5, -sz * 0.2, sz * 1.1, sz * 0.1)
  beakGrad.addColorStop(0, t.beakColor)
  beakGrad.addColorStop(0.5, "#ff6348")
  beakGrad.addColorStop(1, "#ffa502")
  ctx.fillStyle = beakGrad
  ctx.beginPath()
  ctx.moveTo(sz * 0.52, -sz * 0.22)
  ctx.quadraticCurveTo(sz * 1.1, -sz * 0.15, sz * 1.05, sz * 0.05)
  ctx.lineTo(sz * 0.52, sz * 0.02)
  ctx.fill()
  // beak stripe
  ctx.strokeStyle = "rgba(0,0,0,0.15)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(sz * 0.55, -sz * 0.08)
  ctx.lineTo(sz * 0.95, -sz * 0.04)
  ctx.stroke()
  // eye ring
  ctx.beginPath()
  ctx.arc(sz * 0.42, -sz * 0.18, sz * 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "#2d87f0"
  ctx.fill()
  // eye
  ctx.beginPath()
  ctx.arc(sz * 0.42, -sz * 0.18, sz * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.44, -sz * 0.18, sz * 0.03, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
}

function drawParrot(ctx, t) {
  const sz = t.size
  const wingUp = Math.sin(t.wingPhase) * 0.5
  // tail feathers (colorful)
  ctx.fillStyle = t.tailColor
  ctx.beginPath()
  ctx.moveTo(-sz * 0.3, sz * 0.2)
  ctx.lineTo(-sz * 0.7, sz * 0.6)
  ctx.lineTo(-sz * 0.5, sz * 0.15)
  ctx.fill()
  ctx.fillStyle = "#feca57"
  ctx.beginPath()
  ctx.moveTo(-sz * 0.25, sz * 0.2)
  ctx.lineTo(-sz * 0.55, sz * 0.55)
  ctx.lineTo(-sz * 0.4, sz * 0.15)
  ctx.fill()
  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.42, sz * 0.35, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // wing
  ctx.save()
  ctx.rotate(wingUp)
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.2, sz * 0.5, sz * 0.2, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = t.wingColor
  ctx.fill()
  // wing tip
  ctx.beginPath()
  ctx.ellipse(-sz * 0.2, -sz * 0.3, sz * 0.25, sz * 0.12, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = t.tailColor
  ctx.fill()
  ctx.restore()
  // head
  ctx.beginPath()
  ctx.arc(sz * 0.3, -sz * 0.2, sz * 0.25, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // head crest
  ctx.fillStyle = "#feca57"
  ctx.beginPath()
  ctx.moveTo(sz * 0.2, -sz * 0.42)
  ctx.quadraticCurveTo(sz * 0.35, -sz * 0.65, sz * 0.15, -sz * 0.6)
  ctx.fill()
  // eye ring
  ctx.beginPath()
  ctx.arc(sz * 0.38, -sz * 0.22, sz * 0.09, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.4, -sz * 0.22, sz * 0.05, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  // curved beak
  ctx.fillStyle = "#333"
  ctx.beginPath()
  ctx.moveTo(sz * 0.5, -sz * 0.2)
  ctx.quadraticCurveTo(sz * 0.7, -sz * 0.15, sz * 0.6, sz * 0.0)
  ctx.quadraticCurveTo(sz * 0.5, -sz * 0.05, sz * 0.48, -sz * 0.1)
  ctx.fill()
}

function drawHippo(ctx, t) {
  const sz = t.size
  const bob = Math.sin((t.bobPhase || 0)) * 5
  // body mostly submerged - just show top
  ctx.beginPath()
  ctx.ellipse(0, bob, sz * 0.7, sz * 0.3, 0, Math.PI + 0.2, -0.2)
  ctx.fillStyle = t.color
  ctx.fill()
  // head
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.2 + bob, sz * 0.5, sz * 0.35, 0, 0, Math.PI * 2)
  ctx.fillStyle = t.color
  ctx.fill()
  // snout bump
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.05 + bob, sz * 0.35, sz * 0.22, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#7d8a8e"
  ctx.fill()
  // nostrils
  ctx.fillStyle = "#4a5558"
  ctx.beginPath()
  ctx.ellipse(-sz * 0.1, -sz * 0.08 + bob, sz * 0.06, sz * 0.04, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(sz * 0.1, -sz * 0.08 + bob, sz * 0.06, sz * 0.04, 0, 0, Math.PI * 2)
  ctx.fill()
  // ears
  ctx.beginPath()
  ctx.ellipse(-sz * 0.35, -sz * 0.4 + bob, sz * 0.1, sz * 0.13, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = t.earColor
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(sz * 0.35, -sz * 0.4 + bob, sz * 0.1, sz * 0.13, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = t.earColor
  ctx.fill()
  // eyes
  ctx.beginPath()
  ctx.arc(-sz * 0.2, -sz * 0.32 + bob, sz * 0.09, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-sz * 0.18, -sz * 0.32 + bob, sz * 0.05, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.2, -sz * 0.32 + bob, sz * 0.09, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.22, -sz * 0.32 + bob, sz * 0.05, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  // water line around hippo
  ctx.beginPath()
  for (let i = -sz * 0.7; i <= sz * 0.7; i += 3) {
    const wy = Math.sin(i * 0.15 + time * 3) * 3 + bob + sz * 0.05
    if (i === -sz * 0.7) ctx.moveTo(i, wy)
    else ctx.lineTo(i, wy)
  }
  ctx.strokeStyle = "rgba(255,255,255,0.3)"
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawLilypad(ctx, lp) {
  ctx.save()
  ctx.translate(lp.x, lp.y)
  ctx.rotate(lp.rot)
  // pad
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, lp.size, 0.2, Math.PI * 2 - 0.2)
  ctx.closePath()
  ctx.fillStyle = "#3a8a3a"
  ctx.fill()
  // vein lines
  ctx.strokeStyle = "rgba(0,0,0,0.08)"
  ctx.lineWidth = 0.8
  for (let i = 0; i < 5; i++) {
    const a = 0.4 + i * 1.1
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * lp.size * 0.85, Math.sin(a) * lp.size * 0.85)
    ctx.stroke()
  }
  // highlight
  ctx.beginPath()
  ctx.ellipse(lp.size * 0.2, -lp.size * 0.15, lp.size * 0.3, lp.size * 0.15, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.1)"
  ctx.fill()
  // flower on some
  if (lp.hasFlower) {
    const fx = lp.size * 0.3
    const fy = -lp.size * 0.3
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.sin(time * 0.5) * 0.1
      ctx.beginPath()
      ctx.ellipse(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5, 6, 3.5, a, 0, Math.PI * 2)
      ctx.fillStyle = lp.flowerColor
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(fx, fy, 3, 0, Math.PI * 2)
    ctx.fillStyle = "#feca57"
    ctx.fill()
  }
  ctx.restore()
}

function drawDragonfly(ctx, d) {
  ctx.save()
  ctx.translate(d.x, d.y)
  const angle = Math.atan2(d.vy, d.vx)
  ctx.rotate(angle)
  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, d.size, d.size * 0.2, 0, 0, Math.PI * 2)
  ctx.fillStyle = d.color
  ctx.fill()
  // tail
  ctx.beginPath()
  ctx.moveTo(-d.size, 0)
  ctx.lineTo(-d.size * 2.5, 0)
  ctx.strokeStyle = d.color
  ctx.lineWidth = 1.5
  ctx.stroke()
  // wings
  const wingFlap = Math.sin(d.wingPhase) * 0.6
  ctx.globalAlpha = 0.4
  ctx.fillStyle = "#fff"
  // upper wings
  ctx.save()
  ctx.rotate(wingFlap)
  ctx.beginPath()
  ctx.ellipse(d.size * 0.2, -d.size * 0.3, d.size * 1.2, d.size * 0.3, -0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.rotate(-wingFlap)
  ctx.beginPath()
  ctx.ellipse(d.size * 0.2, d.size * 0.3, d.size * 1.2, d.size * 0.3, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.globalAlpha = 1
  // eyes
  ctx.beginPath()
  ctx.arc(d.size * 0.8, -d.size * 0.1, d.size * 0.15, 0, Math.PI * 2)
  ctx.arc(d.size * 0.8, d.size * 0.1, d.size * 0.15, 0, Math.PI * 2)
  ctx.fillStyle = d.color
  ctx.fill()
  ctx.restore()
}

function drawBaobab(ctx, x, y, scale) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  // trunk
  ctx.fillStyle = "#8a6a4a"
  ctx.beginPath()
  ctx.moveTo(-15, 0)
  ctx.quadraticCurveTo(-20, -60, -12, -90)
  ctx.lineTo(12, -90)
  ctx.quadraticCurveTo(20, -60, 15, 0)
  ctx.fill()
  // canopy
  ctx.beginPath()
  ctx.arc(0, -100, 45, 0, Math.PI * 2)
  ctx.fillStyle = "#4a8a4a"
  ctx.globalAlpha = 0.5
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-20, -90, 30, 0, Math.PI * 2)
  ctx.arc(25, -95, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
}

function drawSmallFlower(ctx, x, y, t) {
  ctx.save()
  ctx.translate(x, y)
  const colors = ['#ff6b9d', '#feca57', '#a55eea', '#ff9ff3']
  const c = colors[Math.floor(x * 0.1) % 4]
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.sin(t * 0.8 + x) * 0.2
    ctx.beginPath()
    ctx.arc(Math.cos(a) * 4, Math.sin(a) * 4, 3, 0, Math.PI * 2)
    ctx.fillStyle = c
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, 2, 0, Math.PI * 2)
  ctx.fillStyle = "#feca57"
  ctx.fill()
  ctx.restore()
}

function drawCloud(ctx, x, y, r, alpha) {
  ctx.globalAlpha = alpha || 0.7
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.arc(x + r * 0.9, y - r * 0.15, r * 0.75, 0, Math.PI * 2)
  ctx.arc(x - r * 0.7, y + r * 0.1, r * 0.65, 0, Math.PI * 2)
  ctx.arc(x + r * 0.3, y - r * 0.35, r * 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawReed(ctx, x, y, dir) {
  const sway = Math.sin(time * 1.5 + x * 0.3) * 7 * (dir || 1)
  ctx.strokeStyle = "#3a8a3a"
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(x + sway * 0.5, y - 30, x + sway, y - 55)
  ctx.stroke()
  // cattail top
  ctx.fillStyle = "#6a5a3a"
  ctx.beginPath()
  ctx.ellipse(x + sway, y - 58, 4, 10, sway * 0.01, 0, Math.PI * 2)
  ctx.fill()
  // leaf
  ctx.strokeStyle = "#4aaa4a"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y - 15)
  ctx.quadraticCurveTo(x + sway * 0.8 + dir * 12, y - 30, x + dir * 18, y - 25)
  ctx.stroke()
}
