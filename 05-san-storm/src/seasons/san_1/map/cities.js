/**
 * S1 城市数据 - 东汉末年主要城市
 * 
 * 注：这里只列出部分重要城市作为示例
 * 完整版应包含89个城市
 */

export const SAN_1_CITIES = [
  // === 幽州 ===
  {
    id: 'city_youzhou_0002',
    name: '涿郡',
    region: 'youzhou',
    position: { x: 800, y: 300 },
    level: 3,
    population: 50000,
    garrison: 5000,
    specialties: ['马匹', '粮食'],
    buildings: ['市场', '兵营', '农田'],
    historicalEvents: ['桃园结义'],
    initialOwner: 'han',
    description: '刘备故乡，桃园结义之地',
  },
  {
    id: 'city_youzhou_0001',
    name: '蓟县',
    region: 'youzhou',
    position: { x: 850, y: 250 },
    level: 4,
    population: 80000,
    garrison: 8000,
    specialties: ['铁矿', '木材'],
    buildings: ['市场', '兵营', '铁匠铺', '城墙'],
    historicalEvents: [],
    initialOwner: 'han',
    description: '幽州治所，北方重镇',
  },
  
  // === 冀州 ===
  {
    id: 'city_jizhou_0001',
    name: '邺城',
    region: 'jizhou',
    position: { x: 750, y: 450 },
    level: 5,
    population: 120000,
    garrison: 15000,
    specialties: ['粮食', '布匹'],
    buildings: ['市场', '兵营', '农田', '城墙', '府衙'],
    historicalEvents: ['袁绍崛起'],
    initialOwner: 'han',
    description: '冀州治所，袁绍根据地',
  },
  
  // === 青州 ===
  {
    id: 'city_qingzhou_0001',
    name: '临淄',
    region: 'qingzhou',
    position: { x: 900, y: 500 },
    level: 4,
    population: 90000,
    garrison: 10000,
    specialties: ['盐', '鱼'],
    buildings: ['市场', '兵营', '盐场', '港口'],
    historicalEvents: ['黄巾起义'],
    initialOwner: 'yellow_turban',
    description: '青州治所，黄巾军活跃地区',
  },
  
  // === 徐州 ===
  {
    id: 'city_xuzhou_0001',
    name: '下邳',
    region: 'xuzhou',
    position: { x: 850, y: 650 },
    level: 4,
    population: 85000,
    garrison: 9000,
    specialties: ['铁矿', '木材'],
    buildings: ['市场', '兵营', '铁匠铺', '城墙'],
    historicalEvents: [],
    initialOwner: 'han',
    description: '徐州重镇，交通要道',
  },
  
  // === 扬州 ===
  {
    id: 'city_yangzhou_0001',
    name: '建业',
    region: 'yangzhou',
    position: { x: 950, y: 850 },
    level: 4,
    population: 100000,
    garrison: 12000,
    specialties: ['丝绸', '茶叶'],
    buildings: ['市场', '兵营', '港口', '城墙'],
    historicalEvents: ['孙氏崛起'],
    initialOwner: 'han',
    description: '江东重镇，孙氏根据地',
  },
  
  // === 荆州 ===
  {
    id: 'city_jingzhou_0001',
    name: '襄阳',
    region: 'jingzhou',
    position: { x: 650, y: 900 },
    level: 5,
    population: 110000,
    garrison: 13000,
    specialties: ['粮食', '木材'],
    buildings: ['市场', '兵营', '农田', '城墙', '府衙'],
    historicalEvents: [],
    initialOwner: 'han',
    description: '荆州治所，水陆要冲',
  },
  
  // === 益州 ===
  {
    id: 'city_yizhou_0001',
    name: '成都',
    region: 'yizhou',
    position: { x: 400, y: 1000 },
    level: 5,
    population: 130000,
    garrison: 14000,
    specialties: ['粮食', '盐'],
    buildings: ['市场', '兵营', '农田', '城墙', '府衙'],
    historicalEvents: [],
    initialOwner: 'han',
    description: '益州治所，天府之国',
  },
  
  // === 凉州 ===
  {
    id: 'city_liangzhou_0001',
    name: '武威',
    region: 'liangzhou',
    position: { x: 300, y: 400 },
    level: 3,
    population: 60000,
    garrison: 8000,
    specialties: ['战马', '羊毛'],
    buildings: ['市场', '兵营', '马场'],
    historicalEvents: [],
    initialOwner: 'han',
    description: '凉州重镇，西北门户',
  },
  
  // === 并州 ===
  {
    id: 'city_bingzhou_0001',
    name: '晋阳',
    region: 'bingzhou',
    position: { x: 600, y: 300 },
    level: 4,
    population: 75000,
    garrison: 10000,
    specialties: ['铁矿', '战马'],
    buildings: ['市场', '兵营', '铁匠铺', '马场'],
    historicalEvents: [],
    initialOwner: 'han',
    description: '并州治所，北方要塞',
  },
  
  // === 司州 ===
  {
    id: 'city_sizhou_0001',
    name: '洛阳',
    region: 'sizhou',
    position: { x: 550, y: 550 },
    level: 6,
    population: 200000,
    garrison: 20000,
    specialties: ['粮食', '布匹', '铁矿'],
    buildings: ['市场', '兵营', '农田', '城墙', '府衙', '皇宫'],
    historicalEvents: ['黄巾起义', '十常侍之乱'],
    initialOwner: 'han',
    description: '东汉都城，天下中心',
    isCapital: true,
  },
  {
    id: 'city_sizhou_0002',
    name: '长安',
    region: 'sizhou',
    position: { x: 450, y: 500 },
    level: 5,
    population: 150000,
    garrison: 18000,
    specialties: ['粮食', '铁矿'],
    buildings: ['市场', '兵营', '农田', '城墙', '府衙'],
    historicalEvents: [],
    initialOwner: 'han',
    description: '西汉旧都，战略要地',
  },
  
  // === 豫州 ===
  {
    id: 'city_yuzhou_0001',
    name: '许昌',
    region: 'yuzhou',
    position: { x: 700, y: 650 },
    level: 4,
    population: 95000,
    garrison: 11000,
    specialties: ['粮食', '铁矿'],
    buildings: ['市场', '兵营', '农田', '城墙'],
    historicalEvents: [],
    initialOwner: 'han',
    description: '豫州重镇，中原要地',
  },
  
  // === 兖州 ===
  {
    id: 'city_yanzhou_0001',
    name: '濮阳',
    region: 'yanzhou',
    position: { x: 800, y: 550 },
    level: 4,
    population: 88000,
    garrison: 10000,
    specialties: ['粮食', '布匹'],
    buildings: ['市场', '兵营', '农田', '城墙'],
    historicalEvents: [],
    initialOwner: 'han',
    description: '兖州治所，中原腹地',
  },
  
  // === 交州 ===
  {
    id: 'city_jiaozhou_0001',
    name: '番禺',
    region: 'jiaozhou',
    position: { x: 700, y: 1200 },
    level: 3,
    population: 55000,
    garrison: 6000,
    specialties: ['香料', '珍珠'],
    buildings: ['市场', '兵营', '港口'],
    historicalEvents: [],
    initialOwner: 'han',
    description: '交州治所，南方门户',
  },
];

// 城市等级配置
export const CITY_LEVELS = {
  1: { name: '村落', maxPopulation: 10000, maxGarrison: 1000 },
  2: { name: '小城', maxPopulation: 30000, maxGarrison: 3000 },
  3: { name: '中城', maxPopulation: 60000, maxGarrison: 6000 },
  4: { name: '大城', maxPopulation: 100000, maxGarrison: 12000 },
  5: { name: '都市', maxPopulation: 150000, maxGarrison: 18000 },
  6: { name: '京城', maxPopulation: 250000, maxGarrison: 25000 },
};

// 建筑类型
export const BUILDING_TYPES = {
  market: { name: '市场', effect: { goldIncome: 1.2 } },
  barracks: { name: '兵营', effect: { troopTraining: 1.5 } },
  farm: { name: '农田', effect: { foodProduction: 1.3 } },
  wall: { name: '城墙', effect: { defense: 1.5 } },
  government: { name: '府衙', effect: { taxIncome: 1.2 } },
  forge: { name: '铁匠铺', effect: { troopAttack: 1.1 } },
  stable: { name: '马场', effect: { cavalrySpeed: 1.2 } },
  port: { name: '港口', effect: { trade: 1.3 } },
  palace: { name: '皇宫', effect: { prestige: 2.0 } },
};

export default SAN_1_CITIES;
