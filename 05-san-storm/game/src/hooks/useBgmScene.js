import { useEffect } from 'react';
import { popBgmScene, pushBgmScene } from '@/services/bgmService';

/**
 * 战斗等子界面挂载时压入 BGM 场景，卸载时弹出恢复下层（通常为 theme_main）
 *
 * @param {'theme_main'|'battle_small'|'battle_campaign'|null|undefined} sceneId
 */
export function useBgmScene(sceneId) {
  useEffect(() => {
    if (!sceneId) return undefined;
    pushBgmScene(sceneId);
    return () => popBgmScene();
  }, [sceneId]);
}
