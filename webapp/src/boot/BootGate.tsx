import { useEffect, type PropsWithChildren } from 'react';
import { setBootReady } from './bootState';

let warmupPromise: Promise<void> | null = null;

const bootAssets = [
  '/icons/icon-512.png',
  '/icons/icon-512.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
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
