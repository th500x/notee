/**
 * 技能数据Hook
 * 
 * @description 加载和管理技能数据
 * @module hooks/useSkills
 */

import { useState, useEffect } from 'react';

/**
 * 技能数据Hook
 * @returns {Object} { skills, skillsMap, loading, error }
 */
export function useSkills() {
  const [skills, setSkills] = useState([]);
  const [skillsMap, setSkillsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSkills();
  }, []);

  /**
   * 加载技能数据
   */
  async function loadSkills() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/data/shared/skills.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSkills(data);

      // 创建技能ID到技能对象的映射
      const map = {};
      data.forEach(skill => {
        map[skill.id] = skill;
      });
      setSkillsMap(map);

    } catch (err) {
      console.error('加载技能数据失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 根据ID获取技能
   * @param {string} skillId - 技能ID
   * @returns {Object|null} 技能对象
   */
  function getSkillById(skillId) {
    return skillsMap[skillId] || null;
  }

  /**
   * 根据稀有度获取技能
   * @param {string} rarity - 稀有度
   * @returns {Array} 技能数组
   */
  function getSkillsByRarity(rarity) {
    return skills.filter(skill => skill.rarity === rarity);
  }

  /**
   * 根据类型获取技能
   * @param {string} type - 技能类型（active/passive）
   * @returns {Array} 技能数组
   */
  function getSkillsByType(type) {
    return skills.filter(skill => skill.type === type);
  }

  return {
    skills,
    skillsMap,
    loading,
    error,
    getSkillById,
    getSkillsByRarity,
    getSkillsByType,
  };
}
