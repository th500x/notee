/**
 * 战略大地图 · 城面板（驻地编组 / 军营 / 三公府 / 主城 / 披挂）状态与 API。
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { garrisonAPI } from '@/services/garrisonApi';
import { playerAPI } from '@/services/playerApi';
import {
  getConfiguredGarrisonCityIds,
  MAX_GARRISON_CONFIGURED_CITIES,
} from '@/utils/garrisonScopeUtils';

export function useWorldMapCityPanels({
  player,
  refreshPlayer,
  setSimpleAlertMessage,
  bumpGarrisonStats,
}) {
  const [showGarrison, setShowGarrison] = useState(false);
  const [garrisonCityId, setGarrisonCityId] = useState(null);
  const [garrisonCityName, setGarrisonCityName] = useState('');
  const [showBarracksPost, setShowBarracksPost] = useState(false);
  const [barracksPostCityId, setBarracksPostCityId] = useState(null);
  const [barracksPostCityName, setBarracksPostCityName] = useState('');
  const [showSanGongFu, setShowSanGongFu] = useState(false);
  const [sanGongFuCityName, setSanGongFuCityName] = useState('');
  const [sanGongPositionAnim, setSanGongPositionAnim] = useState(null);
  const sanGongAnimTimerRef = useRef(null);
  const [onDuty, setOnDuty] = useState(false);
  const [pendingMainCityCityId, setPendingMainCityCityId] = useState(null);

  useEffect(() => {
    if (player?.on_duty == null) return;
    setOnDuty(!!player.on_duty);
  }, [player?.on_duty]);

  useEffect(() => {
    if (pendingMainCityCityId == null) return;
    const cur = player?.main_city_id;
    if (cur != null && String(cur) === String(pendingMainCityCityId)) {
      setPendingMainCityCityId(null);
    }
  }, [player?.main_city_id, pendingMainCityCityId]);

  useEffect(
    () => () => {
      if (sanGongAnimTimerRef.current) clearTimeout(sanGongAnimTimerRef.current);
    },
    [],
  );

  const playerMainCityIdForUi =
    pendingMainCityCityId != null ? pendingMainCityCityId : (player?.main_city_id ?? null);

  const bumpStrategicMapRuntimeCaches = bumpGarrisonStats;

  const handleToggleDutyForCity = useCallback(
    async (cityId, newVal) => {
      if (!player?.player_id) return false;
      const res = await garrisonAPI.setOnDuty(player.player_id, newVal, cityId);
      if (res.success) {
        await refreshPlayer();
        bumpGarrisonStats();
        return true;
      }
      if (res.error) setSimpleAlertMessage(res.error);
      return false;
    },
    [player?.player_id, refreshPlayer, bumpGarrisonStats, setSimpleAlertMessage],
  );

  const handleSetMainCityRequest = useCallback(
    async (targetCityId) => {
      if (!player?.player_id || !targetCityId) return;
      try {
        const res = await playerAPI.setMainCity(player.player_id, targetCityId);
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
          return;
        }
        setSimpleAlertMessage(res.error || '设置主城失败');
      } catch (e) {
        setSimpleAlertMessage(e?.message || '设置主城失败');
      }
    },
    [player?.player_id, refreshPlayer, setSimpleAlertMessage],
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

  const openGarrisonForCity = useCallback(
    async (cityId, cityBaseName) => {
      if (!player?.player_id || !cityId) return;
      try {
        const res = await garrisonAPI.getAll(player.player_id);
        if (!res.success) {
          setSimpleAlertMessage(res.error || '无法加载驻地信息，请稍后重试');
          return;
        }
        const configured = getConfiguredGarrisonCityIds(res.garrisons || []);
        const cid = String(cityId);
        if (!configured.has(cid) && configured.size >= MAX_GARRISON_CONFIGURED_CITIES) {
          setSimpleAlertMessage(
            `已达驻地编组城池上限（${MAX_GARRISON_CONFIGURED_CITIES} 座）。请先在其它城池清空驻地编组，再在本城编组。`,
          );
          return;
        }
        setGarrisonCityId(cityId);
        setGarrisonCityName(cityBaseName || '城池');
        setShowGarrison(true);
      } catch (e) {
        setSimpleAlertMessage(e?.message || '打开驻地编组失败');
      }
    },
    [player?.player_id, setSimpleAlertMessage],
  );

  const closeGarrisonPanel = useCallback(() => {
    setShowGarrison(false);
    bumpStrategicMapRuntimeCaches();
  }, [bumpStrategicMapRuntimeCaches]);

  const closeBarracksPostPanel = useCallback(() => {
    setShowBarracksPost(false);
    setBarracksPostCityId(null);
  }, []);

  const closeSanGongFuPanel = useCallback(() => {
    setShowSanGongFu(false);
  }, []);

  const strategicFullScreenOverlayOpen =
    showSanGongFu || !!showGarrison || !!showBarracksPost;

  return {
    showGarrison,
    garrisonCityId,
    garrisonCityName,
    showBarracksPost,
    barracksPostCityId,
    barracksPostCityName,
    showSanGongFu,
    sanGongFuCityName,
    sanGongPositionAnim,
    onDuty,
    playerMainCityIdForUi,
    handleToggleDutyForCity,
    handleSetMainCityRequest,
    handleOpenBarracksPost,
    handleOpenSanGongFu,
    handleSanGongPromoted,
    openGarrisonForCity,
    bumpStrategicMapRuntimeCaches,
    closeGarrisonPanel,
    closeBarracksPostPanel,
    closeSanGongFuPanel,
    strategicFullScreenOverlayOpen,
  };
}

export default useWorldMapCityPanels;
