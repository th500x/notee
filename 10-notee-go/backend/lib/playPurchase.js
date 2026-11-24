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

const VOIDED_LOOKBACK_MS = 29 * 24 * 60 * 60 * 1000;

/**
 * One page of the voided-purchases list. A row without a purchase token fails the page.
 * @returns {{ purchases: Array<{purchaseToken: string, orderId: string|null, voidedTimeMillis: string|null}>, nextPageToken: string }}
 */
function readVoidedPage(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(502, 'Google 的退款结果无法读取', 'PLAY_VERIFY_FAILED');
  }
  const rows = body.voidedPurchases == null ? [] : body.voidedPurchases;
  if (!Array.isArray(rows)) {
    throw httpError(502, 'Google 的退款结果无法读取', 'PLAY_VERIFY_FAILED');
  }
  const purchases = [];
  for (const row of rows) {
    const token = row && typeof row.purchaseToken === 'string' ? row.purchaseToken.trim() : '';
    if (!token) {
      throw httpError(502, 'Google 的退款结果缺了购买凭证', 'PLAY_VERIFY_FAILED');
    }
    purchases.push({
      purchaseToken: token,
      orderId: row.orderId == null ? null : String(row.orderId),
      voidedTimeMillis: row.voidedTimeMillis == null ? null : String(row.voidedTimeMillis),
    });
  }
  const next = body.tokenPagination && body.tokenPagination.nextPageToken;
  return {
    purchases,
    nextPageToken: typeof next === 'string' ? next.trim() : '',
  };
}

function getPublisherJson(url, bearer) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch (err) {
            parsed = null;
          }
          if (res.statusCode < 200 || res.statusCode >= 300 || !parsed || typeof parsed !== 'object') {
            reject(httpError(
              503,
              `Google 没有接受退款核对 (${res.statusCode})`,
              'PLAY_VERIFY_UNAVAILABLE'
            ));
            return;
          }
          resolve(parsed);
        });
      }
    );
    req.on('error', () => {
      reject(httpError(503, 'Google 没有接受退款核对', 'PLAY_VERIFY_UNAVAILABLE'));
    });
    req.end();
  });
}

/**
 * Voided in-app purchases in the last 29 days. Throws if Play fails or a row has no token.
 * Does not refund anything.
 */
async function listVoidedPurchases() {
  const account = loadAccount();
  if (!account) {
    throw httpError(503, '服务器还不能向 Google 核对购买', 'PLAY_VERIFY_UNAVAILABLE');
  }
  const bearer = await accessToken(account);
  const endTime = Date.now();
  const startTime = endTime - VOIDED_LOOKBACK_MS;
  const all = [];
  let pageToken = '';
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(
      'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' +
      `${encodeURIComponent(packageName())}/purchases/voidedpurchases`
    );
    url.searchParams.set('startTime', String(startTime));
    url.searchParams.set('endTime', String(endTime));
    url.searchParams.set('type', '0');
    url.searchParams.set('maxResults', '1000');
    if (pageToken) url.searchParams.set('token', pageToken);
    const pageResult = readVoidedPage(await getPublisherJson(url, bearer));
    all.push(...pageResult.purchases);
    if (!pageResult.nextPageToken) return all;
    pageToken = pageResult.nextPageToken;
  }
  throw httpError(502, 'Google 的退款结果页数过多', 'PLAY_VERIFY_FAILED');
}

module.exports = {
  packageName,
  verifyProduct,
  readVoidedPage,
  listVoidedPurchases,
};
