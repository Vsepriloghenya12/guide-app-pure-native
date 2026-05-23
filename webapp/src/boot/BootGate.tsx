import { useEffect, type PropsWithChildren } from 'react';
import { setBootReady } from './bootState';

let warmupPromise: Promise<void> | null = null;

const bootAssets = [
  '/home-hero-background.png',
  '/home-hero-logo-custom.png',
  '/home-hero-logo.png',
  '/logo.png',
  '/logo.svg',
  '/boot-logo/mountains.png',
  '/boot-logo/tower.png',
  '/boot-logo/bridge.png',
  '/boot-logo/wheel.png',
  '/boot-logo/wave.png',
  '/boot-logo/wordmark.png'
];

function preloadAsset(url: string) {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}

function warmBootAssets() {
  if (!warmupPromise) {
    warmupPromise = Promise.allSettled(bootAssets.map((asset) => preloadAsset(asset))).then(() => undefined);
  }

  return warmupPromise;
}

export function BootGate({ children }: PropsWithChildren) {
  useEffect(() => {
    setBootReady(true);
    void warmBootAssets();
  }, []);

  return <>{children}</>;
}
