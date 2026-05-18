import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { PushNotificationEvent, PushSubscriptionRecord, SignalRecord } from '../types';
import { storageService } from './storage';

interface StoredVapidKeys {
  publicKey: string;
  privateKey: string;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  signalId?: string;
  symbol?: string;
  timeframe?: string;
}

interface EncryptedWebPushPayload {
  body: Buffer;
  contentEncoding: 'aes128gcm';
}

class PushSendError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const AES_GCM_ALGORITHM = 'aes-128-gcm';
const RECORD_SIZE = 4096;
const TAG_LENGTH = 16;
const KEY_LENGTH = 16;
const NONCE_LENGTH = 12;
const AUTH_SECRET_LENGTH = 32;
const PUBLIC_KEY_LENGTH = 65;
const PRIVATE_KEY_LENGTH = 32;

const keyFilePath = (): string => path.join(path.dirname(config.storageFile), 'vapid-keys.json');

const base64UrlEncode = (input: Buffer | string): string => Buffer.from(input).toString('base64url');

const base64UrlDecode = (input: string): Buffer => Buffer.from(input, 'base64url');

const ensureFixedLength = (buffer: Buffer, size: number): Buffer => {
  if (buffer.length === size) {
    return buffer;
  }

  if (buffer.length > size) {
    return buffer.subarray(buffer.length - size);
  }

  return Buffer.concat([Buffer.alloc(size - buffer.length), buffer]);
};

const generateVapidKeys = (): StoredVapidKeys => {
  const curve = crypto.createECDH('prime256v1');
  curve.generateKeys();

  return {
    publicKey: ensureFixedLength(curve.getPublicKey(), PUBLIC_KEY_LENGTH).toString('base64url'),
    privateKey: ensureFixedLength(curve.getPrivateKey(), PRIVATE_KEY_LENGTH).toString('base64url')
  };
};

const readOrCreateVapidKeys = (): StoredVapidKeys | null => {
  if (!config.pushEnabled) {
    return null;
  }

  if (config.vapidPublicKey && config.vapidPrivateKey) {
    return {
      publicKey: config.vapidPublicKey,
      privateKey: config.vapidPrivateKey
    };
  }

  const filename = keyFilePath();
  if (fs.existsSync(filename)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filename, 'utf-8')) as Partial<StoredVapidKeys>;
      if (parsed.publicKey && parsed.privateKey) {
        return {
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey
        };
      }
    } catch (error) {
      console.error('Не удалось прочитать VAPID-ключи push-уведомлений:', error);
    }
  }

  const generated = generateVapidKeys();
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(generated, null, 2), 'utf-8');
  return generated;
};

const validateVapidKeys = (keys: StoredVapidKeys): void => {
  if (base64UrlDecode(keys.publicKey).length !== PUBLIC_KEY_LENGTH) {
    throw new Error('VAPID_PUBLIC_KEY должен быть base64url-ключом P-256 длиной 65 байт.');
  }

  if (base64UrlDecode(keys.privateKey).length !== PRIVATE_KEY_LENGTH) {
    throw new Error('VAPID_PRIVATE_KEY должен быть base64url-ключом P-256 длиной 32 байта.');
  }
};

const formatPrice = (value: number): string => {
  if (value >= 1000) return value.toFixed(2);
  if (value >= 1) return value.toFixed(4);
  return value.toFixed(8);
};

const hkdfExtract = (salt: Buffer, inputKeyingMaterial: Buffer): Buffer =>
  crypto.createHmac('sha256', salt).update(inputKeyingMaterial).digest();

const hkdfExpand = (pseudoRandomKey: Buffer, info: Buffer, length: number): Buffer => {
  const chunks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let outputLength = 0;
  let counter = 1;

  while (outputLength < length) {
    const hmac = crypto.createHmac('sha256', pseudoRandomKey);
    hmac.update(previous);
    hmac.update(info);
    hmac.update(Buffer.from([counter]));
    previous = hmac.digest();
    chunks.push(previous);
    outputLength += previous.length;
    counter += 1;
  }

  return Buffer.concat(chunks).subarray(0, length);
};

const deriveWebPushSecret = (authSecret: Buffer, sharedSecret: Buffer, receiverPublicKey: Buffer, senderPublicKey: Buffer): Buffer => {
  const info = Buffer.concat([Buffer.from('WebPush: info\0', 'ascii'), receiverPublicKey, senderPublicKey]);
  const prk = hkdfExtract(authSecret, sharedSecret);
  return hkdfExpand(prk, info, AUTH_SECRET_LENGTH);
};

const generateNonce = (base: Buffer, counter: number): Buffer => {
  const nonce = Buffer.from(base);
  const current = nonce.readUIntBE(nonce.length - 6, 6);
  const mixed =
    ((current ^ counter) & 0xffffff) + ((((current / 0x1000000) ^ (counter / 0x1000000)) & 0xffffff) * 0x1000000);
  nonce.writeUIntBE(mixed, nonce.length - 6, 6);
  return nonce;
};

const encryptWebPushPayload = (payload: string, subscription: PushSubscriptionRecord): EncryptedWebPushPayload => {
  const receiverPublicKey = base64UrlDecode(subscription.keys.p256dh);
  const authSecret = base64UrlDecode(subscription.keys.auth);

  if (receiverPublicKey.length !== PUBLIC_KEY_LENGTH) {
    throw new Error('Push-подписка содержит некорректный p256dh-ключ.');
  }

  if (authSecret.length < KEY_LENGTH) {
    throw new Error('Push-подписка содержит некорректный auth-ключ.');
  }

  const localCurve = crypto.createECDH('prime256v1');
  const senderPublicKey = localCurve.generateKeys();
  const sharedSecret = localCurve.computeSecret(receiverPublicKey);
  const salt = crypto.randomBytes(KEY_LENGTH);

  const secret = deriveWebPushSecret(authSecret, sharedSecret, receiverPublicKey, senderPublicKey);
  const prk = hkdfExtract(salt, secret);
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0', 'ascii'), KEY_LENGTH);
  const nonceBase = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0', 'ascii'), NONCE_LENGTH);
  const nonce = generateNonce(nonceBase, 0);

  const cipher = crypto.createCipheriv(AES_GCM_ALGORITHM, cek, nonce);
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(senderPublicKey.length, 20);

  return {
    body: Buffer.concat([header, senderPublicKey, ciphertext]),
    contentEncoding: 'aes128gcm'
  };
};

const createPrivateKey = (keys: StoredVapidKeys): crypto.KeyObject => {
  const publicKey = base64UrlDecode(keys.publicKey);
  const privateKey = base64UrlDecode(keys.privateKey);

  const jwk: crypto.JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: publicKey.subarray(1, 33).toString('base64url'),
    y: publicKey.subarray(33, 65).toString('base64url'),
    d: privateKey.toString('base64url')
  };

  return crypto.createPrivateKey({ key: jwk, format: 'jwk' });
};

const createVapidAuthorization = (endpoint: string, keys: StoredVapidKeys): string => {
  const audienceUrl = new URL(endpoint);
  const audience = `${audienceUrl.protocol}//${audienceUrl.host}`;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  const header = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = base64UrlEncode(JSON.stringify({ aud: audience, exp: expiration, sub: config.pushSubject }));
  const tokenInput = `${header}.${body}`;
  const signature = crypto.sign('sha256', Buffer.from(tokenInput), {
    key: createPrivateKey(keys),
    dsaEncoding: 'ieee-p1363'
  });

  return `vapid t=${tokenInput}.${signature.toString('base64url')}, k=${keys.publicKey}`;
};

const getStatusCode = (error: unknown): number | null => {
  if (error instanceof PushSendError) {
    return error.statusCode;
  }

  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : null;
  }

  return null;
};

const sendEncryptedPush = async (subscription: PushSubscriptionRecord, payload: PushPayload, vapidKeys: StoredVapidKeys): Promise<void> => {
  const encrypted = encryptWebPushPayload(JSON.stringify(payload), subscription);
  const requestBody = encrypted.body.buffer.slice(
    encrypted.body.byteOffset,
    encrypted.body.byteOffset + encrypted.body.byteLength
  ) as ArrayBuffer;

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(60 * 30),
      Urgency: 'normal',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': encrypted.contentEncoding,
      'Content-Length': String(encrypted.body.length),
      Authorization: createVapidAuthorization(subscription.endpoint, vapidKeys)
    },
    body: requestBody
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new PushSendError(response.status, text || `Push endpoint вернул HTTP ${response.status}`);
  }
};

export class PushNotificationService {
  private readonly vapidKeys: StoredVapidKeys | null;

  constructor() {
    this.vapidKeys = readOrCreateVapidKeys();

    if (this.vapidKeys) {
      validateVapidKeys(this.vapidKeys);
    }
  }

  public getStatus() {
    const pushState = storageService.getPushState();
    return {
      enabled: Boolean(config.pushEnabled && this.vapidKeys),
      publicKey: this.vapidKeys?.publicKey ?? null,
      subscriptionsCount: pushState.subscriptions.length,
      lastNotificationAt: pushState.sentEvents[0]?.sentAt ?? null,
      lastNotification: pushState.sentEvents[0] ?? null
    };
  }

  public getPublicKey(): string | null {
    return this.vapidKeys?.publicKey ?? null;
  }

  public subscribe(subscription: Partial<PushSubscriptionRecord>, userAgent: string | null): PushSubscriptionRecord {
    if (!config.pushEnabled || !this.vapidKeys) {
      throw new Error('Push-уведомления выключены на сервере.');
    }

    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
      throw new Error('Браузер прислал неполную push-подписку.');
    }

    return storageService.upsertPushSubscription({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      userAgent
    });
  }

  public unsubscribe(endpoint: string | undefined): void {
    if (!endpoint) {
      return;
    }
    storageService.removePushSubscription(endpoint);
  }

  public async sendTest(): Promise<{ sent: number; failed: number }> {
    return this.sendToAll({
      title: 'Пуш уведомления включены',
      body: 'Теперь новые сигналы “Покупать” будут приходить на телефон.',
      url: '/',
      tag: 'push-test'
    });
  }

  public async notifySignal(signal: SignalRecord): Promise<void> {
    if (!config.pushEnabled || !this.vapidKeys || signal.recommendation !== 'BUY_NOW' || !signal.tradePlan) {
      return;
    }

    const pushState = storageService.getPushState();
    if (pushState.subscriptions.length === 0) {
      return;
    }

    const signalKey = `${signal.symbol}:${signal.timeframe}`;
    const latestSameSignal = pushState.sentEvents.find((item) => item.signalKey === signalKey && item.status === 'SENT');
    if (latestSameSignal) {
      const ageMs = new Date(signal.createdAt).getTime() - new Date(latestSameSignal.sentAt).getTime();
      if (ageMs >= 0 && ageMs < config.pushMinRepeatMs) {
        return;
      }
    }

    const plan = signal.tradePlan;
    const title = `Покупать ${signal.symbol}`;
    const body = `Вход ${formatPrice(plan.entryMin)}–${formatPrice(plan.entryMax)} · Стоп ${formatPrice(plan.stopLoss)} · TP1 ${formatPrice(plan.takeProfit1)} · TP2 ${formatPrice(plan.takeProfit2)}`;

    const result = await this.sendToAll({
      title,
      body,
      url: '/',
      tag: signalKey,
      signalId: signal.id,
      symbol: signal.symbol,
      timeframe: signal.timeframe
    });

    const event: PushNotificationEvent = {
      id: crypto.randomUUID(),
      signalId: signal.id,
      signalKey,
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      title,
      body,
      url: '/',
      sentAt: new Date().toISOString(),
      status: result.sent > 0 ? 'SENT' : 'FAILED',
      deliveredCount: result.sent,
      failedCount: result.failed
    };

    storageService.recordPushEvent(event);
  }

  private async sendToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
    if (!config.pushEnabled || !this.vapidKeys) {
      return { sent: 0, failed: 0 };
    }

    const pushState = storageService.getPushState();
    let sent = 0;
    let failed = 0;

    await Promise.all(
      pushState.subscriptions.map(async (subscription) => {
        try {
          await sendEncryptedPush(subscription, payload, this.vapidKeys as StoredVapidKeys);
          sent += 1;
        } catch (error) {
          failed += 1;
          const statusCode = getStatusCode(error);
          if (statusCode === 404 || statusCode === 410) {
            storageService.removePushSubscription(subscription.endpoint);
          } else {
            console.error('Не удалось отправить push-уведомление:', error);
          }
        }
      })
    );

    return { sent, failed };
  }
}

export const pushNotificationService = new PushNotificationService();
