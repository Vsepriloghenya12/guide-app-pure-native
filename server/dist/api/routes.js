"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const config_1 = require("../config");
const aiAnalysisService_1 = require("../services/aiAnalysisService");
const backtestService_1 = require("../services/backtestService");
const paperTradingService_1 = require("../services/paperTradingService");
const strategy_1 = require("../services/strategy");
const storage_1 = require("../services/storage");
const scheduler_1 = require("../services/scheduler");
const pushNotificationService_1 = require("../services/pushNotificationService");
exports.apiRouter = (0, express_1.Router)();
const recommendationWeight = {
    BUY_NOW: 3,
    WAIT: 2,
    EXIT: 1
};
const sortSignals = (left, right) => {
    const recommendationDiff = recommendationWeight[right.recommendation] - recommendationWeight[left.recommendation];
    if (recommendationDiff !== 0) {
        return recommendationDiff;
    }
    const confidenceDiff = right.confidence - left.confidence;
    if (confidenceDiff !== 0) {
        return confidenceDiff;
    }
    const turnoverDiff = right.market.turnover24hUsd - left.market.turnover24hUsd;
    if (turnoverDiff !== 0) {
        return turnoverDiff;
    }
    return left.symbol.localeCompare(right.symbol);
};
exports.apiRouter.get('/health', (_request, response) => {
    response.json({
        ok: true,
        config: {
            scanIntervalMs: config_1.config.scanIntervalMs,
            bybitCategory: config_1.config.bybitCategory,
            accountSizeUsd: config_1.config.accountSizeUsd,
            riskPerTradePct: config_1.config.riskPerTradePct,
            minConfidenceActionable: config_1.config.minConfidenceActionable,
            openAiModel: config_1.config.openAiModel,
            aiAnalysisEnabled: config_1.config.aiAnalysisEnabled,
            aiAnalyzeHoldSignals: config_1.config.aiAnalyzeHoldSignals,
            maxSymbolsToAnalyze: config_1.config.maxSymbolsToAnalyze,
            minTurnover24hUsd: config_1.config.minTurnover24hUsd,
            maxSpreadPct: config_1.config.maxSpreadPct,
            timeframes: config_1.config.timeframes,
            backtestMaxSymbols: config_1.config.backtestMaxSymbols,
            backtestCandles: config_1.config.backtestCandles,
            pushEnabled: config_1.config.pushEnabled,
            pushMinRepeatMs: config_1.config.pushMinRepeatMs
        },
        analyzer: storage_1.storageService.getAnalyzerState(),
        universe: storage_1.storageService.getUniverseState(),
        ai: aiAnalysisService_1.aiAnalysisService.getStatus(),
        paper: paperTradingService_1.paperTradingService.getState().summary,
        backtest: backtestService_1.backtestService.getState().summary,
        push: pushNotificationService_1.pushNotificationService.getStatus()
    });
});
exports.apiRouter.get('/signals', (request, response) => {
    const limit = Number(request.query.limit ?? 80);
    const symbol = typeof request.query.symbol === 'string' ? request.query.symbol : undefined;
    const timeframe = typeof request.query.timeframe === 'string' ? request.query.timeframe : undefined;
    const recommendation = typeof request.query.recommendation === 'string' ? request.query.recommendation.toUpperCase() : undefined;
    const filtered = storage_1.storageService
        .getSignals()
        .filter((item) => (symbol ? item.symbol === symbol : true))
        .filter((item) => (timeframe ? item.timeframe === timeframe : true))
        .filter((item) => (recommendation ? item.recommendation === recommendation : true))
        .slice(0, limit);
    response.json({
        count: filtered.length,
        items: filtered
    });
});
exports.apiRouter.get('/signals/latest', (_request, response) => {
    const latestMap = new Map();
    for (const item of storage_1.storageService.getSignals()) {
        const key = `${item.symbol}:${item.timeframe}`;
        if (!latestMap.has(key)) {
            latestMap.set(key, item);
        }
    }
    response.json({
        items: Array.from(latestMap.values()).sort(sortSignals)
    });
});
exports.apiRouter.get('/opportunities', (_request, response) => {
    const latestMap = new Map();
    for (const item of storage_1.storageService.getSignals()) {
        const key = `${item.symbol}:${item.timeframe}`;
        if (!latestMap.has(key)) {
            latestMap.set(key, item);
        }
    }
    const latest = Array.from(latestMap.values()).sort(sortSignals);
    response.json({
        bestIdea: latest.find((item) => item.recommendation === 'BUY_NOW') ?? latest.find((item) => item.recommendation === 'WAIT') ?? null,
        buyNow: latest.filter((item) => item.recommendation === 'BUY_NOW').slice(0, 8),
        wait: latest.filter((item) => item.recommendation === 'WAIT').slice(0, 12),
        exit: latest.filter((item) => item.recommendation === 'EXIT').slice(0, 12)
    });
});
exports.apiRouter.get('/overview', (_request, response) => {
    const latestMap = new Map();
    for (const item of storage_1.storageService.getSignals()) {
        const key = `${item.symbol}:${item.timeframe}`;
        if (!latestMap.has(key)) {
            latestMap.set(key, item);
        }
    }
    const latestSignals = Array.from(latestMap.values());
    const summary = latestSignals.reduce((accumulator, item) => {
        accumulator.total += 1;
        accumulator[item.recommendation] += 1;
        if (item.aiAnalysis?.status === 'READY') {
            accumulator.aiReady += 1;
        }
        return accumulator;
    }, {
        total: 0,
        BUY_NOW: 0,
        WAIT: 0,
        EXIT: 0,
        aiReady: 0
    });
    response.json({
        summary,
        analyzer: storage_1.storageService.getAnalyzerState(),
        universe: storage_1.storageService.getUniverseState(),
        risk: {
            accountSizeUsd: config_1.config.accountSizeUsd,
            riskPerTradePct: config_1.config.riskPerTradePct,
            minConfidenceActionable: config_1.config.minConfidenceActionable
        },
        ai: aiAnalysisService_1.aiAnalysisService.getStatus(),
        timeframes: config_1.config.timeframes,
        paper: paperTradingService_1.paperTradingService.getState().summary,
        backtest: backtestService_1.backtestService.getState().summary,
        push: pushNotificationService_1.pushNotificationService.getStatus()
    });
});
exports.apiRouter.get('/strategy', (_request, response) => {
    response.json({
        rules: strategy_1.strategyRules,
        meta: strategy_1.strategyMeta
    });
});
exports.apiRouter.get('/ai/status', (_request, response) => {
    response.json(aiAnalysisService_1.aiAnalysisService.getStatus());
});
exports.apiRouter.get('/push/status', (_request, response) => {
    response.json(pushNotificationService_1.pushNotificationService.getStatus());
});
exports.apiRouter.get('/push/public-key', (_request, response) => {
    response.json({
        enabled: pushNotificationService_1.pushNotificationService.getStatus().enabled,
        publicKey: pushNotificationService_1.pushNotificationService.getPublicKey()
    });
});
exports.apiRouter.post('/push/subscribe', (request, response) => {
    try {
        const subscription = pushNotificationService_1.pushNotificationService.subscribe(request.body, request.get('user-agent') ?? null);
        response.json({ ok: true, subscriptionId: subscription.id, status: pushNotificationService_1.pushNotificationService.getStatus() });
    }
    catch (error) {
        response.status(400).json({
            ok: false,
            message: error instanceof Error ? error.message : 'Не удалось включить push-уведомления'
        });
    }
});
exports.apiRouter.post('/push/unsubscribe', (request, response) => {
    const endpoint = typeof request.body?.endpoint === 'string' ? request.body.endpoint : undefined;
    pushNotificationService_1.pushNotificationService.unsubscribe(endpoint);
    response.json({ ok: true, status: pushNotificationService_1.pushNotificationService.getStatus() });
});
exports.apiRouter.post('/push/test', async (_request, response) => {
    try {
        const result = await pushNotificationService_1.pushNotificationService.sendTest();
        response.json({ ok: true, ...result, status: pushNotificationService_1.pushNotificationService.getStatus() });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            message: error instanceof Error ? error.message : 'Не удалось отправить тестовое push-уведомление'
        });
    }
});
exports.apiRouter.get('/export/full', (_request, response) => {
    const signals = storage_1.storageService.getSignals();
    const paper = paperTradingService_1.paperTradingService.getState();
    const backtest = backtestService_1.backtestService.getState();
    const analyzer = storage_1.storageService.getAnalyzerState();
    const universe = storage_1.storageService.getUniverseState();
    const generatedAt = new Date().toISOString();
    const payload = {
        exportedAt: generatedAt,
        app: {
            name: 'ai-futures-live-demo-russian',
            purpose: 'Сигналы рынка + демо-счёт + полная статистика',
            formatVersion: 1
        },
        config: {
            scanIntervalMs: config_1.config.scanIntervalMs,
            bybitCategory: config_1.config.bybitCategory,
            accountSizeUsd: config_1.config.accountSizeUsd,
            riskPerTradePct: config_1.config.riskPerTradePct,
            minConfidenceActionable: config_1.config.minConfidenceActionable,
            maxSymbolsToAnalyze: config_1.config.maxSymbolsToAnalyze,
            minTurnover24hUsd: config_1.config.minTurnover24hUsd,
            maxSpreadPct: config_1.config.maxSpreadPct,
            timeframes: config_1.config.timeframes,
            paperStartingBalanceUsd: config_1.config.paperStartingBalanceUsd,
            simulationFeePct: config_1.config.simulationFeePct,
            pushEnabled: config_1.config.pushEnabled,
            pushMinRepeatMs: config_1.config.pushMinRepeatMs
        },
        summary: {
            analyzer,
            universe,
            paper: paper.summary,
            backtest: backtest.summary,
            push: pushNotificationService_1.pushNotificationService.getStatus(),
            signalsCount: signals.length,
            latestSignalsCount: new Set(signals.map((item) => `${item.symbol}:${item.timeframe}`)).size
        },
        signals,
        paper,
        backtest
    };
    const safeStamp = generatedAt.replace(/[:.]/g, '-');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="full-statistics-${safeStamp}.json"`);
    response.status(200).send(JSON.stringify(payload, null, 2));
});
exports.apiRouter.get('/paper', (_request, response) => {
    response.json(paperTradingService_1.paperTradingService.getState());
});
exports.apiRouter.get('/scanner', (_request, response) => {
    const analyzer = storage_1.storageService.getAnalyzerState();
    response.json({
        enabled: analyzer.scanEnabled,
        isRunning: analyzer.isRunning,
        pausedAt: analyzer.pausedAt,
        lastRunAt: analyzer.lastRunAt,
        runCount: analyzer.runCount
    });
});
exports.apiRouter.post('/scanner/toggle', (request, response) => {
    const enabled = Boolean(request.body?.enabled);
    if (enabled) {
        scheduler_1.schedulerService.resume();
    }
    else {
        scheduler_1.schedulerService.pause();
    }
    const analyzer = storage_1.storageService.getAnalyzerState();
    response.json({
        ok: true,
        enabled: analyzer.scanEnabled,
        isRunning: analyzer.isRunning,
        pausedAt: analyzer.pausedAt,
        lastRunAt: analyzer.lastRunAt,
        runCount: analyzer.runCount
    });
});
exports.apiRouter.post('/analyze/now', async (_request, response) => {
    try {
        await scheduler_1.schedulerService.runNow();
        response.json({ ok: true });
    }
    catch (error) {
        response.status(500).json({
            ok: false,
            message: error instanceof Error ? error.message : 'Ошибка ручного запуска анализа'
        });
    }
});
exports.apiRouter.post('/paper/reset', (_request, response) => {
    response.json(paperTradingService_1.paperTradingService.reset());
});
exports.apiRouter.get('/backtest', (_request, response) => {
    response.json(backtestService_1.backtestService.getState());
});
exports.apiRouter.post('/backtest/run', async (request, response) => {
    try {
        const body = (request.body ?? {});
        const result = await backtestService_1.backtestService.run({
            maxSymbols: body.maxSymbols,
            candles: body.candles,
            warmup: body.warmup,
            maxHoldCandles: body.maxHoldCandles,
            timeframes: body.timeframes
        });
        response.json({ ok: true, result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Неизвестная ошибка бэктеста';
        response.status(500).json({ ok: false, message });
    }
});
