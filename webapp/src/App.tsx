import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  downloadFullExport,
  HealthResponse,
  OpportunitiesResponse,
  PaperState,
  PushStatusResponse,
  SignalItem
} from './api';

type DashboardState = {
  health: HealthResponse;
  opportunities: OpportunitiesResponse;
  paper: PaperState;
  latestSignals: SignalItem[];
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type AppTab = 'signals' | 'demo' | 'history' | 'settings';

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);

const formatPrice = (value: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: value >= 1000 ? 2 : value >= 1 ? 4 : 8 }).format(value);

const formatPercent = (value: number): string => `${formatMoney(value * 100)}%`;

const formatDateTime = (value: string | null): string => (value ? new Date(value).toLocaleString('ru-RU') : '—');

const timeframeLabel = (value: string): string => {
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric < 60 ? `${numeric}м` : `${numeric / 60}ч`;
  }
  return value;
};

const recommendationText: Record<SignalItem['recommendation'], string> = {
  BUY_NOW: 'Купить',
  WAIT: 'Ждать',
  EXIT: 'Не брать'
};

const recommendationClass: Record<SignalItem['recommendation'], string> = {
  BUY_NOW: 'buy',
  WAIT: 'wait',
  EXIT: 'exit'
};

const isStandaloneApp = (): boolean => {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
};

const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }
  return output;
};

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Этот браузер не поддерживает service worker.');
  }

  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

function EmptyState({ title }: { title: string }) {
  return <div className="empty-state">{title}</div>;
}

function MetricTile({ label, value, strong = false }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className={`metric-tile ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SignalRow({ item, featured = false }: { item: SignalItem; featured?: boolean }) {
  const plan = item.tradePlan;

  return (
    <article className={`signal-row ${featured ? 'featured' : ''}`}>
      <div className="row-main">
        <div className="symbol-stack">
          <div className="symbol-line">
            <strong>{item.symbol}</strong>
            <span>{timeframeLabel(item.timeframe)}</span>
          </div>
          <span className="muted">{formatDateTime(item.createdAt)}</span>
        </div>
        <div className={`status-pill ${recommendationClass[item.recommendation]}`}>
          {recommendationText[item.recommendation]}
        </div>
      </div>

      {plan ? (
        <div className="trade-plan-strip">
          <div><span>Вход</span><strong>{formatPrice(plan.entryMin)}–{formatPrice(plan.entryMax)}</strong></div>
          <div><span>Стоп</span><strong>{formatPrice(plan.stopLoss)}</strong></div>
          <div><span>TP1</span><strong>{formatPrice(plan.takeProfit1)}</strong></div>
          <div><span>TP2</span><strong>{formatPrice(plan.takeProfit2)}</strong></div>
        </div>
      ) : null}

      <div className="row-footer">
        <span>Цена {formatPrice(item.price)}</span>
        <span>Сила {formatPercent(item.confidence)}</span>
        {plan ? <span>Риск ${formatMoney(plan.riskAmountUsd)}</span> : null}
      </div>
    </article>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatusResponse | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('signals');

  const load = useCallback(async () => {
    try {
      const [health, opportunities, paper, latest, push] = await Promise.all([
        api.getHealth(),
        api.getOpportunities(),
        api.getPaper(),
        api.getSignalsLatest(),
        api.getPushStatus()
      ]);
      setData({ health, opportunities, paper, latestSignals: latest.items });
      setPushStatus(push);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки');
    }
  }, []);

  useEffect(() => {
    registerServiceWorker().catch((swError) => {
      console.warn('Service worker не зарегистрирован:', swError);
    });

    setInstalled(isStandaloneApp());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      setBusy(true);
      setMessage(label);
      await action();
      await load();
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : 'Действие не выполнено');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const runPushAction = async (action: () => Promise<string>) => {
    try {
      setPushBusy(true);
      setPushMessage(null);
      const result = await action();
      setPushMessage(result);
      const nextStatus = await api.getPushStatus();
      setPushStatus(nextStatus);
    } catch (actionError) {
      setPushMessage(actionError instanceof Error ? actionError.message : 'Действие с push-уведомлениями не выполнено');
    } finally {
      setPushBusy(false);
    }
  };

  const handleRefreshNow = () => runAction('Анализ рынка...', api.runAnalyzeNow);

  const handleToggleScanner = () => {
    if (!data) return;
    const nextEnabled = !data.health.analyzer.scanEnabled;
    runAction(nextEnabled ? 'Сканер включён' : 'Сканер остановлен', () => api.setScannerEnabled(nextEnabled));
  };

  const handleResetPaper = () => {
    const confirmed = window.confirm('Сбросить демо-счёт?');
    if (!confirmed) return;
    runAction('Демо-счёт сброшен', api.resetPaper);
  };

  const handleInstall = () => runPushAction(async () => {
    if (!installPrompt) {
      throw new Error('Установка доступна через меню браузера: “Добавить на главный экран”.');
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      return 'Приложение установлено.';
    }
    return 'Установка отменена.';
  });

  const handleEnablePush = () => runPushAction(async () => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      throw new Error('Браузер не поддерживает push-уведомления для PWA.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Разрешение на уведомления не выдано.');
    }

    const { enabled, publicKey } = await api.getPushPublicKey();
    if (!enabled || !publicKey) {
      throw new Error('Push выключен на сервере.');
    }

    const registration = await registerServiceWorker();
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await api.subscribePush(subscription.toJSON());
    const test = await api.sendPushTest();
    return test.sent > 0 ? 'Push включён. Тест отправлен.' : 'Push включён.';
  });

  const handleDisablePush = () => runPushAction(async () => {
    const registration = await registerServiceWorker();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await api.unsubscribePush(subscription.endpoint);
      await subscription.unsubscribe();
    }
    return 'Push отключён.';
  });

  const handleTestPush = () => runPushAction(async () => {
    const result = await api.sendPushTest();
    return `Тест: ${result.sent}/${result.failed}`;
  });

  const fallbackSignals = useMemo(
    () => data?.latestSignals.filter((item) => item.recommendation !== 'EXIT').slice(0, 6) ?? [],
    [data]
  );
  const notificationPermission = 'Notification' in window ? Notification.permission : 'unsupported';

  if (error) {
    return <main className="app-shell"><EmptyState title={error} /></main>;
  }

  if (!data) {
    return <main className="app-shell"><EmptyState title="Загрузка..." /></main>;
  }

  const { health, opportunities, paper, latestSignals } = data;
  const scannerStatus = health.analyzer.isRunning ? 'Сканирует' : health.analyzer.scanEnabled ? 'Включён' : 'Выключен';
  const waitItems = opportunities.wait.length > 0 ? opportunities.wait : fallbackSignals;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <span className="app-label">AI Market Scanner</span>
          <h1>Сигналы</h1>
        </div>
        <button className="icon-button" onClick={handleRefreshNow} disabled={busy || !health.analyzer.scanEnabled}>↻</button>
      </header>

      <div className="status-strip">
        <MetricTile label="Сканер" value={scannerStatus} strong={health.analyzer.scanEnabled} />
        <MetricTile label="Купить" value={opportunities.buyNow.length} strong={opportunities.buyNow.length > 0} />
        <MetricTile label="Баланс" value={`$${formatMoney(paper.summary.balanceUsd)}`} />
      </div>

      {message ? <div className="toast-line">{message}</div> : null}
      {health.analyzer.lastError ? <div className="toast-line error">{health.analyzer.lastError}</div> : null}

      {activeTab === 'signals' ? (
        <section className="tab-screen">
          <div className="section-head compact">
            <h2>Купить сейчас</h2>
            <span>{formatDateTime(health.analyzer.lastRunAt)}</span>
          </div>
          <div className="list-stack">
            {opportunities.buyNow.length > 0 ? (
              opportunities.buyNow.slice(0, 10).map((item, index) => <SignalRow key={item.id} item={item} featured={index === 0} />)
            ) : (
              <EmptyState title="Сигналов на покупку нет" />
            )}
          </div>

          <div className="section-head compact with-margin">
            <h2>Наблюдать</h2>
            <span>{waitItems.length}</span>
          </div>
          <div className="list-stack">
            {waitItems.slice(0, 8).map((item) => <SignalRow key={item.id} item={item} />)}
            {waitItems.length === 0 ? <EmptyState title="Идей пока нет" /> : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'demo' ? (
        <section className="tab-screen">
          <div className="money-panel">
            <span>Демо-счёт</span>
            <strong>${formatMoney(paper.summary.balanceUsd)}</strong>
            <div className="money-grid">
              <div><span>PnL</span><b className={paper.summary.totalPnlUsd >= 0 ? 'positive' : 'negative'}>${formatMoney(paper.summary.totalPnlUsd)}</b></div>
              <div><span>Win</span><b>{formatPercent(paper.summary.winRate)}</b></div>
              <div><span>Открыто</span><b>{paper.summary.openPositions}</b></div>
            </div>
          </div>

          <div className="section-head compact with-margin">
            <h2>Открытые сделки</h2>
            <button className="text-button danger-text" onClick={handleResetPaper} disabled={busy}>Сброс</button>
          </div>

          <div className="list-stack">
            {paper.openPositions.map((position) => (
              <article className="trade-row" key={position.id}>
                <div className="row-main">
                  <div className="symbol-line"><strong>{position.symbol}</strong><span>{timeframeLabel(position.timeframe)}</span></div>
                  <span className={position.tp1Hit ? 'status-pill buy' : 'status-pill wait'}>{position.tp1Hit ? 'TP1' : 'Открыта'}</span>
                </div>
                <div className="trade-plan-strip">
                  <div><span>Вход</span><strong>{formatPrice(position.entryPrice)}</strong></div>
                  <div><span>Стоп</span><strong>{formatPrice(position.stopLoss)}</strong></div>
                  <div><span>TP1</span><strong>{formatPrice(position.takeProfit1)}</strong></div>
                  <div><span>TP2</span><strong>{formatPrice(position.takeProfit2)}</strong></div>
                </div>
              </article>
            ))}
            {paper.openPositions.length === 0 ? <EmptyState title="Открытых сделок нет" /> : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'history' ? (
        <section className="tab-screen">
          <div className="section-head compact">
            <h2>История</h2>
            <button className="text-button" onClick={downloadFullExport}>Экспорт</button>
          </div>
          <div className="history-stack">
            {paper.closedTrades.slice(0, 80).map((trade) => (
              <article className="history-item" key={trade.id}>
                <div>
                  <strong>{trade.symbol}</strong>
                  <span>{timeframeLabel(trade.timeframe)} · {trade.closeReason}</span>
                </div>
                <div>
                  <strong className={trade.pnlUsd >= 0 ? 'positive' : 'negative'}>${formatMoney(trade.pnlUsd)}</strong>
                  <span>{formatPrice(trade.entryPrice)} → {formatPrice(trade.exitPrice)}</span>
                </div>
              </article>
            ))}
            {paper.closedTrades.length === 0 ? <EmptyState title="История пустая" /> : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <section className="tab-screen">
          <div className="settings-list">
            <div className="settings-row">
              <div><strong>Сканер</strong><span>{scannerStatus}</span></div>
              <button className="text-button" onClick={handleToggleScanner} disabled={busy}>{health.analyzer.scanEnabled ? 'Остановить' : 'Включить'}</button>
            </div>
            <div className="settings-row">
              <div><strong>Приложение</strong><span>{installed ? 'Установлено' : 'Не установлено'}</span></div>
              <button className="text-button" onClick={handleInstall} disabled={pushBusy || installed}>Установить</button>
            </div>
            <div className="settings-row">
              <div><strong>Push</strong><span>{notificationPermission === 'granted' ? 'Разрешены' : notificationPermission === 'denied' ? 'Запрещены' : 'Не включены'}</span></div>
              <button className="text-button" onClick={handleEnablePush} disabled={pushBusy || pushStatus?.enabled === false}>Включить</button>
            </div>
            <div className="settings-row">
              <div><strong>Тест push</strong><span>{pushStatus?.subscriptionsCount ?? 0} подписок</span></div>
              <button className="text-button" onClick={handleTestPush} disabled={pushBusy || (pushStatus?.subscriptionsCount ?? 0) === 0}>Тест</button>
            </div>
            <div className="settings-row">
              <div><strong>Push на этом устройстве</strong><span>{formatDateTime(pushStatus?.lastNotificationAt ?? null)}</span></div>
              <button className="text-button danger-text" onClick={handleDisablePush} disabled={pushBusy}>Отключить</button>
            </div>
          </div>
          {pushMessage ? <div className="toast-line">{pushMessage}</div> : null}
          {pushStatus?.enabled === false ? <div className="toast-line error">Push выключен на сервере</div> : null}
        </section>
      ) : null}

      <nav className="bottom-nav" aria-label="Основная навигация">
        <button className={activeTab === 'signals' ? 'active' : ''} onClick={() => setActiveTab('signals')}>Сигналы</button>
        <button className={activeTab === 'demo' ? 'active' : ''} onClick={() => setActiveTab('demo')}>Демо</button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>История</button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Ещё</button>
      </nav>
    </main>
  );
}
