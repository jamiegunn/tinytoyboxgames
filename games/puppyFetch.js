import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let puppy, ball, score, time
let state // WAITING, THROWN, CHASING, RETURNING, CELEBRATING
let celebrateTimer

const GROUND_Y_RATIO = 0.82
const PUPPY_HOME_X_RATIO = 0.5

export default {

  start(engine) {
    ctx = engine.ctx
    input = engine.input
    w = window.innerWidth
    h = window.innerHeight
    score = 0
    time = 0
    celebrateTimer = 0

    const groundY = h * GROUND_Y_RATIO

    puppy = {
      x: w * PUPPY_HOME_X_RATIO,
      y: groundY,
      homeX: w * PUPPY_HOME_X_RATIO,
      homeY: groundY,
      dir: 1, // 1 = facing right, -1 = facing left
      tailPhase: 0,
      legPhase: 0,
      tongueOut: true,
      hasBall: false,
      earBounce: 0,
      size: 40
    }

    ball = {
      x: puppy.x,
      y: groundY,
      vx: 0,
      vy: 0,
      radius: 14,
      airborne: false,
      visible: true,
      // arc animation
      startX: 0, startY: 0,
      endX: 0, endY: 0,
      t: 0, duration: 0,
      bounces: 0
    }

    state = "WAITING"

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight
    time += dt
    const groundY = h * GROUND_Y_RATIO

    puppy.homeX = w * PUPPY_HOME_X_RATIO
    puppy.homeY = groundY
    puppy.tailPhase += dt * (state === "WAITING" ? 6 : 10)
    puppy.earBounce = Math.max(0, puppy.earBounce - dt * 4)

    if (state === "WAITING") {
      puppy.tongueOut = true
      puppy.legPhase = 0

    } else if (state === "THROWN") {
      // ball flying through the air
      ball.t += dt
      const p = Math.min(ball.t / ball.duration, 1)

      ball.x = ball.startX + (ball.endX - ball.startX) * p
      // parabolic arc
      const arcHeight = Math.abs(ball.endX - ball.startX) * 0.4 + 80
      ball.y = ball.startY + (ball.endY - ball.startY) * p - arcHeight * Math.sin(p * Math.PI)

      // puppy watches the ball
      puppy.dir = ball.x > puppy.x ? 1 : -1

      if (p >= 1) {
        ball.x = ball.endX
        ball.y = ball.endY
        ball.airborne = false
        ball.bounces = 3
        state = "CHASING"
        puppy.tongueOut = true
      }

    } else if (state === "CHASING") {
      // ball bouncing settles
      if (ball.bounces > 0) {
        ball.bounces -= dt * 4
        ball.y = groundY - Math.abs(Math.sin(ball.bounces * 4)) * ball.bounces * 6
      } else {
        ball.y = groundY
      }

      // puppy runs to ball
      const dx = ball.x - puppy.x
      const dist = Math.abs(dx)
      puppy.dir = dx > 0 ? 1 : -1
      puppy.legPhase += dt * 14

      if (dist > 15) {
        const speed = 350
        puppy.x += (dx > 0 ? 1 : -1) * speed * dt
        puppy.earBounce = 1
      } else {
        // picked up ball!
        puppy.hasBall = true
        ball.visible = false
        puppy.tongueOut = false
        state = "RETURNING"
        puppy.earBounce = 1
      }

    } else if (state === "RETURNING") {
      // puppy runs back home
      const dx = puppy.homeX - puppy.x
      const dist = Math.abs(dx)
      puppy.dir = dx > 0 ? 1 : -1
      puppy.legPhase += dt * 14

      if (dist > 20) {
        const speed = 300
        puppy.x += (dx > 0 ? 1 : -1) * speed * dt
        puppy.earBounce = 1
      } else {
        // dropped ball, celebrate
        puppy.hasBall = false
        puppy.x = puppy.homeX
        puppy.dir = 1
        score++
        state = "CELEBRATING"
        celebrateTimer = 0
        puppy.earBounce = 1
        celebrate()
        if (score % 5 === 0) celebrateBig()

        // drop ball at feet
        ball.x = puppy.x + 25
        ball.y = groundY
        ball.visible = true
      }

    } else if (state === "CELEBRATING") {
      celebrateTimer += dt
      puppy.tongueOut = true
      // puppy does a happy jump
      if (celebrateTimer < 0.8) {
        puppy.y = groundY - Math.abs(Math.sin(celebrateTimer * 8)) * 25
      } else {
        puppy.y = groundY
      }

      if (celebrateTimer > 1.2) {
        state = "WAITING"
      }
    }
  },

  render() {
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, "#56bfea")
    sky.addColorStop(0.6, "#8ed8f0")
    sky.addColorStop(1, "#c4ecf5")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // clouds
    drawCloud(ctx, w * 0.15, h * 0.1, 30)
    drawCloud(ctx, w * 0.55, h * 0.06, 24)
    drawCloud(ctx, w * 0.85, h * 0.14, 20)

    // distant hills
    ctx.fillStyle = "#7cc47c"
    ctx.beginPath()
    ctx.moveTo(0, h * 0.7)
    for (let x = 0; x <= w; x += 60) {
      ctx.lineTo(x, h * 0.7 - Math.sin(x * 0.008) * 30 - Math.sin(x * 0.015 + 1) * 15)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.fill()

    // grass ground
    const groundY = h * GROUND_Y_RATIO
    ctx.fillStyle = "#5cb85c"
    ctx.fillRect(0, groundY - 5, w, h - groundY + 5)
    ctx.fillStyle = "#4cae4c"
    ctx.fillRect(0, groundY - 5, w, 8)

    // grass tufts
    ctx.strokeStyle = "#3a9a3a"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    for (let gx = 15; gx < w; gx += 35 + Math.sin(gx) * 10) {
      const gy = groundY - 2
      ctx.beginPath()
      ctx.moveTo(gx, gy)
      ctx.lineTo(gx - 4, gy - 10)
      ctx.moveTo(gx, gy)
      ctx.lineTo(gx + 2, gy - 12)
      ctx.moveTo(gx, gy)
      ctx.lineTo(gx + 6, gy - 8)
      ctx.stroke()
    }

    // trees in background
    drawTree(ctx, w * 0.08, h * 0.68)
    drawTree(ctx, w * 0.92, h * 0.7)
    drawTree(ctx, w * 0.7, h * 0.67)

    // ball shadow
    if (ball.visible) {
      ctx.beginPath()
      ctx.ellipse(ball.x, groundY + 2, ball.radius * 0.8, 4, 0, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(0,0,0,0.1)"
      ctx.fill()
    }

    // ball
    if (ball.visible) {
      drawBall(ctx, ball.x, ball.y, ball.radius)
    }

    // puppy shadow
    ctx.beginPath()
    ctx.ellipse(puppy.x, groundY + 4, 28, 6, 0, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.1)"
    ctx.fill()

    // puppy
    drawPuppy(ctx, puppy, time)

    // score
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    ctx.font = "bold 30px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2, 16)

    if (score === 0 && state === "WAITING") {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.fillText("Tap to throw the ball!", w / 2, 52)
    }
  }
}

function handleTap(x, y) {
  if (state !== "WAITING" && state !== "CELEBRATING") return

  const groundY = h * GROUND_Y_RATIO
  state = "THROWN"
  puppy.tongueOut = false

  // ball starts at puppy, flies to tap location (clamped to ground level)
  ball.startX = puppy.x
  ball.startY = groundY
  ball.endX = x
  ball.endY = groundY // always lands on ground
  ball.x = ball.startX
  ball.y = ball.startY
  ball.t = 0
  ball.visible = true
  ball.airborne = true

  // duration based on distance
  const dist = Math.abs(x - puppy.x)
  ball.duration = 0.4 + (dist / w) * 0.6

  puppy.dir = x > puppy.x ? 1 : -1
  puppy.earBounce = 1
}

function drawBall(ctx, x, y, r) {
  // main ball
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = "#e74c3c"
  ctx.fill()

  // stripe
  ctx.beginPath()
  ctx.arc(x, y, r, -0.3, 0.3)
  ctx.lineWidth = r * 0.35
  ctx.strokeStyle = "#f5a623"
  ctx.stroke()

  // shine
  ctx.beginPath()
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.25, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.4)"
  ctx.fill()
}

function drawPuppy(ctx, p, time) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(p.dir, 1)

  const sz = p.size
  const legSwing = Math.sin(p.legPhase) * 0.5
  const tailWag = Math.sin(p.tailPhase) * 0.6
  const earDip = Math.sin(time * 3) * 0.1 + p.earBounce * Math.sin(time * 12) * 0.3

  // tail
  ctx.save()
  ctx.translate(-sz * 0.6, -sz * 0.5)
  ctx.rotate(-0.4 + tailWag)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-sz * 0.2, -sz * 0.6, -sz * 0.05, -sz * 0.8)
  ctx.lineWidth = 6
  ctx.strokeStyle = "#d4963a"
  ctx.lineCap = "round"
  ctx.stroke()
  ctx.restore()

  // back legs
  ctx.save()
  ctx.translate(-sz * 0.35, 0)
  drawLeg(ctx, sz, -legSwing)
  ctx.restore()

  // body
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.45, sz * 0.55, sz * 0.35, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#e8a838"
  ctx.fill()

  // belly
  ctx.beginPath()
  ctx.ellipse(sz * 0.05, -sz * 0.32, sz * 0.35, sz * 0.22, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#f5d99a"
  ctx.fill()

  // front legs
  ctx.save()
  ctx.translate(sz * 0.3, 0)
  drawLeg(ctx, sz, legSwing)
  ctx.restore()

  // ball in mouth
  if (p.hasBall) {
    ctx.beginPath()
    ctx.arc(sz * 0.65, -sz * 0.75, 10, 0, Math.PI * 2)
    ctx.fillStyle = "#e74c3c"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(sz * 0.62, -sz * 0.78, 3, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.fill()
  }

  // head
  ctx.beginPath()
  ctx.ellipse(sz * 0.4, -sz * 0.72, sz * 0.38, sz * 0.34, 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "#e8a838"
  ctx.fill()

  // muzzle
  ctx.beginPath()
  ctx.ellipse(sz * 0.65, -sz * 0.62, sz * 0.22, sz * 0.18, 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "#f5d99a"
  ctx.fill()

  // ears
  // left ear (farther)
  ctx.save()
  ctx.translate(sz * 0.18, -sz * 0.92)
  ctx.rotate(-0.4 + earDip)
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.14, sz * 0.26, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#c4872e"
  ctx.fill()
  ctx.restore()

  // right ear (closer)
  ctx.save()
  ctx.translate(sz * 0.55, -sz * 0.95)
  ctx.rotate(0.3 - earDip)
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.14, sz * 0.26, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#c4872e"
  ctx.fill()
  ctx.restore()

  // eye
  ctx.beginPath()
  ctx.arc(sz * 0.52, -sz * 0.8, sz * 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.55, -sz * 0.8, sz * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = "#3a2510"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(sz * 0.57, -sz * 0.82, sz * 0.025, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()

  // nose
  ctx.beginPath()
  ctx.ellipse(sz * 0.78, -sz * 0.68, sz * 0.07, sz * 0.05, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#3a2510"
  ctx.fill()

  // mouth
  ctx.beginPath()
  ctx.moveTo(sz * 0.78, -sz * 0.63)
  ctx.lineTo(sz * 0.78, -sz * 0.56)
  ctx.quadraticCurveTo(sz * 0.72, -sz * 0.52, sz * 0.65, -sz * 0.55)
  ctx.strokeStyle = "#8b5e2a"
  ctx.lineWidth = 1.5
  ctx.lineCap = "round"
  ctx.stroke()

  // tongue
  if (p.tongueOut && !p.hasBall) {
    ctx.beginPath()
    ctx.ellipse(sz * 0.78, -sz * 0.48, sz * 0.06, sz * 0.1, 0.2, 0, Math.PI * 2)
    ctx.fillStyle = "#ff7a8a"
    ctx.fill()
  }

  // cheek blush
  ctx.beginPath()
  ctx.arc(sz * 0.6, -sz * 0.63, sz * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,150,130,0.25)"
  ctx.fill()

  ctx.restore()
}

function drawLeg(ctx, sz, swing) {
  ctx.save()
  ctx.rotate(swing)
  ctx.beginPath()
  ctx.roundRect(-4, -6, 8, sz * 0.5, 4)
  ctx.fillStyle = "#d4963a"
  ctx.fill()
  // paw
  ctx.beginPath()
  ctx.ellipse(0, sz * 0.44, 7, 5, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#f5d99a"
  ctx.fill()
  ctx.restore()
}

function drawCloud(ctx, x, y, r) {
  ctx.globalAlpha = 0.7
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.arc(x + r * 0.8, y - r * 0.2, r * 0.7, 0, Math.PI * 2)
  ctx.arc(x - r * 0.6, y + r * 0.1, r * 0.6, 0, Math.PI * 2)
  ctx.arc(x + r * 0.3, y + r * 0.15, r * 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawTree(ctx, x, y) {
  // trunk
  ctx.fillStyle = "#8b6914"
  ctx.fillRect(x - 6, y, 12, 35)

  // foliage
  ctx.fillStyle = "#3a9a3a"
  ctx.beginPath()
  ctx.arc(x, y - 5, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#2d8a2e"
  ctx.beginPath()
  ctx.arc(x + 10, y + 2, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#45a845"
  ctx.beginPath()
  ctx.arc(x - 8, y - 2, 20, 0, Math.PI * 2)
  ctx.fill()
}
