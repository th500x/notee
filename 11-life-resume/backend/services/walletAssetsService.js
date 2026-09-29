/**
 * 代查公开行情：钱包币值（Uniswap Portfolio）+ 头寸（Liquidity GetWalletPositions）。
 * 浏览器直连会被对方按来源拦住，所以只在这台后端上请求。
 */

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const GQL_URL = 'https://interface.gateway.uniswap.org/v1/graphql';
const LP_BALANCE_URL =
  'https://entry-gateway.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetWalletPositionsBalance';
const LP_LIST_URL =
  'https://entry-gateway.backend-prod.api.uniswap.org/uniswap.liquidity.v2.LiquidityService/GetWalletPositions';

const GQL_CHAINS = ['ETHEREUM', 'ARBITRUM', 'OPTIMISM', 'POLYGON', 'BASE', 'BNB'];
const LP_CHAINS = ['MAINNET', 'ARBITRUM', 'OPTIMISM', 'POLYGON', 'BASE', 'BNB'];
const CACHE_MS = 45 * 1000;
const LIST_LIMIT = 50;

const cache = new Map();

class WalletAssetsError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
    this.code = 'WALLET_ASSETS_FAILED';
  }
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function estimatePositionUsd(position) {
  if (
    position.sqrtPriceX96 == null ||
    position.tickLower == null ||
    position.tickUpper == null ||
    position.currentTick == null
  ) {
    return null;
  }
  const liquidity = Number(position.liquidity);
  const sqrtP = Number(position.sqrtPriceX96) / 2 ** 96;
  const sqrtA = Math.sqrt(1.0001 ** Number(position.tickLower));
  const sqrtB = Math.sqrt(1.0001 ** Number(position.tickUpper));
  if (!(liquidity > 0) || !(sqrtP > 0) || !(sqrtA > 0) || !(sqrtB > sqrtA)) return null;

  const tick = Number(position.currentTick);
  let amount0 = 0;
  let amount1 = 0;
  if (tick < Number(position.tickLower)) {
    amount0 = (liquidity * (sqrtB - sqrtA)) / (sqrtA * sqrtB);
  } else if (tick >= Number(position.tickUpper)) {
    amount1 = liquidity * (sqrtB - sqrtA);
  } else {
    amount0 = (liquidity * (sqrtB - sqrtP)) / (sqrtP * sqrtB);
    amount1 = liquidity * (sqrtP - sqrtA);
  }

  const decimals0 = Number(position.token0Metadata?.decimals ?? 18);
  const decimals1 = Number(position.token1Metadata?.decimals ?? 18);
  const usd =
    (amount0 / 10 ** decimals0) * Number(position.token0PriceUsd) +
    (amount1 / 10 ** decimals1) * Number(position.token1PriceUsd);
  return Number.isFinite(usd) ? usd : null;
}

async function postJson(url, body) {
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'connect-protocol-version': '1',
        origin: 'https://app.uniswap.org',
        referer: 'https://app.uniswap.org/',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    throw new WalletAssetsError('行情服务暂时连不上');
  }
  const text = await resp.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!resp.ok || !json) {
    throw new WalletAssetsError('行情服务没有返回可用数据');
  }
  return json;
}

async function fetchWalletTokens(address) {
  const query = `{
    portfolios(ownerAddresses: ["${address}"], chains: [${GQL_CHAINS.join(', ')}]) {
      tokenBalances {
        denominatedValue { value }
        token { symbol chain }
      }
    }
  }`;
  const json = await postJson(GQL_URL, { query });
  if (json.errors?.length && !json.data?.portfolios) {
    throw new WalletAssetsError('钱包币值暂时取不到');
  }
  const tokens = [];
  let walletUsd = 0;
  for (const portfolio of json.data?.portfolios || []) {
    for (const balance of portfolio.tokenBalances || []) {
      const usd = Number(balance.denominatedValue?.value);
      if (!Number.isFinite(usd) || usd <= 0) continue;
      walletUsd += usd;
      tokens.push({
        symbol: balance.token?.symbol || '?',
        chain: balance.token?.chain || '',
        usd: round2(usd),
      });
    }
  }
  tokens.sort((a, b) => b.usd - a.usd);
  return { walletUsd, tokens };
}

async function fetchPositions(address) {
  const body = {
    walletAddress: address,
    chainIds: LP_CHAINS,
    versions: ['POOL_PROTOCOL_V2', 'POOL_PROTOCOL_V3', 'POOL_PROTOCOL_V4'],
    statuses: ['POSITION_STATUS_OPEN'],
    limit: LIST_LIMIT,
  };
  const [balance, listed] = await Promise.all([
    postJson(LP_BALANCE_URL, body),
    postJson(LP_LIST_URL, body),
  ]);
  const positionUsd = Number(balance.totalLiquidityUsd);
  const feesUsd = Number(balance.totalFeesUsd);
  const rewardsUsd = Number(balance.totalRewardsUsd);
  if (!Number.isFinite(positionUsd)) {
    throw new WalletAssetsError('头寸金额暂时取不到');
  }
  const positions = (listed.positions || []).map((position) => {
    const tick = Number(position.currentTick);
    const lower = Number(position.tickLower);
    const upper = Number(position.tickUpper);
    const inRange = Number.isFinite(tick) && Number.isFinite(lower) && Number.isFinite(upper)
      ? tick >= lower && tick < upper
      : null;
    return {
      version: position.version || '',
      chainId: position.chainId ?? null,
      token0: position.token0Metadata?.symbol || '?',
      token1: position.token1Metadata?.symbol || '?',
      inRange,
      usd: (() => {
        const estimated = estimatePositionUsd(position);
        return estimated == null ? null : round2(estimated);
      })(),
      feesUsd: round2(Number(position.uncollectedFeesUsd) || 0),
    };
  });
  positions.sort((a, b) => (b.usd || 0) - (a.usd || 0));
  return {
    positionUsd,
    feesUsd: Number.isFinite(feesUsd) ? feesUsd : 0,
    rewardsUsd: Number.isFinite(rewardsUsd) ? rewardsUsd : 0,
    openCount: Number(balance.openPositionsCount) || positions.length,
    positions,
    listTruncated: (listed.positions || []).length >= LIST_LIMIT,
  };
}

function normalizeWalletAddress(address) {
  const normalized = String(address || '').trim();
  if (!ADDRESS_RE.test(normalized)) {
    throw new WalletAssetsError('请填写完整的以太坊地址（0x 开头、共 42 位）', 400);
  }
  return normalized.toLowerCase();
}

async function loadWalletAssets(address) {
  const key = normalizeWalletAddress(address);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.payload;

  const [wallet, lp] = await Promise.all([fetchWalletTokens(key), fetchPositions(key)]);
  const payload = {
    address: key,
    walletUsd: round2(wallet.walletUsd),
    positionUsd: round2(lp.positionUsd),
    feesUsd: round2(lp.feesUsd),
    rewardsUsd: round2(lp.rewardsUsd),
    totalUsd: round2(wallet.walletUsd + lp.positionUsd + lp.feesUsd + lp.rewardsUsd),
    tokens: wallet.tokens.filter((item) => item.usd >= 1),
    positions: lp.positions,
    openCount: lp.openCount,
    listTruncated: lp.listTruncated,
    fetchedAt: new Date().toISOString(),
  };
  cache.set(key, { at: Date.now(), payload });
  return payload;
}

module.exports = {
  WalletAssetsError,
  normalizeWalletAddress,
  estimatePositionUsd,
  loadWalletAssets,
};
