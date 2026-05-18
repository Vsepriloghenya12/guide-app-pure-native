
import { Router } from 'express';
import { config } from '../config';
import { RecommendationType, SignalRecord } from '../types';
import { aiAnalysisService } from '../services/aiAnalysisService';
import { backtestService } from '../services/backtestService';
import { paperTradingService } from '../services/paperTradingService';
import { strategyMeta, strategyRules } from '../services/strategy';
import { storageService } from '../services/storage';
import { schedulerService } from '../services/scheduler';
import { pushNotificationService } from '../services/pushNotificationService';

export const apiRouter = Router();

const recommendationWeight: Record<RecommendationType, number> = {
  BUY_NOW: 3,
  WAIT: 2,
  EXIT: 1
};

const sortSignals = (left: SignalRecord, right: SignalRecord): number => {
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

apiRouter.get('/health', (_request, response) => {
  response.json({
    ok: true,
    config: {
      scanIntervalMs: config.scanIntervalMs,
      bybitCategory: config.bybitCategory,
      accountSizeUsd: config.accountSizeUsd,
      riskPerTradePct: config.riskPerTradePct,
      minConfidenceActionable: config.minConfidenceActionable,
      openAiModel: config.openAiModel,
      aiAnalysisEnabled: config.aiAnalysisEnabled,
      aiAnalyzeHoldSignals: config.aiAnalyzeHoldSignals,
      maxSymbolsToAnalyze: config.maxSymbolsToAnalyze,
      minTurnover24hUsd: config.minTurnover24hUsd,
      maxSpreadPct: config.maxSpreadPct,
      timeframes: config.timeframes,
      backtestMaxSymbols: config.backtestMaxSymbols,
      backtestCandles: config.backtestCandles,
      pushEnabled: config.pushEnabled,
      pushMinRepeatMs: config.pushMinRepeatMs
    },
    analyzer: storageService.getAnalyzerState(),
    universe: storageService.getUniverseState(),
    ai: aiAnalysisService.getStatus(),
    paper: paperTradingService.getState().summary,
    backtest: backtestService.getState().summary,
    push: pushNotificationService.getStatus()
  });
});

apiRouter.get('/signals', (request, response) => {
  const limit = Number(request.query.limit ?? 80);
  const symbol = typeof request.query.symbol === 'string' ? request.query.symbol : undefined;
  const timeframe = typeof request.query.timeframe === 'string' ? request.query.timeframe : undefined;
  const recommendation =
    typeof request.query.recommendation === 'string' ? request.query.recommendation.toUpperCase() : undefined;

  const filtered = storageService
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

apiRouter.get('/signals/latest', (_request, response) => {
  const latestMap = new Map<string, SignalRecord>();

  for (const item of storageService.getSignals()) {
    const key = `${item.symbol}:${item.timeframe}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, item);
    }
  }

  response.json({
    items: Array.from(latestMap.values()).sort(sortSignals)
  });
});

apiRouter.get('/opportunities', (_request, response) => {
  const latestMap = new Map<string, SignalRecord>();

  for (const item of storageService.getSignals()) {
    const key = `${item.symbol}:${item.timeframe}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, item);
    }
  }

  const latest = Array.from(latestMap.values()).sort(sortSignals);

  response.json({
    bestIdea:
      latest.find((item) => item.recommendation === 'BUY_NOW') ?? latest.find((item) => item.recommendation === 'WAIT') ?? null,
    buyNow: latest.filter((item) => item.recommendation === 'BUY_NOW').slice(0, 8),
    wait: latest.filter((item) => item.recommendation === 'WAIT').slice(0, 12),
    exit: latest.filter((item) => item.recommendation === 'EXIT').slice(0, 12)
  });
});

apiRouter.get('/overview', (_request, response) => {
  const latestMap = new Map<string, SignalRecord>();

  for (const item of storageService.getSignals()) {
    const key = `${item.symbol}:${item.timeframe}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, item);
    }
  }

  const latestSignals = Array.from(latestMap.values());

  const summary = latestSignals.reduce(
    (accumulator, item) => {
      accumulator.total += 1;
      accumulator[item.recommendation] += 1;
      if (item.aiAnalysis?.status === 'READY') {
        accumulator.aiReady += 1;
      }
      return accumulator;
    },
    {
      total: 0,
      BUY_NOW: 0,
      WAIT: 0,
      EXIT: 0,
      aiReady: 0
    }
  );

  response.json({
    summary,
    analyzer: storageService.getAnalyzerState(),
    universe: storageService.getUniverseState(),
    risk: {
      accountSizeUsd: config.accountSizeUsd,
      riskPerTradePct: config.riskPerTradePct,
      minConfidenceActionable: config.minConfidenceActionable
    },
    ai: aiAnalysisService.getStatus(),
    timeframes: config.timeframes,
    paper: paperTradingService.getState().summary,
    backtest: backtestService.getState().summary,
    push: pushNotificationService.getStatus()
  });
});

apiRouter.get('/strategy', (_request, response) => {
  response.json({
    rules: strategyRules,
    meta: strategyMeta
  });
});

apiRouter.get('/ai/status', (_request, response) => {
  response.json(aiAnalysisService.getStatus());
});




apiRouter.get('/push/status', (_request, response) => {
  response.json(pushNotificationService.getStatus());
});

apiRouter.get('/push/public-key', (_request, response) => {
  response.json({
    enabled: pushNotificationService.getStatus().enabled,
    publicKey: pushNotificationService.getPublicKey()
  });
});

apiRouter.post('/push/subscribe', (request, response) => {
  try {
    const subscription = pushNotificationService.subscribe(request.body, request.get('user-agent') ?? null);
    response.json({ ok: true, subscriptionId: subscription.id, status: pushNotificationService.getStatus() });
  } catch (error) {
    response.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Не удалось включить push-уведомления'
    });
  }
});

apiRouter.post('/push/unsubscribe', (request, response) => {
  const endpoint = typeof request.body?.endpoint === 'string' ? request.body.endpoint : undefined;
  pushNotificationService.unsubscribe(endpoint);
  response.json({ ok: true, status: pushNotificationService.getStatus() });
});

apiRouter.post('/push/test', async (_request, response) => {
  try {
    const result = await pushNotificationService.sendTest();
    response.json({ ok: true, ...result, status: pushNotificationService.getStatus() });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Не удалось отправить тестовое push-уведомление'
    });
  }
});

apiRouter.get('/export/full', (_request, response) => {
  const signals = storageService.getSignals();
  const paper = paperTradingService.getState();
  const backtest = backtestService.getState();
  const analyzer = storageService.getAnalyzerState();
  const universe = storageService.getUniverseState();
  const generatedAt = new Date().toISOString();

  const payload = {
    exportedAt: generatedAt,
    app: {
      name: 'ai-futures-live-demo-russian',
      purpose: 'Сигналы рынка + демо-счёт + полная статистика',
      formatVersion: 1
    },
    config: {
      scanIntervalMs: config.scanIntervalMs,
      bybitCategory: config.bybitCategory,
      accountSizeUsd: config.accountSizeUsd,
      riskPerTradePct: config.riskPerTradePct,
      minConfidenceActionable: config.minConfidenceActionable,
      maxSymbolsToAnalyze: config.maxSymbolsToAnalyze,
      minTurnover24hUsd: config.minTurnover24hUsd,
      maxSpreadPct: config.maxSpreadPct,
      timeframes: config.timeframes,
      paperStartingBalanceUsd: config.paperStartingBalanceUsd,
      simulationFeePct: config.simulationFeePct,
      pushEnabled: config.pushEnabled,
      pushMinRepeatMs: config.pushMinRepeatMs
    },
    summary: {
      analyzer,
      universe,
      paper: paper.summary,
      backtest: backtest.summary,
      push: pushNotificationService.getStatus(),
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

apiRouter.get('/paper', (_request, response) => {
  response.json(paperTradingService.getState());
});

apiRouter.get('/scanner', (_request, response) => {
  const analyzer = storageService.getAnalyzerState();
  response.json({
    enabled: analyzer.scanEnabled,
    isRunning: analyzer.isRunning,
    pausedAt: analyzer.pausedAt,
    lastRunAt: analyzer.lastRunAt,
    runCount: analyzer.runCount
  });
});

apiRouter.post('/scanner/toggle', (request, response) => {
  const enabled = Boolean(request.body?.enabled);

  if (enabled) {
    schedulerService.resume();
  } else {
    schedulerService.pause();
  }

  const analyzer = storageService.getAnalyzerState();
  response.json({
    ok: true,
    enabled: analyzer.scanEnabled,
    isRunning: analyzer.isRunning,
    pausedAt: analyzer.pausedAt,
    lastRunAt: analyzer.lastRunAt,
    runCount: analyzer.runCount
  });
});

apiRouter.post('/analyze/now', async (_request, response) => {
  try {
    await schedulerService.runNow();
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Ошибка ручного запуска анализа'
    });
  }
});

apiRouter.post('/paper/reset', (_request, response) => {
  response.json(paperTradingService.reset());
});

apiRouter.get('/backtest', (_request, response) => {
  response.json(backtestService.getState());
});

apiRouter.post('/backtest/run', async (request, response) => {
  try {
    const body = (request.body ?? {}) as Partial<{
      maxSymbols: number;
      candles: number;
      warmup: number;
      maxHoldCandles: number;
      timeframes: string[];
    }>;

    const result = await backtestService.run({
      maxSymbols: body.maxSymbols,
      candles: body.candles,
      warmup: body.warmup,
      maxHoldCandles: body.maxHoldCandles,
      timeframes: body.timeframes
    });

    response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка бэктеста';
    response.status(500).json({ ok: false, message });
  }
});
