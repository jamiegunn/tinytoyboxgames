import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let truck, crushables, stars, score, time
let dust, screenShake, slowMo, slowMoTimer
let combo, comboTimer, comboTexts
let fireTrails, exhaustPuffs, speedLines, mudSplatters
let bgOffset, crowdWave

const GROUND_BASE = 0.78
const TRUCK_SIZE = 60
const BASE_SPEED = 220
const GRAVITY = 1100
const MAX_JUMPS = 2

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = ctx.canvas.width
    h = ctx.canvas.height
    score = 0
    time = 0
    dust = []
    screenShake = 0
    slowMo = 1
    slowMoTimer = 0
    combo = 0
    comboTimer = 0
    comboTexts = []
    fireTrails = []
    exhaustPuffs = []
    speedLines = []
    mudSplatters = []
    bgOffset = 0
    crowdWave = 0

    const groundY = h * GROUND_BASE

    truck = {
      x: w * 0.22,
      y: groundY,
      vy: 0,
      rotation: 0,
      targetRotation: 0,
      wheelPhase: 0,
      grounded: true,
      size: TRUCK_SIZE,
      squash: 0,
      jumpsLeft: MAX_JUMPS,
      totalFlips: 0,
      flipAngle: 0,
      boosting: false,
      boostTimer: 0,
      engineRumble: 0,
      suspensionOffset: 0
    }

    crushables = []
    stars = []

    for (let i = 0; i < 4; i++) {
      spawnCrushable(w + 150 + i * 250)
    }

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    crushables = []
    stars = []
    dust = []
    fireTrails = []
    exhaustPuffs = []
    speedLines = []
    mudSplatters = []
    comboTexts = []
  },

  update(dt) {
    w = ctx.canvas.width
    h = ctx.canvas.height
    time += dt

    // slow-mo effect
    slowMoTimer = Math.max(0, slowMoTimer - dt)
    slowMo = slowMoTimer > 0 ? 0.35 : 1
    const sdt = dt * slowMo

    const groundY = h * GROUND_BASE
    const speed = (BASE_SPEED + Math.min(score * 2, 150)) * (truck.boosting ? 1.5 : 1)
    bgOffset += speed * sdt

    crowdWave += sdt * 3

    // scroll
    crushables.forEach(c => { c.x -= speed * sdt })
    stars.forEach(s => { s.x -= speed * sdt })

    // spawn crushables
    const lastC = crushables[crushables.length - 1]
    if (!lastC || lastC.x < w - 80) {
      spawnCrushable(w + 80 + Math.random() * 180)
    }

    // spawn stars
    if (Math.random() < sdt * 2) {
      stars.push({
        x: w + 30,
        y: groundY - 90 - Math.random() * 140,
        size: 14 + Math.random() * 8,
        collected: false,
        bob: Math.random() * Math.PI * 2,
        sparkle: Math.random() * Math.PI * 2
      })
    }

    // terrain height at truck position
    const terrainY = getTerrainY(truck.x, groundY)

    // truck physics
    truck.engineRumble = Math.sin(time * 30) * 0.5 + Math.sin(time * 47) * 0.3
    truck.boostTimer = Math.max(0, truck.boostTimer - sdt)
    truck.boosting = truck.boostTimer > 0

    if (!truck.grounded) {
      truck.vy += GRAVITY * sdt
      truck.y += truck.vy * sdt

      // air rotation — truck tilts based on velocity, full flips possible
      truck.flipAngle += sdt * (truck.vy < 0 ? -4 : 2.5)
      truck.rotation = truck.flipAngle * 0.15
      truck.rotation = Math.max(-0.6, Math.min(0.6, truck.rotation))

      // boost flames
      if (truck.boosting) {
        truck.vy = Math.min(truck.vy, -200)
        for (let i = 0; i < 2; i++) {
          fireTrails.push({
            x: truck.x - 25 + (Math.random() - 0.5) * 10,
            y: truck.y + 5,
            vx: -speed * 0.3 + (Math.random() - 0.5) * 40,
            vy: 20 + Math.random() * 30,
            life: 0.6,
            size: 8 + Math.random() * 10
          })
        }
      }

      if (truck.y >= terrainY) {
        truck.y = terrainY
        truck.vy = 0
        truck.grounded = true
        truck.jumpsLeft = MAX_JUMPS
        truck.squash = 0.4
        screenShake = 0.3
        truck.suspensionOffset = 8

        // check flip bonus
        const fullFlips = Math.floor(Math.abs(truck.flipAngle) / (Math.PI * 2 / 0.15))
        if (fullFlips > 0) {
          score += fullFlips * 3
          comboTexts.push({
            x: truck.x, y: truck.y - 80,
            text: `FLIP x${fullFlips}!`,
            life: 1.5, color: "#ff6b6b"
          })
          celebrateBig()
        }
        truck.flipAngle = 0
        truck.rotation = 0

        // landing particles
        for (let i = 0; i < 12; i++) {
          dust.push({
            x: truck.x - 20 + Math.random() * 40,
            y: terrainY,
            vx: (Math.random() - 0.5) * 160,
            vy: -40 - Math.random() * 70,
            life: 1,
            size: 4 + Math.random() * 7
          })
        }

        // mud splatter on landing
        for (let i = 0; i < 5; i++) {
          mudSplatters.push({
            x: truck.x + (Math.random() - 0.5) * 50,
            y: terrainY + Math.random() * 10,
            size: 6 + Math.random() * 10,
            life: 2
          })
        }
      }
    } else {
      // grounded — follow terrain
      truck.y = terrainY
      truck.rotation = 0
      truck.flipAngle = 0

      // terrain slope tilts the truck
      const nextY = getTerrainY(truck.x + 10, groundY)
      truck.rotation = Math.atan2(nextY - truck.y, 10) * 0.3
    }

    truck.squash = Math.max(0, truck.squash - sdt * 3)
    truck.suspensionOffset = truck.suspensionOffset * (1 - sdt * 10)
    screenShake = Math.max(0, screenShake - sdt * 2.5)
    truck.wheelPhase += sdt * speed * 0.06

    // combo timer
    if (combo > 0) {
      comboTimer -= sdt
      if (comboTimer <= 0) combo = 0
    }

    // exhaust smoke
    if (Math.random() < sdt * 6) {
      exhaustPuffs.push({
        x: truck.x - truck.size * 0.55,
        y: truck.y - truck.size * 0.7,
        vx: -40 - Math.random() * 30,
        vy: -15 - Math.random() * 25,
        life: 1,
        size: 4 + Math.random() * 5
      })
    }

    // speed lines when fast
    if (speed > 300 && Math.random() < sdt * (speed - 300) * 0.02) {
      speedLines.push({
        x: w + 10,
        y: Math.random() * h * 0.7,
        len: 40 + Math.random() * 60,
        life: 0.4
      })
    }

    // rolling dust
    if (truck.grounded && Math.random() < sdt * 10) {
      dust.push({
        x: truck.x - 25 + Math.random() * 10,
        y: truck.y - 2,
        vx: -50 - Math.random() * 30,
        vy: -15 - Math.random() * 20,
        life: 0.7,
        size: 3 + Math.random() * 5
      })
    }

    // check crush
    crushables.forEach(c => {
      if (c.crushed) return
      const dx = truck.x - c.x
      const dy = truck.y - c.y
      if (Math.abs(dx) < truck.size * 0.7 + c.w * 0.4 &&
          Math.abs(dy) < truck.size * 0.4 + c.h * 0.4) {

        c.crushed = true
        c.crushTime = 0

        // combo
        combo++
        comboTimer = 1.5
        const points = combo >= 3 ? combo * 2 : 1
        score += points

        if (combo >= 2) {
          comboTexts.push({
            x: c.x, y: c.y - 40,
            text: combo >= 4 ? `MEGA x${combo}!` : `COMBO x${combo}!`,
            life: 1.2,
            color: combo >= 4 ? "#ff6b6b" : "#feca57"
          })
        }

        screenShake = combo >= 3 ? 0.6 : 0.35
        if (!truck.grounded) slowMoTimer = 0.15

        celebrate()
        if (score % 10 === 0 || combo >= 4) celebrateBig()

        // crush particles — more dramatic
        const particleCount = c.type === "bus" ? 18 : 12
        for (let i = 0; i < particleCount; i++) {
          dust.push({
            x: c.x + (Math.random() - 0.5) * c.w,
            y: c.y + (Math.random() - 0.5) * c.h,
            vx: (Math.random() - 0.5) * 200,
            vy: -60 - Math.random() * 140,
            life: 1.2,
            size: 3 + Math.random() * 6,
            color: c.color
          })
        }

        // fire trail at crush site
        for (let i = 0; i < 4; i++) {
          fireTrails.push({
            x: c.x + (Math.random() - 0.5) * 20,
            y: c.y,
            vx: (Math.random() - 0.5) * 30,
            vy: -30 - Math.random() * 50,
            life: 0.8,
            size: 10 + Math.random() * 12
          })
        }

        // bounce up on crush if falling
        if (truck.vy > 0) {
          truck.vy = -250
          truck.grounded = false
        }
      }
    })

    // update crushed animation
    crushables.forEach(c => {
      if (c.crushed) c.crushTime = (c.crushTime || 0) + sdt
    })
    crushables = crushables.filter(c => c.x > -150 && (!c.crushed || c.crushTime < 2))

    // collect stars
    stars.forEach(s => {
      if (s.collected) return
      s.bob += sdt * 3
      s.sparkle += sdt * 5
      const dx = truck.x - s.x
      const dy = truck.y - truck.size * 0.3 - s.y
      if (Math.sqrt(dx * dx + dy * dy) < truck.size * 0.7 + s.size) {
        s.collected = true
        score += 2
        celebrate()
        // star collect sparkles
        for (let i = 0; i < 6; i++) {
          dust.push({
            x: s.x + (Math.random() - 0.5) * 10,
            y: s.y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 80,
            vy: (Math.random() - 0.5) * 80,
            life: 0.8,
            size: 3,
            color: "#feca57"
          })
        }
      }
    })
    stars = stars.filter(s => s.x > -50 && !s.collected)

    // particles update
    dust.forEach(d => { d.x += d.vx * sdt; d.y += d.vy * sdt; d.vy += 80 * sdt; d.life -= sdt * 1.8 })
    dust = dust.filter(d => d.life > 0)

    fireTrails.forEach(f => { f.x += f.vx * sdt; f.y += f.vy * sdt; f.life -= sdt * 2.5; f.size *= (1 - sdt * 2) })
    fireTrails = fireTrails.filter(f => f.life > 0)

    exhaustPuffs.forEach(p => { p.x += p.vx * sdt; p.y += p.vy * sdt; p.size += sdt * 8; p.life -= sdt * 2 })
    exhaustPuffs = exhaustPuffs.filter(p => p.life > 0)

    speedLines.forEach(l => { l.x -= speed * 2 * sdt; l.life -= sdt * 2 })
    speedLines = speedLines.filter(l => l.life > 0)

    mudSplatters.forEach(m => { m.life -= sdt * 0.8 })
    mudSplatters = mudSplatters.filter(m => m.life > 0)

    comboTexts.forEach(t => { t.y -= sdt * 40; t.life -= sdt })
    comboTexts = comboTexts.filter(t => t.life > 0)
  },

  render() {
    const groundY = h * GROUND_BASE

    ctx.save()
    if (screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * screenShake * 15,
        (Math.random() - 0.5) * screenShake * 15
      )
    }

    // === SKY ===
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65)
    sky.addColorStop(0, "#1a0533")
    sky.addColorStop(0.4, "#3d1066")
    sky.addColorStop(0.7, "#f06030")
    sky.addColorStop(1, "#f8c040")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // spotlights
    for (let i = 0; i < 4; i++) {
      const sx = w * 0.15 + i * w * 0.25
      ctx.globalAlpha = 0.04 + Math.sin(time * 2 + i) * 0.02
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.moveTo(sx - 5, 0)
      ctx.lineTo(sx - 80, h * 0.7)
      ctx.lineTo(sx + 80, h * 0.7)
      ctx.lineTo(sx + 5, 0)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // stars in sky
    for (let i = 0; i < 12; i++) {
      const sx = (i * 73 + 20) % w
      const sy = 10 + (i * 37) % (h * 0.25)
      const twinkle = 0.3 + Math.sin(time * 3 + i * 2) * 0.3
      ctx.globalAlpha = twinkle
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // === STADIUM / CROWD ===
    // stands
    ctx.fillStyle = "#2a1045"
    ctx.fillRect(0, h * 0.45, w, h * 0.18)

    // crowd (little colored dots)
    for (let cx = 5; cx < w; cx += 12) {
      for (let row = 0; row < 3; row++) {
        const cy = h * 0.47 + row * 14
        const wave = Math.sin(crowdWave + cx * 0.05 + row) * 3
        const colors = ["#ff6b6b", "#54a0ff", "#feca57", "#26de81", "#ff9ff3", "#fff"]
        ctx.fillStyle = colors[(cx * 7 + row * 3) % colors.length]
        ctx.globalAlpha = 0.6
        ctx.beginPath()
        ctx.arc(cx, cy + wave, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // flags on top of stands
    for (let fx = 30; fx < w; fx += 80) {
      const flagWave = Math.sin(time * 4 + fx * 0.05) * 8
      ctx.fillStyle = fx % 160 < 80 ? "#e74c3c" : "#f39c12"
      ctx.beginPath()
      ctx.moveTo(fx, h * 0.44)
      ctx.lineTo(fx + 15 + flagWave, h * 0.43)
      ctx.lineTo(fx + 12 + flagWave, h * 0.45)
      ctx.lineTo(fx, h * 0.445)
      ctx.fill()
      // pole
      ctx.strokeStyle = "#888"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(fx, h * 0.435)
      ctx.lineTo(fx, h * 0.455)
      ctx.stroke()
    }

    // barrier wall
    ctx.fillStyle = "#c0392b"
    ctx.fillRect(0, h * 0.62, w, 8)
    // barrier stripes
    for (let bx = (-bgOffset * 0.3) % 30; bx < w; bx += 30) {
      ctx.fillStyle = "#fff"
      ctx.fillRect(bx, h * 0.62, 15, 8)
    }

    // === GROUND ===
    // dirt
    const dirtGrad = ctx.createLinearGradient(0, groundY - 10, 0, h)
    dirtGrad.addColorStop(0, "#b8863a")
    dirtGrad.addColorStop(0.3, "#a07030")
    dirtGrad.addColorStop(1, "#806020")
    ctx.fillStyle = dirtGrad

    // terrain shape
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 4) {
      ctx.lineTo(x, getTerrainY(x, groundY))
    }
    ctx.lineTo(w, h)
    ctx.fill()

    // terrain surface highlight
    ctx.strokeStyle = "rgba(255,255,255,0.1)"
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= w; x += 4) {
      const ty = getTerrainY(x, groundY)
      if (x === 0) ctx.moveTo(x, ty)
      else ctx.lineTo(x, ty)
    }
    ctx.stroke()

    // tire tracks
    ctx.strokeStyle = "rgba(0,0,0,0.1)"
    ctx.lineWidth = 4
    ctx.setLineDash([6, 10])
    ctx.beginPath()
    for (let x = 0; x <= truck.x - 20; x += 4) {
      const ty = getTerrainY(x, groundY) + 2
      if (x === 0) ctx.moveTo(x, ty)
      else ctx.lineTo(x, ty)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // mud splatters
    mudSplatters.forEach(m => {
      ctx.globalAlpha = Math.min(1, m.life)
      ctx.beginPath()
      ctx.ellipse(m.x, m.y, m.size, m.size * 0.3, 0, 0, Math.PI * 2)
      ctx.fillStyle = "#7a5a20"
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // speed lines
    speedLines.forEach(l => {
      ctx.globalAlpha = l.life
      ctx.strokeStyle = "rgba(255,255,255,0.4)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(l.x, l.y)
      ctx.lineTo(l.x + l.len, l.y)
      ctx.stroke()
      ctx.globalAlpha = 1
    })

    // crushables
    crushables.forEach(c => drawCrushable(ctx, c, groundY))

    // stars
    stars.forEach(s => {
      if (s.collected) return
      const bob = Math.sin(s.bob) * 6
      const glow = 0.15 + Math.sin(s.sparkle) * 0.1
      // glow
      ctx.beginPath()
      ctx.arc(s.x, s.y + bob, s.size + 6, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(254,202,87,${glow})`
      ctx.fill()
      drawStar(ctx, s.x, s.y + bob, s.size)
    })

    // fire trails
    fireTrails.forEach(f => {
      ctx.globalAlpha = f.life
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size)
      grad.addColorStop(0, "rgba(255,255,100,0.9)")
      grad.addColorStop(0.4, "rgba(255,120,20,0.6)")
      grad.addColorStop(1, "rgba(255,50,0,0)")
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // exhaust puffs
    exhaustPuffs.forEach(p => {
      ctx.globalAlpha = p.life * 0.3
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = "#666"
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // dust
    dust.forEach(d => {
      ctx.globalAlpha = Math.min(1, d.life) * 0.7
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
      ctx.fillStyle = d.color || "#c8a050"
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // truck
    drawTruck(ctx, truck, groundY)

    // combo texts
    comboTexts.forEach(t => {
      ctx.globalAlpha = Math.min(1, t.life * 2)
      ctx.font = "bold 28px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.strokeStyle = "rgba(0,0,0,0.4)"
      ctx.lineWidth = 4
      ctx.strokeText(t.text, t.x, t.y)
      ctx.fillStyle = t.color
      ctx.fillText(t.text, t.x, t.y)
      ctx.globalAlpha = 1
    })

    ctx.restore()

    // === HUD ===
    // score
    ctx.fillStyle = "#fff"
    ctx.font = "bold 32px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.strokeStyle = "rgba(0,0,0,0.3)"
    ctx.lineWidth = 3
    ctx.strokeText(score, w / 2, 14)
    ctx.fillText(score, w / 2, 14)

    // combo meter
    if (combo >= 2) {
      ctx.font = "bold 20px sans-serif"
      ctx.fillStyle = combo >= 4 ? "#ff6b6b" : "#feca57"
      ctx.fillText(`${combo}x COMBO`, w / 2, 50)
    }

    // jump indicator
    if (!truck.grounded && truck.jumpsLeft > 0) {
      ctx.font = "16px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.fillText(`Tap to boost! (${truck.jumpsLeft})`, w / 2, h - 40)
    }

    if (score === 0 && truck.grounded) {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.fillText("Tap to jump and crush!", w / 2, 52)
    }
  }
}

function handleTap() {
  if (truck.grounded) {
    // ground jump
    truck.vy = -600
    truck.grounded = false
    truck.jumpsLeft = MAX_JUMPS - 1
    truck.flipAngle = 0
    // jump dust burst
    for (let i = 0; i < 8; i++) {
      dust.push({
        x: truck.x - 15 + Math.random() * 30,
        y: truck.y,
        vx: (Math.random() - 0.5) * 100,
        vy: -30 - Math.random() * 50,
        life: 1,
        size: 5 + Math.random() * 6
      })
    }
  } else if (truck.jumpsLeft > 0) {
    // air boost — upward burst with flames
    truck.jumpsLeft--
    truck.vy = -450
    truck.boostTimer = 0.3
    truck.flipAngle += Math.PI * 0.5 // add spin

    // boost flames
    for (let i = 0; i < 6; i++) {
      fireTrails.push({
        x: truck.x + (Math.random() - 0.5) * 20,
        y: truck.y + 10,
        vx: (Math.random() - 0.5) * 60,
        vy: 40 + Math.random() * 60,
        life: 0.7,
        size: 12 + Math.random() * 14
      })
    }
  }
}

function getTerrainY(x, baseY) {
  // undulating hills using combined sine waves, offset by scroll
  const wx = x + bgOffset
  return baseY
    + Math.sin(wx * 0.008) * 20
    + Math.sin(wx * 0.02 + 2) * 8
    + Math.sin(wx * 0.004 + 5) * 15
}

function spawnCrushable(x) {
  const types = [
    { type: "car", w: 50, h: 28, color: "#e74c3c" },
    { type: "car", w: 50, h: 28, color: "#3498db" },
    { type: "car", w: 50, h: 28, color: "#27ae60" },
    { type: "car", w: 45, h: 26, color: "#f39c12" },
    { type: "car", w: 48, h: 27, color: "#9b59b6" },
    { type: "bus", w: 75, h: 32, color: "#f1c40f" },
    { type: "bus", w: 75, h: 32, color: "#1abc9c" },
    { type: "van", w: 55, h: 34, color: "#ecf0f1" },
    { type: "tires", w: 35, h: 35, color: "#333" },
    { type: "box", w: 30, h: 30, color: "#8b6914" },
    { type: "box", w: 35, h: 25, color: "#95a5a6" },
    { type: "portapotty", w: 30, h: 42, color: "#2980b9" },
    { type: "ramp", w: 55, h: 28, color: "#c0803a" },
  ]
  const def = types[Math.floor(Math.random() * types.length)]
  const groundY = h * GROUND_BASE
  const terrY = getTerrainY(x, groundY)
  crushables.push({
    x,
    y: terrY - def.h * 0.5,
    w: def.w,
    h: def.h,
    type: def.type,
    color: def.color,
    crushed: false,
    crushTime: 0
  })
}

function drawTruck(ctx, t, groundY) {
  ctx.save()
  ctx.translate(t.x, t.y + t.suspensionOffset)
  ctx.rotate(t.rotation)

  const sz = t.size
  const squashY = 1 - t.squash * 0.2
  const squashX = 1 + t.squash * 0.1
  ctx.scale(squashX, squashY)

  // engine rumble
  const rumX = t.grounded ? t.engineRumble * 0.5 : 0
  const rumY = t.grounded ? Math.abs(t.engineRumble) * 0.3 : 0
  ctx.translate(rumX, rumY)

  // shadow
  if (t.grounded) {
    ctx.beginPath()
    ctx.ellipse(0, sz * 0.1, sz * 0.75, 7, 0, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.2)"
    ctx.fill()
  }

  // suspension arms
  ctx.strokeStyle = "#444"
  ctx.lineWidth = 4
  ctx.lineCap = "round"
  // rear
  ctx.beginPath()
  ctx.moveTo(-sz * 0.3, -sz * 0.15)
  ctx.lineTo(-sz * 0.45, sz * 0.05)
  ctx.stroke()
  // front
  ctx.beginPath()
  ctx.moveTo(sz * 0.3, -sz * 0.15)
  ctx.lineTo(sz * 0.45, sz * 0.05)
  ctx.stroke()

  // axles
  ctx.fillStyle = "#333"
  ctx.fillRect(-sz * 0.58, -sz * 0.02, sz * 1.16, 5)

  // wheels (BIG!)
  const wheelR = sz * 0.3
  drawWheel(ctx, -sz * 0.45, sz * 0.02, wheelR, t.wheelPhase)
  drawWheel(ctx, sz * 0.45, sz * 0.02, wheelR, t.wheelPhase)

  const bodyY = -sz * 0.4

  // bed/back
  ctx.fillStyle = "#b71c1c"
  ctx.beginPath()
  ctx.roundRect(-sz * 0.7, bodyY - sz * 0.12, sz * 0.6, sz * 0.45, 4)
  ctx.fill()

  // cab
  ctx.fillStyle = "#d32f2f"
  ctx.beginPath()
  ctx.roundRect(-sz * 0.1, bodyY - sz * 0.5, sz * 0.7, sz * 0.65, [10, 10, 4, 4])
  ctx.fill()

  // racing stripe
  ctx.fillStyle = "#ff8a65"
  ctx.fillRect(-sz * 0.68, bodyY - sz * 0.02, sz * 1.25, sz * 0.07)

  // flame decal on side
  ctx.fillStyle = "#feca57"
  ctx.beginPath()
  ctx.moveTo(-sz * 0.5, bodyY + sz * 0.15)
  ctx.quadraticCurveTo(-sz * 0.2, bodyY - sz * 0.1, sz * 0.1, bodyY + sz * 0.15)
  ctx.quadraticCurveTo(-sz * 0.1, bodyY + sz * 0.05, -sz * 0.3, bodyY + sz * 0.15)
  ctx.fill()
  ctx.fillStyle = "#ff6b00"
  ctx.beginPath()
  ctx.moveTo(-sz * 0.45, bodyY + sz * 0.15)
  ctx.quadraticCurveTo(-sz * 0.25, bodyY, 0, bodyY + sz * 0.15)
  ctx.quadraticCurveTo(-sz * 0.15, bodyY + sz * 0.08, -sz * 0.3, bodyY + sz * 0.15)
  ctx.fill()

  // windshield
  ctx.fillStyle = "rgba(100,180,255,0.7)"
  ctx.beginPath()
  ctx.roundRect(sz * 0.18, bodyY - sz * 0.44, sz * 0.32, sz * 0.25, [6, 6, 0, 0])
  ctx.fill()
  // windshield glare
  ctx.fillStyle = "rgba(255,255,255,0.15)"
  ctx.beginPath()
  ctx.roundRect(sz * 0.22, bodyY - sz * 0.42, sz * 0.12, sz * 0.2, 3)
  ctx.fill()

  // headlights (glowing)
  ctx.beginPath()
  ctx.arc(sz * 0.6, bodyY - sz * 0.05, 6, 0, Math.PI * 2)
  ctx.fillStyle = "#feca57"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.6, bodyY - sz * 0.05, 10, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(254,202,87,0.15)"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.6, bodyY + sz * 0.1, 4, 0, Math.PI * 2)
  ctx.fillStyle = "#feca57"
  ctx.fill()

  // exhaust pipes
  ctx.fillStyle = "#555"
  ctx.fillRect(-sz * 0.66, bodyY - sz * 0.6, 7, sz * 0.2)
  ctx.fillRect(-sz * 0.52, bodyY - sz * 0.55, 7, sz * 0.15)
  // pipe tops
  ctx.fillStyle = "#777"
  ctx.beginPath()
  ctx.arc(-sz * 0.625, bodyY - sz * 0.6, 4.5, 0, Math.PI * 2)
  ctx.arc(-sz * 0.485, bodyY - sz * 0.55, 4.5, 0, Math.PI * 2)
  ctx.fill()

  // roll cage
  ctx.strokeStyle = "#999"
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(sz * 0.05, bodyY - sz * 0.48)
  ctx.lineTo(-sz * 0.05, bodyY - sz * 0.65)
  ctx.lineTo(sz * 0.45, bodyY - sz * 0.65)
  ctx.lineTo(sz * 0.55, bodyY - sz * 0.48)
  ctx.stroke()

  // bumper
  ctx.fillStyle = "#bbb"
  ctx.beginPath()
  ctx.roundRect(sz * 0.52, bodyY + sz * 0.05, sz * 0.14, sz * 0.1, 2)
  ctx.fill()

  // number
  ctx.fillStyle = "#fff"
  ctx.font = `bold ${sz * 0.24}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.strokeStyle = "rgba(0,0,0,0.3)"
  ctx.lineWidth = 2
  ctx.strokeText("1", sz * 0.25, bodyY - sz * 0.02)
  ctx.fillText("1", sz * 0.25, bodyY - sz * 0.02)

  ctx.restore()
}

function drawWheel(ctx, x, y, r, spin) {
  // tire
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = "#1a1a1a"
  ctx.fill()

  // outer ring
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = "#333"
  ctx.lineWidth = 3
  ctx.stroke()

  // aggressive tread
  ctx.strokeStyle = "#3a3a3a"
  ctx.lineWidth = 3
  for (let i = 0; i < 8; i++) {
    const a = spin + (i / 8) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55)
    ctx.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92)
    ctx.stroke()
  }

  // hub
  ctx.beginPath()
  ctx.arc(x, y, r * 0.38, 0, Math.PI * 2)
  ctx.fillStyle = "#ccc"
  ctx.fill()
  ctx.strokeStyle = "#999"
  ctx.lineWidth = 2
  ctx.stroke()

  // lug nuts
  ctx.fillStyle = "#777"
  for (let i = 0; i < 5; i++) {
    const a = spin * 0.5 + (i / 5) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * r * 0.22, y + Math.sin(a) * r * 0.22, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // center cap
  ctx.beginPath()
  ctx.arc(x, y, r * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = "#e74c3c"
  ctx.fill()
}

function drawCrushable(ctx, c, groundY) {
  ctx.save()
  ctx.translate(c.x, c.y)

  if (c.crushed) {
    const flat = Math.min(c.crushTime * 5, 0.85)
    ctx.scale(1 + flat * 0.4, 1 - flat)
    ctx.globalAlpha = Math.max(0, 1 - c.crushTime * 0.6)
  }

  if (c.type === "car") {
    ctx.beginPath()
    ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h * 0.7, 5)
    ctx.fillStyle = c.color
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(-c.w * 0.25, -c.h * 0.68, c.w * 0.5, c.h * 0.48, [5, 5, 0, 0])
    ctx.fillStyle = c.color
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(-c.w * 0.18, -c.h * 0.6, c.w * 0.36, c.h * 0.3, 2)
    ctx.fillStyle = "rgba(150,210,255,0.6)"
    ctx.fill()
    ctx.fillStyle = "#222"
    ctx.beginPath()
    ctx.arc(-c.w * 0.28, c.h * 0.2, 7, 0, Math.PI * 2)
    ctx.arc(c.w * 0.28, c.h * 0.2, 7, 0, Math.PI * 2)
    ctx.fill()
    // headlights
    ctx.fillStyle = "#feca57"
    ctx.beginPath()
    ctx.arc(c.w / 2 - 2, 0, 3, 0, Math.PI * 2)
    ctx.fill()

  } else if (c.type === "bus") {
    ctx.beginPath()
    ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 5)
    ctx.fillStyle = c.color
    ctx.fill()
    // windows
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "rgba(150,210,255,0.6)"
      ctx.beginPath()
      ctx.roundRect(-c.w * 0.4 + i * c.w * 0.22, -c.h * 0.35, c.w * 0.16, c.h * 0.35, 2)
      ctx.fill()
    }
    ctx.fillStyle = "#222"
    ctx.beginPath()
    ctx.arc(-c.w * 0.35, c.h * 0.45, 7, 0, Math.PI * 2)
    ctx.arc(c.w * 0.35, c.h * 0.45, 7, 0, Math.PI * 2)
    ctx.fill()

  } else if (c.type === "van") {
    ctx.beginPath()
    ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 6)
    ctx.fillStyle = c.color
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(c.w * 0.1, -c.h * 0.4, c.w * 0.3, c.h * 0.35, [4, 4, 0, 0])
    ctx.fillStyle = "rgba(150,210,255,0.6)"
    ctx.fill()
    ctx.fillStyle = "#222"
    ctx.beginPath()
    ctx.arc(-c.w * 0.3, c.h * 0.45, 6, 0, Math.PI * 2)
    ctx.arc(c.w * 0.3, c.h * 0.45, 6, 0, Math.PI * 2)
    ctx.fill()

  } else if (c.type === "tires") {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc((i - 1) * 10, (i - 1) * -8, 12, 0, Math.PI * 2)
      ctx.fillStyle = "#222"
      ctx.fill()
      ctx.beginPath()
      ctx.arc((i - 1) * 10, (i - 1) * -8, 5, 0, Math.PI * 2)
      ctx.fillStyle = "#555"
      ctx.fill()
    }

  } else if (c.type === "portapotty") {
    ctx.beginPath()
    ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 3)
    ctx.fillStyle = c.color
    ctx.fill()
    // roof
    ctx.fillStyle = "#1a5276"
    ctx.beginPath()
    ctx.roundRect(-c.w / 2 - 2, -c.h / 2 - 4, c.w + 4, 8, [3, 3, 0, 0])
    ctx.fill()
    // door
    ctx.fillStyle = "#2471a3"
    ctx.beginPath()
    ctx.roundRect(-c.w * 0.3, -c.h * 0.2, c.w * 0.6, c.h * 0.6, 2)
    ctx.fill()
    // vent
    ctx.fillStyle = "#1a5276"
    ctx.fillRect(-c.w * 0.2, -c.h * 0.35, c.w * 0.4, c.h * 0.1)

  } else if (c.type === "box") {
    ctx.beginPath()
    ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 3)
    ctx.fillStyle = c.color
    ctx.fill()
    ctx.strokeStyle = "rgba(255,255,255,0.3)"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, -c.h / 2)
    ctx.lineTo(0, c.h / 2)
    ctx.moveTo(-c.w / 2, 0)
    ctx.lineTo(c.w / 2, 0)
    ctx.stroke()

  } else if (c.type === "ramp") {
    ctx.beginPath()
    ctx.moveTo(-c.w / 2, c.h / 2)
    ctx.lineTo(c.w / 2, c.h / 2)
    ctx.lineTo(c.w / 2, -c.h / 2)
    ctx.closePath()
    ctx.fillStyle = c.color
    ctx.fill()
    // warning stripes
    ctx.strokeStyle = "rgba(255,255,0,0.6)"
    ctx.lineWidth = 3
    for (let i = 0; i < 4; i++) {
      const lx = -c.w * 0.15 + i * c.w * 0.2
      ctx.beginPath()
      ctx.moveTo(lx, c.h / 2)
      ctx.lineTo(lx + c.w * 0.12, -c.h * 0.2 + i * 3)
      ctx.stroke()
    }
    // arrow
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.beginPath()
    ctx.moveTo(c.w * 0.1, c.h * 0.1)
    ctx.lineTo(c.w * 0.3, -c.h * 0.15)
    ctx.lineTo(c.w * 0.2, c.h * 0.1)
    ctx.fill()
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

function drawStar(ctx, x, y, size) {
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
  ctx.fillStyle = "#feca57"
  ctx.fill()
  ctx.strokeStyle = "#f0b429"
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x - size * 0.15, y - size * 0.15, size * 0.2, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.fill()
}
