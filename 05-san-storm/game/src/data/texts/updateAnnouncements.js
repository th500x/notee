/**
 * 更新公告文案（与游戏公告 announcements.js 分离）
 *
 * 规则：数组按「当前生效」顺序，取第一条作为展示内容；无条目则整功能不显示。
 * 新内容发版时：在数组**最前**插入一条并赋予新 id，玩家会在下一逻辑日（8 点后）或当日未 dismiss 时看到。
 * **同一条 id 下若修改 title/content**：`updateNoticeLogic` 会用正文指纹判定「文案已变」，用户关闭过一次后仍会在
 * 下次刷新/回到大地图时再弹一次（详见设计文档 §5）。
 *
 * @see docs/30-frontend/32-3-ANNOUNCEMENTS.md（路径相对 `05-san-storm/`）
 */

const updateAnnouncements = [
  {
    id: 'san_1_update_001',
    title: '更新说明',
    content:
      'M2功能模块\n\n'
      + '战役系统（M1M2过渡期）✅\n'
	  + 'M2地图（颖川郡/汝南郡）✅\n'
      + '城市系统✅\n'
	  + '事件重构/官职晋升/俸禄和抽卡（并入中城）✅\n'
	  + '道路遭遇PVP✅\n'
      + '匪寨爬塔✅\n'
	  + '更换势力/赛季继承📊\n'
	  + '战事系统/势力政策系统/军团系统/扩充卡池📊\n\n'
	  
	  + 'M3大饼：实装所有的基础功能，AI全系统📊\n'
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
