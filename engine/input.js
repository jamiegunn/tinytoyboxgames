export class Input {

  constructor(canvas) {
    this.tapHandlers = []

    canvas.addEventListener("touchstart", e => {
      e.preventDefault()
      const t = e.touches[0]
      this.tapHandlers.forEach(h => h(t.clientX, t.clientY))
    }, { passive: false })

    canvas.addEventListener("mousedown", e => {
      this.tapHandlers.forEach(h => h(e.clientX, e.clientY))
    })
  }

  onTap(fn) {
    this.tapHandlers.push(fn)
  }

  offTap(fn) {
    this.tapHandlers = this.tapHandlers.filter(h => h !== fn)
  }
}
