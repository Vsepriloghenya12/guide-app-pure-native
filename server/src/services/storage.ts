
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import {
  AnalyzerState,
  BacktestState,
  PaperState,
  PushState,
  PushNotificationEvent,
  PushSubscriptionRecord,
  SignalRecord,
  StoredState,
  UniverseState
} from '../types';

const defaultAnalyzerState: AnalyzerState = {
  lastRunAt: null,
  isRunning: false,
  runCount: 0,
  lastError: null,
  scanEnabled: true,
  pausedAt: null
};

const defaultUniverseState: UniverseState = {
  fetchedAt: null,
  totalSymbols: 0,
  eligibleSymbols: 0,
  analyzedSymbols: 0,
  topSymbols: [],
  minTurnoverUsd: config.minTurnover24hUsd,
  maxSymbolsToAnalyze: config.maxSymbolsToAnalyze
};

const defaultPaperState = (): PaperState => ({
  summary: {
    startingBalanceUsd: config.paperStartingBalanceUsd,
    balanceUsd: config.paperStartingBalanceUsd,
    closedTrades: 0,
    openPositions: 0,
    winRate: 0,
    totalPnlUsd: 0,
    totalFeesUsd: 0,
    bestTradeUsd: 0,
    worstTradeUsd: 0,
    lastEventAt: null
  },
  openPositions: [],
  closedTrades: [],
  lastResetAt: null
});

const defaultBacktestState = (): BacktestState => ({
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

const defaultPushState = (): PushState => ({
  subscriptions: [],
  sentEvents: []
});

const ensureStorageDir = (): void => {
  const directory = path.dirname(config.storageFile);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const defaultState = (): StoredState => ({
  signals: [],
  analyzer: { ...defaultAnalyzerState },
  universe: { ...defaultUniverseState },
  paper: defaultPaperState(),
  backtest: defaultBacktestState(),
  push: defaultPushState()
});

export class StorageService {
  private state: StoredState;

  constructor() {
    ensureStorageDir();
    this.state = this.load();
  }

  private load(): StoredState {
    if (!fs.existsSync(config.storageFile)) {
      const initial = defaultState();
      fs.writeFileSync(config.storageFile, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }

    try {
      const raw = fs.readFileSync(config.storageFile, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      return {
        signals: parsed.signals ?? [],
        analyzer: {
          ...defaultAnalyzerState,
          ...(parsed.analyzer ?? {})
        },
        universe: {
          ...defaultUniverseState,
          ...(parsed.universe ?? {})
        },
        paper: {
          ...defaultPaperState(),
          ...(parsed.paper ?? {}),
          summary: {
            ...defaultPaperState().summary,
            ...(parsed.paper?.summary ?? {})
          },
          openPositions: parsed.paper?.openPositions ?? [],
          closedTrades: parsed.paper?.closedTrades ?? []
        },
        backtest: {
          ...defaultBacktestState(),
          ...(parsed.backtest ?? {}),
          summary: {
            ...defaultBacktestState().summary,
            ...(parsed.backtest?.summary ?? {})
          },
          settings: {
            ...defaultBacktestState().settings,
            ...(parsed.backtest?.settings ?? {})
          },
          trades: parsed.backtest?.trades ?? []
        },
        push: {
          ...defaultPushState(),
          ...(parsed.push ?? {}),
          subscriptions: parsed.push?.subscriptions ?? [],
          sentEvents: parsed.push?.sentEvents ?? []
        }
      };
    } catch (error) {
      console.error('Failed to read storage file, using defaults.', error);
      return defaultState();
    }
  }

  private persist(): void {
    const temporaryFile = `${config.storageFile}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(this.state, null, 2), 'utf-8');
    fs.renameSync(temporaryFile, config.storageFile);
  }

  public getSignals(): SignalRecord[] {
    return [...this.state.signals].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  public saveSignal(signal: SignalRecord): void {
    this.state.signals.unshift(signal);
    this.state.signals = this.state.signals.slice(0, config.historyLimit);
    this.persist();
  }

  public getAnalyzerState(): AnalyzerState {
    return { ...this.state.analyzer };
  }

  public updateAnalyzerState(nextState: Partial<AnalyzerState>): void {
    this.state.analyzer = {
      ...this.state.analyzer,
      ...nextState
    };
    this.persist();
  }

  public getUniverseState(): UniverseState {
    return { ...this.state.universe, topSymbols: [...this.state.universe.topSymbols] };
  }

  public updateUniverseState(nextState: Partial<UniverseState>): void {
    this.state.universe = {
      ...this.state.universe,
      ...nextState,
      topSymbols: nextState.topSymbols ? [...nextState.topSymbols] : [...this.state.universe.topSymbols]
    };
    this.persist();
  }

  public getPaperState(): PaperState {
    return {
      ...this.state.paper,
      summary: { ...this.state.paper.summary },
      openPositions: [...this.state.paper.openPositions],
      closedTrades: [...this.state.paper.closedTrades]
    };
  }

  public savePaperState(nextState: PaperState): void {
    this.state.paper = {
      ...nextState,
      summary: { ...nextState.summary },
      openPositions: [...nextState.openPositions],
      closedTrades: [...nextState.closedTrades]
    };
    this.persist();
  }

  public getBacktestState(): BacktestState {
    return {
      ...this.state.backtest,
      summary: { ...this.state.backtest.summary },
      settings: { ...this.state.backtest.settings, timeframes: [...this.state.backtest.settings.timeframes] },
      trades: [...this.state.backtest.trades]
    };
  }

  public saveBacktestState(nextState: BacktestState): void {
    this.state.backtest = {
      ...nextState,
      summary: { ...nextState.summary, notes: [...nextState.summary.notes], timeframes: [...nextState.summary.timeframes] },
      settings: { ...nextState.settings, timeframes: [...nextState.settings.timeframes] },
      trades: [...nextState.trades]
    };
    this.persist();
  }

  public getPushState(): PushState {
    return {
      subscriptions: [...this.state.push.subscriptions],
      sentEvents: [...this.state.push.sentEvents]
    };
  }

  public savePushState(nextState: PushState): void {
    this.state.push = {
      subscriptions: [...nextState.subscriptions],
      sentEvents: [...nextState.sentEvents].slice(0, config.pushMaxEvents)
    };
    this.persist();
  }

  public upsertPushSubscription(subscription: Omit<PushSubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'>): PushSubscriptionRecord {
    const state = this.getPushState();
    const existing = state.subscriptions.find((item) => item.endpoint === subscription.endpoint);
    const now = new Date().toISOString();

    if (existing) {
      const updated = { ...existing, ...subscription, updatedAt: now };
      state.subscriptions = state.subscriptions.map((item) => (item.endpoint === subscription.endpoint ? updated : item));
      this.savePushState(state);
      return updated;
    }

    const created: PushSubscriptionRecord = {
      id: crypto.randomUUID(),
      ...subscription,
      createdAt: now,
      updatedAt: now
    };

    state.subscriptions.unshift(created);
    this.savePushState(state);
    return created;
  }

  public removePushSubscription(endpoint: string): void {
    const state = this.getPushState();
    state.subscriptions = state.subscriptions.filter((item) => item.endpoint !== endpoint);
    this.savePushState(state);
  }

  public recordPushEvent(event: PushNotificationEvent): void {
    const state = this.getPushState();
    state.sentEvents.unshift(event);
    state.sentEvents = state.sentEvents.slice(0, config.pushMaxEvents);
    this.savePushState(state);
  }
}


export const storageService = new StorageService();
