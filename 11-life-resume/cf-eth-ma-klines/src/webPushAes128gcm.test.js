import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPushFetchInit, encodeB64Url, encryptAes128Gcm } from './webPushAes128gcm.js';

const RFC_PLAINTEXT = 'When I grow up, I want to be a watermelon';
const RFC_UA_PUBLIC =
  'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
const RFC_AS_PUBLIC =
  'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
const RFC_AS_PRIVATE = 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw';
const RFC_SALT = 'DGv6ra1nlYgDCS1FRnbzlw';
const RFC_AUTH = 'BTBZMqHH6r4Tts7J_aSIgg';
const RFC_BODY =
  'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
  'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
  'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';

describe('encryptAes128Gcm RFC 8291 appendix A', () => {
  it('matches the published ciphertext', async () => {
    const cipher = await encryptAes128Gcm({
      plaintext: RFC_PLAINTEXT,
      uaPublic: RFC_UA_PUBLIC,
      authSecret: RFC_AUTH,
      salt: RFC_SALT,
      asPublic: RFC_AS_PUBLIC,
      asPrivate: RFC_AS_PRIVATE,
    });
    assert.equal(encodeB64Url(cipher), RFC_BODY);
  });
});

describe('buildPushFetchInit', () => {
  it('sends aes128gcm with vapid Authorization and no Crypto-Key', async () => {
    const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const uaRaw = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
    const p256dh = encodeB64Url(uaRaw);
    const auth = encodeB64Url(crypto.getRandomValues(new Uint8Array(16)));
    const vapidPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign']
    );
    const vapidPub = new Uint8Array(await crypto.subtle.exportKey('raw', vapidPair.publicKey));
    const vapidJwk = await crypto.subtle.exportKey('jwk', vapidPair.privateKey);
    const init = await buildPushFetchInit({
      endpoint: 'https://fcm.googleapis.com/fcm/send/test',
      p256dh,
      auth,
      body: JSON.stringify({ title: 't', body: 'b' }),
      vapid: {
        subject: 'https://notee.vip',
        publicKey: encodeB64Url(vapidPub),
        privateKey: vapidJwk.d,
      },
      ttlSec: 900,
      urgency: 'high',
    });
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['Content-Encoding'], 'aes128gcm');
    assert.equal(init.headers.Urgency, 'high');
    assert.equal(init.headers.TTL, '900');
    assert.match(init.headers.Authorization, /^vapid t=.+, k=/);
    assert.equal(init.headers['Crypto-Key'], undefined);
    assert.equal(init.headers.Encryption, undefined);
    assert.ok(init.body instanceof Uint8Array);
    assert.ok(init.body.length > 86);
  });
});
