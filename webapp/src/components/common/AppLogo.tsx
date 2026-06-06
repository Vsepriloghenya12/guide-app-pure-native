import { useEffect, useMemo, useState } from 'react';
import type { HomeLogoMedia } from '../../types';

type AppLogoProps = {
  className?: string;
  alt?: string;
  media?: HomeLogoMedia | null;
};

type LogoCandidate = {
  type: 'image' | 'video';
  src: string;
  posterSrc?: string;
};

const LOGO_CANDIDATES: LogoCandidate[] = [
  { type: 'image', src: '/icons/icon-512.png' },
  { type: 'image', src: '/icons/icon-512.png' }
];

function isVideoSource(src: string) {
  return /\.(mp4|webm|mov)$/i.test(src);
}

function normalizeMedia(media: HomeLogoMedia | null | undefined): LogoCandidate | null {
  if (!media?.src) {
    return null;
  }

  return {
    type: media.type || (isVideoSource(media.src) ? 'video' : 'image'),
    src: media.src,
    posterSrc: media.posterSrc || undefined
  };
}

export function AppLogo({ className, alt = 'Логотип Danang Guide', media }: AppLogoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [brokenMediaSrc, setBrokenMediaSrc] = useState('');

  const explicitAsset = useMemo(() => normalizeMedia(media), [media]);
  const currentAsset = useMemo(() => {
    if (explicitAsset) {
      return explicitAsset.src === brokenMediaSrc ? null : explicitAsset;
    }

    return LOGO_CANDIDATES[currentIndex] ?? null;
  }, [brokenMediaSrc, currentIndex, explicitAsset]);

  useEffect(() => {
    setBrokenMediaSrc('');
  }, [explicitAsset?.src]);

  const advanceFallback = () => {
    if (explicitAsset?.src) {
      setBrokenMediaSrc(explicitAsset.src);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
  };

  const wrapperClassName = ['app-logo', className].filter(Boolean).join(' ');

  return (
    <span className={wrapperClassName}>
      {currentAsset?.type === 'video' ? (
        <video
          className="app-logo-media"
          src={currentAsset.src}
          poster={currentAsset.posterSrc}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
          aria-label={alt}
          onError={advanceFallback}
        />
      ) : currentAsset ? (
        <img className="app-logo-media" src={currentAsset.src} alt={alt} decoding="async" onError={advanceFallback} />
      ) : null}
    </span>
  );
}
