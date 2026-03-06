export class Input {

  constructor(canvas) {
    this.tapHandlers = []
    this.dragMoveHandlers = []
    this.dragEndHandlers = []
    this.dragging = false

    canvas.addEventListener("touchstart", e => {
      e.preventDefault()
      const t = e.touches[0]
      this.dragging = true
      this.tapHandlers.forEach(h => h(t.clientX, t.clientY))
      this.dragMoveHandlers.forEach(h => h(t.clientX, t.clientY))
    }, { passive: false })

    canvas.addEventListener("touchmove", e => {
      e.preventDefault()
      if (!this.dragging) return
      const t = e.touches[0]
      this.dragMoveHandlers.forEach(h => h(t.clientX, t.clientY))
    }, { passive: false })

    canvas.addEventListener("touchend", e => {
      if (this.dragging) {
        this.dragging = false
        this.dragEndHandlers.forEach(h => h())
      }
    })

    canvas.addEventListener("mousedown", e => {
      this.dragging = true
      this.tapHandlers.forEach(h => h(e.clientX, e.clientY))
      this.dragMoveHandlers.forEach(h => h(e.clientX, e.clientY))
    })

    canvas.addEventListener("mousemove", e => {
      if (!this.dragging) return
      this.dragMoveHandlers.forEach(h => h(e.clientX, e.clientY))
    })

    canvas.addEventListener("mouseup", () => {
      if (this.dragging) {
        this.dragging = false
        this.dragEndHandlers.forEach(h => h())
      }
    })
  }

  onTap(fn) { this.tapHandlers.push(fn) }
  offTap(fn) { this.tapHandlers = this.tapHandlers.filter(h => h !== fn) }

  onDragMove(fn) { this.dragMoveHandlers.push(fn) }
  offDragMove(fn) { this.dragMoveHandlers = this.dragMoveHandlers.filter(h => h !== fn) }

  onDragEnd(fn) { this.dragEndHandlers.push(fn) }
  offDragEnd(fn) { this.dragEndHandlers = this.dragEndHandlers.filter(h => h !== fn) }
}
