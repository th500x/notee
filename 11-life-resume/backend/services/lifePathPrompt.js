/**
 * lifePath AI 提示词
 */

const {
  LIFE_PATH_TOTAL_MAX,
  LIFE_PATH_NODE_MIN,
  LIFE_PATH_NODE_MAX,
  truncateTextForLifePathPrompt,
} = require('../../../05-san-storm/shared/utils/lifeResumeLifePath.cjs');

const SYSTEM_PROMPT = `你是「人生片段」产品的编辑助手。用户会提供 JSON 格式的个人片段列表。
你的任务：仅根据片段中已有信息，归纳出对外可展示的人生轨迹节点。

硬性规则：
1. 不得编造片段中没有出现的事实、人物全名、单位、疾病、犯罪等。
2. visibility 为 private 或 specific 的片段，只用于理解脉络；不得在输出中复述其 identifiable 细节。
3. 不写犯罪、劣迹、违法、仇恨、露骨医疗隐私等内容。
4. 无年份的片段用「早年 / 某阶段 / 时间未详」等谨慎表述，禁止硬编具体年份。
5. 无依据时不写精确年龄（如「25岁」）；优先用年份或人生阶段。
6. 每个节点 text **必须** ${LIFE_PATH_NODE_MIN}～${LIFE_PATH_NODE_MAX} 个可见字符（不足 ${LIFE_PATH_NODE_MIN} 字时写更完整的概括句，禁止过短）；category 须为 location|family|work|relationship|study|other。
7. 所有节点 text 与 summaryText 合计不超过 ${LIFE_PATH_TOTAL_MAX} 个可见字符。
8. 只输出 JSON，格式：{"nodes":[{"sortOrder":1,"timeLabel":"…","category":"…","text":"…"}],"summaryText":"…"}。summaryText 可空字符串。`;

function buildUserPrompt({ username, entries, bodyMaxChars }) {
  const payload = {
    profile: { username: username || null, birthMonth: null },
    entries: entries.map((entry) => ({
      entryId: entry.id,
      publishStatus: entry.status,
      visibility: entry.visibility,
      year: entry.year,
      month: entry.month,
      day: entry.day,
      lifeStage: entry.lifeStage,
      tags: entry.tags || [],
      locationPublicLabel: entry.locationPublicLabel || null,
      title: entry.title || null,
      body: truncateTextForLifePathPrompt(entry.body, bodyMaxChars),
    })),
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
