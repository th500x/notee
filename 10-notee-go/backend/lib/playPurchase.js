/**
 * Google Play one-time product check.
 * Without PLAY_SERVICE_ACCOUNT_JSON this refuses. It never treats a token as paid.
 */

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const { httpError } = require('./httpError');

const PACKAGE_FALLBACK = 'com.notee.go';

function packageName() {
  const name = String(process.env.PLAY_PACKAGE_NAME || PACKAGE_FALLBACK).trim();
  return name || PACKAGE_FALLBACK;
}

function loadAccount() {
  const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw || !String(raw).trim()) return null;
  const text = String(raw).trim();
  const json = text.startsWith('{') ? text : fs.readFileSync(text, 'utf8');
  const account = JSON.parse(json);
  if (!account.client_email || !account.private_key) return null;
  return account;
}

function postForm(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch (err) {
            parsed = null;
          }
          if (res.statusCode < 200 || res.statusCode >= 300 || !parsed) {
            reject(httpError(503, 'Google 没有接受购买核对', 'PLAY_VERIFY_UNAVAILABLE'));
            return;
          }
          resolve(parsed);
        });
      }
    );
    req.on('error', () => {
      reject(httpError(503, 'Google 没有接受购买核对', 'PLAY_VERIFY_UNAVAILABLE'));
    });
    req.write(body);
    req.end();
  });
}

function getJson(url, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch (err) {
            parsed = null;
          }
          if (!parsed) {
            reject(httpError(502, 'Google 的购买结果无法读取', 'PLAY_VERIFY_FAILED'));
            return;
          }
          if (res.statusCode === 404 || res.statusCode === 400) {
            reject(httpError(400, '这笔购买对不上商品', 'PLAY_TOKEN_REJECTED'));
            return;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(httpError(503, 'Google 没有接受购买核对', 'PLAY_VERIFY_UNAVAILABLE'));
            return;
          }
          resolve(parsed);
        });
      }
    );
    req.on('error', () => {
      reject(httpError(503, 'Google 没有接受购买核对', 'PLAY_VERIFY_UNAVAILABLE'));
    });
    req.end();
  });
}

async function accessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const unsigned = `${header}.${claim}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(account.private_key).toString('base64url');
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: `${unsigned}.${signature}`,
  }).toString();
  const json = await postForm('https://oauth2.googleapis.com/token', body);
  if (!json.access_token) {
    throw httpError(503, 'Google 没有接受购买核对', 'PLAY_VERIFY_UNAVAILABLE');
  }
  return json.access_token;
}

/**
 * @returns {'purchased'|'canceled'|'pending'}
 */
async function verifyProduct({ productId, purchaseToken }) {
  const account = loadAccount();
  if (!account) {
    throw httpError(503, '服务器还不能向 Google 核对购买', 'PLAY_VERIFY_UNAVAILABLE');
  }
  const token = await accessToken(account);
  const url =
    'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' +
    `${encodeURIComponent(packageName())}/purchases/products/` +
    `${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const purchase = await getJson(url, token);
  const state = Number(purchase.purchaseState);
  if (state === 0) return 'purchased';
  if (state === 1) return 'canceled';
  return 'pending';
}

module.exports = {
  packageName,
  verifyProduct,
};
