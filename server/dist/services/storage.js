"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = exports.StorageService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("../config");
const defaultAnalyzerState = {
    lastRunAt: null,
    isRunning: false,
    runCount: 0,
    lastError: null,
    scanEnabled: true,
    pausedAt: null
};
const defaultUniverseState = {
    fetchedAt: null,
    totalSymbols: 0,
    eligibleSymbols: 0,
    analyzedSymbols: 0,
    topSymbols: [],
    minTurnoverUsd: config_1.config.minTurnover24hUsd,
    maxSymbolsToAnalyze: config_1.config.maxSymbolsToAnalyze
};
const defaultPaperState = () => ({
    summary: {
        startingBalanceUsd: config_1.config.paperStartingBalanceUsd,
        balanceUsd: config_1.config.paperStartingBalanceUsd,
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
const defaultBacktestState = () => ({
    summary: {
        runId: null,
        status: 'IDLE',
        startedAt: null,
        completedAt: null,
        symbolsTested: 0,
        timeframes: [...config_1.config.timeframes],
        tradesCount: 0,
        winRate: 0,
        totalPnlUsd: 0,
        totalFeesUsd: 0,
        endingBalanceUsd: config_1.config.backtestStartingBalanceUsd,
        bestTradeUsd: 0,
        worstTradeUsd: 0,
        maxDrawdownPct: 0,
        profitFactor: 0,
        notes: ['Бэктест ещё не запускался.']
    },
    settings: {
        candles: config_1.config.backtestCandles,
        warmup: config_1.config.backtestWarmup,
        maxSymbols: config_1.config.backtestMaxSymbols,
        maxHoldCandles: config_1.config.backtestMaxHoldCandles,
        feePct: config_1.config.simulationFeePct,
        startingBalanceUsd: config_1.config.backtestStartingBalanceUsd,
        timeframes: [...config_1.config.timeframes]
    },
    trades: [],
    lastError: null
});
const defaultPushState = () => ({
    subscriptions: [],
    sentEvents: []
});
const ensureStorageDir = () => {
    const directory = node_path_1.default.dirname(config_1.config.storageFile);
    if (!node_fs_1.default.existsSync(directory)) {
        node_fs_1.default.mkdirSync(directory, { recursive: true });
    }
};
const defaultState = () => ({
    signals: [],
    analyzer: { ...defaultAnalyzerState },
    universe: { ...defaultUniverseState },
    paper: defaultPaperState(),
    backtest: defaultBacktestState(),
    push: defaultPushState()
});
class StorageService {
    state;
    constructor() {
        ensureStorageDir();
        this.state = this.load();
    }
    load() {
        if (!node_fs_1.default.existsSync(config_1.config.storageFile)) {
            const initial = defaultState();
            node_fs_1.default.writeFileSync(config_1.config.storageFile, JSON.stringify(initial, null, 2), 'utf-8');
            return initial;
        }
        try {
            const raw = node_fs_1.default.readFileSync(config_1.config.storageFile, 'utf-8');
            const parsed = JSON.parse(raw);
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
        }
        catch (error) {
            console.error('Failed to read storage file, using defaults.', error);
            return defaultState();
        }
    }
    persist() {
        const temporaryFile = `${config_1.config.storageFile}.tmp`;
        node_fs_1.default.writeFileSync(temporaryFile, JSON.stringify(this.state, null, 2), 'utf-8');
        node_fs_1.default.renameSync(temporaryFile, config_1.config.storageFile);
    }
    getSignals() {
        return [...this.state.signals].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    }
    saveSignal(signal) {
        this.state.signals.unshift(signal);
        this.state.signals = this.state.signals.slice(0, config_1.config.historyLimit);
        this.persist();
    }
    getAnalyzerState() {
        return { ...this.state.analyzer };
    }
    updateAnalyzerState(nextState) {
        this.state.analyzer = {
            ...this.state.analyzer,
            ...nextState
        };
        this.persist();
    }
    getUniverseState() {
        return { ...this.state.universe, topSymbols: [...this.state.universe.topSymbols] };
    }
    updateUniverseState(nextState) {
        this.state.universe = {
            ...this.state.universe,
            ...nextState,
            topSymbols: nextState.topSymbols ? [...nextState.topSymbols] : [...this.state.universe.topSymbols]
        };
        this.persist();
    }
    getPaperState() {
        return {
            ...this.state.paper,
            summary: { ...this.state.paper.summary },
            openPositions: [...this.state.paper.openPositions],
            closedTrades: [...this.state.paper.closedTrades]
        };
    }
    savePaperState(nextState) {
        this.state.paper = {
            ...nextState,
            summary: { ...nextState.summary },
            openPositions: [...nextState.openPositions],
            closedTrades: [...nextState.closedTrades]
        };
        this.persist();
    }
    getBacktestState() {
        return {
            ...this.state.backtest,
            summary: { ...this.state.backtest.summary },
            settings: { ...this.state.backtest.settings, timeframes: [...this.state.backtest.settings.timeframes] },
            trades: [...this.state.backtest.trades]
        };
    }
    saveBacktestState(nextState) {
        this.state.backtest = {
            ...nextState,
            summary: { ...nextState.summary, notes: [...nextState.summary.notes], timeframes: [...nextState.summary.timeframes] },
            settings: { ...nextState.settings, timeframes: [...nextState.settings.timeframes] },
            trades: [...nextState.trades]
        };
        this.persist();
    }
    getPushState() {
        return {
            subscriptions: [...this.state.push.subscriptions],
            sentEvents: [...this.state.push.sentEvents]
        };
    }
    savePushState(nextState) {
        this.state.push = {
            subscriptions: [...nextState.subscriptions],
            sentEvents: [...nextState.sentEvents].slice(0, config_1.config.pushMaxEvents)
        };
        this.persist();
    }
    upsertPushSubscription(subscription) {
        const state = this.getPushState();
        const existing = state.subscriptions.find((item) => item.endpoint === subscription.endpoint);
        const now = new Date().toISOString();
        if (existing) {
            const updated = { ...existing, ...subscription, updatedAt: now };
            state.subscriptions = state.subscriptions.map((item) => (item.endpoint === subscription.endpoint ? updated : item));
            this.savePushState(state);
            return updated;
        }
        const created = {
            id: node_crypto_1.default.randomUUID(),
            ...subscription,
            createdAt: now,
            updatedAt: now
        };
        state.subscriptions.unshift(created);
        this.savePushState(state);
        return created;
    }
    removePushSubscription(endpoint) {
        const state = this.getPushState();
        state.subscriptions = state.subscriptions.filter((item) => item.endpoint !== endpoint);
        this.savePushState(state);
    }
    recordPushEvent(event) {
        const state = this.getPushState();
        state.sentEvents.unshift(event);
        state.sentEvents = state.sentEvents.slice(0, config_1.config.pushMaxEvents);
        this.savePushState(state);
    }
}
exports.StorageService = StorageService;
exports.storageService = new StorageService();
