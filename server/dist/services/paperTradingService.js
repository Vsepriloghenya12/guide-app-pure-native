"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paperTradingService = exports.PaperTradingService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const config_1 = require("../config");
const storage_1 = require("./storage");
const feeRate = config_1.config.simulationFeePct / 100;
const round = (value, digits = 6) => Number(value.toFixed(digits));
const maxOpenPositions = 4;
const getMinExitAgeMs = (timeframe) => {
    if (timeframe === '15') {
        return 60 * 60 * 1000;
    }
    return 4 * 60 * 60 * 1000;
};
const getCooldownMs = (timeframe, closeReason) => {
    if (timeframe === '15') {
        return closeReason === 'STOP' ? 90 * 60 * 1000 : 45 * 60 * 1000;
    }
    return closeReason === 'STOP' ? 6 * 60 * 60 * 1000 : 3 * 60 * 60 * 1000;
};
const getSignalAgeMs = (signal, now) => new Date(now).getTime() - new Date(signal.createdAt).getTime();
const getLatestSignal = (symbol, timeframe) => storage_1.storageService.getSignals().find((item) => item.symbol === symbol && item.timeframe === timeframe);
const higherTimeframeAllowsLong = (signal) => {
    if (signal.timeframe !== '15') {
        return true;
    }
    const higher = getLatestSignal(signal.symbol, '60');
    if (!higher) {
        return true;
    }
    const higherIsFresh = getSignalAgeMs(higher, signal.createdAt) <= 75 * 60 * 1000;
    if (!higherIsFresh) {
        return true;
    }
    return higher.recommendation !== 'EXIT' && higher.regime !== 'BEAR' && higher.score >= 1.5;
};
const hasRecentTradeCooldown = (state, signal) => {
    const nowMs = new Date(signal.createdAt).getTime();
    return state.closedTrades.some((trade) => {
        if (trade.symbol !== signal.symbol) {
            return false;
        }
        const closedAtMs = new Date(trade.closedAt).getTime();
        if (!Number.isFinite(closedAtMs)) {
            return false;
        }
        return nowMs - closedAtMs < getCooldownMs(signal.timeframe, trade.closeReason);
    });
};
const buildSummary = (state) => {
    const closedTrades = state.closedTrades;
    const closedPnlUsd = closedTrades.reduce((sum, item) => sum + item.pnlUsd, 0);
    const openRealizedPnlUsd = state.openPositions.reduce((sum, item) => sum + item.realizedPnlUsd, 0);
    const totalPnlUsd = closedPnlUsd + openRealizedPnlUsd;
    const totalFeesUsd = closedTrades.reduce((sum, item) => sum + item.feesUsd, 0) +
        state.openPositions.reduce((sum, item) => sum + item.realizedFeesUsd, 0);
    const wins = closedTrades.filter((item) => item.pnlUsd > 0).length;
    return {
        startingBalanceUsd: state.summary.startingBalanceUsd,
        balanceUsd: round(state.summary.startingBalanceUsd + totalPnlUsd, 2),
        closedTrades: closedTrades.length,
        openPositions: state.openPositions.length,
        winRate: closedTrades.length > 0 ? round(wins / closedTrades.length, 4) : 0,
        totalPnlUsd: round(totalPnlUsd, 2),
        totalFeesUsd: round(totalFeesUsd, 2),
        bestTradeUsd: closedTrades.length > 0 ? round(Math.max(...closedTrades.map((item) => item.pnlUsd)), 2) : 0,
        worstTradeUsd: closedTrades.length > 0 ? round(Math.min(...closedTrades.map((item) => item.pnlUsd)), 2) : 0,
        lastEventAt: state.summary.lastEventAt
    };
};
const closePosition = (state, position, exitPrice, closeReason, closedAt) => {
    const exitNotional = position.remainingQuantity * exitPrice;
    const exitFee = exitNotional * feeRate;
    const remainingPnl = (exitPrice - position.entryPrice) * position.remainingQuantity - exitFee;
    const totalPnl = position.realizedPnlUsd + remainingPnl;
    const totalFees = position.realizedFeesUsd + exitFee;
    const trade = {
        id: node_crypto_1.default.randomUUID(),
        symbol: position.symbol,
        timeframe: position.timeframe,
        openedAt: position.openedAt,
        closedAt,
        entryPrice: position.entryPrice,
        exitPrice: round(exitPrice, 8),
        quantity: round(position.quantity, 6),
        pnlUsd: round(totalPnl, 2),
        pnlPct: position.entryPrice > 0 ? round((totalPnl / (position.entryPrice * position.quantity)) * 100, 2) : 0,
        feesUsd: round(totalFees, 2),
        closeReason,
        tp1Hit: position.tp1Hit
    };
    state.openPositions = state.openPositions.filter((item) => item.id !== position.id);
    state.closedTrades.unshift(trade);
    state.closedTrades = state.closedTrades.slice(0, config_1.config.paperMaxClosedTrades);
    state.summary.lastEventAt = closedAt;
};
class PaperTradingService {
    getState() {
        return storage_1.storageService.getPaperState();
    }
    reset() {
        const next = {
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
            lastResetAt: new Date().toISOString()
        };
        next.summary = buildSummary(next);
        storage_1.storageService.savePaperState(next);
        return next;
    }
    processSignal(signal) {
        const state = storage_1.storageService.getPaperState();
        const key = `${signal.symbol}:${signal.timeframe}`;
        const existing = state.openPositions.find((item) => `${item.symbol}:${item.timeframe}` === key);
        const sameSymbolPosition = state.openPositions.find((item) => item.symbol === signal.symbol);
        const now = signal.createdAt;
        if (existing) {
            const candleLow = signal.candle?.low ?? signal.price;
            const candleHigh = signal.candle?.high ?? signal.price;
            const ageMs = new Date(now).getTime() - new Date(existing.openedAt).getTime();
            if (candleLow <= existing.stopLoss) {
                closePosition(state, existing, existing.stopLoss, 'STOP', now);
            }
            else {
                if (!existing.tp1Hit && candleHigh >= existing.takeProfit1) {
                    const partialQuantity = existing.remainingQuantity / 2;
                    const exitNotional = partialQuantity * existing.takeProfit1;
                    const exitFee = exitNotional * feeRate;
                    const partialPnl = (existing.takeProfit1 - existing.entryPrice) * partialQuantity - exitFee;
                    existing.remainingQuantity = round(existing.remainingQuantity - partialQuantity, 6);
                    existing.realizedPnlUsd = round(existing.realizedPnlUsd + partialPnl, 2);
                    existing.realizedFeesUsd = round(existing.realizedFeesUsd + exitFee, 2);
                    existing.stopLoss = Math.max(existing.stopLoss, existing.entryPrice);
                    existing.tp1Hit = true;
                    existing.updatedAt = now;
                    state.summary.lastEventAt = now;
                }
                if (candleHigh >= existing.takeProfit2) {
                    closePosition(state, existing, existing.takeProfit2, 'TAKE_PROFIT_2', now);
                }
                else {
                    const exitAgeReached = ageMs >= getMinExitAgeMs(existing.timeframe);
                    const severeExit = signal.recommendation === 'EXIT' &&
                        signal.score <= 0 &&
                        signal.price < existing.entryPrice &&
                        exitAgeReached;
                    const protectedProfitExit = existing.tp1Hit && signal.recommendation === 'EXIT' && ageMs >= 15 * 60 * 1000;
                    const weakLongStillLosing = !existing.tp1Hit &&
                        exitAgeReached &&
                        signal.price < existing.entryPrice &&
                        signal.score < 2.4 &&
                        signal.recommendation !== 'BUY_NOW';
                    if (protectedProfitExit || severeExit || weakLongStillLosing) {
                        closePosition(state, existing, signal.price, 'EXIT_SIGNAL', now);
                    }
                }
            }
        }
        else if (signal.recommendation === 'BUY_NOW' &&
            signal.tradePlan &&
            !sameSymbolPosition &&
            higherTimeframeAllowsLong(signal) &&
            !hasRecentTradeCooldown(state, signal) &&
            state.openPositions.length < maxOpenPositions) {
            const entryPrice = signal.price;
            const quantity = signal.tradePlan.suggestedPositionUnits;
            const entryFee = entryPrice * quantity * feeRate;
            if (quantity > 0 && entryPrice > 0) {
                state.openPositions.unshift({
                    id: node_crypto_1.default.randomUUID(),
                    symbol: signal.symbol,
                    timeframe: signal.timeframe,
                    signalId: signal.id,
                    openedAt: now,
                    updatedAt: now,
                    entryPrice: round(entryPrice, 8),
                    quantity: round(quantity, 6),
                    remainingQuantity: round(quantity, 6),
                    stopLoss: signal.tradePlan.stopLoss,
                    takeProfit1: signal.tradePlan.takeProfit1,
                    takeProfit2: signal.tradePlan.takeProfit2,
                    tp1Hit: false,
                    realizedPnlUsd: round(-entryFee, 2),
                    realizedFeesUsd: round(entryFee, 2),
                    status: 'OPEN',
                    entryComment: signal.tradePlan.entryComment
                });
                state.summary.lastEventAt = now;
            }
        }
        state.summary = buildSummary(state);
        storage_1.storageService.savePaperState(state);
        return state;
    }
}
exports.PaperTradingService = PaperTradingService;
exports.paperTradingService = new PaperTradingService();
