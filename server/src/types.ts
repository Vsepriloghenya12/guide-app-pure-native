
export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type RecommendationType = 'BUY_NOW' | 'WAIT' | 'EXIT';
export type MarketRegime = 'BULL' | 'BEAR' | 'RANGE';
export type SetupType = 'BREAKOUT' | 'PULLBACK' | 'BREAKDOWN' | 'NONE';
export type AIAnalysisStatus = 'READY' | 'SKIPPED' | 'ERROR';
export type AIAlignment = 'ALIGNED' | 'MIXED' | 'CONTRARIAN';
export type PaperPositionStatus = 'OPEN' | 'CLOSED';
export type PaperCloseReason = 'STOP' | 'TAKE_PROFIT_2' | 'EXIT_SIGNAL' | 'TIMEOUT' | 'MANUAL';
export type BacktestRunStatus = 'IDLE' | 'RUNNING' | 'DONE' | 'ERROR';
export type PushDeliveryStatus = 'SENT' | 'FAILED' | 'SKIPPED';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorSnapshot {
  emaFast: number;
  emaMedium: number;
  emaTrend: number;
  rsi: number;
  atr: number;
  adx: number;
  momentumPct: number;
  volatilityPct: number;
  volumeRatio: number;
  swingHigh20: number;
  swingLow20: number;
  trendGapPct: number;
}

export interface MarketSnapshot {
  symbol: string;
  rank24h: number;
  turnover24hUsd: number;
  volume24h: number;
  spreadPct: number;
  lastPrice: number;
  fundingRate: number | null;
}

export interface TradePlan {
  entry: number;
  entryMin: number;
  entryMax: number;
  triggerPrice: number | null;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  riskAmountUsd: number;
  suggestedPositionUnits: number;
  invalidation: string;
  entryComment: string;
  exitComment: string;
}

export interface AIAnalysis {
  status: AIAnalysisStatus;
  provider: 'openai';
  model: string | null;
  generatedAt: string;
  verdict: SignalType;
  confidence: number | null;
  alignmentWithRules: AIAlignment;
  summary: string;
  marketNarrative: string;
  strengths: string[];
  risks: string[];
  checklist: string[];
  entryStyle: string;
  exitStyle: string;
  invalidation: string;
  positionSizingNote: string;
  nextAction: string;
  error: string | null;
}

export interface SignalRecord {
  id: string;
  symbol: string;
  timeframe: string;
  signal: SignalType;
  recommendation: RecommendationType;
  confidence: number;
  score: number;
  price: number;
  candle?: Candle;
  createdAt: string;
  regime: MarketRegime;
  setup: SetupType;
  actionable: boolean;
  headline: string;
  shortText: string;
  reason: string[];
  indicators: IndicatorSnapshot;
  market: MarketSnapshot;
  tradePlan: TradePlan | null;
  aiAnalysis: AIAnalysis | null;
}

export interface AnalyzerState {
  lastRunAt: string | null;
  isRunning: boolean;
  runCount: number;
  lastError: string | null;
  scanEnabled: boolean;
  pausedAt: string | null;
}

export interface UniverseState {
  fetchedAt: string | null;
  totalSymbols: number;
  eligibleSymbols: number;
  analyzedSymbols: number;
  topSymbols: string[];
  minTurnoverUsd: number;
  maxSymbolsToAnalyze: number;
}

export interface StrategyRule {
  id: string;
  title: string;
  description: string;
}

export interface PaperPosition {
  id: string;
  symbol: string;
  timeframe: string;
  signalId: string;
  openedAt: string;
  updatedAt: string;
  entryPrice: number;
  quantity: number;
  remainingQuantity: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  tp1Hit: boolean;
  realizedPnlUsd: number;
  realizedFeesUsd: number;
  status: PaperPositionStatus;
  entryComment: string;
}

export interface PaperTrade {
  id: string;
  symbol: string;
  timeframe: string;
  openedAt: string;
  closedAt: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnlUsd: number;
  pnlPct: number;
  feesUsd: number;
  closeReason: PaperCloseReason;
  tp1Hit: boolean;
}

export interface PaperSummary {
  startingBalanceUsd: number;
  balanceUsd: number;
  closedTrades: number;
  openPositions: number;
  winRate: number;
  totalPnlUsd: number;
  totalFeesUsd: number;
  bestTradeUsd: number;
  worstTradeUsd: number;
  lastEventAt: string | null;
}

export interface PaperState {
  summary: PaperSummary;
  openPositions: PaperPosition[];
  closedTrades: PaperTrade[];
  lastResetAt: string | null;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
  updatedAt: string;
  userAgent: string | null;
}

export interface PushNotificationEvent {
  id: string;
  signalId: string;
  signalKey: string;
  symbol: string;
  timeframe: string;
  title: string;
  body: string;
  url: string;
  sentAt: string;
  status: PushDeliveryStatus;
  deliveredCount: number;
  failedCount: number;
}

export interface PushState {
  subscriptions: PushSubscriptionRecord[];
  sentEvents: PushNotificationEvent[];
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  timeframe: string;
  openedAt: string;
  closedAt: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnlUsd: number;
  pnlPct: number;
  feesUsd: number;
  closeReason: PaperCloseReason;
  tp1Hit: boolean;
  durationCandles: number;
}

export interface BacktestSettings {
  candles: number;
  warmup: number;
  maxSymbols: number;
  maxHoldCandles: number;
  feePct: number;
  startingBalanceUsd: number;
  timeframes: string[];
}

export interface BacktestSummary {
  runId: string | null;
  status: BacktestRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  symbolsTested: number;
  timeframes: string[];
  tradesCount: number;
  winRate: number;
  totalPnlUsd: number;
  totalFeesUsd: number;
  endingBalanceUsd: number;
  bestTradeUsd: number;
  worstTradeUsd: number;
  maxDrawdownPct: number;
  profitFactor: number;
  notes: string[];
}

export interface BacktestState {
  summary: BacktestSummary;
  settings: BacktestSettings;
  trades: BacktestTrade[];
  lastError: string | null;
}

export interface AppConfig {
  port: number;
  scanIntervalMs: number;
  bybitCategory: string;
  historyLimit: number;
  corsOrigin: string;
  storageFile: string;
  accountSizeUsd: number;
  riskPerTradePct: number;
  minConfidenceActionable: number;
  quoteCoin: string;
  maxSymbolsToAnalyze: number;
  minTurnover24hUsd: number;
  maxSpreadPct: number;
  openAiApiKey: string | null;
  openAiModel: string;
  aiAnalysisEnabled: boolean;
  aiAnalyzeHoldSignals: boolean;
  timeframes: string[];
  paperStartingBalanceUsd: number;
  paperMaxClosedTrades: number;
  simulationFeePct: number;
  backtestCandles: number;
  backtestWarmup: number;
  backtestMaxSymbols: number;
  backtestMaxHoldCandles: number;
  backtestStartingBalanceUsd: number;
  pushEnabled: boolean;
  pushSubject: string;
  pushMinRepeatMs: number;
  pushMaxEvents: number;
  vapidPublicKey: string | null;
  vapidPrivateKey: string | null;
}

export interface StoredState {
  signals: SignalRecord[];
  analyzer: AnalyzerState;
  universe: UniverseState;
  paper: PaperState;
  backtest: BacktestState;
  push: PushState;
}
