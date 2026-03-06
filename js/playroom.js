(function() {
  const menu = document.getElementById('menu')

  // --- Fairy lights (string with bulbs in a catenary) ---
  const lightsEl = document.getElementById('fairy-lights')
  const bulbColors = ['#ff6b6b','#feca57','#26de81','#54a0ff','#a55eea','#ff9f43','#ff9ff3']
  const bulbCount = Math.ceil(window.innerWidth / 45)
  // Wire (SVG path for catenary)
  const svgNs = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNs, 'svg')
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '50')
  svg.style.position = 'absolute'
  svg.style.top = '0'
  svg.style.left = '0'
  const wirePath = document.createElementNS(svgNs, 'path')
  let d = ''
  for (let i = 0; i <= bulbCount; i++) {
    const x = (i / bulbCount) * window.innerWidth
    const sag = Math.sin((i / bulbCount) * Math.PI) * 16
    d += (i === 0 ? 'M' : 'L') + `${x},${10 + sag}`
  }
  wirePath.setAttribute('d', d)
  wirePath.setAttribute('stroke', 'rgba(80,60,40,0.3)')
  wirePath.setAttribute('stroke-width', '2')
  wirePath.setAttribute('fill', 'none')
  svg.appendChild(wirePath)
  lightsEl.appendChild(svg)

  for (let i = 0; i < bulbCount; i++) {
    const t = (i + 0.5) / bulbCount
    const x = t * window.innerWidth
    const sag = Math.sin(t * Math.PI) * 16
    const bulb = document.createElement('div')
    bulb.className = 'fairy-bulb'
    bulb.style.left = (x - 5) + 'px'
    bulb.style.top = (10 + sag) + 'px'
    bulb.style.background = bulbColors[i % bulbColors.length]
    bulb.style.boxShadow = `0 0 6px 2px ${bulbColors[i % bulbColors.length]}50`
    bulb.style.animationDelay = (i * 0.3) + 's'
    lightsEl.appendChild(bulb)
  }

  // --- Dust motes ---
  for (let i = 0; i < 10; i++) {
    const mote = document.createElement('div')
    mote.className = 'dust-mote'
    mote.style.left = (5 + Math.random() * 90) + '%'
    mote.style.bottom = -(Math.random() * 20) + '%'
    mote.style.animationDuration = (14 + Math.random() * 12) + 's'
    mote.style.animationDelay = (Math.random() * 12) + 's'
    mote.style.width = (2 + Math.random() * 3) + 'px'
    mote.style.height = mote.style.width
    menu.appendChild(mote)
  }

  // --- Picture frame drawings (canvas mini art) ---
  function drawKidArt(canvasId, drawFn) {
    const container = document.getElementById(canvasId)
    if (!container) return
    const c = document.createElement('canvas')
    const rect = container.getBoundingClientRect()
    c.width = 80; c.height = 80
    c.style.width = '100%'; c.style.height = '100%'
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fffef5'
    ctx.fillRect(0, 0, 80, 80)
    drawFn(ctx)
    container.appendChild(c)
  }

  // Drawing 1: House with sun
  drawKidArt('frame-art-1', ctx => {
    // grass
    ctx.fillStyle = '#4aaa55'
    ctx.fillRect(0, 55, 80, 25)
    // house
    ctx.fillStyle = '#e74c3c'
    ctx.fillRect(22, 32, 30, 23)
    // roof
    ctx.fillStyle = '#8b4513'
    ctx.beginPath(); ctx.moveTo(18, 35); ctx.lineTo(37, 14); ctx.lineTo(56, 35); ctx.closePath(); ctx.fill()
    // door
    ctx.fillStyle = '#8b6914'
    ctx.fillRect(33, 42, 8, 13)
    // window
    ctx.fillStyle = '#87ceeb'
    ctx.fillRect(26, 38, 6, 6)
    // sun
    ctx.fillStyle = '#feca57'
    ctx.beginPath(); ctx.arc(68, 12, 8, 0, Math.PI * 2); ctx.fill()
    // rays
    ctx.strokeStyle = '#feca57'; ctx.lineWidth = 1.5
    for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4
      ctx.beginPath()
      ctx.moveTo(68 + Math.cos(ang) * 10, 12 + Math.sin(ang) * 10)
      ctx.lineTo(68 + Math.cos(ang) * 14, 12 + Math.sin(ang) * 14)
      ctx.stroke()
    }
  })

  // Drawing 2: Rainbow with clouds
  drawKidArt('frame-art-2', ctx => {
    // sky
    ctx.fillStyle = '#e0f0ff'
    ctx.fillRect(0, 0, 80, 80)
    // grass
    ctx.fillStyle = '#4aaa55'
    ctx.fillRect(0, 60, 80, 20)
    // rainbow
    const colors = ['#ff6b6b','#ff9f43','#feca57','#26de81','#54a0ff','#a55eea']
    colors.forEach((col, i) => {
      ctx.beginPath()
      ctx.arc(40, 58, 34 - i * 4, Math.PI, 0)
      ctx.strokeStyle = col
      ctx.lineWidth = 3.5
      ctx.stroke()
    })
    // clouds
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(12, 52, 8, 0, Math.PI * 2); ctx.arc(18, 48, 6, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(66, 50, 7, 0, Math.PI * 2); ctx.arc(72, 46, 5, 0, Math.PI * 2); ctx.fill()
    // flower
    ctx.fillStyle = '#ff6b6b'
    for (let p = 0; p < 5; p++) {
      const a = p * Math.PI * 2 / 5
      ctx.beginPath(); ctx.arc(16 + Math.cos(a) * 4, 68 + Math.sin(a) * 4, 3, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = '#feca57'
    ctx.beginPath(); ctx.arc(16, 68, 2.5, 0, Math.PI * 2); ctx.fill()
    // stem
    ctx.strokeStyle = '#26de81'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(16, 72); ctx.lineTo(16, 78); ctx.stroke()
  })
})()
