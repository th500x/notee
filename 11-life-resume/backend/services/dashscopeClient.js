/**
 * DashScope（通义）OpenAI 兼容 Chat Completions
 */

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_TIMEOUT_MS = 60000;

function getDashScopeConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY && String(process.env.DASHSCOPE_API_KEY).trim();
  const model = String(process.env.DASHSCOPE_MODEL || 'qwen-turbo').trim() || 'qwen-turbo';
  const baseUrl = String(process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  return { apiKey, model, baseUrl };
}

function isDashScopeConfigured() {
  return !!getDashScopeConfig().apiKey;
}

async function chatCompletionJson({ systemPrompt, userPrompt, temperature = 0.3 }) {
  const { apiKey, model, baseUrl } = getDashScopeConfig();
  if (!apiKey) {
    const err = new Error('DashScope API Key 未配置');
    err.code = 'LIFE_PATH_NOT_CONFIGURED';
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        data?.error?.message || data?.message || `DashScope HTTP ${res.status}`;
      const err = new Error(message);
      err.code = 'LIFE_PATH_AI_FAILED';
      err.status = 502;
      throw err;
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      const err = new Error('模型未返回内容');
      err.code = 'LIFE_PATH_AI_FAILED';
      err.status = 502;
      throw err;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const err = new Error('模型返回的不是有效 JSON');
      err.code = 'LIFE_PATH_AI_FAILED';
      err.status = 502;
      throw err;
    }

    return { parsed, model };
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('AI 请求超时');
      timeoutErr.code = 'LIFE_PATH_AI_FAILED';
      timeoutErr.status = 502;
      throw timeoutErr;
    }
    if (err.code) throw err;
    const wrapped = new Error(err.message || 'AI 请求失败');
    wrapped.code = 'LIFE_PATH_AI_FAILED';
    wrapped.status = 502;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  getDashScopeConfig,
  isDashScopeConfigured,
  chatCompletionJson,
};
