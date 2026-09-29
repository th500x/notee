/**
 * DashScope（通义）OpenAI 兼容 Chat Completions
 * 使用 Node 内置 https，避免生产 Node < 18 无 fetch 导致 502。
 */

const https = require('https');
const { URL } = require('url');

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.LIFE_PATH_AI_TIMEOUT_MS || '90000', 10);

function getDashScopeConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY && String(process.env.DASHSCOPE_API_KEY).trim();
  const model = String(process.env.DASHSCOPE_MODEL || 'qwen-turbo').trim() || 'qwen-turbo';
  const baseUrl = String(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  return { apiKey, model, baseUrl };
}

function isDashScopeConfigured() {
  return !!getDashScopeConfig().apiKey;
}

function postJson(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = JSON.stringify(body);

    const req = https.request(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, raw });
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      const err = new Error('AI 请求超时');
      err.name = 'AbortError';
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

async function chatCompletionJson({ systemPrompt, userPrompt, temperature = 0.3 }) {
  const { apiKey, model, baseUrl } = getDashScopeConfig();
  if (!apiKey) {
    const err = new Error('DashScope API Key 未配置');
    err.code = 'LIFE_PATH_NOT_CONFIGURED';
    throw err;
  }

  try {
    const { status, raw } = await postJson(
      `${baseUrl}/chat/completions`,
      {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      {
        model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      DEFAULT_TIMEOUT_MS
    );

    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (status < 200 || status >= 300) {
      const message =
        data?.error?.message || data?.message || raw?.slice(0, 200) || `DashScope HTTP ${status}`;
      console.error('[dashscope] API error', { status, message: String(message).slice(0, 300) });
      const err = new Error(message);
      const lower = String(message).toLowerCase();
      if (
        lower.includes('inappropriate content') ||
        lower.includes('datainspectionfailed') ||
        lower.includes('content filter')
      ) {
        err.code = 'LIFE_PATH_INPUT_MODERATION';
        err.status = 400;
      } else {
        err.code = 'LIFE_PATH_AI_FAILED';
        err.status = 502;
      }
      throw err;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[dashscope] empty content', { status, raw: raw?.slice(0, 300) });
      const err = new Error('模型未返回内容');
      err.code = 'LIFE_PATH_AI_FAILED';
      err.status = 502;
      throw err;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('[dashscope] invalid JSON content', content.slice(0, 300));
      const err = new Error('模型返回的不是有效 JSON');
      err.code = 'LIFE_PATH_AI_FAILED';
      err.status = 502;
      throw err;
    }

    return { parsed, model };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[dashscope] timeout after ms', DEFAULT_TIMEOUT_MS);
      const timeoutErr = new Error(`AI 请求超时（${Math.round(DEFAULT_TIMEOUT_MS / 1000)} 秒）`);
      timeoutErr.code = 'LIFE_PATH_AI_FAILED';
      timeoutErr.status = 502;
      throw timeoutErr;
    }
    if (err.code) throw err;
    console.error('[dashscope] request failed', err.message);
    const wrapped = new Error(err.message || 'AI 请求失败');
    wrapped.code = 'LIFE_PATH_AI_FAILED';
    wrapped.status = 502;
    throw wrapped;
  }
}

module.exports = {
  getDashScopeConfig,
  isDashScopeConfigured,
  chatCompletionJson,
};
