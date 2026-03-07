import { GameManager } from "./engine/gameManager.js"
import { startLoop } from "./engine/loop.js"
import { Input } from "./engine/input.js"
import { startGameMusic, stopGameMusic } from "./engine/gameMusic.js"

const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

function resize() {
  const dw = window.innerWidth
  const dh = window.innerHeight

  // Scale factor: on small screens, create a larger virtual canvas
  // so game elements appear proportionally smaller.
  // Use the smaller dimension to determine scale, works for both orientations.
  const minDim = Math.min(dw, dh)

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
  if (!gameManager.currentGame) return
  gameManager.update(dt)
  gameManager.render()
})

let firstGame = true
let inGame = false
const backBtn = document.getElementById("back-btn")
const gameStatus = document.getElementById("game-status")

window.startGame = (id) => {
  window.dispatchEvent(new CustomEvent('game:start', { detail: { id } }))
  document.getElementById("menu").style.display = "none"
  backBtn.style.display = "flex"
  if (firstGame) {
    firstGame = false
    backBtn.classList.add('first-show')
    backBtn.addEventListener('animationend', () => backBtn.classList.remove('first-show'), { once: true })
  }
  resize() // recalc in case orientation changed
  gameManager.load(id)
  startGameMusic(id)

  // Push one history entry only when entering a game from the menu
  if (!inGame) {
    history.pushState({ inGame: true }, '')
  }
  inGame = true
}

window.goHome = () => {
  if (!inGame) return
  inGame = false
  window.dispatchEvent(new CustomEvent('game:home'))
  stopGameMusic()
  gameManager.unload()
  document.getElementById("menu").style.display = "flex"
  backBtn.style.display = "none"
  canvas.setAttribute('aria-label', 'Game canvas')
  if (gameStatus) gameStatus.textContent = ''
}

window.addEventListener('popstate', () => {
  if (inGame) {
    goHome()
  }
})
