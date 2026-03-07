/**
 * S1 地图数据 - 东汉末年（公元184年）
 */

export const S1_MAP = {
  id: 'map_s1_china_184',
  name: '东汉末年',
  historicalYear: 184,
  
  // 地图尺寸
  dimensions: {
    width: 2000,
    height: 1500,
    scale: 1,
    unit: 'px',
  },
  
  // 十三州
  regions: [
    {
      id: 'youzhou',
      name: '幽州',
      color: '#4A90E2',
      position: { x: 800, y: 200 },
      description: '北方边境，多产战马',
      specialties: ['战马', '皮革'],
      climate: '寒冷',
    },
    {
      id: 'jizhou',
      name: '冀州',
      color: '#7ED321',
      position: { x: 750, y: 400 },
      description: '中原腹地，人口众多',
      specialties: ['粮食', '布匹'],
      climate: '温和',
    },
    {
      id: 'qingzhou',
      name: '青州',
      color: '#F5A623',
      position: { x: 900, y: 500 },
      description: '东部沿海，商业发达',
      specialties: ['盐', '鱼'],
      climate: '温和',
    },
    {
      id: 'xuzhou',
      name: '徐州',
      color: '#BD10E0',
      position: { x: 850, y: 650 },
      description: '交通要道，兵家必争',
      specialties: ['铁矿', '木材'],
      climate: '温和',
    },
    {
      id: 'yangzhou',
      name: '扬州',
      color: '#50E3C2',
      position: { x: 950, y: 850 },
      description: '江南富庶之地',
      specialties: ['丝绸', '茶叶'],
      climate: '湿润',
    },
    {
      id: 'jingzhou',
      name: '荆州',
      color: '#B8E986',
      position: { x: 650, y: 900 },
      description: '长江中游，水陆要冲',
      specialties: ['粮食', '木材'],
      climate: '湿润',
    },
    {
      id: 'yizhou',
      name: '益州',
      color: '#F8E71C',
      position: { x: 400, y: 1000 },
      description: '天府之国，易守难攻',
      specialties: ['粮食', '盐'],
      climate: '温和',
    },
    {
      id: 'liangzhou',
      name: '凉州',
      color: '#D0021B',
      position: { x: 300, y: 400 },
      description: '西北边陲，民风彪悍',
      specialties: ['战马', '羊毛'],
      climate: '干燥',
    },
    {
      id: 'bingzhou',
      name: '并州',
      color: '#9013FE',
      position: { x: 600, y: 300 },
      description: '北方重镇，多出名将',
      specialties: ['铁矿', '战马'],
      climate: '寒冷',
    },
    {
      id: 'sizhou',
      name: '司州',
      color: '#4A4A4A',
      position: { x: 550, y: 550 },
      description: '京畿之地，朝廷所在',
      specialties: ['粮食', '布匹'],
      climate: '温和',
    },
    {
      id: 'yuzhou',
      name: '豫州',
      color: '#417505',
      position: { x: 700, y: 650 },
      description: '中原要地，四战之地',
      specialties: ['粮食', '铁矿'],
      climate: '温和',
    },
    {
      id: 'yanzhou',
      name: '兖州',
      color: '#8B572A',
      position: { x: 800, y: 550 },
      description: '中原腹地，人口稠密',
      specialties: ['粮食', '布匹'],
      climate: '温和',
    },
    {
      id: 'jiaozhou',
      name: '交州',
      color: '#FF6B6B',
      position: { x: 700, y: 1200 },
      description: '南方边陲，瘴气弥漫',
      specialties: ['香料', '珍珠'],
      climate: '炎热',
    },
  ],
  
  // 地形类型
  terrains: {
    plain: {
      id: 'plain',
      name: '平原',
      color: '#90EE90',
      moveCost: 1,
      defenseBonus: 0,
      description: '开阔平坦，适合骑兵作战',
    },
    mountain: {
      id: 'mountain',
      name: '山地',
      color: '#8B4513',
      moveCost: 2,
      defenseBonus: 0.3,
      description: '地势险要，易守难攻',
    },
    forest: {
      id: 'forest',
      name: '森林',
      color: '#228B22',
      moveCost: 1.5,
      defenseBonus: 0.2,
      description: '树木茂密，适合伏击',
    },
    water: {
      id: 'water',
      name: '水域',
      color: '#4169E1',
      moveCost: 3,
      defenseBonus: 0,
      description: '江河湖泊，需要水军',
    },
    hill: {
      id: 'hill',
      name: '丘陵',
      color: '#D2B48C',
      moveCost: 1.3,
      defenseBonus: 0.15,
      description: '起伏不平，视野较好',
    },
    city: {
      id: 'city',
      name: '城市',
      color: '#FFD700',
      moveCost: 1,
      defenseBonus: 0.5,
      description: '城池坚固，防御力强',
    },
  },
  
  // 重要地标
  landmarks: [
    {
      id: 'landmark_luoyang',
      name: '洛阳',
      type: 'capital',
      position: { x: 550, y: 550 },
      description: '东汉都城',
    },
    {
      id: 'landmark_changjiang',
      name: '长江',
      type: 'river',
      description: '中国第一大河',
    },
    {
      id: 'landmark_huanghe',
      name: '黄河',
      type: 'river',
      description: '中华母亲河',
    },
    {
      id: 'landmark_taihang',
      name: '太行山',
      type: 'mountain_range',
      description: '北方重要山脉',
    },
  ],
  
  // 气候系统
  climate: {
    seasons: ['春', '夏', '秋', '冬'],
    effects: {
      spring: { foodProduction: 1.2, movementSpeed: 1.0 },
      summer: { foodProduction: 1.5, movementSpeed: 0.9 },
      autumn: { foodProduction: 1.3, movementSpeed: 1.0 },
      winter: { foodProduction: 0.8, movementSpeed: 0.8 },
    },
  },
};

export default S1_MAP;
