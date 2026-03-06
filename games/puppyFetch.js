import { celebrate, celebrateBig } from "../engine/celebrate.js"

let ctx, input, w, h
let tapHandler
let puppy, ball, score, time
let state // WAITING, THROWN, CHASING, RETURNING, CELEBRATING
let celebrateTimer
let scorePopups, dustClouds, pawPrints, butterflies, birds
let grassBlades, flowers, leaves
let combo, comboTimer, lastFetchTime
let screenShake, throwTrail
let windPhase

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
    combo = 0
    comboTimer = 0
    lastFetchTime = 0
    screenShake = 0
    windPhase = 0
    scorePopups = []
    dustClouds = []
    pawPrints = []
    throwTrail = []
    leaves = []

    const groundY = h * GROUND_Y_RATIO

    puppy = {
      x: w * PUPPY_HOME_X_RATIO,
      y: groundY,
      homeX: w * PUPPY_HOME_X_RATIO,
      homeY: groundY,
      dir: 1,
      tailPhase: 0,
      legPhase: 0,
      tongueOut: true,
      hasBall: false,
      earBounce: 0,
      size: 42,
      happiness: 0,
      bark: 0,
      spinAngle: 0,
      jumping: false,
      jumpVY: 0,
      excitement: 0,
      panting: 0
    }

    ball = {
      x: puppy.x,
      y: groundY,
      vx: 0, vy: 0,
      radius: 14,
      airborne: false,
      visible: true,
      startX: 0, startY: 0,
      endX: 0, endY: 0,
      t: 0, duration: 0,
      bounces: 0,
      spin: 0,
      shadow: groundY
    }

    state = "WAITING"

    // butterflies
    butterflies = []
    for (let i = 0; i < 3; i++) {
      butterflies.push({
        x: Math.random() * w,
        y: h * 0.3 + Math.random() * h * 0.3,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 20,
        wingPhase: Math.random() * Math.PI * 2,
        color: ['#ff9ff3', '#feca57', '#54a0ff', '#ff6b6b'][Math.floor(Math.random() * 4)],
        size: 5 + Math.random() * 4
      })
    }

    // birds on background
    birds = []
    for (let i = 0; i < 2; i++) {
      birds.push({
        x: Math.random() * w,
        y: h * 0.12 + Math.random() * h * 0.1,
        speed: 20 + Math.random() * 30,
        wingPhase: Math.random() * Math.PI * 2,
        dir: Math.random() < 0.5 ? 1 : -1
      })
    }

    // grass blade details
    grassBlades = []
    for (let gx = 5; gx < w; gx += 8 + Math.random() * 12) {
      grassBlades.push({
        x: gx,
        height: 8 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        shade: Math.random()
      })
    }

    // flowers
    flowers = []
    for (let fx = 40; fx < w; fx += 70 + Math.random() * 80) {
      flowers.push({
        x: fx,
        y: groundY - 2 - Math.random() * 4,
        color: ['#ff6b9d', '#feca57', '#a55eea', '#fff', '#ff9f43'][Math.floor(Math.random() * 5)],
        size: 4 + Math.random() * 3,
        petals: 4 + Math.floor(Math.random() * 3)
      })
    }

    tapHandler = handleTap
    input.onTap(tapHandler)
  },

  destroy() {
    input.offTap(tapHandler)
    scorePopups = []; dustClouds = []; pawPrints = []
    butterflies = []; birds = []; leaves = []
  },

  update(dt) {
    w = window.innerWidth
    h = window.innerHeight
    time += dt
    windPhase += dt * 0.7
    const groundY = h * GROUND_Y_RATIO

    // screen shake
    if (screenShake > 0) screenShake *= Math.pow(0.04, dt)
    if (screenShake < 0.3) screenShake = 0

    // combo timer
    if (comboTimer > 0) {
      comboTimer -= dt
      if (comboTimer <= 0) { combo = 0; comboTimer = 0 }
    }

    puppy.homeX = w * PUPPY_HOME_X_RATIO
    puppy.homeY = groundY
    puppy.tailPhase += dt * (state === "WAITING" ? 6 : 12)
    puppy.earBounce = Math.max(0, puppy.earBounce - dt * 4)
    puppy.happiness *= Math.pow(0.3, dt)
    puppy.bark = Math.max(0, puppy.bark - dt * 3)
    puppy.excitement *= Math.pow(0.5, dt)
    puppy.panting = Math.max(0, puppy.panting - dt * 0.3)

    // wind leaves
    if (Math.random() < dt * 0.5) {
      leaves.push({
        x: -20,
        y: h * 0.2 + Math.random() * h * 0.4,
        vx: 40 + Math.random() * 60,
        vy: 10 + Math.random() * 20,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
        size: 4 + Math.random() * 4,
        life: 3 + Math.random() * 3,
        color: ['#5cb85c', '#4aaa4a', '#7cc47c', '#8a6a14'][Math.floor(Math.random() * 4)]
      })
    }
    leaves.forEach(l => {
      l.x += l.vx * dt
      l.y += l.vy * dt + Math.sin(time * 2 + l.rot) * 15 * dt
      l.rot += l.rotSpeed * dt
      l.life -= dt
    })
    leaves = leaves.filter(l => l.life > 0 && l.x < w + 30)

    if (state === "WAITING") {
      puppy.tongueOut = true
      puppy.legPhase = 0
      puppy.panting = Math.min(1, puppy.panting + dt * 0.1)
      // idle — puppy looks around, sits
      if (Math.sin(time * 0.5) > 0.8 && !puppy.jumping) {
        puppy.dir = Math.sin(time * 0.3) > 0 ? 1 : -1
      }

    } else if (state === "THROWN") {
      ball.t += dt
      ball.spin += dt * 12
      const p = Math.min(ball.t / ball.duration, 1)

      ball.x = ball.startX + (ball.endX - ball.startX) * p
      const arcHeight = Math.abs(ball.endX - ball.startX) * 0.4 + 80
      ball.y = ball.startY + (ball.endY - ball.startY) * p - arcHeight * Math.sin(p * Math.PI)

      // throw trail
      if (ball.airborne) {
        throwTrail.push({ x: ball.x, y: ball.y, life: 0.5, size: ball.radius * 0.3 })
      }

      // ball shadow position
      ball.shadow = groundY

      puppy.dir = ball.x > puppy.x ? 1 : -1
      // puppy excitement — looks up, ears perk
      puppy.excitement = 1
      puppy.earBounce = 1

      if (p >= 1) {
        ball.x = ball.endX
        ball.y = ball.endY
        ball.airborne = false
        ball.bounces = 3
        state = "CHASING"
        puppy.tongueOut = true
        puppy.bark = 1
        // dust on landing
        for (let i = 0; i < 6; i++) {
          dustClouds.push({
            x: ball.x + (Math.random() - 0.5) * 20,
            y: groundY,
            vx: (Math.random() - 0.5) * 60,
            vy: -15 - Math.random() * 30,
            size: 4 + Math.random() * 6,
            life: 0.8
          })
        }
      }

    } else if (state === "CHASING") {
      // ball bounce settles
      if (ball.bounces > 0) {
        ball.bounces -= dt * 4
        ball.y = groundY - Math.abs(Math.sin(ball.bounces * 4)) * ball.bounces * 6
        ball.spin += dt * 6 * ball.bounces
      } else {
        ball.y = groundY
        ball.spin *= 0.95
      }

      // puppy runs to ball
      const dx = ball.x - puppy.x
      const dist = Math.abs(dx)
      puppy.dir = dx > 0 ? 1 : -1
      puppy.legPhase += dt * 16
      puppy.panting = 1

      if (dist > 15) {
        const speed = 380
        puppy.x += (dx > 0 ? 1 : -1) * speed * dt
        puppy.earBounce = 1

        // running dust
        if (Math.random() < dt * 8) {
          dustClouds.push({
            x: puppy.x - puppy.dir * 15,
            y: groundY,
            vx: -puppy.dir * (10 + Math.random() * 20),
            vy: -5 - Math.random() * 15,
            size: 3 + Math.random() * 4,
            life: 0.6
          })
        }

        // paw prints
        if (Math.floor(puppy.legPhase / 3) !== Math.floor((puppy.legPhase - dt * 16) / 3)) {
          pawPrints.push({
            x: puppy.x,
            y: groundY + 2,
            life: 4,
            dir: puppy.dir
          })
        }
      } else {
        // picked up ball!
        puppy.hasBall = true
        ball.visible = false
        puppy.tongueOut = false
        state = "RETURNING"
        puppy.earBounce = 1
        puppy.bark = 1
      }

    } else if (state === "RETURNING") {
      const dx = puppy.homeX - puppy.x
      const dist = Math.abs(dx)
      puppy.dir = dx > 0 ? 1 : -1
      puppy.legPhase += dt * 14

      if (dist > 20) {
        const speed = 320
        puppy.x += (dx > 0 ? 1 : -1) * speed * dt
        puppy.earBounce = 1

        // running dust
        if (Math.random() < dt * 6) {
          dustClouds.push({
            x: puppy.x - puppy.dir * 15,
            y: groundY,
            vx: -puppy.dir * (10 + Math.random() * 15),
            vy: -5 - Math.random() * 12,
            size: 3 + Math.random() * 3,
            life: 0.5
          })
        }
      } else {
        // dropped ball, celebrate!
        puppy.hasBall = false
        puppy.x = puppy.homeX
        puppy.dir = 1

        // combo system
        const timeSince = time - lastFetchTime
        if (timeSince < 6 && lastFetchTime > 0) {
          combo++
          comboTimer = 6
        } else {
          combo = 1
          comboTimer = 6
        }
        lastFetchTime = time

        const points = Math.max(1, combo)
        score += points

        state = "CELEBRATING"
        celebrateTimer = 0
        puppy.earBounce = 1
        puppy.happiness = 1
        puppy.bark = 1
        puppy.jumping = true
        puppy.jumpVY = -300

        if (combo >= 3) {
          screenShake = 6
          puppy.spinAngle = 0 // trigger spin
        }

        // score popup
        const label = combo > 1 ? `+${points} x${combo}!` : `+${points}`
        scorePopups.push({
          x: puppy.x, y: puppy.y - 60,
          text: label,
          life: 1.5,
          color: combo >= 3 ? '#feca57' : '#fff',
          scale: combo >= 3 ? 1.4 : 1
        })

        celebrate()
        if (score % 5 === 0) celebrateBig()

        ball.x = puppy.x + 25
        ball.y = groundY
        ball.visible = true
      }

    } else if (state === "CELEBRATING") {
      celebrateTimer += dt
      puppy.tongueOut = true

      // jumping with physics
      if (puppy.jumping) {
        puppy.jumpVY += 800 * dt
        puppy.y += puppy.jumpVY * dt

        // spin on big combos
        if (combo >= 3 && celebrateTimer < 0.8) {
          puppy.spinAngle += dt * 15
        }

        if (puppy.y >= groundY) {
          puppy.y = groundY
          if (celebrateTimer < 1.0) {
            // bounce again, smaller
            puppy.jumpVY = -200 * Math.max(0, 1 - celebrateTimer)
            // landing dust
            for (let i = 0; i < 4; i++) {
              dustClouds.push({
                x: puppy.x + (Math.random() - 0.5) * 20,
                y: groundY,
                vx: (Math.random() - 0.5) * 40,
                vy: -10 - Math.random() * 20,
                size: 3 + Math.random() * 4,
                life: 0.5
              })
            }
          } else {
            puppy.jumping = false
            puppy.jumpVY = 0
            puppy.spinAngle = 0
          }
        }
      }

      if (celebrateTimer > 1.5) {
        state = "WAITING"
        puppy.jumping = false
        puppy.y = groundY
        puppy.spinAngle = 0
      }
    }

    // update particles
    dustClouds.forEach(d => {
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.size += dt * 8
      d.life -= dt * 2
    })
    dustClouds = dustClouds.filter(d => d.life > 0)

    pawPrints.forEach(p => { p.life -= dt })
    pawPrints = pawPrints.filter(p => p.life > 0)

    throwTrail.forEach(t => { t.life -= dt * 2 })
    throwTrail = throwTrail.filter(t => t.life > 0)

    scorePopups.forEach(p => { p.y -= 50 * dt; p.life -= dt })
    scorePopups = scorePopups.filter(p => p.life > 0)

    // butterflies
    butterflies.forEach(b => {
      b.wingPhase += dt * 12
      b.x += b.vx * dt + Math.sin(time * 1.5 + b.wingPhase) * 15 * dt
      b.y += b.vy * dt + Math.cos(time + b.wingPhase) * 10 * dt
      b.vx += (Math.random() - 0.5) * 50 * dt
      b.vy += (Math.random() - 0.5) * 30 * dt
      b.vx *= 0.98; b.vy *= 0.98
      if (b.x < 10) b.vx += 20 * dt
      if (b.x > w - 10) b.vx -= 20 * dt
      if (b.y < 20) b.vy += 20 * dt
      if (b.y > groundY - 30) b.vy -= 30 * dt
    })

    // birds
    birds.forEach(b => {
      b.wingPhase += dt * 6
      b.x += b.speed * b.dir * dt
      if (b.x > w + 40) { b.x = -40; b.dir = 1 }
      if (b.x < -40) { b.x = w + 40; b.dir = -1 }
    })
  },

  render() {
    ctx.save()

    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake)
    }

    const groundY = h * GROUND_Y_RATIO

    // sky with warm gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7)
    sky.addColorStop(0, "#4ca8e0")
    sky.addColorStop(0.4, "#6bc4f0")
    sky.addColorStop(0.7, "#8ed8f0")
    sky.addColorStop(1, "#b8eafc")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // sun
    const sunX = w * 0.15
    const sunY = h * 0.1
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 90)
    sunGlow.addColorStop(0, "rgba(255,240,150,0.8)")
    sunGlow.addColorStop(0.4, "rgba(255,220,100,0.2)")
    sunGlow.addColorStop(1, "rgba(255,200,50,0)")
    ctx.fillStyle = sunGlow
    ctx.fillRect(sunX - 90, sunY - 90, 180, 180)
    ctx.beginPath()
    ctx.arc(sunX, sunY, 24, 0, Math.PI * 2)
    ctx.fillStyle = "#ffe066"
    ctx.fill()

    // clouds with depth
    drawCloud(ctx, w * 0.25, h * 0.08, 34, 0.6)
    drawCloud(ctx, w * 0.55, h * 0.05, 26, 0.45)
    drawCloud(ctx, w * 0.82, h * 0.12, 22, 0.5)
    drawCloud(ctx, w * 0.05, h * 0.15, 18, 0.35)

    // birds in sky
    birds.forEach(b => {
      ctx.strokeStyle = "rgba(60,60,80,0.4)"
      ctx.lineWidth = 1.5
      const wingUp = Math.sin(b.wingPhase) * 5
      ctx.beginPath()
      ctx.moveTo(b.x - 8, b.y + wingUp)
      ctx.quadraticCurveTo(b.x, b.y - 2, b.x + 8, b.y + wingUp)
      ctx.stroke()
    })

    // distant hills with layers
    ctx.fillStyle = "#8dd48d"
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(0, h * 0.68)
    for (let x = 0; x <= w; x += 40) {
      ctx.lineTo(x, h * 0.68 - Math.sin(x * 0.006 + 1) * 35 - Math.sin(x * 0.012) * 15)
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h)
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.fillStyle = "#7cc47c"
    ctx.beginPath()
    ctx.moveTo(0, h * 0.72)
    for (let x = 0; x <= w; x += 40) {
      ctx.lineTo(x, h * 0.72 - Math.sin(x * 0.008) * 25 - Math.sin(x * 0.015 + 1) * 12)
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h)
    ctx.fill()

    // fence in mid-ground
    const fenceY = h * 0.73
    ctx.strokeStyle = "#c4a060"
    ctx.lineWidth = 3
    // horizontal bars
    ctx.beginPath()
    ctx.moveTo(0, fenceY - 12)
    ctx.lineTo(w, fenceY - 12)
    ctx.moveTo(0, fenceY)
    ctx.lineTo(w, fenceY)
    ctx.stroke()
    // posts
    for (let fx = 20; fx < w; fx += 55) {
      ctx.fillStyle = "#b89050"
      ctx.fillRect(fx - 3, fenceY - 22, 6, 28)
      // post top
      ctx.beginPath()
      ctx.arc(fx, fenceY - 22, 4, 0, Math.PI * 2)
      ctx.fillStyle = "#c4a060"
      ctx.fill()
    }

    // trees in background (richer)
    drawTree(ctx, w * 0.06, h * 0.7, 1.2)
    drawTree(ctx, w * 0.94, h * 0.72, 1.0)
    drawTree(ctx, w * 0.72, h * 0.69, 0.9)
    drawTree(ctx, w * 0.35, h * 0.71, 0.7)

    // grass ground
    const grassGrad = ctx.createLinearGradient(0, groundY - 5, 0, h)
    grassGrad.addColorStop(0, "#5cb85c")
    grassGrad.addColorStop(0.3, "#4cae4c")
    grassGrad.addColorStop(1, "#3a8a3a")
    ctx.fillStyle = grassGrad
    ctx.fillRect(0, groundY - 5, w, h - groundY + 5)

    // grass edge
    ctx.fillStyle = "#4cae4c"
    ctx.beginPath()
    ctx.moveTo(0, groundY - 5)
    for (let x = 0; x <= w; x += 12) {
      ctx.lineTo(x, groundY - 5 + Math.sin(x * 0.1) * 2)
    }
    ctx.lineTo(w, groundY + 3)
    ctx.lineTo(0, groundY + 3)
    ctx.fill()

    // grass blades with wind
    const wind = Math.sin(windPhase) * 4
    grassBlades.forEach(g => {
      const sway = Math.sin(time * 1.5 + g.phase) * 3 + wind
      ctx.strokeStyle = g.shade > 0.5 ? "#4aaa4a" : "#3a9a3a"
      ctx.lineWidth = 1.5
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(g.x, groundY - 2)
      ctx.quadraticCurveTo(g.x + sway * 0.5, groundY - g.height * 0.6, g.x + sway, groundY - g.height)
      ctx.stroke()
    })

    // flowers
    flowers.forEach(f => drawFlower(ctx, f))

    // paw prints
    pawPrints.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life * 0.3)
      drawPawPrint(ctx, p.x, p.y, p.dir)
    })
    ctx.globalAlpha = 1

    // throw trail (dotted arc)
    throwTrail.forEach(t => {
      ctx.globalAlpha = t.life * 0.4
      ctx.beginPath()
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,0.5)"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // ball shadow
    if (ball.visible) {
      const shadowScale = 1 - Math.max(0, Math.min(1, (groundY - ball.y) / 200)) * 0.4
      ctx.beginPath()
      ctx.ellipse(ball.x, groundY + 3, ball.radius * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(0,0,0,0.12)"
      ctx.fill()
    }

    // ball
    if (ball.visible) {
      drawBall(ctx, ball.x, ball.y, ball.radius, ball.spin)
    }

    // butterflies
    butterflies.forEach(b => drawButterfly(ctx, b))

    // dust clouds
    dustClouds.forEach(d => {
      ctx.globalAlpha = d.life * 0.3
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(180,160,120,0.4)"
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // puppy shadow
    const puppyShadowY = groundY + 4
    const shadowHeight = puppy.jumping ? Math.max(2, 6 - (groundY - puppy.y) * 0.03) : 6
    ctx.beginPath()
    ctx.ellipse(puppy.x, puppyShadowY, 30, shadowHeight, 0, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(0,0,0,0.12)"
    ctx.fill()

    // puppy
    drawPuppy(ctx, puppy, time)

    // bark bubble
    if (puppy.bark > 0.3) {
      ctx.globalAlpha = puppy.bark * 0.8
      const bx = puppy.x + puppy.dir * 40
      const by = puppy.y - puppy.size * 1.5
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.ellipse(bx, by, 22, 14, 0, 0, Math.PI * 2)
      ctx.fill()
      // tail
      ctx.beginPath()
      ctx.moveTo(bx - 8, by + 10)
      ctx.lineTo(puppy.x + puppy.dir * 20, by + 20)
      ctx.lineTo(bx + 2, by + 12)
      ctx.fill()
      ctx.font = "bold 13px sans-serif"
      ctx.fillStyle = "#e8a838"
      ctx.textAlign = "center"
      ctx.fillText("WOOF!", bx, by + 4)
      ctx.globalAlpha = 1
    }

    // floating leaves
    leaves.forEach(l => {
      ctx.save()
      ctx.translate(l.x, l.y)
      ctx.rotate(l.rot)
      ctx.globalAlpha = Math.min(1, l.life * 0.5)
      ctx.fillStyle = l.color
      ctx.beginPath()
      ctx.ellipse(0, 0, l.size, l.size * 0.4, 0, 0, Math.PI * 2)
      ctx.fill()
      // leaf vein
      ctx.strokeStyle = "rgba(0,0,0,0.1)"
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(-l.size * 0.8, 0)
      ctx.lineTo(l.size * 0.8, 0)
      ctx.stroke()
      ctx.restore()
    })
    ctx.globalAlpha = 1

    // score popups
    scorePopups.forEach(p => {
      const alpha = Math.min(1, p.life * 2)
      const s = p.scale * (1 + (1.5 - p.life) * 0.2)
      ctx.globalAlpha = alpha
      ctx.font = `bold ${Math.round(24 * s)}px sans-serif`
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
      const fill = comboTimer / 6
      const cc = combo >= 4 ? "#ff6b6b" : combo >= 2 ? "#feca57" : "#54a0ff"
      ctx.fillStyle = cc
      ctx.beginPath()
      ctx.roundRect(bx, by, barW * fill, barH, 4)
      ctx.fill()
      ctx.font = "bold 13px sans-serif"
      ctx.fillStyle = cc
      ctx.textAlign = "center"
      ctx.fillText(`FETCH x${combo}`, w / 2, by - 3)
    }

    // score
    ctx.fillStyle = "rgba(0,0,0,0.12)"
    ctx.font = "bold 34px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(score, w / 2 + 1, 17)
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    ctx.fillText(score, w / 2, 16)

    if (score === 0 && state === "WAITING") {
      ctx.font = "18px sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.fillText("Tap to throw the ball!", w / 2, 54)
    }

    ctx.restore()
  }
}

function handleTap(x, y) {
  if (state !== "WAITING" && state !== "CELEBRATING") return

  const groundY = h * GROUND_Y_RATIO
  state = "THROWN"
  puppy.tongueOut = false

  ball.startX = puppy.x
  ball.startY = groundY
  ball.endX = x
  ball.endY = groundY
  ball.x = ball.startX
  ball.y = ball.startY
  ball.t = 0
  ball.visible = true
  ball.airborne = true
  ball.spin = 0

  const dist = Math.abs(x - puppy.x)
  ball.duration = 0.4 + (dist / w) * 0.6

  puppy.dir = x > puppy.x ? 1 : -1
  puppy.earBounce = 1
  throwTrail = []
}

function drawBall(ctx, x, y, r, spin) {
  ctx.save()
  ctx.translate(x, y)

  // main ball
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  const ballGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r)
  ballGrad.addColorStop(0, "#f05050")
  ballGrad.addColorStop(1, "#c0302b")
  ctx.fillStyle = ballGrad
  ctx.fill()

  // rotating stripe
  ctx.save()
  ctx.rotate(spin)
  ctx.beginPath()
  ctx.arc(0, 0, r, -0.35, 0.35)
  ctx.lineWidth = r * 0.4
  ctx.strokeStyle = "#f5a623"
  ctx.stroke()
  // second stripe
  ctx.beginPath()
  ctx.arc(0, 0, r, Math.PI - 0.35, Math.PI + 0.35)
  ctx.stroke()
  ctx.restore()

  // shine
  ctx.beginPath()
  ctx.arc(-r * 0.25, -r * 0.3, r * 0.28, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.45)"
  ctx.fill()

  ctx.restore()
}

function drawPuppy(ctx, p, time) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(p.dir, 1)

  // spin for celebration tricks
  if (p.spinAngle) {
    ctx.rotate(p.spinAngle)
  }

  const sz = p.size
  const legSwing = Math.sin(p.legPhase) * 0.5
  const tailWag = Math.sin(p.tailPhase) * 0.7
  const earDip = Math.sin(time * 3) * 0.1 + p.earBounce * Math.sin(time * 12) * 0.35
  const happyScale = 1 + p.happiness * 0.05
  const pant = Math.sin(time * 8) * p.panting

  ctx.scale(happyScale, happyScale)

  // tail
  ctx.save()
  ctx.translate(-sz * 0.6, -sz * 0.5)
  ctx.rotate(-0.3 + tailWag)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-sz * 0.15, -sz * 0.4, -sz * 0.2, -sz * 0.7)
  ctx.quadraticCurveTo(-sz * 0.1, -sz * 0.85, 0, -sz * 0.75)
  ctx.lineWidth = 7
  ctx.strokeStyle = "#d4963a"
  ctx.lineCap = "round"
  ctx.stroke()
  // tail tip (lighter)
  ctx.beginPath()
  ctx.arc(-sz * 0.1, -sz * 0.8, 4, 0, Math.PI * 2)
  ctx.fillStyle = "#f5d99a"
  ctx.fill()
  ctx.restore()

  // back legs
  ctx.save()
  ctx.translate(-sz * 0.35, 0)
  drawLeg(ctx, sz, -legSwing)
  ctx.restore()
  ctx.save()
  ctx.translate(-sz * 0.2, 0)
  drawLeg(ctx, sz, legSwing * 0.7)
  ctx.restore()

  // body with gradient
  ctx.beginPath()
  ctx.ellipse(0, -sz * 0.45, sz * 0.58, sz * 0.38, 0, 0, Math.PI * 2)
  const bodyGrad = ctx.createRadialGradient(0, -sz * 0.55, sz * 0.1, 0, -sz * 0.4, sz * 0.6)
  bodyGrad.addColorStop(0, "#f0b838")
  bodyGrad.addColorStop(1, "#d89828")
  ctx.fillStyle = bodyGrad
  ctx.fill()

  // collar
  ctx.beginPath()
  ctx.ellipse(sz * 0.15, -sz * 0.55, sz * 0.25, sz * 0.08, 0.15, 0, Math.PI * 2)
  ctx.fillStyle = "#e74c3c"
  ctx.fill()
  // collar tag
  ctx.beginPath()
  ctx.arc(sz * 0.25, -sz * 0.48, 4, 0, Math.PI * 2)
  ctx.fillStyle = "#feca57"
  ctx.fill()

  // belly
  ctx.beginPath()
  ctx.ellipse(sz * 0.05, -sz * 0.32, sz * 0.38, sz * 0.24, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#f5d99a"
  ctx.fill()

  // front legs
  ctx.save()
  ctx.translate(sz * 0.25, 0)
  drawLeg(ctx, sz, legSwing * 0.8)
  ctx.restore()
  ctx.save()
  ctx.translate(sz * 0.35, 0)
  drawLeg(ctx, sz, -legSwing)
  ctx.restore()

  // ball in mouth
  if (p.hasBall) {
    ctx.beginPath()
    ctx.arc(sz * 0.7, -sz * 0.76, 11, 0, Math.PI * 2)
    ctx.fillStyle = "#e74c3c"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(sz * 0.67, -sz * 0.79, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.4)"
    ctx.fill()
  }

  // head
  ctx.beginPath()
  ctx.ellipse(sz * 0.42, -sz * 0.74, sz * 0.4, sz * 0.36, 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "#e8a838"
  ctx.fill()

  // head fur highlight
  ctx.beginPath()
  ctx.ellipse(sz * 0.38, -sz * 0.85, sz * 0.2, sz * 0.12, 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "#f0b838"
  ctx.fill()

  // muzzle
  ctx.beginPath()
  ctx.ellipse(sz * 0.68, -sz * 0.64, sz * 0.24, sz * 0.2, 0.1, 0, Math.PI * 2)
  ctx.fillStyle = "#f5d99a"
  ctx.fill()

  // ears
  ctx.save()
  ctx.translate(sz * 0.18, -sz * 0.94)
  ctx.rotate(-0.45 + earDip)
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.15, sz * 0.3, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#c4872e"
  ctx.fill()
  // inner ear
  ctx.beginPath()
  ctx.ellipse(sz * 0.02, sz * 0.05, sz * 0.08, sz * 0.18, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#e8a080"
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.translate(sz * 0.58, -sz * 0.98)
  ctx.rotate(0.35 - earDip)
  ctx.beginPath()
  ctx.ellipse(0, 0, sz * 0.15, sz * 0.3, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#c4872e"
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-sz * 0.02, sz * 0.05, sz * 0.08, sz * 0.18, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#e8a080"
  ctx.fill()
  ctx.restore()

  // eye with more expression
  const eyeY = p.excitement > 0.5 ? -sz * 0.82 : -sz * 0.8
  ctx.beginPath()
  ctx.arc(sz * 0.52, eyeY, sz * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  // pupil — tracks ball when excited
  const pupilX = p.excitement > 0.3 ? sz * 0.56 : sz * 0.55
  ctx.beginPath()
  ctx.arc(pupilX, eyeY, sz * 0.065, 0, Math.PI * 2)
  ctx.fillStyle = "#3a2510"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(pupilX + sz * 0.02, eyeY - sz * 0.02, sz * 0.028, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()

  // happy sparkle eyes
  if (p.happiness > 0.5) {
    ctx.globalAlpha = p.happiness
    drawStar(ctx, sz * 0.56, eyeY - sz * 0.02, 4, "#fff")
    ctx.globalAlpha = 1
  }

  // eyebrow for expression
  if (p.excitement > 0.3) {
    ctx.strokeStyle = "#c4872e"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(sz * 0.42, -sz * 0.92)
    ctx.lineTo(sz * 0.6, -sz * 0.96)
    ctx.stroke()
  }

  // nose
  ctx.beginPath()
  ctx.ellipse(sz * 0.82, -sz * 0.7, sz * 0.08, sz * 0.06, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#3a2510"
  ctx.fill()
  // nose shine
  ctx.beginPath()
  ctx.arc(sz * 0.8, -sz * 0.72, sz * 0.02, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.3)"
  ctx.fill()

  // mouth
  ctx.beginPath()
  ctx.moveTo(sz * 0.82, -sz * 0.64)
  ctx.lineTo(sz * 0.82, -sz * 0.57)
  ctx.quadraticCurveTo(sz * 0.75, -sz * 0.52 + pant * 2, sz * 0.65, -sz * 0.55 + pant)
  ctx.strokeStyle = "#8b5e2a"
  ctx.lineWidth = 1.5
  ctx.lineCap = "round"
  ctx.stroke()

  // tongue
  if (p.tongueOut && !p.hasBall) {
    const tongueLen = sz * (0.12 + pant * 0.04)
    ctx.beginPath()
    ctx.ellipse(sz * 0.8, -sz * 0.48 + pant * 3, sz * 0.07, tongueLen, 0.2, 0, Math.PI * 2)
    ctx.fillStyle = "#ff7a8a"
    ctx.fill()
    // tongue line
    ctx.strokeStyle = "#e06070"
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(sz * 0.8, -sz * 0.52 + pant * 3)
    ctx.lineTo(sz * 0.8, -sz * 0.38 + pant * 3)
    ctx.stroke()
  }

  // cheek blush
  ctx.beginPath()
  ctx.arc(sz * 0.62, -sz * 0.62, sz * 0.09, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255,150,130,${0.2 + p.happiness * 0.2})`
  ctx.fill()

  // whisker dots
  ctx.fillStyle = "rgba(100,70,30,0.15)"
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(sz * 0.72 + i * 4, -sz * 0.6, 1, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawLeg(ctx, sz, swing) {
  ctx.save()
  ctx.rotate(swing)
  ctx.beginPath()
  ctx.roundRect(-4.5, -6, 9, sz * 0.52, 4.5)
  ctx.fillStyle = "#d4963a"
  ctx.fill()
  // paw
  ctx.beginPath()
  ctx.ellipse(0, sz * 0.46, 8, 5.5, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#f5d99a"
  ctx.fill()
  // toe lines
  ctx.strokeStyle = "rgba(180,140,60,0.15)"
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(-3, sz * 0.46)
  ctx.lineTo(-3, sz * 0.5)
  ctx.moveTo(0, sz * 0.46)
  ctx.lineTo(0, sz * 0.51)
  ctx.moveTo(3, sz * 0.46)
  ctx.lineTo(3, sz * 0.5)
  ctx.stroke()
  ctx.restore()
}

function drawPawPrint(ctx, x, y, dir) {
  ctx.fillStyle = "rgba(100,80,40,0.08)"
  // main pad
  ctx.beginPath()
  ctx.ellipse(x, y, 5, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  // toes
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.arc(x + i * 4 * dir, y - 5, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawFlower(ctx, f) {
  ctx.save()
  ctx.translate(f.x, f.y)
  const sway = Math.sin(time * 1.2 + f.x * 0.1) * 0.1
  ctx.rotate(sway)

  // stem
  ctx.strokeStyle = "#3a9a3a"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, -f.size * 3)
  ctx.stroke()

  // petals
  for (let i = 0; i < f.petals; i++) {
    const a = (i / f.petals) * Math.PI * 2 + Math.sin(time * 0.5 + f.x) * 0.1
    ctx.beginPath()
    ctx.ellipse(
      Math.cos(a) * f.size * 0.6,
      -f.size * 3 + Math.sin(a) * f.size * 0.6,
      f.size * 0.5, f.size * 0.3, a, 0, Math.PI * 2
    )
    ctx.fillStyle = f.color
    ctx.fill()
  }
  // center
  ctx.beginPath()
  ctx.arc(0, -f.size * 3, f.size * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#feca57"
  ctx.fill()

  ctx.restore()
}

function drawButterfly(ctx, b) {
  ctx.save()
  ctx.translate(b.x, b.y)
  const wingFlap = Math.sin(b.wingPhase) * 0.5
  // wings
  ctx.save()
  ctx.scale(1, Math.cos(wingFlap))
  ctx.beginPath()
  ctx.ellipse(-b.size * 0.5, 0, b.size * 0.7, b.size, -0.2, 0, Math.PI * 2)
  ctx.fillStyle = b.color
  ctx.globalAlpha = 0.6
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
  ctx.save()
  ctx.scale(1, Math.cos(wingFlap + 0.4))
  ctx.beginPath()
  ctx.ellipse(b.size * 0.5, 0, b.size * 0.7, b.size, 0.2, 0, Math.PI * 2)
  ctx.fillStyle = b.color
  ctx.globalAlpha = 0.6
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.restore()
  // body
  ctx.fillStyle = "#333"
  ctx.beginPath()
  ctx.ellipse(0, 0, 1.5, b.size * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
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

function drawCloud(ctx, x, y, r, alpha) {
  ctx.globalAlpha = alpha || 0.7
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.arc(x + r * 0.85, y - r * 0.2, r * 0.72, 0, Math.PI * 2)
  ctx.arc(x - r * 0.65, y + r * 0.1, r * 0.62, 0, Math.PI * 2)
  ctx.arc(x + r * 0.3, y + r * 0.18, r * 0.55, 0, Math.PI * 2)
  ctx.arc(x + r * 0.4, y - r * 0.3, r * 0.45, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawTree(ctx, x, y, scale) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale || 1, scale || 1)

  // trunk
  ctx.fillStyle = "#8b6914"
  ctx.beginPath()
  ctx.moveTo(-7, 0)
  ctx.quadraticCurveTo(-9, -20, -6, -35)
  ctx.lineTo(6, -35)
  ctx.quadraticCurveTo(9, -20, 7, 0)
  ctx.fill()

  // trunk texture
  ctx.strokeStyle = "rgba(0,0,0,0.08)"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-2, 0)
  ctx.lineTo(-3, -30)
  ctx.moveTo(3, -5)
  ctx.lineTo(2, -25)
  ctx.stroke()

  // branch
  ctx.strokeStyle = "#8b6914"
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(0, -25)
  ctx.quadraticCurveTo(15, -30, 22, -28)
  ctx.stroke()

  // foliage layers
  ctx.fillStyle = "#3a9a3a"
  ctx.beginPath()
  ctx.arc(-5, -45, 30, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#2d8a2e"
  ctx.beginPath()
  ctx.arc(12, -38, 24, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#45a845"
  ctx.beginPath()
  ctx.arc(-10, -38, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#4aaa4a"
  ctx.beginPath()
  ctx.arc(3, -52, 20, 0, Math.PI * 2)
  ctx.fill()

  // leaf highlights
  ctx.fillStyle = "rgba(255,255,255,0.06)"
  ctx.beginPath()
  ctx.arc(-8, -50, 12, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}
