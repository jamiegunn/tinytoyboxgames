const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 80
const DIST = path.join(__dirname, 'dist')

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}

function buildHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  }
}

function resolvePathname(url) {
  let pathname = decodeURIComponent((url || '/').split('?')[0])
  if (pathname === '/') return '/index.html'
  if (!path.extname(pathname)) return `${pathname}.html`
  return pathname
}

function sendNotFound(res) {
  res.writeHead(404, buildHeaders('text/plain; charset=utf-8'))
  res.end('Not found')
}

http.createServer((req, res) => {
  const pathname = resolvePathname(req.url)
  const filePath = path.resolve(DIST, `.${pathname}`)

  // Prevent directory traversal outside dist.
  if (!filePath.startsWith(DIST + path.sep) && filePath !== path.join(DIST, 'index.html')) {
    res.writeHead(403, buildHeaders('text/plain; charset=utf-8'))
    return res.end()
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
        return sendNotFound(res)
      }

      res.writeHead(500, buildHeaders('text/plain; charset=utf-8'))
      res.end('Server error')
    } else {
      const ext = path.extname(filePath)
      res.writeHead(200, buildHeaders(mime[ext] || 'application/octet-stream'))
      res.end(data)
    }
  })
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Serving on port ${PORT}`)
})
