import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let truck, obstacles, crushables, stars, ground, score, time
let dust, screenShake
let jumpPressed

const GROUND_BASE = 0.78
const TRUCK_SIZE = 50
const SCROLL_SPEED = 200
const GRAVITY = 1200

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    score = 0
    time = 0
    dust = []
    screenShake = 0
    jumpPressed = false

    const groundY = h * GROUND_BASE

    truck = {
      x: w * 0.25,
      y: groundY,
      vy: 0,
      rotation: 0,
      wheelPhase: 0,
      grounded: true,
      size: TRUCK_SIZE,
      squash: 0
    }

    obstacles = []
    crushables = []
    stars = []
    ground = []

    // initial ground segments
    for (let gx = 0; gx < w + 200; gx += 20) {
      ground.push({ x: gx, y: groundY + Math.sin(gx * 0.01) * 3 })
    }

    // initial obstacles and crushables
    for (let i = 0; i < 3; i++) {
      spawnCrushable(w + 200 + i * 300)
    }

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    obstacles = []
    crushables = []
    stars = []
    dust = []
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight
    time += dt
    const groundY = h * GROUND_BASE
    const speed = SCROLL_SPEED + score * 3

    // scroll everything left
    crushables.forEach(c => { c.x -= speed * dt })
    stars.forEach(s => { s.x -= speed * dt })
    ground.forEach(g => { g.x -= speed * dt })

    // add new ground
    const lastG = ground[ground.length - 1]
    if (lastG && lastG.x < w + 100) {
      for (let gx = lastG.x + 20; gx < lastG.x + 300; gx += 20) {
        ground.push({ x: gx, y: groundY + Math.sin(gx * 0.015) * 4 })
      }
    }
    ground = ground.filter(g => g.x > -40)

    // spawn crushables
    const lastC = crushables[crushables.length - 1]
    if (!lastC || lastC.x < w - 100) {
      spawnCrushable(w + 100 + Math.random() * 200)
    }

    // spawn stars
    if (Math.random() < dt * 1.5) {
      stars.push({
        x: w + 30,
        y: groundY - 80 - Math.random() * 120,
        size: 12 + Math.random() * 8,
        collected: false,
        bob: Math.random() * Math.PI * 2
      })
    }

    // truck physics
    if (jumpPressed && truck.grounded) {
      truck.vy = -550
      truck.grounded = false
      jumpPressed = false
      // jump dust
      for (let i = 0; i < 6; i++) {
        dust.push({
          x: truck.x - 10 + Math.random() * 20,
          y: truck.y,
          vx: (Math.random() - 0.5) * 80,
          vy: -20 - Math.random() * 40,
          life: 1,
          size: 4 + Math.random() * 5
        })
      }
    }
    jumpPressed = false

    if (!truck.grounded) {
      truck.vy += GRAVITY * dt
      truck.y += truck.vy * dt
      truck.rotation = Math.min(0.3, Math.max(-0.3, truck.vy * 0.0005))

      if (truck.y >= groundY) {
        truck.y = groundY
        truck.vy = 0
        truck.grounded = true
        truck.rotation = 0
        truck.squash = 0.3
        screenShake = 0.2

        // landing dust
        for (let i = 0; i < 8; i++) {
          dust.push({
            x: truck.x - 15 + Math.random() * 30,
            y: groundY,
            vx: (Math.random() - 0.5) * 120,
            vy: -30 - Math.random() * 50,
            life: 1,
            size: 4 + Math.random() * 6
          })
        }
      }
    }

    truck.squash = Math.max(0, truck.squash - dt * 3)
    screenShake = Math.max(0, screenShake - dt * 3)
    truck.wheelPhase += dt * speed * 0.05

    // rolling dust
    if (truck.grounded && Math.random() < dt * 8) {
      dust.push({
        x: truck.x - 20,
        y: groundY - 2,
        vx: -30 - Math.random() * 20,
        vy: -10 - Math.random() * 15,
        life: 0.6,
        size: 3 + Math.random() * 4
      })
    }

    // check crush
    crushables.forEach(c => {
      if (c.crushed) return
      const dx = truck.x - c.x
      const dy = truck.y - c.y
      if (Math.abs(dx) < truck.size * 0.8 + c.w * 0.4 &&
          Math.abs(dy) < truck.size * 0.5 + c.h * 0.4) {
        c.crushed = true
        c.crushTime = 0
        score++
        screenShake = 0.3
        celebrate()
        if (score % 10 === 0) celebrateBig()

        // crush particles
        for (let i = 0; i < 10; i++) {
          dust.push({
            x: c.x + (Math.random() - 0.5) * c.w,
            y: c.y + (Math.random() - 0.5) * c.h,
            vx: (Math.random() - 0.5) * 150,
            vy: -50 - Math.random() * 100,
            life: 1,
            size: 3 + Math.random() * 5,
            color: c.color
          })
        }
      }
    })

    // update crushed animation
    crushables.forEach(c => {
      if (c.crushed) c.crushTime = (c.crushTime || 0) + dt
    })
    crushables = crushables.filter(c => c.x > -100 && (!c.crushed || c.crushTime < 2))

    // collect stars
    stars.forEach(s => {
      if (s.collected) return
      s.bob += dt * 3
      const dx = truck.x - s.x
      const dy = truck.y - truck.size * 0.3 - s.y
      if (Math.sqrt(dx * dx + dy * dy) < truck.size * 0.6 + s.size) {
        s.collected = true
        score++
        celebrate()
      }
    })
    stars = stars.filter(s => s.x > -50 && !s.collected)

    // dust
    dust.forEach(d => {
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.vy += 60 * dt
      d.life -= dt * 2
    })
    dust = dust.filter(d => d.life > 0)
  },

  render() {
    const groundY = h * GROUND_BASE

    // apply screen shake
    ctx.save()
    if (screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * screenShake * 12,
        (Math.random() - 0.5) * screenShake * 12
      )
    }

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, "#f08030")
    sky.addColorStop(0.3, "#f5a050")
    sky.addColorStop(0.6, "#f8d070")
    sky.addColorStop(1, "#90c040")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // sun
    ctx.beginPath()
    ctx.arc(w * 0.8, h * 0.12, 40, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,240,100,0.8)"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(w * 0.8, h * 0.12, 55, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,240,100,0.15)"
    ctx.fill()

    // distant mountains
    ctx.fillStyle = "#7ab040"
    ctx.beginPath()
    ctx.moveTo(0, h * 0.65)
    for (let x = 0; x <= w; x += 80) {
      ctx.lineTo(x, h * 0.65 - Math.sin(x * 0.005 + 2) * 40 - Math.sin(x * 0.012) * 20)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.fill()

    // ground (dirt)
    ctx.fillStyle = "#c8a050"
    ctx.fillRect(0, groundY - 3, w, h - groundY + 3)

    // ground texture lines
    ctx.strokeStyle = "rgba(0,0,0,0.06)"
    ctx.lineWidth = 1
    ground.forEach(g => {
      ctx.beginPath()
      ctx.moveTo(g.x, g.y)
      ctx.lineTo(g.x + 15, g.y + 2)
      ctx.stroke()
    })

    // track marks
    ctx.strokeStyle = "rgba(0,0,0,0.08)"
    ctx.lineWidth = 3
    ctx.setLineDash([8, 12])
    ctx.beginPath()
    ctx.moveTo(0, groundY + 3)
    ctx.lineTo(truck.x - 20, groundY + 3)
    ctx.stroke()
    ctx.setLineDash([])

    // crushables
    crushables.forEach(c => drawCrushable(ctx, c, groundY))

    // stars
    stars.forEach(s => {
      if (s.collected) return
      const bob = Math.sin(s.bob) * 5
      drawStar(ctx, s.x, s.y + bob, s.size)
    })

    // dust
    dust.forEach(d => {
      ctx.globalAlpha = d.life * 0.6
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
      ctx.fillStyle = d.color || "#c8a050"
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // truck
    drawTruck(ctx, truck, groundY)

    ctx.restore() // end screen shake

    // score
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    ctx.font = "bold 30px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2, 16)

    if (score === 0) {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      ctx.fillText("Tap to jump!", w / 2, 52)
    }
  }
}

function handleTap() {
  jumpPressed = true
}

function spawnCrushable(x) {
  const types = [
    { type: "car", w: 50, h: 28, color: "#e74c3c" },
    { type: "car", w: 50, h: 28, color: "#3498db" },
    { type: "car", w: 50, h: 28, color: "#27ae60" },
    { type: "car", w: 45, h: 26, color: "#f39c12" },
    { type: "box", w: 30, h: 30, color: "#8b6914" },
    { type: "box", w: 35, h: 25, color: "#95a5a6" },
    { type: "ramp", w: 50, h: 24, color: "#c0803a" },
  ]
  const def = types[Math.floor(Math.random() * types.length)]
  const groundY = h * GROUND_BASE
  crushables.push({
    x,
    y: groundY - def.h * 0.5,
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
  ctx.translate(t.x, t.y)
  ctx.rotate(t.rotation)

  const sz = t.size
  const squashY = 1 - t.squash * 0.2
  const squashX = 1 + t.squash * 0.1
  ctx.scale(squashX, squashY)

  // shadow
  ctx.beginPath()
  ctx.ellipse(0, sz * 0.1, sz * 0.7, 6, 0, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(0,0,0,0.15)"
  ctx.fill()

  // axles
  ctx.fillStyle = "#333"
  ctx.fillRect(-sz * 0.55, -sz * 0.05, sz * 1.1, 6)

  // wheels (big!)
  const wheelR = sz * 0.28
  const wheelSpin = t.wheelPhase

  // rear wheels
  drawWheel(ctx, -sz * 0.4, 0, wheelR, wheelSpin)
  // front wheels
  drawWheel(ctx, sz * 0.4, 0, wheelR, wheelSpin)

  // body - lifted high on suspension
  const bodyY = -sz * 0.45

  // bed/back
  ctx.fillStyle = "#d32f2f"
  ctx.beginPath()
  ctx.roundRect(-sz * 0.65, bodyY - sz * 0.15, sz * 0.55, sz * 0.45, 4)
  ctx.fill()

  // cab
  ctx.fillStyle = "#e53935"
  ctx.beginPath()
  ctx.roundRect(-sz * 0.1, bodyY - sz * 0.45, sz * 0.65, sz * 0.6, [8, 8, 4, 4])
  ctx.fill()

  // cab stripe
  ctx.fillStyle = "#ff8a65"
  ctx.fillRect(-sz * 0.08, bodyY - sz * 0.12, sz * 0.6, sz * 0.06)

  // windshield
  ctx.fillStyle = "rgba(150,210,255,0.7)"
  ctx.beginPath()
  ctx.roundRect(sz * 0.15, bodyY - sz * 0.4, sz * 0.3, sz * 0.22, [6, 6, 0, 0])
  ctx.fill()

  // headlight
  ctx.beginPath()
  ctx.arc(sz * 0.55, bodyY - sz * 0.05, 5, 0, Math.PI * 2)
  ctx.fillStyle = "#feca57"
  ctx.fill()

  // exhaust pipes
  ctx.fillStyle = "#555"
  ctx.fillRect(-sz * 0.62, bodyY - sz * 0.55, 6, sz * 0.15)
  ctx.fillRect(-sz * 0.48, bodyY - sz * 0.5, 6, sz * 0.1)

  // bumper
  ctx.fillStyle = "#bbb"
  ctx.fillRect(sz * 0.45, bodyY + sz * 0.05, sz * 0.14, sz * 0.08)

  // number
  ctx.fillStyle = "#fff"
  ctx.font = `bold ${sz * 0.22}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("1", sz * 0.2, bodyY - sz * 0.02)

  ctx.restore()
}

function drawWheel(ctx, x, y, r, spin) {
  // tire
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()

  // tread
  ctx.strokeStyle = "#444"
  ctx.lineWidth = 2
  for (let i = 0; i < 6; i++) {
    const a = spin + (i / 6) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5)
    ctx.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95)
    ctx.stroke()
  }

  // hub
  ctx.beginPath()
  ctx.arc(x, y, r * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = "#bbb"
  ctx.fill()

  // lug nuts
  ctx.fillStyle = "#888"
  for (let i = 0; i < 4; i++) {
    const a = spin * 0.5 + (i / 4) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawCrushable(ctx, c, groundY) {
  ctx.save()
  ctx.translate(c.x, c.y)

  if (c.crushed) {
    // flatten animation
    const flat = Math.min(c.crushTime * 4, 0.8)
    ctx.scale(1 + flat * 0.3, 1 - flat)
    ctx.globalAlpha = Math.max(0, 1 - c.crushTime * 0.8)
  }

  if (c.type === "car") {
    // car body
    ctx.beginPath()
    ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h * 0.7, 4)
    ctx.fillStyle = c.color
    ctx.fill()

    // roof
    ctx.beginPath()
    ctx.roundRect(-c.w * 0.25, -c.h * 0.65, c.w * 0.5, c.h * 0.45, [4, 4, 0, 0])
    ctx.fillStyle = c.color
    ctx.fill()

    // window
    ctx.beginPath()
    ctx.roundRect(-c.w * 0.18, -c.h * 0.58, c.w * 0.36, c.h * 0.28, 2)
    ctx.fillStyle = "rgba(150,210,255,0.6)"
    ctx.fill()

    // wheels
    ctx.fillStyle = "#222"
    ctx.beginPath()
    ctx.arc(-c.w * 0.28, c.h * 0.2, 6, 0, Math.PI * 2)
    ctx.arc(c.w * 0.28, c.h * 0.2, 6, 0, Math.PI * 2)
    ctx.fill()
  } else if (c.type === "box") {
    ctx.beginPath()
    ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 3)
    ctx.fillStyle = c.color
    ctx.fill()
    // tape
    ctx.strokeStyle = "rgba(255,255,255,0.3)"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, -c.h / 2)
    ctx.lineTo(0, c.h / 2)
    ctx.stroke()
  } else if (c.type === "ramp") {
    ctx.beginPath()
    ctx.moveTo(-c.w / 2, c.h / 2)
    ctx.lineTo(c.w / 2, c.h / 2)
    ctx.lineTo(c.w / 2, -c.h / 2)
    ctx.closePath()
    ctx.fillStyle = c.color
    ctx.fill()
    // stripes
    ctx.strokeStyle = "rgba(255,255,0,0.5)"
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      const lx = -c.w * 0.2 + i * c.w * 0.25
      ctx.beginPath()
      ctx.moveTo(lx, c.h / 2)
      ctx.lineTo(lx + c.w * 0.15, -c.h * 0.1 + i * 4)
      ctx.stroke()
    }
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

  // shine
  ctx.beginPath()
  ctx.arc(x - size * 0.15, y - size * 0.15, size * 0.2, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.fill()
}
