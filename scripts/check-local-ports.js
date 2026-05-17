const fs = require('fs');
const net = require('net');
const path = require('path');

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((accumulator, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) return accumulator;
      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function toPort(value, fallback) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
}

function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => resolve({ port, free: false, message: error.code === 'EADDRINUSE' ? 'занят' : error.message }));
    server.once('listening', () => server.close(() => resolve({ port, free: true })));
    server.listen(port, host);
  });
}

async function main() {
  const env = { ...readEnv(path.resolve(__dirname, '../.env')), ...process.env };
  const apiPort = toPort(env.PORT, 8080);
  const metroPort = toPort(env.EXPO_METRO_PORT, 8081);
  const checks = [
    { name: 'api', ...(await isPortFree(apiPort)) },
    { name: 'metro', ...(await isPortFree(metroPort)) }
  ];
  const busy = checks.filter((item) => !item.free);

  if (!busy.length) {
    console.log(`Локальные порты свободны: API ${apiPort}, Metro ${metroPort}.`);
    return;
  }

  console.error('Нельзя запустить локально: нужные порты уже заняты.');
  for (const item of busy) console.error(`- ${item.name}: порт ${item.port} ${item.message || 'занят'}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
