const crypto = require('node:crypto');

const ensureFixedLength = (buffer, size) => {
  if (buffer.length === size) return buffer;
  if (buffer.length > size) return buffer.subarray(buffer.length - size);
  return Buffer.concat([Buffer.alloc(size - buffer.length), buffer]);
};

const curve = crypto.createECDH('prime256v1');
curve.generateKeys();

const publicKey = ensureFixedLength(curve.getPublicKey(), 65).toString('base64url');
const privateKey = ensureFixedLength(curve.getPrivateKey(), 32).toString('base64url');

console.log('VAPID_PUBLIC_KEY=' + publicKey);
console.log('VAPID_PRIVATE_KEY=' + privateKey);
