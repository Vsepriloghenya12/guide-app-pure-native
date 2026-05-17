const crypto = require('crypto');
const { upsertPublicUser } = require('./db');

const USER_SESSION_COOKIE_NAME = 'guide_user_session';
const AUTH_STATE_COOKIE_NAME = 'guide_user_auth_state';
const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_STATE_TTL_SECONDS = 60 * 15;
const USER_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : process.env.OWNER_SESSION_SECRET || 'dev-guide-public-auth-secret');

function normalizeSameSite(value) {
  const candidate = String(value || '').trim().toLowerCase();
  if (candidate === 'none') return 'None';
  if (candidate === 'strict') return 'Strict';
  return 'Lax';
}

const USER_COOKIE_SAME_SITE = normalizeSameSite(process.env.COOKIE_SAME_SITE || process.env.USER_COOKIE_SAME_SITE || (process.env.NATIVE_APP_MODE === 'true' ? 'None' : 'Lax'));

function shouldUseSecureCookies(sameSite = USER_COOKIE_SAME_SITE) {
  return process.env.NODE_ENV === 'production' || sameSite === 'None' || process.env.COOKIE_SECURE === 'true';
}
const jwksCache = new Map();

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

function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4 || 4)) % 4;
  return Buffer.from(`${normalized}${'='.repeat(padLength)}`, 'base64');
}

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function signValue(value, secret = USER_SESSION_SECRET) {
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET is required.');
  }
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

function createSignedToken(payload, secret = USER_SESSION_SECRET) {
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${body}.${signValue(body, secret)}`;
}

function readSignedToken(rawValue, secret = USER_SESSION_SECRET) {
  if (!rawValue || typeof rawValue !== 'string') {
    return null;
  }

  const [body, signature] = rawValue.split('.');
  if (!body || !signature) {
    return null;
  }

  const expectedSignature = signValue(body, secret);
  const sameLength = signature.length === expectedSignature.length;
  const validSignature = sameLength
    ? crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    : false;

  if (!validSignature) {
    return null;
  }

  return safeJsonParse(base64UrlDecode(body).toString('utf8'));
}

function setCookie(res, name, value, { maxAgeSeconds, httpOnly = true, sameSite = 'Lax' } = {}) {
  const cookieParts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `SameSite=${sameSite}`
  ];

  if (typeof maxAgeSeconds === 'number') {
    cookieParts.push(`Max-Age=${maxAgeSeconds}`);
  }

  if (httpOnly) {
    cookieParts.push('HttpOnly');
  }

  if (shouldUseSecureCookies(sameSite)) {
    cookieParts.push('Secure');
  }

  res.append('Set-Cookie', cookieParts.join('; '));
}

function clearCookie(res, name, { httpOnly = true, sameSite = 'Lax' } = {}) {
  const cookieParts = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    `SameSite=${sameSite}`
  ];

  if (httpOnly) {
    cookieParts.push('HttpOnly');
  }

  if (shouldUseSecureCookies(sameSite)) {
    cookieParts.push('Secure');
  }

  res.append('Set-Cookie', cookieParts.join('; '));
}

function getRequestOrigin(req) {
  if (process.env.PUBLIC_APP_URL) {
    return String(process.env.PUBLIC_APP_URL).replace(/\/+$/g, '');
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const protocol = forwardedProto || (req.secure ? 'https' : 'http');
  const host = forwardedHost || req.headers.host;

  return `${protocol}://${host}`;
}

function normalizeReturnTo(value) {
  const candidate = String(value || '/').trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return '/';
  }

  return candidate;
}

function createUserProfile(profile) {
  const displayNameCandidate = [
    profile.displayName,
    [profile.givenName, profile.familyName].filter(Boolean).join(' ').trim(),
    profile.username ? `@${profile.username}` : '',
    profile.email,
    'Гость'
  ].find(Boolean);

  return {
    id: String(profile.id || '').trim(),
    provider: ['google', 'apple', 'telegram'].includes(String(profile.provider)) ? String(profile.provider) : 'google',
    sub: String(profile.sub || profile.providerUserId || '').trim(),
    displayName: String(displayNameCandidate || 'Гость').trim(),
    givenName: String(profile.givenName || '').trim(),
    familyName: String(profile.familyName || '').trim(),
    email: String(profile.email || '').trim(),
    emailVerified: Boolean(profile.emailVerified),
    avatarUrl: String(profile.avatarUrl || '').trim(),
    username: String(profile.username || '').trim()
  };
}

function setUserSessionCookie(res, profile) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iat: nowSeconds,
    exp: nowSeconds + USER_SESSION_TTL_SECONDS,
    user: createUserProfile(profile)
  };

  setCookie(res, USER_SESSION_COOKIE_NAME, createSignedToken(payload), {
    maxAgeSeconds: USER_SESSION_TTL_SECONDS,
    sameSite: USER_COOKIE_SAME_SITE
  });
}

function clearUserSessionCookie(res) {
  clearCookie(res, USER_SESSION_COOKIE_NAME, { sameSite: USER_COOKIE_SAME_SITE });
}

function readUserSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const payload = readSignedToken(cookies[USER_SESSION_COOKIE_NAME]);
  if (!payload?.user || !payload?.exp) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) <= nowSeconds) {
    return null;
  }

  return createUserProfile(payload.user);
}

async function persistAuthenticatedProfile(profile) {
  const user = await upsertPublicUser(profile);
  return createUserProfile({
    ...profile,
    ...user,
    sub: user?.sub || profile?.sub
  });
}

function createAuthState(res, provider, returnTo) {
  const state = crypto.randomUUID();
  const payload = {
    state,
    provider,
    returnTo: normalizeReturnTo(returnTo),
    iat: Date.now()
  };

  setCookie(res, AUTH_STATE_COOKIE_NAME, createSignedToken(payload), {
    maxAgeSeconds: AUTH_STATE_TTL_SECONDS,
    sameSite: USER_COOKIE_SAME_SITE === 'None' ? 'None' : provider === 'apple' ? 'None' : 'Lax'
  });
  return payload;
}

function readAuthState(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const payload = readSignedToken(cookies[AUTH_STATE_COOKIE_NAME]);
  if (!payload?.state || !payload?.provider || !payload?.iat) {
    return null;
  }

  const ageMs = Date.now() - Number(payload.iat);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > AUTH_STATE_TTL_SECONDS * 1000) {
    return null;
  }

  return {
    state: String(payload.state),
    provider: String(payload.provider),
    returnTo: normalizeReturnTo(payload.returnTo)
  };
}

function clearAuthStateCookie(res) {
  clearCookie(res, AUTH_STATE_COOKIE_NAME, { sameSite: USER_COOKIE_SAME_SITE === 'None' ? 'None' : 'Lax' });
}

function appendQueryToPath(pathname, query) {
  const url = new URL(normalizeReturnTo(pathname), 'http://local');
  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, String(value));
    }
  });
  return `${url.pathname}${url.search}${url.hash}`;
}

function redirectToReturnTo(res, returnTo, query = {}) {
  res.redirect(appendQueryToPath(returnTo, query));
}

function getProviderStatus() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: Boolean(
      process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY
    ),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME),
    telegramBotUsername: String(process.env.TELEGRAM_BOT_USERNAME || '').trim()
  };
}

function assertProviderAvailable(provider) {
  const providers = getProviderStatus();
  if (!providers[provider]) {
    throw new Error('Провайдер авторизации пока не настроен.');
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.error_description === 'string'
        ? data.error_description
        : typeof data?.error === 'string'
          ? data.error
          : typeof data?.message === 'string'
            ? data.message
            : 'Ошибка авторизации.';
    throw new Error(message);
  }
  return { data, headers: response.headers };
}

function getCacheTtlSeconds(headerValue) {
  const match = /max-age=(\d+)/i.exec(String(headerValue || ''));
  return match ? Number(match[1]) : 60 * 60;
}

async function getCachedJwks(jwksUrl) {
  const cached = jwksCache.get(jwksUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const response = await fetch(jwksUrl, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error('Не удалось получить ключи провайдера.');
  }

  const payload = await response.json();
  const keys = Array.isArray(payload?.keys) ? payload.keys : [];
  jwksCache.set(jwksUrl, {
    keys,
    expiresAt: Date.now() + getCacheTtlSeconds(response.headers.get('cache-control')) * 1000
  });
  return keys;
}

async function verifyJwtWithJwks({ token, jwksUrl, issuer, audience }) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(token || '').split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Некорректный токен авторизации.');
  }

  const header = safeJsonParse(base64UrlDecode(encodedHeader).toString('utf8'));
  const payload = safeJsonParse(base64UrlDecode(encodedPayload).toString('utf8'));

  if (!header?.kid || header.alg !== 'RS256') {
    throw new Error('Токен подписан неподдерживаемым алгоритмом.');
  }

  const keys = await getCachedJwks(jwksUrl);
  const jwk = keys.find((item) => item?.kid === header.kid);
  if (!jwk) {
    throw new Error('Не найден ключ для проверки токена.');
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const isSignatureValid = verifier.verify(publicKey, base64UrlDecode(encodedSignature));
  if (!isSignatureValid) {
    throw new Error('Не удалось проверить подпись токена.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload?.exp || Number(payload.exp) <= nowSeconds) {
    throw new Error('Токен авторизации уже истёк.');
  }

  const validIssuer = Array.isArray(issuer)
    ? issuer.includes(String(payload.iss || ''))
    : String(payload.iss || '') === issuer;
  if (!validIssuer) {
    throw new Error('Токен выпущен неподдерживаемым провайдером.');
  }

  const payloadAudience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!payloadAudience.includes(audience)) {
    throw new Error('Токен выпущен для другого приложения.');
  }

  return payload;
}

async function exchangeGoogleCode(req, code) {
  const redirectUri = `${getRequestOrigin(req)}/api/auth/google/callback`;
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const { data } = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!data?.id_token) {
    throw new Error('Google не вернул токен пользователя.');
  }

  const payload = await verifyJwtWithJwks({
    token: data.id_token,
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: process.env.GOOGLE_CLIENT_ID
  });

  return createUserProfile({
    provider: 'google',
    sub: payload.sub,
    displayName: payload.name,
    givenName: payload.given_name,
    familyName: payload.family_name,
    email: payload.email,
    emailVerified: payload.email_verified,
    avatarUrl: payload.picture
  });
}

function normalizeApplePrivateKey(rawValue) {
  return String(rawValue || '').replace(/\\n/g, '\n').trim();
}

function createAppleClientSecret() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'ES256', kid: process.env.APPLE_KEY_ID, typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: process.env.APPLE_TEAM_ID,
      iat: nowSeconds,
      exp: nowSeconds + 60 * 10,
      aud: 'https://appleid.apple.com',
      sub: process.env.APPLE_CLIENT_ID
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: crypto.createPrivateKey(normalizeApplePrivateKey(process.env.APPLE_PRIVATE_KEY)),
    dsaEncoding: 'ieee-p1363'
  });

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function exchangeAppleCode(req, code) {
  const redirectUri = `${getRequestOrigin(req)}/api/auth/apple/callback`;
  const body = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID,
    client_secret: createAppleClientSecret(),
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  });

  const { data } = await fetchJson('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!data?.id_token) {
    throw new Error('Apple не вернул токен пользователя.');
  }

  const payload = await verifyJwtWithJwks({
    token: data.id_token,
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    issuer: 'https://appleid.apple.com',
    audience: process.env.APPLE_CLIENT_ID
  });

  return payload;
}

function buildDisplayName(parts, fallback) {
  const merged = parts.filter(Boolean).join(' ').trim();
  return merged || fallback || 'Гость';
}

function verifyTelegramPayload(query) {
  const providerStatus = getProviderStatus();
  if (!providerStatus.telegram) {
    throw new Error('Telegram авторизация пока не настроена.');
  }

  const authData = {};
  Object.entries(query || {}).forEach(([key, value]) => {
    if (!['hash', 'returnTo'].includes(key) && typeof value === 'string' && value.trim()) {
      authData[key] = value.trim();
    }
  });

  const incomingHash = String(query?.hash || '').trim();
  if (!incomingHash || !authData.id || !authData.auth_date) {
    throw new Error('Telegram не передал достаточно данных для входа.');
  }

  const authAgeSeconds = Math.floor(Date.now() / 1000) - Number(authData.auth_date);
  if (!Number.isFinite(authAgeSeconds) || authAgeSeconds < 0 || authAgeSeconds > 60 * 60 * 24) {
    throw new Error('Данные Telegram уже устарели. Повторите вход.');
  }

  const dataCheckString = Object.keys(authData)
    .sort()
    .map((key) => `${key}=${authData[key]}`)
    .join('\n');

  const secret = crypto.createHash('sha256').update(String(process.env.TELEGRAM_BOT_TOKEN)).digest();
  const expectedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const sameLength = incomingHash.length === expectedHash.length;
  const validHash = sameLength
    ? crypto.timingSafeEqual(Buffer.from(incomingHash), Buffer.from(expectedHash))
    : false;

  if (!validHash) {
    throw new Error('Не удалось проверить подпись Telegram.');
  }

  return createUserProfile({
    provider: 'telegram',
    sub: authData.id,
    displayName: buildDisplayName([authData.first_name, authData.last_name], authData.username ? `@${authData.username}` : 'Пользователь Telegram'),
    givenName: authData.first_name,
    familyName: authData.last_name,
    avatarUrl: authData.photo_url,
    username: authData.username
  });
}

function buildGoogleAuthUrl(req, state) {
  assertProviderAvailable('google');
  const redirectUri = `${getRequestOrigin(req)}/api/auth/google/callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);
  return url.toString();
}

function buildAppleAuthUrl(req, state) {
  assertProviderAvailable('apple');
  const redirectUri = `${getRequestOrigin(req)}/api/auth/apple/callback`;
  const url = new URL('https://appleid.apple.com/auth/authorize');
  url.searchParams.set('client_id', process.env.APPLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'form_post');
  url.searchParams.set('scope', 'name email');
  url.searchParams.set('state', state);
  return url.toString();
}

function ensureStateCookie(req, res, provider, returnTo) {
  return createAuthState(res, provider, returnTo);
}

function getAuthErrorRedirectPath(returnTo, provider, error) {
  return appendQueryToPath(returnTo, {
    auth: 'error',
    provider,
    message: error instanceof Error ? error.message : String(error || 'Ошибка авторизации')
  });
}

function getAuthSuccessRedirectPath(returnTo, provider) {
  return appendQueryToPath(returnTo, {
    auth: 'success',
    provider
  });
}

function getStateOrThrow(req, provider, incomingState) {
  const state = readAuthState(req);
  if (!state || state.provider !== provider || state.state !== String(incomingState || '')) {
    throw new Error('Сессия входа устарела. Повторите попытку.');
  }

  return state;
}

function registerPublicAuthRoutes(app) {
  app.get('/api/auth/session', (req, res) => {
    res.json({
      ok: true,
      authenticated: Boolean(readUserSession(req)),
      user: readUserSession(req),
      providers: getProviderStatus()
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearUserSessionCookie(res);
    clearAuthStateCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/google/start', (req, res) => {
    const returnTo = normalizeReturnTo(req.query.returnTo);
    try {
      const state = ensureStateCookie(req, res, 'google', returnTo);
      res.redirect(buildGoogleAuthUrl(req, state.state));
    } catch (error) {
      redirectToReturnTo(res, returnTo, {
        auth: 'error',
        provider: 'google',
        message: error instanceof Error ? error.message : 'Google вход пока недоступен.'
      });
    }
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    let returnTo = normalizeReturnTo(req.query.returnTo);
    try {
      const state = getStateOrThrow(req, 'google', req.query.state);
      returnTo = state.returnTo;
      const code = String(req.query.code || '').trim();
      if (!code) {
        throw new Error('Google не вернул код авторизации.');
      }

      const profile = await exchangeGoogleCode(req, code);
      const user = await persistAuthenticatedProfile(profile);
      clearAuthStateCookie(res);
      setUserSessionCookie(res, user);
      res.redirect(getAuthSuccessRedirectPath(returnTo, 'google'));
    } catch (error) {
      clearAuthStateCookie(res);
      res.redirect(getAuthErrorRedirectPath(returnTo, 'google', error));
    }
  });

  app.get('/api/auth/apple/start', (req, res) => {
    const returnTo = normalizeReturnTo(req.query.returnTo);
    try {
      const state = ensureStateCookie(req, res, 'apple', returnTo);
      res.redirect(buildAppleAuthUrl(req, state.state));
    } catch (error) {
      redirectToReturnTo(res, returnTo, {
        auth: 'error',
        provider: 'apple',
        message: error instanceof Error ? error.message : 'Apple вход пока недоступен.'
      });
    }
  });

  app.post('/api/auth/apple/callback', async (req, res) => {
    let returnTo = normalizeReturnTo(req.body?.returnTo);
    try {
      const state = getStateOrThrow(req, 'apple', req.body?.state);
      returnTo = state.returnTo;
      const code = String(req.body?.code || '').trim();
      if (!code) {
        throw new Error('Apple не вернул код авторизации.');
      }

      const tokenPayload = await exchangeAppleCode(req, code);
      const appleUser = safeJsonParse(String(req.body?.user || ''), {});
      const firstName = String(appleUser?.name?.firstName || '').trim();
      const lastName = String(appleUser?.name?.lastName || '').trim();
      const email = String(appleUser?.email || tokenPayload.email || '').trim();
      const profile = createUserProfile({
        provider: 'apple',
        sub: tokenPayload.sub,
        displayName: buildDisplayName([firstName, lastName], email || 'Apple ID'),
        givenName: firstName,
        familyName: lastName,
        email,
        emailVerified: String(tokenPayload.email_verified || '').toLowerCase() === 'true'
      });

      const user = await persistAuthenticatedProfile(profile);
      clearAuthStateCookie(res);
      setUserSessionCookie(res, user);
      res.redirect(getAuthSuccessRedirectPath(returnTo, 'apple'));
    } catch (error) {
      clearAuthStateCookie(res);
      res.redirect(getAuthErrorRedirectPath(returnTo, 'apple', error));
    }
  });

  app.get('/api/auth/telegram/callback', async (req, res) => {
    const returnTo = normalizeReturnTo(req.query.returnTo);
    try {
      const profile = verifyTelegramPayload(req.query);
      const user = await persistAuthenticatedProfile(profile);
      setUserSessionCookie(res, user);
      res.redirect(getAuthSuccessRedirectPath(returnTo, 'telegram'));
    } catch (error) {
      res.redirect(getAuthErrorRedirectPath(returnTo, 'telegram', error));
    }
  });
}

module.exports = {
  clearUserSessionCookie,
  getProviderStatus,
  readUserSession,
  registerPublicAuthRoutes
};
