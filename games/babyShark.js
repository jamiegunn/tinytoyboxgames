import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let dragHandler, tapHandler
let shark, fish, bubbles, score, time
let eatenAnim
let chaseTarget = null

const FISH_COLORS = [
  { body: "#ff9f43", fin: "#e67e22", stripe: "#feca57" },
  { body: "#54a0ff", fin: "#2d7dd2", stripe: "#a8d8ff" },
  { body: "#ff6b6b", fin: "#d63031", stripe: "#ffaaaa" },
  { body: "#26de81", fin: "#1abc60", stripe: "#a8f0c8" },
  { body: "#a55eea", fin: "#7c3aed", stripe: "#d4b5f7" },
  { body: "#ff9ff3", fin: "#e056a0", stripe: "#ffd1ef" },
]

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    score = 0
    time = 0
    eatenAnim = []
    chaseTarget = null

    shark = {
      x: w / 2,
      y: h / 2,
      targetX: w / 2,
      targetY: h / 2,
      angle: 0,
      mouthOpen: 0,
      size: 50,
      tailPhase: 0
    }

    fish = []
    bubbles = []
    for (let i = 0; i < 6; i++) spawnFish()

    tapHandler = handleTap
    dragHandler = handleDrag
    input.onTap(tapHandler)
    input.onDragMove(dragHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    input.offDragMove(dragHandler)
    fish = []
    bubbles = []
    eatenAnim = []
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight
    time += dt

    // if chasing a tapped fish, home in directly on it
    if (chaseTarget) {
      if (chaseTarget.eaten) {
        chaseTarget = null
      } else {
        const cdx = chaseTarget.x - shark.x
        const cdy = chaseTarget.y - shark.y
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy)
        shark.angle = Math.atan2(cdy, cdx)

        if (cdist < shark.size + chaseTarget.size) {
          // close enough — eat it now
          shark.x = chaseTarget.x
          shark.y = chaseTarget.y
          shark.targetX = chaseTarget.x
          shark.targetY = chaseTarget.y
          chaseTarget.eaten = true
          score++
          shark.mouthOpen = 1
          eatenAnim.push({
            x: chaseTarget.x, y: chaseTarget.y,
            t: 0, color: chaseTarget.colors.body
          })
          celebrate()
          if (score % 10 === 0) celebrateBig()
          chaseTarget = null
        } else {
          // move toward fish — never overshoot
          const step = Math.min(cdist, 800 * dt)
          shark.x += (cdx / cdist) * step
          shark.y += (cdy / cdist) * step
          shark.targetX = shark.x
          shark.targetY = shark.y
        }
      }
    }

    // normal movement (only when not chasing)
    if (!chaseTarget) {
      const dx = shark.targetX - shark.x
      const dy = shark.targetY - shark.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 2) {
        const speed = Math.min(dist * 4, 600)
        shark.x += (dx / dist) * speed * dt
        shark.y += (dy / dist) * speed * dt
        shark.angle = Math.atan2(dy, dx)
      }
    }

    // keep shark on screen
    const pad = shark.size * 0.5
    shark.x = Math.max(pad, Math.min(w - pad, shark.x))
    shark.y = Math.max(pad, Math.min(h - pad, shark.y))

    shark.tailPhase += dt * (chaseTarget ? 14 : 8)
    // mouth stays open while chasing, otherwise closes
    if (chaseTarget) {
      shark.mouthOpen = Math.min(1, shark.mouthOpen + dt * 4)
    } else {
      shark.mouthOpen = Math.max(0, shark.mouthOpen - dt * 3)
    }

    // fish AI: swim around, flee from shark
    fish.forEach(f => {
      const fdx = shark.x - f.x
      const fdy = shark.y - f.y
      const fdist = Math.sqrt(fdx * fdx + fdy * fdy)

      const isChased = chaseTarget === f

      // chased fish freezes completely — no movement at all
      if (isChased) {
        f.speed = 0
        f.tailPhase += dt * 12
      } else if (fdist < 180) {
        // flee if shark is close
        const fleeAngle = Math.atan2(-fdy, -fdx)
        f.angle += angleDiff(f.angle, fleeAngle) * 3 * dt
        f.speed = Math.min(f.speed + 300 * dt, 200)

        // near miss — shark was very close but didn't eat: burst of speed
        if (fdist < shark.size + f.size * 0.8 + 20 && fdist > shark.size + f.size * 0.5) {
          f.speed = Math.min(f.speed + 600 * dt, 350)
        }
      } else {
        // wander
        f.wanderTimer -= dt
        if (f.wanderTimer <= 0) {
          f.wanderAngle = f.angle + (Math.random() - 0.5) * 2
          f.wanderTimer = 1 + Math.random() * 2
        }
        f.angle += angleDiff(f.angle, f.wanderAngle) * 2 * dt
        f.speed = Math.max(f.speed - 100 * dt, 40 + f.baseSpeed)
      }

      // only move if not frozen
      if (!isChased) {
        f.x += Math.cos(f.angle) * f.speed * dt
        f.y += Math.sin(f.angle) * f.speed * dt
      }
      f.tailPhase += dt * 6

      // wrap around edges
      const pad = 30
      if (f.x < -pad) f.x = w + pad
      if (f.x > w + pad) f.x = -pad
      if (f.y < -pad) f.y = h + pad
      if (f.y > h + pad) f.y = -pad

      // check eaten by shark
      const edx = shark.x - f.x
      const edy = shark.y - f.y
      if (Math.sqrt(edx * edx + edy * edy) < shark.size + f.size * 0.5) {
        f.eaten = true
        score++
        shark.mouthOpen = 1
        if (chaseTarget === f) chaseTarget = null

        eatenAnim.push({
          x: f.x, y: f.y,
          t: 0, color: f.colors.body
        })

        celebrate()
        if (score % 10 === 0) celebrateBig()
      }
    })

    fish = fish.filter(f => !f.eaten)

    // respawn fish
    if (fish.length < 4 + Math.min(score, 6)) {
      spawnFish()
    }

    // eaten animations
    eatenAnim.forEach(e => { e.t += dt * 3 })
    eatenAnim = eatenAnim.filter(e => e.t < 1)

    // ambient bubbles
    if (Math.random() < dt * 2) {
      bubbles.push({
        x: Math.random() * w,
        y: h + 10,
        speed: 30 + Math.random() * 40,
        size: 3 + Math.random() * 6,
        wobble: Math.random() * Math.PI * 2
      })
    }
    bubbles.forEach(b => {
      b.y -= b.speed * dt
      b.wobble += dt * 2
      b.x += Math.sin(b.wobble) * 0.3
    })
    bubbles = bubbles.filter(b => b.y > -20)
  },

  render() {
    // ocean background
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, "#0e6ca8")
    bg.addColorStop(0.5, "#0a5a8f")
    bg.addColorStop(1, "#083d5a")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // light rays from surface
    ctx.globalAlpha = 0.04
    for (let i = 0; i < 5; i++) {
      const rx = w * 0.1 + i * w * 0.2
      ctx.beginPath()
      ctx.moveTo(rx - 20, 0)
      ctx.lineTo(rx + 60, h)
      ctx.lineTo(rx + 100, h)
      ctx.lineTo(rx + 20, 0)
      ctx.fillStyle = "#fff"
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // seabed
    ctx.fillStyle = "#065a3a"
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let sx = 0; sx <= w; sx += 40) {
      ctx.lineTo(sx, h - 20 - Math.sin(sx * 0.04) * 10)
    }
    ctx.lineTo(w, h)
    ctx.fill()

    // seaweed
    for (let sw = 30; sw < w; sw += 80 + Math.sin(sw) * 30) {
      drawSeaweed(ctx, sw, h - 20, time)
    }

    // bubbles
    bubbles.forEach(b => {
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(255,255,255,0.2)"
      ctx.lineWidth = 1
      ctx.stroke()
    })

    // fish
    fish.forEach(f => drawFish(ctx, f))

    // chase target indicator
    if (chaseTarget && !chaseTarget.eaten) {
      const pulse = 0.5 + Math.sin(time * 8) * 0.3
      ctx.beginPath()
      ctx.arc(chaseTarget.x, chaseTarget.y, chaseTarget.size + 16, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 80, 80, ${pulse})`
      ctx.lineWidth = 2.5
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // eaten animations (little stars)
    eatenAnim.forEach(e => {
      ctx.globalAlpha = 1 - e.t
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const r = e.t * 40
        ctx.beginPath()
        ctx.arc(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 4 * (1 - e.t), 0, Math.PI * 2)
        ctx.fillStyle = e.color
        ctx.fill()
      }
      ctx.globalAlpha = 1
    })

    // baby shark
    drawShark(ctx, shark)

    // score
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    ctx.font = "bold 30px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2, 16)

    if (score === 0) {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.fillText("Tap a fish or drag to chase!", w / 2, 52)
    }
  }
}

function handleTap(x, y) {
  // check if user tapped on a fish — lock shark onto it for a chase
  for (let i = fish.length - 1; i >= 0; i--) {
    const f = fish[i]
    const dx = f.x - x
    const dy = f.y - y
    if (Math.sqrt(dx * dx + dy * dy) < f.size + 45) {
      chaseTarget = f
      return
    }
  }

  // no fish tapped — cancel chase, move shark 10% past the click point
  chaseTarget = null
  setOvershootTarget(x, y)
}

function handleDrag(x, y) {
  chaseTarget = null
  setOvershootTarget(x, y)
}

function setOvershootTarget(x, y) {
  const dx = x - shark.x
  const dy = y - shark.y
  shark.targetX = shark.x + dx * 1.1
  shark.targetY = shark.y + dy * 1.1
}

function spawnFish() {
  const side = Math.floor(Math.random() * 4)
  let x, y
  if (side === 0) { x = -30; y = Math.random() * h }
  else if (side === 1) { x = w + 30; y = Math.random() * h }
  else if (side === 2) { x = Math.random() * w; y = -30 }
  else { x = Math.random() * w; y = h + 30 }

  fish.push({
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 40 + Math.random() * 30,
    baseSpeed: 30 + Math.random() * 20,
    size: 18 + Math.random() * 12,
    colors: FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)],
    tailPhase: Math.random() * Math.PI * 2,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: Math.random() * 2,
    eaten: false
  })
}

function angleDiff(from, to) {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function drawShark(ctx, s) {
  ctx.save()
  ctx.translate(s.x, s.y)
  ctx.rotate(s.angle)

  const sz = s.size
  const tailWag = Math.sin(s.tailPhase) * 0.3

  // tail
  ctx.save()
  ctx.rotate(tailWag)
  ctx.beginPath()
  ctx.moveTo(-sz * 0.6, 0)
  ctx.lineTo(-sz * 1.2, -sz * 0.4)
  ctx.lineTo(-sz * 1.2, sz * 0.4)
  ctx.closePath()
  ctx.fillStyle = "#5a9abf"
  ctx.fill()
  ctx.restore()

  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, sz, sz * 0.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#6cb4d9"
  ctx.fill()

  // belly
  ctx.beginPath()
  ctx.ellipse(sz * 0.1, sz * 0.12, sz * 0.7, sz * 0.28, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#d4eef7"
  ctx.fill()

  // dorsal fin
  ctx.beginPath()
  ctx.moveTo(-sz * 0.1, -sz * 0.45)
  ctx.lineTo(sz * 0.15, -sz * 0.9)
  ctx.lineTo(sz * 0.35, -sz * 0.45)
  ctx.fillStyle = "#5a9abf"
  ctx.fill()

  // side fins
  ctx.beginPath()
  ctx.moveTo(sz * 0.1, sz * 0.4)
  ctx.lineTo(-sz * 0.15, sz * 0.8)
  ctx.lineTo(sz * 0.3, sz * 0.45)
  ctx.fillStyle = "#5a9abf"
  ctx.fill()

  // mouth
  const mouthGap = s.mouthOpen * sz * 0.2
  ctx.beginPath()
  ctx.moveTo(sz * 0.85, -mouthGap)
  ctx.lineTo(sz * 1.05, 0)
  ctx.lineTo(sz * 0.85, mouthGap)
  if (s.mouthOpen > 0.3) {
    ctx.lineTo(sz * 0.85, mouthGap)
    ctx.fillStyle = "#c0392b"
    ctx.fill()
  }

  // eye
  ctx.beginPath()
  ctx.arc(sz * 0.5, -sz * 0.15, sz * 0.14, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.54, -sz * 0.15, sz * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.56, -sz * 0.18, sz * 0.03, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()

  // cheek blush (baby!)
  ctx.beginPath()
  ctx.arc(sz * 0.35, sz * 0.1, sz * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,150,150,0.3)"
  ctx.fill()

  ctx.restore()
}

function drawFish(ctx, f) {
  ctx.save()
  ctx.translate(f.x, f.y)
  ctx.rotate(f.angle)

  const sz = f.size
  const tailWag = Math.sin(f.tailPhase) * 0.35

  // tail
  ctx.save()
  ctx.rotate(tailWag)
  ctx.beginPath()
  ctx.moveTo(-sz * 0.6, 0)
  ctx.lineTo(-sz * 1.3, -sz * 0.5)
  ctx.lineTo(-sz * 1.3, sz * 0.5)
  ctx.closePath()
  ctx.fillStyle = f.colors.fin
  ctx.fill()
  ctx.restore()

  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, sz, sz * 0.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = f.colors.body
  ctx.fill()

  // stripe
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.3, sz * 0.45, 0, 0, Math.PI * 2)
  ctx.fillStyle = f.colors.stripe
  ctx.globalAlpha = 0.4
  ctx.fill()
  ctx.globalAlpha = 1

  // dorsal fin
  ctx.beginPath()
  ctx.moveTo(0, -sz * 0.4)
  ctx.lineTo(sz * 0.15, -sz * 0.75)
  ctx.lineTo(sz * 0.3, -sz * 0.4)
  ctx.fillStyle = f.colors.fin
  ctx.fill()

  // eye
  ctx.beginPath()
  ctx.arc(sz * 0.4, -sz * 0.1, sz * 0.15, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.44, -sz * 0.1, sz * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()

  // mouth
  ctx.beginPath()
  ctx.arc(sz * 0.7, sz * 0.08, sz * 0.08, 0.2, Math.PI * 0.8)
  ctx.strokeStyle = f.colors.fin
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}

function drawSeaweed(ctx, x, baseY, time) {
  const segments = 5
  const segH = 14
  ctx.strokeStyle = "#0a8a50"
  ctx.lineWidth = 5
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(x, baseY)
  for (let i = 1; i <= segments; i++) {
    const sway = Math.sin(time * 1.5 + x * 0.1 + i * 0.8) * (6 + i * 2)
    ctx.lineTo(x + sway, baseY - i * segH)
  }
  ctx.stroke()

  ctx.strokeStyle = "#0caa60"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x + 8, baseY)
  for (let i = 1; i <= segments - 1; i++) {
    const sway = Math.sin(time * 1.8 + x * 0.1 + i * 0.6 + 1) * (5 + i * 2)
    ctx.lineTo(x + 8 + sway, baseY - i * segH)
  }
  ctx.stroke()
}
