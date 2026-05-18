"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketDataService = exports.MarketDataService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const bybitClient = axios_1.default.create({
    baseURL: 'https://api.bybit.com',
    timeout: 15_000
});
const toNumber = (value) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};
class MarketDataService {
    async fetchCandles(symbol, interval, limit = 240) {
        let attempts = 0;
        while (attempts < 3) {
            attempts += 1;
            const response = await bybitClient.get('/v5/market/kline', {
                params: {
                    category: config_1.config.bybitCategory,
                    symbol,
                    interval,
                    limit
                }
            });
            const payload = response.data;
            if (payload.retCode === 0 && payload.result?.list) {
                return payload.result.list
                    .map((item) => ({
                    timestamp: Number(item[0]),
                    open: Number(item[1]),
                    high: Number(item[2]),
                    low: Number(item[3]),
                    close: Number(item[4]),
                    volume: Number(item[5])
                }))
                    .sort((left, right) => left.timestamp - right.timestamp);
            }
            const isRateLimit = payload.retCode === 10006 || payload.retMsg?.toLowerCase().includes('rate limit');
            if (isRateLimit && attempts < 3) {
                await new Promise((resolve) => setTimeout(resolve, 4_000 * attempts));
                continue;
            }
            throw new Error(`Ошибка Bybit для ${symbol}/${interval}: ${payload.retMsg}`);
        }
        throw new Error(`Ошибка Bybit для ${symbol}/${interval}: не удалось получить свечи`);
    }
    async fetchUniverse() {
        const response = await bybitClient.get('/v5/market/tickers', {
            params: {
                category: config_1.config.bybitCategory
            }
        });
        const payload = response.data;
        if (payload.retCode !== 0 || !payload.result?.list) {
            throw new Error(`Ошибка Bybit при получении списка инструментов: ${payload.retMsg}`);
        }
        const totalSymbols = payload.result.list.length;
        const filtered = payload.result.list
            .filter((item) => item.symbol.endsWith(config_1.config.quoteCoin))
            .map((item) => {
            const lastPrice = toNumber(item.lastPrice);
            const turnover24hUsd = toNumber(item.turnover24h);
            const volume24h = toNumber(item.volume24h);
            const bid = toNumber(item.bid1Price);
            const ask = toNumber(item.ask1Price);
            const spreadPct = bid > 0 && ask > 0 ? ((ask - bid) / ((ask + bid) / 2)) * 100 : 999;
            return {
                symbol: item.symbol,
                rank24h: 0,
                turnover24hUsd,
                volume24h,
                spreadPct,
                lastPrice,
                fundingRate: item.fundingRate ? toNumber(item.fundingRate) : null
            };
        })
            .filter((item) => item.lastPrice > 0)
            .filter((item) => item.turnover24hUsd >= config_1.config.minTurnover24hUsd)
            .filter((item) => item.spreadPct <= config_1.config.maxSpreadPct)
            .sort((left, right) => right.turnover24hUsd - left.turnover24hUsd)
            .slice(0, config_1.config.maxSymbolsToAnalyze)
            .map((item, index) => ({
            ...item,
            rank24h: index + 1
        }));
        return {
            totalSymbols,
            eligibleSymbols: filtered.length,
            items: filtered
        };
    }
}
exports.MarketDataService = MarketDataService;
exports.marketDataService = new MarketDataService();
