/**
 * lifePath AI 提示词
 */

const {
  LIFE_PATH_TOTAL_MAX,
  LIFE_PATH_NODE_MIN,
  LIFE_PATH_NODE_MAX,
  buildLifePathAiEntrySnapshot,
  filterEntriesForLifePathInputMode,
} = require('../../../33-san-storm/shared/utils/lifeResumeLifePath.cjs');

const SYSTEM_PROMPT_RULES = `你是「人生片段」产品的编辑助手。用户会提供 JSON 格式的个人片段列表。
你的任务：仅根据片段中已有信息，归纳出对外可展示的人生轨迹节点。

硬性规则：
1. 不得编造片段中没有出现的事实、人物全名、单位、疾病、犯罪等。
2. visibility 为 private 或 specific 的片段，或 contentOmitted 非空的条目，只用于理解时间线；不得在输出中复述其正文。
3. 不写犯罪、劣迹、违法、仇恨、露骨医疗隐私等内容。
4. 无年份的片段用「早年 / 某阶段 / 时间未详」等谨慎表述，禁止硬编具体年份。
5. 无依据时不写精确年龄（如「25岁」）；优先用年份或人生阶段。
6. 每个节点 category **必须**为英文枚举之一：location|family|work|relationship|study|other（禁止写中文「工作」「学业」等；片段标签「游记/人生」对应 other）。
7. 每个节点 text **必须** ${LIFE_PATH_NODE_MIN}～${LIFE_PATH_NODE_MAX} 个可见字符（中文一字算一字；不足时写完整句，禁止过短）。
8. 所有节点 text 与 summaryText 合计不超过 ${LIFE_PATH_TOTAL_MAX} 个可见字符。
9. 只输出 JSON，格式：{"nodes":[{"sortOrder":1,"timeLabel":"…","category":"work","text":"…"}],"summaryText":"…"}。summaryText 可空字符串。`;

const STYLE_PROMPTS = {
  factual: `

文风要求（平实记述）：
- 用语中性、简洁，像时间轴里程碑；按时间顺序客观概括。
- 避免形容词堆砌、比喻与抒情；只陈述片段中已有事实。`,
  expressive: `

文风要求（生动表述）：
- 在严守事实前提下，可用更有画面感与情感温度的措辞（如「启程」「见证」「告别」「回望」）。
- 可适度点出转折意义或心路，但禁止煽情、鸡汤、虚构情绪或与片段无关的感慨。
- 仍须保持对外可发布的克制表述，不写露骨隐私。`,
};

function getSystemPromptForVariant(styleVariant = 'factual') {
  const style = STYLE_PROMPTS[styleVariant] || STYLE_PROMPTS.factual;
  return `${SYSTEM_PROMPT_RULES}${style}`;
}

function buildUserPrompt({ username, entries, bodyMaxChars, inputMode = 'standard' }) {
  const scopedEntries = filterEntriesForLifePathInputMode(entries, inputMode);
  const payload = {
    profile: { username: username || null, birthMonth: null },
    inputMode,
    entries: scopedEntries.map((entry) =>
      buildLifePathAiEntrySnapshot(entry, { bodyMaxChars, inputMode })
    ),
    constraints: {
      maxTotalChars: LIFE_PATH_TOTAL_MAX,
      nodeTextMin: LIFE_PATH_NODE_MIN,
      nodeTextMax: LIFE_PATH_NODE_MAX,
    },
  };

  return JSON.stringify(payload);
}

module.exports = {
  getSystemPromptForVariant,
  buildUserPrompt,
};
