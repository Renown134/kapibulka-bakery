'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const menu = Object.freeze([
  Object.freeze({ id: 'cinnamon-capybara', name: 'Коричная капибара' }),
  Object.freeze({ id: 'vanilla-croissant', name: 'Ванильный круассан' }),
  Object.freeze({ id: 'chocolate-croissant', name: 'Шоколадный круассан' })
]);
const indexPath = path.join(__dirname, 'index.html');
const port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);

function json(res, code, value) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(value));
}

function select(req, res) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    req.resume();
    json(res, 415, { ok: false, message: 'Отправьте JSON с полем id.' });
    return;
  }
  let body = '';
  let size = 0;
  let tooLarge = false;
  req.setEncoding('utf8');
  req.on('data', chunk => {
    size += Buffer.byteLength(chunk);
    if (size > 8192) {
      if (!tooLarge) json(res, 413, { ok: false, message: 'Слишком большой запрос.' });
      tooLarge = true;
      body = '';
      return;
    }
    body += chunk;
  });
  req.on('end', () => {
    if (tooLarge) return;
    let input;
    try {
      input = JSON.parse(body);
    } catch {
      json(res, 400, { ok: false, message: 'Некорректный JSON.' });
      return;
    }
    const item = menu.find(entry => entry.id === input?.id);
    if (!item) {
      json(res, 400, { ok: false, message: 'Неизвестная позиция меню.' });
      return;
    }
    json(res, 200, {
      ok: true,
      item,
      message: `Вы выбрали: ${item.name}. Учебное подтверждение: выбор не сохраняется, настоящий заказ не создаётся.`
    });
  });
  req.on('error', () => {
    if (!res.headersSent && !res.destroyed) {
      json(res, 400, { ok: false, message: 'Не удалось прочитать запрос.' });
    }
  });
}

const server = http.createServer((req, res) => {
  const route = (req.url || '/').split('?')[0];
  if (req.method === 'GET' && (route === '/' || route === '/index.html')) {
    fs.readFile(indexPath, (error, html) => {
      if (error) {
        json(res, 500, { ok: false, message: 'Не удалось открыть страницу.' });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
    });
  } else if (req.method === 'GET' && route === '/api/menu') {
    json(res, 200, { ok: true, items: menu });
  } else if (req.method === 'POST' && route === '/api/selection') {
    select(req, res);
  } else if (req.method === 'POST' && route === '/api/reset') {
    req.resume();
    json(res, 200, { ok: true, message: 'Выбор сброшен. Можно выбрать булку снова.' });
  } else if (req.method === 'GET' && route === '/api/status') {
    json(res, 200, { ok: true, time: new Date().toISOString() });
  } else {
    req.resume();
    json(res, 404, { ok: false, message: 'Маршрут не найден.' });
  }
});

server.on('error', () => {
  console.error('Не удалось запустить сервер. Проверьте порт и повторите запуск.');
  process.exitCode = 1;
});

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('Порт должен быть целым числом от 0 до 65535.');
  process.exitCode = 1;
} else {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Капибулка запущена: http://0.0.0.0:${server.address().port}`);
  });
}
