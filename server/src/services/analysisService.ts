
import crypto from 'node:crypto';
import { buildIndicatorSnapshot, evaluateSignal } from '../utils/indicators';
import { MarketSnapshot, SignalRecord } from '../types';
import { aiAnalysisService } from './aiAnalysisService';
import { marketDataService } from './marketData';
import { paperTradingService } from './paperTradingService';
import { storageService } from './storage';
import { pushNotificationService } from './pushNotificationService';

export class AnalysisService {
  public async analyze(market: MarketSnapshot, timeframe: string): Promise<SignalRecord> {
    const candles = await marketDataService.fetchCandles(market.symbol, timeframe, 260);

    if (candles.length < 220) {
      throw new Error(`Недостаточно свечей для ${market.symbol}/${timeframe}`);
    }

    const price = candles.at(-1)?.close ?? market.lastPrice;
    const latestCandle = candles.at(-1);
    const indicators = buildIndicatorSnapshot(candles);
    const decision = evaluateSignal(price, indicators, market, timeframe);

    const record: SignalRecord = {
      id: crypto.randomUUID(),
      symbol: market.symbol,
      timeframe,
      signal: decision.signal,
      recommendation: decision.recommendation,
      confidence: Number(decision.confidence.toFixed(4)),
      score: Number(decision.score.toFixed(4)),
      price,
      candle: latestCandle,
      createdAt: new Date().toISOString(),
      regime: decision.regime,
      setup: decision.setup,
      actionable: decision.actionable,
      headline: decision.headline,
      shortText: decision.shortText,
      reason: decision.reason,
      indicators: {
        emaFast: Number(indicators.emaFast.toFixed(4)),
        emaMedium: Number(indicators.emaMedium.toFixed(4)),
        emaTrend: Number(indicators.emaTrend.toFixed(4)),
        rsi: Number(indicators.rsi.toFixed(2)),
        atr: Number(indicators.atr.toFixed(4)),
        adx: Number(indicators.adx.toFixed(2)),
        momentumPct: Number(indicators.momentumPct.toFixed(3)),
        volatilityPct: Number(indicators.volatilityPct.toFixed(3)),
        volumeRatio: Number(indicators.volumeRatio.toFixed(3)),
        swingHigh20: Number(indicators.swingHigh20.toFixed(4)),
        swingLow20: Number(indicators.swingLow20.toFixed(4)),
        trendGapPct: Number(indicators.trendGapPct.toFixed(3))
      },
      market: {
        ...market,
        lastPrice: Number(price.toFixed(8)),
        turnover24hUsd: Number(market.turnover24hUsd.toFixed(2)),
        volume24h: Number(market.volume24h.toFixed(2)),
        spreadPct: Number(market.spreadPct.toFixed(4)),
        fundingRate: market.fundingRate !== null ? Number(market.fundingRate.toFixed(6)) : null
      },
      tradePlan: decision.tradePlan
        ? {
            entry: Number(decision.tradePlan.entry.toFixed(8)),
            entryMin: Number(decision.tradePlan.entryMin.toFixed(8)),
            entryMax: Number(decision.tradePlan.entryMax.toFixed(8)),
            triggerPrice:
              decision.tradePlan.triggerPrice !== null ? Number(decision.tradePlan.triggerPrice.toFixed(8)) : null,
            stopLoss: Number(decision.tradePlan.stopLoss.toFixed(8)),
            takeProfit1: Number(decision.tradePlan.takeProfit1.toFixed(8)),
            takeProfit2: Number(decision.tradePlan.takeProfit2.toFixed(8)),
            riskRewardRatio: Number(decision.tradePlan.riskRewardRatio.toFixed(2)),
            riskAmountUsd: Number(decision.tradePlan.riskAmountUsd.toFixed(2)),
            suggestedPositionUnits: Number(decision.tradePlan.suggestedPositionUnits.toFixed(6)),
            invalidation: decision.tradePlan.invalidation,
            entryComment: decision.tradePlan.entryComment,
            exitComment: decision.tradePlan.exitComment
          }
        : null,
      aiAnalysis: null
    };

    record.aiAnalysis = await aiAnalysisService.analyzeSignal(record);

    storageService.saveSignal(record);
    paperTradingService.processSignal(record);
    void pushNotificationService.notifySignal(record).catch((error) => {
      console.error('Ошибка отправки push-уведомления по сигналу:', error);
    });
    return record;
  }
}

export const analysisService = new AnalysisService();
