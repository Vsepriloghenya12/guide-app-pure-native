import type { CSSProperties } from 'react';
import type { GuideCategoryId } from '../../types';

type CategoryIconProps = {
  categoryId: GuideCategoryId;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
};

type Palette = {
  primary: string;
  secondary: string;
};

const fallbackPalette: Palette = { primary: '#ece8e2', secondary: '#a79a86' };

const paletteMap: Record<string, Palette> = {
  restaurants: { primary: '#f3e7d2', secondary: '#d0b184' },
  wellness: { primary: '#dbf2ea', secondary: '#7bc2ae' },
  'active-rest': { primary: '#e6efd5', secondary: '#9dc567' },
  hotels: { primary: '#eaecff', secondary: '#8e99dc' },
  events: { primary: '#f7dfeb', secondary: '#ca81a5' },
  atm: { primary: '#f8eac8', secondary: '#d7b064' },
  shops: { primary: '#fae2d8', secondary: '#da8e73' },
  'bulletin-board': { primary: '#e6e2f8', secondary: '#8b7ec7' },
  culture: { primary: '#ece2f8', secondary: '#a083d0' },
  kids: { primary: '#faedd4', secondary: '#d8a972' },
  medicine: { primary: '#dff3ed', secondary: '#64bba7' },
  'photo-spots': { primary: '#e3efff', secondary: '#78abdf' },
  'car-rental': { primary: '#e3e9f8', secondary: '#8599c7' },
  coworkings: { primary: '#e5f0ff', secondary: '#7e9fda' },
  misc: { primary: '#ece8e2', secondary: '#a79a86' }
};

function IconShape({ categoryId }: { categoryId: GuideCategoryId }) {
  switch (categoryId) {
    case 'restaurants':
      return (
        <>
          <path d="M11 6h2v12h-2zM15 6h2v12h-2zM19 6h2v12h-2zM15 18h4v8h-4z" fill="currentColor" />
          <path d="M26 6c3.3 0 6 2.7 6 6v14h-4V6h-2Z" fill="currentColor" opacity="0.95" />
        </>
      );
    case 'wellness':
      return (
        <>
          <path d="M20 8c2.2 0 4 2 4 4.4 0 1-.3 2-.9 2.8 2.8.7 4.9 3.2 4.9 6.2 0 4.2-3.6 7.6-8 7.6s-8-3.4-8-7.6c0-3 2.1-5.5 4.9-6.2a4.9 4.9 0 0 1-.9-2.8C16 10 17.8 8 20 8Z" fill="currentColor" />
          <path d="M20 4c1.6 2 2.4 3.8 2.4 5.5 0 1.7-.8 3.3-2.4 4.8-1.6-1.5-2.4-3.1-2.4-4.8S18.4 6 20 4Z" fill="var(--icon-secondary)" />
        </>
      );
    case 'active-rest':
      return (
        <>
          <circle cx="24" cy="7" r="3" fill="currentColor" />
          <path d="M12 26l6-8 4 3 6-9 3 2-7.5 12H20l-3.5-3.2L14 26Z" fill="currentColor" />
        </>
      );
    case 'hotels':
      return (
        <>
          <path d="M9 26V8h14v18h-4v-5h-6v5Z" fill="currentColor" />
          <path d="M23 12h8v14h-8z" fill="var(--icon-secondary)" />
          <path d="M12 11h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z" fill="#08111c" opacity="0.7" />
        </>
      );
    case 'events':
      return (
        <>
          <rect x="8" y="9" width="24" height="19" rx="4" fill="currentColor" />
          <rect x="8" y="14" width="24" height="4" fill="#08111c" opacity="0.28" />
          <path d="M14 5h3v6h-3zm9 0h3v6h-3z" fill="var(--icon-secondary)" />
        </>
      );
    case 'atm':
      return (
        <>
          <rect x="8" y="8" width="24" height="18" rx="4" fill="currentColor" />
          <rect x="12" y="12" width="9" height="3" rx="1.5" fill="#08111c" opacity="0.28" />
          <rect x="12" y="18" width="6" height="3" rx="1.5" fill="#08111c" opacity="0.28" />
          <path d="M25 12h4v10h-4z" fill="var(--icon-secondary)" />
        </>
      );
    case 'shops':
      return (
        <>
          <path d="M10 12h20l-1.8 14H11.8L10 12Z" fill="currentColor" />
          <path d="M14 12V9a6 6 0 0 1 12 0v3h-4V9a2 2 0 1 0-4 0v3Z" fill="var(--icon-secondary)" />
        </>
      );
    case 'bulletin-board':
      return (
        <>
          <rect x="9" y="7" width="22" height="20" rx="4" fill="currentColor" />
          <path d="M14 12h12v2H14zm0 5h9v2h-9zm0 5h7v2h-7z" fill="#08111c" opacity="0.28" />
          <circle cx="27" cy="12" r="2.2" fill="var(--icon-secondary)" />
        </>
      );
    case 'culture':
      return (
        <>
          <path d="M7 13h26L20 6 7 13Zm3 2h3v10h-3zm8 0h4v10h-4zm9 0h3v10h-3ZM8 27h24v3H8Z" fill="currentColor" />
        </>
      );
    case 'kids':
      return <path d="M20 6l10 6-10 6-10-6 10-6Zm0 13 8 4.7V29l-8-4.5L12 29v-5.3L20 19Z" fill="currentColor" />;
    case 'medicine':
      return (
        <>
          <rect x="9" y="7" width="22" height="22" rx="5" fill="currentColor" />
          <path d="M18 12h4v5h5v4h-5v5h-4v-5h-5v-4h5z" fill="#08111c" opacity="0.28" />
        </>
      );
    case 'photo-spots':
      return (
        <>
          <rect x="8" y="10" width="24" height="16" rx="4" fill="currentColor" />
          <circle cx="20" cy="18" r="4.5" fill="var(--icon-secondary)" />
          <path d="M13 10l2-3h10l2 3" fill="currentColor" />
        </>
      );
    case 'car-rental':
      return (
        <>
          <path d="M10 20l2.4-6c.6-1.5 2-2.5 3.6-2.5h8c1.6 0 3 .9 3.6 2.5L30 20H10Z" fill="currentColor" />
          <path d="M9 21h22v3H9z" fill="var(--icon-secondary)" />
          <circle cx="14" cy="25" r="2.4" fill="#08111c" opacity="0.75" />
          <circle cx="26" cy="25" r="2.4" fill="#08111c" opacity="0.75" />
        </>
      );
    case 'coworkings':
      return (
        <>
          <rect x="8" y="12" width="24" height="10" rx="2" fill="currentColor" />
          <path d="M12 10h16v2H12zm2 12h3v5h-3zm9 0h3v5h-3z" fill="var(--icon-secondary)" />
          <rect x="14" y="8" width="12" height="2" rx="1" fill="var(--icon-secondary)" />
        </>
      );
    case 'misc':
      return (
        <>
          <circle cx="12" cy="16" r="3" fill="currentColor" />
          <circle cx="20" cy="16" r="3" fill="var(--icon-secondary)" />
          <circle cx="28" cy="16" r="3" fill="currentColor" />
          <rect x="10" y="23" width="20" height="2" rx="1" fill="var(--icon-secondary)" opacity="0.8" />
        </>
      );
    default:
      return <circle cx="20" cy="16" r="8" fill="currentColor" />;
  }
}

export function CategoryIcon({ categoryId, size = 'md', className = '', title }: CategoryIconProps) {
  const palette = paletteMap[categoryId] || fallbackPalette;
  const style = {
    ['--icon-primary' as string]: palette.primary,
    ['--icon-secondary' as string]: palette.secondary,
    color: palette.primary
  } as CSSProperties;

  return (
    <span
      className={`category-icon category-icon--${size} ${className}`.trim()}
      style={style}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      <svg viewBox="0 0 40 32" className="category-icon__svg" xmlns="http://www.w3.org/2000/svg">
        <IconShape categoryId={categoryId} />
      </svg>
    </span>
  );
}
