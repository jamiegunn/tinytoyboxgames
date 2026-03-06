import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let animal, foods, score, feedCount, time
let particles, scorePopups, hearts, crumbs
let combo, comboTimer, lastFeedTime
let screenShake, currentAnimal
let clouds, butterflies, bgFlowers, grassBlades
let windPhase
let audioCtx

function playMunch() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const now = audioCtx.currentTime

  // Two quick crunches for a munch sound
  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.08
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.06)
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let j = 0; j < bufferSize; j++) {
      data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufferSize, 2)
    }
    const src = audioCtx.createBufferSource()
    src.buffer = buffer

    const filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1200 + Math.random() * 400

    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)

    src.connect(filter)
    filter.connect(gain)
    gain.connect(audioCtx.destination)
    src.start(t)
    src.stop(t + 0.06)
  }
}

const FOOD_ITEMS = [
  { id: "apple", draw: drawApple, color: "#ff6b6b" },
  { id: "banana", draw: drawBanana, color: "#feca57" },
  { id: "carrot", draw: drawCarrot, color: "#ff9f43" },
  { id: "grape", draw: drawGrape, color: "#a55eea" },
  { id: "watermelon", draw: drawWatermelon, color: "#ff6b6b" },
  { id: "strawberry", draw: drawStrawberry, color: "#e74c3c" },
  { id: "orange", draw: drawOrange, color: "#f39c12" },
  { id: "cherry", draw: drawCherry, color: "#c0392b" },
]

const ANIMALS = [
  { name: "bear", bodyColor: "#f8b500", earColor: "#ffcc80", noseColor: "#3a2510", cheekColor: "rgba(255,150,130,0.3)" },
  { name: "panda", bodyColor: "#f0f0f0", earColor: "#333", noseColor: "#222", cheekColor: "rgba(255,180,190,0.3)", patches: true },
  { name: "bunny", bodyColor: "#f0e0e8", earColor: "#ffb0c0", noseColor: "#ff9fb0", cheekColor: "rgba(255,150,180,0.3)", longEars: true },
  { name: "cat", bodyColor: "#ff9f43", earColor: "#e68830", noseColor: "#ff7a8a", cheekColor: "rgba(255,150,130,0.25)", whiskers: true },
  { name: "frog", bodyColor: "#26de81", earColor: "#1abc60", noseColor: "#1a9960", cheekColor: "rgba(255,200,150,0.2)", wide: true },
]

const ANIMAL_SIZE = 100
const FOOD_SIZE = 55

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = ctx.canvas.width
    h = ctx.canvas.height
    score = 0
    feedCount = 0
    time = 0
    combo = 0
    comboTimer = 0
    lastFeedTime = 0
    screenShake = 0
    windPhase = 0
    foods = []
    particles = []
    scorePopups = []
    hearts = []
    crumbs = []

    currentAnimal = ANIMALS[0]

    animal = {
      x: w / 2,
      y: h - 150,
      mouthOpen: 0,
      happiness: 0,
      bounceY: 0,
      bounceVel: 0,
      earWiggle: 0,
      chewing: 0,
      blinkTimer: 3,
      blinking: false,
      blinkAmount: 0,
      eyeSparkle: 0
    }

    // clouds
    clouds = []
    for (let i = 0; i < 4; i++) {
      clouds.push({
        x: Math.random() * w,
        y: 20 + Math.random() * 80,
        r: 18 + Math.random() * 24,
        speed: 5 + Math.random() * 10
      })
    }

    // butterflies
    butterflies = []
    for (let i = 0; i < 3; i++) {
      butterflies.push({
        x: Math.random() * w,
        y: h * 0.2 + Math.random() * h * 0.25,
        vx: (Math.random() - 0.5) * 25,
        vy: (Math.random() - 0.5) * 15,
        wingPhase: Math.random() * Math.PI * 2,
        color: ['#ff9ff3', '#feca57', '#54a0ff', '#ff6b6b'][Math.floor(Math.random() * 4)],
        size: 4 + Math.random() * 3
      })
    }

    // bg flowers
    bgFlowers = []
    for (let fx = 30; fx < w; fx += 60 + Math.random() * 70) {
      bgFlowers.push({
        x: fx,
        color: ['#ff6b9d', '#feca57', '#fff', '#ff9ff3', '#a55eea'][Math.floor(Math.random() * 5)],
        size: 3 + Math.random() * 3,
        petals: 4 + Math.floor(Math.random() * 3)
      })
    }

    // grass blades
    grassBlades = []
    for (let gx = 3; gx < w; gx += 7 + Math.random() * 10) {
      grassBlades.push({
        x: gx,
        height: 6 + Math.random() * 12,
        phase: Math.random() * Math.PI * 2,
        shade: Math.random()
      })
    }

    spawnFoods()

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    foods = []; particles = []; scorePopups = []; hearts = []; crumbs = []
  },

  update(dt) {
    w = ctx.canvas.width
    h = ctx.canvas.height
    time += dt
    windPhase += dt * 0.5
    animal.x = w / 2
    animal.y = h - 150

    // screen shake
    if (screenShake > 0) screenShake *= Math.pow(0.04, dt)
    if (screenShake < 0.3) screenShake = 0

    // combo
    if (comboTimer > 0) {
      comboTimer -= dt
      if (comboTimer <= 0) { combo = 0; comboTimer = 0 }
    }

    // animal animations
    animal.happiness *= Math.pow(0.4, dt)
    animal.earWiggle *= Math.pow(0.1, dt)
    animal.chewing = Math.max(0, animal.chewing - dt * 2)
    animal.eyeSparkle *= Math.pow(0.3, dt)

    // bounce
    animal.bounceVel += (-animal.bounceY) * 500 * dt
    animal.bounceVel *= Math.pow(0.03, dt)
    animal.bounceY += animal.bounceVel * dt

    // mouth
    if (animal.mouthOpen > 0 && animal.chewing <= 0)
      animal.mouthOpen = Math.max(0, animal.mouthOpen - dt * 3)

    // blinking
    animal.blinkTimer -= dt
    if (animal.blinkTimer <= 0) {
      animal.blinking = true
      animal.blinkTimer = 2.5 + Math.random() * 3
    }
    if (animal.blinking) {
      animal.blinkAmount += dt * 12
      if (animal.blinkAmount >= 1) { animal.blinking = false; animal.blinkAmount = 0 }
    }

    // food dropping animation
    foods.forEach(f => {
      f.bobPhase += dt * 2.5
      f.wobble *= Math.pow(0.1, dt)

      if (f.dropping) {
        f.dropTime += dt
        const t = Math.min(1, f.dropTime / f.dropDuration)
        f.x = f.startX + (f.targetX - f.startX) * t
        f.y = f.startY + (f.targetY - f.startY) * t - 160 * Math.sin(t * Math.PI)
        f.spin += dt * 8

        // trail sparkles
        if (Math.random() < dt * 6) {
          particles.push({
            x: f.x + (Math.random() - 0.5) * 15,
            y: f.y + (Math.random() - 0.5) * 15,
            vx: (Math.random() - 0.5) * 30,
            vy: 10 + Math.random() * 20,
            size: 2 + Math.random() * 3,
            life: 0.5,
            color: f.color || "#feca57",
            type: "dot"
          })
        }
      }
    })

    // check feeding
    foods.forEach(f => {
      if (f.dropping && !f.scored) {
        const dx = f.x - animal.x
        const dy = f.y - (animal.y + animal.bounceY)
        if (Math.sqrt(dx * dx + dy * dy) < ANIMAL_SIZE) {
          f.scored = true
          feedCount++

          // combo
          const timeSince = time - lastFeedTime
          if (timeSince < 3 && lastFeedTime > 0) {
            combo++
            comboTimer = 3
          } else {
            combo = 1
            comboTimer = 3
          }
          lastFeedTime = time

          const points = Math.max(1, combo)
          score += points

          animal.mouthOpen = 1
          animal.happiness = 1
          animal.bounceVel = -180
          animal.earWiggle = 1
          animal.chewing = 1.5
          animal.eyeSparkle = 1
          screenShake = Math.min(8, 2 + combo * 1.5)

          // score popup
          const label = combo > 1 ? `+${points} x${combo}!` : `+${points}`
          scorePopups.push({
            x: f.x, y: f.y - 20,
            text: label,
            life: 1.3,
            color: combo >= 3 ? '#feca57' : '#fff',
            scale: combo >= 3 ? 1.3 : 1
          })

          // hearts float up
          for (let i = 0; i < 2 + combo; i++) {
            hearts.push({
              x: animal.x + (Math.random() - 0.5) * 60,
              y: animal.y - 30,
              vx: (Math.random() - 0.5) * 40,
              vy: -60 - Math.random() * 80,
              size: 8 + Math.random() * 8,
              life: 1.5,
              rot: (Math.random() - 0.5) * 0.5
            })
          }

          // crumbs fly out
          for (let i = 0; i < 6; i++) {
            crumbs.push({
              x: animal.x + (Math.random() - 0.5) * 30,
              y: animal.y + 10,
              vx: (Math.random() - 0.5) * 120,
              vy: -30 - Math.random() * 60,
              size: 2 + Math.random() * 3,
              life: 0.8,
              color: f.color || "#feca57"
            })
          }

          playMunch()
          celebrate()
          if (feedCount % 5 === 0) {
            celebrateBig()
            // switch animal every 10
            if (feedCount % 10 === 0) {
              currentAnimal = ANIMALS[Math.floor(feedCount / 10) % ANIMALS.length]
            }
          }
        }
      }
    })

    foods = foods.filter(f => !f.scored && f.y < h + 100)
    if (foods.length === 0) spawnFoods()

    // particles
    particles.forEach(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 80 * dt
      p.life -= dt * 2
    })
    particles = particles.filter(p => p.life > 0)

    // hearts
    hearts.forEach(h2 => {
      h2.x += h2.vx * dt
      h2.y += h2.vy * dt
      h2.vy += 20 * dt
      h2.life -= dt
    })
    hearts = hearts.filter(h2 => h2.life > 0)

    // crumbs
    crumbs.forEach(c => {
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.vy += 200 * dt
      c.life -= dt * 1.5
    })
    crumbs = crumbs.filter(c => c.life > 0)

    // score popups
    scorePopups.forEach(p => { p.y -= 50 * dt; p.life -= dt })
    scorePopups = scorePopups.filter(p => p.life > 0)

    // clouds
    clouds.forEach(c => {
      c.x += c.speed * dt
      if (c.x > w + 80) c.x = -80
    })

    // butterflies
    butterflies.forEach(b => {
      b.wingPhase += dt * 10
      b.x += b.vx * dt + Math.sin(time + b.wingPhase) * 10 * dt
      b.y += b.vy * dt + Math.cos(time * 0.8 + b.wingPhase) * 8 * dt
      b.vx += (Math.random() - 0.5) * 40 * dt
      b.vy += (Math.random() - 0.5) * 30 * dt
      b.vx *= 0.98; b.vy *= 0.98
      if (b.x < 10) b.vx += 15 * dt
      if (b.x > w - 10) b.vx -= 15 * dt
      if (b.y < 20) b.vy += 15 * dt
      if (b.y > h * 0.5) b.vy -= 20 * dt
    })
  },

  render() {
    ctx.save()
    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake)
    }

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6)
    sky.addColorStop(0, "#56b8e8")
    sky.addColorStop(0.5, "#7ec8f0")
    sky.addColorStop(1, "#b8eafc")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // sun
    const sunX = w * 0.82
    const sunY = h * 0.08
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 70)
    sunGlow.addColorStop(0, "rgba(255,240,150,0.8)")
    sunGlow.addColorStop(0.5, "rgba(255,220,100,0.2)")
    sunGlow.addColorStop(1, "rgba(255,200,50,0)")
    ctx.fillStyle = sunGlow
    ctx.fillRect(sunX - 70, sunY - 70, 140, 140)
    ctx.beginPath()
    ctx.arc(sunX, sunY, 20, 0, Math.PI * 2)
    ctx.fillStyle = "#ffe066"
    ctx.fill()

    // clouds
    clouds.forEach(c => {
      ctx.globalAlpha = 0.5
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
      ctx.arc(c.x + c.r * 0.8, c.y - c.r * 0.2, c.r * 0.7, 0, Math.PI * 2)
      ctx.arc(c.x - c.r * 0.6, c.y + c.r * 0.1, c.r * 0.6, 0, Math.PI * 2)
      ctx.arc(c.x + c.r * 0.3, c.y - c.r * 0.3, c.r * 0.45, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // distant hills
    ctx.fillStyle = "#8dd48d"
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(0, h * 0.52)
    for (let x = 0; x <= w; x += 30) {
      ctx.lineTo(x, h * 0.52 - Math.sin(x * 0.006 + 1) * 30 - Math.sin(x * 0.015) * 12)
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h)
    ctx.fill()
    ctx.globalAlpha = 1

    // grass
    const grassY = h * 0.55
    const grassGrad = ctx.createLinearGradient(0, grassY, 0, h)
    grassGrad.addColorStop(0, "#5cb85c")
    grassGrad.addColorStop(0.5, "#4cae4c")
    grassGrad.addColorStop(1, "#3a8a3a")
    ctx.fillStyle = grassGrad
    ctx.fillRect(0, grassY, w, h * 0.45)

    // grass edge
    ctx.fillStyle = "#4cae4c"
    ctx.beginPath()
    ctx.moveTo(0, grassY)
    for (let x = 0; x <= w; x += 10) {
      ctx.lineTo(x, grassY + Math.sin(x * 0.1) * 2.5)
    }
    ctx.lineTo(w, grassY + 5); ctx.lineTo(0, grassY + 5)
    ctx.fill()

    // grass blades
    const wind = Math.sin(windPhase) * 3
    grassBlades.forEach(g => {
      const sway = Math.sin(time * 1.5 + g.phase) * 2.5 + wind
      ctx.strokeStyle = g.shade > 0.5 ? "#4aaa4a" : "#3a9a3a"
      ctx.lineWidth = 1.2
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(g.x, grassY)
      ctx.quadraticCurveTo(g.x + sway * 0.5, grassY - g.height * 0.6, g.x + sway, grassY - g.height)
      ctx.stroke()
    })

    // bg flowers
    bgFlowers.forEach(f => {
      const fy = grassY - 2
      const sway = Math.sin(time * 1.2 + f.x * 0.1) * 0.08
      ctx.save()
      ctx.translate(f.x, fy)
      ctx.rotate(sway)
      ctx.strokeStyle = "#3a9a3a"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -f.size * 3)
      ctx.stroke()
      for (let i = 0; i < f.petals; i++) {
        const a = (i / f.petals) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(Math.cos(a) * f.size * 0.5, -f.size * 3 + Math.sin(a) * f.size * 0.5, f.size * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = f.color
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(0, -f.size * 3, f.size * 0.25, 0, Math.PI * 2)
      ctx.fillStyle = "#feca57"
      ctx.fill()
      ctx.restore()
    })

    // butterflies
    butterflies.forEach(b => drawButterfly(ctx, b))

    // picnic blanket behind animal
    ctx.save()
    ctx.translate(animal.x, animal.y + 50)
    ctx.beginPath()
    ctx.ellipse(0, 0, 130, 30, 0, 0, Math.PI * 2)
    ctx.fillStyle = "#e74c3c"
    ctx.globalAlpha = 0.3
    ctx.fill()
    ctx.globalAlpha = 1
    // checkerboard pattern
    ctx.beginPath()
    ctx.ellipse(0, 0, 130, 30, 0, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = "rgba(255,255,255,0.15)"
    for (let px = -140; px < 140; px += 25) {
      for (let py = -35; py < 35; py += 25) {
        if ((Math.floor(px / 25) + Math.floor(py / 25)) % 2 === 0) {
          ctx.fillRect(px, py, 25, 25)
        }
      }
    }
    ctx.restore()

    // crumbs
    crumbs.forEach(c => {
      ctx.globalAlpha = c.life
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2)
      ctx.fillStyle = c.color
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // animal shadow
    ctx.beginPath()
    ctx.ellipse(animal.x, animal.y + 70 + animal.bounceY * 0.3, ANIMAL_SIZE * 0.8, 12, 0, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.08)"
    ctx.fill()

    // animal
    drawAnimal(ctx, animal, currentAnimal)

    // hearts floating
    hearts.forEach(h2 => {
      ctx.globalAlpha = Math.min(1, h2.life)
      ctx.save()
      ctx.translate(h2.x, h2.y)
      ctx.rotate(h2.rot)
      drawSmallHeart(ctx, 0, 0, h2.size, "#ff6b6b")
      ctx.restore()
    })
    ctx.globalAlpha = 1

    // food shadows
    foods.forEach(f => {
      if (f.scored) return
      const shadowScale = f.dropping ? 0.6 : 0.8
      ctx.beginPath()
      ctx.ellipse(f.x, f.dropping ? animal.y + 75 : f.y + FOOD_SIZE * 0.45, FOOD_SIZE * 0.3 * shadowScale, 4, 0, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(0,0,0,0.08)"
      ctx.fill()
    })

    // foods
    foods.forEach(f => {
      if (f.scored) return
      ctx.save()
      ctx.translate(f.x, f.y)

      // bob in tray
      if (!f.dropping) {
        ctx.translate(0, Math.sin(f.bobPhase) * 4)
        ctx.rotate(Math.sin(f.bobPhase * 0.7 + f.wobble) * 0.05)
      } else {
        ctx.rotate(f.spin)
      }

      // glow highlight when idle
      if (!f.dropping) {
        ctx.beginPath()
        ctx.arc(0, 0, FOOD_SIZE * 0.55, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(255,255,255,0.15)"
        ctx.fill()
      }

      f.draw(ctx, FOOD_SIZE)
      ctx.restore()
    })

    // particles
    particles.forEach(p => {
      ctx.globalAlpha = p.life
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // score popups
    scorePopups.forEach(p => {
      const alpha = Math.min(1, p.life * 2)
      const s = p.scale * (1 + (1.3 - p.life) * 0.15)
      ctx.globalAlpha = alpha
      ctx.font = `bold ${Math.round(22 * s)}px sans-serif`
      ctx.textAlign = "center"
      ctx.strokeStyle = "rgba(0,0,0,0.2)"
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
      ctx.fillStyle = "rgba(0,0,0,0.15)"
      ctx.beginPath()
      ctx.roundRect(bx, by, barW, barH, 4)
      ctx.fill()
      const fill = comboTimer / 3
      const cc = combo >= 4 ? "#ff6b6b" : combo >= 2 ? "#feca57" : "#54a0ff"
      ctx.fillStyle = cc
      ctx.beginPath()
      ctx.roundRect(bx, by, barW * fill, barH, 4)
      ctx.fill()
      ctx.font = "bold 13px sans-serif"
      ctx.fillStyle = cc
      ctx.textAlign = "center"
      ctx.fillText(`YUM x${combo}`, w / 2, by - 3)
    }

    // score
    ctx.fillStyle = "rgba(0,0,0,0.1)"
    ctx.font = "bold 34px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2 + 1, 17)
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    ctx.fillText(score, w / 2, 16)

    if (score === 0) {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.7)"
      ctx.fillText("Tap food to feed the animal!", w / 2, 54)
    }

    ctx.restore()
  }
}

function spawnFoods() {
  const count = 4 + Math.min(2, Math.floor(score / 10))
  const spacing = w / (count + 1)
  for (let i = 0; i < count; i++) {
    const item = FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)]
    const fx = spacing * (i + 1) + (Math.random() - 0.5) * 20
    const fy = 100 + Math.random() * 60
    foods.push({
      x: fx, y: fy,
      startX: fx, startY: fy,
      targetX: w / 2, targetY: h - 150,
      dropDuration: 0.55 + Math.random() * 0.2,
      draw: item.draw,
      color: item.color,
      dropping: false,
      dropTime: 0,
      scored: false,
      bobPhase: Math.random() * Math.PI * 2,
      wobble: 0,
      spin: 0
    })
  }
}

function handleTap(x, y) {
  foods.forEach(f => {
    if (f.dropping || f.scored) return
    const dx = f.x - x
    const dy = f.y - y
    if (Math.sqrt(dx * dx + dy * dy) < FOOD_SIZE) {
      f.dropping = true
      f.dropTime = 0
      f.startX = f.x
      f.startY = f.y
      f.targetX = animal.x
      f.targetY = animal.y + animal.bounceY
      f.spin = 0
    }
  })
}

function drawAnimal(ctx, a, type) {
  ctx.save()
  ctx.translate(a.x, a.y + a.bounceY)
  const s = ANIMAL_SIZE
  const happyScale = 1 + a.happiness * 0.04

  ctx.scale(happyScale, happyScale)

  const earWig = Math.sin(time * 8) * a.earWiggle * 0.2
  const chewBob = Math.sin(time * 12) * a.chewing * 3

  // ears
  if (type.longEars) {
    // bunny ears
    ctx.save()
    ctx.translate(-35, -s + 10)
    ctx.rotate(-0.15 + earWig)
    ctx.beginPath()
    ctx.ellipse(0, -30, 16, 40, -0.1, 0, Math.PI * 2)
    ctx.fillStyle = type.bodyColor
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0, -28, 9, 30, -0.1, 0, Math.PI * 2)
    ctx.fillStyle = type.earColor
    ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.translate(35, -s + 10)
    ctx.rotate(0.15 - earWig)
    ctx.beginPath()
    ctx.ellipse(0, -30, 16, 40, 0.1, 0, Math.PI * 2)
    ctx.fillStyle = type.bodyColor
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0, -28, 9, 30, 0.1, 0, Math.PI * 2)
    ctx.fillStyle = type.earColor
    ctx.fill()
    ctx.restore()
  } else {
    // round ears
    ctx.save()
    ctx.translate(-60, -70)
    ctx.rotate(earWig)
    ctx.beginPath()
    ctx.arc(0, 0, 30, 0, Math.PI * 2)
    ctx.fillStyle = type.patches ? "#333" : type.bodyColor
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 0, 16, 0, Math.PI * 2)
    ctx.fillStyle = type.earColor
    ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.translate(60, -70)
    ctx.rotate(-earWig)
    ctx.beginPath()
    ctx.arc(0, 0, 30, 0, Math.PI * 2)
    ctx.fillStyle = type.patches ? "#333" : type.bodyColor
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 0, 16, 0, Math.PI * 2)
    ctx.fillStyle = type.earColor
    ctx.fill()
    ctx.restore()
  }

  // body
  const bodyW = type.wide ? s * 1.15 : s
  ctx.beginPath()
  ctx.ellipse(0, 0, bodyW, s, 0, 0, Math.PI * 2)
  ctx.fillStyle = type.bodyColor
  ctx.fill()

  // belly
  ctx.beginPath()
  ctx.ellipse(0, s * 0.15, bodyW * 0.6, s * 0.55, 0, 0, Math.PI * 2)
  ctx.fillStyle = type.patches ? "#f8f8f8" : lighten(type.bodyColor, 25)
  ctx.fill()

  // panda patches
  if (type.patches) {
    ctx.beginPath()
    ctx.ellipse(-35, -15, 25, 30, -0.2, 0, Math.PI * 2)
    ctx.fillStyle = "#333"
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(35, -15, 25, 30, 0.2, 0, Math.PI * 2)
    ctx.fillStyle = "#333"
    ctx.fill()
  }

  // eyes
  const eyeOpen = 1 - a.blinkAmount
  const eyeH = 12 * eyeOpen

  ctx.beginPath()
  ctx.ellipse(-30, -20 + chewBob, 13, eyeH, 0, 0, Math.PI * 2)
  ctx.fillStyle = type.patches ? "#fff" : "#222"
  ctx.fill()
  if (type.patches && eyeOpen > 0.3) {
    ctx.beginPath()
    ctx.arc(-30, -20 + chewBob, 7, 0, Math.PI * 2)
    ctx.fillStyle = "#222"
    ctx.fill()
  }

  ctx.beginPath()
  ctx.ellipse(30, -20 + chewBob, 13, eyeH, 0, 0, Math.PI * 2)
  ctx.fillStyle = type.patches ? "#fff" : "#222"
  ctx.fill()
  if (type.patches && eyeOpen > 0.3) {
    ctx.beginPath()
    ctx.arc(30, -20 + chewBob, 7, 0, Math.PI * 2)
    ctx.fillStyle = "#222"
    ctx.fill()
  }

  // eye shine
  if (eyeOpen > 0.3) {
    ctx.beginPath()
    ctx.arc(-26, -24 + chewBob, 5, 0, Math.PI * 2)
    ctx.arc(34, -24 + chewBob, 5, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()

    // sparkle on feed
    if (a.eyeSparkle > 0.2) {
      ctx.globalAlpha = a.eyeSparkle
      drawSparkle(ctx, -26, -24 + chewBob, 7)
      drawSparkle(ctx, 34, -24 + chewBob, 7)
      ctx.globalAlpha = 1
    }
  }

  // whiskers (cat)
  if (type.whiskers) {
    ctx.strokeStyle = "rgba(0,0,0,0.2)"
    ctx.lineWidth = 1.5
    ctx.lineCap = "round"
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.moveTo(side * 25, 8 + i * 8)
        ctx.lineTo(side * 65, 5 + i * 12)
        ctx.stroke()
      }
    }
  }

  // nose
  ctx.beginPath()
  if (type.wide) {
    ctx.ellipse(0, 5 + chewBob, 10, 6, 0, 0, Math.PI * 2)
  } else {
    ctx.ellipse(0, 8 + chewBob, 8, 6, 0, 0, Math.PI * 2)
  }
  ctx.fillStyle = type.noseColor
  ctx.fill()

  // mouth
  const mouthY = 25 + chewBob
  const mouthSize = 20 + a.mouthOpen * 28
  if (a.mouthOpen > 0.3) {
    ctx.beginPath()
    ctx.arc(0, mouthY, mouthSize, 0.05 * Math.PI, 0.95 * Math.PI)
    ctx.fillStyle = "#c0392b"
    ctx.fill()
    // tongue
    ctx.beginPath()
    ctx.ellipse(0, mouthY + mouthSize * 0.4, mouthSize * 0.4, mouthSize * 0.25, 0, 0, Math.PI)
    ctx.fillStyle = "#ff7a8a"
    ctx.fill()
    // teeth
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.ellipse(-8, mouthY - mouthSize * 0.15, 5, 4, 0, 0, Math.PI * 2)
    ctx.ellipse(8, mouthY - mouthSize * 0.15, 5, 4, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (a.chewing > 0) {
    // chewing face
    const chewOffset = Math.sin(time * 12) * 4
    ctx.beginPath()
    ctx.ellipse(chewOffset, mouthY - 5, 12, 8, 0, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.15)"
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(0, mouthY - 8, 25, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.strokeStyle = "rgba(0,0,0,0.2)"
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.stroke()
  }

  // cheeks
  ctx.beginPath()
  ctx.arc(-50, 10, 15, 0, Math.PI * 2)
  ctx.fillStyle = type.cheekColor
  ctx.fill()
  ctx.beginPath()
  ctx.arc(50, 10, 15, 0, Math.PI * 2)
  ctx.fillStyle = type.cheekColor
  ctx.fill()

  // arms reaching for food (when food is dropping)
  const anyDropping = foods.some(f => f.dropping && !f.scored)
  if (anyDropping) {
    ctx.strokeStyle = type.bodyColor
    ctx.lineWidth = 14
    ctx.lineCap = "round"
    // left arm
    ctx.beginPath()
    ctx.moveTo(-bodyW * 0.7, 10)
    ctx.quadraticCurveTo(-bodyW * 0.9, -40, -bodyW * 0.6, -60)
    ctx.stroke()
    // right arm
    ctx.beginPath()
    ctx.moveTo(bodyW * 0.7, 10)
    ctx.quadraticCurveTo(bodyW * 0.9, -40, bodyW * 0.6, -60)
    ctx.stroke()
  }

  ctx.restore()
}

function drawButterfly(ctx, b) {
  ctx.save()
  ctx.translate(b.x, b.y)
  const wingFlap = Math.sin(b.wingPhase) * 0.5
  ctx.save()
  ctx.scale(1, Math.cos(wingFlap))
  ctx.beginPath()
  ctx.ellipse(-b.size * 0.5, 0, b.size * 0.7, b.size, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = b.color
  ctx.globalAlpha = 0.5
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
  ctx.save()
  ctx.scale(1, Math.cos(wingFlap + 0.4))
  ctx.beginPath()
  ctx.ellipse(b.size * 0.5, 0, b.size * 0.7, b.size, 0.2, 0, Math.PI * 2)
  ctx.fillStyle = b.color
  ctx.globalAlpha = 0.5
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
  ctx.fillStyle = "#333"
  ctx.beginPath()
  ctx.ellipse(0, 0, 1.5, b.size * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSmallHeart(ctx, x, y, size, color) {
  const s = size
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y - s * 0.1, x - s * 0.6, y - s * 0.5, x - s * 0.6, y - s * 0.1)
  ctx.bezierCurveTo(x - s * 0.6, y + s * 0.2, x, y + s * 0.5, x, y + s * 0.7)
  ctx.bezierCurveTo(x, y + s * 0.5, x + s * 0.6, y + s * 0.2, x + s * 0.6, y - s * 0.1)
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.5, x, y - s * 0.1, x, y + s * 0.3)
  ctx.fill()
}

function drawSparkle(ctx, x, y, size) {
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.quadraticCurveTo(x + size * 0.15, y - size * 0.15, x + size, y)
  ctx.quadraticCurveTo(x + size * 0.15, y + size * 0.15, x, y + size)
  ctx.quadraticCurveTo(x - size * 0.15, y + size * 0.15, x - size, y)
  ctx.quadraticCurveTo(x - size * 0.15, y - size * 0.15, x, y - size)
  ctx.fill()
}

function lighten(hex, amt) {
  const num = parseInt(hex.slice(1), 16)
  const r = Math.min(255, (num >> 16) + amt)
  const g = Math.min(255, ((num >> 8) & 0xff) + amt)
  const b = Math.min(255, (num & 0xff) + amt)
  return `rgb(${r},${g},${b})`
}

// --- Food drawing functions ---

function drawApple(ctx, size) {
  const r = size / 2
  ctx.beginPath()
  ctx.arc(-2, 4, r - 4, 0, Math.PI * 2)
  const ag = ctx.createRadialGradient(-r * 0.3, -2, r * 0.1, 0, 4, r)
  ag.addColorStop(0, "#ff8080")
  ag.addColorStop(1, "#d63031")
  ctx.fillStyle = ag
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-10, -4, r / 4, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, -r + 6)
  ctx.quadraticCurveTo(2, -r - 2, 3, -r - 6)
  ctx.strokeStyle = "#6b4226"
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(7, -r + 1, 9, 5, 0.4, 0, Math.PI * 2)
  ctx.fillStyle = "#26de81"
  ctx.fill()
}

function drawBanana(ctx, size) {
  const r = size / 2
  ctx.beginPath()
  ctx.arc(0, 8, r - 2, 1.1 * Math.PI, 1.9 * Math.PI)
  ctx.lineWidth = size / 2.5
  ctx.strokeStyle = "#f0c830"
  ctx.lineCap = "round"
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 8, r - 2, 1.1 * Math.PI, 1.9 * Math.PI)
  ctx.lineWidth = size / 2.5 - 5
  ctx.strokeStyle = "#fde68a"
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(r - 6, 0, 4, 0, Math.PI * 2)
  ctx.fillStyle = "#6b4226"
  ctx.fill()
}

function drawCarrot(ctx, size) {
  const r = size / 2
  ctx.beginPath()
  ctx.moveTo(-r / 2, -r / 3)
  ctx.lineTo(r / 2, -r / 3)
  ctx.lineTo(0, r)
  ctx.closePath()
  const cg = ctx.createLinearGradient(0, -r / 3, 0, r)
  cg.addColorStop(0, "#ff9f43")
  cg.addColorStop(1, "#e67e22")
  ctx.fillStyle = cg
  ctx.fill()
  ctx.strokeStyle = "rgba(0,0,0,0.08)"
  ctx.lineWidth = 2
  for (let i = 1; i <= 3; i++) {
    const t = i / 4
    const lw = (r / 2) * (1 - t) * 1.5
    const ly = -r / 3 + (r + r / 3) * t
    ctx.beginPath()
    ctx.moveTo(-lw, ly)
    ctx.lineTo(lw, ly)
    ctx.stroke()
  }
  ctx.fillStyle = "#26de81"
  ctx.beginPath()
  ctx.ellipse(-7, -r / 2, 5, 11, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(7, -r / 2, 5, 11, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#34d88a"
  ctx.beginPath()
  ctx.ellipse(0, -r / 2 - 4, 4, 12, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawGrape(ctx, size) {
  const r = size / 6
  const positions = [
    [0, -r * 2], [-r, -r], [r, -r],
    [-r * 1.5, r * 0.2], [0, r * 0.2], [r * 1.5, r * 0.2],
    [-r, r * 1.4], [r, r * 1.4], [0, r * 2.5]
  ]
  positions.forEach(([gx, gy], i) => {
    ctx.beginPath()
    ctx.arc(gx, gy + 2, r, 0, Math.PI * 2)
    const gg = ctx.createRadialGradient(gx - 2, gy, r * 0.2, gx, gy + 2, r)
    gg.addColorStop(0, "#c480f0")
    gg.addColorStop(1, i % 2 === 0 ? "#a55eea" : "#8854d0")
    ctx.fillStyle = gg
    ctx.fill()
    ctx.beginPath()
    ctx.arc(gx - 2, gy - 1, r * 0.3, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.2)"
    ctx.fill()
  })
  ctx.beginPath()
  ctx.moveTo(0, -r * 2.5)
  ctx.quadraticCurveTo(2, -r * 3.5, 0, -r * 4)
  ctx.strokeStyle = "#6b4226"
  ctx.lineWidth = 2
  ctx.lineCap = "round"
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(4, -r * 3, 5, 3, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#26de81"
  ctx.fill()
}

function drawWatermelon(ctx, size) {
  const r = size / 2
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI)
  ctx.fillStyle = "#26de81"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 0, r - 4, 0, Math.PI)
  ctx.fillStyle = "#1abc60"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 0, r - 7, 0, Math.PI)
  const wg = ctx.createRadialGradient(0, 5, r * 0.1, 0, 0, r)
  wg.addColorStop(0, "#ff8080")
  wg.addColorStop(1, "#e74c3c")
  ctx.fillStyle = wg
  ctx.fill()
  ctx.fillStyle = "#222"
  const seeds = [[-12, 8], [8, 10], [0, 18], [-18, 18], [16, 16], [-6, 24]]
  seeds.forEach(([sx, sy]) => {
    ctx.beginPath()
    ctx.ellipse(sx, sy, 2, 4, Math.sin(sx) * 0.3, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawStrawberry(ctx, size) {
  const r = size / 2
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.3)
  ctx.bezierCurveTo(-r * 0.8, -r * 0.1, -r * 0.6, r * 0.8, 0, r)
  ctx.bezierCurveTo(r * 0.6, r * 0.8, r * 0.8, -r * 0.1, 0, -r * 0.3)
  const sg = ctx.createRadialGradient(-r * 0.2, 0, r * 0.1, 0, r * 0.3, r)
  sg.addColorStop(0, "#ff6b6b")
  sg.addColorStop(1, "#c0392b")
  ctx.fillStyle = sg
  ctx.fill()
  // seeds
  ctx.fillStyle = "#feca57"
  const seedPos = [[-6, 5], [6, 8], [0, 15], [-8, 18], [8, 20], [-3, 25], [5, 0]]
  seedPos.forEach(([sx, sy]) => {
    ctx.beginPath()
    ctx.ellipse(sx, sy, 1.5, 2, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  // leaves
  ctx.fillStyle = "#26de81"
  for (let i = 0; i < 5; i++) {
    const la = (i / 5) * Math.PI * 2 - Math.PI / 2
    ctx.beginPath()
    ctx.ellipse(Math.cos(la) * 6, -r * 0.3 + Math.sin(la) * 4, 6, 3, la, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawOrange(ctx, size) {
  const r = size / 2
  ctx.beginPath()
  ctx.arc(0, 2, r - 3, 0, Math.PI * 2)
  const og = ctx.createRadialGradient(-r * 0.2, -2, r * 0.1, 0, 2, r)
  og.addColorStop(0, "#ffb347")
  og.addColorStop(1, "#e67e22")
  ctx.fillStyle = og
  ctx.fill()
  // texture dots
  ctx.globalAlpha = 0.06
  for (let i = 0; i < 12; i++) {
    const dx = (Math.random() - 0.5) * r * 1.4
    const dy = (Math.random() - 0.5) * r * 1.4 + 2
    ctx.beginPath()
    ctx.arc(dx, dy, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // shine
  ctx.beginPath()
  ctx.arc(-8, -5, r / 4, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.3)"
  ctx.fill()
  // leaf
  ctx.beginPath()
  ctx.ellipse(3, -r + 3, 7, 4, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#26de81"
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, -r + 5)
  ctx.lineTo(1, -r - 2)
  ctx.strokeStyle = "#6b4226"
  ctx.lineWidth = 2
  ctx.lineCap = "round"
  ctx.stroke()
}

function drawCherry(ctx, size) {
  const r = size / 3.5
  // stems
  ctx.strokeStyle = "#6b4226"
  ctx.lineWidth = 2.5
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(-r * 0.8, r * 0.3)
  ctx.quadraticCurveTo(-2, -r * 2, 0, -r * 2.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(r * 0.8, r * 0.3)
  ctx.quadraticCurveTo(2, -r * 2, 0, -r * 2.5)
  ctx.stroke()
  // leaf
  ctx.beginPath()
  ctx.ellipse(5, -r * 2.2, 7, 4, 0.4, 0, Math.PI * 2)
  ctx.fillStyle = "#26de81"
  ctx.fill()
  // cherries
  for (const sx of [-r * 0.8, r * 0.8]) {
    ctx.beginPath()
    ctx.arc(sx, r * 0.5, r, 0, Math.PI * 2)
    const cg = ctx.createRadialGradient(sx - 3, r * 0.3, r * 0.1, sx, r * 0.5, r)
    cg.addColorStop(0, "#ff6b6b")
    cg.addColorStop(1, "#a93226")
    ctx.fillStyle = cg
    ctx.fill()
    // shine
    ctx.beginPath()
    ctx.arc(sx - 3, r * 0.2, r * 0.25, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.35)"
    ctx.fill()
  }
}
