import { memo, useEffect, useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { OwnerAnalyticsPanel } from '../components/owner/OwnerAnalyticsPanel';
import { OwnerBannerManager } from '../components/owner/OwnerBannerManager';
import { OwnerBulletinModerationPanel } from '../components/owner/OwnerBulletinModerationPanel';
import { OwnerContactsManager } from '../components/owner/OwnerContactsManager';
import { OwnerPlacesManager } from '../components/owner/OwnerPlacesManager';
import { OwnerTipsManager } from '../components/owner/OwnerTipsManager';
import { useGuideContent } from '../hooks/useGuideContent';
import { OWNER_AUTH_REQUIRED_EVENT } from '../utils/ownerEvents';

type OwnerTabId = 'places' | 'moderation' | 'banners' | 'tips' | 'contacts' | 'analytics';

const ownerTabs: Array<{ id: OwnerTabId; label: string }> = [
  { id: 'places', label: 'Карточки' },
  { id: 'moderation', label: 'Модерация' },
  { id: 'banners', label: 'Баннеры' },
  { id: 'tips', label: 'Советы' },
  { id: 'contacts', label: 'Контакты' },
  { id: 'analytics', label: 'Клики' }
];

const MemoOwnerAnalyticsPanel = memo(OwnerAnalyticsPanel);
const MemoOwnerBannerManager = memo(OwnerBannerManager);
const MemoOwnerBulletinModerationPanel = memo(OwnerBulletinModerationPanel);
const MemoOwnerContactsManager = memo(OwnerContactsManager);
const MemoOwnerPlacesManager = memo(OwnerPlacesManager);
const MemoOwnerTipsManager = memo(OwnerTipsManager);

function isOwnerTabId(value: string | null): value is OwnerTabId {
  return ownerTabs.some((tab) => tab.id === value);
}

export function OwnerPage() {
  const navigate = useNavigate();
  const { places, categories, tips, collections, home, analytics } = useGuideContent({ scope: 'owner' });
  const [activeTab, setActiveTab] = useState<OwnerTabId>(() => {
    if (typeof window === 'undefined') {
      return 'places';
    }

    const savedTab = window.localStorage.getItem('owner-active-tab');
    return isOwnerTabId(savedTab) ? savedTab : 'places';
  });
  const [visitedTabs, setVisitedTabs] = useState<OwnerTabId[]>(() => [activeTab]);
  const [pendingTabId, setPendingTabId] = useState<OwnerTabId | null>(null);
  const [isTabPending, startTabTransition] = useTransition();

  useEffect(() => {
    const handleAuthRequired = () => {
      navigate('/owner-login', { replace: true, state: { from: '/owner' } });
    };

    window.addEventListener(OWNER_AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(OWNER_AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, [navigate]);

  useEffect(() => {
    window.localStorage.setItem('owner-active-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    setVisitedTabs((current) =>
      current.includes(activeTab) ? current : [...current, activeTab]
    );
  }, [activeTab]);

  useEffect(() => {
    setPendingTabId(null);
  }, [activeTab]);

  const handleTabChange = (tabId: OwnerTabId) => {
    if (tabId === activeTab) {
      return;
    }

    setVisitedTabs((current) => (current.includes(tabId) ? current : [...current, tabId]));
    setPendingTabId(tabId);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    startTabTransition(() => {
      setActiveTab(tabId);
    });
  };

  const renderPanel = (tabId: OwnerTabId) => {
    if (tabId === 'places') {
      return <MemoOwnerPlacesManager items={places} categories={categories} />;
    }

    if (tabId === 'moderation') {
      return <MemoOwnerBulletinModerationPanel items={places} />;
    }

    if (tabId === 'tips') {
      return <MemoOwnerTipsManager tips={tips} />;
    }

    if (tabId === 'banners') {
      return <MemoOwnerBannerManager home={home} collections={collections} />;
    }

    if (tabId === 'contacts') {
      return <MemoOwnerContactsManager />;
    }

    return <MemoOwnerAnalyticsPanel events={analytics.events} categories={categories} places={places} />;
  };

  const tabButtonClassName = (tabId: OwnerTabId) => {
    const activeClassName = activeTab === tabId ? ' is-active' : '';
    return `button button--ghost owner-controls__tab${activeClassName}`;
  };

  const activeTabLabel = ownerTabs.find((tab) => tab.id === activeTab)?.label ?? 'Раздел';
  const pendingTabLabel =
    ownerTabs.find((tab) => tab.id === pendingTabId)?.label ?? activeTabLabel;

  const activePanel = visitedTabs.map((tabId) => (
    <div
      key={tabId}
      className="owner-tab-panel"
      hidden={activeTab !== tabId}
      aria-hidden={activeTab !== tabId}
      data-tab-id={tabId}
    >
      {renderPanel(tabId)}
    </div>
  ));
  return (
    <div className="owner-page owner-page--minimal">
      <section className="owner-controls">
        <nav className="owner-controls__tabs" aria-label="Разделы управления">
          {ownerTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tabButtonClassName(tab.id)}
              aria-pressed={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </section>

      <div className="owner-page__panel" aria-busy={isTabPending}>
        {isTabPending ? (
          <div className="owner-tab-switch-indicator" role="status" aria-live="polite">
            Открываю раздел: {pendingTabLabel}
          </div>
        ) : null}
        {activePanel}
      </div>
    </div>
  );
}
