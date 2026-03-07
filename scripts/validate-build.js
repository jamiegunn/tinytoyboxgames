// Post-build validation: ensures dist/ contains all expected outputs
import { readdirSync, existsSync } from 'fs'

const errors = []

// Required HTML entry points
for (const file of ['dist/index.html', 'dist/toybox.html']) {
  if (!existsSync(file)) errors.push(`Missing: ${file}`)
}

// Each game should produce a chunk in dist/assets/
const GAMES = [
  'bubblePop', 'feedAnimal', 'colorMatch', 'fireflies',
  'hideAndSeek', 'cleanTheMess', 'balloonRace', 'shapeBuilder',
  'babyShark', 'puppyFetch', 'elephantSplash', 'monsterTruck'
]

const assets = existsSync('dist/assets') ? readdirSync('dist/assets') : []

for (const game of GAMES) {
  const found = assets.some(f => f.startsWith(game) && f.endsWith('.js'))
  if (!found) errors.push(`Missing game chunk: ${game}`)
}

// Should have at least one CSS file
const hasCSS = assets.some(f => f.endsWith('.css'))
if (!hasCSS) errors.push('Missing CSS output')

// Should have the confetti library copied to dist
if (!existsSync('dist/js/libs/confetti.min.js')) {
  errors.push('Missing: dist/js/libs/confetti.min.js')
}

if (errors.length > 0) {
  console.error('Build validation failed:')
  errors.forEach(e => console.error(`  - ${e}`))
  process.exit(1)
} else {
  console.log(`Build validated: ${GAMES.length} game chunks, HTML entries, CSS, and static assets present.`)
}
