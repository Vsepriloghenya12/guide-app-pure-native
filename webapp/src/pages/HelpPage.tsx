import { useMemo, useState } from 'react';
import { TipDetailModal } from '../components/common/TipDetailModal';
import { PageHeader } from '../components/layout/PageHeader';
import { helpFaq } from '../data/supportContent';
import { usePageMeta } from '../hooks/usePageMeta';

function seededSortKey(value: string, seed: number) {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function HelpPage() {
  const [selectedTip, setSelectedTip] = useState<(typeof helpFaq)[number] | null>(null);
  const [shuffleSeed] = useState(() => Date.now());

  const visibleTips = useMemo(
    () =>
      [...helpFaq].sort((left, right) => {
        const leftKey = seededSortKey(left.id, shuffleSeed);
        const rightKey = seededSortKey(right.id, shuffleSeed);
        return leftKey - rightKey || left.id.localeCompare(right.id, 'ru');
      }),
    [shuffleSeed]
  );

  usePageMeta({
    title: 'Советы',
    description: 'Короткие подсказки по приложению, офлайн-режиму, избранному, картам и быстрым переходам.'
  });

  return (
    <div className="page-stack travel-page travel-page--tips">
      <PageHeader
        title="Советы"
        subtitle="Открой любой совет и прочитай полную подсказку без перехода на другой экран."
        showBack
      />

      <section className="travel-section travel-section--stories-home travel-section--tips-page">
        <div className="travel-section__header">
          <h2>Все советы</h2>
          <span>{visibleTips.length} подсказок</span>
        </div>

        <div className="travel-story-list travel-story-list--plain" role="list">
          {visibleTips.map((item) => (
            <button
              key={item.id}
              className="travel-story-row travel-story-row--no-arrow travel-story-row--tip"
              data-tone="emerald"
              role="listitem"
              type="button"
              onClick={() => setSelectedTip(item)}
            >
              <span
                className="travel-story-row__thumb"
                style={{ backgroundImage: 'url(/home-hero-background.png)' }}
                aria-hidden="true"
              />
              <span className="travel-story-row__body">
                <strong>{item.question}</strong>
                <span>{item.answer}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {selectedTip ? (
        <TipDetailModal
          title={selectedTip.question}
          text={selectedTip.answer}
          onClose={() => setSelectedTip(null)}
        />
      ) : null}
    </div>
  );
}
