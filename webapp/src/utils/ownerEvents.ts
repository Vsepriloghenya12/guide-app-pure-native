export const OWNER_AUTH_REQUIRED_EVENT = 'guide-owner-auth-required';

export function notifyOwnerAuthRequired() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(OWNER_AUTH_REQUIRED_EVENT));
}
