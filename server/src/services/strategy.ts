import { config } from '../config';
import { StrategyRule } from '../types';

export const strategyRules: StrategyRule[] = [
  {
    id: 'liquid-market',
    title: 'Работать только с ликвидными USDT-фьючерсами',
    description: 'Сканер берёт монеты с нормальным оборотом и спредом, чтобы сигнал был пригоден для демо-сделки.'
  },
  {
    id: 'simple-long-signal',
    title: 'Давать простой long-сигнал',
    description: 'Главное действие на экране: покупать, ждать или не покупать. Для покупки всегда показываются вход, стоп, TP1 и TP2.'
  },
  {
    id: 'trend-and-momentum',
    title: 'Искать тренд и импульс без чрезмерно жёстких фильтров',
    description: 'Стратегия больше не требует идеального совпадения всех индикаторов. Достаточно здорового тренда, допустимого RSI, импульса, объёма и нормального риска.'
  },
  {
    id: 'risk-first',
    title: 'Каждый сигнал обязан иметь стоп',
    description: 'Если невозможно построить понятный риск-план, сигнал не становится покупкой. Размер позиции считается от риска на сделку.'
  },
  {
    id: 'paper-history',
    title: 'Демо-счёт проверяет стратегию',
    description: 'Приложение открывает виртуальные сделки по своим сигналам, закрывает их по стопам/целям и хранит историю сделок.'
  }
];

export const strategyMeta = {
  minMomentumForEntryPct: { fastTimeframe: 0.25, slowTimeframe: 0.45 },
  minVolumeRatioForEntry: 1.05,
  rsiEntryZone: { min: 50, max: 68 },
  maxFundingRateForEntry: 0.00025,
  highVolatilityThresholdPct: 5,
  rewardTargetsR: [1.4, 2.2],
  accountSizeUsd: config.accountSizeUsd,
  riskPerTradePct: config.riskPerTradePct,
  minConfidenceActionable: config.minConfidenceActionable,
  maxSymbolsToAnalyze: config.maxSymbolsToAnalyze,
  minTurnover24hUsd: config.minTurnover24hUsd,
  maxSpreadPct: config.maxSpreadPct,
  quoteCoin: config.quoteCoin
};
