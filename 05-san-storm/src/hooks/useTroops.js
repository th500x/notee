import { useState, useEffect } from 'react';

/**
 * 部队数据 Hook
 * 用于加载和管理部队数据
 */
export const useTroops = () => {
  const [troops, setTroops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadTroops = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/shared/troops.json');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setTroops(data.troops || []);
        setError(null);
      } catch (err) {
        console.error('加载部队数据失败:', err);
        setError(err.message);
        setTroops([]);
      } finally {
        setLoading(false);
      }
    };

    loadTroops();
  }, []);

  // 按ID获取部队
  const getTroopById = (id) => {
    return troops.find(troop => troop.id === id);
  };

  // 按稀有度获取部队
  const getTroopsByRarity = (rarity) => {
    return troops.filter(troop => troop.rarity === rarity);
  };

  // 按兵种获取部队
  const getTroopsByType = (troopType) => {
    return troops.filter(troop => troop.troopType === troopType);
  };

  // 按稀有度和兵种获取部队
  const getTroopsByRarityAndType = (rarity, troopType) => {
    return troops.filter(troop => 
      troop.rarity === rarity && troop.troopType === troopType
    );
  };

  return {
    troops,
    loading,
    error,
    getTroopById,
    getTroopsByRarity,
    getTroopsByType,
    getTroopsByRarityAndType
  };
};

export default useTroops;
