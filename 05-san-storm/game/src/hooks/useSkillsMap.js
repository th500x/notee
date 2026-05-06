/**
 * `skills.json` → `{ id → skill }` 字典 hook
 *
 * 编组（`LineupTab` / 驻地编组 `GarrisonLineup` 等）需要把技能 ID 解析成完整技能对象
 * 喂给 `TroopCard` / `CharacterCard`。两端原本各自 `useEffect` + `setState` + `loadSharedData('skills')`
 * 重写一份；CR C5（2026-04-29）抽到这里复用。
 *
 * 使用：
 *   const skillsMap = useSkillsMap();
 *
 * 加载失败时返回空对象 `{}`，调用方仍可正常渲染（卡片层会显示技能 ID）。
 *
 * @returns {Record<string, object>}
 */
import { useState, useEffect } from 'react';
import { loadSharedData } from '@/services/dataService';

export function useSkillsMap() {
  const [skillsMap, setSkillsMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    loadSharedData('skills')
      .then((data) => {
        if (cancelled || !data?.skills) return;
        const map = {};
        data.skills.forEach((s) => { map[s.id] = s; });
        setSkillsMap(map);
      })
      .catch((err) => {
        console.error('[useSkillsMap] 加载技能数据失败:', err);
      });
    return () => { cancelled = true; };
  }, []);

  return skillsMap;
}

export default useSkillsMap;
