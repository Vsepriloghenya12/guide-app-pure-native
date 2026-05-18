import { createApp } from './app';
import { config } from './config';
import { schedulerService } from './services/scheduler';

const app = createApp();

const host = '0.0.0.0';

app.listen(config.port, host, () => {
  console.log(`Сервер сканера фьючерсов запущен на ${host}:${config.port}`);
  console.log(`Режим рынка: ${config.bybitCategory}, котировка: ${config.quoteCoin}`);
  console.log(`Таймфреймы: ${config.timeframes.join(', ')}`);
  console.log(`Сканируем до ${config.maxSymbolsToAnalyze} ликвидных монет за цикл.`);

  setTimeout(() => {
    schedulerService.start();
  }, 3000);
});

const shutdown = () => {
  schedulerService.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
