/**
 * S1 豫州战略合并图（颍川 + 汝南栈）：供「地图」Tab 缩略图等与主界面大地图同源加载。
 */

import { useState, useEffect } from 'react';
import { loadSan1StrategicMergedStackFromPublic } from '@shared/utils/san1StrategicMergedPublicLoader.js';

/**
 * @returns {{ status: 'idle'|'loading'|'ready'|'error', merged: object|null, error: string|null }}
 */
export function useSan1StrategicMergedStack() {
  const [state, setState] = useState({
    status: 'idle',
    merged: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', merged: null, error: null });
    const baseUrl = `${import.meta.env.BASE_URL}`;
    loadSan1StrategicMergedStackFromPublic({ baseUrl })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: 'error', merged: null, error: res.error || 'load failed' });
          return;
        }
        setState({
          status: 'ready',
          merged: {
            cells: res.cells,
            seed: res.seed,
            version: res.version,
            mapColumns: res.mapColumns,
            mapRows: res.mapRows,
            junId: res.junId,
            season: res.season,
            roadCells: res.roadCells,
            roadConnectivity: res.roadConnectivity,
          },
          error: null,
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: 'error',
            merged: null,
            error: e?.message || 'load failed',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
