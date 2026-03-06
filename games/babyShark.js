import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let dragHandler, tapHandler
let shark, fish, bubbles, score, time
let eatenAnim, scorePopups
let chaseTarget = null
let combo, comboTimer, lastEatTime
let screenShake, slowMo
let corals, jellyfish, sandParticles, godRays
let seaParticles, treasures

const FISH_COLORS = [
  { body: "#ff9f43", fin: "#e67e22", stripe: "#feca57", name: "clown" },
  { body: "#54a0ff", fin: "#2d7dd2", stripe: "#a8d8ff", name: "blue" },
  { body: "#ff6b6b", fin: "#d63031", stripe: "#ffaaaa", name: "red" },
  { body: "#26de81", fin: "#1abc60", stripe: "#a8f0c8", name: "green" },
  { body: "#a55eea", fin: "#7c3aed", stripe: "#d4b5f7", name: "purple" },
  { body: "#ff9ff3", fin: "#e056a0", stripe: "#ffd1ef", name: "pink" },
  { body: "#feca57", fin: "#f0b429", stripe: "#fff3a0", name: "gold" },
  { body: "#00cec9", fin: "#00b894", stripe: "#81ecec", name: "teal" },
]

const CORAL_TYPES = ["fan", "brain", "tube", "branch", "anemone"]

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
    lastEatTime = 0
    screenShake = 0
    slowMo = 1
    eatenAnim = []
    scorePopups = []
    chaseTarget = null
    sandParticles = []
    seaParticles = []

    shark = {
      x: w / 2,
      y: h / 2,
      targetX: w / 2,
      targetY: h / 2,
      angle: 0,
      mouthOpen: 0,
      size: 50,
      tailPhase: 0,
      happiness: 0,
      sizeBonus: 0,
      speedTrail: []
    }

    fish = []
    bubbles = []
    for (let i = 0; i < 6; i++) spawnFish()

    // generate coral reef
    corals = []
    for (let cx = 20; cx < w; cx += 40 + Math.random() * 50) {
      corals.push({
        x: cx,
        y: h - 15 - Math.sin(cx * 0.04) * 10,
        type: CORAL_TYPES[Math.floor(Math.random() * CORAL_TYPES.length)],
        color: ['#ff6b6b', '#ff9ff3', '#feca57', '#a55eea', '#ff9f43', '#00cec9', '#e17055'][Math.floor(Math.random() * 7)],
        size: 12 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2
      })
    }

    // jellyfish
    jellyfish = []
    for (let i = 0; i < 3; i++) {
      jellyfish.push({
        x: Math.random() * w,
        y: h * 0.3 + Math.random() * h * 0.4,
        size: 12 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
        color: ['rgba(180,120,255,0.5)', 'rgba(100,200,255,0.4)', 'rgba(255,150,200,0.45)'][Math.floor(Math.random() * 3)],
        pulsePhase: Math.random() * Math.PI * 2
      })
    }

    // god rays
    godRays = []
    for (let i = 0; i < 6; i++) {
      godRays.push({
        x: Math.random() * w,
        width: 30 + Math.random() * 50,
        alpha: 0.02 + Math.random() * 0.03,
        speed: 5 + Math.random() * 10,
        drift: (Math.random() - 0.5) * 15
      })
    }

    // treasure
    treasures = []
    for (let i = 0; i < 2; i++) {
      treasures.push({
        x: w * 0.2 + Math.random() * w * 0.6,
        y: h - 25 - Math.sin(Math.random() * 5) * 10,
        type: Math.random() < 0.5 ? "chest" : "shell",
        size: 14 + Math.random() * 8
      })
    }

    tapHandler = handleTap
    dragHandler = handleDrag
    input.onTap(tapHandler)
    input.onDragMove(dragHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    input.offDragMove(dragHandler)
    fish = []; bubbles = []; eatenAnim = []; scorePopups = []
    corals = []; jellyfish = []; sandParticles = []; seaParticles = []
  },

  update(dt) {
    w = ctx.canvas.width
    h = ctx.canvas.height

    // slow mo decay
    if (slowMo < 1) slowMo = Math.min(1, slowMo + dt * 2.5)
    dt *= slowMo

    time += dt

    // screen shake decay
    if (screenShake > 0) screenShake *= Math.pow(0.04, dt)
    if (screenShake < 0.3) screenShake = 0

    // combo timer
    if (comboTimer > 0) {
      comboTimer -= dt
      if (comboTimer <= 0) { combo = 0; comboTimer = 0 }
    }

    // shark happiness decay
    shark.happiness *= Math.pow(0.2, dt)

    // if chasing a tapped fish, home in directly
    if (chaseTarget) {
      if (chaseTarget.eaten) {
        chaseTarget = null
      } else {
        const cdx = chaseTarget.x - shark.x
        const cdy = chaseTarget.y - shark.y
        const cdist = Math.sqrt(cdx * cdx + cdy * cdy)
        shark.angle = Math.atan2(cdy, cdx)

        if (cdist < shark.size + shark.sizeBonus + chaseTarget.size) {
          eatFish(chaseTarget)
          chaseTarget = null
        } else {
          const step = Math.min(cdist, 900 * dt)
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
        const speed = Math.min(dist * 4, 650)
        shark.x += (dx / dist) * speed * dt
        shark.y += (dy / dist) * speed * dt
        shark.angle = Math.atan2(dy, dx)
      }
    }

    // keep shark on screen
    const pad = (shark.size + shark.sizeBonus) * 0.5
    shark.x = Math.max(pad, Math.min(w - pad, shark.x))
    shark.y = Math.max(pad, Math.min(h - pad, shark.y))

    shark.tailPhase += dt * (chaseTarget ? 16 : 9)
    if (chaseTarget) {
      shark.mouthOpen = Math.min(1, shark.mouthOpen + dt * 5)
    } else {
      shark.mouthOpen = Math.max(0, shark.mouthOpen - dt * 3)
    }

    // speed trail (bubble trail)
    const sharkSpeed = chaseTarget ? 900 : 0
    if (sharkSpeed > 100 || chaseTarget) {
      shark.speedTrail.push({ x: shark.x, y: shark.y, life: 1, size: 3 + Math.random() * 4 })
    }
    shark.speedTrail.forEach(t => { t.life -= dt * 3 })
    shark.speedTrail = shark.speedTrail.filter(t => t.life > 0)

    // size bonus slowly returns to 0
    shark.sizeBonus = Math.max(0, shark.sizeBonus - dt * 2)

    // fish AI
    fish.forEach(f => {
      const fdx = shark.x - f.x
      const fdy = shark.y - f.y
      const fdist = Math.sqrt(fdx * fdx + fdy * fdy)
      const isChased = chaseTarget === f

      if (isChased) {
        f.speed = 0
        f.tailPhase += dt * 14
        f.scared = 1
      } else if (fdist < 200) {
        const fleeAngle = Math.atan2(-fdy, -fdx)
        f.angle += angleDiff(f.angle, fleeAngle) * 3.5 * dt
        f.speed = Math.min(f.speed + 350 * dt, 220)
        f.scared = Math.min(1, f.scared + dt * 3)

        if (fdist < (shark.size + shark.sizeBonus) + f.size * 0.8 + 20 && fdist > (shark.size + shark.sizeBonus) + f.size * 0.5) {
          f.speed = Math.min(f.speed + 700 * dt, 380)
        }
      } else {
        f.scared = Math.max(0, f.scared - dt * 2)
        f.wanderTimer -= dt
        if (f.wanderTimer <= 0) {
          f.wanderAngle = f.angle + (Math.random() - 0.5) * 2
          f.wanderTimer = 1 + Math.random() * 2
        }
        f.angle += angleDiff(f.angle, f.wanderAngle) * 2 * dt
        f.speed = Math.max(f.speed - 100 * dt, 40 + f.baseSpeed)
      }

      if (!isChased) {
        f.x += Math.cos(f.angle) * f.speed * dt
        f.y += Math.sin(f.angle) * f.speed * dt
      }
      f.tailPhase += dt * (6 + f.speed * 0.01)
      f.shimmer = (f.shimmer || 0) + dt * 3

      const fp = 30
      if (f.x < -fp) f.x = w + fp
      if (f.x > w + fp) f.x = -fp
      if (f.y < -fp) f.y = h + fp
      if (f.y > h + fp) f.y = -fp

      // eaten by shark (non-chase contact)
      const edx = shark.x - f.x
      const edy = shark.y - f.y
      if (Math.sqrt(edx * edx + edy * edy) < (shark.size + shark.sizeBonus) + f.size * 0.5) {
        eatFish(f)
        if (chaseTarget === f) chaseTarget = null
      }
    })

    fish = fish.filter(f => !f.eaten)
    if (fish.length < 4 + Math.min(score, 8)) spawnFish()

    // eaten animations
    eatenAnim.forEach(e => { e.t += dt * 2.5 })
    eatenAnim = eatenAnim.filter(e => e.t < 1)

    // score popups
    scorePopups.forEach(p => { p.y -= 55 * dt; p.life -= dt })
    scorePopups = scorePopups.filter(p => p.life > 0)

    // ambient bubbles
    if (Math.random() < dt * 3) {
      bubbles.push({
        x: Math.random() * w,
        y: h + 10,
        speed: 25 + Math.random() * 50,
        size: 2 + Math.random() * 7,
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.1 + Math.random() * 0.15
      })
    }
    // shark exhale bubbles
    if (Math.random() < dt * 4) {
      const bx = shark.x - Math.cos(shark.angle) * shark.size * 0.5
      const by = shark.y - Math.sin(shark.angle) * shark.size * 0.5
      bubbles.push({
        x: bx + (Math.random() - 0.5) * 10,
        y: by + (Math.random() - 0.5) * 10,
        speed: 40 + Math.random() * 30,
        size: 2 + Math.random() * 4,
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.15
      })
    }
    bubbles.forEach(b => {
      b.y -= b.speed * dt
      b.wobble += dt * 2.5
      b.x += Math.sin(b.wobble) * 0.4
    })
    bubbles = bubbles.filter(b => b.y > -20)

    // sand particles (kicked up near seabed)
    sandParticles.forEach(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy -= 15 * dt
      p.life -= dt * 1.5
    })
    sandParticles = sandParticles.filter(p => p.life > 0)

    // floating sea particles (plankton)
    if (Math.random() < dt * 5) {
      seaParticles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 1 + Math.random() * 2,
        life: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 8,
        vy: -3 + Math.random() * 6,
        alpha: 0.05 + Math.random() * 0.1
      })
    }
    seaParticles.forEach(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
    })
    seaParticles = seaParticles.filter(p => p.life > 0)

    // jellyfish float
    jellyfish.forEach(j => {
      j.phase += dt
      j.pulsePhase += dt * 3
      j.y -= 8 * dt
      j.x += Math.sin(j.phase * 0.8) * 15 * dt
      if (j.y < -40) { j.y = h + 40; j.x = Math.random() * w }
    })

    // god ray drift
    godRays.forEach(r => {
      r.x += r.drift * dt
      if (r.x < -r.width) r.x = w + r.width
      if (r.x > w + r.width) r.x = -r.width
    })
  },

  render() {
    ctx.save()

    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake)
    }

    // ocean gradient — deeper, richer
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, "#0a7cc4")
    bg.addColorStop(0.25, "#0968a8")
    bg.addColorStop(0.55, "#065a8f")
    bg.addColorStop(0.8, "#04405a")
    bg.addColorStop(1, "#032d3a")
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // god rays
    godRays.forEach(r => {
      ctx.globalAlpha = r.alpha + Math.sin(time * 0.5 + r.x * 0.01) * 0.01
      ctx.fillStyle = "#8ed8f0"
      ctx.beginPath()
      ctx.moveTo(r.x - r.width * 0.3, 0)
      ctx.lineTo(r.x + r.width * 0.3, 0)
      ctx.lineTo(r.x + r.width * 0.8 + r.drift * 2, h)
      ctx.lineTo(r.x - r.width * 0.2 + r.drift * 2, h)
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // water surface caustics
    ctx.globalAlpha = 0.03
    for (let cx = 0; cx < w; cx += 60) {
      for (let cy = 0; cy < h * 0.3; cy += 60) {
        const wobble = Math.sin(time * 1.5 + cx * 0.05 + cy * 0.08) * 12
        ctx.beginPath()
        ctx.ellipse(cx + wobble, cy, 20 + Math.sin(time + cx) * 8, 12, wobble * 0.02, 0, Math.PI * 2)
        ctx.fillStyle = "#fff"
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // floating sea particles (plankton)
    seaParticles.forEach(p => {
      ctx.globalAlpha = p.alpha * Math.min(1, p.life)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = "#a8d8ff"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // seabed with sandy gradient
    const seabedY = h - 35
    const sand = ctx.createLinearGradient(0, seabedY, 0, h)
    sand.addColorStop(0, "#065a3a")
    sand.addColorStop(0.4, "#0a6a44")
    sand.addColorStop(1, "#085530")
    ctx.fillStyle = sand
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let sx = 0; sx <= w; sx += 30) {
      ctx.lineTo(sx, seabedY + Math.sin(sx * 0.04) * 10 + Math.sin(sx * 0.09 + 2) * 5)
    }
    ctx.lineTo(w, h)
    ctx.fill()

    // sand texture dots
    ctx.fillStyle = "rgba(200,180,120,0.06)"
    for (let i = 0; i < 40; i++) {
      const sx = (i * 37 + 10) % w
      const sy = seabedY + 8 + Math.sin(sx * 0.04) * 10 + Math.random() * 15
      ctx.beginPath()
      ctx.arc(sx, sy, 2 + Math.random() * 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // treasures
    treasures.forEach(t => drawTreasure(ctx, t))

    // corals
    corals.forEach(c => drawCoral(ctx, c))

    // seaweed (more lush)
    for (let sw = 25; sw < w; sw += 65 + Math.sin(sw) * 25) {
      drawSeaweed(ctx, sw, seabedY + Math.sin(sw * 0.04) * 10 + 5, time)
    }

    // sand particles
    sandParticles.forEach(p => {
      ctx.globalAlpha = p.life * 0.3
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = "#c4a86a"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // jellyfish (behind fish)
    jellyfish.forEach(j => drawJellyfish(ctx, j))

    // bubbles
    bubbles.forEach(b => {
      ctx.globalAlpha = b.alpha
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(255,255,255,0.3)"
      ctx.lineWidth = 1
      ctx.stroke()
      // shine
      ctx.beginPath()
      ctx.arc(b.x - b.size * 0.2, b.y - b.size * 0.2, b.size * 0.25, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,0.15)"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // speed trail
    shark.speedTrail.forEach(t => {
      ctx.globalAlpha = t.life * 0.2
      ctx.beginPath()
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(150,220,255,0.4)"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // fish
    fish.forEach(f => drawFish(ctx, f))

    // chase target indicator
    if (chaseTarget && !chaseTarget.eaten) {
      const pulse = 0.5 + Math.sin(time * 10) * 0.3
      ctx.beginPath()
      ctx.arc(chaseTarget.x, chaseTarget.y, chaseTarget.size + 18, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255, 80, 80, ${pulse})`
      ctx.lineWidth = 2.5
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // scared indicator - exclamation marks
      if (chaseTarget.scared > 0.5) {
        ctx.font = "bold 16px sans-serif"
        ctx.fillStyle = `rgba(255,100,100,${pulse})`
        ctx.textAlign = "center"
        ctx.fillText("!", chaseTarget.x, chaseTarget.y - chaseTarget.size - 15)
      }
    }

    // eaten animations (vortex/swirl)
    eatenAnim.forEach(e => {
      ctx.globalAlpha = 1 - e.t
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + e.t * 6
        const r = e.t * 50
        const s = 5 * (1 - e.t)
        ctx.beginPath()
        ctx.arc(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, s, 0, Math.PI * 2)
        ctx.fillStyle = e.color
        ctx.fill()
      }
      // star burst
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + e.t * 3
        const r = e.t * 30
        drawStar(ctx, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 3 * (1 - e.t), "#feca57")
      }
      ctx.globalAlpha = 1
    })

    // baby shark
    drawShark(ctx, shark)

    // score popups
    scorePopups.forEach(p => {
      const alpha = Math.min(1, p.life * 2)
      const s = p.scale * (1 + (1.5 - p.life) * 0.2)
      ctx.globalAlpha = alpha
      ctx.font = `bold ${Math.round(22 * s)}px sans-serif`
      ctx.textAlign = "center"
      ctx.strokeStyle = "rgba(0,0,0,0.3)"
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
      const by = 56
      ctx.fillStyle = "rgba(0,0,0,0.2)"
      ctx.beginPath()
      ctx.roundRect(bx, by, barW, barH, 4)
      ctx.fill()
      const fill = comboTimer / 3
      const cc = combo >= 5 ? "#ff6b6b" : combo >= 3 ? "#feca57" : "#54a0ff"
      ctx.fillStyle = cc
      ctx.beginPath()
      ctx.roundRect(bx, by, barW * fill, barH, 4)
      ctx.fill()
      ctx.font = "bold 13px sans-serif"
      ctx.fillStyle = cc
      ctx.textAlign = "center"
      ctx.fillText(`CHOMP x${combo}`, w / 2, by - 3)
    }

    // score
    ctx.fillStyle = "rgba(0,0,0,0.15)"
    ctx.font = "bold 34px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2 + 1, 17)
    ctx.fillStyle = "rgba(255,255,255,0.92)"
    ctx.fillText(score, w / 2, 16)

    if (score === 0) {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.fillText("Tap a fish to catch it!", w / 2, 54)
    }

    ctx.restore()
  }
}

function eatFish(f) {
  f.eaten = true
  shark.mouthOpen = 1
  shark.happiness = 1
  shark.sizeBonus = Math.min(8, shark.sizeBonus + 1.5)

  // combo
  const timeSince = time - lastEatTime
  if (timeSince < 2.5) {
    combo++
    comboTimer = 3
  } else {
    combo = 1
    comboTimer = 3
  }
  lastEatTime = time

  const points = Math.max(1, combo)
  score += points

  // effects scale with combo
  screenShake = Math.min(12, 3 + combo * 2)
  if (combo >= 3) slowMo = 0.35

  // popup
  const label = combo > 1 ? `+${points} x${combo}` : `+${points}`
  scorePopups.push({
    x: f.x, y: f.y - 10,
    text: label,
    life: 1.5,
    color: combo >= 3 ? '#feca57' : '#fff',
    scale: combo >= 3 ? 1.3 : 1
  })

  // swirl anim
  eatenAnim.push({ x: f.x, y: f.y, t: 0, color: f.colors.body })

  // sand kick if near bottom
  if (f.y > h * 0.7) {
    for (let i = 0; i < 6; i++) {
      sandParticles.push({
        x: f.x + (Math.random() - 0.5) * 20,
        y: f.y,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 40,
        size: 2 + Math.random() * 3,
        life: 1
      })
    }
  }

  celebrate()
  if (score % 10 === 0) celebrateBig()
}

function handleTap(x, y) {
  for (let i = fish.length - 1; i >= 0; i--) {
    const f = fish[i]
    const dx = f.x - x
    const dy = f.y - y
    if (Math.sqrt(dx * dx + dy * dy) < f.size + 50) {
      chaseTarget = f
      return
    }
  }
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
  if (side === 0) { x = -30; y = Math.random() * h * 0.85 }
  else if (side === 1) { x = w + 30; y = Math.random() * h * 0.85 }
  else if (side === 2) { x = Math.random() * w; y = -30 }
  else { x = Math.random() * w; y = h * 0.8 + 30 }

  const colors = FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)]
  const isSpecial = score > 8 && Math.random() < 0.12
  const size = isSpecial ? (28 + Math.random() * 12) : (16 + Math.random() * 14)

  fish.push({
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 40 + Math.random() * 30,
    baseSpeed: 30 + Math.random() * 20,
    size,
    colors,
    tailPhase: Math.random() * Math.PI * 2,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: Math.random() * 2,
    eaten: false,
    scared: 0,
    shimmer: Math.random() * Math.PI * 2,
    isSpecial,
    scalePattern: Math.random() < 0.4
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

  const sz = s.size + s.sizeBonus
  const tailWag = Math.sin(s.tailPhase) * 0.35
  const happyBounce = Math.sin(time * 12) * s.happiness * 3

  ctx.translate(0, happyBounce)

  // shadow/glow when happy
  if (s.happiness > 0.1) {
    ctx.beginPath()
    ctx.arc(0, 0, sz * 1.3, 0, Math.PI * 2)
    const glow = ctx.createRadialGradient(0, 0, sz * 0.5, 0, 0, sz * 1.3)
    glow.addColorStop(0, `rgba(255,220,100,${s.happiness * 0.15})`)
    glow.addColorStop(1, "rgba(255,220,100,0)")
    ctx.fillStyle = glow
    ctx.fill()
  }

  // tail
  ctx.save()
  ctx.rotate(tailWag)
  ctx.beginPath()
  ctx.moveTo(-sz * 0.6, 0)
  ctx.lineTo(-sz * 1.3, -sz * 0.45)
  ctx.quadraticCurveTo(-sz * 1.0, 0, -sz * 1.3, sz * 0.45)
  ctx.closePath()
  ctx.fillStyle = "#5a9abf"
  ctx.fill()
  ctx.restore()

  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 1.05, sz * 0.55, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#6cb4d9"
  ctx.fill()

  // body highlight
  ctx.beginPath()
  ctx.ellipse(sz * 0.1, -sz * 0.15, sz * 0.6, sz * 0.2, 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.08)"
  ctx.fill()

  // belly
  ctx.beginPath()
  ctx.ellipse(sz * 0.1, sz * 0.14, sz * 0.75, sz * 0.3, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#d4eef7"
  ctx.fill()

  // dorsal fin
  ctx.beginPath()
  ctx.moveTo(-sz * 0.1, -sz * 0.5)
  ctx.quadraticCurveTo(sz * 0.05, -sz * 1.05, sz * 0.35, -sz * 0.48)
  ctx.fillStyle = "#5a9abf"
  ctx.fill()

  // side fin
  ctx.beginPath()
  ctx.moveTo(sz * 0.05, sz * 0.45)
  ctx.quadraticCurveTo(-sz * 0.1, sz * 0.9, sz * 0.35, sz * 0.5)
  ctx.fillStyle = "#5a9abf"
  ctx.fill()

  // other side fin (visible from angle)
  ctx.beginPath()
  ctx.moveTo(-sz * 0.2, sz * 0.42)
  ctx.quadraticCurveTo(-sz * 0.35, sz * 0.75, -sz * 0.05, sz * 0.48)
  ctx.fillStyle = "#4d8baa"
  ctx.fill()

  // mouth
  const mouthGap = s.mouthOpen * sz * 0.25
  if (s.mouthOpen > 0.2) {
    ctx.beginPath()
    ctx.moveTo(sz * 0.85, -mouthGap)
    ctx.quadraticCurveTo(sz * 1.1, 0, sz * 0.85, mouthGap)
    ctx.lineTo(sz * 0.7, mouthGap * 0.5)
    ctx.lineTo(sz * 0.7, -mouthGap * 0.5)
    ctx.fillStyle = "#c0392b"
    ctx.fill()
    // teeth
    if (s.mouthOpen > 0.4) {
      ctx.fillStyle = "#fff"
      for (let i = 0; i < 3; i++) {
        const tx = sz * 0.75 + i * sz * 0.08
        ctx.beginPath()
        ctx.moveTo(tx, -mouthGap * 0.7)
        ctx.lineTo(tx + 2, -mouthGap * 0.3)
        ctx.lineTo(tx - 2, -mouthGap * 0.3)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(tx, mouthGap * 0.7)
        ctx.lineTo(tx + 2, mouthGap * 0.3)
        ctx.lineTo(tx - 2, mouthGap * 0.3)
        ctx.fill()
      }
    }
  }

  // eye
  const eyeSz = sz * 0.16
  ctx.beginPath()
  ctx.arc(sz * 0.48, -sz * 0.18, eyeSz, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  // pupil looks toward chase target or movement direction
  const px = s.happiness > 0.3 ? 0 : sz * 0.03
  ctx.beginPath()
  ctx.arc(sz * 0.52 + px, -sz * 0.18, eyeSz * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = "#1a2a3a"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.54 + px, -sz * 0.21, eyeSz * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()

  // happy sparkle eyes
  if (s.happiness > 0.5) {
    ctx.globalAlpha = s.happiness
    drawStar(ctx, sz * 0.54, -sz * 0.21, eyeSz * 0.3, "#fff")
    ctx.globalAlpha = 1
  }

  // cheek blush
  ctx.beginPath()
  ctx.arc(sz * 0.33, sz * 0.12, sz * 0.14, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255,150,150,${0.2 + s.happiness * 0.2})`
  ctx.fill()

  // smile when happy
  if (s.happiness > 0.2) {
    ctx.beginPath()
    ctx.arc(sz * 0.6, sz * 0.05, sz * 0.12, 0.2, Math.PI - 0.2)
    ctx.strokeStyle = `rgba(60,60,80,${s.happiness * 0.5})`
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.stroke()
  }

  ctx.restore()
}

function drawFish(ctx, f) {
  ctx.save()
  ctx.translate(f.x, f.y)
  ctx.rotate(f.angle)

  const sz = f.size
  const tailWag = Math.sin(f.tailPhase) * 0.4

  // scared effect — vibrate
  if (f.scared > 0.5) {
    ctx.translate(Math.sin(time * 40) * f.scared * 2, Math.cos(time * 35) * f.scared)
  }

  // tail
  ctx.save()
  ctx.rotate(tailWag)
  ctx.beginPath()
  ctx.moveTo(-sz * 0.6, 0)
  ctx.lineTo(-sz * 1.35, -sz * 0.55)
  ctx.quadraticCurveTo(-sz * 1.0, 0, -sz * 1.35, sz * 0.55)
  ctx.closePath()
  ctx.fillStyle = f.colors.fin
  ctx.fill()
  ctx.restore()

  // body
  ctx.beginPath()
  ctx.ellipse(0, 0, sz, sz * 0.52, 0, 0, Math.PI * 2)
  ctx.fillStyle = f.colors.body
  ctx.fill()

  // scales pattern
  if (f.scalePattern) {
    ctx.globalAlpha = 0.08
    for (let sx = -sz * 0.5; sx < sz * 0.5; sx += sz * 0.18) {
      for (let sy = -sz * 0.3; sy < sz * 0.3; sy += sz * 0.18) {
        ctx.beginPath()
        ctx.arc(sx, sy, sz * 0.07, 0, Math.PI * 2)
        ctx.strokeStyle = "#000"
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  // shimmer highlight
  const shimX = Math.sin(f.shimmer) * sz * 0.3
  ctx.beginPath()
  ctx.ellipse(shimX, -sz * 0.15, sz * 0.2, sz * 0.1, 0.2, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.15)"
  ctx.fill()

  // stripe
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.3, sz * 0.48, 0, 0, Math.PI * 2)
  ctx.fillStyle = f.colors.stripe
  ctx.globalAlpha = 0.35
  ctx.fill()
  ctx.globalAlpha = 1

  // second stripe for variety
  ctx.beginPath()
  ctx.ellipse(sz * 0.35, 0, sz * 0.08, sz * 0.45, 0, 0, Math.PI * 2)
  ctx.fillStyle = f.colors.stripe
  ctx.globalAlpha = 0.2
  ctx.fill()
  ctx.globalAlpha = 1

  // dorsal fin
  ctx.beginPath()
  ctx.moveTo(-sz * 0.05, -sz * 0.45)
  ctx.quadraticCurveTo(sz * 0.1, -sz * 0.82, sz * 0.3, -sz * 0.42)
  ctx.fillStyle = f.colors.fin
  ctx.fill()

  // bottom fin
  ctx.beginPath()
  ctx.moveTo(sz * 0.05, sz * 0.42)
  ctx.quadraticCurveTo(sz * 0.15, sz * 0.65, sz * 0.3, sz * 0.42)
  ctx.fillStyle = f.colors.fin
  ctx.fill()

  // eye — bigger when scared
  const eyeSize = sz * (0.16 + f.scared * 0.06)
  ctx.beginPath()
  ctx.arc(sz * 0.4, -sz * 0.12, eyeSize, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  const pupilSize = f.scared > 0.5 ? eyeSize * 0.4 : eyeSize * 0.55
  ctx.beginPath()
  ctx.arc(sz * 0.44, -sz * 0.12, pupilSize, 0, Math.PI * 2)
  ctx.fillStyle = "#222"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.46, -sz * 0.15, eyeSize * 0.2, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()

  // mouth
  ctx.beginPath()
  ctx.arc(sz * 0.72, sz * 0.06, sz * 0.07, 0.3, Math.PI * 0.7)
  ctx.strokeStyle = f.colors.fin
  ctx.lineWidth = 1.5
  ctx.stroke()

  // scared sweat drop
  if (f.scared > 0.7) {
    ctx.fillStyle = `rgba(100,180,255,${f.scared * 0.6})`
    ctx.beginPath()
    ctx.ellipse(sz * 0.25, -sz * 0.35, 2, 3.5, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  // special fish sparkle
  if (f.isSpecial) {
    ctx.globalAlpha = 0.4 + Math.sin(time * 6) * 0.2
    drawStar(ctx, sz * 0.1, -sz * 0.3, 4, "#feca57")
    drawStar(ctx, -sz * 0.3, sz * 0.15, 3, "#feca57")
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

function drawJellyfish(ctx, j) {
  ctx.save()
  ctx.translate(j.x, j.y)

  const pulse = Math.sin(j.pulsePhase) * 0.15
  const sz = j.size

  // bell
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * (1 + pulse), sz * (0.7 - pulse * 0.3), 0, Math.PI, 0)
  ctx.fillStyle = j.color
  ctx.fill()

  // inner glow
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.1, sz * 0.5, sz * 0.3, 0, Math.PI, 0)
  ctx.fillStyle = "rgba(255,255,255,0.1)"
  ctx.fill()

  // tentacles
  ctx.strokeStyle = j.color
  ctx.lineWidth = 1.5
  for (let i = 0; i < 5; i++) {
    const tx = (i - 2) * sz * 0.35
    ctx.beginPath()
    ctx.moveTo(tx, sz * 0.1)
    ctx.quadraticCurveTo(
      tx + Math.sin(time * 2 + i + j.phase) * 10,
      sz * 0.8,
      tx + Math.sin(time * 1.5 + i * 2 + j.phase) * 15,
      sz * 1.5
    )
    ctx.stroke()
  }

  // bioluminescent dots
  ctx.globalAlpha = 0.3 + Math.sin(time * 3 + j.phase) * 0.2
  ctx.fillStyle = "#fff"
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(Math.sin(i * 2) * sz * 0.3, -sz * 0.1 + i * sz * 0.15, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.restore()
}

function drawCoral(ctx, c) {
  ctx.save()
  ctx.translate(c.x, c.y)

  if (c.type === "fan") {
    const sway = Math.sin(time * 1.2 + c.phase) * 4
    ctx.strokeStyle = c.color
    ctx.lineWidth = 2
    for (let i = 0; i < 5; i++) {
      const a = -0.6 + i * 0.3
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(
        Math.cos(a) * c.size * 0.5 + sway,
        -c.size * 0.5,
        Math.cos(a) * c.size + sway,
        -c.size
      )
      ctx.stroke()
    }
  } else if (c.type === "brain") {
    ctx.beginPath()
    ctx.arc(0, -c.size * 0.4, c.size * 0.6, 0, Math.PI * 2)
    ctx.fillStyle = c.color
    ctx.fill()
    // grooves
    ctx.strokeStyle = "rgba(0,0,0,0.15)"
    ctx.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc((i - 1) * c.size * 0.15, -c.size * 0.4, c.size * 0.2, 0.5, Math.PI - 0.5)
      ctx.stroke()
    }
  } else if (c.type === "tube") {
    for (let i = 0; i < 3; i++) {
      const tx = (i - 1) * 6
      const th = c.size * (0.7 + i * 0.15)
      ctx.fillStyle = c.color
      ctx.beginPath()
      ctx.roundRect(tx - 3, -th, 6, th, 3)
      ctx.fill()
      // opening
      ctx.beginPath()
      ctx.ellipse(tx, -th, 4, 2, 0, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(0,0,0,0.2)"
      ctx.fill()
    }
  } else if (c.type === "branch") {
    ctx.strokeStyle = c.color
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    const sway = Math.sin(time * 1 + c.phase) * 3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(sway, -c.size * 0.6)
    ctx.lineTo(sway - 8, -c.size * 0.9)
    ctx.moveTo(sway, -c.size * 0.6)
    ctx.lineTo(sway + 10, -c.size * 0.85)
    ctx.moveTo(sway * 0.5, -c.size * 0.3)
    ctx.lineTo(sway + 8, -c.size * 0.5)
    ctx.stroke()
  } else if (c.type === "anemone") {
    // base
    ctx.fillStyle = c.color
    ctx.beginPath()
    ctx.ellipse(0, 0, c.size * 0.4, c.size * 0.15, 0, 0, Math.PI * 2)
    ctx.fill()
    // tentacles
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const sway = Math.sin(time * 2 + c.phase + i * 0.8) * 5
      ctx.strokeStyle = c.color
      ctx.lineWidth = 2.5
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * c.size * 0.2, -2)
      ctx.quadraticCurveTo(
        Math.cos(a) * c.size * 0.3 + sway,
        -c.size * 0.5,
        Math.cos(a) * c.size * 0.25 + sway * 1.5,
        -c.size * 0.8
      )
      ctx.stroke()
      // tip dot
      ctx.beginPath()
      ctx.arc(Math.cos(a) * c.size * 0.25 + sway * 1.5, -c.size * 0.8, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.globalAlpha = 0.5
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  ctx.restore()
}

function drawTreasure(ctx, t) {
  ctx.save()
  ctx.translate(t.x, t.y)

  if (t.type === "chest") {
    // chest body
    ctx.fillStyle = "#8a6a2e"
    ctx.beginPath()
    ctx.roundRect(-t.size, -t.size * 0.6, t.size * 2, t.size * 1.1, 3)
    ctx.fill()
    // lid
    ctx.fillStyle = "#a0782e"
    ctx.beginPath()
    ctx.ellipse(0, -t.size * 0.6, t.size, t.size * 0.3, 0, Math.PI, 0)
    ctx.fill()
    // metal bands
    ctx.strokeStyle = "#c4a02e"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-t.size, -t.size * 0.1)
    ctx.lineTo(t.size, -t.size * 0.1)
    ctx.moveTo(-t.size, t.size * 0.25)
    ctx.lineTo(t.size, t.size * 0.25)
    ctx.stroke()
    // lock
    ctx.fillStyle = "#feca57"
    ctx.beginPath()
    ctx.arc(0, -t.size * 0.1, 3, 0, Math.PI * 2)
    ctx.fill()
    // sparkle
    const sp = Math.sin(time * 3 + t.x) * 0.3 + 0.5
    ctx.globalAlpha = sp
    drawStar(ctx, t.size * 0.5, -t.size * 0.4, 4, "#feca57")
    ctx.globalAlpha = 1
  } else {
    // shell
    ctx.fillStyle = "#ffccaa"
    ctx.beginPath()
    ctx.ellipse(0, 0, t.size, t.size * 0.6, 0, 0, Math.PI * 2)
    ctx.fill()
    // ridges
    ctx.strokeStyle = "rgba(180,130,90,0.3)"
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const r = t.size * (0.3 + i * 0.15)
      ctx.beginPath()
      ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI)
      ctx.stroke()
    }
    // pearl
    if (Math.sin(time * 2 + t.x) > 0.3) {
      ctx.beginPath()
      ctx.arc(0, t.size * 0.15, 3, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.fill()
    }
  }

  ctx.restore()
}

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
    ctx.lineTo(x + Math.cos(a + 0.3) * r * 0.3, y + Math.sin(a + 0.3) * r * 0.3)
  }
  ctx.fill()
}

function drawSeaweed(ctx, x, baseY, time) {
  const segments = 6
  const segH = 16

  // main stalk
  ctx.strokeStyle = "#0a8a50"
  ctx.lineWidth = 5
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(x, baseY)
  for (let i = 1; i <= segments; i++) {
    const sway = Math.sin(time * 1.5 + x * 0.1 + i * 0.8) * (5 + i * 2.5)
    ctx.lineTo(x + sway, baseY - i * segH)
  }
  ctx.stroke()

  // leaves
  for (let i = 2; i <= segments; i += 2) {
    const sway = Math.sin(time * 1.5 + x * 0.1 + i * 0.8) * (5 + i * 2.5)
    const lx = x + sway
    const ly = baseY - i * segH
    const side = i % 4 === 0 ? 1 : -1
    ctx.fillStyle = "#0caa60"
    ctx.beginPath()
    ctx.ellipse(lx + side * 8, ly, 10, 4, side * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }

  // second shorter stalk
  ctx.strokeStyle = "#0caa60"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x + 7, baseY)
  for (let i = 1; i <= segments - 2; i++) {
    const sway = Math.sin(time * 1.8 + x * 0.1 + i * 0.6 + 1) * (4 + i * 2)
    ctx.lineTo(x + 7 + sway, baseY - i * segH)
  }
  ctx.stroke()

  // tiny bubbles near seaweed
  if (Math.sin(time * 2 + x) > 0.8) {
    ctx.globalAlpha = 0.2
    const topSway = Math.sin(time * 1.5 + x * 0.1 + segments * 0.8) * (5 + segments * 2.5)
    ctx.beginPath()
    ctx.arc(x + topSway + 3, baseY - segments * segH - 5, 2, 0, Math.PI * 2)
    ctx.strokeStyle = "rgba(255,255,255,0.3)"
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}
