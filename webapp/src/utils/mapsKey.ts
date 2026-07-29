// Single source of the Google Maps browser key. The value comes from the
// VITE_GOOGLE_MAPS_API_KEY env var (set in Railway for production builds and in
// a local .env for development) — never hardcode keys in source.
export const GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

if (!GOOGLE_MAPS_API_KEY && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn('VITE_GOOGLE_MAPS_API_KEY is not set — maps will not load. Add it to webapp/.env');
}
