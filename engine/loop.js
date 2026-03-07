export function startLoop(update) {
  let last = -1

  function frame(t) {
    if (last < 0) { last = t; requestAnimationFrame(frame); return }
    const dt = Math.min((t - last) / 1000, 0.05)
    last = t
    update(dt)
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}
