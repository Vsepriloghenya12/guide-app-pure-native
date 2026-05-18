export interface AnalyzerState {
  lastRunAt: string | null;
  isRunning: boolean;
  runCount: number;
  lastError: string | null;
  scanEnabled: boolean;
  pausedAt: string | null;
}

export interface ScannerState {
  enabled: boolean;
  isRunning: boolean;
  pausedAt: string | null;
  lastRunAt: string | null;
  runCount: number;
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

export interface SignalItem {
  id: string;
  symbol: string;
  timeframe: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  recommendation: 'BUY_NOW' | 'WAIT' | 'EXIT';
  confidence: number;
  score: number;
  price: number;
  createdAt: string;
  headline: string;
  shortText: string;
  tradePlan: TradePlan | null;
  reason: string[];
}

export interface OpportunitiesResponse {
  bestIdea: SignalItem | null;
  buyNow: SignalItem[];
  wait: SignalItem[];
  exit: SignalItem[];
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
  status: 'OPEN' | 'CLOSED';
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
  closeReason: string;
  tp1Hit: boolean;
}

export interface PaperState {
  summary: {
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
  };
  openPositions: PaperPosition[];
  closedTrades: PaperTrade[];
  lastResetAt: string | null;
}

export interface PushStatusResponse {
  enabled: boolean;
  publicKey: string | null;
  subscriptionsCount: number;
  lastNotificationAt: string | null;
  lastNotification: {
    title: string;
    body: string;
    sentAt: string;
    deliveredCount: number;
    failedCount: number;
  } | null;
}

export interface HealthResponse {
  analyzer: AnalyzerState;
  universe: UniverseState;
  paper: PaperState['summary'];
  push: PushStatusResponse;
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, init);
  if (!response.ok) {
    let message = `Ошибка запроса: ${response.status}`;
    try {
      const payload = (await response.json()) as Partial<{ message: string }>;
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Оставляем стандартное сообщение, если сервер вернул не JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
};

export const api = {
  getHealth: () => request<HealthResponse>('/api/health'),
  getOpportunities: () => request<OpportunitiesResponse>('/api/opportunities'),
  getPaper: () => request<PaperState>('/api/paper'),
  getSignalsLatest: () => request<{ items: SignalItem[] }>('/api/signals/latest'),
  getPushStatus: () => request<PushStatusResponse>('/api/push/status'),
  getPushPublicKey: () => request<{ enabled: boolean; publicKey: string | null }>('/api/push/public-key'),
  subscribePush: (subscription: PushSubscriptionJSON) => request<{ ok: boolean; status: PushStatusResponse }>('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription)
  }),
  unsubscribePush: (endpoint: string) => request<{ ok: boolean; status: PushStatusResponse }>('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint })
  }),
  sendPushTest: () => request<{ ok: boolean; sent: number; failed: number; status: PushStatusResponse }>('/api/push/test', { method: 'POST' }),
  runAnalyzeNow: () => request<{ ok: boolean }>('/api/analyze/now', { method: 'POST' }),
  resetPaper: () => request<PaperState>('/api/paper/reset', { method: 'POST' }),
  getScanner: () => request<ScannerState>('/api/scanner'),
  setScannerEnabled: (enabled: boolean) => request<{ ok: boolean } & ScannerState>('/api/scanner/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  })
};

export const downloadFullExport = (): void => {
  window.location.href = '/api/export/full';
};
