import { useState, useEffect } from 'react';

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
        const response = await fetch('/data/shared/bonds.json');
        if (!response.ok) {
          throw new Error('Failed to load bonds data');
        }
        const data = await response.json();
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
        setLoading(false);
      } catch (err) {
        console.error('Error loading bonds:', err);
        setError(err.message);
        setLoading(false);
      }
    }

    loadBonds();
  }, []);

  return { bonds, bondsMap, loading, error };
}
