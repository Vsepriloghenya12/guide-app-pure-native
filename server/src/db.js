const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let postgres = null;
try {
  postgres = require('postgres');
} catch {
  postgres = null;
}

const seedPath = path.resolve(__dirname, '../../shared/default-guide-content.json');
const contentStorePath = path.resolve(__dirname, '../../storage/content-store.json');
const supportContentPath = path.resolve(__dirname, '../../storage/support-content.json');
const mediaFilesPath = path.resolve(__dirname, '../../storage/media-files.json');
const usersPath = path.resolve(__dirname, '../../storage/users.json');
const defaultContent = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const categoryLabelOverrides = {
  restaurants: { title: 'Еда', shortTitle: 'Еда' },
  wellness: { title: 'Оздоровление', shortTitle: 'Оздоровление' },
  hotels: { title: 'Резорты', shortTitle: 'Резорты' },
  'car-rental': { title: 'Транспорт', shortTitle: 'Транспорт' },
  atm: { title: 'Финансы', shortTitle: 'Финансы' },
  shops: { title: 'Покупки', shortTitle: 'Покупки' },
  'photo-spots': { title: 'Виды города', shortTitle: 'Виды города' }
};
const defaultSupportContent = {
  heroEyebrow: 'На связи',
  heroTitle: 'Все важные контакты в одном месте',
  heroText: 'Здесь собраны основные каналы связи, чтобы телефон, Telegram и WhatsApp всегда были под рукой. Ниже также есть важные номера для экстренных ситуаций.',
  helpButtonLabel: 'Открыть помощь',
  emergencyTitle: 'Экстренные контакты',
  emergencySubtitle: 'Полезно сохранить до поездки или держать под рукой в офлайн-режиме.',
  contactChannels: [
    { id: 'telegram', title: 'Telegram', subtitle: 'Быстрые вопросы, рекомендации и помощь по приложению.', value: '@danangguide_support', href: 'https://t.me/danangguide_support', kind: 'telegram' },
    { id: 'whatsapp', title: 'WhatsApp', subtitle: 'Удобно для быстрых сообщений и отправки локации.', value: '+84 90 000 90 90', href: 'https://wa.me/84900009090', kind: 'whatsapp' },
    { id: 'phone', title: 'Телефон', subtitle: 'Срочный звонок, если нужна помощь или уточнение по контакту.', value: '+84 90 000 90 90', href: 'tel:+84900009090', kind: 'phone' },
    { id: 'email', title: 'Email', subtitle: 'Для партнёрств, размещения и подробных запросов.', value: 'hello@danangguide.app', href: 'mailto:hello@danangguide.app', kind: 'email' },
    { id: 'instagram', title: 'Instagram', subtitle: 'Актуальные анонсы и подборки.', value: '@danangguide.app', href: 'https://instagram.com/danangguide.app', kind: 'instagram' }
  ],
  emergencyContacts: [
    { id: 'police', title: 'Полиция', description: 'Экстренная помощь и безопасность.', value: '113', href: 'tel:113' },
    { id: 'fire', title: 'Пожарная служба', description: 'Пожар, задымление, угроза жизни.', value: '114', href: 'tel:114' },
    { id: 'ambulance', title: 'Скорая помощь', description: 'Медицинская экстренная помощь.', value: '115', href: 'tel:115' },
    { id: 'tourist-help', title: 'Туристическая помощь', description: 'Локальная помощь по логистике, утерянным вещам и маршрутам.', value: '+84 90 000 90 90', href: 'tel:+84900009090' }
  ]
};

let sql = null;
let dbReadyPromise = null;
let memoryStore = null;
let memorySupportContent = null;
let memoryMediaFiles = null;
let memoryUsers = null;
let databaseFallbackReason = '';

function readJsonFile(filePath, fallbackFactory) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.warn(`Could not read JSON file ${filePath}:`, error);
  }

  return fallbackFactory();
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function getSslConfig() {
  const mode = String(process.env.PGSSLMODE || '').toLowerCase();
  const explicit = String(process.env.DATABASE_SSL || '').toLowerCase();

  if (explicit === 'true' || mode === 'require') {
    return 'require';
  }

  return undefined;
}

function getSql() {
  if (!process.env.DATABASE_URL || !postgres || databaseFallbackReason) {
    return null;
  }

  if (!sql) {
    sql = postgres(process.env.DATABASE_URL, {
      ssl: getSslConfig(),
      max: 5,
      prepare: false
    });
  }

  return sql;
}

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL && postgres && !databaseFallbackReason);
}

function disableDatabaseFallback(error) {
  if (!databaseFallbackReason) {
    databaseFallbackReason = error instanceof Error ? error.message : 'Database unavailable';
    console.warn(`PostgreSQL is unavailable, falling back to file storage: ${databaseFallbackReason}`);
  }

  dbReadyPromise = null;

  if (sql && typeof sql.end === 'function') {
    Promise.resolve(sql.end({ timeout: 0 })).catch(() => undefined);
  }

  sql = null;
}

async function getReadyDb() {
  const db = getSql();
  if (!db) {
    return null;
  }

  const ready = await ensureDatabase();
  return ready ? getSql() : null;
}

function cloneDefaultContent() {
  return JSON.parse(JSON.stringify(defaultContent));
}

function isTruthyEnvValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return !['0', 'false', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function shouldSyncDefaultContentOnStart() {
  return isTruthyEnvValue(process.env.SYNC_DEFAULT_CONTENT_ON_START, true);
}

function createDefaultContentSeed() {
  const seed = normalizeContentStore(cloneDefaultContent());
  seed.analytics = { events: [] };
  return seed;
}

function getDefaultContentHash() {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(createDefaultContentSeed()))
    .digest('hex');
}

function cloneDefaultSupportContent() {
  return JSON.parse(JSON.stringify(defaultSupportContent));
}

function normalizeSupportContent(input) {
  const base = input && typeof input === 'object' ? input : {};
  const defaults = cloneDefaultSupportContent();
  const normalizeChannel = (channel, index) => ({
    id: String(channel?.id || `contact-${index + 1}`).trim(),
    title: String(channel?.title || '').trim(),
    subtitle: String(channel?.subtitle || '').trim(),
    value: String(channel?.value || '').trim(),
    href: String(channel?.href || '').trim(),
    kind: ['telegram', 'whatsapp', 'phone', 'email', 'instagram'].includes(String(channel?.kind)) ? String(channel.kind) : 'telegram'
  });
  const normalizeEmergency = (contact, index) => ({
    id: String(contact?.id || `emergency-${index + 1}`).trim(),
    title: String(contact?.title || '').trim(),
    description: String(contact?.description || '').trim(),
    value: String(contact?.value || '').trim(),
    href: String(contact?.href || '').trim()
  });

  return {
    heroEyebrow: String(base.heroEyebrow || defaults.heroEyebrow).trim(),
    heroTitle: String(base.heroTitle || defaults.heroTitle).trim(),
    heroText: String(base.heroText || defaults.heroText).trim(),
    helpButtonLabel: String(base.helpButtonLabel || defaults.helpButtonLabel).trim(),
    emergencyTitle: String(base.emergencyTitle || defaults.emergencyTitle).trim(),
    emergencySubtitle: String(base.emergencySubtitle || defaults.emergencySubtitle).trim(),
    contactChannels: (Array.isArray(base.contactChannels) ? base.contactChannels : defaults.contactChannels).map(normalizeChannel),
    emergencyContacts: (Array.isArray(base.emergencyContacts) ? base.emergencyContacts : defaults.emergencyContacts).map(normalizeEmergency)
  };
}

function getMemorySupportContent() {
  if (!memorySupportContent) {
    memorySupportContent = normalizeSupportContent(readJsonFile(supportContentPath, cloneDefaultSupportContent));
  }
  return JSON.parse(JSON.stringify(memorySupportContent));
}

function setMemorySupportContent(content) {
  memorySupportContent = normalizeSupportContent(content);
  writeJsonFile(supportContentPath, memorySupportContent);
  return getMemorySupportContent();
}

function normalizeMediaFileRecord(input) {
  return {
    id: String(input?.id || crypto.randomUUID()),
    kind: String(input?.kind || 'general'),
    fileName: String(input?.fileName || ''),
    mimeType: String(input?.mimeType || ''),
    sizeBytes: Number(input?.sizeBytes || 0) || 0,
    storagePath: String(input?.storagePath || ''),
    publicUrl: String(input?.publicUrl || ''),
    createdAt: String(input?.createdAt || new Date().toISOString())
  };
}

function getMemoryMediaFiles(limit = 120) {
  if (!memoryMediaFiles) {
    const rawRecords = readJsonFile(mediaFilesPath, () => []);
    memoryMediaFiles = (Array.isArray(rawRecords) ? rawRecords : [])
      .map(normalizeMediaFileRecord)
      .filter((item) => item.id && item.publicUrl)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  }

  return JSON.parse(JSON.stringify(memoryMediaFiles.slice(0, limit)));
}

function writeMemoryMediaFiles(records) {
  memoryMediaFiles = (Array.isArray(records) ? records : [])
    .map(normalizeMediaFileRecord)
    .filter((item) => item.id && item.publicUrl)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  writeJsonFile(mediaFilesPath, memoryMediaFiles);
  return getMemoryMediaFiles();
}

function saveMemoryMediaFileRecord(record) {
  const current = getMemoryMediaFiles(10000);
  const nextRecord = normalizeMediaFileRecord(record);
  writeMemoryMediaFiles([nextRecord, ...current.filter((item) => item.id !== nextRecord.id)].slice(0, 500));
  return nextRecord;
}

function deleteMemoryMediaFileRecord(id) {
  const current = getMemoryMediaFiles(10000);
  const deleted = current.find((item) => item.id === id) || null;
  if (!deleted) {
    return null;
  }
  writeMemoryMediaFiles(current.filter((item) => item.id !== id));
  return deleted;
}

function normalizePublicUserRecord(input) {
  const now = new Date().toISOString();
  const provider = ['google', 'apple', 'telegram'].includes(String(input?.provider)) ? String(input.provider) : 'google';
  const providerUserId = String(input?.providerUserId || input?.sub || '').trim();
  const id = String(input?.id || `${provider}:${providerUserId}` || crypto.randomUUID()).trim();

  return {
    id,
    provider,
    providerUserId,
    displayName: String(input?.displayName || input?.name || 'Гость').trim() || 'Гость',
    givenName: String(input?.givenName || '').trim(),
    familyName: String(input?.familyName || '').trim(),
    email: String(input?.email || '').trim(),
    emailVerified: Boolean(input?.emailVerified),
    avatarUrl: String(input?.avatarUrl || '').trim(),
    username: String(input?.username || '').trim(),
    favoriteSlugs: Array.isArray(input?.favoriteSlugs)
      ? Array.from(new Set(input.favoriteSlugs.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 500)
      : [],
    createdAt: String(input?.createdAt || now),
    updatedAt: String(input?.updatedAt || now),
    lastLoginAt: String(input?.lastLoginAt || now)
  };
}

function getMemoryUsers() {
  if (!memoryUsers) {
    const rawRecords = readJsonFile(usersPath, () => []);
    memoryUsers = (Array.isArray(rawRecords) ? rawRecords : [])
      .map(normalizePublicUserRecord)
      .filter((item) => item.id && item.provider && item.providerUserId);
  }

  return JSON.parse(JSON.stringify(memoryUsers));
}

function writeMemoryUsers(records) {
  memoryUsers = (Array.isArray(records) ? records : [])
    .map(normalizePublicUserRecord)
    .filter((item) => item.id && item.provider && item.providerUserId);
  writeJsonFile(usersPath, memoryUsers);
  return getMemoryUsers();
}

function toPublicUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id || ''),
    provider: String(row.provider || ''),
    sub: String(row.providerUserId || row.provider_user_id || row.sub || ''),
    displayName: String(row.displayName || row.display_name || 'Гость'),
    givenName: String(row.givenName || row.given_name || ''),
    familyName: String(row.familyName || row.family_name || ''),
    email: String(row.email || ''),
    emailVerified: Boolean(row.emailVerified ?? row.email_verified),
    avatarUrl: String(row.avatarUrl || row.avatar_url || ''),
    username: String(row.username || ''),
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
    lastLoginAt: row.lastLoginAt || row.last_login_at
  };
}

function normalizeFavoriteSlugs(slugs) {
  return Array.from(new Set((Array.isArray(slugs) ? slugs : [])
    .map((item) => String(item || '').trim())
    .filter((item) => item && item.length <= 180)))
    .slice(0, 500);
}

function getMemoryUserById(userId) {
  return getMemoryUsers().find((item) => item.id === userId) || null;
}

function getMemoryUserFavorites(userId) {
  const user = getMemoryUserById(userId);
  return user?.favoriteSlugs || [];
}

function setMemoryUserFavorites(userId, slugs) {
  const normalizedSlugs = normalizeFavoriteSlugs(slugs);
  const users = getMemoryUsers();
  const nextUsers = users.map((item) => (
    item.id === userId
      ? { ...item, favoriteSlugs: normalizedSlugs, updatedAt: new Date().toISOString() }
      : item
  ));
  writeMemoryUsers(nextUsers);
  return normalizedSlugs;
}

function setMemoryUserFavorite(userId, slug, favorite) {
  const current = new Set(getMemoryUserFavorites(userId));
  const normalizedSlug = String(slug || '').trim();
  if (!normalizedSlug) {
    return Array.from(current);
  }
  if (favorite) {
    current.add(normalizedSlug);
  } else {
    current.delete(normalizedSlug);
  }
  return setMemoryUserFavorites(userId, Array.from(current));
}


function getMemoryStore() {
  if (!memoryStore) {
    memoryStore = normalizeContentStore(readJsonFile(contentStorePath, cloneDefaultContent));
  }
  return JSON.parse(JSON.stringify(memoryStore));
}

function setMemoryStore(store) {
  memoryStore = normalizeContentStore(store);
  writeJsonFile(contentStorePath, memoryStore);
  return getMemoryStore();
}

function slugify(value, fallback = 'item') {
  return String(value || fallback)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function toBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeLegacyShopsLabel(value, categoryId) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  return categoryId === 'shops' && normalized.toLowerCase() === 'магазины' ? 'Покупки' : normalized;
}

function toNullableNumber(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coerceStatus(value) {
  return ['draft', 'hidden', 'published'].includes(value) ? value : 'published';
}

function normalizeCategory(category, index, fallbackMap) {
  const fallback = fallbackMap.get(category?.id) || fallbackMap.get(category?.slug) || {};
  const id = String(category?.id || fallback.id || '').trim();
  const slug = String(category?.slug || fallback.slug || id || `category-${index + 1}`).trim();
  const labels = categoryLabelOverrides[id] || {};

  return {
    id,
    title: String(labels.title || category?.title || fallback.title || id).trim(),
    path: String(category?.path || fallback.path || `/section/${slug}`).trim(),
    badge: String(category?.badge ?? fallback.badge ?? '').trim(),
    description: String(category?.description || fallback.description || '').trim(),
    visible: category?.visible ?? fallback.visible ?? true,
    showOnHome: category?.showOnHome ?? fallback.showOnHome ?? false,
    slug,
    shortTitle: String(labels.shortTitle || category?.shortTitle || fallback.shortTitle || category?.title || fallback.title || id).trim(),
    accent: String(category?.accent || fallback.accent || 'coast').trim(),
    imageSrc: String(category?.imageSrc || fallback.imageSrc || '').trim(),
    filterSchema: {
      quickFilters: normalizeStringArray(category?.filterSchema?.quickFilters ?? fallback.filterSchema?.quickFilters),
      fields: normalizeStringArray(category?.filterSchema?.fields ?? fallback.filterSchema?.fields)
    },
    sortOrder: Number.isFinite(Number(category?.sortOrder)) ? Number(category.sortOrder) : index * 10 + 10
  };
}

function normalizeDisplayHours(value) {
  const source = String(value || '').trim();
  if (!source) {
    return '';
  }

  const cleaned = source
    .replace(/^(режим работы|работы)(?=$|[\s:,.-])[\s:,.-]*/iu, '')
    .replace(/^(ежедневно|каждый день|пн\s*[-–—]\s*вс|пн\s*-\s*вс)(?=$|[\s:,.-])[\s:,.-]*/iu, '')
    .trim();

  return cleaned || source;
}

function normalizePlace(place, index, fallbackPlace = {}) {
  const sourcePlace = place && typeof place === 'object' ? place : {};
  const sourceFallbackPlace = fallbackPlace && typeof fallbackPlace === 'object' ? fallbackPlace : {};
  const { rating: _legacyRating, ...safePlace } = sourcePlace;
  const { rating: _legacyFallbackRating, ...safeFallbackPlace } = sourceFallbackPlace;
  const categoryId = String(safePlace.categoryId || safeFallbackPlace.categoryId || 'restaurants').trim();
  const imageGallery = normalizeStringArray(safePlace.imageGallery ?? safePlace.imageUrls ?? safeFallbackPlace.imageGallery ?? safeFallbackPlace.imageUrls);
  const imageSrc = String(safePlace.imageSrc || safePlace.coverImageUrl || imageGallery[0] || safeFallbackPlace.imageSrc || safeFallbackPlace.coverImageUrl || '').trim();
  const finalGallery = imageGallery.length ? imageGallery : imageSrc ? [imageSrc] : [];
  const title = String(safePlace.title || safeFallbackPlace.title || '').trim();

  return {
    id: String(safePlace.id || safeFallbackPlace.id || crypto.randomUUID()).trim(),
    categoryId,
    title,
    description: String(safePlace.description || safePlace.shortDescription || safeFallbackPlace.description || '').trim(),
    address: String(safePlace.address || safePlace.location || safeFallbackPlace.address || '').trim(),
    phone: String(safePlace.phone || safePlace.phoneNumber || safeFallbackPlace.phone || '').trim(),
    website: String(safePlace.website || safePlace.websiteUrl || safeFallbackPlace.website || '').trim(),
    hours: normalizeDisplayHours(safePlace.hours || safeFallbackPlace.hours || ''),
    avgCheck: toNullableNumber(safePlace.avgCheck ?? safeFallbackPlace.avgCheck),
    kind: String(safePlace.kind || safePlace.listingType || safePlace.type || safeFallbackPlace.kind || '').trim(),
    cuisine: String(safePlace.cuisine || safeFallbackPlace.cuisine || '').trim(),
    services: normalizeStringArray(safePlace.services ?? safePlace.extra ?? safeFallbackPlace.services),
    tags: normalizeStringArray(safePlace.tags ?? safeFallbackPlace.tags),
    breakfast: toBoolean(safePlace.breakfast, safeFallbackPlace.breakfast ?? false),
    vegan: toBoolean(safePlace.vegan, safeFallbackPlace.vegan ?? false),
    pets: toBoolean(safePlace.pets ?? safePlace.petFriendly, safeFallbackPlace.pets ?? false),
    childPrograms: toBoolean(safePlace.childPrograms ?? safePlace.childFriendly, safeFallbackPlace.childPrograms ?? false),
    top: toBoolean(safePlace.top ?? safePlace.featured, safeFallbackPlace.top ?? false),
    imageLabel: String(safePlace.imageLabel || safeFallbackPlace.imageLabel || title || 'Карточка места').trim(),
    imageSrc,
    imageGallery: finalGallery,
    hotelStars: toNullableNumber(safePlace.hotelStars ?? safeFallbackPlace.hotelStars),
    hotelPool: toBoolean(safePlace.hotelPool, safeFallbackPlace.hotelPool ?? false),
    hotelSpa: toBoolean(safePlace.hotelSpa, safeFallbackPlace.hotelSpa ?? false),
    slug: String(safePlace.slug || safeFallbackPlace.slug || `${categoryId}-${slugify(title, String(safePlace.id || index + 1))}`).trim(),
    categorySlug: String(safePlace.categorySlug || safeFallbackPlace.categorySlug || categoryId).trim(),
    featured: toBoolean(safePlace.featured ?? safePlace.top, safeFallbackPlace.featured ?? safeFallbackPlace.top ?? false),
    shortDescription: String(safePlace.shortDescription || safePlace.description || safeFallbackPlace.shortDescription || safeFallbackPlace.description || '').trim(),
    priceLabel: String(safePlace.priceLabel || safeFallbackPlace.priceLabel || '').trim(),
    listingType: normalizeLegacyShopsLabel(safePlace.listingType || safePlace.kind || safeFallbackPlace.listingType || safeFallbackPlace.kind || '', categoryId),
    childFriendly: toBoolean(safePlace.childFriendly ?? safePlace.childPrograms, safeFallbackPlace.childFriendly ?? safeFallbackPlace.childPrograms ?? false),
    petFriendly: toBoolean(safePlace.petFriendly ?? safePlace.pets, safeFallbackPlace.petFriendly ?? safeFallbackPlace.pets ?? false),
    mapQuery: String(safePlace.mapQuery || safePlace.address || safeFallbackPlace.mapQuery || safeFallbackPlace.address || '').trim(),
    extra: normalizeStringArray(safePlace.extra ?? safePlace.services ?? safeFallbackPlace.extra ?? safeFallbackPlace.services),
    imageUrls: finalGallery,
    coverImageUrl: String(safePlace.coverImageUrl || imageSrc || safeFallbackPlace.coverImageUrl || '').trim(),
    websiteUrl: String(safePlace.websiteUrl || safePlace.website || safeFallbackPlace.websiteUrl || safeFallbackPlace.website || '').trim(),
    phoneNumber: String(safePlace.phoneNumber || safePlace.phone || safeFallbackPlace.phoneNumber || safeFallbackPlace.phone || '').trim(),
    district: String(safePlace.district || safeFallbackPlace.district || '').trim(),
    location: String(safePlace.location || safePlace.address || safeFallbackPlace.location || safeFallbackPlace.address || '').trim(),
    type: normalizeLegacyShopsLabel(safePlace.type || safePlace.kind || safeFallbackPlace.type || safeFallbackPlace.kind || '', categoryId),
    contactName: String(safePlace.contactName || safeFallbackPlace.contactName || '').trim(),
    createdByUserId: String(safePlace.createdByUserId || safeFallbackPlace.createdByUserId || '').trim(),
    status: coerceStatus(safePlace.status || safeFallbackPlace.status),
    sortOrder: Number.isFinite(Number(safePlace.sortOrder)) ? Number(safePlace.sortOrder) : Number.isFinite(Number(safeFallbackPlace.sortOrder)) ? Number(safeFallbackPlace.sortOrder) : index * 10 + 10,
    lat: toNullableNumber(safePlace.lat ?? safeFallbackPlace.lat),
    lng: toNullableNumber(safePlace.lng ?? safeFallbackPlace.lng),
    visible: safePlace.visible ?? safeFallbackPlace.visible ?? (coerceStatus(safePlace.status || safeFallbackPlace.status) !== 'hidden')
  };
}

function normalizeTip(tip, index) {
  return {
    id: String(tip?.id || `tip-${index + 1}`).trim(),
    title: String(tip?.title || '').trim(),
    text: String(tip?.text || '').trim(),
    linkPath: String(tip?.linkPath || tip?.path || '').trim(),
    active: tip?.active ?? true,
    sortOrder: Number.isFinite(Number(tip?.sortOrder)) ? Number(tip.sortOrder) : index * 10 + 10
  };
}

function normalizeCollection(collection, index) {
  return {
    id: String(collection?.id || `collection-${index + 1}`).trim(),
    title: String(collection?.title || '').trim(),
    description: String(collection?.description || '').trim(),
    linkPath: String(collection?.linkPath || '').trim(),
    imageSrc: String(collection?.imageSrc || '').trim(),
    itemIds: normalizeStringArray(collection?.itemIds),
    active: collection?.active ?? true,
    sortOrder: Number.isFinite(Number(collection?.sortOrder)) ? Number(collection.sortOrder) : index * 10 + 10
  };
}

function normalizeContentStore(input) {
  const defaults = cloneDefaultContent();
  const base = input && typeof input === 'object' ? input : {};
  const defaultCategoryMap = new Map(defaults.categories.map((item) => [item.id, item]));
  const useDefaultSeedContent = !Array.isArray(base.places) || base.places.length === 0;

  const categories = (Array.isArray(base.categories) ? base.categories : defaults.categories)
    .map((item, index) => normalizeCategory(item, index, defaultCategoryMap))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  const placeFallbackMap = new Map((Array.isArray(defaults.places) ? defaults.places : []).map((item) => [item.id, item]));
  const places = (useDefaultSeedContent ? defaults.places : base.places)
    .map((item, index) => normalizePlace(item, index, placeFallbackMap.get(item?.id)))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  const tips = (useDefaultSeedContent ? defaults.tips : Array.isArray(base.tips) ? base.tips : defaults.tips)
    .map(normalizeTip)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  const collections = (useDefaultSeedContent ? defaults.collections : Array.isArray(base.collections) ? base.collections : defaults.collections)
    .map(normalizeCollection)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  const homeDefaults = defaults.home || {};
  const homeInput = base.home && typeof base.home === 'object' ? base.home : {};

  return {
    version: 4,
    places,
    categories,
    tips,
    collections,
    home: {
      popularPlaceIds: normalizeStringArray(useDefaultSeedContent ? homeDefaults.popularPlaceIds : homeInput.popularPlaceIds ?? homeDefaults.popularPlaceIds),
      featuredCategoryIds: normalizeStringArray(useDefaultSeedContent ? homeDefaults.featuredCategoryIds : homeInput.featuredCategoryIds ?? homeDefaults.featuredCategoryIds),
      tipIds: normalizeStringArray(useDefaultSeedContent ? homeDefaults.tipIds : homeInput.tipIds ?? homeDefaults.tipIds),
      collectionIds: normalizeStringArray(useDefaultSeedContent ? homeDefaults.collectionIds : homeInput.collectionIds ?? homeDefaults.collectionIds),
      logoMedia: String(homeInput.logoMedia?.src || homeDefaults.logoMedia?.src || '').trim()
        ? {
            type: String(homeInput.logoMedia?.type || homeDefaults.logoMedia?.type || 'image').trim() === 'video' ? 'video' : 'image',
            src: String(homeInput.logoMedia?.src || homeDefaults.logoMedia?.src || '').trim(),
            posterSrc: String(homeInput.logoMedia?.posterSrc || homeDefaults.logoMedia?.posterSrc || '').trim(),
            alt: String(homeInput.logoMedia?.alt || homeDefaults.logoMedia?.alt || '').trim()
          }
        : undefined,
      sectionTitles: {
        popular: String(homeInput.sectionTitles?.popular || homeDefaults.sectionTitles?.popular || 'Популярное').trim(),
        categories: String(homeInput.sectionTitles?.categories || homeDefaults.sectionTitles?.categories || 'Категории').trim(),
        tips: String(homeInput.sectionTitles?.tips || homeDefaults.sectionTitles?.tips || 'Советы').trim(),
        collections: String(homeInput.sectionTitles?.collections || homeDefaults.sectionTitles?.collections || 'Подборки').trim(),
        allCategories: String(homeInput.sectionTitles?.allCategories || homeDefaults.sectionTitles?.allCategories || 'Все категории').trim()
      }
    },
    analytics: {
      events: Array.isArray(base.analytics?.events) ? base.analytics.events.slice(-400) : []
    },
    restaurants: places.filter((place) => place.categoryId === 'restaurants'),
    wellness: places.filter((place) => place.categoryId === 'wellness')
  };
}

async function ensureDatabase() {
  const db = getSql();
  if (!db) {
    return false;
  }

  if (!dbReadyPromise) {
    dbReadyPromise = (async () => {
      await db.unsafe(`
        create table if not exists categories (
          id text primary key,
          title text not null,
          path text not null,
          badge text not null default '',
          description text not null default '',
          visible boolean not null default true,
          show_on_home boolean not null default false,
          slug text not null unique,
          short_title text not null default '',
          accent text not null default 'coast',
          image_src text not null default '',
          filter_schema jsonb not null default '{}'::jsonb,
          sort_order integer not null default 100,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);

      await db.unsafe(`alter table categories add column if not exists image_src text not null default ''`);

      await db.unsafe(`
        create table if not exists places (
          id text primary key,
          category_id text not null references categories(id) on delete cascade,
          slug text not null unique,
          title text not null,
          description text not null default '',
          address text not null default '',
          phone text not null default '',
          website text not null default '',
          hours text not null default '',
          avg_check numeric,
          price_label text not null default '',
          kind text not null default '',
          cuisine text not null default '',
          services jsonb not null default '[]'::jsonb,
          tags jsonb not null default '[]'::jsonb,
          breakfast boolean not null default false,
          vegan boolean not null default false,
          pets boolean not null default false,
          child_programs boolean not null default false,
          top boolean not null default false,
          image_label text not null default '',
          image_src text not null default '',
          status text not null default 'published' check (status in ('draft','hidden','published')),
          sort_order integer not null default 100,
          lat double precision,
          lng double precision,
          map_query text not null default '',
          district text not null default '',
          contact_name text not null default '',
          created_by_user_id text not null default '',
          hotel_stars integer,
          hotel_pool boolean not null default false,
          hotel_spa boolean not null default false,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);

      await db.unsafe(`alter table places add column if not exists status text not null default 'published'`);
      await db.unsafe(`alter table places add column if not exists sort_order integer not null default 100`);
      await db.unsafe(`alter table places add column if not exists lat double precision`);
      await db.unsafe(`alter table places add column if not exists lng double precision`);
      await db.unsafe(`alter table places add column if not exists map_query text not null default ''`);
      await db.unsafe(`alter table places add column if not exists district text not null default ''`);
      await db.unsafe(`alter table places add column if not exists contact_name text not null default ''`);
      await db.unsafe(`alter table places add column if not exists created_by_user_id text not null default ''`);
      await db.unsafe(`alter table places add column if not exists hotel_stars integer`);
      await db.unsafe(`alter table places add column if not exists hotel_pool boolean not null default false`);
      await db.unsafe(`alter table places add column if not exists hotel_spa boolean not null default false`);
      await db.unsafe(`alter table places add column if not exists price_label text not null default ''`);

      await db.unsafe(`
        update categories
        set filter_schema = '{"quickFilters":[],"fields":["hotelStars","hotelPool","hotelSpa","petFriendly","district"]}'::jsonb,
            updated_at = now()
        where id = 'hotels'
          and not coalesce((filter_schema->'fields') ? 'hotelStars', false)
      `);

      await db.unsafe(`
        create table if not exists place_images (
          id text primary key,
          place_id text not null references places(id) on delete cascade,
          image_url text not null,
          sort_order integer not null default 100,
          is_cover boolean not null default false,
          created_at timestamptz not null default now()
        )
      `);

      await db.unsafe(`
        create index if not exists place_images_place_id_idx on place_images(place_id, sort_order)
      `);

      await db.unsafe(`
        create table if not exists media_files (
          id text primary key,
          kind text not null default 'general',
          file_name text not null default '',
          mime_type text not null default '',
          size_bytes integer not null default 0,
          storage_path text not null,
          public_url text not null,
          created_at timestamptz not null default now()
        )
      `);

      await db.unsafe(`
        create index if not exists media_files_created_at_idx on media_files (created_at desc)
      `);

      await db.unsafe(`
        create table if not exists users (
          id text primary key,
          provider text not null check (provider in ('google','apple','telegram')),
          provider_user_id text not null,
          display_name text not null default '',
          given_name text not null default '',
          family_name text not null default '',
          email text not null default '',
          email_verified boolean not null default false,
          avatar_url text not null default '',
          username text not null default '',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          last_login_at timestamptz not null default now(),
          unique (provider, provider_user_id)
        )
      `);

      await db.unsafe(`
        create index if not exists users_email_idx on users (email) where email <> ''
      `);

      await db.unsafe(`
        create table if not exists user_favorites (
          user_id text not null references users(id) on delete cascade,
          place_slug text not null,
          created_at timestamptz not null default now(),
          primary key (user_id, place_slug)
        )
      `);

      await db.unsafe(`
        create index if not exists user_favorites_user_id_idx on user_favorites (user_id, created_at desc)
      `);

      await db.unsafe(`
        create table if not exists tips (
          id text primary key,
          title text not null,
          text text not null default '',
          link_path text not null default '',
          active boolean not null default true,
          sort_order integer not null default 100,
          updated_at timestamptz not null default now()
        )
      `);

      await db.unsafe(`
        create table if not exists collections (
          id text primary key,
          title text not null,
          description text not null default '',
          link_path text not null default '',
          image_src text not null default '',
          active boolean not null default true,
          sort_order integer not null default 100,
          updated_at timestamptz not null default now()
        )
      `);

      await db.unsafe(`
        create table if not exists collection_items (
          collection_id text not null references collections(id) on delete cascade,
          place_id text not null references places(id) on delete cascade,
          sort_order integer not null default 100,
          primary key (collection_id, place_id)
        )
      `);

      await db.unsafe(`
        create table if not exists home_content (
          id text primary key,
          payload jsonb not null default '{}'::jsonb,
          updated_at timestamptz not null default now()
        )
      `);

      await db.unsafe(`
        create table if not exists support_content (
          id text primary key,
          payload jsonb not null default '{}'::jsonb,
          updated_at timestamptz not null default now()
        )
      `);

      await db.unsafe(`
        create table if not exists app_settings (
          key text primary key,
          value text not null,
          updated_at timestamptz not null default now()
        )
      `);

      await db.unsafe(`
        create table if not exists analytics_events (
          id text primary key,
          kind text not null,
          label text not null,
          path text not null,
          entity_id text,
          category_id text,
          created_at timestamptz not null
        )
      `);

      await db.unsafe(`
        create index if not exists analytics_events_created_at_idx on analytics_events (created_at desc)
      `);

      const seedHash = getDefaultContentHash();
      const [categoryRows, seedHashRows] = await Promise.all([
        db.unsafe('select id from categories limit 1'),
        db.unsafe('select value from app_settings where key = $1 limit 1', ['default_content_hash'])
      ]);
      const storedSeedHash = seedHashRows[0]?.value || '';
      const shouldSyncSeed = categoryRows.length === 0 || (shouldSyncDefaultContentOnStart() && storedSeedHash !== seedHash);

      if (shouldSyncSeed) {
        await replaceStoreContents(createDefaultContentSeed());
        await db.unsafe(
          `
            insert into app_settings (key, value, updated_at)
            values ($1, $2, now())
            on conflict (key) do update set value = excluded.value, updated_at = now()
          `,
          ['default_content_hash', seedHash]
        );
      } else if (!storedSeedHash) {
        await db.unsafe(
          `
            insert into app_settings (key, value, updated_at)
            values ($1, $2, now())
            on conflict (key) do update set value = excluded.value, updated_at = now()
          `,
          ['default_content_hash', seedHash]
        );
      }

      const supportRows = await db.unsafe('select id from support_content where id = $1 limit 1', ['contacts']);
      if (supportRows.length === 0) {
        await db.unsafe(
          'insert into support_content (id, payload, updated_at) values ($1, $2::jsonb, now())',
          ['contacts', JSON.stringify(cloneDefaultSupportContent())]
        );
      }

      return true;
    })().catch((error) => {
      disableDatabaseFallback(error);
      return false;
    });
  }

  return dbReadyPromise;
}

async function replaceStoreContents(store) {
  const db = getSql();
  if (!db) {
    return setMemoryStore(store);
  }

  const normalized = normalizeContentStore(store);

  await db.begin(async (tx) => {
    const categories = normalized.categories;
    const places = normalized.places;
    const tips = normalized.tips;
    const collections = normalized.collections;

    if (places.length === 0) {
      await tx.unsafe('delete from place_images');
      await tx.unsafe('delete from places');
    }

    for (const category of categories) {
      await tx.unsafe(
        `
          insert into categories (
            id, title, path, badge, description, visible, show_on_home, slug, short_title, accent, image_src, filter_schema, sort_order, updated_at
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, now()
          )
          on conflict (id) do update set
            title = excluded.title,
            path = excluded.path,
            badge = excluded.badge,
            description = excluded.description,
            visible = excluded.visible,
            show_on_home = excluded.show_on_home,
            slug = excluded.slug,
            short_title = excluded.short_title,
            accent = excluded.accent,
            image_src = excluded.image_src,
            filter_schema = excluded.filter_schema,
            sort_order = excluded.sort_order,
            updated_at = now()
        `,
        [
          category.id,
          category.title,
          category.path,
          category.badge || '',
          category.description || '',
          category.visible,
          category.showOnHome,
          category.slug,
          category.shortTitle,
          category.accent,
          category.imageSrc || '',
          JSON.stringify(category.filterSchema || {}),
          Number(category.sortOrder || 100)
        ]
      );
    }

    if (categories.length > 0) {
      await tx.unsafe('delete from categories where id <> all($1::text[])', [categories.map((item) => item.id)]);
    }

    for (const place of places) {
      await tx.unsafe(
        `
          insert into places (
            id, category_id, slug, title, description, address, phone, website, hours, avg_check, price_label, kind, cuisine,
            services, tags, breakfast, vegan, pets, child_programs, top, image_label, image_src,
            status, sort_order, lat, lng, map_query, district, contact_name, created_by_user_id, hotel_stars, hotel_pool, hotel_spa, updated_at
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14::jsonb, $15::jsonb, $16, $17, $18, $19, $20, $21, $22, $23,
            $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, now()
          )
          on conflict (id) do update set
            category_id = excluded.category_id,
            slug = excluded.slug,
            title = excluded.title,
            description = excluded.description,
            address = excluded.address,
            phone = excluded.phone,
            website = excluded.website,
            hours = excluded.hours,
            avg_check = excluded.avg_check,
            price_label = excluded.price_label,
            kind = excluded.kind,
            cuisine = excluded.cuisine,
            services = excluded.services,
            tags = excluded.tags,
            breakfast = excluded.breakfast,
            vegan = excluded.vegan,
            pets = excluded.pets,
            child_programs = excluded.child_programs,
            top = excluded.top,
            image_label = excluded.image_label,
            image_src = excluded.image_src,
            status = excluded.status,
            sort_order = excluded.sort_order,
            lat = excluded.lat,
            lng = excluded.lng,
            map_query = excluded.map_query,
            district = excluded.district,
            contact_name = excluded.contact_name,
            created_by_user_id = excluded.created_by_user_id,
            hotel_stars = excluded.hotel_stars,
            hotel_pool = excluded.hotel_pool,
            hotel_spa = excluded.hotel_spa,
            updated_at = now()
        `,
        [
          place.id,
          place.categoryId,
          place.slug,
          place.title,
          place.description,
          place.address,
          place.phone,
          place.website,
          place.hours,
          place.avgCheck,
          place.priceLabel || '',
          place.kind,
          place.cuisine,
          JSON.stringify(place.services || []),
          JSON.stringify(place.tags || []),
          place.breakfast,
          place.vegan,
          place.pets,
          place.childPrograms,
          place.top,
          place.imageLabel || '',
          place.imageSrc || '',
          coerceStatus(place.status),
          Number(place.sortOrder || 100),
          toNullableNumber(place.lat),
          toNullableNumber(place.lng),
          place.mapQuery || place.address || '',
          place.district || '',
          place.contactName || '',
          place.createdByUserId || '',
          place.hotelStars,
          Boolean(place.hotelPool),
          Boolean(place.hotelSpa)
        ]
      );

      await tx.unsafe('delete from place_images where place_id = $1', [place.id]);

      const gallery = normalizeStringArray(place.imageGallery || place.imageUrls);
      const finalGallery = gallery.length ? gallery : place.imageSrc ? [place.imageSrc] : [];
      for (const [imageIndex, imageUrl] of finalGallery.entries()) {
        await tx.unsafe(
          `
            insert into place_images (id, place_id, image_url, sort_order, is_cover)
            values ($1, $2, $3, $4, $5)
            on conflict (id) do update set
              place_id = excluded.place_id,
              image_url = excluded.image_url,
              sort_order = excluded.sort_order,
              is_cover = excluded.is_cover
          `,
          [`${place.id}:${imageIndex + 1}`, place.id, imageUrl, imageIndex * 10 + 10, imageIndex === 0]
        );
      }
    }

    if (places.length > 0) {
      await tx.unsafe('delete from places where id <> all($1::text[])', [places.map((item) => item.id)]);
    }

    for (const tip of tips) {
      await tx.unsafe(
        `
          insert into tips (id, title, text, link_path, active, sort_order, updated_at)
          values ($1, $2, $3, $4, $5, $6, now())
          on conflict (id) do update set
            title = excluded.title,
            text = excluded.text,
            link_path = excluded.link_path,
            active = excluded.active,
            sort_order = excluded.sort_order,
            updated_at = now()
        `,
        [tip.id, tip.title, tip.text || '', tip.linkPath || '', tip.active, Number(tip.sortOrder || 100)]
      );
    }
    if (tips.length > 0) {
      await tx.unsafe('delete from tips where id <> all($1::text[])', [tips.map((item) => item.id)]);
    }

    for (const collection of collections) {
      await tx.unsafe(
        `
          insert into collections (id, title, description, link_path, image_src, active, sort_order, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, now())
          on conflict (id) do update set
            title = excluded.title,
            description = excluded.description,
            link_path = excluded.link_path,
            image_src = excluded.image_src,
            active = excluded.active,
            sort_order = excluded.sort_order,
            updated_at = now()
        `,
        [collection.id, collection.title, collection.description || '', collection.linkPath || '', collection.imageSrc || '', collection.active, Number(collection.sortOrder || 100)]
      );

      await tx.unsafe('delete from collection_items where collection_id = $1', [collection.id]);
      for (const [itemIndex, placeId] of collection.itemIds.entries()) {
        await tx.unsafe(
          `
            insert into collection_items (collection_id, place_id, sort_order)
            values ($1, $2, $3)
            on conflict (collection_id, place_id) do update set sort_order = excluded.sort_order
          `,
          [collection.id, placeId, itemIndex * 10 + 10]
        );
      }
    }
    if (collections.length > 0) {
      await tx.unsafe('delete from collections where id <> all($1::text[])', [collections.map((item) => item.id)]);
    }

    await tx.unsafe(
      `
        insert into home_content (id, payload, updated_at)
        values ('main', $1::jsonb, now())
        on conflict (id) do update set payload = excluded.payload, updated_at = now()
      `,
      [JSON.stringify(normalized.home)]
    );
  });

  const analyticsEvents = await getAnalyticsEvents(400);
  return normalizeContentStore({ ...normalized, analytics: { events: analyticsEvents } });
}

async function readCategories() {
  const db = await getReadyDb();
  if (!db) {
    return getMemoryStore().categories;
  }
  const rows = await db.unsafe(`
    select id, title, path, badge, description, visible, show_on_home as "showOnHome", slug,
           short_title as "shortTitle", accent, image_src as "imageSrc", filter_schema as "filterSchema", sort_order as "sortOrder"
    from categories
    order by sort_order asc, title asc
  `);

  const fallbackMap = new Map(cloneDefaultContent().categories.map((item) => [item.id, item]));
  return rows.map((row, index) => normalizeCategory(row, index, fallbackMap));
}

async function readPlaces() {
  const db = await getReadyDb();
  if (!db) {
    return getMemoryStore().places;
  }
  const [placeRows, imageRows] = await Promise.all([
    db.unsafe(`
      select id, category_id as "categoryId", slug, title, description, address, phone, website, hours,
             avg_check as "avgCheck", price_label as "priceLabel", kind, cuisine, services, tags, breakfast, vegan, pets,
             child_programs as "childPrograms", top, image_label as "imageLabel", image_src as "imageSrc",
             status, sort_order as "sortOrder", lat, lng, map_query as "mapQuery", district,
             contact_name as "contactName", created_by_user_id as "createdByUserId",
             hotel_stars as "hotelStars", hotel_pool as "hotelPool", hotel_spa as "hotelSpa"
      from places
      order by sort_order asc, title asc
    `),
    db.unsafe(`
      select place_id as "placeId", image_url as "imageUrl", sort_order as "sortOrder", is_cover as "isCover"
      from place_images
      order by place_id asc, sort_order asc
    `)
  ]);

  const imagesByPlaceId = new Map();
  for (const row of imageRows) {
    const bucket = imagesByPlaceId.get(row.placeId) || [];
    bucket.push(row);
    imagesByPlaceId.set(row.placeId, bucket);
  }

  return placeRows.map((row, index) => {
    const images = (imagesByPlaceId.get(row.id) || []).map((item) => item.imageUrl);
    const cover = (imagesByPlaceId.get(row.id) || []).find((item) => item.isCover)?.imageUrl || row.imageSrc || images[0] || '';
    return normalizePlace(
      {
        ...row,
        imageGallery: images,
        imageUrls: images,
        coverImageUrl: cover,
        imageSrc: cover,
        categorySlug: row.categoryId,
        featured: row.top,
        childFriendly: row.childPrograms,
        petFriendly: row.pets,
        shortDescription: row.description,
        priceLabel: row.priceLabel || (typeof row.avgCheck === 'number' ? `от ${row.avgCheck}` : ''),
        listingType: row.kind,
        location: row.address,
        phoneNumber: row.phone,
        websiteUrl: row.website,
        type: row.kind,
        hotelStars: row.hotelStars,
        hotelPool: row.hotelPool,
        hotelSpa: row.hotelSpa,
        visible: row.status !== 'hidden'
      },
      index
    );
  });
}

async function readTips() {
  const db = await getReadyDb();
  if (!db) {
    return getMemoryStore().tips;
  }
  const rows = await db.unsafe(`
    select id, title, text, link_path as "linkPath", active, sort_order as "sortOrder"
    from tips
    order by sort_order asc, title asc
  `);
  return rows.map(normalizeTip);
}

async function readCollections() {
  const db = await getReadyDb();
  if (!db) {
    return getMemoryStore().collections;
  }
  const [collectionRows, itemRows] = await Promise.all([
    db.unsafe(`
      select id, title, description, link_path as "linkPath", image_src as "imageSrc", active, sort_order as "sortOrder"
      from collections
      order by sort_order asc, title asc
    `),
    db.unsafe(`
      select collection_id as "collectionId", place_id as "placeId", sort_order as "sortOrder"
      from collection_items
      order by collection_id asc, sort_order asc
    `)
  ]);

  const itemsByCollection = new Map();
  for (const row of itemRows) {
    const bucket = itemsByCollection.get(row.collectionId) || [];
    bucket.push(row.placeId);
    itemsByCollection.set(row.collectionId, bucket);
  }

  return collectionRows.map((row, index) => normalizeCollection({ ...row, itemIds: itemsByCollection.get(row.id) || [] }, index));
}

async function readHomeContent() {
  const db = await getReadyDb();
  if (!db) {
    return getMemoryStore().home;
  }
  const rows = await db.unsafe('select payload from home_content where id = $1 limit 1', ['main']);
  return normalizeContentStore({ home: rows[0]?.payload || cloneDefaultContent().home }).home;
}

async function getAnalyticsEvents(limit = 400) {
  const db = await getReadyDb();
  if (!db) {
    return getMemoryStore().analytics.events.slice(-limit);
  }

  const rows = await db.unsafe(
    `
      select
        id,
        kind,
        label,
        path,
        entity_id as "entityId",
        category_id as "categoryId",
        created_at as "createdAt"
      from analytics_events
      order by created_at desc
      limit $1
    `,
    [limit]
  );

  return rows.reverse();
}

async function readSupportContent() {
  const db = await getReadyDb();
  if (!db) {
    return getMemorySupportContent();
  }
  const rows = await db.unsafe('select payload from support_content where id = $1 limit 1', ['contacts']);
  return normalizeSupportContent(rows[0]?.payload || cloneDefaultSupportContent());
}

async function saveSupportContent(contentInput) {
  const normalized = normalizeSupportContent(contentInput);
  const db = await getReadyDb();
  if (!db) {
    return setMemorySupportContent(normalized);
  }
  await db.unsafe(
    `
      insert into support_content (id, payload, updated_at)
      values ('contacts', $1::jsonb, now())
      on conflict (id) do update set payload = excluded.payload, updated_at = now()
    `,
    [JSON.stringify(normalized)]
  );

  return readSupportContent();
}

async function getContentStore() {
  const db = await getReadyDb();
  if (!db) {
    return getMemoryStore();
  }

  const [categories, places, tips, collections, home, analyticsEvents] = await Promise.all([
    readCategories(),
    readPlaces(),
    readTips(),
    readCollections(),
    readHomeContent(),
    getAnalyticsEvents(400)
  ]);

  return normalizeContentStore({
    categories,
    places,
    tips,
    collections,
    home,
    analytics: {
      events: analyticsEvents
    }
  });
}

async function saveContentStore(store) {
  const db = await getReadyDb();
  if (!db) {
    return setMemoryStore(store);
  }
  return replaceStoreContents(store);
}

async function resetContentStore() {
  const seed = normalizeContentStore(cloneDefaultContent());
  seed.analytics = { events: [] };

  const db = await getReadyDb();
  if (!db) {
    return setMemoryStore(seed);
  }
  await db.unsafe('delete from analytics_events');
  return replaceStoreContents(seed);
}

async function syncDefaultContentStore() {
  const seed = createDefaultContentSeed();
  const seedHash = getDefaultContentHash();

  const db = await getReadyDb();
  if (!db) {
    return { content: setMemoryStore(seed), seedHash, storage: 'file' };
  }

  const content = await replaceStoreContents(seed);
  await db.unsafe(
    `
      insert into app_settings (key, value, updated_at)
      values ($1, $2, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `,
    ['default_content_hash', seedHash]
  );

  return { content, seedHash, storage: 'postgresql' };
}

async function appendAnalyticsEvent(event) {
  const db = await getReadyDb();
  if (!db) {
    const store = getMemoryStore();
    store.analytics.events = [...store.analytics.events, event].slice(-400);
    setMemoryStore(store);
    return event;
  }

  await db.unsafe(
    `
      insert into analytics_events (id, kind, label, path, entity_id, category_id, created_at)
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (id) do nothing
    `,
    [
      event.id,
      event.kind,
      event.label,
      event.path,
      event.entityId || null,
      event.categoryId || null,
      event.createdAt
    ]
  );

  return event;
}


async function getCategories() {
  return readCategories();
}

async function getCategoryById(id) {
  const categories = await readCategories();
  return categories.find((category) => category.id === id) || null;
}

async function getCategoryBySlug(slug) {
  const categories = await readCategories();
  return categories.find((category) => category.slug === slug || category.id === slug) || null;
}

async function getPlaces(options = {}) {
  const store = await getContentStore();
  const { categoryId, includeHidden = false, search = '' } = options;
  const normalizedSearch = String(search || '').trim().toLowerCase();

  return store.places.filter((place) => {
    if (categoryId && place.categoryId !== categoryId && place.categorySlug !== categoryId) {
      return false;
    }
    if (!includeHidden && place.status !== 'published') {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    const haystack = [
      place.title,
      place.description,
      place.address,
      place.kind,
      place.cuisine,
      ...(place.tags || []),
      ...(place.services || [])
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}

async function getPlaceById(id) {
  const places = await readPlaces();
  return places.find((place) => place.id === id) || null;
}

async function getPlaceBySlug(slug) {
  const places = await readPlaces();
  return places.find((place) => place.slug === slug || place.id === slug) || null;
}

async function saveHomeContent(homeInput) {
  const normalizedHome = normalizeContentStore({ home: homeInput }).home;
  const db = await getReadyDb();
  if (!db) {
    const store = getMemoryStore();
    return setMemoryStore({ ...store, home: normalizedHome }).home;
  }
  await db.unsafe(
    `
      insert into home_content (id, payload, updated_at)
      values ('main', $1::jsonb, now())
      on conflict (id) do update set payload = excluded.payload, updated_at = now()
    `,
    [JSON.stringify(normalizedHome)]
  );

  return readHomeContent();
}

async function upsertCategory(incomingCategory) {
  const categories = await readCategories();
  const fallbackMap = new Map(cloneDefaultContent().categories.map((item) => [item.id, item]));
  const current = categories.find((category) => category.id === incomingCategory?.id || category.slug === incomingCategory?.slug) || undefined;
  const normalizedCategory = normalizeCategory(
    {
      ...current,
      ...incomingCategory,
      id: String(incomingCategory?.id || current?.id || slugify(incomingCategory?.slug || incomingCategory?.title || 'category')).trim(),
      slug: String(incomingCategory?.slug || incomingCategory?.id || current?.slug || slugify(incomingCategory?.title || 'category')).trim(),
      path: String(incomingCategory?.path || current?.path || `/section/${incomingCategory?.slug || incomingCategory?.id || slugify(incomingCategory?.title || 'category')}`).trim(),
      visible: incomingCategory?.visible ?? current?.visible ?? true,
      showOnHome: incomingCategory?.showOnHome ?? current?.showOnHome ?? false,
      filterSchema: {
        quickFilters: normalizeStringArray(incomingCategory?.filterSchema?.quickFilters ?? current?.filterSchema?.quickFilters),
        fields: normalizeStringArray(incomingCategory?.filterSchema?.fields ?? current?.filterSchema?.fields)
      }
    },
    categories.length,
    fallbackMap
  );

  const db = await getReadyDb();
  if (!db) {
    const store = getMemoryStore();
    const nextStore = setMemoryStore({
      ...store,
      categories: [normalizedCategory, ...store.categories.filter((item) => item.id !== normalizedCategory.id)]
    });
    return nextStore.categories.find((item) => item.id === normalizedCategory.id) || normalizedCategory;
  }

  await db.unsafe(
    `
      insert into categories (
        id, title, path, badge, description, visible, show_on_home, slug, short_title, accent, image_src, filter_schema, sort_order, updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, now()
      )
      on conflict (id) do update set
        title = excluded.title,
        path = excluded.path,
        badge = excluded.badge,
        description = excluded.description,
        visible = excluded.visible,
        show_on_home = excluded.show_on_home,
        slug = excluded.slug,
        short_title = excluded.short_title,
        accent = excluded.accent,
        image_src = excluded.image_src,
        filter_schema = excluded.filter_schema,
        sort_order = excluded.sort_order,
        updated_at = now()
    `,
    [
      normalizedCategory.id,
      normalizedCategory.title,
      normalizedCategory.path,
      normalizedCategory.badge || '',
      normalizedCategory.description || '',
      normalizedCategory.visible,
      normalizedCategory.showOnHome,
      normalizedCategory.slug,
      normalizedCategory.shortTitle,
      normalizedCategory.accent,
      normalizedCategory.imageSrc || '',
      JSON.stringify(normalizedCategory.filterSchema || {}),
      Number(normalizedCategory.sortOrder || 100)
    ]
  );

  return getCategoryById(normalizedCategory.id);
}

async function deleteCategory(categoryId) {
  const db = await getReadyDb();
  if (!db) {
    const store = getMemoryStore();
    const removedPlaceIds = store.places.filter((place) => place.categoryId === categoryId).map((place) => place.id);
    return setMemoryStore({
      ...store,
      categories: store.categories.filter((category) => category.id !== categoryId),
      places: store.places.filter((place) => place.categoryId !== categoryId),
      collections: store.collections.map((collection) => ({
        ...collection,
        itemIds: collection.itemIds.filter((itemId) => !removedPlaceIds.includes(itemId))
      })),
      home: {
        ...store.home,
        featuredCategoryIds: store.home.featuredCategoryIds.filter((itemId) => itemId !== categoryId),
        popularPlaceIds: store.home.popularPlaceIds.filter((itemId) => !removedPlaceIds.includes(itemId))
      }
    });
  }

  const placeRows = await db.unsafe('select id from places where category_id = $1', [categoryId]);
  const removedPlaceIds = placeRows.map((row) => row.id);
  await db.begin(async (tx) => {
    await tx.unsafe('delete from categories where id = $1', [categoryId]);

    const homeRows = await tx.unsafe('select payload from home_content where id = $1 limit 1', ['main']);
    const currentHome = normalizeContentStore({ home: homeRows[0]?.payload || cloneDefaultContent().home }).home;
    const nextHome = {
      ...currentHome,
      featuredCategoryIds: currentHome.featuredCategoryIds.filter((itemId) => itemId !== categoryId),
      popularPlaceIds: currentHome.popularPlaceIds.filter((itemId) => !removedPlaceIds.includes(itemId))
    };
    await tx.unsafe(
      `
        insert into home_content (id, payload, updated_at)
        values ('main', $1::jsonb, now())
        on conflict (id) do update set payload = excluded.payload, updated_at = now()
      `,
      [JSON.stringify(nextHome)]
    );
  });

  return getCategories();
}

async function saveTips(items) {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item, index) => normalizeTip(item, index));
  const db = await getReadyDb();
  if (!db) {
    const store = getMemoryStore();
    return setMemoryStore({ ...store, tips: normalizedItems }).tips;
  }

  await db.begin(async (tx) => {
    if (normalizedItems.length === 0) {
      await tx.unsafe('delete from tips');
      return;
    }

    for (const tip of normalizedItems) {
      await tx.unsafe(
        `
          insert into tips (id, title, text, link_path, active, sort_order, updated_at)
          values ($1, $2, $3, $4, $5, $6, now())
          on conflict (id) do update set
            title = excluded.title,
            text = excluded.text,
            link_path = excluded.link_path,
            active = excluded.active,
            sort_order = excluded.sort_order,
            updated_at = now()
        `,
        [tip.id, tip.title, tip.text || '', tip.linkPath || '', tip.active, Number(tip.sortOrder || 100)]
      );
    }

    await tx.unsafe('delete from tips where id <> all($1::text[])', [normalizedItems.map((item) => item.id)]);
  });

  return readTips();
}

async function saveCollections(items) {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item, index) => normalizeCollection(item, index));
  const db = await getReadyDb();
  if (!db) {
    const store = getMemoryStore();
    return setMemoryStore({ ...store, collections: normalizedItems }).collections;
  }

  await db.begin(async (tx) => {
    if (normalizedItems.length === 0) {
      await tx.unsafe('delete from collection_items');
      await tx.unsafe('delete from collections');
      return;
    }

    for (const collection of normalizedItems) {
      await tx.unsafe(
        `
          insert into collections (id, title, description, link_path, image_src, active, sort_order, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, now())
          on conflict (id) do update set
            title = excluded.title,
            description = excluded.description,
            link_path = excluded.link_path,
            image_src = excluded.image_src,
            active = excluded.active,
            sort_order = excluded.sort_order,
            updated_at = now()
        `,
        [collection.id, collection.title, collection.description || '', collection.linkPath || '', collection.imageSrc || '', collection.active, Number(collection.sortOrder || 100)]
      );

      await tx.unsafe('delete from collection_items where collection_id = $1', [collection.id]);
      for (const [itemIndex, placeId] of collection.itemIds.entries()) {
        await tx.unsafe(
          `
            insert into collection_items (collection_id, place_id, sort_order)
            values ($1, $2, $3)
            on conflict (collection_id, place_id) do update set sort_order = excluded.sort_order
          `,
          [collection.id, placeId, itemIndex * 10 + 10]
        );
      }
    }

    await tx.unsafe('delete from collections where id <> all($1::text[])', [normalizedItems.map((item) => item.id)]);
  });

  return readCollections();
}

async function updateCollectionItems(collectionIdOrSlug, itemIds) {
  const collections = await readCollections();
  const current = collections.find((collection) => collection.id === collectionIdOrSlug || collection.linkPath === collectionIdOrSlug);
  if (!current) {
    return null;
  }

  const nextCollections = collections.map((collection) =>
    collection.id === current.id
      ? { ...collection, itemIds: normalizeStringArray(itemIds) }
      : collection
  );

  await saveCollections(nextCollections);
  return (await readCollections()).find((collection) => collection.id === current.id) || null;
}

async function upsertPlace(incomingPlace) {
  const current = incomingPlace?.id ? await getPlaceById(incomingPlace.id) : null;
  const normalizedPlace = normalizePlace(incomingPlace, 0, current || undefined);
  const db = await getReadyDb();
  if (!db) {
    const store = getMemoryStore();
    const nextStore = setMemoryStore({
      ...store,
      places: [normalizedPlace, ...store.places.filter((place) => place.id !== normalizedPlace.id)]
    });
    return nextStore.places.find((place) => place.id === normalizedPlace.id) || normalizedPlace;
  }

  await db.begin(async (tx) => {
    await tx.unsafe(
      `
        insert into places (
          id, category_id, slug, title, description, address, phone, website, hours, avg_check, price_label, kind, cuisine,
          services, tags, breakfast, vegan, pets, child_programs, top, image_label, image_src,
          status, sort_order, lat, lng, map_query, district, contact_name, created_by_user_id, hotel_stars, hotel_pool, hotel_spa, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14::jsonb, $15::jsonb, $16, $17, $18, $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, now()
        )
        on conflict (id) do update set
          category_id = excluded.category_id,
          slug = excluded.slug,
          title = excluded.title,
          description = excluded.description,
          address = excluded.address,
          phone = excluded.phone,
          website = excluded.website,
          hours = excluded.hours,
          avg_check = excluded.avg_check,
          price_label = excluded.price_label,
          kind = excluded.kind,
          cuisine = excluded.cuisine,
          services = excluded.services,
          tags = excluded.tags,
          breakfast = excluded.breakfast,
          vegan = excluded.vegan,
          pets = excluded.pets,
          child_programs = excluded.child_programs,
          top = excluded.top,
          image_label = excluded.image_label,
          image_src = excluded.image_src,
          status = excluded.status,
          sort_order = excluded.sort_order,
          lat = excluded.lat,
          lng = excluded.lng,
          map_query = excluded.map_query,
          district = excluded.district,
          contact_name = excluded.contact_name,
          created_by_user_id = excluded.created_by_user_id,
          hotel_stars = excluded.hotel_stars,
          hotel_pool = excluded.hotel_pool,
          hotel_spa = excluded.hotel_spa,
          updated_at = now()
      `,
      [
        normalizedPlace.id,
        normalizedPlace.categoryId,
        normalizedPlace.slug,
        normalizedPlace.title,
        normalizedPlace.description,
        normalizedPlace.address,
        normalizedPlace.phone,
        normalizedPlace.website,
        normalizedPlace.hours,
        normalizedPlace.avgCheck,
        normalizedPlace.priceLabel || '',
        normalizedPlace.kind,
        normalizedPlace.cuisine,
        JSON.stringify(normalizedPlace.services || []),
        JSON.stringify(normalizedPlace.tags || []),
        normalizedPlace.breakfast,
        normalizedPlace.vegan,
        normalizedPlace.pets,
        normalizedPlace.childPrograms,
        normalizedPlace.top,
        normalizedPlace.imageLabel || '',
        normalizedPlace.imageSrc || '',
        coerceStatus(normalizedPlace.status),
        Number(normalizedPlace.sortOrder || 100),
        toNullableNumber(normalizedPlace.lat),
        toNullableNumber(normalizedPlace.lng),
        normalizedPlace.mapQuery || normalizedPlace.address || '',
        normalizedPlace.district || '',
        normalizedPlace.contactName || '',
        normalizedPlace.createdByUserId || '',
        normalizedPlace.hotelStars,
        Boolean(normalizedPlace.hotelPool),
        Boolean(normalizedPlace.hotelSpa)
      ]
    );

    await tx.unsafe('delete from place_images where place_id = $1', [normalizedPlace.id]);

    const gallery = normalizeStringArray(normalizedPlace.imageGallery || normalizedPlace.imageUrls);
    const finalGallery = gallery.length ? gallery : normalizedPlace.imageSrc ? [normalizedPlace.imageSrc] : [];
    for (const [imageIndex, imageUrl] of finalGallery.entries()) {
      await tx.unsafe(
        `
          insert into place_images (id, place_id, image_url, sort_order, is_cover)
          values ($1, $2, $3, $4, $5)
          on conflict (id) do update set
            place_id = excluded.place_id,
            image_url = excluded.image_url,
            sort_order = excluded.sort_order,
            is_cover = excluded.is_cover
        `,
        [`${normalizedPlace.id}:${imageIndex + 1}`, normalizedPlace.id, imageUrl, imageIndex * 10 + 10, imageIndex === 0]
      );
    }
  });

  return getPlaceById(normalizedPlace.id);
}

async function deletePlace(id) {
  const db = await getReadyDb();
  if (!db) {
    const store = getMemoryStore();
    return setMemoryStore({
      ...store,
      places: store.places.filter((place) => place.id !== id),
      home: {
        ...store.home,
        popularPlaceIds: store.home.popularPlaceIds.filter((itemId) => itemId !== id)
      },
      collections: store.collections.map((collection) => ({
        ...collection,
        itemIds: collection.itemIds.filter((itemId) => itemId !== id)
      }))
    });
  }

  await db.begin(async (tx) => {
    await tx.unsafe('delete from places where id = $1', [id]);
    await tx.unsafe('delete from collection_items where place_id = $1', [id]);

    const homeRows = await tx.unsafe('select payload from home_content where id = $1 limit 1', ['main']);
    const currentHome = normalizeContentStore({ home: homeRows[0]?.payload || cloneDefaultContent().home }).home;
    const nextHome = {
      ...currentHome,
      popularPlaceIds: currentHome.popularPlaceIds.filter((itemId) => itemId !== id)
    };

    await tx.unsafe(
      `
        insert into home_content (id, payload, updated_at)
        values ('main', $1::jsonb, now())
        on conflict (id) do update set payload = excluded.payload, updated_at = now()
      `,
      [JSON.stringify(nextHome)]
    );
  });

  return getContentStore();
}


async function getMediaFiles(limit = 120) {
  const db = await getReadyDb();
  if (!db) {
    return getMemoryMediaFiles(limit);
  }
  return db.unsafe(
    `
      select id, kind, file_name as "fileName", mime_type as "mimeType", size_bytes as "sizeBytes",
             storage_path as "storagePath", public_url as "publicUrl", created_at as "createdAt"
      from media_files
      order by created_at desc
      limit $1
    `,
    [limit]
  );
}

async function deleteMediaFileRecord(id) {
  const db = await getReadyDb();
  if (!db) {
    return deleteMemoryMediaFileRecord(id);
  }
  const rows = await db.unsafe(
    `delete from media_files where id = $1 returning id, kind, file_name as "fileName", mime_type as "mimeType", size_bytes as "sizeBytes", storage_path as "storagePath", public_url as "publicUrl", created_at as "createdAt"`,
    [id]
  );
  return rows[0] || null;
}

async function saveMediaFileRecord(input) {
  const record = {
    id: String(input?.id || crypto.randomUUID()),
    kind: String(input?.kind || 'general'),
    fileName: String(input?.fileName || ''),
    mimeType: String(input?.mimeType || ''),
    sizeBytes: Number(input?.sizeBytes || 0) || 0,
    storagePath: String(input?.storagePath || ''),
    publicUrl: String(input?.publicUrl || '')
  };
  const db = await getReadyDb();

  if (!db) {
    return saveMemoryMediaFileRecord(record);
  }
  await db.unsafe(
    `
      insert into media_files (id, kind, file_name, mime_type, size_bytes, storage_path, public_url)
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (id) do update set
        kind = excluded.kind,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        storage_path = excluded.storage_path,
        public_url = excluded.public_url
    `,
    [
      record.id,
      record.kind,
      record.fileName,
      record.mimeType,
      record.sizeBytes,
      record.storagePath,
      record.publicUrl
    ]
  );

  return record;
}

async function upsertPublicUser(profile) {
  const normalized = normalizePublicUserRecord({
    provider: profile?.provider,
    providerUserId: profile?.providerUserId || profile?.sub,
    displayName: profile?.displayName,
    givenName: profile?.givenName,
    familyName: profile?.familyName,
    email: profile?.email,
    emailVerified: profile?.emailVerified,
    avatarUrl: profile?.avatarUrl,
    username: profile?.username
  });

  if (!normalized.providerUserId) {
    throw new Error('Provider user id is required.');
  }

  const db = await getReadyDb();
  if (!db) {
    const users = getMemoryUsers();
    const existing = users.find((item) => item.provider === normalized.provider && item.providerUserId === normalized.providerUserId);
    const now = new Date().toISOString();
    const nextUser = normalizePublicUserRecord({
      ...existing,
      ...normalized,
      id: existing?.id || normalized.id,
      favoriteSlugs: existing?.favoriteSlugs || [],
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastLoginAt: now
    });
    writeMemoryUsers([nextUser, ...users.filter((item) => item.id !== nextUser.id)]);
    return toPublicUser(nextUser);
  }

  const rows = await db.unsafe(
    `
      insert into users (
        id, provider, provider_user_id, display_name, given_name, family_name, email,
        email_verified, avatar_url, username, created_at, updated_at, last_login_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now(), now()
      )
      on conflict (provider, provider_user_id) do update set
        display_name = excluded.display_name,
        given_name = excluded.given_name,
        family_name = excluded.family_name,
        email = excluded.email,
        email_verified = excluded.email_verified,
        avatar_url = excluded.avatar_url,
        username = excluded.username,
        updated_at = now(),
        last_login_at = now()
      returning id, provider, provider_user_id as "providerUserId", display_name as "displayName",
        given_name as "givenName", family_name as "familyName", email, email_verified as "emailVerified",
        avatar_url as "avatarUrl", username, created_at as "createdAt", updated_at as "updatedAt",
        last_login_at as "lastLoginAt"
    `,
    [
      normalized.id,
      normalized.provider,
      normalized.providerUserId,
      normalized.displayName,
      normalized.givenName,
      normalized.familyName,
      normalized.email,
      normalized.emailVerified,
      normalized.avatarUrl,
      normalized.username
    ]
  );

  return toPublicUser(rows[0]);
}

async function getUserFavorites(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    return [];
  }

  const db = await getReadyDb();
  if (!db) {
    return getMemoryUserFavorites(normalizedUserId);
  }

  const rows = await db.unsafe(
    `select place_slug as slug from user_favorites where user_id = $1 order by created_at desc`,
    [normalizedUserId]
  );
  return rows.map((item) => String(item.slug || '')).filter(Boolean);
}

async function replaceUserFavorites(userId, slugs) {
  const normalizedUserId = String(userId || '').trim();
  const normalizedSlugs = normalizeFavoriteSlugs(slugs);
  if (!normalizedUserId) {
    return [];
  }

  const db = await getReadyDb();
  if (!db) {
    return setMemoryUserFavorites(normalizedUserId, normalizedSlugs);
  }

  await db.begin(async (tx) => {
    await tx.unsafe('delete from user_favorites where user_id = $1', [normalizedUserId]);
    for (const slug of normalizedSlugs) {
      await tx.unsafe(
        `insert into user_favorites (user_id, place_slug, created_at) values ($1, $2, now()) on conflict do nothing`,
        [normalizedUserId, slug]
      );
    }
  });

  return getUserFavorites(normalizedUserId);
}

async function setUserFavorite(userId, slug, favorite) {
  const normalizedUserId = String(userId || '').trim();
  const normalizedSlug = String(slug || '').trim();
  if (!normalizedUserId || !normalizedSlug) {
    return getUserFavorites(normalizedUserId);
  }

  const db = await getReadyDb();
  if (!db) {
    return setMemoryUserFavorite(normalizedUserId, normalizedSlug, favorite);
  }

  if (favorite) {
    await db.unsafe(
      `insert into user_favorites (user_id, place_slug, created_at) values ($1, $2, now()) on conflict do nothing`,
      [normalizedUserId, normalizedSlug]
    );
  } else {
    await db.unsafe('delete from user_favorites where user_id = $1 and place_slug = $2', [normalizedUserId, normalizedSlug]);
  }

  return getUserFavorites(normalizedUserId);
}


module.exports = {
  appendAnalyticsEvent,
  cloneDefaultContent,
  deleteCategory,
  deleteMediaFileRecord,
  deletePlace,
  ensureDatabase,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  getContentStore,
  getPlaceById,
  getPlaceBySlug,
  getPlaces,
  getMediaFiles,
  getSql,
  hasDatabase,
  normalizeContentStore,
  normalizePlace,
  resetContentStore,
  saveCollections,
  saveContentStore,
  saveHomeContent,
  saveTips,
  syncDefaultContentStore,
  updateCollectionItems,
  saveMediaFileRecord,
  saveSupportContent,
  readSupportContent,
  replaceUserFavorites,
  setUserFavorite,
  upsertCategory,
  upsertPlace,
  upsertPublicUser,
  getUserFavorites
};
