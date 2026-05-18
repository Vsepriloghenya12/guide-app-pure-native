import { config } from '../config';
import { MarketSnapshot } from '../types';
import { analysisService } from './analysisService';
import { marketDataService } from './marketData';
import { storageService } from './storage';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const runWithConcurrency = async <T>(items: T[], limit: number, handler: (item: T) => Promise<void>): Promise<void> => {
  const queue = [...items];

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        return;
      }
      await handler(item);
      await sleep(350);
    }
  });

  await Promise.all(workers);
};

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  public start(): void {
    this.ensureTimer();

    if (storageService.getAnalyzerState().scanEnabled) {
      this.runCycle().catch((error) => {
        console.error('Первый запуск планировщика завершился ошибкой:', error);
      });
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    storageService.updateAnalyzerState({ isRunning: false });
  }

  public pause(): void {
    this.stop();
    storageService.updateAnalyzerState({
      scanEnabled: false,
      pausedAt: new Date().toISOString(),
      isRunning: false
    });
  }

  public resume(): void {
    storageService.updateAnalyzerState({
      scanEnabled: true,
      pausedAt: null,
      lastError: null
    });
    this.start();
  }

  public isEnabled(): boolean {
    return storageService.getAnalyzerState().scanEnabled;
  }

  public async runNow(): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Сканер сейчас выключен. Сначала включите его.');
    }
    await this.runCycle();
  }

  private ensureTimer(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      if (!this.isEnabled()) {
        return;
      }

      this.runCycle().catch((error) => {
        console.error('Плановый цикл завершился ошибкой:', error);
      });
    }, config.scanIntervalMs);
  }

  private async runCycle(): Promise<void> {
    if (this.running || !this.isEnabled()) {
      return;
    }

    this.running = true;
    storageService.updateAnalyzerState({ isRunning: true, lastError: null });

    const errors: string[] = [];
    const analyzedSymbols = new Set<string>();

    try {
      const universe = await marketDataService.fetchUniverse();
      const timeframesByPriority = [...config.timeframes].sort((left, right) => Number(right) - Number(left));

      await runWithConcurrency(universe.items, 2, async (market) => {
        const snapshot: MarketSnapshot = {
          symbol: market.symbol,
          rank24h: market.rank24h,
          turnover24hUsd: market.turnover24hUsd,
          volume24h: market.volume24h,
          spreadPct: market.spreadPct,
          lastPrice: market.lastPrice,
          fundingRate: market.fundingRate
        };

        for (const timeframe of timeframesByPriority) {
          try {
            await analysisService.analyze(snapshot, timeframe);
            analyzedSymbols.add(market.symbol);
          } catch (error) {
            const message = `${market.symbol}/${timeframe}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(`Ошибка анализа ${message}`);
            errors.push(message);
          }
        }
      });

      const completedAt = new Date().toISOString();

      storageService.updateUniverseState({
        fetchedAt: completedAt,
        totalSymbols: universe.totalSymbols,
        eligibleSymbols: universe.eligibleSymbols,
        analyzedSymbols: analyzedSymbols.size,
        topSymbols: universe.items.map((item) => item.symbol),
        minTurnoverUsd: config.minTurnover24hUsd,
        maxSymbolsToAnalyze: config.maxSymbolsToAnalyze
      });

      storageService.updateAnalyzerState({
        lastRunAt: completedAt,
        runCount: storageService.getAnalyzerState().runCount + 1,
        lastError: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown scheduler error';
      storageService.updateAnalyzerState({ lastError: message });
      throw error;
    } finally {
      this.running = false;
      storageService.updateAnalyzerState({ isRunning: false });
    }
  }
}

export const schedulerService = new SchedulerService();
