/**
 * lifePath AI 提示词
 */

const {
  LIFE_PATH_TOTAL_MAX,
  LIFE_PATH_NODE_MIN,
  LIFE_PATH_NODE_MAX,
  buildLifePathAiEntrySnapshot,
  filterEntriesForLifePathInputMode,
} = require('../../../05-san-storm/shared/utils/lifeResumeLifePath.cjs');

const SYSTEM_PROMPT = `你是「人生片段」产品的编辑助手。用户会提供 JSON 格式的个人片段列表。
你的任务：仅根据片段中已有信息，归纳出对外可展示的人生轨迹节点。

硬性规则：
1. 不得编造片段中没有出现的事实、人物全名、单位、疾病、犯罪等。
2. visibility 为 private 或 specific 的片段，或 contentOmitted 非空的条目，只用于理解时间线；不得在输出中复述其正文。
3. 不写犯罪、劣迹、违法、仇恨、露骨医疗隐私等内容。
4. 无年份的片段用「早年 / 某阶段 / 时间未详」等谨慎表述，禁止硬编具体年份。
5. 无依据时不写精确年龄（如「25岁」）；优先用年份或人生阶段。
6. 每个节点 text **必须** ${LIFE_PATH_NODE_MIN}～${LIFE_PATH_NODE_MAX} 个可见字符（中文一字算一字；不足时写完整句，禁止过短）；category 须为 location|family|work|relationship|study|other。
7. 所有节点 text 与 summaryText 合计不超过 ${LIFE_PATH_TOTAL_MAX} 个可见字符。
8. 只输出 JSON，格式：{"nodes":[{"sortOrder":1,"timeLabel":"…","category":"…","text":"…"}],"summaryText":"…"}。summaryText 可空字符串。`;

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
  SYSTEM_PROMPT,
  buildUserPrompt,
};
