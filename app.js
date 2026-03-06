import { GameManager } from "./engine/gameManager.js"
import { startLoop } from "./engine/loop.js"
import { Input } from "./engine/input.js"

const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
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
  gameManager.load(id)
}

window.goHome = () => {
  gameManager.unload()
  document.getElementById("menu").style.display = "flex"
  document.getElementById("back-btn").style.display = "none"
}
