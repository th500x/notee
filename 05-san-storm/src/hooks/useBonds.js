import { useState, useEffect } from 'react';
import { loadSharedData } from '@/utils/dataLoader';

/**
 * 羁绊数据 Hook
 * 从 bonds.json 加载羁绊数据
 */
export function useBonds() {
  const [bonds, setBonds] = useState([]);
  const [bondsMap, setBondsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadBonds() {
      try {
        setLoading(true);
        setError(null);
        
        const data = await loadSharedData('bonds');
        setBonds(data);
        
        // 创建 ID 映射
        const idMap = {};
        data.forEach(bond => {
          idMap[bond.id] = bond;
        });
        
        // 创建名称映射（用于通过中文名查找）
        const nameMap = {};
        data.forEach(bond => {
          nameMap[bond.name] = bond;
        });
        
        setBondsMap({ ...idMap, ...nameMap });
      } catch (err) {
        console.error('[useBonds] 加载失败:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadBonds();
  }, []);

  return { bonds, bondsMap, loading, error };
}
