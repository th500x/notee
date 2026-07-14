/**
 * 战略大地图 · 城面板（驻军所 / 三公府 / 主城）状态与 API。
 * 驻地编组入口并入主城「驻军所」双 Tab；披挂上阵已移除。
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { playerAPI } from '@/services/playerApi';

export function useWorldMapCityPanels({
  player,
  refreshPlayer,
  setSimpleAlertMessage,
  bumpGarrisonStats,
}) {
  const [showBarracksPost, setShowBarracksPost] = useState(false);
  const [barracksPostCityId, setBarracksPostCityId] = useState(null);
  const [barracksPostCityName, setBarracksPostCityName] = useState('');
  const [showSanGongFu, setShowSanGongFu] = useState(false);
  const [sanGongFuCityName, setSanGongFuCityName] = useState('');
  const [sanGongPositionAnim, setSanGongPositionAnim] = useState(null);
  const sanGongAnimTimerRef = useRef(null);
  const [pendingMainCityCityId, setPendingMainCityCityId] = useState(null);

  useEffect(() => {
    if (pendingMainCityCityId == null) return;
    const cur = player?.mainCityId;
    if (cur != null && String(cur) === String(pendingMainCityCityId)) {
      setPendingMainCityCityId(null);
    }
  }, [player?.mainCityId, pendingMainCityCityId]);

  useEffect(
    () => () => {
      if (sanGongAnimTimerRef.current) clearTimeout(sanGongAnimTimerRef.current);
    },
    [],
  );

  const playerMainCityIdForUi =
    pendingMainCityCityId != null ? pendingMainCityCityId : (player?.mainCityId ?? null);

  const bumpStrategicMapRuntimeCaches = bumpGarrisonStats;

  const handleSetMainCityRequest = useCallback(
    async (targetCityId) => {
      if (!player?.playerId || !targetCityId) return;
      try {
        const res = await playerAPI.setMainCity(player.playerId, targetCityId);
        if (res.success) {
          const d = res.data || {};
          let msg;
          if (d.already) {
            msg = '该城已是您的主城（存卡）';
          } else if (Number(d.costSilver) > 0) {
            msg = `已将主城更换为此城，消耗 ${d.costSilver} 银两`;
          } else {
            msg = '已将该城设为主城（存卡仓库）';
          }
          setSimpleAlertMessage(msg);
          setPendingMainCityCityId(String(targetCityId));
          await refreshPlayer({ silent: true });
          bumpStrategicMapRuntimeCaches();
          return;
        }
        setSimpleAlertMessage(res.error || '设置主城失败');
      } catch (e) {
        setSimpleAlertMessage(e?.message || '设置主城失败');
      }
    },
    [player?.playerId, refreshPlayer, setSimpleAlertMessage, bumpStrategicMapRuntimeCaches],
  );

  const handleOpenBarracksPost = useCallback((cityId, cityBaseName) => {
    if (!cityId) return;
    setBarracksPostCityId(cityId);
    setBarracksPostCityName(cityBaseName || '城池');
    setShowBarracksPost(true);
  }, []);

  const handleOpenSanGongFu = useCallback((_cityId, cityBaseName) => {
    setSanGongFuCityName(cityBaseName || '城池');
    setShowSanGongFu(true);
  }, []);

  const handleSanGongPromoted = useCallback((data) => {
    if (sanGongAnimTimerRef.current) {
      clearTimeout(sanGongAnimTimerRef.current);
      sanGongAnimTimerRef.current = null;
    }
    const pos = data?.position;
    if (pos && typeof pos === 'object') {
      setSanGongPositionAnim({
        position: pos,
        positionName: data.positionName,
        positionLevel: data.positionLevel,
      });
      sanGongAnimTimerRef.current = setTimeout(() => {
        setSanGongPositionAnim(null);
        sanGongAnimTimerRef.current = null;
      }, 1000);
    }
  }, []);

  const closeBarracksPostPanel = useCallback(() => {
    setShowBarracksPost(false);
    setBarracksPostCityId(null);
    bumpStrategicMapRuntimeCaches();
  }, [bumpStrategicMapRuntimeCaches]);

  const closeSanGongFuPanel = useCallback(() => {
    setShowSanGongFu(false);
  }, []);

  const strategicFullScreenOverlayOpen = showSanGongFu || !!showBarracksPost;

  return {
    showBarracksPost,
    barracksPostCityId,
    barracksPostCityName,
    showSanGongFu,
    sanGongFuCityName,
    sanGongPositionAnim,
    playerMainCityIdForUi,
    handleSetMainCityRequest,
    handleOpenBarracksPost,
    handleOpenSanGongFu,
    handleSanGongPromoted,
    bumpStrategicMapRuntimeCaches,
    closeBarracksPostPanel,
    closeSanGongFuPanel,
    strategicFullScreenOverlayOpen,
  };
}

export default useWorldMapCityPanels;
