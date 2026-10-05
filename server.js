const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const urlParts = req.url.split('?');
  const rawPath = decodeURIComponent(urlParts[0]);
  const queryString = urlParts[1] ? '?' + urlParts[1] : '';

  // Clean URL redirection: if user requests *.html, redirect to clean URL
  if (rawPath === '/index.html') {
    res.writeHead(301, { 'Location': '/' + queryString });
    res.end();
    return;
  }
  if (rawPath.endsWith('.html')) {
    const cleanUrl = rawPath.slice(0, -5) + queryString;
    res.writeHead(301, { 'Location': cleanUrl });
    res.end();
    return;
  }

  // Resolve file path
  let reqPath = rawPath;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let filePath = path.join(__dirname, reqPath);

  // If path has no extension and doesn't exist directly, check for .html version
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const htmlPath = filePath + '.html';
    if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
      filePath = htmlPath;
    }
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404: Файл не найден');
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const range = req.headers.range;

  // Support HTTP 206 Partial Content (Range requests) for audio/video seeking
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`
      });
      res.end();
      return;
    }

    const chunkSize = (end - start) + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

server.listen(PORT, () => {
  console.log(`-----------------------------------------------`);
  console.log(`[OK] Локальный сервер запущен: http://localhost:${PORT}`);
  console.log(`[OK] Страница музыки (Clean URL): http://localhost:${PORT}/music`);
  console.log(`[OK] Поддержка перемотки треков (HTTP 206 Range) активна`);
  console.log(`-----------------------------------------------`);
  console.log(`Открываю браузер...`);
  exec(`start http://localhost:${PORT}/music`);
});
