/**
 * 将结构化bonus数据转换为中文展示文本
 * 基于 04-2-DATA_TERM_DICTIONARY.md 加成项术语
 * @param {Object} bonus - { key: string, value?: number }
 * @returns {string} 中文展示文本
 */
import {
  readFactionBalanceBonusSilver,
  formatFactionBalanceBonusPreview,
} from '@shared/utils/factionBalanceBonus.js';

const BONUS_CN_MAP = {
  politics_bonus: (v) => `势力内政值${v > 0 ? '+' : ''}${v}%`,
  charm_bonus: (v) => `势力魅力值${v > 0 ? '+' : ''}${v}%`,
  max_troops_bonus: (v) => `部队卡兵力+${v}`,
  speed_bonus: (v) => `部队卡移速+${v}`,
  movement_bonus: (v) => `部队卡移速+${v}`,
  epic_legendary_attack_bonus: (v) => `紫/橙部队卡攻击+${v}`,
  epic_legendary_defense_bonus: (v) => `紫/橙部队卡防御+${v}`,
  common_rare_attack_bonus: (v) => `白/蓝部队卡攻击+${v}`,
  siege_attack_bonus: (v) => `攻城攻击力+${v}%`,
  siege_defense_bonus: (v) => `守城防御力+${v}%`,
  backpack_capacity_bonus: (v) => `背包部队卡上限+${v}`,
  daily_event_count_bonus: (v) => `随机日常事件数+${v}`,
  contribution_bonus: (v) => `贡献加成+${v}%`,
  salary_resource_bonus: (v) => `势力俸禄(资源)+${v}%`,
  salary_troop_card_bonus: (v) => `势力俸禄(部队卡)+${v}`,
  npc_sage_guaranteed_buff: () => '仙人AI固定施展增益效果',
  lord_random_battle: () => '君主随机参战',
};

/** 与 config / factions.json 中 faction_bonuses[].key 对齐（常带 faction_ / troop_ 前缀） */
const BONUS_KEY_ALIASES = {
  faction_politics_bonus: 'politics_bonus',
  faction_charm_bonus: 'charm_bonus',
  troop_max_troops_bonus: 'max_troops_bonus',
  troop_epic_legendary_attack_bonus: 'epic_legendary_attack_bonus',
  troop_epic_legendary_defense_bonus: 'epic_legendary_defense_bonus',
  troop_speed_bonus: 'speed_bonus',
  troop_common_rare_attack_bonus: 'common_rare_attack_bonus',
  faction_salary_resource_bonus: 'salary_resource_bonus',
  faction_salary_troop_card_bonus: 'salary_troop_card_bonus',
};

function formatBonus(bonus) {
  const canonical = BONUS_KEY_ALIASES[bonus.key] ?? bonus.key;
  const formatter = BONUS_CN_MAP[canonical];
  if (formatter) return formatter(bonus.value);
  return bonus.key; // fallback: 直接显示 key
}

/**
 * 解析势力加成数据，从结构化JSON生成中文展示
 * 数据来源：faction_bonuses [{ key, value }]
 * 术语表：docs/00/00-base/04-2-DATA_TERM_DICTIONARY.md §1
 */
function parseBonuses(faction) {
  let raw = faction.faction_bonuses;
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(raw)) return [];
  return raw.map(formatBonus);
}

/**
 * 难度配置映射
 */
const difficultyConfig = {
  '简单': {
    gradient: 'from-green-400 to-green-600',
    border: 'border-green-500',
    glow: 'shadow-green-500/50',
    icon: '✓'
  },
  '中级': {
    gradient: 'from-yellow-400 to-yellow-600',
    border: 'border-yellow-500',
    glow: 'shadow-yellow-500/50',
    icon: '⚡'
  },
  '困难': {
    gradient: 'from-red-400 to-red-600',
    border: 'border-red-500',
    glow: 'shadow-red-500/50',
    icon: '⚔️'
  },
  '极难': {
    gradient: 'from-purple-400 to-purple-600',
    border: 'border-purple-500',
    glow: 'shadow-purple-500/50',
    icon: '💀'
  }
};

/**
 * 势力卡牌组件
 * 
 * @param {Object} props - 组件属性
 * @param {Object} props.faction - 势力数据（支持JSON格式和API格式）
 * @param {string} [props.leaderName] - 君主名称（已解析）
 * @param {boolean} [props.selected] - 是否被选中
 * @param {boolean} [props.disabled] - 是否禁用（如已满员）
 * @param {Function} [props.onClick] - 点击回调
 */
function FactionCard({ faction, leaderName, selected = false, disabled = false, onClick }) {
  // 兼容两种数据格式：JSON(camelCase) 和 API(snake_case)
  const name = faction.name || faction.faction_name;
  const maxPlayers = faction.maxPlayers || faction.max_players;
  const style = faction.style || faction.style_text;
  const currentPlayers = faction.currentPlayers ?? faction.current_players;
  const isFull = faction.isFull ?? faction.is_full;
  // recommended 从 difficulty 推导：简单 = 推荐
  const recommended = faction.recommended ?? (faction.difficulty === '简单');
  const balanceBonusSilver = readFactionBalanceBonusSilver(faction);
  const balanceBonusLabel = formatFactionBalanceBonusPreview(balanceBonusSilver);

  // 使用 parseBonuses 统一处理所有格式
  const bonuses = parseBonuses(faction);

  const config = difficultyConfig[faction.difficulty] || difficultyConfig['中级'];
  const displayLeaderName = leaderName || faction.leader;

  return (
    <div 
      className={`relative w-[256px] min-h-[384px] group hover:z-10 ${onClick ? 'cursor-pointer' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && onClick && onClick(faction)}
    >
      {/* 选中指示器 */}
      {selected && (
        <div className="absolute -inset-1 rounded-xl bg-blue-500/40 animate-pulse z-0" />
      )}
      {/* 卡牌容器 */}
      <div className={`
        relative w-full min-h-full
        bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
        rounded-xl overflow-hidden
        border-2 ${selected ? 'border-blue-400' : config.border}
        shadow-xl ${selected ? 'shadow-blue-500/50' : config.glow}
        transition-all duration-300
        hover:scale-105 hover:shadow-2xl
      `}>
        
        {/* 顶部：势力名称 */}
        <div className={`
          relative h-[40px] px-3 py-2
          bg-gradient-to-r ${config.gradient}
          flex items-center justify-between
        `}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{faction.icon}</span>
            <h3 className="text-white font-bold text-base truncate">
              {name}
            </h3>
          </div>
          {recommended && (
            <div className="px-2 py-0.5 rounded bg-black/30 backdrop-blur-sm text-xs font-medium text-white">
              推荐
            </div>
          )}
        </div>

        {/* 中间：势力图标区域 */}
        <div className="relative h-[120px] bg-gradient-to-b from-gray-800 to-gray-900">
          {/* 背景装饰 */}
          <div className="absolute inset-0 opacity-10">
            <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient}`} />
          </div>

          <div className="relative h-full flex items-center p-3 gap-3">
            {/* 左侧：势力图标 */}
            <div className="relative w-[100px] h-[100px] flex-shrink-0">
              <div className={`
                absolute inset-0 rounded-lg
                border-2 ${config.border}
                bg-gray-900/50 backdrop-blur-sm
                flex items-center justify-center
                overflow-hidden
              `}>
                <div className="text-6xl">
                  {faction.icon}
                </div>
              </div>

              {/* 难度标识 */}
              <div className={`
                absolute -top-1 -right-1
                w-8 h-8 rounded-full
                bg-gradient-to-br ${config.gradient}
                border-2 ${config.border}
                flex items-center justify-center
                text-xs font-bold text-white
                shadow-lg
              `}>
                {config.icon}
              </div>
            </div>

            {/* 右侧：势力信息 */}
            <div className="flex-1 flex flex-col justify-center gap-2">
              {/* 君主 */}
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-xl">👑</span>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px]">君主</span>
                  <span className="text-white font-bold text-sm truncate">
                    {displayLeaderName}
                  </span>
                </div>
              </div>

              {/* 人数上限 */}
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-xl">👥</span>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px]">
                    {currentPlayers != null ? '玩家数' : '人数上限'}
                  </span>
                  <span className="text-white font-bold text-sm">
                    {currentPlayers != null ? `${currentPlayers}/${maxPlayers}` : maxPlayers}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 势力描述 */}
        {faction.description && (
          <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
            <p className="text-gray-300 text-xs leading-relaxed">
              {faction.description}
            </p>
          </div>
        )}

        {/* 风格和类型 */}
        <div className="relative px-3 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <span className="text-purple-400">🎨</span>
              <span className="text-gray-400">风格</span>
            </div>
            <span className="text-white font-medium">
              {style}
            </span>
          </div>
        </div>

        {/* 势力加成区域 */}
        {bonuses && bonuses.length > 0 && (
          <div className="relative px-3 py-2 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-green-400 text-xs">💪</span>
              <span className="text-gray-400 text-xs font-medium">势力加成</span>
            </div>
            <div className="space-y-1">
              {/* 第一行：前两个加成 */}
              <div className="flex items-center text-xs bg-gray-800/50 rounded px-2 py-1 min-h-[24px]">
                {bonuses.length > 0 ? (
                  <div className="flex items-center gap-2 overflow-hidden">
                    {bonuses.slice(0, 2).map((bonus, index) => (
                      <div key={index} className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-green-400">✓</span>
                        <span className="text-gray-300 whitespace-nowrap text-[11px]">{bonus}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-600 text-[10px]">无加成</span>
                )}
              </div>
              
              {/* 第二行：第三个加成 */}
              {bonuses.length > 2 && (
                <div className="flex items-center text-xs bg-gray-800/50 rounded px-2 py-1 min-h-[24px]">
                  <div className="flex items-center gap-1">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-300 text-[11px]">{bonuses[2]}</span>
                  </div>
                </div>
              )}
              
              {/* 第三行：第四个加成或显示更多 */}
              {bonuses.length > 3 && (
                <div className="flex items-center text-xs bg-gray-800/50 rounded px-2 py-1 min-h-[24px]">
                  <div className="flex items-center gap-1">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-300 text-[11px]">{bonuses[3]}</span>
                    {bonuses.length > 4 && (
                      <span className="text-gray-500 text-[10px] ml-2">
                        +{bonuses.length - 4} 更多
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 人数平衡补偿预览（创角完成时服务端结算） */}
        {balanceBonusLabel ? (
          <div className="relative px-3 py-2 bg-amber-950/40 backdrop-blur-sm border-t border-amber-700/40">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-amber-300 shrink-0">💰</span>
                <span className="text-amber-100 font-semibold truncate">{balanceBonusLabel}</span>
              </div>
              <span className="text-amber-200/70 text-[10px] shrink-0">创角时发放</span>
            </div>
          </div>
        ) : null}

        {/* 难度信息 */}
        <div className="relative px-3 py-2 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <span className="text-orange-400">⚔️</span>
              <span className="text-gray-400">难度</span>
            </div>
            <span className="text-white font-medium">
              {faction.difficulty}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FactionCard;
