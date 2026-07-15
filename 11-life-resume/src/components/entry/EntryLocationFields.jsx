import { useRef, useState } from 'react';

import {

  buildGoogleMapsUrl,

  formatGeolocationAccuracyMeters,

  shouldWarnGeolocationAccuracy,

  validateCoordinates,

} from '@shared/utils/lifeResumeLocation.js';

import {

  normalizeLocationPlaceName,

  parseGoogleMapsShareUrl,

} from '@shared/utils/parseGoogleMapsShareUrl.js';

import { fetchResolveMapsUrl, fetchReverseGeocode } from '@/services/lifeResumeApi';
import { formatLifeResumeError } from '@/utils/lifeResumeErrors';



export default function EntryLocationFields({

  enabled,

  placeName,

  mapsUrl,

  latitude,

  longitude,

  captureMethod,

  publicLabelPreview,

  onEnabledChange,

  onPlaceNameChange,

  onMapsUrlChange,

  onLatitudeChange,

  onLongitudeChange,

  onCaptureMethodChange,

  onPublicLabelPreviewChange,

  disabled = false,

}) {

  const mapsInputRef = useRef(null);

  const [locating, setLocating] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);

  const [error, setError] = useState('');

  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState(null);

  const [mapPickHint, setMapPickHint] = useState(false);

  const [resolvingMapsUrl, setResolvingMapsUrl] = useState(false);



  const clearAccuracy = () => setLocationAccuracyMeters(null);



  const applyParsedResult = (parsed) => {
    if (parsed.empty) {
      setError('');
      return true;
    }

    setError('');
    onEnabledChange(true);
    onCaptureMethodChange('map_pick');
    onMapsUrlChange(parsed.shareUrl);
    if (parsed.placeName) {
      onPlaceNameChange(parsed.placeName);
    }
    if (parsed.latitude != null && parsed.longitude != null) {
      onLatitudeChange(String(parsed.latitude));
      onLongitudeChange(String(parsed.longitude));
    }
    return true;
  };

  const applyParsedMapsUrl = async (rawUrl) => {
    let parsed = parseGoogleMapsShareUrl(rawUrl);
    const shouldServerResolve =
      (!parsed.ok && parsed.code === 'GOOGLE_MAPS_SHORT_URL') ||
      (parsed.ok && !parsed.empty && parsed.latitude == null && parsed.longitude == null);

    if (shouldServerResolve) {
      setResolvingMapsUrl(true);
      setError(
        parsed.code === 'GOOGLE_MAPS_SHORT_URL'
          ? '正在解析 Google 地图短链接…'
          : '正在解析 Google 地图链接…'
      );
      try {
        const res = await fetchResolveMapsUrl(rawUrl);
        if (res.data?.ok) {
          parsed = res.data;
        }
      } catch (err) {
        if (placeName.trim()) {
          setError(
            `${formatLifeResumeError(err)}。已保留链接，填写地点名称后仍可发布。`
          );
          onEnabledChange(true);
          onCaptureMethodChange('map_pick');
          onMapsUrlChange(rawUrl.trim());
          return true;
        }
        if (!parsed.ok) {
          setError(formatLifeResumeError(err));
          return false;
        }
      } finally {
        setResolvingMapsUrl(false);
      }
    }

    if (!parsed.ok) {
      if (placeName.trim() && parsed.code === 'GOOGLE_MAPS_SHORT_URL') {
        setError(`${parsed.error}。已保留短链接，将按地点名称保存位置。`);
        onEnabledChange(true);
        onCaptureMethodChange('map_pick');
        onMapsUrlChange(rawUrl.trim());
        return true;
      }
      setError(parsed.error);
      return false;
    }

    return applyParsedResult(parsed);
  };



  const handleUseCurrentLocation = () => {

    setError('');

    if (!navigator.geolocation) {

      setError('当前浏览器不支持定位');

      return;

    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(

      (pos) => {

        setMapPickHint(false);

        onEnabledChange(true);

        onCaptureMethodChange('geolocation');

        onLatitudeChange(String(pos.coords.latitude));

        onLongitudeChange(String(pos.coords.longitude));

        setLocationAccuracyMeters(

          Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null

        );

        setLocating(false);

      },

      (err) => {

        setLocating(false);

        clearAccuracy();

        setError(err.message || '无法获取当前位置（HTTPS 环境下才可用）');

      },

      { enableHighAccuracy: true, timeout: 15000 }

    );

  };



  const handleOpenGoogleMaps = () => {

    setError('');

    clearAccuracy();

    onEnabledChange(true);

    onCaptureMethodChange('map_pick');

    setMapPickHint(true);



    const check = validateCoordinates(latitude, longitude);

    const openUrl = check.ok

      ? buildGoogleMapsUrl({ latitude: check.latitude, longitude: check.longitude })

      : placeName.trim()

        ? buildGoogleMapsUrl({ placeName: placeName.trim() })

        : 'https://www.google.com/maps';

    window.open(openUrl, '_blank', 'noopener,noreferrer');



    requestAnimationFrame(() => {

      mapsInputRef.current?.focus();

    });

  };



  const handleMapsUrlChange = (value) => {
    clearAccuracy();
    onCaptureMethodChange('map_pick');
    onMapsUrlChange(value);
    if (!value.trim()) {
      setError('');
    }
  };

  const handleMapsUrlPaste = (e) => {
    const pasted = e.clipboardData?.getData('text')?.trim();
    if (!pasted) return;
    queueMicrotask(() => {
      void applyParsedMapsUrl(pasted);
    });
  };



  const handleMapsUrlBlur = () => {

    if (!mapsUrl.trim()) return;

    void applyParsedMapsUrl(mapsUrl);

  };



  const handlePlaceNameChange = (value) => {

    clearAccuracy();

    onCaptureMethodChange('map_pick');

    onPlaceNameChange(normalizeLocationPlaceName(value) || value);

  };



  const handleLatitudeChange = (value) => {

    clearAccuracy();

    onCaptureMethodChange('map_pick');

    onLatitudeChange(value);

  };



  const handleLongitudeChange = (value) => {

    clearAccuracy();

    onCaptureMethodChange('map_pick');

    onLongitudeChange(value);

  };



  const handlePreviewLabel = async () => {

    setError('');

    const check = validateCoordinates(latitude, longitude);

    if (!check.ok) {

      setError(check.error);

      return;

    }

    setPreviewLoading(true);

    try {

      const res = await fetchReverseGeocode({

        latitude: check.latitude,

        longitude: check.longitude,

      });

      onPublicLabelPreviewChange(res.data.locationPublicLabel);

    } catch (err) {

      setError(err.message || '无法解析模糊地址');

      onPublicLabelPreviewChange('');

    } finally {

      setPreviewLoading(false);

    }

  };



  const handleClear = () => {

    onEnabledChange(false);

    onPlaceNameChange('');

    onMapsUrlChange('');

    onLatitudeChange('');

    onLongitudeChange('');

    onCaptureMethodChange('none');

    onPublicLabelPreviewChange('');

    clearAccuracy();

    setMapPickHint(false);

    setError('');

  };



  const accuracyLabel =

    captureMethod === 'geolocation' ? formatGeolocationAccuracyMeters(locationAccuracyMeters) : null;

  const showAccuracyWarning =

    captureMethod === 'geolocation' && shouldWarnGeolocationAccuracy(locationAccuracyMeters);

  const hasCoords = validateCoordinates(latitude, longitude).ok;



  return (

    <section className="space-y-3">

      <div className="flex flex-wrap items-center justify-between gap-2">

        <p className="text-sm font-medium text-slate-800">位置（可选）</p>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">

          <input

            type="checkbox"

            checked={enabled}

            disabled={disabled}

            onChange={(e) => {

              if (!e.target.checked) {

                handleClear();

              } else {

                onEnabledChange(true);

              }

            }}

          />

          记录地点

        </label>

      </div>



      {enabled && (

        <>

          <p className="text-xs text-slate-500">

            推荐：在 Google 地图找到具体地点，复制分享链接并填写地点名称。每次分享会生成不同短链接，属正常现象；若自动解析失败，只要填了地点名称仍可发布。

          </p>

          <div className="flex flex-wrap gap-2">

            <button

              type="button"

              disabled={disabled || locating}

              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-60"

              onClick={handleUseCurrentLocation}

            >

              {locating ? '定位中…' : '使用当前位置'}

            </button>

            <button

              type="button"

              disabled={disabled}

              className={`px-3 py-1.5 rounded-lg border text-sm hover:bg-slate-50 disabled:opacity-60 ${

                captureMethod === 'map_pick'

                  ? 'border-indigo-400 bg-indigo-50 text-indigo-800'

                  : 'border-slate-300'

              }`}

              onClick={handleOpenGoogleMaps}

            >

              用 Google 地图选点

            </button>

            <button

              type="button"

              disabled={disabled || previewLoading || !hasCoords}

              className="px-3 py-1.5 rounded-lg border border-indigo-200 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"

              onClick={handlePreviewLabel}

            >

              {previewLoading ? '解析中…' : '预览模糊地址'}

            </button>

            <button

              type="button"

              disabled={disabled}

              className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:underline"

              onClick={handleClear}

            >

              清除

            </button>

          </div>



          <div>

            <label className="block text-xs text-slate-600 mb-1" htmlFor="entry-place-name">

              地点名称

            </label>

            <input

              id="entry-place-name"

              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"

              placeholder="例如：海底捞火锅（某某店）"

              value={placeName}

              disabled={disabled}

              onChange={(e) => handlePlaceNameChange(e.target.value)}

            />

          </div>



          <div>

            <label className="block text-xs text-slate-600 mb-1" htmlFor="entry-maps-url">

              Google 地图链接

            </label>

            <input

              ref={mapsInputRef}

              id="entry-maps-url"

              className="w-full rounded-lg border border-indigo-300 ring-1 ring-indigo-100 px-3 py-2 text-sm"

              placeholder="粘贴 Google 地图分享链接（支持 maps.app.goo.gl 短链接）"

              value={mapsUrl}

              disabled={disabled || resolvingMapsUrl}

              onChange={(e) => handleMapsUrlChange(e.target.value)}
              onPaste={handleMapsUrlPaste}
              onBlur={handleMapsUrlBlur}

            />

          </div>



          {accuracyLabel && (

            <p className="text-xs text-slate-600">

              定位精度：{accuracyLabel}

              <span className="text-slate-400 ml-1">（浏览器估算，电脑可能偏差较大）</span>

            </p>

          )}

          {showAccuracyWarning && (

            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">

              当前定位偏差可能较大，建议在 Google 地图找到准确地点后，复制链接粘贴到上方。

            </p>

          )}

          {mapPickHint && (

            <p className="text-xs text-indigo-900 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">

              粘贴 maps.app.goo.gl 短链接后会尝试自动解析。若提示解析失败，请确认已填写地点名称；也可在浏览器打开该链接，从地址栏复制 google.com/maps 开头的完整链接再粘贴。

            </p>

          )}



          <details className="rounded-lg border border-slate-200 px-3 py-2">

            <summary className="cursor-pointer text-xs text-slate-600 select-none">

              高级：经纬度（可选，通常由链接自动填入）

            </summary>

            <div className="mt-3 grid grid-cols-2 gap-3">

              <div>

                <label className="block text-xs text-slate-600 mb-1" htmlFor="entry-lat">

                  纬度

                </label>

                <input

                  id="entry-lat"

                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"

                  value={latitude}

                  disabled={disabled}

                  onChange={(e) => handleLatitudeChange(e.target.value)}

                />

              </div>

              <div>

                <label className="block text-xs text-slate-600 mb-1" htmlFor="entry-lon">

                  经度

                </label>

                <input

                  id="entry-lon"

                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"

                  value={longitude}

                  disabled={disabled}

                  onChange={(e) => handleLongitudeChange(e.target.value)}

                />

              </div>

            </div>

          </details>



          {publicLabelPreview && (

            <p className="text-sm text-slate-700 bg-slate-100 rounded-lg px-3 py-2">

              访客将看到：{publicLabelPreview}

            </p>

          )}

        </>

      )}



      {error && <p className="text-sm text-red-600">{error}</p>}

    </section>

  );

}


