import { NavLink } from 'react-router-dom';

type NavIconName = 'home' | 'search' | 'map' | 'heart' | 'help';

const items: Array<{ to: string; label: string; icon: NavIconName }> = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/search', label: 'Поиск', icon: 'search' },
  { to: '/map', label: 'Карта', icon: 'map' },
  { to: '/favorites', label: 'Избранное', icon: 'heart' },
  { to: '/contacts', label: 'Помощь', icon: 'help' }
];

function ClassicBottomNavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" className="bottom-nav__icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="currentColor" d="M12 3.6 3.8 10.3c-.33.27-.41.75-.18 1.12.24.36.72.5 1.1.32L6 11.1V19c0 1.1.9 2 2 2h2.9c.5 0 .9-.4.9-.9v-4.2h.4V20c0 .5.4.9.9.9H16c1.1 0 2-.9 2-2v-7.9l1.28.67c.38.18.86.04 1.1-.32.23-.37.15-.85-.18-1.12L12 3.6Z"/>
        </svg>
      );
    case 'search':
      return (
        <svg viewBox="0 0 24 24" className="bottom-nav__icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="currentColor" d="M10.4 4a6.4 6.4 0 1 0 3.95 11.43l3.5 3.5a1 1 0 0 0 1.42-1.41l-3.5-3.5A6.4 6.4 0 0 0 10.4 4Zm0 1.8a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Z"/>
        </svg>
      );
    case 'heart':
      return (
        <svg viewBox="0 0 24 24" className="bottom-nav__icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="currentColor" d="M12 20.8c-.17 0-.34-.04-.5-.13C8.16 18.85 4 15.77 4 10.97 4 8.2 6.18 6 8.83 6c1.42 0 2.72.62 3.57 1.67A4.72 4.72 0 0 1 15.97 6C18.8 6 21 8.24 21 10.97c0 4.8-4.45 7.88-8.48 9.7-.16.08-.34.12-.52.12Z"/>
        </svg>
      );
    case 'map':
      return (
        <svg viewBox="0 0 24 24" className="bottom-nav__icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="currentColor" d="M12 2.9A8.1 8.1 0 0 0 3.9 11c0 5.22 6.65 10.03 7.4 10.55.42.3.98.3 1.4 0 .76-.52 7.4-5.33 7.4-10.55A8.1 8.1 0 0 0 12 2.9Zm0 4.3a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Zm0 2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z"/>
        </svg>
      );
    case 'help':
      return (
        <svg viewBox="0 0 24 24" className="bottom-nav__icon-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path fill="currentColor" d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5A8.51 8.51 0 0 0 12 3.5Zm0 14.9a1.15 1.15 0 1 1 1.15-1.15A1.16 1.16 0 0 1 12 18.4Zm1.47-5.5-.45.27A1.73 1.73 0 0 0 12.2 14v.2a.7.7 0 0 1-1.4 0v-.25a2.98 2.98 0 0 1 1.5-2.36l.48-.29a1.55 1.55 0 1 0-2.33-1.34.7.7 0 0 1-1.4 0 2.95 2.95 0 1 1 4.42 2.57Z"/>
        </svg>
      );
    default:
      return null;
  }
}

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Нижняя навигация">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-nav__item${isActive ? ' is-active' : ''}`} end={item.to === '/'}>
          <span className="bottom-nav__icon-wrap">
            <ClassicBottomNavIcon name={item.icon} />
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
