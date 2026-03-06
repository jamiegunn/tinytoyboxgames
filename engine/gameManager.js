export class GameManager {

  constructor(ctx, input) {
    this.ctx = ctx
    this.input = input
    this.currentGame = null
  }

  async load(id) {
    if (this.currentGame?.destroy)
      this.currentGame.destroy()

    const module = await import(`../games/${id}.js`)
    this.currentGame = module.default

    this.currentGame.start({
      ctx: this.ctx,
      input: this.input,
      w: window.innerWidth,
      h: window.innerHeight
    })
  }

  unload() {
    if (this.currentGame?.destroy)
      this.currentGame.destroy()
    this.currentGame = null
  }

  update(dt) {
    this.currentGame?.update?.(dt)
  }

  render() {
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    this.currentGame?.render?.()
  }
}
