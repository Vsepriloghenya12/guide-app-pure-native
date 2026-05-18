
import crypto from 'node:crypto';
import { config } from '../config';
import { SignalRecord, BacktestSettings, BacktestState, BacktestTrade, Candle, MarketSnapshot } from '../types';
import { buildIndicatorSnapshot, evaluateSignal } from '../utils/indicators';
import { marketDataService } from './marketData';
import { storageService } from './storage';

interface SimPosition {
  symbol: string;
  timeframe: string;
  entryPrice: number;
  quantity: number;
  remainingQuantity: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  tp1Hit: boolean;
  realizedPnlUsd: number;
  realizedFeesUsd: number;
  openedIndex: number;
  openedAt: string;
}

const round = (value: number, digits = 6): number => Number(value.toFixed(digits));
const feeRate = () => config.simulationFeePct / 100;
const getMinExitCandles = (timeframe: string): number => (timeframe === '15' ? 4 : 4);

const createDefaultState = (): BacktestState => ({
  summary: {
    runId: null,
    status: 'IDLE',
    startedAt: null,
    completedAt: null,
    symbolsTested: 0,
    timeframes: [...config.timeframes],
    tradesCount: 0,
    winRate: 0,
    totalPnlUsd: 0,
    totalFeesUsd: 0,
    endingBalanceUsd: config.backtestStartingBalanceUsd,
    bestTradeUsd: 0,
    worstTradeUsd: 0,
    maxDrawdownPct: 0,
    profitFactor: 0,
    notes: ['Бэктест ещё не запускался.']
  },
  settings: {
    candles: config.backtestCandles,
    warmup: config.backtestWarmup,
    maxSymbols: config.backtestMaxSymbols,
    maxHoldCandles: config.backtestMaxHoldCandles,
    feePct: config.simulationFeePct,
    startingBalanceUsd: config.backtestStartingBalanceUsd,
    timeframes: [...config.timeframes]
  },
  trades: [],
  lastError: null
});

const aggregateSummary = (state: BacktestState): BacktestState['summary'] => {
  const trades = state.trades;
  const wins = trades.filter((item) => item.pnlUsd > 0);
  const losses = trades.filter((item) => item.pnlUsd < 0);
  const totalPnlUsd = trades.reduce((sum, item) => sum + item.pnlUsd, 0);
  const totalFeesUsd = trades.reduce((sum, item) => sum + item.feesUsd, 0);
  const grossWin = wins.reduce((sum, item) => sum + item.pnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((sum, item) => sum + item.pnlUsd, 0));

  let equity = state.settings.startingBalanceUsd;
  let peak = equity;
  let maxDrawdownPct = 0;
  for (const trade of [...trades].sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime())) {
    equity += trade.pnlUsd;
    peak = Math.max(peak, equity);
    if (peak > 0) {
      maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - equity) / peak) * 100);
    }
  }

  return {
    ...state.summary,
    tradesCount: trades.length,
    winRate: trades.length > 0 ? round(wins.length / trades.length, 4) : 0,
    totalPnlUsd: round(totalPnlUsd, 2),
    totalFeesUsd: round(totalFeesUsd, 2),
    endingBalanceUsd: round(state.settings.startingBalanceUsd + totalPnlUsd, 2),
    bestTradeUsd: trades.length > 0 ? round(Math.max(...trades.map((item) => item.pnlUsd)), 2) : 0,
    worstTradeUsd: trades.length > 0 ? round(Math.min(...trades.map((item) => item.pnlUsd)), 2) : 0,
    maxDrawdownPct: round(maxDrawdownPct, 2),
    profitFactor: grossLoss > 0 ? round(grossWin / grossLoss, 3) : grossWin > 0 ? 999 : 0
  };
};

const closeTrade = (
  state: BacktestState,
  position: SimPosition,
  candle: Candle,
  closeReason: BacktestTrade['closeReason'],
  exitPrice: number,
  closeIndex: number
): void => {
  const finalFee = position.remainingQuantity * exitPrice * feeRate();
  const finalPnl =
    position.realizedPnlUsd + (exitPrice - position.entryPrice) * position.remainingQuantity - finalFee;
  const feesUsd = position.realizedFeesUsd + finalFee;

  state.trades.unshift({
    id: crypto.randomUUID(),
    symbol: position.symbol,
    timeframe: position.timeframe,
    openedAt: position.openedAt,
    closedAt: new Date(candle.timestamp).toISOString(),
    entryPrice: round(position.entryPrice, 8),
    exitPrice: round(exitPrice, 8),
    quantity: round(position.quantity, 6),
    pnlUsd: round(finalPnl, 2),
    pnlPct: position.entryPrice > 0 ? round((finalPnl / (position.entryPrice * position.quantity)) * 100, 2) : 0,
    feesUsd: round(feesUsd, 2),
    closeReason,
    tp1Hit: position.tp1Hit,
    durationCandles: closeIndex - position.openedIndex
  });
};

const maybeOpenPosition = (
  decisionSignal: SignalRecord | null,
  nextCandle: Candle,
  symbol: string,
  timeframe: string,
  index: number,
  startingBalanceUsd: number
): SimPosition | null => {
  if (!decisionSignal?.tradePlan || decisionSignal.recommendation !== 'BUY_NOW') {
    return null;
  }

  const plan = decisionSignal.tradePlan;
  if (nextCandle.high < plan.entryMin || nextCandle.low > plan.entryMax) {
    return null;
  }

  const entryPrice = Math.min(plan.entryMax, Math.max(plan.entryMin, nextCandle.open));
  const riskAmount = startingBalanceUsd * (config.riskPerTradePct / 100);
  const riskDistance = entryPrice - plan.stopLoss;
  const quantity = riskDistance > 0 ? riskAmount / riskDistance : 0;
  if (quantity <= 0 || entryPrice <= 0) {
    return null;
  }

  const entryFee = entryPrice * quantity * feeRate();

  return {
    symbol,
    timeframe,
    entryPrice,
    quantity,
    remainingQuantity: quantity,
    stopLoss: plan.stopLoss,
    takeProfit1: plan.takeProfit1,
    takeProfit2: plan.takeProfit2,
    tp1Hit: false,
    realizedPnlUsd: -entryFee,
    realizedFeesUsd: entryFee,
    openedIndex: index + 1,
    openedAt: new Date(nextCandle.timestamp).toISOString()
  };
};

const processPositionOnCandle = (
  state: BacktestState,
  position: SimPosition,
  candle: Candle,
  closeIndex: number,
  options: {
    recommendation?: SignalRecord['recommendation'];
    maxHoldCandles?: number;
  } = {}
): SimPosition | null => {
  if (candle.low <= position.stopLoss) {
    closeTrade(state, position, candle, 'STOP', position.stopLoss, closeIndex);
    return null;
  }

  if (!position.tp1Hit && candle.high >= position.takeProfit1) {
    const half = position.remainingQuantity / 2;
    const fee = position.takeProfit1 * half * feeRate();
    position.realizedPnlUsd += (position.takeProfit1 - position.entryPrice) * half - fee;
    position.realizedFeesUsd += fee;
    position.remainingQuantity = Math.max(0, position.remainingQuantity - half);
    position.tp1Hit = true;
  }

  if (candle.high >= position.takeProfit2) {
    closeTrade(state, position, candle, 'TAKE_PROFIT_2', position.takeProfit2, closeIndex);
    return null;
  }

  const heldCandles = closeIndex - position.openedIndex;
  if (options.recommendation === 'EXIT' && heldCandles >= getMinExitCandles(position.timeframe) && candle.close < position.entryPrice) {
    closeTrade(state, position, candle, 'EXIT_SIGNAL', candle.open, closeIndex);
    return null;
  }

  if (
    typeof options.maxHoldCandles === 'number' &&
    closeIndex - position.openedIndex >= options.maxHoldCandles
  ) {
    closeTrade(state, position, candle, 'TIMEOUT', candle.close, closeIndex);
    return null;
  }

  return position;
};

export class BacktestService {
  public getState(): BacktestState {
    return storageService.getBacktestState();
  }

  public async run(partial: Partial<BacktestSettings> = {}): Promise<BacktestState> {
    const current = storageService.getBacktestState();
    const settings: BacktestSettings = {
      ...current.settings,
      ...partial,
      timeframes: partial.timeframes ?? current.settings.timeframes ?? config.timeframes
    };

    const runId = crypto.randomUUID();
    const nextState: BacktestState = {
      ...createDefaultState(),
      settings,
      summary: {
        ...createDefaultState().summary,
        runId,
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
        completedAt: null,
        timeframes: [...settings.timeframes],
        notes: ['Бэктест запущен. Ждите завершения расчёта.']
      },
      trades: [],
      lastError: null
    };

    storageService.saveBacktestState(nextState);

    try {
      const universe = await marketDataService.fetchUniverse();
      const markets = universe.items.slice(0, settings.maxSymbols);
      nextState.summary.symbolsTested = markets.length;

      for (const market of markets) {
        for (const timeframe of settings.timeframes) {
          const candles = await marketDataService.fetchCandles(market.symbol, timeframe, settings.candles);
          if (candles.length <= settings.warmup + 2) {
            continue;
          }

          let position: SimPosition | null = null;

          for (let index = settings.warmup; index < candles.length - 1; index += 1) {
            const slice = candles.slice(0, index + 1);
            const currentCandle = candles[index];
            const nextCandle = candles[index + 1];
            const syntheticMarket: MarketSnapshot = {
              ...market,
              lastPrice: currentCandle.close
            };
            const indicators = buildIndicatorSnapshot(slice);
            const decision = evaluateSignal(currentCandle.close, indicators, syntheticMarket, timeframe);
            const signalRecord = decision.tradePlan
              ? {
                  id: `${market.symbol}-${timeframe}-${index}`,
                  symbol: market.symbol,
                  timeframe,
                  signal: decision.signal,
                  recommendation: decision.recommendation,
                  confidence: decision.confidence,
                  score: decision.score,
                  price: currentCandle.close,
                  candle: currentCandle,
                  createdAt: new Date(currentCandle.timestamp).toISOString(),
                  regime: decision.regime,
                  setup: decision.setup,
                  actionable: decision.actionable,
                  headline: decision.headline,
                  shortText: decision.shortText,
                  reason: decision.reason,
                  indicators,
                  market: syntheticMarket,
                  tradePlan: decision.tradePlan,
                  aiAnalysis: null
                } as SignalRecord
              : null;

            if (position) {
              position = processPositionOnCandle(nextState, position, nextCandle, index + 1, {
                recommendation: decision.recommendation,
                maxHoldCandles: settings.maxHoldCandles
              });
            }

            if (!position) {
              position = maybeOpenPosition(signalRecord, nextCandle, market.symbol, timeframe, index, settings.startingBalanceUsd);
              if (position) {
                position = processPositionOnCandle(nextState, position, nextCandle, index + 1);
              }
            }
          }

          if (position) {
            const lastCandle = candles[candles.length - 1];
            closeTrade(nextState, position, lastCandle, 'TIMEOUT', lastCandle.close, candles.length - 1);
          }
        }
      }

      nextState.summary = {
        ...aggregateSummary(nextState),
        status: 'DONE',
        completedAt: new Date().toISOString(),
        notes: [
          'Это учебный бэктест без гарантии прибыли.',
          'Учтены только базовые комиссии и простая логика входа/выхода.',
          'Сначала проверяйте сигналы в paper trading, а не на реальных деньгах.'
        ]
      };
      nextState.lastError = null;
      storageService.saveBacktestState(nextState);
      return nextState;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка бэктеста';
      nextState.summary = {
        ...nextState.summary,
        status: 'ERROR',
        completedAt: new Date().toISOString(),
        notes: ['Бэктест упал с ошибкой. Проверьте сетевой доступ к Bybit и логи сервера.']
      };
      nextState.lastError = message;
      storageService.saveBacktestState(nextState);
      throw error;
    }
  }
}

export const backtestService = new BacktestService();
