export function startLoop(update) {
  let last = 0

  function frame(t) {
    const dt = Math.min((t - last) / 1000, 0.05)
    last = t
    update(dt)
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}
