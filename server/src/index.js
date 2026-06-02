const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const path = require('path');

loadEnvFile(path.resolve(__dirname, '../../.env'));

const {
  appendAnalyticsEvent,
  deleteCategory,
  deleteMediaFileRecord,
  deletePlace,
  ensureDatabase,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  getContentStore,
  getMediaFiles,
  getPlaceById,
  getPlaceBySlug,
  getPlaces,
  hasDatabase,
  normalizePlace,
  resetContentStore,
  readSupportContent,
  saveCollections,
  saveContentStore,
  saveHomeContent,
  saveMediaFileRecord,
  saveSupportContent,
  getUserFavorites,
  replaceUserFavorites,
  setUserFavorite,
  saveTips,
  syncDefaultContentStore,
  updateCollectionItems,
  upsertCategory,
  upsertPlace
} = require('./db');
const { readUserSession, registerPublicAuthRoutes } = require('./publicAuth');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value.replace(/\\n/g, '\n');
  }
}

const app = express();
const PORT = process.env.PORT || 8080;
const webDistPath = path.resolve(__dirname, '../../webapp/dist');
const defaultUploadsRoot = path.resolve(__dirname, '../../storage/uploads');
const uploadsRoot = resolveUploadsRoot();
const uploadsPublicBasePath = '/uploads';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || process.env.OWNER_PASSWOR || (process.env.NODE_ENV === 'production' ? '' : 'guide2026');
const OWNER_SESSION_SECRET = process.env.OWNER_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-guide-owner-secret');
const OWNER_COOKIE_NAME = 'guide_owner_session';
const OWNER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const GOOGLE_MAPS_SERVER_API_KEY = String(
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_GEOCODING_API_KEY ||
  process.env.PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  ''
).trim();
const DEFAULT_NATIVE_ORIGINS = [
  'exp://localhost:8081',
  'http://localhost:8081',
  'http://127.0.0.1:8081'
];

function parseCsvEnv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/g, ''))
    .filter(Boolean);
}

function normalizeSameSite(value) {
  const candidate = String(value || '').trim().toLowerCase();
  if (candidate === 'none') return 'None';
  if (candidate === 'strict') return 'Strict';
  return 'Lax';
}

const allowedCorsOrigins = new Set([
  ...DEFAULT_NATIVE_ORIGINS,
  ...parseCsvEnv(process.env.CORS_ALLOWED_ORIGINS),
  ...parseCsvEnv(process.env.PUBLIC_APP_URL)
]);
const OWNER_COOKIE_SAME_SITE = normalizeSameSite(process.env.COOKIE_SAME_SITE || process.env.OWNER_COOKIE_SAME_SITE || (process.env.NATIVE_APP_MODE === 'true' ? 'None' : 'Lax'));

function shouldUseSecureCookies() {
  return process.env.NODE_ENV === 'production' || OWNER_COOKIE_SAME_SITE === 'None' || process.env.COOKIE_SECURE === 'true';
}

function isAllowedCorsOrigin(origin) {
  const normalizedOrigin = String(origin || '').trim().replace(/\/+$/g, '');
  if (!normalizedOrigin) {
    return false;
  }

  if (allowedCorsOrigins.has(normalizedOrigin)) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
    return true;
  }

  return false;
}

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const requiredKeys = [
    'PUBLIC_APP_URL',
    'OWNER_PASSWORD',
    'OWNER_SESSION_SECRET',
    'AUTH_SESSION_SECRET'
  ];
  const missing = requiredKeys.filter((key) => !String(process.env[key] || '').trim());

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

validateProductionEnvironment();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedCorsOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use((req, res, next) => {
  if (req.method === 'GET' && ['/', '/index.html'].includes(req.path)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

registerPublicAuthRoutes(app);

function resolveUploadsRoot() {
  const configuredPath = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : '';
  const candidates = [configuredPath, defaultUploadsRoot].filter(Boolean);
  const tried = new Set();

  for (const candidate of candidates) {
    if (tried.has(candidate)) {
      continue;
    }
    tried.add(candidate);

    try {
      fs.mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch (error) {
      console.warn(`Could not use uploads directory "${candidate}":`, error instanceof Error ? error.message : error);
    }
  }

  throw new Error('Unable to initialize uploads directory.');
}


function ensureUploadsDirectory() {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

function sanitizeSegment(value, fallback = 'file') {
  return String(value || fallback)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || fallback;
}

function extensionForMimeType(mimeType) {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    default:
      return null;
  }
}

function parseUploadDataUrl(dataUrl) {
  const match = /^data:((?:image\/(?:jpeg|png|webp))|(?:video\/(?:mp4|webm|quicktime)));base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!match) {
    throw new Error('Поддерживаются JPG, PNG, WEBP, MP4, WEBM и MOV файлы.');
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
}

async function storeUploadedImage({ fileName, dataUrl, kind = 'general' }) {
  ensureUploadsDirectory();
  const { mimeType, buffer } = parseUploadDataUrl(dataUrl);
  const extension = extensionForMimeType(mimeType);

  if (!extension) {
    throw new Error('Неподдерживаемый формат файла.');
  }

  const maxBytes = mimeType.startsWith('video/') ? 20 * 1024 * 1024 : 8 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new Error(mimeType.startsWith('video/') ? 'Видео слишком большое. Максимум 20 MB.' : 'Файл слишком большой после сжатия. Максимум 8 MB.');
  }

  const safeKind = sanitizeSegment(kind, 'general');
  const monthSegment = new Date().toISOString().slice(0, 7);
  const relativeDir = path.join(safeKind, monthSegment);
  const absoluteDir = path.join(uploadsRoot, relativeDir);
  fs.mkdirSync(absoluteDir, { recursive: true });

  const finalName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const absolutePath = path.join(absoluteDir, finalName);
  fs.writeFileSync(absolutePath, buffer);

  const relativePath = path.posix.join(relativeDir.split(path.sep).join('/'), finalName);
  const publicUrl = `${uploadsPublicBasePath}/${relativePath}`;

  await saveMediaFileRecord({
    id: crypto.randomUUID(),
    kind: safeKind,
    fileName: String(fileName || finalName),
    mimeType,
    sizeBytes: buffer.length,
    storagePath: absolutePath,
    publicUrl
  });

  return {
    url: publicUrl,
    fileName: finalName,
    mimeType,
    sizeBytes: buffer.length
  };
}


function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((accumulator, chunk) => {
      const separatorIndex = chunk.indexOf('=');
      if (separatorIndex === -1) {
        return accumulator;
      }
      const key = chunk.slice(0, separatorIndex).trim();
      const value = chunk.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function createOwnerSessionValue() {
  const issuedAt = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', OWNER_SESSION_SECRET)
    .update(issuedAt)
    .digest('hex');

  return `${issuedAt}.${signature}`;
}

function isValidOwnerSession(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return false;
  }

  const [issuedAt, signature] = rawValue.split('.');
  if (!issuedAt || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', OWNER_SESSION_SECRET)
    .update(issuedAt)
    .digest('hex');

  const sameLength = signature.length === expectedSignature.length;
  const validSignature = sameLength
    ? crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    : false;

  if (!validSignature) {
    return false;
  }

  const ageMs = Date.now() - Number(issuedAt);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= OWNER_SESSION_TTL_SECONDS * 1000;
}

function setOwnerSessionCookie(res) {
  const cookieParts = [
    `${OWNER_COOKIE_NAME}=${encodeURIComponent(createOwnerSessionValue())}`,
    'Path=/',
    `Max-Age=${OWNER_SESSION_TTL_SECONDS}`,
    'HttpOnly',
    `SameSite=${OWNER_COOKIE_SAME_SITE}`
  ];

  if (shouldUseSecureCookies()) {
    cookieParts.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearOwnerSessionCookie(res) {
  const cookieParts = [
    `${OWNER_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    `SameSite=${OWNER_COOKIE_SAME_SITE}`
  ];

  if (shouldUseSecureCookies()) {
    cookieParts.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function isOwnerAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return isValidOwnerSession(cookies[OWNER_COOKIE_NAME]);
}

function requireOwner(req, res, next) {
  if (!isOwnerAuthenticated(req)) {
    res.status(401).json({ ok: false, message: 'Owner auth required' });
    return;
  }

  next();
}

function requirePublicUser(req, res, next) {
  const user = readUserSession(req);
  if (!user?.id) {
    res.status(401).json({ ok: false, message: 'Нужно войти в аккаунт.' });
    return;
  }

  req.publicUser = user;
  next();
}


function normalizePublicText(value, maxLength = 280) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function slugifyPublicValue(value, fallback = 'bulletin') {
  return String(value || fallback)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || fallback;
}

function parseCoordinatePart(value) {
  const parsed = Number(String(value || '').trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLatLngPair(latValue, lngValue) {
  const lat = parseCoordinatePart(latValue);
  const lng = parseCoordinatePart(lngValue);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  return { lat, lng };
}

function extractLatLngFromMapsInput(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  const atMatch = input.match(/@(-?\d+(?:[.,]\d+)?),\s*(-?\d+(?:[.,]\d+)?)/);
  if (atMatch) return parseLatLngPair(atMatch[1], atMatch[2]);

  const googlePlaceMatch = input.match(/!3d(-?\d+(?:[.,]\d+)?)!4d(-?\d+(?:[.,]\d+)?)/);
  if (googlePlaceMatch) return parseLatLngPair(googlePlaceMatch[1], googlePlaceMatch[2]);

  const queryMatch = input.match(/[?&](?:q|query|ll|center|destination)=(-?\d+(?:[.,]\d+)?),\s*(-?\d+(?:[.,]\d+)?)/i);
  if (queryMatch) return parseLatLngPair(queryMatch[1], queryMatch[2]);

  const plainPairMatch = input.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)\s*$/);
  if (plainPairMatch) return parseLatLngPair(plainPairMatch[1], plainPairMatch[2]);

  return null;
}

function parsePublicPriceNumber(value) {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (!digits) {
    return null;
  }

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePublicBulletinSection(value) {
  const normalized = normalizePublicText(value, 40);
  return ['Работа', 'Продажи', 'Услуги', 'Разное'].includes(normalized) ? normalized : 'Разное';
}

function normalizePublicBulletinSubcategory(section, value) {
  const options = {
    Работа: ['Вакансии', 'Резюме'],
    Продажи: ['Продам', 'Куплю', 'Обмен', 'Отдам'],
    Услуги: ['Красота', 'Ремонт', 'Обучение', 'Другое'],
    Разное: ['Находки', 'Встречи', 'Другое']
  };
  const normalized = normalizePublicText(value, 40);
  return (options[section] || options.Разное).includes(normalized) ? normalized : (options[section] || options.Разное)[0];
}

async function createPublicBulletinPayload(input, publicUser) {
  const title = normalizePublicText(input?.title, 90);
  const description = normalizePublicText(input?.description, 1600);
  const section = normalizePublicBulletinSection(input?.section);
  const subcategory = normalizePublicBulletinSubcategory(section, input?.subcategory);
  const priceLabel = normalizePublicText(input?.priceLabel, 80);
  const district = normalizePublicText(input?.district, 80);
  const phone = normalizePublicText(input?.phone, 80);
  const link = normalizePublicText(input?.link, 220);
  const contactName = normalizePublicText(input?.contactName, 80);
  const imageItems = Array.isArray(input?.images)
    ? input.images
    : Array.isArray(input?.imageDataUrls)
      ? input.imageDataUrls.map((dataUrl, index) => ({ dataUrl, fileName: `bulletin-photo-${index + 1}` }))
      : input?.imageDataUrl
        ? [{ dataUrl: input.imageDataUrl, fileName: input.imageFileName }]
        : [];
  const id = `bulletin-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const resolvedContactName = contactName || normalizePublicText(publicUser?.displayName, 80);
  const contactDetails = [resolvedContactName ? `Контакт: ${resolvedContactName}` : '', link ? `Ссылка: ${link}` : ''].filter(Boolean);
  const defaultImageUrl = '/home-icons/custom/bulletin-board.png';

  if (title.length < 3 || description.length < 10) {
    return { error: 'Заполни название и описание объявления.' };
  }

  if (!phone && !link) {
    return { error: 'Укажи телефон или ссылку для связи.' };
  }

  const uploadedImages = [];
  for (let index = 0; index < Math.min(imageItems.length, 6); index += 1) {
    const item = imageItems[index];
    const dataUrl = typeof item?.dataUrl === 'string' ? item.dataUrl : typeof item === 'string' ? item : '';
    if (!dataUrl) continue;
    const uploadedImage = await storeUploadedImage({
      fileName: normalizePublicText(item?.fileName, 120) || `bulletin-photo-${index + 1}`,
      dataUrl,
      kind: 'bulletin'
    });
    if (uploadedImage?.url) {
      uploadedImages.push(uploadedImage.url);
    }
  }

  const imageGallery = uploadedImages.length ? uploadedImages : [defaultImageUrl];
  const imageUrl = imageGallery[0] || defaultImageUrl;

  return {
    listing: {
      id,
      categoryId: 'bulletin-board',
      categorySlug: 'bulletin-board',
      slug: `${slugifyPublicValue(title)}-${id.slice(-8)}`,
      title,
      description,
      address: district,
      district,
      mapQuery: district,
      phone,
      website: link,
      hours: 'На модерации',
      avgCheck: parsePublicPriceNumber(priceLabel),
      priceLabel,
      kind: section,
      cuisine: subcategory,
      contactName: resolvedContactName,
      createdByUserId: String(publicUser?.id || '').trim(),
      services: contactDetails,
      tags: [section, subcategory],
      breakfast: false,
      vegan: false,
      pets: false,
      childPrograms: false,
      top: false,
      status: 'draft',
      sortOrder: 100,
      imageLabel: 'Фото объявления',
      imageSrc: imageUrl,
      imageGallery,
      imageUrls: imageGallery,
      hotelStars: null,
      hotelPool: false,
      hotelSpa: false,
      lat: null,
      lng: null
    }
  };
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : [];
}

function normalizeLegacyShopsLabel(value, categoryId) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  return categoryId === 'shops' && normalized.toLowerCase() === 'магазины' ? 'Покупки' : normalized;
}

function toListing(place) {
  const imageGallery = Array.isArray(place.imageGallery)
    ? place.imageGallery.filter((image) => typeof image === 'string' && image)
    : place.imageSrc
      ? [place.imageSrc]
      : [];

  const imageUrls = Array.isArray(place.imageUrls)
    ? place.imageUrls.filter((image) => typeof image === 'string' && image)
    : imageGallery;

  const categorySlug = place.categorySlug || place.categoryId;
  const slug = place.slug || `${categorySlug}-${place.id}`;
  const coverImageUrl = place.coverImageUrl || place.imageSrc || imageUrls[0] || '';
  const status = place.status || 'published';

  return {
    ...place,
    slug,
    categorySlug,
    featured: Boolean(place.featured ?? place.top),
    shortDescription: place.shortDescription || place.description,
    priceLabel: place.priceLabel || (typeof place.avgCheck === 'number' ? `от ${place.avgCheck}` : ''),
    listingType: normalizeLegacyShopsLabel(place.listingType || place.kind || '', place.categoryId),
    childFriendly: Boolean(place.childFriendly ?? place.childPrograms),
    petFriendly: Boolean(place.petFriendly ?? place.pets),
    mapQuery: place.mapQuery || place.address || '',
    extra: Array.isArray(place.extra) ? place.extra : normalizeStringArray(place.services),
    imageGallery,
    imageUrls,
    coverImageUrl,
    websiteUrl: place.websiteUrl || place.website || '',
    phoneNumber: place.phoneNumber || place.phone || '',
    hotelStars: typeof place.hotelStars === 'number' ? place.hotelStars : null,
    hotelPool: Boolean(place.hotelPool),
    hotelSpa: Boolean(place.hotelSpa),
    district: place.district || '',
    location: place.location || place.address || '',
    type: normalizeLegacyShopsLabel(place.type || place.kind || '', place.categoryId),
    status,
    moderationNote: String(place.moderationNote || '').trim(),
    sortOrder: Number(place.sortOrder || 0) || 0,
    lat: typeof place.lat === 'number' ? place.lat : null,
    lng: typeof place.lng === 'number' ? place.lng : null,
    visible: place.visible ?? status !== 'hidden'
  };
}

function matchesListing(listing, searchText) {
  if (!searchText) {
    return true;
  }

  const haystack = [
    listing.title,
    listing.description,
    listing.address,
    listing.kind,
    listing.cuisine,
    typeof listing.hotelStars === 'number' ? `${listing.hotelStars} звезд` : '',
    listing.hotelPool ? 'бассейн' : '',
    listing.hotelSpa ? 'спа' : '',
    ...(listing.tags || []),
    ...(listing.services || [])
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(searchText.toLowerCase());
}

function toBootstrapPayload(store) {
  return {
    categories: store.categories,
    listings: store.places.map(toListing),
    collections: store.collections,
    tips: store.tips,
    home: store.home
  };
}

function toPublicStore(store) {
  const visibleCategoryIds = new Set(store.categories.filter((category) => category.visible).map((category) => category.id));
  const places = store.places
    .filter((place) => place.status === 'published' && visibleCategoryIds.has(place.categoryId))
    .map(toListing);
  const activeTips = store.tips.filter((tip) => tip.active);
  const activeCollections = store.collections.filter((collection) => collection.active);

  return {
    version: store.version,
    categories: store.categories.filter((category) => category.visible),
    places,
    restaurants: places.filter((place) => place.categoryId === 'restaurants'),
    wellness: places.filter((place) => place.categoryId === 'wellness'),
    tips: activeTips,
    collections: activeCollections,
    home: {
      ...store.home,
      popularPlaceIds: store.home.popularPlaceIds.filter((id) => places.some((place) => place.id === id)),
      featuredCategoryIds: store.home.featuredCategoryIds.filter((id) => visibleCategoryIds.has(id)),
      tipIds: store.home.tipIds.filter((id) => activeTips.some((tip) => tip.id === id)),
      collectionIds: store.home.collectionIds.filter((id) => activeCollections.some((collection) => collection.id === id))
    },
    analytics: {
      events: []
    }
  };
  }

function toPublicBootstrapPayload(store) {
  const publicStore = toPublicStore(store);
  return {
    content: publicStore,
    categories: publicStore.categories,
    listings: publicStore.places,
    collections: publicStore.collections,
    tips: publicStore.tips,
    home: publicStore.home
  };
}

function getVisibleCategoryIdSet(categories) {
  return new Set(categories.filter((category) => category.visible).map((category) => category.id));
}

function isListingPubliclyVisible(listing, visibleCategoryIds) {
  return listing.status === 'published' && visibleCategoryIds.has(listing.categoryId);
}


function mergeCategoryPlaces(store, categoryId, incomingPlaces) {
  const normalizedIncoming = Array.isArray(incomingPlaces) ? incomingPlaces.map((item, index) => normalizePlace({ ...item, categoryId }, index)) : [];
  return {
    ...store,
    places: [...store.places.filter((place) => place.categoryId !== categoryId), ...normalizedIncoming]
  };
}


function normalizeIncomingCategory(incoming, currentCategory = null) {
  const id = String(incoming?.id || currentCategory?.id || incoming?.slug || incoming?.title || 'category').trim();
  const slug = String(incoming?.slug || currentCategory?.slug || id).trim();

  return {
    ...currentCategory,
    ...incoming,
    id,
    slug,
    path: String(incoming?.path || currentCategory?.path || `/section/${slug}`).trim(),
    title: String(incoming?.title || currentCategory?.title || id).trim(),
    shortTitle: String(incoming?.shortTitle || currentCategory?.shortTitle || incoming?.title || currentCategory?.title || id).trim(),
    badge: String(incoming?.badge ?? currentCategory?.badge ?? '').trim(),
    description: String(incoming?.description || currentCategory?.description || '').trim(),
    accent: String(incoming?.accent || currentCategory?.accent || 'coast').trim(),
    visible: incoming?.visible ?? currentCategory?.visible ?? true,
    showOnHome: incoming?.showOnHome ?? currentCategory?.showOnHome ?? false,
    filterSchema: {
      quickFilters: normalizeStringArray(incoming?.filterSchema?.quickFilters ?? currentCategory?.filterSchema?.quickFilters),
      fields: normalizeStringArray(incoming?.filterSchema?.fields ?? currentCategory?.filterSchema?.fields)
    },
    sortOrder: Number.isFinite(Number(incoming?.sortOrder)) ? Number(incoming.sortOrder) : Number.isFinite(Number(currentCategory?.sortOrder)) ? Number(currentCategory.sortOrder) : 100
  };
}

function normalizeIncomingListing(incoming, currentListing = null) {
  return normalizePlace(
    {
      ...currentListing,
      ...incoming,
      categoryId: incoming.categoryId || incoming.categorySlug || currentListing?.categoryId || 'restaurants',
      categorySlug: incoming.categorySlug || incoming.categoryId || currentListing?.categoryId || 'restaurants'
    },
    0,
    currentListing || undefined
  );
}

function getGoogleGeocodingBounds() {
  const bounds = String(process.env.GOOGLE_GEOCODING_BOUNDS || '15.93,108.05|16.19,108.33').trim();
  return bounds || '15.93,108.05|16.19,108.33';
}

async function geocodeAddress(query) {
  const address = String(query || '').trim();
  if (!address) {
    throw new Error('Введите адрес для поиска.');
  }

  const directPoint = extractLatLngFromMapsInput(address);
  if (directPoint) {
    return {
      address,
      formattedAddress: address,
      lat: directPoint.lat,
      lng: directPoint.lng,
      provider: 'coordinates'
    };
  }

  if (!GOOGLE_MAPS_SERVER_API_KEY) {
    throw new Error('На сервере не настроен GOOGLE_MAPS_API_KEY для поиска адресов.');
  }

  const params = new URLSearchParams({
    address,
    key: GOOGLE_MAPS_SERVER_API_KEY,
    language: 'ru',
    region: 'vn',
    bounds: getGoogleGeocodingBounds()
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    throw new Error('Google Geocoding не ответил. Попробуйте ещё раз.');
  }

  if (data.status !== 'OK' || !Array.isArray(data.results) || !data.results[0]?.geometry?.location) {
    const status = typeof data.status === 'string' ? data.status : 'UNKNOWN';
    throw new Error(status === 'ZERO_RESULTS' ? 'Адрес не найден.' : `Не удалось найти адрес: ${status}.`);
  }

  const result = data.results[0];
  const location = result.geometry.location;
  return {
    address,
    formattedAddress: String(result.formatted_address || address),
    lat: Number(location.lat),
    lng: Number(location.lng),
    provider: 'google'
  };
}

async function getOwnerSummaryPayload() {
  const store = await getContentStore();
  const pageViews = store.analytics?.events?.filter((event) => event.kind === 'page-view').length || 0;
  const clicks = store.analytics?.events?.filter((event) => event.kind !== 'page-view').length || 0;

  return {
    sections: store.categories.length,
    listingsReady: store.places.length,
    nativeApp: true,
    places: store.places.length,
    categories: store.categories.length,
    tips: store.tips.length,
    collections: store.collections.length,
    topPlaces: store.places.filter((place) => place.top).length,
    pageViews,
    clicks,
    storage: hasDatabase() ? 'postgresql' : 'memory'
  };
}


app.get('/api/health', async (_req, res) => {
  try {
    if (hasDatabase()) {
      await ensureDatabase();
    }

    res.json({
      ok: true,
      service: 'guide-app-server',
      database: hasDatabase() ? 'postgres' : 'disabled'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      service: 'guide-app-server',
      database: 'error',
      message: error instanceof Error ? error.message : 'Database init failed'
    });
  }
});

app.get('/api/content', requireOwner, async (_req, res) => {
  try {
    const store = await getContentStore();
    res.json({ ok: true, content: store });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load content' });
  }
});

app.get('/api/public/content', async (_req, res) => {
  try {
    const store = await getContentStore();
    res.json({ ok: true, content: toPublicStore(store) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load public content' });
  }
});

app.get('/api/support-content', async (_req, res) => {
  try {
    const content = await readSupportContent();
    res.json({ ok: true, content });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load support content' });
  }
});

app.put('/api/content', requireOwner, async (req, res) => {
  try {
    const store = await saveContentStore(req.body?.content ?? req.body ?? {});
    res.json({ ok: true, content: store });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save content' });
  }
});

app.put('/api/content/restaurants', requireOwner, async (req, res) => {
  try {
    const store = await getContentStore();
    const nextStore = await saveContentStore(mergeCategoryPlaces(store, 'restaurants', req.body?.restaurants));
    res.json({ ok: true, content: nextStore });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save restaurants' });
  }
});

app.put('/api/content/wellness', requireOwner, async (req, res) => {
  try {
    const store = await getContentStore();
    const nextStore = await saveContentStore(mergeCategoryPlaces(store, 'wellness', req.body?.wellness));
    res.json({ ok: true, content: nextStore });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save wellness' });
  }
});

app.put('/api/content/home', requireOwner, async (req, res) => {
  try {
    const store = await getContentStore();
    const nextStore = await saveContentStore({
      ...store,
      home: req.body?.home && typeof req.body.home === 'object' ? req.body.home : store.home
    });
    res.json({ ok: true, content: nextStore });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save home content' });
  }
});

app.post('/api/content/reset', requireOwner, async (_req, res) => {
  try {
    const store = await resetContentStore();
    res.json({ ok: true, content: store });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to reset content' });
  }
});

app.post('/api/owner/content/sync-default', requireOwner, async (_req, res) => {
  try {
    const result = await syncDefaultContentStore();
    res.json({ ok: true, content: result.content, seedHash: result.seedHash, storage: result.storage });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to sync default content' });
  }
});

app.post('/api/analytics', async (req, res) => {
  try {
    const event = req.body ?? {};
    if (!event.id || !event.kind || !event.label || !event.path || !event.createdAt) {
      res.status(400).json({ ok: false, message: 'Analytics event is incomplete' });
      return;
    }

    await appendAnalyticsEvent(event);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save analytics' });
  }
});

app.get('/api/owner/session', (req, res) => {
  res.json({ ok: true, authenticated: isOwnerAuthenticated(req) });
});

app.post('/api/owner/login', (req, res) => {
  const password = String(req.body?.password || '');

  if (password !== OWNER_PASSWORD) {
    res.status(401).json({ ok: false, authenticated: false, message: 'Invalid password' });
    return;
  }

  setOwnerSessionCookie(res);
  res.json({ ok: true, authenticated: true });
});

app.post('/api/owner/logout', (_req, res) => {
  clearOwnerSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/owner/bootstrap', requireOwner, async (_req, res) => {
  try {
    const store = await getContentStore();
    res.json({ ok: true, content: store, ...toBootstrapPayload(store) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load owner bootstrap' });
  }
});

app.get('/api/owner/support-content', requireOwner, async (_req, res) => {
  try {
    const content = await readSupportContent();
    res.json({ ok: true, content });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load support content' });
  }
});

app.put('/api/owner/support-content', requireOwner, async (req, res) => {
  try {
    const content = await saveSupportContent(req.body?.content ?? req.body ?? {});
    res.json({ ok: true, content });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save support content' });
  }
});

app.get('/api/owner/summary', requireOwner, async (_req, res) => {
  try {
    const summary = await getOwnerSummaryPayload();
    res.json({ ok: true, ...summary });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load owner summary' });
  }
});


app.get('/api/me/favorites', requirePublicUser, async (req, res) => {
  try {
    const slugs = await getUserFavorites(req.publicUser.id);
    res.json({ ok: true, slugs });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load favorites' });
  }
});

app.put('/api/me/favorites', requirePublicUser, async (req, res) => {
  try {
    const slugs = await replaceUserFavorites(req.publicUser.id, req.body?.slugs);
    res.json({ ok: true, slugs });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save favorites' });
  }
});

app.post('/api/me/favorites/:slug', requirePublicUser, async (req, res) => {
  try {
    const slugs = await setUserFavorite(req.publicUser.id, req.params.slug, true);
    res.json({ ok: true, slugs });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save favorite' });
  }
});

app.delete('/api/me/favorites/:slug', requirePublicUser, async (req, res) => {
  try {
    const slugs = await setUserFavorite(req.publicUser.id, req.params.slug, false);
    res.json({ ok: true, slugs });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to remove favorite' });
  }
});

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const store = await getContentStore();
    res.json({ ok: true, ...toPublicBootstrapPayload(store) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load bootstrap' });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    const categories = (await getCategories()).filter((category) => category.visible);
    res.json({ ok: true, categories });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load categories' });
  }
});

app.get('/api/categories/:slug', async (req, res) => {
  try {
    const categories = (await getCategories()).filter((item) => item.visible);
    const category = categories.find((item) => item.slug === req.params.slug || item.id === req.params.slug);

    if (!category) {
      res.status(404).json({ ok: false, message: 'Category not found' });
      return;
    }

    res.json({ ok: true, category, filters: [{ config: category.filterSchema }] });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load category' });
  }
});


app.post('/api/bulletin-submissions', requirePublicUser, async (req, res) => {
  try {
    const prepared = await createPublicBulletinPayload(req.body || {}, req.publicUser);
    if (prepared.error) {
      res.status(400).json({ ok: false, message: prepared.error });
      return;
    }

    const listing = await upsertPlace(prepared.listing);
    res.status(201).json({
      ok: true,
      listing: toListing(listing),
      message: 'Объявление отправлено на модерацию.'
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to submit bulletin listing' });
  }
});

app.get('/api/me/bulletins', requirePublicUser, async (req, res) => {
  try {
    const listings = (await getPlaces({ categoryId: 'bulletin-board', includeHidden: true }))
      .filter((listing) => String(listing.createdByUserId || '').trim() === String(req.publicUser.id || '').trim())
      .map(toListing);

    res.json({ ok: true, listings });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Не удалось загрузить объявления.' });
  }
});

app.delete('/api/me/bulletins/:id', requirePublicUser, async (req, res) => {
  try {
    const listing = await getPlaceById(req.params.id);

    if (!listing || listing.categoryId !== 'bulletin-board') {
      res.status(404).json({ ok: false, message: 'Объявление не найдено.' });
      return;
    }

    if (String(listing.createdByUserId || '').trim() !== String(req.publicUser.id || '').trim()) {
      res.status(403).json({ ok: false, message: 'Можно удалить только своё объявление.' });
      return;
    }

    await deletePlace(req.params.id);
    res.json({ ok: true, deletedId: req.params.id });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Не удалось удалить объявление.' });
  }
});

app.get('/api/listings', async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const visibleCategoryIds = getVisibleCategoryIdSet(await getCategories());

    const listings = (await getPlaces({ categoryId: category, search, includeHidden: false }))
      .filter((listing) => isListingPubliclyVisible(listing, visibleCategoryIds))
      .map(toListing)
      .filter((listing) => matchesListing(listing, search));

    res.json({ ok: true, listings });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load listings' });
  }
});

app.get('/api/listings/:slug', async (req, res) => {
  try {
    const listing = await getPlaceBySlug(req.params.slug);
    const categories = (await getCategories()).filter((item) => item.visible);
    const visibleCategoryIds = getVisibleCategoryIdSet(categories);

    if (!listing || !isListingPubliclyVisible(listing, visibleCategoryIds)) {
      res.status(404).json({ ok: false, message: 'Listing not found' });
      return;
    }

    const similar = (await getPlaces({ categoryId: listing.categoryId, includeHidden: false }))
      .filter((item) => item.id !== listing.id && isListingPubliclyVisible(item, visibleCategoryIds))
      .slice(0, 6)
      .map(toListing);

    const category = categories.find((item) => item.id === listing.categoryId) || null;

    res.json({ ok: true, listing: toListing(listing), category, similar });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load listing' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const visibleCategoryIds = getVisibleCategoryIdSet(await getCategories());
    const listings = (await getPlaces({ includeHidden: false, search: query }))
      .filter((listing) => isListingPubliclyVisible(listing, visibleCategoryIds))
      .map(toListing);
    res.json({ ok: true, listings });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to search listings' });
  }
});

app.get('/api/owner/categories', requireOwner, async (_req, res) => {
  try {
    const categories = await getCategories();
    res.json({ ok: true, categories });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load owner categories' });
  }
});

app.post('/api/owner/categories', requireOwner, async (req, res) => {
  try {
    const category = await upsertCategory(normalizeIncomingCategory(req.body ?? {}));
    res.json({ ok: true, category });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create category' });
  }
});

app.put('/api/owner/categories/:id', requireOwner, async (req, res) => {
  try {
    const currentCategory = (await getCategoryById(req.params.id)) || (await getCategoryBySlug(req.params.id));
    if (!currentCategory) {
      res.status(404).json({ ok: false, message: 'Category not found' });
      return;
    }

    const category = await upsertCategory(normalizeIncomingCategory(req.body ?? {}, currentCategory));
    res.json({ ok: true, category });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update category' });
  }
});

app.delete('/api/owner/categories/:id', requireOwner, async (req, res) => {
  try {
    const currentCategory = (await getCategoryById(req.params.id)) || (await getCategoryBySlug(req.params.id));
    if (!currentCategory) {
      res.status(404).json({ ok: false, message: 'Category not found' });
      return;
    }

    const categories = await deleteCategory(currentCategory.id);
    res.json({ ok: true, categories });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete category' });
  }
});

app.get('/api/owner/places', requireOwner, async (req, res) => {
  try {
    const categoryId = typeof req.query.category === 'string' ? req.query.category : '';
    const places = (await getPlaces({ categoryId, includeHidden: true })).map(toListing);
    res.json({ ok: true, places });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to load owner places' });
  }
});

app.get('/api/owner/geocode', requireOwner, async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const result = await geocodeAddress(query);
    res.json({ ok: true, result });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Не удалось найти адрес.' });
  }
});

app.post('/api/owner/listings', requireOwner, async (req, res) => {
  try {
    const nextListing = normalizeIncomingListing(req.body ?? {});
    const savedListing = await upsertPlace(nextListing);
    res.json({ ok: true, listing: toListing(savedListing) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save listing' });
  }
});

app.put('/api/owner/listings/:id', requireOwner, async (req, res) => {
  try {
    const currentListing = await getPlaceById(req.params.id);

    if (!currentListing) {
      res.status(404).json({ ok: false, message: 'Listing not found' });
      return;
    }

    const nextListing = normalizeIncomingListing(req.body ?? {}, currentListing);
    const savedListing = await upsertPlace(nextListing);
    res.json({ ok: true, listing: toListing(savedListing) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update listing' });
  }
});

app.post('/api/owner/places', requireOwner, async (req, res) => {
  try {
    const savedListing = await upsertPlace(normalizeIncomingListing(req.body ?? {}));
    res.json({ ok: true, place: toListing(savedListing) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to create place' });
  }
});

app.put('/api/owner/places/:id', requireOwner, async (req, res) => {
  try {
    const currentListing = await getPlaceById(req.params.id);
    if (!currentListing) {
      res.status(404).json({ ok: false, message: 'Place not found' });
      return;
    }

    const savedListing = await upsertPlace(normalizeIncomingListing(req.body ?? {}, currentListing));
    res.json({ ok: true, place: toListing(savedListing) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to update place' });
  }
});

app.delete('/api/owner/listings/:id', requireOwner, async (req, res) => {
  try {
    await deletePlace(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete listing' });
  }
});

app.delete('/api/owner/places/:id', requireOwner, async (req, res) => {
  try {
    await deletePlace(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to delete place' });
  }
});


app.put('/api/owner/collections', requireOwner, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const collections = await saveCollections(items);
    res.json({ ok: true, collections });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save collections' });
  }
});

app.put('/api/owner/collections/:slug/items', requireOwner, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const collection = await updateCollectionItems(req.params.slug, items);
    if (!collection) {
      res.status(404).json({ ok: false, message: 'Collection not found' });
      return;
    }
    const store = await getContentStore();
    res.json({ ok: true, collection, collections: store.collections });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save collection items' });
  }
});

app.put('/api/owner/tips', requireOwner, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const tips = await saveTips(items);
    res.json({ ok: true, tips });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save tips' });
  }
});

app.put('/api/owner/home', requireOwner, async (req, res) => {
  try {
    const currentStore = await getContentStore();
    const home = await saveHomeContent(req.body?.home && typeof req.body.home === 'object' ? req.body.home : currentStore.home);
    res.json({ ok: true, home });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save home' });
  }
});

app.get('/api/owner/media', requireOwner, async (_req, res) => {
  try {
    const items = await getMediaFiles(160);
    res.json({ ok: true, items });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Не удалось загрузить медиатеку.' });
  }
});

app.delete('/api/owner/media/:id', requireOwner, async (req, res) => {
  try {
    const deleted = await deleteMediaFileRecord(req.params.id);

    if (!deleted) {
      res.status(404).json({ ok: false, message: 'Файл не найден.' });
      return;
    }

    try {
      if (deleted.storagePath && fs.existsSync(deleted.storagePath)) {
        fs.unlinkSync(deleted.storagePath);
      }
    } catch (unlinkError) {
      console.warn('Could not delete media file from disk:', unlinkError);
    }

    res.json({ ok: true, deleted });
  } catch (error) {
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Не удалось удалить файл.' });
  }
});

app.post('/api/owner/upload', requireOwner, async (req, res) => {
  try {
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName : 'image';
    const kind = typeof req.body?.kind === 'string' ? req.body.kind : 'general';

    if (!dataUrl) {
      res.status(400).json({ ok: false, message: 'Нет данных изображения для загрузки.' });
      return;
    }

    const uploaded = await storeUploadedImage({ fileName, dataUrl, kind });
    res.json({ ok: true, ...uploaded });
  } catch (error) {
    res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Не удалось загрузить изображение.' });
  }
});

app.use(uploadsPublicBasePath, express.static(uploadsRoot, { maxAge: '7d' }));

if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath, { maxAge: '1h' }));
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ ok: false, message: 'API endpoint not found' });
    return;
  }

  const indexHtmlPath = path.join(webDistPath, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    res.sendFile(indexHtmlPath);
    return;
  }

  res.status(200).send('Danang Guide backend is running. Build the webapp to enable /owner-login and /owner.');
});

const server = app.listen(PORT, async () => {
  try {
    ensureUploadsDirectory();
    if (hasDatabase()) {
      const databaseReady = await ensureDatabase();
      if (databaseReady) {
        console.log('Guide app server started on port %s with PostgreSQL', PORT);
        return;
      }

      console.log('Guide app server started on port %s with file storage fallback', PORT);
      return;
    }

    console.log('Guide app server started on port %s without PostgreSQL', PORT);
  } catch (error) {
    console.error('Database init failed:', error);
  }
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`Backend port ${PORT} is already in use. Stop the old backend or change PORT in .env.`);
    process.exit(1);
  }

  throw error;
});
