/**
 * 数据验证中间件
 * 
 * @description 提供请求参数验证功能
 * @module middleware/validation
 */

/**
 * 验证部队查询参数
 */
function validateTroopQuery(req, res, next) {
  const { season, rarity, troopType } = req.query;
  
  // 验证稀有度
  if (rarity) {
    const validRarities = ['common', 'rare', 'epic', 'legendary', 'core'];
    if (!validRarities.includes(rarity)) {
      return res.status(400).json({
        success: false,
        message: `无效的稀有度: ${rarity}`,
        validValues: validRarities
      });
    }
  }
  
  // 验证兵种类型
  if (troopType) {
    const validTypes = ['infantry', 'cavalry', 'archer', 'special'];
    if (!validTypes.includes(troopType)) {
      return res.status(400).json({
        success: false,
        message: `无效的兵种类型: ${troopType}`,
        validValues: validTypes
      });
    }
  }
  
  // 验证赛季格式
  if (season) {
    const seasonPattern = /^san_\d+$/;
    if (!seasonPattern.test(season)) {
      return res.status(400).json({
        success: false,
        message: `无效的赛季格式: ${season}`,
        expectedFormat: 'san_1, san_2, etc.'
      });
    }
  }
  
  next();
}

/**
 * 验证部队ID参数
 */
function validateTroopId(req, res, next) {
  const { id } = req.params;
  
  // 验证ID格式
  const idPattern = /^san_\d+_troop_\d+$/;
  if (!idPattern.test(id)) {
    return res.status(400).json({
      success: false,
      message: `无效的部队ID格式: ${id}`,
      expectedFormat: 'san_1_troop_1001'
    });
  }
  
  next();
}

module.exports = {
  validateTroopQuery,
  validateTroopId
};
