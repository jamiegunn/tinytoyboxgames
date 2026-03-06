import { GameManager } from "./engine/gameManager.js"
import { startLoop } from "./engine/loop.js"
import { Input } from "./engine/input.js"

const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

function resize() {
  const dw = window.innerWidth
  const dh = window.innerHeight

  // Scale factor: on small screens, create a larger virtual canvas
  // so game elements appear proportionally smaller.
  // Use the smaller dimension to determine scale, works for both orientations.
  const minDim = Math.min(dw, dh)
  const maxDim = Math.max(dw, dh)

  // Base: 400px min dimension = scale 1.0 (comfortable on phones)
  // Clamp so we don't over-shrink or over-enlarge
  const S = Math.max(0.5, Math.min(minDim / 400, 1.0))

  if (S >= 1) {
    // Desktop / tablet — no scaling needed
    canvas.width = dw
    canvas.height = dh
  } else {
    // Mobile — virtual canvas is larger than physical screen
    canvas.width = Math.round(dw / S)
    canvas.height = Math.round(dh / S)
  }

  // CSS fills the viewport
  canvas.style.width = dw + 'px'
  canvas.style.height = dh + 'px'
}
resize()
window.addEventListener("resize", resize)

const input = new Input(canvas)
const gameManager = new GameManager(ctx, input)

startLoop((dt) => {
  gameManager.update(dt)
  gameManager.render()
})

window.startGame = (id) => {
  document.getElementById("menu").style.display = "none"
  document.getElementById("back-btn").style.display = "flex"
  resize() // recalc in case orientation changed
  gameManager.load(id)
}

window.goHome = () => {
  gameManager.unload()
  document.getElementById("menu").style.display = "flex"
  document.getElementById("back-btn").style.display = "none"
}
