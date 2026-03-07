/**
 * 战役展示组件
 * 
 * @description M2验证模块-3 - 战役地图介绍和显示
 */

import { useParams, useNavigate } from 'react-router-dom';

const CampaignDisplay = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();

  // 所有战役数据（从CSV读取）
  const allCampaigns = {
    'cam_san_1001_v1': {
      id: 'cam_san_1001_v1',
      name: '长社之战',
      campaignType: 'Raid Battle',
      era: '184',
      description_1: `《三国志》记，黄巾起义，颍川波才约6万步卒，4万流民围困长社城。皇甫嵩、朱儁野战失利，率余部约2万退守城中。波才轻敌依草结营，皇甫嵩趁夜火攻，恰逢曹操初拜骑都尉，统兵5千驰援，联军大破黄巾军，平定颍川。`,
      description_2: `真三"长社之战"，兵力比例还原史实
战役目标：协助皇甫嵩，击败黄巾军
胜利条件：消灭所有敌军
失败条件：我方全军覆没/超过20回合`,
      difficulty: 1,
      mapSize: 'large',
      terrain: 'plain',
      mapImage: `${import.meta.env.BASE_URL}assets/campaign/cam_san_1001.png`
    },
    'cam_san_1001_v2': {
      id: 'cam_san_1001_v2',
      name: '长社之战（黄巾视角）',
      campaignType: 'Retreat Battle',
      era: '184',
      description_1: `《三国志》记，黄巾起义，颍川波才约6万步卒，4万流民围困长社城。皇甫嵩、朱儁野战失利，率余部约2万退守城中。波才轻敌依草结营，皇甫嵩趁夜火攻，恰逢曹操初拜骑都尉，统兵5千驰援，联军大破黄巾军，平定颍川。`,
      description_2: `真三"长社之战"，兵力比例还原史实
战役目标：协助皇甫嵩，击败黄巾军
胜利条件：消灭敌方3支部队/坚守5回合
失败条件：我方全军覆没`,
      difficulty: 1,
      mapSize: 'large',
      terrain: 'plain',
      mapImage: `${import.meta.env.BASE_URL}assets/campaign/cam_san_1001.png`
    },
    'cam_san_1002': {
      id: 'cam_san_1002',
      name: '长坂坡之战',
      campaignType: 'Retreat Battle',
      era: '208',
      description_1: `曹军追击，刘备军需要护送百姓安全撤退`,
      description_2: ``,
      difficulty: 4,
      mapSize: 'large',
      terrain: 'hill',
      mapImage: null
    },
    'cam_san_1003': {
      id: 'cam_san_1003',
      name: '官渡之战',
      campaignType: 'Field Battle',
      era: '200',
      description_1: `袁绍与曹操的决战，消灭敌军主力即可获胜`,
      description_2: ``,
      difficulty: 5,
      mapSize: 'large',
      terrain: 'plain',
      mapImage: null
    }
  };

  // 获取当前战役数据
  const campaignData = allCampaigns[campaignId];

  // 如果战役不存在，显示错误页面
  if (!campaignData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-8">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">战役不存在</h2>
          <p className="text-gray-600 mb-6">未找到战役 ID: {campaignId}</p>
          <button
            onClick={() => navigate('/m2-verification-3')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ← 返回战役列表
          </button>
        </div>
      </div>
    );
  }

  // 合并两段描述
  const fullDescription = campaignData.description_2 
    ? `${campaignData.description_1}\n\n${campaignData.description_2}`
    : campaignData.description_1;

  // 战役类型英文转中文
  const campaignTypeMap = {
    'Siege Battle': '攻城战',
    'Field Battle': '平原战',
    'Defensive Battle': '防守战',
    'Retreat Battle': '撤退战',
    'Raid Battle': '突袭战'
  };

  // 地形类型英文转中文
  const terrainMap = {
    'plain': '平原',
    'hill': '丘陵',
    'mountain': '山地',
    'forest': '森林',
    'water': '水域'
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* 战役展示区域 - 背景图 + 战役地图叠加 */}
        <div className="relative w-full max-w-lg mx-auto mb-6 rounded-lg overflow-hidden shadow-2xl">
          {/* 背景图 (768×1344) */}
          <img 
            src={`${import.meta.env.BASE_URL}assets/campaign/campaign_bg.png`}
            alt="战役背景"
            className="w-full h-auto block"
          />
          
          {/* 顶部信息卡片 - 放在图片内部，一行显示4个 */}
          <div className="absolute top-4 left-4 right-4 grid grid-cols-4 gap-2">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3">
              <div className="text-xs text-gray-600 mb-1">战役类型</div>
              <div className="text-sm font-bold text-gray-900">
                {campaignTypeMap[campaignData.campaignType] || campaignData.campaignType}
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3">
              <div className="text-xs text-gray-600 mb-1">年代</div>
              <div className="text-sm font-bold text-gray-900">
                {campaignData.era}
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3">
              <div className="text-xs text-gray-600 mb-1">难度</div>
              <div className="text-sm font-bold text-yellow-600">
                {'⭐'.repeat(campaignData.difficulty)}
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3">
              <div className="text-xs text-gray-600 mb-1">地形</div>
              <div className="text-sm font-bold text-gray-900">
                {terrainMap[campaignData.terrain] || campaignData.terrain}
              </div>
            </div>
          </div>

          {/* 文字覆盖在背景图上方区域 (上方576px) - 在信息卡片下方 */}
          <div className="absolute left-0 right-0 p-6" style={{ top: '100px', height: 'calc(42.86% - 100px)' }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {campaignData.name}
            </h2>
            <div className="text-gray-900 text-sm leading-relaxed whitespace-pre-line">
              {fullDescription}
            </div>
          </div>

          {/* 战役地图 (768×768) 叠加在背景图下方区域 */}
          <div className="absolute bottom-0 left-0 right-0" style={{ height: '57.14%' }}>
            {campaignData.mapImage ? (
              <img 
                src={campaignData.mapImage} 
                alt={`${campaignData.name}地图`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-amber-100 to-orange-100 flex items-center justify-center">
                <span className="text-gray-400 text-6xl">🗺️</span>
              </div>
            )}
          </div>
        </div>

        {/* 返回按钮 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/m2-verification-3')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ← 返回战役列表
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignDisplay;
