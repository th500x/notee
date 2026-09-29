/**
 * RFC 8291 aes128gcm + RFC 8292 VAPID（Authorization: vapid t=…, k=…）。
 * 须与 11 web-push 默认编码一致；禁止再用 draft aesgcm / Crypto-Key。
 */

const encoder = new TextEncoder();
const RECORD_SIZE = 4096;
const VAPID_TTL_SEC = 12 * 60 * 60;
const MAX_PLAINTEXT = RECORD_SIZE - 1 - 16;

export function decodeB64Url(str) {
  const raw = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (raw.length % 4)) % 4);
  const bin = atob(raw + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function encodeB64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function pad32(bytes) {
  if (bytes.length === 32) return bytes;
  if (bytes.length > 32) {
    throw new Error('P-256 scalar longer than 32 bytes');
  }
  const out = new Uint8Array(32);
  out.set(bytes, 32 - bytes.length);
  return out;
}

function asciiNul(text) {
  return encoder.encode(`${text}\0`);
}

async function hkdfSha256(ikm, salt, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

async function importEcdhPublic(uncompressed) {
  if (uncompressed.length !== 65 || uncompressed[0] !== 4) {
    throw new Error('p256dh must be 65-byte uncompressed P-256');
  }
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: encodeB64Url(uncompressed.slice(1, 33)),
      y: encodeB64Url(uncompressed.slice(33, 65)),
    },
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
}

async function importEcdhPrivate(uncompressed, dBytes) {
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: encodeB64Url(uncompressed.slice(1, 33)),
      y: encodeB64Url(uncompressed.slice(33, 65)),
      d: encodeB64Url(pad32(dBytes)),
    },
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );
}

async function exportUncompressed(publicKey) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return concat(new Uint8Array([4]), pad32(decodeB64Url(jwk.x)), pad32(decodeB64Url(jwk.y)));
}

/**
 * @param {object} params
 * @param {string|Uint8Array} params.plaintext
 * @param {string|Uint8Array} params.uaPublic
 * @param {string|Uint8Array} params.authSecret
 * @param {string|Uint8Array} [params.salt]
 * @param {string|Uint8Array} [params.asPublic]
 * @param {string|Uint8Array} [params.asPrivate]
 */
export async function encryptAes128Gcm(params) {
  const plaintextBytes =
    typeof params.plaintext === 'string' ? encoder.encode(params.plaintext) : params.plaintext;
  if (!plaintextBytes || plaintextBytes.length > MAX_PLAINTEXT) {
    throw new Error('web-push payload empty or too large for one aes128gcm record');
  }
  const uaPubBytes =
    typeof params.uaPublic === 'string' ? decodeB64Url(params.uaPublic) : params.uaPublic;
  const authBytes =
    typeof params.authSecret === 'string' ? decodeB64Url(params.authSecret) : params.authSecret;
  if (authBytes.length < 16) {
    throw new Error('subscription auth must be at least 16 bytes');
  }

  let asPubBytes;
  let asPrivKey;
  let saltBytes;
  if (params.asPrivate != null && params.asPublic != null) {
    asPubBytes = typeof params.asPublic === 'string' ? decodeB64Url(params.asPublic) : params.asPublic;
    const d =
      typeof params.asPrivate === 'string' ? decodeB64Url(params.asPrivate) : params.asPrivate;
    asPrivKey = await importEcdhPrivate(asPubBytes, d);
    saltBytes = params.salt
      ? typeof params.salt === 'string'
        ? decodeB64Url(params.salt)
        : params.salt
      : crypto.getRandomValues(new Uint8Array(16));
  } else {
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits']
    );
    asPrivKey = pair.privateKey;
    asPubBytes = await exportUncompressed(pair.publicKey);
    saltBytes = crypto.getRandomValues(new Uint8Array(16));
  }
  if (saltBytes.length !== 16) {
    throw new Error('aes128gcm salt must be 16 bytes');
  }

  const uaKey = await importEcdhPublic(uaPubBytes);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivKey, 256)
  );
  const keyInfo = concat(asciiNul('WebPush: info'), uaPubBytes, asPubBytes);
  const ikm = await hkdfSha256(shared, authBytes, keyInfo, 32);
  const cekBytes = await hkdfSha256(ikm, saltBytes, asciiNul('Content-Encoding: aes128gcm'), 16);
  const nonce = await hkdfSha256(ikm, saltBytes, asciiNul('Content-Encoding: nonce'), 12);
  const record = concat(plaintextBytes, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cekBytes, 'AES-GCM', false, ['encrypt']);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record)
  );

  const meta = new Uint8Array(5);
  const view = new DataView(meta.buffer);
  view.setUint32(0, RECORD_SIZE);
  meta[4] = asPubBytes.length;
  return concat(saltBytes, meta, asPubBytes, encrypted);
}

async function importEcdsaSignKey(publicB64, privateB64) {
  const pub = decodeB64Url(publicB64);
  if (pub.length !== 65 || pub[0] !== 4) {
    throw new Error('VAPID public key must be 65-byte uncompressed P-256');
  }
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: encodeB64Url(pub.slice(1, 33)),
      y: encodeB64Url(pub.slice(33, 65)),
      d: encodeB64Url(pad32(decodeB64Url(privateB64))),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

export async function buildVapidAuthorization(endpoint, vapid) {
  const audience = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + VAPID_TTL_SEC;
  const key = await importEcdsaSignKey(vapid.publicKey, vapid.privateKey);
  const header = encodeB64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = encodeB64Url(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp,
        sub: String(vapid.subject || 'https://notee.vip'),
      })
    )
  );
  const signingInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(signingInput)
  );
  return `vapid t=${signingInput}.${encodeB64Url(new Uint8Array(sig))}, k=${vapid.publicKey}`;
}

export async function buildPushFetchInit({ endpoint, p256dh, auth, body, vapid, ttlSec, urgency }) {
  const cipher = await encryptAes128Gcm({
    plaintext: body,
    uaPublic: p256dh,
    authSecret: auth,
  });
  const authorization = await buildVapidAuthorization(endpoint, vapid);
  return {
    method: 'POST',
    headers: {
      TTL: String(ttlSec),
      Urgency: urgency || 'high',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      Authorization: authorization,
    },
    body: cipher,
  };
}
