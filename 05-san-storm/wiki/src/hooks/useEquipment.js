import { useState, useEffect } from 'react';
import { loadSharedData } from '@/services/dataService';

/**
 * 装备件数据 Hook
 */
export const useEquipment = () => {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await loadSharedData('equipment');
        setEquipment(data.equipment || []);
      } catch (err) {
        console.error('[useEquipment] 加载失败:', err);
        setError(err.message);
        setEquipment([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getById         = (id)   => equipment.find(e => e.id === id);
  const getByType       = (type) => equipment.filter(e => e.equipmentType === type);
  const getByRarity     = (r)    => equipment.filter(e => e.rarity === r);

  return { equipment, loading, error, getById, getByType, getByRarity };
};

export default useEquipment;
