import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let animal, foods, score, feedCount

const FOOD_ITEMS = [
  { id: "apple", draw: drawApple },
  { id: "banana", draw: drawBanana },
  { id: "carrot", draw: drawCarrot },
  { id: "grape", draw: drawGrape },
  { id: "watermelon", draw: drawWatermelon }
]

const ANIMAL_SIZE = 100
const FOOD_SIZE = 60

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    score = 0
    feedCount = 0
    foods = []

    animal = {
      x: w / 2,
      y: h - 140,
      mouthOpen: 0
    }

    spawnFoods()

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    foods = []
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight
    animal.x = w / 2
    animal.y = h - 140

    if (animal.mouthOpen > 0)
      animal.mouthOpen = Math.max(0, animal.mouthOpen - dt * 3)

    foods.forEach(f => {
      if (f.dropping) {
        f.dropTime += dt
        const t = f.dropTime / f.dropDuration
        if (t <= 1) {
          f.x = f.startX + (f.targetX - f.startX) * t
          f.y = f.startY + (f.targetY - f.startY) * t - 150 * Math.sin(t * Math.PI)
        } else {
          f.x = f.targetX
          f.y = f.targetY
        }
      }
    })

    foods.forEach(f => {
      if (f.dropping && !f.scored) {
        const dx = f.x - animal.x
        const dy = f.y - animal.y
        if (Math.sqrt(dx * dx + dy * dy) < ANIMAL_SIZE) {
          f.scored = true
          score++
          feedCount++
          animal.mouthOpen = 1
          celebrate()

          if (feedCount % 5 === 0) celebrateBig()
        }
      }
    })

    foods = foods.filter(f => !f.scored && f.y < h + 100)

    if (foods.length === 0) spawnFoods()
  },

  render() {
    // soft meadow background
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6)
    sky.addColorStop(0, "#87CEEB")
    sky.addColorStop(1, "#b8e4f0")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h * 0.6)

    const grass = ctx.createLinearGradient(0, h * 0.55, 0, h)
    grass.addColorStop(0, "#7ec87e")
    grass.addColorStop(1, "#5a9e5a")
    ctx.fillStyle = grass
    ctx.fillRect(0, h * 0.55, w, h * 0.45)

    // draw animal (simple happy face)
    const ax = animal.x
    const ay = animal.y
    const s = ANIMAL_SIZE

    // body
    ctx.beginPath()
    ctx.arc(ax, ay, s, 0, Math.PI * 2)
    ctx.fillStyle = "#f8b500"
    ctx.fill()

    // ears
    ctx.beginPath()
    ctx.arc(ax - 60, ay - 70, 30, 0, Math.PI * 2)
    ctx.arc(ax + 60, ay - 70, 30, 0, Math.PI * 2)
    ctx.fillStyle = "#f8b500"
    ctx.fill()

    // inner ears
    ctx.beginPath()
    ctx.arc(ax - 60, ay - 70, 16, 0, Math.PI * 2)
    ctx.arc(ax + 60, ay - 70, 16, 0, Math.PI * 2)
    ctx.fillStyle = "#ffcc80"
    ctx.fill()

    // eyes
    ctx.beginPath()
    ctx.arc(ax - 30, ay - 20, 12, 0, Math.PI * 2)
    ctx.arc(ax + 30, ay - 20, 12, 0, Math.PI * 2)
    ctx.fillStyle = "#222"
    ctx.fill()

    // eye shine
    ctx.beginPath()
    ctx.arc(ax - 26, ay - 24, 5, 0, Math.PI * 2)
    ctx.arc(ax + 34, ay - 24, 5, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()

    // mouth
    const mouthSize = 20 + animal.mouthOpen * 25
    ctx.beginPath()
    if (animal.mouthOpen > 0.3) {
      ctx.arc(ax, ay + 25, mouthSize, 0, Math.PI)
      ctx.fillStyle = "#c0392b"
      ctx.fill()
    } else {
      ctx.arc(ax, ay + 20, 25, 0.1 * Math.PI, 0.9 * Math.PI)
      ctx.strokeStyle = "#222"
      ctx.lineWidth = 3
      ctx.stroke()
    }

    // draw foods
    foods.forEach(f => {
      if (f.scored) return
      ctx.save()
      ctx.translate(f.x, f.y)
      f.draw(ctx, FOOD_SIZE)
      ctx.restore()
    })

    // score
    ctx.fillStyle = "#fff"
    ctx.font = "bold 32px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2, 16)

    // instruction
    if (score === 0) {
      ctx.font = "20px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.6)"
      ctx.fillText("Tap food to drop it!", w / 2, 56)
    }
  }
}

function spawnFoods() {
  const count = 4
  const spacing = w / (count + 1)
  for (let i = 0; i < count; i++) {
    const item = FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)]
    const fx = spacing * (i + 1)
    const fy = 120 + Math.random() * 60
    foods.push({
      x: fx,
      y: fy,
      startX: fx,
      startY: fy,
      targetX: w / 2,
      targetY: h - 140,
      dropDuration: 0.6 + Math.random() * 0.2,
      draw: item.draw,
      dropping: false,
      dropTime: 0,
      scored: false
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
      f.targetY = animal.y
    }
  })
}

// --- Food drawing functions ---
// Each draws centered at (0,0), size = diameter

function drawApple(ctx, size) {
  const r = size / 2
  // body
  ctx.beginPath()
  ctx.arc(0, 4, r - 4, 0, Math.PI * 2)
  ctx.fillStyle = "#ff6b6b"
  ctx.fill()
  // highlight
  ctx.beginPath()
  ctx.arc(-8, -4, r / 4, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.fill()
  // stem
  ctx.beginPath()
  ctx.moveTo(0, -r + 6)
  ctx.lineTo(2, -r - 4)
  ctx.strokeStyle = "#6b4226"
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  ctx.stroke()
  // leaf
  ctx.beginPath()
  ctx.ellipse(6, -r + 2, 8, 5, 0.4, 0, Math.PI * 2)
  ctx.fillStyle = "#26de81"
  ctx.fill()
}

function drawBanana(ctx, size) {
  const r = size / 2
  ctx.beginPath()
  ctx.arc(0, 8, r - 2, 1.1 * Math.PI, 1.9 * Math.PI)
  ctx.lineWidth = size / 2.5
  ctx.strokeStyle = "#feca57"
  ctx.lineCap = "round"
  ctx.stroke()
  // darker edge
  ctx.beginPath()
  ctx.arc(0, 8, r - 2, 1.1 * Math.PI, 1.9 * Math.PI)
  ctx.lineWidth = size / 2.5 - 4
  ctx.strokeStyle = "#f6e58d"
  ctx.stroke()
  // tip
  ctx.beginPath()
  ctx.arc(r - 6, 0, 4, 0, Math.PI * 2)
  ctx.fillStyle = "#6b4226"
  ctx.fill()
}

function drawCarrot(ctx, size) {
  const r = size / 2
  // body (triangle)
  ctx.beginPath()
  ctx.moveTo(-r / 2, -r / 3)
  ctx.lineTo(r / 2, -r / 3)
  ctx.lineTo(0, r)
  ctx.closePath()
  ctx.fillStyle = "#ff9f43"
  ctx.fill()
  // stripes
  ctx.strokeStyle = "rgba(0,0,0,0.1)"
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
  // leaves
  ctx.fillStyle = "#26de81"
  ctx.beginPath()
  ctx.ellipse(-6, -r / 2, 5, 10, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(6, -r / 2, 5, 10, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(0, -r / 2 - 4, 4, 10, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawGrape(ctx, size) {
  const r = size / 6
  const color1 = "#a55eea"
  const color2 = "#8854d0"
  // cluster of small circles
  const positions = [
    [0, -r * 2], [-r, -r], [r, -r],
    [-r * 1.5, r * 0.2], [0, r * 0.2], [r * 1.5, r * 0.2],
    [-r, r * 1.4], [r, r * 1.4], [0, r * 2.5]
  ]
  positions.forEach(([gx, gy], i) => {
    ctx.beginPath()
    ctx.arc(gx, gy + 2, r, 0, Math.PI * 2)
    ctx.fillStyle = i % 2 === 0 ? color1 : color2
    ctx.fill()
  })
  // stem
  ctx.beginPath()
  ctx.moveTo(0, -r * 2.5)
  ctx.lineTo(0, -r * 3.5)
  ctx.strokeStyle = "#6b4226"
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawWatermelon(ctx, size) {
  const r = size / 2
  // slice (half circle)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI)
  ctx.fillStyle = "#26de81"
  ctx.fill()
  // rind
  ctx.beginPath()
  ctx.arc(0, 0, r - 6, 0, Math.PI)
  ctx.fillStyle = "#ff6b6b"
  ctx.fill()
  // seeds
  ctx.fillStyle = "#222"
  const seeds = [[-10, 8], [8, 10], [0, 16], [-16, 16], [14, 16]]
  seeds.forEach(([sx, sy]) => {
    ctx.beginPath()
    ctx.ellipse(sx, sy, 2, 3.5, 0, 0, Math.PI * 2)
    ctx.fill()
  })
}
