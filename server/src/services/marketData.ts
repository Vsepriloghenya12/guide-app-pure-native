import axios from 'axios';
import { config } from '../config';
import { Candle, MarketSnapshot } from '../types';

interface BybitKlineResponse {
  retCode: number;
  retMsg: string;
  result?: {
    list: string[][];
  };
}

interface BybitTickersResponse {
  retCode: number;
  retMsg: string;
  result?: {
    list: Array<{
      symbol: string;
      lastPrice: string;
      turnover24h: string;
      volume24h: string;
      fundingRate?: string;
      bid1Price?: string;
      ask1Price?: string;
    }>;
  };
}

const bybitClient = axios.create({
  baseURL: 'https://api.bybit.com',
  timeout: 15_000
});

const toNumber = (value: string | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export class MarketDataService {
  public async fetchCandles(symbol: string, interval: string, limit = 240): Promise<Candle[]> {
    let attempts = 0;

    while (attempts < 3) {
      attempts += 1;

      const response = await bybitClient.get<BybitKlineResponse>('/v5/market/kline', {
        params: {
          category: config.bybitCategory,
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

  public async fetchUniverse(): Promise<{
    totalSymbols: number;
    eligibleSymbols: number;
    items: MarketSnapshot[];
  }> {
    const response = await bybitClient.get<BybitTickersResponse>('/v5/market/tickers', {
      params: {
        category: config.bybitCategory
      }
    });

    const payload = response.data;

    if (payload.retCode !== 0 || !payload.result?.list) {
      throw new Error(`Ошибка Bybit при получении списка инструментов: ${payload.retMsg}`);
    }

    const totalSymbols = payload.result.list.length;

    const filtered = payload.result.list
      .filter((item) => item.symbol.endsWith(config.quoteCoin))
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
        } satisfies MarketSnapshot;
      })
      .filter((item) => item.lastPrice > 0)
      .filter((item) => item.turnover24hUsd >= config.minTurnover24hUsd)
      .filter((item) => item.spreadPct <= config.maxSpreadPct)
      .sort((left, right) => right.turnover24hUsd - left.turnover24hUsd)
      .slice(0, config.maxSymbolsToAnalyze)
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

export const marketDataService = new MarketDataService();
