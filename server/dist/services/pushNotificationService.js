"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushNotificationService = exports.PushNotificationService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("../config");
const storage_1 = require("./storage");
class PushSendError extends Error {
    statusCode;
    constructor(statusCode, message) {
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
const keyFilePath = () => node_path_1.default.join(node_path_1.default.dirname(config_1.config.storageFile), 'vapid-keys.json');
const base64UrlEncode = (input) => Buffer.from(input).toString('base64url');
const base64UrlDecode = (input) => Buffer.from(input, 'base64url');
const ensureFixedLength = (buffer, size) => {
    if (buffer.length === size) {
        return buffer;
    }
    if (buffer.length > size) {
        return buffer.subarray(buffer.length - size);
    }
    return Buffer.concat([Buffer.alloc(size - buffer.length), buffer]);
};
const generateVapidKeys = () => {
    const curve = node_crypto_1.default.createECDH('prime256v1');
    curve.generateKeys();
    return {
        publicKey: ensureFixedLength(curve.getPublicKey(), PUBLIC_KEY_LENGTH).toString('base64url'),
        privateKey: ensureFixedLength(curve.getPrivateKey(), PRIVATE_KEY_LENGTH).toString('base64url')
    };
};
const readOrCreateVapidKeys = () => {
    if (!config_1.config.pushEnabled) {
        return null;
    }
    if (config_1.config.vapidPublicKey && config_1.config.vapidPrivateKey) {
        return {
            publicKey: config_1.config.vapidPublicKey,
            privateKey: config_1.config.vapidPrivateKey
        };
    }
    const filename = keyFilePath();
    if (node_fs_1.default.existsSync(filename)) {
        try {
            const parsed = JSON.parse(node_fs_1.default.readFileSync(filename, 'utf-8'));
            if (parsed.publicKey && parsed.privateKey) {
                return {
                    publicKey: parsed.publicKey,
                    privateKey: parsed.privateKey
                };
            }
        }
        catch (error) {
            console.error('Не удалось прочитать VAPID-ключи push-уведомлений:', error);
        }
    }
    const generated = generateVapidKeys();
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(filename), { recursive: true });
    node_fs_1.default.writeFileSync(filename, JSON.stringify(generated, null, 2), 'utf-8');
    return generated;
};
const validateVapidKeys = (keys) => {
    if (base64UrlDecode(keys.publicKey).length !== PUBLIC_KEY_LENGTH) {
        throw new Error('VAPID_PUBLIC_KEY должен быть base64url-ключом P-256 длиной 65 байт.');
    }
    if (base64UrlDecode(keys.privateKey).length !== PRIVATE_KEY_LENGTH) {
        throw new Error('VAPID_PRIVATE_KEY должен быть base64url-ключом P-256 длиной 32 байта.');
    }
};
const formatPrice = (value) => {
    if (value >= 1000)
        return value.toFixed(2);
    if (value >= 1)
        return value.toFixed(4);
    return value.toFixed(8);
};
const hkdfExtract = (salt, inputKeyingMaterial) => node_crypto_1.default.createHmac('sha256', salt).update(inputKeyingMaterial).digest();
const hkdfExpand = (pseudoRandomKey, info, length) => {
    const chunks = [];
    let previous = Buffer.alloc(0);
    let outputLength = 0;
    let counter = 1;
    while (outputLength < length) {
        const hmac = node_crypto_1.default.createHmac('sha256', pseudoRandomKey);
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
const deriveWebPushSecret = (authSecret, sharedSecret, receiverPublicKey, senderPublicKey) => {
    const info = Buffer.concat([Buffer.from('WebPush: info\0', 'ascii'), receiverPublicKey, senderPublicKey]);
    const prk = hkdfExtract(authSecret, sharedSecret);
    return hkdfExpand(prk, info, AUTH_SECRET_LENGTH);
};
const generateNonce = (base, counter) => {
    const nonce = Buffer.from(base);
    const current = nonce.readUIntBE(nonce.length - 6, 6);
    const mixed = ((current ^ counter) & 0xffffff) + ((((current / 0x1000000) ^ (counter / 0x1000000)) & 0xffffff) * 0x1000000);
    nonce.writeUIntBE(mixed, nonce.length - 6, 6);
    return nonce;
};
const encryptWebPushPayload = (payload, subscription) => {
    const receiverPublicKey = base64UrlDecode(subscription.keys.p256dh);
    const authSecret = base64UrlDecode(subscription.keys.auth);
    if (receiverPublicKey.length !== PUBLIC_KEY_LENGTH) {
        throw new Error('Push-подписка содержит некорректный p256dh-ключ.');
    }
    if (authSecret.length < KEY_LENGTH) {
        throw new Error('Push-подписка содержит некорректный auth-ключ.');
    }
    const localCurve = node_crypto_1.default.createECDH('prime256v1');
    const senderPublicKey = localCurve.generateKeys();
    const sharedSecret = localCurve.computeSecret(receiverPublicKey);
    const salt = node_crypto_1.default.randomBytes(KEY_LENGTH);
    const secret = deriveWebPushSecret(authSecret, sharedSecret, receiverPublicKey, senderPublicKey);
    const prk = hkdfExtract(salt, secret);
    const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0', 'ascii'), KEY_LENGTH);
    const nonceBase = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0', 'ascii'), NONCE_LENGTH);
    const nonce = generateNonce(nonceBase, 0);
    const cipher = node_crypto_1.default.createCipheriv(AES_GCM_ALGORITHM, cek, nonce);
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
const createPrivateKey = (keys) => {
    const publicKey = base64UrlDecode(keys.publicKey);
    const privateKey = base64UrlDecode(keys.privateKey);
    const jwk = {
        kty: 'EC',
        crv: 'P-256',
        x: publicKey.subarray(1, 33).toString('base64url'),
        y: publicKey.subarray(33, 65).toString('base64url'),
        d: privateKey.toString('base64url')
    };
    return node_crypto_1.default.createPrivateKey({ key: jwk, format: 'jwk' });
};
const createVapidAuthorization = (endpoint, keys) => {
    const audienceUrl = new URL(endpoint);
    const audience = `${audienceUrl.protocol}//${audienceUrl.host}`;
    const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
    const header = base64UrlEncode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const body = base64UrlEncode(JSON.stringify({ aud: audience, exp: expiration, sub: config_1.config.pushSubject }));
    const tokenInput = `${header}.${body}`;
    const signature = node_crypto_1.default.sign('sha256', Buffer.from(tokenInput), {
        key: createPrivateKey(keys),
        dsaEncoding: 'ieee-p1363'
    });
    return `vapid t=${tokenInput}.${signature.toString('base64url')}, k=${keys.publicKey}`;
};
const getStatusCode = (error) => {
    if (error instanceof PushSendError) {
        return error.statusCode;
    }
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
        const statusCode = error.statusCode;
        return typeof statusCode === 'number' ? statusCode : null;
    }
    return null;
};
const sendEncryptedPush = async (subscription, payload, vapidKeys) => {
    const encrypted = encryptWebPushPayload(JSON.stringify(payload), subscription);
    const requestBody = encrypted.body.buffer.slice(encrypted.body.byteOffset, encrypted.body.byteOffset + encrypted.body.byteLength);
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
class PushNotificationService {
    vapidKeys;
    constructor() {
        this.vapidKeys = readOrCreateVapidKeys();
        if (this.vapidKeys) {
            validateVapidKeys(this.vapidKeys);
        }
    }
    getStatus() {
        const pushState = storage_1.storageService.getPushState();
        return {
            enabled: Boolean(config_1.config.pushEnabled && this.vapidKeys),
            publicKey: this.vapidKeys?.publicKey ?? null,
            subscriptionsCount: pushState.subscriptions.length,
            lastNotificationAt: pushState.sentEvents[0]?.sentAt ?? null,
            lastNotification: pushState.sentEvents[0] ?? null
        };
    }
    getPublicKey() {
        return this.vapidKeys?.publicKey ?? null;
    }
    subscribe(subscription, userAgent) {
        if (!config_1.config.pushEnabled || !this.vapidKeys) {
            throw new Error('Push-уведомления выключены на сервере.');
        }
        if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
            throw new Error('Браузер прислал неполную push-подписку.');
        }
        return storage_1.storageService.upsertPushSubscription({
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
            },
            userAgent
        });
    }
    unsubscribe(endpoint) {
        if (!endpoint) {
            return;
        }
        storage_1.storageService.removePushSubscription(endpoint);
    }
    async sendTest() {
        return this.sendToAll({
            title: 'Пуш уведомления включены',
            body: 'Теперь новые сигналы “Покупать” будут приходить на телефон.',
            url: '/',
            tag: 'push-test'
        });
    }
    async notifySignal(signal) {
        if (!config_1.config.pushEnabled || !this.vapidKeys || signal.recommendation !== 'BUY_NOW' || !signal.tradePlan) {
            return;
        }
        const pushState = storage_1.storageService.getPushState();
        if (pushState.subscriptions.length === 0) {
            return;
        }
        const signalKey = `${signal.symbol}:${signal.timeframe}`;
        const latestSameSignal = pushState.sentEvents.find((item) => item.signalKey === signalKey && item.status === 'SENT');
        if (latestSameSignal) {
            const ageMs = new Date(signal.createdAt).getTime() - new Date(latestSameSignal.sentAt).getTime();
            if (ageMs >= 0 && ageMs < config_1.config.pushMinRepeatMs) {
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
        const event = {
            id: node_crypto_1.default.randomUUID(),
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
        storage_1.storageService.recordPushEvent(event);
    }
    async sendToAll(payload) {
        if (!config_1.config.pushEnabled || !this.vapidKeys) {
            return { sent: 0, failed: 0 };
        }
        const pushState = storage_1.storageService.getPushState();
        let sent = 0;
        let failed = 0;
        await Promise.all(pushState.subscriptions.map(async (subscription) => {
            try {
                await sendEncryptedPush(subscription, payload, this.vapidKeys);
                sent += 1;
            }
            catch (error) {
                failed += 1;
                const statusCode = getStatusCode(error);
                if (statusCode === 404 || statusCode === 410) {
                    storage_1.storageService.removePushSubscription(subscription.endpoint);
                }
                else {
                    console.error('Не удалось отправить push-уведомление:', error);
                }
            }
        }));
        return { sent, failed };
    }
}
exports.PushNotificationService = PushNotificationService;
exports.pushNotificationService = new PushNotificationService();
