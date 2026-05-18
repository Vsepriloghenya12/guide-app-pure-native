import { config } from '../config';
import {
  Candle,
  IndicatorSnapshot,
  MarketRegime,
  MarketSnapshot,
  RecommendationType,
  SetupType,
  SignalType,
  TradePlan
} from '../types';

const average = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const max = (values: number[]): number => (values.length > 0 ? Math.max(...values) : 0);
const min = (values: number[]): number => (values.length > 0 ? Math.min(...values) : 0);

export const calculateEMA = (values: number[], period: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const multiplier = 2 / (period + 1);
  let ema = values[0];

  for (let index = 1; index < values.length; index += 1) {
    ema = (values[index] - ema) * multiplier + ema;
  }

  return ema;
};

export const calculateRSI = (values: number[], period: number): number => {
  if (values.length <= period) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let index = values.length - period; index < values.length; index += 1) {
    const prev = values[index - 1];
    const current = values[index];
    const delta = current - prev;

    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) {
    return 100;
  }

  const relativeStrength = avgGain / avgLoss;
  return 100 - 100 / (1 + relativeStrength);
};

export const calculateATR = (candles: Candle[], period: number): number => {
  if (candles.length <= period) {
    return 0;
  }

  const trueRanges: number[] = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    const highLow = current.high - current.low;
    const highClose = Math.abs(current.high - previous.close);
    const lowClose = Math.abs(current.low - previous.close);
    trueRanges.push(Math.max(highLow, highClose, lowClose));
  }

  return average(trueRanges.slice(-period));
};

export const calculateADX = (candles: Candle[], period: number): number => {
  if (candles.length <= period + 1) {
    return 0;
  }

  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];

    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;

    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const highLow = current.high - current.low;
    const highClose = Math.abs(current.high - previous.close);
    const lowClose = Math.abs(current.low - previous.close);
    trueRanges.push(Math.max(highLow, highClose, lowClose));
  }

  if (trueRanges.length <= period) {
    return 0;
  }

  let smoothedTR = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0);
  let smoothedPlusDM = plusDMs.slice(0, period).reduce((sum, value) => sum + value, 0);
  let smoothedMinusDM = minusDMs.slice(0, period).reduce((sum, value) => sum + value, 0);

  const dxValues: number[] = [];

  for (let index = period; index < trueRanges.length; index += 1) {
    smoothedTR = smoothedTR - smoothedTR / period + trueRanges[index];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMs[index];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMs[index];

    if (smoothedTR === 0) {
      dxValues.push(0);
      continue;
    }

    const plusDI = (100 * smoothedPlusDM) / smoothedTR;
    const minusDI = (100 * smoothedMinusDM) / smoothedTR;
    const diSum = plusDI + minusDI;

    if (diSum === 0) {
      dxValues.push(0);
      continue;
    }

    const dx = (100 * Math.abs(plusDI - minusDI)) / diSum;
    dxValues.push(dx);
  }

  if (dxValues.length === 0) {
    return 0;
  }

  if (dxValues.length <= period) {
    return average(dxValues);
  }

  let adx = average(dxValues.slice(0, period));
  for (let index = period; index < dxValues.length; index += 1) {
    adx = ((adx * (period - 1)) + dxValues[index]) / period;
  }

  return adx;
};

export const calculateVolatilityPct = (values: number[], lookback = 20): number => {
  const sliced = values.slice(-(lookback + 1));
  if (sliced.length < 2) {
    return 0;
  }

  const returns = sliced.slice(1).map((value, index) => (value - sliced[index]) / sliced[index]);
  const mean = average(returns);
  const variance = average(returns.map((item) => (item - mean) ** 2));
  return Math.sqrt(variance) * 100;
};

export const buildIndicatorSnapshot = (candles: Candle[]): IndicatorSnapshot => {
  const closes = candles.map((candle) => candle.close);
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const volumes = candles.map((candle) => candle.volume);

  const lastClose = closes.at(-1) ?? 0;
  const previousClose = closes.at(-11) ?? closes.at(-2) ?? lastClose;
  const momentumPct = previousClose === 0 ? 0 : ((lastClose - previousClose) / previousClose) * 100;

  const volumeBaseline = average(volumes.slice(-21, -1));
  const lastVolume = volumes.at(-1) ?? 0;
  const volumeRatio = volumeBaseline > 0 ? lastVolume / volumeBaseline : 1;

  const previousHighs = highs.slice(-21, -1);
  const previousLows = lows.slice(-21, -1);

  const emaFast = calculateEMA(closes.slice(-80), 20);
  const emaMedium = calculateEMA(closes.slice(-140), 50);
  const emaTrend = calculateEMA(closes, 200);
  const trendGapPct = lastClose === 0 ? 0 : ((emaFast - emaTrend) / lastClose) * 100;

  return {
    emaFast,
    emaMedium,
    emaTrend,
    rsi: calculateRSI(closes, 14),
    atr: calculateATR(candles, 14),
    adx: calculateADX(candles, 14),
    momentumPct,
    volatilityPct: calculateVolatilityPct(closes, 20),
    volumeRatio,
    swingHigh20: max(previousHighs),
    swingLow20: min(previousLows),
    trendGapPct
  };
};

export interface DecisionResult {
  signal: SignalType;
  recommendation: RecommendationType;
  confidence: number;
  score: number;
  reason: string[];
  regime: MarketRegime;
  setup: SetupType;
  actionable: boolean;
  tradePlan: TradePlan | null;
  headline: string;
  shortText: string;
}

const buildTradePlan = (
  recommendation: RecommendationType,
  price: number,
  indicators: IndicatorSnapshot,
  setup: SetupType
): TradePlan | null => {
  const riskAmountUsd = config.accountSizeUsd * (config.riskPerTradePct / 100);
  const maxPositionNotionalUsd = config.accountSizeUsd * 1.15;
  const atrRisk = indicators.atr > 0 ? indicators.atr * 1.45 : price * 0.014;
  const minRiskDistance = Math.max(price * 0.008, atrRisk * 0.8);
  const maxRiskDistance = price * 0.04;

  if (riskAmountUsd <= 0 || price <= 0) {
    return null;
  }

  const buildPlanFromEntry = (entry: number, triggerPrice: number | null, entryComment: string): TradePlan | null => {
    const structuralStopCandidates = [
      indicators.swingLow20 > 0 ? indicators.swingLow20 - indicators.atr * 0.2 : null,
      indicators.emaMedium > 0 ? indicators.emaMedium - indicators.atr * 0.25 : null,
      entry - atrRisk
    ].filter((value): value is number => value !== null && Number.isFinite(value) && value < entry);

    const structuralStop = structuralStopCandidates.length > 0 ? Math.min(...structuralStopCandidates) : entry - atrRisk;
    const rawRiskDistance = entry - structuralStop;
    const riskDistance = clamp(rawRiskDistance, minRiskDistance, maxRiskDistance);
    const stopLoss = Math.max(entry - riskDistance, 0);

    if (riskDistance <= 0 || stopLoss <= 0) {
      return null;
    }

    const entryPadding = Math.max(indicators.atr * 0.25, entry * 0.0025);

    return {
      entry,
      entryMin: Math.max(entry - entryPadding, 0),
      entryMax: entry + entryPadding,
      triggerPrice,
      stopLoss,
      takeProfit1: entry + riskDistance * 1.4,
      takeProfit2: entry + riskDistance * 2.2,
      riskRewardRatio: 2.2,
      riskAmountUsd,
      suggestedPositionUnits: Math.min(riskAmountUsd / riskDistance, maxPositionNotionalUsd / entry),
      invalidation: 'Сценарий отменяется, если цена уходит ниже стопа. После TP1 риск лучше сокращать.',
      entryComment,
      exitComment: 'TP1 — частичная фиксация. TP2 — закрытие остатка. Если цена вернулась под стоп, сделка закрывается.'
    };
  };

  if (recommendation === 'BUY_NOW') {
    return buildPlanFromEntry(
      price,
      setup === 'BREAKOUT' && indicators.swingHigh20 > 0 ? indicators.swingHigh20 * 1.001 : null,
      setup === 'BREAKOUT'
        ? 'Покупка по пробою/продолжению силы. Не входить сильно выше зоны входа.'
        : 'Покупка по тренду с понятным стопом. Не увеличивать риск, если цена уже ушла далеко от входа.'
    );
  }

  if (recommendation === 'WAIT') {
    const triggerPrice = setup === 'BREAKOUT' && indicators.swingHigh20 > 0 ? indicators.swingHigh20 * 1.001 : Math.max(indicators.emaFast, price);
    return buildPlanFromEntry(triggerPrice, triggerPrice, 'Пока не покупать. Вход только после подтверждения триггера.');
  }

  return null;
};

export const evaluateSignal = (
  price: number,
  indicators: IndicatorSnapshot,
  market: MarketSnapshot,
  timeframe = ''
): DecisionResult => {
  const reasons: string[] = [];

  let score = 0;
  let regime: MarketRegime = 'RANGE';
  let setup: SetupType = 'NONE';

  const bullishTrend =
    price > indicators.emaTrend &&
    indicators.emaFast > indicators.emaMedium &&
    indicators.emaMedium > indicators.emaTrend;

  const constructiveTrend =
    price > indicators.emaFast &&
    indicators.emaFast >= indicators.emaMedium * 0.998 &&
    price >= indicators.emaTrend * 0.995;

  const bearishTrend =
    price < indicators.emaMedium &&
    indicators.emaFast < indicators.emaMedium &&
    price < indicators.emaTrend;

  const isFastTimeframe = timeframe === '15' || timeframe === '5';
  const minMomentumForEntry = isFastTimeframe ? 0.25 : 0.45;
  const minVolumeForEntry = 1.05;
  const liquidityOk = market.turnover24hUsd >= config.minTurnover24hUsd;
  const spreadOk = market.spreadPct <= config.maxSpreadPct;
  const fundingTooHot = market.fundingRate !== null && market.fundingRate >= 0.00025;
  const volatilityTooHigh = indicators.volatilityPct > 5;
  const rsiOk = indicators.rsi >= 50 && indicators.rsi <= 68;
  const momentumOk = indicators.momentumPct >= minMomentumForEntry;
  const volumeOk = indicators.volumeRatio >= minVolumeForEntry;
  const distanceFromFastAtr = indicators.atr > 0 ? (price - indicators.emaFast) / indicators.atr : 0;
  const trendTooWide = indicators.trendGapPct > 10;
  const tooExtended =
    indicators.rsi >= 72 ||
    indicators.momentumPct >= 5.5 ||
    distanceFromFastAtr > 2.2 ||
    trendTooWide;

  const breakout = indicators.swingHigh20 > 0 && price >= indicators.swingHigh20 * 0.995;
  const pullback =
    (bullishTrend || constructiveTrend) &&
    price >= indicators.emaMedium &&
    price <= indicators.emaFast + Math.max(indicators.atr * 0.9, price * 0.012);
  const trendContinuation = (bullishTrend || constructiveTrend) && price >= indicators.emaFast && momentumOk;

  if (bullishTrend) {
    regime = 'BULL';
    score += 2.4;
    reasons.push('Тренд вверх: цена выше EMA200, EMA20 выше EMA50, EMA50 выше EMA200.');
  } else if (constructiveTrend) {
    regime = 'BULL';
    score += 1.6;
    reasons.push('Фон конструктивный: цена держится выше быстрых средних и не проваливается под базовый тренд.');
  } else if (bearishTrend) {
    regime = 'BEAR';
    score -= 2.6;
    reasons.push('Тренд вниз: для новой long-сделки фон слабый.');
  } else {
    reasons.push('Рынок без чистого тренда: покупать можно только после подтверждения.');
  }

  if (indicators.adx >= 18) {
    score += 0.75;
    reasons.push('ADX показывает наличие направленного движения.');
  } else if (indicators.adx >= 12) {
    score += 0.35;
    reasons.push('ADX умеренный: тренд есть, но без сильного ускорения.');
  } else {
    score -= 0.2;
    reasons.push('ADX слабый: возможен боковик и ложные движения.');
  }

  if (indicators.momentumPct >= 0.45) {
    score += 0.75;
    reasons.push('Импульс положительный: цена уже движется вверх.');
  } else if (momentumOk) {
    score += 0.35;
    reasons.push('Импульс умеренно положительный: вход возможен, но без завышения риска.');
  } else if (indicators.momentumPct <= -0.35) {
    score -= 0.55;
    reasons.push('Импульс отрицательный: покупку лучше отложить.');
  } else {
    reasons.push('Импульс нейтральный: нужен аккуратный вход от уровня.');
  }

  if (indicators.volumeRatio >= 1.05) {
    score += 0.45;
    reasons.push('Объём не ниже среднего, движение подтверждается участниками.');
  } else if (volumeOk) {
    score += 0.2;
    reasons.push('Объём допустимый, но без сильного всплеска.');
  } else {
    score -= 0.35;
    reasons.push('Объём слабый: сигнал хуже по качеству.');
  }

  if (breakout) {
    setup = 'BREAKOUT';
    score += 0.65;
    reasons.push('Цена рядом с максимумом последних 20 свечей или пробивает его.');
  } else if (pullback) {
    setup = 'PULLBACK';
    score += 0.55;
    reasons.push('Цена держится в зоне трендового отката рядом с EMA20/EMA50.');
  } else if (trendContinuation) {
    setup = 'PULLBACK';
    score += 0.35;
    reasons.push('Есть продолжение тренда выше EMA20, но без идеального пробоя.');
  }

  if (indicators.rsi >= 50 && indicators.rsi <= 70) {
    score += 0.45;
    reasons.push('RSI в рабочей зоне для long.');
  } else if (rsiOk) {
    score += 0.15;
    reasons.push('RSI допустимый, но не идеальный.');
  } else if (indicators.rsi > 68) {
    score -= 0.85;
    reasons.push('RSI высокий: вход может быть запоздалым.');
  } else {
    score -= 0.45;
    reasons.push('RSI слабый для покупки.');
  }

  if (!liquidityOk) {
    score -= 1.3;
    reasons.push('Оборот ниже фильтра ликвидности.');
  }

  if (!spreadOk) {
    score -= 1.0;
    reasons.push('Спред широкий: вход может быть дорогим.');
  }

  if (fundingTooHot) {
    score -= 0.55;
    reasons.push('Фандинг перегрет: long может быть переполнен.');
  }

  if (volatilityTooHigh) {
    score -= 0.55;
    reasons.push('Волатильность высокая: стоп может выбить шумом.');
  }

  if (tooExtended) {
    score -= 1.25;
    reasons.push('Цена слишком растянута: вход похож на догон свечи.');
  }

  const confidence = clamp(0.45 + score / 7, 0.12, 0.95);
  const effectiveMinConfidence = Math.min(config.minConfidenceActionable, 0.58);
  const hasEntrySetup = setup !== 'NONE';
  const trendOk = bullishTrend || constructiveTrend;

  const actionable =
    trendOk &&
    hasEntrySetup &&
    momentumOk &&
    volumeOk &&
    rsiOk &&
    indicators.adx >= 18 &&
    liquidityOk &&
    spreadOk &&
    !fundingTooHot &&
    !volatilityTooHigh &&
    !tooExtended &&
    score >= 3.8 &&
    confidence >= effectiveMinConfidence;

  let signal: SignalType = 'HOLD';
  let recommendation: RecommendationType = 'WAIT';
  let headline = 'Ждать подтверждения';
  let shortText = 'Сейчас нет достаточно чистой точки входа. Лучше дождаться подтверждения и не покупать наугад.';

  if (actionable) {
    signal = 'BUY';
    recommendation = 'BUY_NOW';
    headline = 'Купить в long по плану';
    shortText =
      setup === 'BREAKOUT'
        ? 'Есть рабочий long-сигнал: цена показывает силу рядом с пробоем. Вход только в зоне плана и со стопом.'
        : 'Есть рабочий long-сигнал по тренду. Входить можно только с заранее заданным стопом и размером риска.';
  } else if (bearishTrend || score < 0.65 || (!liquidityOk || !spreadOk)) {
    signal = 'SELL';
    recommendation = 'EXIT';
    setup = bearishTrend ? 'BREAKDOWN' : setup;
    headline = 'Не покупать';
    shortText = 'Long-сценарий слабый. Новую сделку лучше не открывать, а открытую позицию контролировать жёстко.';
  } else {
    signal = trendOk ? 'BUY' : 'HOLD';
    recommendation = 'WAIT';
    headline = 'Следить, но пока не входить';
    shortText = 'Идея есть, но одного из подтверждений не хватает. Покупка только после улучшения сигнала.';
  }

  const tradePlan = buildTradePlan(recommendation, price, indicators, setup);

  return {
    signal,
    recommendation,
    confidence,
    score,
    reason: reasons,
    regime,
    setup,
    actionable,
    tradePlan,
    headline,
    shortText
  };
};
