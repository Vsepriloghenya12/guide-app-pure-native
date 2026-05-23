import { useMemo } from 'react';
import { resetGuideAnalytics } from '../../utils/analytics';
import type { GuideAnalyticsEvent, GuideCategory, GuidePlace } from '../../types';

type OwnerAnalyticsPanelProps = {
  events: GuideAnalyticsEvent[];
  categories: GuideCategory[];
  places: GuidePlace[];
};

type AggregateRow = {
  key: string;
  label: string;
  count: number;
};

function aggregate(items: GuideAnalyticsEvent[], keyBuilder: (event: GuideAnalyticsEvent) => string, labelBuilder: (event: GuideAnalyticsEvent) => string) {
  const map = new Map<string, AggregateRow>();

  items.forEach((event) => {
    const key = keyBuilder(event);
    const existing = map.get(key);

    if (existing) {
      existing.count += 1;
      return;
    }

    map.set(key, { key, label: labelBuilder(event), count: 1 });
  });

  return [...map.values()].sort((left, right) => right.count - left.count);
}

export function OwnerAnalyticsPanel({ events, categories, places }: OwnerAnalyticsPanelProps) {
  const pageViews = events.filter((event) => event.kind === 'page-view');
  const clickEvents = events.filter((event) => event.kind !== 'page-view');
  const websiteClicks = events.filter((event) => event.kind === 'website-click');
  const phoneClicks = events.filter((event) => event.kind === 'phone-click');

  const topPages = useMemo(
    () => aggregate(pageViews, (event) => event.path, (event) => event.label).slice(0, 8),
    [pageViews]
  );

  const topClicks = useMemo(
    () => aggregate(clickEvents, (event) => `${event.kind}:${event.entityId ?? event.path}:${event.label}`, (event) => event.label).slice(0, 10),
    [clickEvents]
  );

  const topCategories = useMemo(() => {
    const relevant = events.filter((event) => event.categoryId);
    const rows = aggregate(
      relevant,
      (event) => event.categoryId ?? 'unknown',
      (event) => categories.find((category) => category.id === event.categoryId)?.title ?? event.categoryId ?? 'Без категории'
    );
    return rows.slice(0, 8);
  }, [categories, events]);

  const topPlaces = useMemo(() => {
    const relevant = events.filter((event) => event.entityId && (event.kind === 'place-click' || event.kind === 'website-click' || event.kind === 'phone-click'));
    const rows = aggregate(
      relevant,
      (event) => event.entityId ?? event.label,
      (event) => places.find((place) => place.id === event.entityId)?.title ?? event.label
    );
    return rows.slice(0, 8);
  }, [events, places]);

  const recentEvents = [...events].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 20);

  return (
    <section className="owner-cms-section">
      <div className="owner-cms-section__header">
        <div>
          <span className="eyebrow">CMS / аналитика</span>
          <h2>Переходы и клики пользователей</h2>
          <p>
            Здесь видно, куда пользователи заходят чаще всего: какие страницы открывают, какие
            категории выбирают и по каким карточкам кликают.
          </p>
        </div>
        <button className="button button--ghost button--danger" type="button" onClick={resetGuideAnalytics}>
          Очистить аналитику
        </button>
      </div>

      <div className="owner-summary-grid owner-summary-grid--compact">
        <article className="owner-summary-card">
          <span className="owner-module__label">Всего событий</span>
          <h3>{events.length}</h3>
          <p>Все просмотры страниц и клики по внутренним блокам.</p>
        </article>
        <article className="owner-summary-card">
          <span className="owner-module__label">Просмотры</span>
          <h3>{pageViews.length}</h3>
          <p>Сколько раз открывали разделы и экраны приложения.</p>
        </article>
        <article className="owner-summary-card">
          <span className="owner-module__label">Клики</span>
          <h3>{clickEvents.length}</h3>
          <p>Баннеры, категории, советы, карточки и внешние кнопки.</p>
        </article>
        <article className="owner-summary-card">
          <span className="owner-module__label">Контакты</span>
          <h3>{websiteClicks.length} сайт / {phoneClicks.length} звонок</h3>
          <p>Можно понять, какие карточки реально приводят к действию.</p>
        </article>
      </div>

      {events.length === 0 ? (
        <div className="owner-editor-card owner-analytics-empty">
          <h3>Пока нет данных</h3>
          <p>Открой публичную часть приложения и покликай по баннерам, категориям и карточкам — данные появятся здесь.</p>
        </div>
      ) : (
        <div className="owner-cms-layout owner-cms-layout--stack">
          <div className="owner-selection-grid">
            <article className="owner-selection-card">
              <h3>Куда заходят чаще</h3>
              <div className="owner-analytics-list">
                {topPages.map((row) => (
                  <div key={row.key} className="owner-analytics-row">
                    <span>{row.label}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="owner-selection-card">
              <h3>Самые кликабельные блоки</h3>
              <div className="owner-analytics-list">
                {topClicks.map((row) => (
                  <div key={row.key} className="owner-analytics-row">
                    <span>{row.label}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="owner-selection-card">
              <h3>Популярные категории</h3>
              <div className="owner-analytics-list">
                {topCategories.map((row) => (
                  <div key={row.key} className="owner-analytics-row">
                    <span>{row.label}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="owner-selection-card">
              <h3>Карточки с действиями</h3>
              <div className="owner-analytics-list">
                {topPlaces.map((row) => (
                  <div key={row.key} className="owner-analytics-row">
                    <span>{row.label}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="owner-editor-card">
            <div className="owner-editor-list__head">
              <strong>Последние действия</strong>
              <span>Последние 20 событий</span>
            </div>
            <div className="owner-analytics-events">
              {recentEvents.map((event) => (
                <div key={event.id} className="owner-analytics-event">
                  <div>
                    <strong>{event.label}</strong>
                    <p>{event.kind} · {event.path}</p>
                  </div>
                  <time dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString('ru-RU')}
                  </time>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
