/**
 * 战役列表组件
 * 
 * @description M2验证模块-3 - 战役列表页面
 */

import { useNavigate } from 'react-router-dom';

const CampaignList = () => {
  const navigate = useNavigate();

  // 战役列表数据（从CSV读取）
  const campaigns = [
    {
      id: 'cam_san_1001_v1',
      name: '长社之战',
      campaignType: 'Raid Battle',
      era: '184',
      difficulty: 1,
      faction: 'san_1_faction_1001;san_1_faction_2001;san_1_faction_3001;san_1_faction_4001;san_1_faction_5001;san_1_faction_6001',
      thumbnail: `${import.meta.env.BASE_URL}assets/campaign/cam_san_1001.png`
    },
    {
      id: 'cam_san_1001_v2',
      name: '长社之战（黄巾视角）',
      campaignType: 'Retreat Battle',
      era: '184',
      difficulty: 1,
      faction: 'san_1_faction_7001',
      thumbnail: `${import.meta.env.BASE_URL}assets/campaign/cam_san_1001.png`
    },
    {
      id: 'cam_san_1002',
      name: '长坂坡之战',
      campaignType: 'Retreat Battle',
      era: '208',
      difficulty: 4,
      faction: 'all',
      thumbnail: null
    },
    {
      id: 'cam_san_1003',
      name: '官渡之战',
      campaignType: 'Field Battle',
      era: '200',
      difficulty: 5,
      faction: 'all',
      thumbnail: null
    }
  ];

  // 战役类型英文转中文
  const campaignTypeMap = {
    'Siege Battle': '攻城战',
    'Field Battle': '平原战',
    'Defensive Battle': '防守战',
    'Retreat Battle': '撤退战',
    'Raid Battle': '突袭战'
  };

  // 点击战役卡片
  const handleCampaignClick = (campaignId) => {
    navigate(`/m2-verification-3/${campaignId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">战役地图展示</h1>
          <p className="text-gray-600">M2验证模块-3 - 选择一个战役查看详情</p>
        </div>

        {/* 战役卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              onClick={() => handleCampaignClick(campaign.id)}
              className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl"
            >
              {/* 缩略图 */}
              <div className="relative h-48 bg-gradient-to-b from-amber-100 to-orange-100">
                {campaign.thumbnail ? (
                  <img
                    src={campaign.thumbnail}
                    alt={campaign.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-6xl">🗺️</span>
                  </div>
                )}
                
                {/* 难度标签 */}
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1">
                  <span className="text-yellow-600 font-bold">
                    {'⭐'.repeat(campaign.difficulty)}
                  </span>
                </div>
              </div>

              {/* 战役信息 */}
              <div className="p-4">
                <h3 className="text-xl font-bold text-gray-900 mb-3">{campaign.name}</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">战役类型</span>
                    <span className="font-medium text-gray-900">
                      {campaignTypeMap[campaign.campaignType] || campaign.campaignType}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">年代</span>
                    <span className="font-medium text-gray-900">{campaign.era}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">难度</span>
                    <span className="font-medium text-yellow-600">
                      {campaign.difficulty}星
                    </span>
                  </div>
                </div>

                {/* 查看详情按钮 */}
                <button className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  查看详情
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 返回按钮 */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            ← 返回主页
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignList;
