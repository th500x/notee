/**
 * 探险归来 · 模板剧情（事实卡填槽，≤500 字；无外网依赖）
 * @module backend/services/adventureStoryTemplate
 */

const TONE_OPEN = {
  patrol: '斥候轻装出城，沿官道与田间小径巡视，细查烽火与行人异动。',
  escort: '商队铃铎叮当，士卒夹道护行，目标是把货物平安送到下一处驿站。',
  forage: '军吏携簿册下乡，沿途征募余粮，乡民观望，气氛紧张而克制。',
  raid: '夜色低垂，将士衔枚疾进，目标是远处那处流寇营火。',
};

/**
 * @param {object} fact
 * @param {string} fact.themeName
 * @param {string} fact.tone
 * @param {boolean} fact.encounter
 * @param {boolean|null} fact.won
 * @param {string|null} fact.enemyLabel
 * @param {number} fact.silver
 * @param {number} fact.food
 * @param {string} [fact.extraSlotLabel]
 * @param {number} [fact.rounds]
 */
function buildAdventureStoryFromFact(fact) {
  const tone = String(fact.tone || 'patrol');
  const open = TONE_OPEN[tone] || TONE_OPEN.patrol;
  const themeName = String(fact.themeName || '探险');
  const slot = fact.extraSlotLabel ? `（编组${fact.extraSlotLabel}）` : '';
  const parts = [];

  parts.push(`【${themeName}】${slot}${open}`);

  if (!fact.encounter) {
    parts.push(
      '一路未见成规模敌踪，偶遇流民与商贩，皆称近日稍安。队伍按预定路线折返，未动干戈。',
    );
  } else {
    const enemy = fact.enemyLabel || '不明流寇';
    parts.push(`行至半途，与「${enemy}」狭路相逢，刀兵相接，杀声骤起。`);
    if (fact.won === true) {
      const r = Number(fact.rounds);
      const roundHint = Number.isFinite(r) && r > 0 ? `交锋约 ${r} 合，` : '';
      parts.push(`${roundHint}我军气势占优，敌众溃散四逃，道路复通。`);
    } else if (fact.won === false) {
      parts.push(
        '敌势凶猛，我军且战且退，幸得殿后有序，未至全军覆没，只得收束残伍回城复命。',
      );
    } else {
      parts.push('战局未明，双方各自收兵，尘烟散后道路重归寂静。');
    }
  }

  const silver = Math.max(0, Math.floor(Number(fact.silver) || 0));
  const food = Math.max(0, Math.floor(Number(fact.food) || 0));
  if (silver > 0 || food > 0) {
    const loot = [];
    if (silver > 0) loot.push(`银两 ${silver}`);
    if (food > 0) loot.push(`粮草 ${food}`);
    parts.push(`归来盘点所得：${loot.join('、')}。士卒稍歇，此事可告一段落。`);
  } else {
    parts.push('此行所得甚微，唯历练与见闻可记一笔。');
  }

  let text = parts.join('');
  if (text.length > 500) {
    text = `${text.slice(0, 497)}…`;
  }
  return text;
}

module.exports = {
  buildAdventureStoryFromFact,
};
