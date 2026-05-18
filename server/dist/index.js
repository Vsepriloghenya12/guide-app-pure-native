"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const scheduler_1 = require("./services/scheduler");
const app = (0, app_1.createApp)();
const host = '0.0.0.0';
app.listen(config_1.config.port, host, () => {
    console.log(`Сервер сканера фьючерсов запущен на ${host}:${config_1.config.port}`);
    console.log(`Режим рынка: ${config_1.config.bybitCategory}, котировка: ${config_1.config.quoteCoin}`);
    console.log(`Таймфреймы: ${config_1.config.timeframes.join(', ')}`);
    console.log(`Сканируем до ${config_1.config.maxSymbolsToAnalyze} ликвидных монет за цикл.`);
    setTimeout(() => {
        scheduler_1.schedulerService.start();
    }, 3000);
});
const shutdown = () => {
    scheduler_1.schedulerService.stop();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
