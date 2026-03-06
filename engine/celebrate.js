// Uses canvas-confetti loaded via CDN, rendered on a dedicated overlay canvas
let myConfetti = null

function getConfetti() {
  if (myConfetti) return myConfetti
  const el = document.getElementById("confetti-canvas")
  if (!el || typeof confetti !== "function") return null
  myConfetti = confetti.create(el, { resize: true })
  return myConfetti
}

export function celebrate() {
  const fire = getConfetti()
  if (!fire) return

  fire({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff"]
  })
}

export function celebrateBig() {
  const fire = getConfetti()
  if (!fire) return

  const end = Date.now() + 800

  ;(function burst() {
    fire({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff"]
    })
    fire({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff"]
    })
    if (Date.now() < end) requestAnimationFrame(burst)
  })()
}
