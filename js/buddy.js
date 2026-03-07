// Music box toggle
window.toggleMusicBox = function toggleMusicBox() {
  if (window._toyboxMusic) window._toyboxMusic.toggle()
};

// Buddy owl behavior
;(function() {
  const buddy = document.getElementById('buddy')
  const thought = document.getElementById('buddy-thought')
  const thoughtIcon = document.getElementById('thought-icon')
  const hint = document.getElementById('buddy-hint')
  const tapHand = buddy.querySelector('.buddy-tap-hand')
  const point = document.getElementById('buddy-point')
  const toys = document.querySelectorAll('.toy')
  const rows = document.querySelectorAll('.shelf-row')
  let hasPlayed = false
  let currentRowIdx = -1

  const SUGGEST_ICONS = ['🫧', '🐸', '🎨', '🪲', '🌳', '🧽', '🎈', '🔷', '🦈', '🐶', '🐘', '🚛']
  let suggestTimer = null
  let moveTimer = null
  let currentSuggestion = null

  function sayTapAToy() {
    //TODO: speech disabled for now
  }

  if (window.speechSynthesis) {
    speechSynthesis.getVoices()
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices()
  }

  function moveToRandomRow() {
    let newIdx
    do { newIdx = Math.floor(Math.random() * rows.length) } while (newIdx === currentRowIdx && rows.length > 1)
    currentRowIdx = newIdx
    const row = rows[currentRowIdx]
    row.appendChild(buddy)
    if (Math.random() < 0.5) { buddy.style.left = '-110px'; buddy.style.right = '' }
    else { buddy.style.left = ''; buddy.style.right = '-110px' }
    buddy.style.top = '0'
    buddy.classList.remove('pop-in'); buddy.offsetHeight; buddy.classList.add('pop-in')
    if (!hasPlayed) {
      sayTapAToy(); hint.style.opacity = '1'; tapHand.style.opacity = '1'
      setTimeout(() => { hint.style.opacity = '0.6' }, 3000)
    }
    scheduleMoveRow()
  }

  function scheduleMoveRow() {
    clearTimeout(moveTimer)
    moveTimer = setTimeout(moveToRandomRow, 10000 + Math.random() * 5000)
  }

  function suggest() {
    if (buddy.style.display === 'none') return
    const row = rows[currentRowIdx] || rows[0]
    const rowToys = row.querySelectorAll('.toy')
    if (rowToys.length === 0) return
    const localIdx = Math.floor(Math.random() * rowToys.length)
    const toy = rowToys[localIdx]
    currentSuggestion = toy
    const globalIdx = Array.from(toys).indexOf(toy)
    thoughtIcon.textContent = SUGGEST_ICONS[globalIdx] || '⭐'
    thought.style.opacity = '1'; thought.style.transform = 'translateX(-50%) scale(1)'
    const rect = toy.getBoundingClientRect()
    point.style.left = (rect.left + rect.width / 2 - 20) + 'px'
    point.style.top = (rect.top + rect.height / 2 - 20) + 'px'
    point.style.opacity = '1'
    toy.style.animation = 'none'; toy.style.transform = 'scale(1.12) rotate(-3deg)'
    setTimeout(() => { toy.style.transform = ''; toy.style.animation = '' }, 2000)
    setTimeout(() => {
      thought.style.opacity = '0'; thought.style.transform = 'translateX(-50%) scale(0.6)'
      point.style.opacity = '0'; currentSuggestion = null
    }, 3500)
    scheduleSuggest()
  }

  function scheduleSuggest() {
    clearTimeout(suggestTimer)
    suggestTimer = setTimeout(suggest, 6000 + Math.random() * 4000)
  }

  window.buddyTapped = function() {
    buddy.classList.add('excited')
    setTimeout(() => buddy.classList.remove('excited'), 1200)
    sayTapAToy()
    if (currentSuggestion) { currentSuggestion.click(); return }
    suggest()
  }

  window.addEventListener('game:start', () => {
    buddy.style.display = 'none'; point.style.opacity = '0'; thought.style.opacity = '0'
    clearTimeout(suggestTimer); clearTimeout(moveTimer)
    if (window.speechSynthesis) speechSynthesis.cancel()
    window._musicWasPlaying = window._toyboxMusic && window._toyboxMusic.isPlaying()
    if (window._toyboxMusic) window._toyboxMusic.stop()
    if (!hasPlayed) { hasPlayed = true; hint.style.display = 'none'; tapHand.style.display = 'none' }
  })

  window.addEventListener('game:home', () => {
    buddy.style.display = ''; moveToRandomRow(); scheduleSuggest()
    if (window._musicWasPlaying && window._toyboxMusic) window._toyboxMusic.start()
  })

  setTimeout(() => { moveToRandomRow(); scheduleSuggest() }, 1500)
})()
