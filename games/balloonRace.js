import { celebrate, celebrateBig } from "../engine/celebrate.js"

let audioCtx
let ctx, input, w, h
let tapHandler, dragHandler, dragEndHandler
let balloons, launched, score, time
let clouds, farClouds, hills, particles, sparkles, scorePopups
let grabId, grabStartY, grabCurrentY
let combo, comboTimer, lastLaunchTime
let screenShake, windPhase
let birds, bunting, flowers, grassBlades
let rainbowAlpha, totalLaunched

const COLORS = [
  "#ff6b6b", "#54a0ff", "#feca57", "#26de81", "#a55eea",
  "#ff9ff3", "#ff9f43", "#48dbfb", "#e74c3c", "#00cec9"
]

const PATTERNS = ["none", "stripes", "dots", "star", "heart"]
const SHAPES = ["oval", "oval", "oval", "round", "long"] // weighted toward oval

const BALLOON_W = 55
const BALLOON_H = 68

let nextId = 1

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = ctx.canvas.width
    h = ctx.canvas.height
    score = 0
    time = 0
    combo = 0
    comboTimer = 0
    lastLaunchTime = 0
    screenShake = 0
    windPhase = 0
    rainbowAlpha = 0
    totalLaunched = 0
    balloons = []
    launched = []
    particles = []
    sparkles = []
    scorePopups = []
    grabId = null

    // far clouds (parallax)
    farClouds = []
    for (let i = 0; i < 3; i++) {
      farClouds.push({
        x: Math.random() * w,
        y: 20 + Math.random() * 60,
        r: 30 + Math.random() * 40,
        speed: 3 + Math.random() * 5
      })
    }

    // near clouds
    clouds = []
    for (let i = 0; i < 5; i++) {
      clouds.push({
        x: Math.random() * w,
        y: 30 + Math.random() * 140,
        r: 18 + Math.random() * 28,
        speed: 6 + Math.random() * 12
      })
    }

    // rolling hills
    hills = [
      { color: "#8dd48d", yBase: 0.88, amp: 25, freq: 0.005, offset: 0 },
      { color: "#7cc47c", yBase: 0.9, amp: 18, freq: 0.008, offset: 2 },
      { color: "#6bb86b", yBase: 0.92, amp: 12, freq: 0.012, offset: 4 }
    ]

    // birds
    birds = []
    for (let i = 0; i < 3; i++) {
      birds.push({
        x: Math.random() * w,
        y: 30 + Math.random() * 80,
        speed: 15 + Math.random() * 30,
        dir: Math.random() < 0.5 ? 1 : -1,
        wingPhase: Math.random() * Math.PI * 2,
        size: 4 + Math.random() * 3
      })
    }

    // bunting flags
    bunting = []
    const buntingColors = ["#ff6b6b", "#54a0ff", "#feca57", "#26de81", "#a55eea", "#ff9ff3"]
    for (let bx = 30; bx < w; bx += 35) {
      bunting.push({
        x: bx,
        color: buntingColors[Math.floor(Math.random() * buntingColors.length)],
        phase: bx * 0.05
      })
    }

    // ground flowers
    flowers = []
    for (let fx = 20; fx < w; fx += 50 + Math.random() * 60) {
      flowers.push({
        x: fx,
        color: ['#ff6b9d', '#feca57', '#fff', '#ff9ff3', '#a55eea'][Math.floor(Math.random() * 5)],
        size: 3 + Math.random() * 3,
        petals: 4 + Math.floor(Math.random() * 3)
      })
    }

    // grass blades
    grassBlades = []
    for (let gx = 3; gx < w; gx += 6 + Math.random() * 8) {
      grassBlades.push({
        x: gx,
        height: 6 + Math.random() * 12,
        phase: Math.random() * Math.PI * 2,
        shade: Math.random()
      })
    }

    spawnRow()

    tapHandler = handleTap
    dragHandler = handleDrag
    dragEndHandler = handleDragEnd
    input.onTap(tapHandler)
    input.onDragMove(dragHandler)
    input.onDragEnd(dragEndHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    input.offDragMove(dragHandler)
    input.offDragEnd(dragEndHandler)
    balloons = []; launched = []; particles = []; sparkles = []; scorePopups = []
  },

  update(dt) {
    w = ctx.canvas.width
    h = ctx.canvas.height
    time += dt
    windPhase += dt * 0.5

    // screen shake
    if (screenShake > 0) screenShake *= Math.pow(0.04, dt)
    if (screenShake < 0.3) screenShake = 0

    // combo timer
    if (comboTimer > 0) {
      comboTimer -= dt
      if (comboTimer <= 0) { combo = 0; comboTimer = 0 }
    }

    // rainbow fades
    if (rainbowAlpha > 0) rainbowAlpha = Math.max(0, rainbowAlpha - dt * 0.3)

    const wind = Math.sin(windPhase) * 12

    // launched balloons float up
    launched.forEach(b => {
      b.y -= b.speed * dt
      b.wobble += dt * 3
      b.x += Math.sin(b.wobble) * 1.2 + wind * 0.3 * dt
      b.speed += 30 * dt
      b.scale = Math.max(0.15, b.scale - dt * 0.12)
      b.rotation += b.rotSpeed * dt

      // sparkle trail
      if (Math.random() < dt * 8) {
        sparkles.push({
          x: b.x + (Math.random() - 0.5) * 20,
          y: b.y + BALLOON_H * 0.3 * b.scale,
          size: 2 + Math.random() * 3,
          life: 0.6 + Math.random() * 0.4,
          color: b.color,
          vx: (Math.random() - 0.5) * 20,
          vy: 10 + Math.random() * 20
        })
      }

      // burst into stars when reaching top
      if (b.y < -30 && !b.burst) {
        b.burst = true
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2
          particles.push({
            x: b.x, y: 10,
            vx: Math.cos(a) * (60 + Math.random() * 80),
            vy: Math.sin(a) * (60 + Math.random() * 80) + 30,
            size: 3 + Math.random() * 4,
            life: 1,
            color: b.color,
            type: "star"
          })
        }
      }
    })
    launched = launched.filter(b => b.y + BALLOON_H > -80)

    // balloon being dragged
    if (grabId !== null) {
      const b = balloons.find(b => b.id === grabId)
      if (b) {
        const pull = Math.max(0, grabStartY - grabCurrentY)
        b.stretch = Math.min(1, pull / 150)
        b.excitement = Math.min(1, pull / 100)

        // vibrate when near release
        if (b.stretch > 0.4) {
          b.shake = Math.sin(time * 30) * b.stretch * 3
        } else {
          b.shake = 0
        }
      }
    }

    // idle balloons bob
    balloons.forEach(b => {
      if (b.id !== grabId) {
        b.bob += dt * (2 + b.bobSpeed)
        b.stretch = Math.max(0, b.stretch - dt * 5)
        b.excitement = Math.max(0, b.excitement - dt * 3)
        b.shake = 0
        // gentle wind sway
        b.sway = Math.sin(time * 1.2 + b.swayPhase) * 3 + wind * 0.1
      }
      b.facePhase += dt * 2
      b.blinkTimer -= dt
      if (b.blinkTimer <= 0) {
        b.blinking = true
        b.blinkTimer = 3 + Math.random() * 4
      }
      if (b.blinking) {
        b.blinkAmount += dt * 15
        if (b.blinkAmount >= 1) { b.blinking = false; b.blinkAmount = 0 }
      }
    })

    // clouds
    clouds.forEach(c => {
      c.x += c.speed * dt
      if (c.x > w + 100) c.x = -100
    })
    farClouds.forEach(c => {
      c.x += c.speed * dt
      if (c.x > w + 120) c.x = -120
    })

    // birds
    birds.forEach(b => {
      b.wingPhase += dt * 7
      b.x += b.speed * b.dir * dt
      if (b.x > w + 50) { b.x = -50; b.dir = 1 }
      if (b.x < -50) { b.x = w + 50; b.dir = -1 }
    })

    // particles
    particles.forEach(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.type !== "star") p.vy += 150 * dt
      else p.vy += 80 * dt
      p.life -= dt * 1.5
    })
    particles = particles.filter(p => p.life > 0)

    // sparkles
    sparkles.forEach(s => {
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.life -= dt * 2
    })
    sparkles = sparkles.filter(s => s.life > 0)

    // score popups
    scorePopups.forEach(p => { p.y -= 55 * dt; p.life -= dt })
    scorePopups = scorePopups.filter(p => p.life > 0)

    // respawn
    if (balloons.length === 0 && grabId === null) {
      spawnRow()
    }
  },

  render() {
    ctx.save()

    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake)
    }

    // sky gradient — golden hour feel
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, "#3a7bd5")
    sky.addColorStop(0.3, "#56b4f0")
    sky.addColorStop(0.6, "#8ed8f0")
    sky.addColorStop(0.85, "#b8eafc")
    sky.addColorStop(1, "#d4f5e0")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // sun
    const sunX = w * 0.85
    const sunY = h * 0.08
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 100)
    sunGlow.addColorStop(0, "rgba(255,240,150,0.85)")
    sunGlow.addColorStop(0.4, "rgba(255,220,100,0.2)")
    sunGlow.addColorStop(1, "rgba(255,200,50,0)")
    ctx.fillStyle = sunGlow
    ctx.fillRect(sunX - 100, sunY - 100, 200, 200)
    ctx.beginPath()
    ctx.arc(sunX, sunY, 25, 0, Math.PI * 2)
    ctx.fillStyle = "#ffe066"
    ctx.fill()

    // rainbow (appears after combos)
    if (rainbowAlpha > 0.01) {
      drawRainbow(ctx, w * 0.5, h * 0.6, Math.min(w, h) * 0.5, rainbowAlpha)
    }

    // far clouds (deeper in sky)
    farClouds.forEach(c => {
      ctx.globalAlpha = 0.3
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
      ctx.arc(c.x + c.r * 0.7, c.y - c.r * 0.15, c.r * 0.6, 0, Math.PI * 2)
      ctx.arc(c.x - c.r * 0.5, c.y + c.r * 0.1, c.r * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // birds
    birds.forEach(b => {
      ctx.strokeStyle = "rgba(60,60,80,0.35)"
      ctx.lineWidth = 1.5
      const wingUp = Math.sin(b.wingPhase) * b.size
      ctx.beginPath()
      ctx.moveTo(b.x - b.size * 2, b.y + wingUp)
      ctx.quadraticCurveTo(b.x, b.y - 2, b.x + b.size * 2, b.y + wingUp)
      ctx.stroke()
    })

    // rolling hills with details
    hills.forEach((hill, hi) => {
      ctx.fillStyle = hill.color
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let x = 0; x <= w; x += 15) {
        const hy = h * hill.yBase - Math.sin(x * hill.freq + hill.offset) * hill.amp - Math.sin(x * hill.freq * 2.5 + hill.offset + 1) * hill.amp * 0.3
        ctx.lineTo(x, hy)
      }
      ctx.lineTo(w, h)
      ctx.fill()

      // trees on first hill
      if (hi === 0) {
        for (let tx = 40; tx < w; tx += 100 + Math.sin(tx) * 40) {
          const ty = h * hill.yBase - Math.sin(tx * hill.freq + hill.offset) * hill.amp - Math.sin(tx * hill.freq * 2.5 + hill.offset + 1) * hill.amp * 0.3
          drawSmallTree(ctx, tx, ty, 0.5 + Math.sin(tx * 0.1) * 0.15)
        }
      }
      // houses on second hill
      if (hi === 1) {
        for (let hx = 80; hx < w; hx += 180 + Math.sin(hx) * 50) {
          const hy2 = h * hill.yBase - Math.sin(hx * hill.freq + hill.offset) * hill.amp - Math.sin(hx * hill.freq * 2.5 + hill.offset + 1) * hill.amp * 0.3
          drawSmallHouse(ctx, hx, hy2)
        }
      }
    })

    // ground
    const groundY = h - 40
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, h)
    groundGrad.addColorStop(0, "#5cb85c")
    groundGrad.addColorStop(1, "#3a8a3a")
    ctx.fillStyle = groundGrad
    ctx.fillRect(0, groundY, w, 40)

    // grass edge
    ctx.fillStyle = "#4cae4c"
    ctx.beginPath()
    ctx.moveTo(0, groundY)
    for (let x = 0; x <= w; x += 10) {
      ctx.lineTo(x, groundY + Math.sin(x * 0.12) * 2.5)
    }
    ctx.lineTo(w, groundY + 5)
    ctx.lineTo(0, groundY + 5)
    ctx.fill()

    // grass blades with wind
    const wind = Math.sin(windPhase) * 3
    grassBlades.forEach(g => {
      const sway = Math.sin(time * 1.5 + g.phase) * 2.5 + wind
      ctx.strokeStyle = g.shade > 0.5 ? "#4aaa4a" : "#3a9a3a"
      ctx.lineWidth = 1.2
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(g.x, groundY)
      ctx.quadraticCurveTo(g.x + sway * 0.5, groundY - g.height * 0.6, g.x + sway, groundY - g.height)
      ctx.stroke()
    })

    // flowers
    flowers.forEach(f => {
      const sway = Math.sin(time * 1.2 + f.x * 0.1) * 0.08
      ctx.save()
      ctx.translate(f.x, groundY - 2)
      ctx.rotate(sway)
      ctx.strokeStyle = "#3a9a3a"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -f.size * 3.5)
      ctx.stroke()
      for (let i = 0; i < f.petals; i++) {
        const a = (i / f.petals) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(Math.cos(a) * f.size * 0.5, -f.size * 3.5 + Math.sin(a) * f.size * 0.5, f.size * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = f.color
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(0, -f.size * 3.5, f.size * 0.25, 0, Math.PI * 2)
      ctx.fillStyle = "#feca57"
      ctx.fill()
      ctx.restore()
    })

    // bunting (festive flags across top)
    const buntingY = h * 0.6
    const buntingSag = 15
    // rope
    ctx.strokeStyle = "rgba(0,0,0,0.15)"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, buntingY)
    for (let bx = 0; bx <= w; bx += 10) {
      ctx.lineTo(bx, buntingY + Math.sin(bx * 0.02) * buntingSag)
    }
    ctx.stroke()
    // flags
    bunting.forEach(f => {
      const by = buntingY + Math.sin(f.x * 0.02) * buntingSag
      const flapSway = Math.sin(time * 2 + f.phase) * 3
      ctx.fillStyle = f.color
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      ctx.moveTo(f.x - 8, by)
      ctx.lineTo(f.x + flapSway, by + 18)
      ctx.lineTo(f.x + 8, by)
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // near clouds
    clouds.forEach(c => {
      ctx.globalAlpha = 0.55
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
      ctx.arc(c.x + c.r * 0.85, c.y - c.r * 0.25, c.r * 0.72, 0, Math.PI * 2)
      ctx.arc(c.x - c.r * 0.65, c.y + c.r * 0.1, c.r * 0.6, 0, Math.PI * 2)
      ctx.arc(c.x + c.r * 0.3, c.y - c.r * 0.35, c.r * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // balloon shadows on ground
    balloons.forEach(b => {
      const bobY = Math.sin(b.bob) * 4
      const pullY = b.stretch * -40
      const shadowDist = (groundY - (b.y + bobY + pullY)) * 0.02
      ctx.globalAlpha = Math.max(0.03, 0.1 - shadowDist * 0.01)
      ctx.beginPath()
      ctx.ellipse(b.x + b.sway * 0.5, groundY + 2, BALLOON_W * 0.35, 4, 0, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(0,0,0,0.3)"
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // sparkle trails
    sparkles.forEach(s => {
      ctx.globalAlpha = s.life * 0.7
      const pulse = 0.6 + Math.sin(time * 15 + s.x) * 0.4
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * pulse, 0, Math.PI * 2)
      ctx.fillStyle = s.color
      ctx.fill()
      // white core
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * pulse * 0.4, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // launched balloons (behind idle, shrinking away)
    launched.forEach(b => {
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(b.rotation)
      ctx.scale(b.scale, b.scale)
      drawBalloon(ctx, 0, 0, b.color, 0, false, b.pattern, b.shape, b.face, 0, 0, false)
      ctx.restore()
    })

    // particles (launch bursts, stars)
    particles.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life)
      if (p.type === "star") {
        drawStar(ctx, p.x, p.y, p.size, p.color)
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      }
    })
    ctx.globalAlpha = 1

    // idle balloons
    balloons.forEach(b => {
      const bobY = Math.sin(b.bob) * 5
      const pullY = b.stretch * -45
      drawBalloon(ctx, b.x + (b.sway || 0) + (b.shake || 0), b.y + bobY + pullY, b.color, b.stretch, b.id === grabId, b.pattern, b.shape, b.face, b.facePhase, b.blinkAmount, b.excitement > 0.3)
    })

    // score popups
    scorePopups.forEach(p => {
      const alpha = Math.min(1, p.life * 2)
      const s = p.scale * (1 + (1.5 - p.life) * 0.2)
      ctx.globalAlpha = alpha
      ctx.font = `bold ${Math.round(24 * s)}px sans-serif`
      ctx.textAlign = "center"
      ctx.strokeStyle = "rgba(0,0,0,0.25)"
      ctx.lineWidth = 3
      ctx.strokeText(p.text, p.x, p.y)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y)
    })
    ctx.globalAlpha = 1

    // combo bar
    if (combo > 1 && comboTimer > 0) {
      const barW = 110
      const barH = 7
      const bx = w / 2 - barW / 2
      const by = 58
      ctx.fillStyle = "rgba(0,0,0,0.2)"
      ctx.beginPath()
      ctx.roundRect(bx, by, barW, barH, 4)
      ctx.fill()
      const fill = comboTimer / 4
      const cc = combo >= 5 ? "#ff6b6b" : combo >= 3 ? "#feca57" : "#54a0ff"
      ctx.fillStyle = cc
      ctx.beginPath()
      ctx.roundRect(bx, by, barW * fill, barH, 4)
      ctx.fill()
      ctx.font = "bold 13px sans-serif"
      ctx.fillStyle = cc
      ctx.textAlign = "center"
      ctx.fillText(`WHOOSH x${combo}`, w / 2, by - 3)
    }

    // score
    ctx.fillStyle = "rgba(0,0,0,0.12)"
    ctx.font = "bold 34px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2 + 1, 17)
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    ctx.fillText(score, w / 2, 16)

    if (score === 0) {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.fillText("Swipe a balloon up!", w / 2, 54)
    }

    ctx.restore()
  }
}

function spawnRow() {
  const count = 3 + Math.floor(Math.random() * 3)
  const spacing = w / (count + 1)
  for (let i = 0; i < count; i++) {
    const isGolden = totalLaunched > 5 && Math.random() < 0.08
    const color = isGolden ? "#ffd700" : COLORS[Math.floor(Math.random() * COLORS.length)]
    balloons.push({
      id: nextId++,
      x: spacing * (i + 1) + (Math.random() - 0.5) * 20,
      y: h - 130 - Math.random() * 50,
      color,
      bob: Math.random() * Math.PI * 2,
      bobSpeed: Math.random() * 0.8,
      stretch: 0,
      excitement: 0,
      shake: 0,
      sway: 0,
      swayPhase: Math.random() * Math.PI * 2,
      pattern: isGolden ? "star" : PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      face: Math.floor(Math.random() * 4), // 0-3 face styles
      facePhase: Math.random() * Math.PI * 2,
      blinkTimer: 2 + Math.random() * 3,
      blinking: false,
      blinkAmount: 0,
      golden: isGolden,
      points: isGolden ? 5 : 1
    })
  }
}

function handleTap(x, y) {
  for (let i = balloons.length - 1; i >= 0; i--) {
    const b = balloons[i]
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
  if (pull > 60) {
    launchBalloon(grabId, pull)
  }
}

function handleDragEnd() {
  if (grabId === null) return
  // snap back if not launched
  const b = balloons.find(b => b.id === grabId)
  if (b) {
    b.stretch = 0
    b.excitement = 0
    b.shake = 0
  }
  grabId = null
}

function launchBalloon(id, power) {
  const idx = balloons.findIndex(b => b.id === id)
  if (idx === -1) return

  const b = balloons[idx]
  balloons.splice(idx, 1)
  grabId = null
  totalLaunched++

  // combo
  const timeSince = time - lastLaunchTime
  if (timeSince < 3 && lastLaunchTime > 0) {
    combo++
    comboTimer = 4
  } else {
    combo = 1
    comboTimer = 4
  }
  lastLaunchTime = time

  const points = b.points * Math.max(1, combo)
  score += points

  // screen shake
  screenShake = Math.min(10, 2 + combo * 1.5)

  // rainbow on big combos
  if (combo >= 4) rainbowAlpha = 0.8

  launched.push({
    x: b.x,
    y: b.y,
    color: b.color,
    speed: 120 + power * 1.8,
    wobble: Math.random() * Math.PI * 2,
    scale: 1,
    rotation: 0,
    rotSpeed: (Math.random() - 0.5) * 1.5,
    pattern: b.pattern,
    shape: b.shape,
    face: b.face,
    burst: false
  })

  // score popup
  const label = b.golden ? `+${points} GOLDEN!` : (combo > 1 ? `+${points} x${combo}!` : `+${points}`)
  scorePopups.push({
    x: b.x, y: b.y - 30,
    text: label,
    life: 1.5,
    color: b.golden ? '#ffd700' : (combo >= 3 ? '#feca57' : '#fff'),
    scale: combo >= 3 ? 1.3 : 1
  })

  // launch burst particles
  for (let i = 0; i < 10; i++) {
    const a = (Math.random() - 0.5) * Math.PI
    particles.push({
      x: b.x + (Math.random() - 0.5) * 20,
      y: b.y + 10,
      vx: Math.cos(a) * (40 + Math.random() * 80),
      vy: -30 - Math.random() * 60,
      size: 2 + Math.random() * 4,
      life: 0.8,
      color: b.color,
      type: "burst"
    })
  }

  playLaunch()
  celebrate()
  if (score % 10 === 0) celebrateBig()
}

function playLaunch() {
  if (!audioCtx) audioCtx = window._sharedAudioCtx || (window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)())
  if (audioCtx.state === 'suspended') audioCtx.resume()
  const now = audioCtx.currentTime
  const o = audioCtx.createOscillator()
  const g = audioCtx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(200, now)
  o.frequency.exponentialRampToValueAtTime(800, now + 0.2)
  g.gain.setValueAtTime(0.3, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  o.connect(g)
  g.connect(audioCtx.destination)
  o.start(now)
  o.stop(now + 0.25)
}

function drawBalloon(ctx, x, y, color, stretch, grabbed, pattern, shape, face, facePhase, blinkAmount, excited) {
  let bw = BALLOON_W / 2
  let bh = BALLOON_H / 2

  if (shape === "round") { bw = BALLOON_W * 0.48; bh = BALLOON_W * 0.48 }
  else if (shape === "long") { bw = BALLOON_W * 0.38; bh = BALLOON_H * 0.58 }

  // string with physics curve
  ctx.strokeStyle = "rgba(120,100,80,0.3)"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, y + bh + 8)
  const strSway = Math.sin(facePhase * 0.5 + x * 0.01) * 6
  ctx.bezierCurveTo(
    x + strSway, y + bh + 22,
    x - strSway * 0.5, y + bh + 36,
    x + strSway * 0.3, y + bh + 50
  )
  ctx.stroke()

  // balloon body
  ctx.save()
  ctx.translate(x, y)
  if (stretch > 0) ctx.scale(1 - stretch * 0.08, 1 + stretch * 0.18)

  // golden glow
  if (color === "#ffd700") {
    const glow = ctx.createRadialGradient(0, 0, bw * 0.3, 0, 0, bw * 1.5)
    glow.addColorStop(0, "rgba(255,215,0,0.25)")
    glow.addColorStop(1, "rgba(255,215,0,0)")
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, bw * 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // main balloon shape with gradient
  ctx.beginPath()
  ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2)
  const ballGrad = ctx.createRadialGradient(-bw * 0.25, -bh * 0.25, bw * 0.1, 0, 0, bw)
  ballGrad.addColorStop(0, lightenColor(color, 30))
  ballGrad.addColorStop(0.7, color)
  ballGrad.addColorStop(1, darkenColor(color, 30))
  ctx.fillStyle = ballGrad
  ctx.fill()

  // pattern overlay
  if (pattern === "stripes") {
    ctx.globalAlpha = 0.15
    for (let sy = -bh; sy < bh; sy += 12) {
      ctx.beginPath()
      const stripW = Math.sqrt(1 - (sy / bh) ** 2) * bw
      ctx.ellipse(0, sy, stripW, 3, 0, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } else if (pattern === "dots") {
    ctx.globalAlpha = 0.15
    ctx.fillStyle = "#fff"
    for (let dy = -bh * 0.6; dy < bh * 0.6; dy += 14) {
      for (let dx = -bw * 0.5; dx < bw * 0.5; dx += 14) {
        if (dx * dx / (bw * bw) + dy * dy / (bh * bh) < 0.5) {
          ctx.beginPath()
          ctx.arc(dx, dy, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.globalAlpha = 1
  } else if (pattern === "star") {
    ctx.globalAlpha = 0.2
    drawStar(ctx, 0, -bh * 0.15, bw * 0.35, "#fff")
    ctx.globalAlpha = 1
  } else if (pattern === "heart") {
    ctx.globalAlpha = 0.18
    drawHeart(ctx, 0, -bh * 0.1, bw * 0.4)
    ctx.globalAlpha = 1
  }

  // shine highlight
  ctx.beginPath()
  ctx.ellipse(-bw * 0.28, -bh * 0.32, bw * 0.28, bh * 0.2, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.fill()
  // secondary subtle shine
  ctx.beginPath()
  ctx.ellipse(-bw * 0.15, -bh * 0.15, bw * 0.12, bh * 0.08, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.2)"
  ctx.fill()

  // face!
  const faceY = -bh * 0.05
  const eyeOpen = 1 - blinkAmount
  if (face === 0) {
    // happy face
    drawBalloonEyes(ctx, -bw * 0.22, faceY - bh * 0.12, bw * 0.08, eyeOpen, excited)
    drawBalloonEyes(ctx, bw * 0.22, faceY - bh * 0.12, bw * 0.08, eyeOpen, excited)
    // smile
    ctx.beginPath()
    ctx.arc(0, faceY + bh * 0.08, bw * 0.18, 0.2, Math.PI - 0.2)
    ctx.strokeStyle = "rgba(0,0,0,0.2)"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.stroke()
  } else if (face === 1) {
    // :O surprised face
    drawBalloonEyes(ctx, -bw * 0.2, faceY - bh * 0.12, bw * 0.1, eyeOpen, excited)
    drawBalloonEyes(ctx, bw * 0.2, faceY - bh * 0.12, bw * 0.1, eyeOpen, excited)
    ctx.beginPath()
    ctx.ellipse(0, faceY + bh * 0.12, bw * 0.08, bh * 0.06, 0, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.15)"
    ctx.fill()
  } else if (face === 2) {
    // ^_^ closed happy
    if (eyeOpen > 0.3) {
      drawBalloonEyes(ctx, -bw * 0.22, faceY - bh * 0.1, bw * 0.07, eyeOpen, excited)
      drawBalloonEyes(ctx, bw * 0.22, faceY - bh * 0.1, bw * 0.07, eyeOpen, excited)
    } else {
      // happy arcs
      ctx.strokeStyle = "rgba(0,0,0,0.2)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(-bw * 0.22, faceY - bh * 0.08, bw * 0.08, Math.PI + 0.3, -0.3)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(bw * 0.22, faceY - bh * 0.08, bw * 0.08, Math.PI + 0.3, -0.3)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, faceY + bh * 0.06, bw * 0.15, 0.1, Math.PI - 0.1)
    ctx.strokeStyle = "rgba(0,0,0,0.2)"
    ctx.lineWidth = 2
    ctx.stroke()
  } else {
    // winking face
    drawBalloonEyes(ctx, -bw * 0.22, faceY - bh * 0.12, bw * 0.08, eyeOpen, excited)
    // wink
    ctx.strokeStyle = "rgba(0,0,0,0.2)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(bw * 0.22, faceY - bh * 0.1, bw * 0.08, 0.3, Math.PI - 0.3)
    ctx.stroke()
    // tongue
    ctx.beginPath()
    ctx.ellipse(bw * 0.05, faceY + bh * 0.16, bw * 0.06, bh * 0.04, 0, 0, Math.PI)
    ctx.fillStyle = "rgba(255,100,120,0.3)"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, faceY + bh * 0.08, bw * 0.15, 0.2, Math.PI - 0.2)
    ctx.strokeStyle = "rgba(0,0,0,0.2)"
    ctx.stroke()
  }

  // cheek blush
  ctx.beginPath()
  ctx.ellipse(-bw * 0.35, faceY + bh * 0.02, bw * 0.1, bh * 0.06, 0, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,150,170,0.15)"
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(bw * 0.35, faceY + bh * 0.02, bw * 0.1, bh * 0.06, 0, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,150,170,0.15)"
  ctx.fill()

  // knot
  ctx.beginPath()
  ctx.moveTo(-5, bh)
  ctx.lineTo(0, bh + 9)
  ctx.lineTo(5, bh)
  ctx.fillStyle = darkenColor(color, 15)
  ctx.fill()

  ctx.restore()

  // grab indicator
  if (grabbed) {
    ctx.save()
    ctx.translate(x, y)
    if (stretch > 0) ctx.scale(1 - stretch * 0.08, 1 + stretch * 0.18)
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = "rgba(255,255,255,0.55)"
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.ellipse(0, 0, bw + 7, bh + 7, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // up arrow hint
    if (stretch > 0.1 && stretch < 0.4) {
      ctx.globalAlpha = 0.5
      ctx.fillStyle = "#fff"
      ctx.font = "bold 20px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("\u2191", 0, -bh - 20)
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }
}

function drawBalloonEyes(ctx, x, y, r, openAmount, excited) {
  if (openAmount < 0.1) return
  const eyeH = r * openAmount
  ctx.beginPath()
  ctx.ellipse(x, y, r, eyeH, 0, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(0,0,0,0.25)"
  ctx.fill()
  // pupil
  if (openAmount > 0.3) {
    ctx.beginPath()
    ctx.arc(x + r * 0.15, y, r * 0.45 * openAmount, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.4)"
    ctx.fill()
    // shine
    ctx.beginPath()
    ctx.arc(x - r * 0.15, y - r * 0.2 * openAmount, r * 0.2, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.fill()
  }
  // sparkle when excited
  if (excited && openAmount > 0.5) {
    drawStar(ctx, x, y, r * 0.5, "rgba(255,255,255,0.4)")
  }
}

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    const outerX = x + Math.cos(a) * r
    const outerY = y + Math.sin(a) * r
    const innerA = a + Math.PI / 5
    const innerX = x + Math.cos(innerA) * r * 0.4
    const innerY = y + Math.sin(innerA) * r * 0.4
    if (i === 0) ctx.moveTo(outerX, outerY)
    else ctx.lineTo(outerX, outerY)
    ctx.lineTo(innerX, innerY)
  }
  ctx.closePath()
  ctx.fill()
}

function drawHeart(ctx, x, y, size) {
  ctx.fillStyle = "rgba(255,255,255,0.8)"
  ctx.beginPath()
  ctx.moveTo(x, y + size * 0.3)
  ctx.bezierCurveTo(x - size * 0.5, y - size * 0.3, x - size, y + size * 0.1, x, y + size * 0.7)
  ctx.bezierCurveTo(x + size, y + size * 0.1, x + size * 0.5, y - size * 0.3, x, y + size * 0.3)
  ctx.fill()
}

function drawRainbow(ctx, x, y, radius, alpha) {
  const colors = ["#ff6b6b", "#ff9f43", "#feca57", "#26de81", "#54a0ff", "#a55eea"]
  const bandWidth = radius * 0.04
  ctx.globalAlpha = alpha * 0.3
  colors.forEach((c, i) => {
    ctx.beginPath()
    ctx.arc(x, y, radius - i * bandWidth * 2, Math.PI, 0)
    ctx.strokeStyle = c
    ctx.lineWidth = bandWidth
    ctx.stroke()
  })
  ctx.globalAlpha = 1
}

function drawSmallTree(ctx, x, y, scale) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = "#6a5020"
  ctx.fillRect(-4, 0, 8, 25)
  ctx.fillStyle = "#3a8a3a"
  ctx.beginPath()
  ctx.arc(0, -8, 20, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#2d7a2e"
  ctx.beginPath()
  ctx.arc(8, -3, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#45a845"
  ctx.beginPath()
  ctx.arc(-6, -5, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSmallHouse(ctx, x, y) {
  ctx.save()
  ctx.translate(x, y)
  // walls
  ctx.fillStyle = "#f0e0c0"
  ctx.fillRect(-12, -16, 24, 18)
  // roof
  ctx.fillStyle = "#c0503a"
  ctx.beginPath()
  ctx.moveTo(-16, -16)
  ctx.lineTo(0, -30)
  ctx.lineTo(16, -16)
  ctx.fill()
  // door
  ctx.fillStyle = "#8a5a2a"
  ctx.fillRect(-4, -8, 7, 10)
  // window
  ctx.fillStyle = "rgba(150,200,255,0.5)"
  ctx.fillRect(5, -13, 5, 5)
  ctx.restore()
}

function lightenColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16)
  const r = Math.min(255, (num >> 16) + amount)
  const g = Math.min(255, ((num >> 8) & 0xff) + amount)
  const b = Math.min(255, (num & 0xff) + amount)
  return `rgb(${r},${g},${b})`
}

function darkenColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0xff) - amount)
  const b = Math.max(0, (num & 0xff) - amount)
  return `rgb(${r},${g},${b})`
}
