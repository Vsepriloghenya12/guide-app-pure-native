declare global {
  interface Window {
    __GUIDE_BOOT_READY__?: boolean;
  }
}

export function isBootReady() {
  return typeof window !== 'undefined' && window.__GUIDE_BOOT_READY__ === true;
}

export function setBootReady(value: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  window.__GUIDE_BOOT_READY__ = value;
}
