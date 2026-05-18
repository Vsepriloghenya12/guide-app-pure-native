"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulerService = exports.SchedulerService = void 0;
const config_1 = require("../config");
const analysisService_1 = require("./analysisService");
const marketData_1 = require("./marketData");
const storage_1 = require("./storage");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const runWithConcurrency = async (items, limit, handler) => {
    const queue = [...items];
    const workers = Array.from({ length: Math.max(1, limit) }, async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) {
                return;
            }
            await handler(item);
            await sleep(350);
        }
    });
    await Promise.all(workers);
};
class SchedulerService {
    timer = null;
    running = false;
    start() {
        this.ensureTimer();
        if (storage_1.storageService.getAnalyzerState().scanEnabled) {
            this.runCycle().catch((error) => {
                console.error('Первый запуск планировщика завершился ошибкой:', error);
            });
        }
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        storage_1.storageService.updateAnalyzerState({ isRunning: false });
    }
    pause() {
        this.stop();
        storage_1.storageService.updateAnalyzerState({
            scanEnabled: false,
            pausedAt: new Date().toISOString(),
            isRunning: false
        });
    }
    resume() {
        storage_1.storageService.updateAnalyzerState({
            scanEnabled: true,
            pausedAt: null,
            lastError: null
        });
        this.start();
    }
    isEnabled() {
        return storage_1.storageService.getAnalyzerState().scanEnabled;
    }
    async runNow() {
        if (!this.isEnabled()) {
            throw new Error('Сканер сейчас выключен. Сначала включите его.');
        }
        await this.runCycle();
    }
    ensureTimer() {
        if (this.timer) {
            return;
        }
        this.timer = setInterval(() => {
            if (!this.isEnabled()) {
                return;
            }
            this.runCycle().catch((error) => {
                console.error('Плановый цикл завершился ошибкой:', error);
            });
        }, config_1.config.scanIntervalMs);
    }
    async runCycle() {
        if (this.running || !this.isEnabled()) {
            return;
        }
        this.running = true;
        storage_1.storageService.updateAnalyzerState({ isRunning: true, lastError: null });
        const errors = [];
        const analyzedSymbols = new Set();
        try {
            const universe = await marketData_1.marketDataService.fetchUniverse();
            const timeframesByPriority = [...config_1.config.timeframes].sort((left, right) => Number(right) - Number(left));
            await runWithConcurrency(universe.items, 2, async (market) => {
                const snapshot = {
                    symbol: market.symbol,
                    rank24h: market.rank24h,
                    turnover24hUsd: market.turnover24hUsd,
                    volume24h: market.volume24h,
                    spreadPct: market.spreadPct,
                    lastPrice: market.lastPrice,
                    fundingRate: market.fundingRate
                };
                for (const timeframe of timeframesByPriority) {
                    try {
                        await analysisService_1.analysisService.analyze(snapshot, timeframe);
                        analyzedSymbols.add(market.symbol);
                    }
                    catch (error) {
                        const message = `${market.symbol}/${timeframe}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                        console.error(`Ошибка анализа ${message}`);
                        errors.push(message);
                    }
                }
            });
            const completedAt = new Date().toISOString();
            storage_1.storageService.updateUniverseState({
                fetchedAt: completedAt,
                totalSymbols: universe.totalSymbols,
                eligibleSymbols: universe.eligibleSymbols,
                analyzedSymbols: analyzedSymbols.size,
                topSymbols: universe.items.map((item) => item.symbol),
                minTurnoverUsd: config_1.config.minTurnover24hUsd,
                maxSymbolsToAnalyze: config_1.config.maxSymbolsToAnalyze
            });
            storage_1.storageService.updateAnalyzerState({
                lastRunAt: completedAt,
                runCount: storage_1.storageService.getAnalyzerState().runCount + 1,
                lastError: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown scheduler error';
            storage_1.storageService.updateAnalyzerState({ lastError: message });
            throw error;
        }
        finally {
            this.running = false;
            storage_1.storageService.updateAnalyzerState({ isRunning: false });
        }
    }
}
exports.SchedulerService = SchedulerService;
exports.schedulerService = new SchedulerService();
