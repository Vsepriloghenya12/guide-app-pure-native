
import path from 'node:path';
import { AppConfig } from './types';

const parseCsv = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const parseOptionalString = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const resolveStorageFile = (value: string | undefined): string => {
  if (!value) {
    return path.resolve(process.cwd(), 'data', 'market-state.json');
  }

  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
};

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 3001),
  scanIntervalMs: Number(process.env.SCAN_INTERVAL_MS ?? 180_000),
  bybitCategory: process.env.BYBIT_CATEGORY ?? 'linear',
  historyLimit: Number(process.env.HISTORY_LIMIT ?? 1000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  storageFile: resolveStorageFile(process.env.STORAGE_FILE),
  accountSizeUsd: Number(process.env.ACCOUNT_SIZE_USD ?? 100),
  riskPerTradePct: Number(process.env.RISK_PER_TRADE_PCT ?? 1),
  minConfidenceActionable: Number(process.env.MIN_CONFIDENCE_ACTIONABLE ?? 0.55),
  quoteCoin: process.env.MARKET_QUOTE_COIN?.trim() || 'USDT',
  maxSymbolsToAnalyze: Number(process.env.MAX_SYMBOLS_TO_ANALYZE ?? 20),
  minTurnover24hUsd: Number(process.env.MIN_TURNOVER_24H_USD ?? 2_000_000),
  maxSpreadPct: Number(process.env.MAX_SPREAD_PCT ?? 0.45),
  openAiApiKey: parseOptionalString(process.env.OPENAI_API_KEY),
  openAiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5.4-mini',
  aiAnalysisEnabled: parseBoolean(process.env.AI_ANALYSIS_ENABLED, false),
  aiAnalyzeHoldSignals: parseBoolean(process.env.AI_ANALYZE_HOLD_SIGNALS, false),
  timeframes: parseCsv(process.env.MARKET_TIMEFRAMES, ['15', '60']),
  paperStartingBalanceUsd: Number(process.env.PAPER_STARTING_BALANCE_USD ?? process.env.ACCOUNT_SIZE_USD ?? 100),
  paperMaxClosedTrades: Number(process.env.PAPER_MAX_CLOSED_TRADES ?? 1000),
  simulationFeePct: Number(process.env.SIMULATION_FEE_PCT ?? 0.055),
  backtestCandles: Number(process.env.BACKTEST_CANDLES ?? 320),
  backtestWarmup: Number(process.env.BACKTEST_WARMUP ?? 220),
  backtestMaxSymbols: Number(process.env.BACKTEST_MAX_SYMBOLS ?? 8),
  backtestMaxHoldCandles: Number(process.env.BACKTEST_MAX_HOLD_CANDLES ?? 36),
  backtestStartingBalanceUsd: Number(process.env.BACKTEST_STARTING_BALANCE_USD ?? process.env.ACCOUNT_SIZE_USD ?? 100),
  pushEnabled: parseBoolean(process.env.PUSH_ENABLED, true),
  pushSubject: process.env.PUSH_SUBJECT?.trim() || 'mailto:admin@example.com',
  pushMinRepeatMs: Number(process.env.PUSH_MIN_REPEAT_MS ?? 6 * 60 * 60 * 1000),
  pushMaxEvents: Number(process.env.PUSH_MAX_EVENTS ?? 500),
  vapidPublicKey: parseOptionalString(process.env.VAPID_PUBLIC_KEY),
  vapidPrivateKey: parseOptionalString(process.env.VAPID_PRIVATE_KEY)
};
