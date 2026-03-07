const GAME_LABELS = {
  bubblePop: 'Bubble Pop game — tap bubbles to pop them',
  feedAnimal: 'Feed the Animal game — drag food to feed the animals',
  colorMatch: 'Color Match game — tap the matching color',
  fireflies: 'Fireflies game — catch the fireflies',
  hideAndSeek: 'Hide and Seek game — find the hidden animals',
  cleanTheMess: 'Clean the Mess game — scrub to clean up',
  balloonRace: 'Balloon Race game — tap to launch balloons',
  shapeBuilder: 'Shape Builder game — drag shapes into place',
  babyShark: 'Baby Shark game — guide the shark to eat fish',
  puppyFetch: 'Puppy Fetch game — throw the ball for the puppy',
  elephantSplash: 'Elephant Splash game — spray water at targets',
  monsterTruck: 'Monster Truck game — tap to jump the truck',
}

export class GameManager {

  constructor(ctx, input) {
    this.ctx = ctx
    this.input = input
    this.currentGame = null
  }

  async load(id) {
    if (this.currentGame?.destroy)
      this.currentGame.destroy()

    // Show loading state
    const ctx = this.ctx
    const cw = ctx.canvas.width
    const ch = ctx.canvas.height
    ctx.fillStyle = '#2c1654'
    ctx.fillRect(0, 0, cw, ch)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 28px "Baloo 2", cursive'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Loading...', cw / 2, ch / 2)

    // Update canvas ARIA label for screen readers
    ctx.canvas.setAttribute('aria-label', GAME_LABELS[id] || 'Game loading')

    try {
      const module = await import(`../games/${id}.js`)
      this.currentGame = module.default

      this.currentGame.start({
        ctx: this.ctx,
        input: this.input,
        w: this.ctx.canvas.width,
        h: this.ctx.canvas.height
      })
    } catch (err) {
      console.error(`Failed to load game: ${id}`, err)
      this.currentGame = null
      window.goHome()
    }
  }

  unload() {
    if (this.currentGame?.destroy)
      this.currentGame.destroy()
    this.currentGame = null
    this.ctx.canvas.setAttribute('aria-label', 'Game canvas')
  }

  update(dt) {
    this.currentGame?.update?.(dt)
  }

  render() {
    const ctx = this.ctx
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    this.currentGame?.render?.()
    ctx.globalAlpha = 1
  }
}
