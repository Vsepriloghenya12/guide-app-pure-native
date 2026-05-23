import { useRef, useState, type TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { TipDetailModal } from '../common/TipDetailModal';
import { stayPrograms } from '../../data/programs';
import type { GuideCategory, GuideCollection, GuideTip, HomeSectionTitles } from '../../types';
import { recordGuideAnalytics } from '../../utils/analytics';
import { getCategoryTone, getQuickMenuFallbackImage, getQuickMenuImage } from './homeVisuals';

type FeatureGridProps = {
  featuredCategories: GuideCategory[];
  allCategories: GuideCategory[];
  heroBanners: GuideCollection[];
  tips: GuideTip[];
  sectionTitles: HomeSectionTitles;
};

export function FeatureGrid({
  featuredCategories: _featuredCategories,
  allCategories,
  heroBanners,
  tips,
  sectionTitles
}: FeatureGridProps) {
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [heroMotion, setHeroMotion] = useState<'next' | 'prev'>('next');
  const [selectedTip, setSelectedTip] = useState<GuideTip | null>(null);
  const heroTouchStartX = useRef<number | null>(null);
  const blockHeroClick = useRef(false);
  const visibleTips = tips.slice(0, 5);
  const programDurations = stayPrograms.slice(0, 3);
  const heroBannerCount = heroBanners.length;
  const normalizedHeroIndex =
    heroBannerCount > 0 ? ((activeHeroIndex % heroBannerCount) + heroBannerCount) % heroBannerCount : 0;
  const activeHeroBanner = heroBannerCount > 0 ? heroBanners[normalizedHeroIndex] : null;
  const leftHeroBanner =
    heroBannerCount > 1
      ? heroBanners[(normalizedHeroIndex - 1 + heroBannerCount) % heroBannerCount]
      : null;
  const rightHeroBanner =
    heroBannerCount > 1
      ? heroBanners[(normalizedHeroIndex + 1) % heroBannerCount]
      : null;

  const moveHeroBanner = (direction: 'prev' | 'next') => {
    if (heroBannerCount < 2) {
      return;
    }

    setHeroMotion(direction);
    setActiveHeroIndex((current) =>
      direction === 'next'
        ? (current + 1) % heroBannerCount
        : (current - 1 + heroBannerCount) % heroBannerCount
    );
  };

  const handleHeroTouchStart = (event: TouchEvent<HTMLElement>) => {
    heroTouchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleHeroTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (heroTouchStartX.current === null) {
      return;
    }

    const deltaX = (event.changedTouches[0]?.clientX ?? 0) - heroTouchStartX.current;
    heroTouchStartX.current = null;

    if (Math.abs(deltaX) < 36) {
      return;
    }

    blockHeroClick.current = true;
    moveHeroBanner(deltaX < 0 ? 'next' : 'prev');
    window.setTimeout(() => {
      blockHeroClick.current = false;
    }, 180);
  };

  return (
    <section className="travel-home-sections">
      {activeHeroBanner ? (
        <section className="travel-section travel-section--home-banner" aria-label="Баннер">
          <div
            className={`travel-home-banner-stack travel-home-banner-stack--${heroMotion}`}
            onTouchStart={handleHeroTouchStart}
            onTouchEnd={handleHeroTouchEnd}
          >
            {leftHeroBanner ? (
              <button
                type="button"
                className="travel-home-banner-peek travel-home-banner-peek--left"
                aria-label={`Показать баннер: ${leftHeroBanner.title}`}
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(9, 19, 38, 0.18) 0%, rgba(9, 19, 38, 0.68) 100%), url(${leftHeroBanner.imageSrc || '/home-hero-background.png'})`
                }}
                onClick={() => moveHeroBanner('prev')}
              />
            ) : null}

            <Link
              key={`${activeHeroBanner.id}-${normalizedHeroIndex}`}
              to={activeHeroBanner.linkPath}
              className={`travel-home-hero-banner travel-home-hero-banner--${heroMotion}`}
              data-tone="bridge"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(9, 19, 38, 0.2) 0%, rgba(9, 19, 38, 0.76) 100%), url(${activeHeroBanner.imageSrc || '/home-hero-background.png'})`
              }}
              onClick={(event) => {
                if (blockHeroClick.current) {
                  event.preventDefault();
                  return;
                }

                recordGuideAnalytics({
                  kind: 'collection-click',
                  label: activeHeroBanner.title,
                  path: activeHeroBanner.linkPath,
                  entityId: activeHeroBanner.id
                });
              }}
            >
              <strong>{activeHeroBanner.title}</strong>
              <span className="travel-home-hero-banner__description">{activeHeroBanner.description}</span>
            </Link>

            {rightHeroBanner ? (
              <button
                type="button"
                className="travel-home-banner-peek travel-home-banner-peek--right"
                aria-label={`Показать баннер: ${rightHeroBanner.title}`}
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(9, 19, 38, 0.18) 0%, rgba(9, 19, 38, 0.68) 100%), url(${rightHeroBanner.imageSrc || '/home-hero-background.png'})`
                }}
                onClick={() => moveHeroBanner('next')}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {allCategories.length > 0 ? (
        <section className="travel-section travel-section--quick travel-section--quick-home" aria-label="Быстрые рубрики">
          <div className="travel-quick-grid travel-quick-grid--four travel-quick-grid--home-icons">
            {allCategories.map((category, index) => (
              <Link
                key={category.id}
                to={category.path}
                className="travel-quick-photo travel-quick-photo--icon-only"
                data-category-id={category.id}
                data-tone={getCategoryTone(category)}
                onClick={() =>
                  recordGuideAnalytics({
                    kind: 'category-click',
                    label: category.title,
                    path: category.path,
                    entityId: category.id,
                    categoryId: category.id
                  })
                }
              >
                <span className="travel-quick-photo__disc" aria-hidden="true">
                  <img
                    src={getQuickMenuImage(category, index)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      const fallbackSrc = getQuickMenuFallbackImage(index);
                      if (event.currentTarget.src.endsWith(fallbackSrc)) {
                        return;
                      }
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = fallbackSrc;
                    }}
                  />
                </span>
                <span className="travel-quick-photo__label">{category.shortTitle || category.title}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="travel-section travel-section--programs-home" aria-label="Готовые программы">
        <Link to="/programs" className="travel-programs-spotlight" data-tone="bridge">
          <span className="travel-programs-spotlight__eyebrow">Готовые программы</span>
          <strong>Подбери сценарий отдыха по сроку поездки</strong>
          <p>
            Открой готовые варианты для короткого отпуска, недели у моря и более длинного отдыха,
            не собирая маршрут вручную.
          </p>

          <span className="travel-programs-spotlight__chips" aria-label="Длительности поездки">
            {programDurations.map((program) => (
              <span key={program.id} className="travel-programs-spotlight__chip">
                {program.stayLabel}
              </span>
            ))}
          </span>

          <span className="travel-programs-spotlight__action">
            Открыть программы <span aria-hidden="true">›</span>
          </span>
        </Link>
      </section>
      {visibleTips.length > 0 ? (
        <section className="travel-section travel-section--stories-home">
          <div className="travel-section__header travel-section__header--home">
            <h2>{sectionTitles.tips || 'Советы'}</h2>
            <Link to="/help">Открыть</Link>
          </div>

          <div className="travel-story-list travel-story-list--plain">
            {visibleTips.map((item) => (
              <button
                key={item.id}
                className="travel-story-row travel-story-row--no-arrow travel-story-row--tip"
                data-tone="emerald"
                type="button"
                onClick={() =>
                  {
                    recordGuideAnalytics({
                      kind: 'tip-click',
                      label: item.title,
                      path: item.linkPath,
                      entityId: item.id
                    });
                    setSelectedTip(item);
                  }
                }
              >
                <span
                  className="travel-story-row__thumb"
                  style={{ backgroundImage: 'url(/home-hero-background.png)' }}
                  aria-hidden="true"
                />
                <span className="travel-story-row__body">
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedTip ? (
        <TipDetailModal
          title={selectedTip.title}
          text={selectedTip.text}
          onClose={() => setSelectedTip(null)}
        />
      ) : null}
    </section>
  );
}
