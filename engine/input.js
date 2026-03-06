export class Input {

  constructor(canvas) {
    this.canvas = canvas
    this.tapHandlers = []
    this.dragMoveHandlers = []
    this.dragEndHandlers = []
    this.dragging = false

    canvas.addEventListener("touchstart", e => {
      e.preventDefault()
      const t = e.touches[0]
      const [x, y] = this._toCanvas(t.clientX, t.clientY)
      this.dragging = true
      this.tapHandlers.forEach(h => h(x, y))
      this.dragMoveHandlers.forEach(h => h(x, y))
    }, { passive: false })

    canvas.addEventListener("touchmove", e => {
      e.preventDefault()
      if (!this.dragging) return
      const t = e.touches[0]
      const [x, y] = this._toCanvas(t.clientX, t.clientY)
      this.dragMoveHandlers.forEach(h => h(x, y))
    }, { passive: false })

    canvas.addEventListener("touchend", e => {
      if (this.dragging) {
        this.dragging = false
        this.dragEndHandlers.forEach(h => h())
      }
    })

    canvas.addEventListener("mousedown", e => {
      const [x, y] = this._toCanvas(e.clientX, e.clientY)
      this.dragging = true
      this.tapHandlers.forEach(h => h(x, y))
      this.dragMoveHandlers.forEach(h => h(x, y))
    })

    canvas.addEventListener("mousemove", e => {
      if (!this.dragging) return
      const [x, y] = this._toCanvas(e.clientX, e.clientY)
      this.dragMoveHandlers.forEach(h => h(x, y))
    })

    canvas.addEventListener("mouseup", () => {
      if (this.dragging) {
        this.dragging = false
        this.dragEndHandlers.forEach(h => h())
      }
    })
  }

  // Convert screen coordinates to canvas (virtual) coordinates
  _toCanvas(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height
    return [
      (screenX - rect.left) * scaleX,
      (screenY - rect.top) * scaleY
    ]
  }

  onTap(fn) { this.tapHandlers.push(fn) }
  offTap(fn) { this.tapHandlers = this.tapHandlers.filter(h => h !== fn) }

  onDragMove(fn) { this.dragMoveHandlers.push(fn) }
  offDragMove(fn) { this.dragMoveHandlers = this.dragMoveHandlers.filter(h => h !== fn) }

  onDragEnd(fn) { this.dragEndHandlers.push(fn) }
  offDragEnd(fn) { this.dragEndHandlers = this.dragEndHandlers.filter(h => h !== fn) }
}
