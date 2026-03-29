/**
 * 更新公告文案（与游戏公告 announcements.js 分离）
 *
 * 规则：数组按「当前生效」顺序，取第一条作为展示内容；无条目则整功能不显示。
 * 新内容发版时：在数组**最前**插入一条并赋予新 id，玩家会在下一逻辑日（8 点后）或当日未 dismiss 时看到。
 *
 * @see docs/90-assets/92-2-GAME_ANNOUNCEMENTS_DESIGN.md
 */

const updateAnnouncements = [
  {
    id: 'san_1_update_001',
    title: '更新说明',
    content:
      'M1功能模块\n\n'
      + '公告系统✅\n'
	  + '基础事件系统✅\n'
      + '基础编组（将领/部队/称号）✅\n'
	  + '抽卡系统✅\n'
	  + 'PVE攻城✅/PVP攻城📊测试中\n'
      + '装备件封装📊计划中\n'
	  + '基础俸禄系统📊计划中\n'
	  + '战报/传书功能✅/聊天功能📊计划中\n\n'
	  
	  + 'M2大饼：暂时限定可选两个势力，实装区域小地图，开启讨伐系统（大规模PVE）/战事系统（大规模PVP）📊\n'
	  + 'M3大饼：实装所有的基础功能，包括AI系统📊\n'
	  + 'M4大饼：实装大地图/所有战役地图/自动生成全类型随机地图，全功能测试📊\n'
	  + 'M5大饼：实装全部立绘/音乐音效，全数值微调，最终测试📊\n'
	  + '各阶段全部参加者和活跃测试玩家会有特殊奖励👑\n',
  },
];

/**
 * @returns {{ id: string, title: string, content: string } | null}
 */
export function getActiveUpdateNotice() {
  return updateAnnouncements.length > 0 ? updateAnnouncements[0] : null;
}

export default updateAnnouncements;
