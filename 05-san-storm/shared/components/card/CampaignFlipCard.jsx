/**
 * 战役卡牌：正面海报 + 三行标题（年代 / 战役名 / 类型中文），背面文案与「开战」（翻牌逻辑与 CharacterCard 一致：perspective + rotateY）
 */
import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

/** @param {string} era 如 `184年4月上旬` → `公元184年` */
export function eraToFrontEraLine(era) {
  if (!era || typeof era !== 'string') return '';
  const m = era.match(/^(\d+)年/);
  if (m) return `公元${m[1]}年`;
  return era;
}

/** CSV `campaign_type` 英文 → 正面第三行文案（与 16 章类型枚举一致） */
const CAMPAIGN_TYPE_ZH = {
  'Attack Battle': '攻击之战',
  'Defense Battle': '防守之战',
  'Field Battle': '野战',
  'Siege Battle': '攻城战',
  'Retreat Battle': '撤退战',
  'Raid Battle': '突袭战',
};

export function campaignTypeToZh(type) {
  if (!type || typeof type !== 'string') return '';
  return CAMPAIGN_TYPE_ZH[type] || type;
}

function CampaignFlipCard({
  posterUrl,
  frontLine1,
  frontLine2,
  /** 覆盖第三行；不传则用 `campaignTypeToZh(campaignType)` */
  frontLine3,
  campaignType,
  completionRewardSilver,
  completionRewardFood,
  /** 通关奖励附加文案，如「徽章 1」 */
  completionRewardBadge,
  description1,
  description2,
  description3,
  onStartBattle,
  className = '',
}) {
  const resolvedFrontLine3 = useMemo(() => {
    if (frontLine3 != null && frontLine3 !== '') return frontLine3;
    return campaignTypeToZh(campaignType);
  }, [frontLine3, campaignType]);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleShellClick = useCallback(() => {
    setIsFlipped((v) => !v);
  }, []);

  return (
    <div
      className={`relative w-[256px] h-[384px] cursor-pointer select-none ${className}`}
      style={{ perspective: '1000px' }}
      onClick={handleShellClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleShellClick();
        }
      }}
      aria-label="战役卡牌，点击翻面"
    >
      <div
        className="relative w-full h-full transition-transform duration-700 ease-in-out"
        style={{
          transformStyle: 'preserve-3d',
          /* translateZ(0)：合成层，减轻半透明遮罩上 3D 翻转的卡顿 */
          transform: isFlipped
            ? 'rotateY(180deg) translateZ(0)'
            : 'rotateY(0deg) translateZ(0)',
        }}
      >
        {/* 正面 */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden border-2 border-amber-700/60 shadow-xl"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: posterUrl ? `url(${posterUrl})` : undefined }}
          />
          {!posterUrl && (
            <div className="absolute inset-0 bg-gradient-to-b from-stone-800 to-stone-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-4 pt-8 text-center space-y-2">
            <p
              className="text-[15px] leading-snug text-amber-100"
              style={{
                fontFamily:
                  'var(--campaign-card-title-font, "PingFang SC", "Microsoft YaHei", sans-serif)',
                letterSpacing: '0.28em',
                textShadow:
                  '0 0 1px rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.85), 0 0 24px rgba(0,0,0,0.45)',
              }}
            >
              {frontLine1}
            </p>
            <p
              className="text-[1.45rem] leading-tight text-amber-50"
              style={{
                fontFamily:
                  'var(--campaign-card-title-font, "PingFang SC", "Microsoft YaHei", sans-serif)',
                letterSpacing: '0.12em',
                textShadow:
                  '0 0 1px rgba(0,0,0,0.95), 0 3px 14px rgba(0,0,0,0.9), 0 0 28px rgba(0,0,0,0.5)',
              }}
            >
              {frontLine2}
            </p>
            {resolvedFrontLine3 ? (
              <p
                className="text-[0.95rem] leading-tight text-amber-200/95 pt-0.5"
                style={{
                  fontFamily:
                    'var(--campaign-card-title-font, "PingFang SC", "Microsoft YaHei", sans-serif)',
                  letterSpacing: '0.18em',
                  textShadow:
                    '0 0 1px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.75)',
                }}
              >
                {resolvedFrontLine3}
              </p>
            ) : null}
          </div>
        </div>

        {/* 背面（全文使用与正面相同的 ZCOOL KuaiLe，见 game/styles index.css） */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden border-2 border-stone-600 bg-stone-900 shadow-xl flex flex-col"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            fontFamily:
              'var(--campaign-card-title-font, "PingFang SC", "Microsoft YaHei", sans-serif)',
          }}
        >
          <div className="flex-1 overflow-y-auto px-2.5 pt-2.5 pb-2 text-stone-300 leading-snug space-y-2.5 min-h-0">
            <p className="text-[16px] text-stone-300">{description1}</p>
            <p className="text-[16px] text-amber-100/95 font-medium">{description2}</p>
            {description3 ? <p className="text-[16px] text-stone-500">{description3}</p> : null}
          </div>
          {/* 通关奖励：固定在底部，顶部分割线与原「奖励上方线」一致；再经下方分割线与「开战」分隔 */}
          <div className="shrink-0 border-t border-stone-700 px-2.5 pt-2 pb-1.5">
            <p className="text-stone-400 text-[16px] leading-snug">
              通关奖励（基准）：银两 {completionRewardSilver} · 粮草 {completionRewardFood}
              {completionRewardBadge ? ` · ${completionRewardBadge}` : ''}
            </p>
          </div>
          {typeof onStartBattle === 'function' ? (
            <div className="px-2.5 py-2 border-t border-stone-700 shrink-0">
              <button
                type="button"
                className="w-full py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartBattle();
                }}
              >
                开战
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

CampaignFlipCard.propTypes = {
  posterUrl: PropTypes.string,
  frontLine1: PropTypes.string.isRequired,
  frontLine2: PropTypes.string.isRequired,
  frontLine3: PropTypes.string,
  campaignType: PropTypes.string.isRequired,
  completionRewardSilver: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  completionRewardFood: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  completionRewardBadge: PropTypes.string,
  description1: PropTypes.string.isRequired,
  description2: PropTypes.string.isRequired,
  description3: PropTypes.string,
  onStartBattle: PropTypes.func,
  className: PropTypes.string,
};

export default CampaignFlipCard;
