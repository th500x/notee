/**
 * 访客可见位置模糊文案 — 地理编码失败时的纯文本回退
 * 须与 locationPublicLabelFallback.cjs 同步
 */

/**
 * 判断空格/逗号分段是否像城/区县，而非店名后缀（如 "Byxxx"）。
 * @param {string} segment
 * @returns {boolean}
 */
export function isLikelyGeoLocalitySegment(segment) {
  const s = String(segment || '').trim();
  if (!s || s.length < 2 || /^\d+$/.test(s)) return false;
  if (/^(by|at|from|near|in)\b/i.test(s)) return false;
  if (/^[@#]/i.test(s)) return false;
  // Latin prefix glued to Thai (e.g. Byครัว…)
  if (/^[A-Za-z]{1,4}[\u0E00-\u0E7F]/.test(s)) return false;

  if (/District|County|Province|อำเภอ|จังหวัด|เขต/i.test(s)) return true;
  if (/[市县府区]$/u.test(s)) return true;

  if (/^[\u0E00-\u0E7F][\u0E00-\u0E7F\s·]*$/.test(s)) {
    if (/^(ร้าน|ครัว|บ้าน|คาเฟ่|โรงแรม|รีสอร์ท|สวน|ร้านอาหาร)/.test(s)) return false;
    return true;
  }

  if (/^[A-Za-z][a-zA-Z\s'.-]+$/.test(s) && !/^(The|And|New|By|At)\b/i.test(s)) {
    return true;
  }

  return false;
}

/**
 * @param {string} placeName
 * @returns {string[]}
 */
export function extractGeocodeQueryCandidates(placeName) {
  const text = String(placeName || '').trim();
  if (!text) return [];

  const candidates = [];
  const commaParts = text.split(',').map((s) => s.trim()).filter(Boolean);
  const spaceParts = text.split(/\s+/).map((s) => s.trim()).filter(Boolean);

  if (/[\u0E00-\u0E7F]/.test(text)) {
    candidates.push(`${text}, Thailand`);
  }

  const byParts = text.split(/\s+By\b/i).map((s) => s.trim()).filter(Boolean);
  if (byParts.length >= 2) {
    const venue = byParts[0];
    if (venue.length >= 3) {
      candidates.push(/[\u0E00-\u0E7F]/.test(venue) ? `${venue}, Thailand` : venue);
    }
  }

  if (commaParts.length >= 2) {
    const cityPart = commaParts.find((p) => /\bCity\b|市|府$/i.test(p));
    if (cityPart) candidates.push(cityPart);

    for (const part of commaParts.slice(1)) {
      if (part.length >= 3 && !/^\d{5,}$/.test(part)) {
        candidates.push(part);
      }
    }
  }

  if (spaceParts.length >= 2) {
    const tail = spaceParts[spaceParts.length - 1];
    if (isLikelyGeoLocalitySegment(tail)) {
      candidates.push(tail);
      if (/[\u0E00-\u0E7F]/.test(text)) {
        candidates.push(`${tail}, Thailand`);
      }
    }
  }

  if (/\bPattaya\b/i.test(text) || text.includes('พัทยา')) {
    candidates.push('Pattaya');
  }
  if (/\bBangkok\b/i.test(text) || text.includes('曼谷')) {
    candidates.push('Bangkok');
  }
  if (/\bChai Badan\b/i.test(text) || text.includes('ชัยบาดาล')) {
    candidates.push('Chai Badan, Thailand');
  }
  if (text.includes('芭提雅')) {
    candidates.push('芭提雅');
  }

  return [...new Set(candidates.map((s) => s.trim()).filter(Boolean))].slice(0, 10);
}

/**
 * 从 Google 地图 place 段或用户输入中提取城/区县级模糊文案（不依赖外部服务）
 * @param {string} placeName
 * @returns {string|null}
 */
export function buildFallbackPublicLabelFromPlaceName(placeName) {
  const text = String(placeName || '').trim();
  if (!text) return null;

  const commaParts = text.split(',').map((s) => s.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const picks = [];
    const cityPart = commaParts.find((p) => /\bCity\b|市|府$/i.test(p));
    const districtPart = commaParts.find((p) =>
      /District|County|Province|อำเภอ|县|府$/i.test(p)
    );
    if (cityPart) picks.push(cityPart);
    if (districtPart && districtPart !== cityPart) picks.push(districtPart);
    if (picks.length === 0) {
      const geoTail = commaParts.slice(1, 3).filter(isLikelyGeoLocalitySegment);
      picks.push(...(geoTail.length > 0 ? geoTail : commaParts.slice(1, 3)));
    }
    const label = picks.filter(Boolean).join(' · ');
    if (label) return label.slice(0, 128);
  }

  const spaceParts = text.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  if (spaceParts.length >= 2) {
    const district = spaceParts[spaceParts.length - 1];
    if (isLikelyGeoLocalitySegment(district)) {
      return district.slice(0, 128);
    }
  }

  const thaiAdmin = text.match(/(?:อำเภอ|เขต|จังหวัด)\s*([^\s,]+)/);
  if (thaiAdmin?.[1]) {
    return thaiAdmin[1].slice(0, 128);
  }

  const knownCity = text.match(
    /\b(Pattaya|Bangkok|Chiang Mai|Phuket|Tokyo|Osaka|Seoul|Singapore|Hong Kong|Taipei|Kaohsiung)\b/i
  );
  if (knownCity) return knownCity[1].slice(0, 128);
  if (text.includes('พัทยา') || text.includes('芭提雅')) return 'Pattaya · 芭提雅';

  return null;
}
