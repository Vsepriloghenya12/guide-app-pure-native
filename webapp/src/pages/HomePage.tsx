import { useMemo, useState } from 'react';
import { FeatureGrid } from '../components/home/FeatureGrid';
import { HomeHero } from '../components/home/HomeHero';
import { useGuideContent } from '../hooks/useGuideContent';
import { usePageMeta } from '../hooks/usePageMeta';
import type { GuideCategory, GuideCollection, GuideTip } from '../types';

function dedupeHomeCategories(categories: GuideCategory[]) {
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();

  return categories.filter((category) => {
    const labelKey = String(category.shortTitle || category.title || '').trim().toLowerCase();

    if (seenIds.has(category.id) || (labelKey && seenLabels.has(labelKey))) {
      return false;
    }

    seenIds.add(category.id);
    if (labelKey) {
      seenLabels.add(labelKey);
    }
    return true;
  });
}

function buildProgramsShortcut(): GuideCategory {
  return {
    id: 'programs',
    title: 'Маршруты',
    path: '/programs',
    description: 'Готовые маршруты и сценарии отдыха по сроку поездки.',
    visible: true,
    showOnHome: true,
    slug: 'programs',
    shortTitle: 'Маршруты',
    accent: 'bridge',
    imageSrc: '',
    filterSchema: {
      quickFilters: [],
      fields: []
    },
    sortOrder: 82
  };
}

function withProgramsShortcut(categories: GuideCategory[]) {
  if (categories.some((category) => category.id === 'programs')) {
    return categories;
  }

  const shortcut = buildProgramsShortcut();
  const insertAfterId = 'active-rest';
  const insertIndex = categories.findIndex((category) => category.id === insertAfterId);

  if (insertIndex < 0) {
    return [...categories, shortcut];
  }

  return [...categories.slice(0, insertIndex + 1), shortcut, ...categories.slice(insertIndex + 1)];
}

function seededSortKey(value: string, seed: number) {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function shuffleBySeed<T extends { id: string }>(items: T[], seed: number) {
  return [...items].sort((left, right) => {
    const leftKey = seededSortKey(left.id, seed);
    const rightKey = seededSortKey(right.id, seed);
    return leftKey - rightKey || left.id.localeCompare(right.id, 'ru');
  });
}

export function HomePage() {
  const hiddenHomeCategoryIds = new Set(['events']);
  const [tipShuffleSeed] = useState(() => Date.now());

  usePageMeta({
    title: 'Danang Guide',
    description: 'Главная страница с местами, категориями, советами и программами в Дананге.'
  });
  const { categories, tips, collections, home, loading, error } = useGuideContent();

  const activeCategories = categories.filter((category: GuideCategory) => category.visible);
  const homeCategories = dedupeHomeCategories(
    withProgramsShortcut(activeCategories.filter((category: GuideCategory) => !hiddenHomeCategoryIds.has(category.id)))
  );
  const visibleTips = useMemo(
    () =>
      shuffleBySeed(
        home.tipIds
          .map((id: string) => tips.find((tip: GuideTip) => tip.id === id && tip.active))
          .filter((tip): tip is GuideTip => Boolean(tip)),
        tipShuffleSeed
      ),
    [home.tipIds, tipShuffleSeed, tips]
  );
  const heroBanners = home.collectionIds
    .map((id: string) => collections.find((collection: GuideCollection) => collection.id === id && collection.active))
    .filter((collection): collection is GuideCollection => Boolean(collection));
  return (
    <div className="page-stack home-page home-page--open reference-home-page">
      {loading ? <div className="panel page-loader">Загружаю главную страницу…</div> : null}
      {error ? (
        <div className="panel empty-state empty-state--left">
          <strong>Временные трудности с загрузкой</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="home-hero-bleed">
        <HomeHero />
      </div>
      <FeatureGrid
        featuredCategories={homeCategories}
        allCategories={homeCategories}
        heroBanners={heroBanners}
        tips={visibleTips}
        sectionTitles={home.sectionTitles}
      />
    </div>
  );
}
