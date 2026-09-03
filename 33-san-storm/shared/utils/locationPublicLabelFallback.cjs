/**
 * 访客可见位置模糊文案 — 地理编码失败时的纯文本回退
 * 须与 locationPublicLabelFallback.js 同步
 *
 * 分层约定：
 * - extractGeocodeQueryCandidates：给 Nominatim 的查询变体（可含店名，但勿把店名末词单独当地名）
 * - buildFallbackPublicLabelFromPlaceName：仅当外部地理编码全部失败时，摘城/区县级文案（严格）
 */

function isLikelyGeoLocalitySegment(segment) {
  const s = String(segment || '').trim();
  if (!s || s.length < 2 || /^\d+$/.test(s)) return false;
  if (/^(by|at|from|near|in)\b/i.test(s)) return false;
  if (/^[@#]/i.test(s)) return false;
  if (/^[A-Za-z]{1,4}[\u0E00-\u0E7F]/.test(s)) return false;

  if (/District|County|Province|อำเภอ|จังหวัด|เขต|Municipality|City\b/i.test(s)) return true;
  if (/[市县府区]$/u.test(s)) return true;

  if (/^[\u0E00-\u0E7F][\u0E00-\u0E7F\s·]*$/.test(s)) {
    if (s.length < 4) return false;
    if (/^(ร้าน|ครัว|บ้าน|คาเฟ่|โรงแรม|รีสอร์ท|สวน|ร้านอาหาร|ปาร์ค|พาร์ค)/.test(s)) {
      return false;
    }
    if (/ปาร์ค$|พาร์ค$/.test(s) && s.length <= 6) return false;
    return true;
  }

  return false;
}

function extractGeocodeQueryCandidates(placeName) {
  const text = String(placeName || '').trim();
  if (!text) return [];

  const candidates = [];
  const commaParts = text.split(',').map((s) => s.trim()).filter(Boolean);

  if (/[\u0E00-\u0E7F]/.test(text)) {
    candidates.push(`${text}, Thailand`);
  }

  const byParts = text.split(/\s+By\b/i).map((s) => s.trim()).filter(Boolean);
  if (byParts.length >= 2 && byParts[0].length >= 3) {
    const venue = byParts[0];
    candidates.push(/[\u0E00-\u0E7F]/.test(venue) ? `${venue}, Thailand` : venue);
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

  const spaceParts = text.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  if (spaceParts.length >= 2) {
    const tail = spaceParts[spaceParts.length - 1];
    if (isLikelyGeoLocalitySegment(tail) || /District|Province|อำเภอ|จังหวัด|市|县|府/i.test(tail)) {
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

function buildFallbackPublicLabelFromPlaceName(placeName) {
  const text = String(placeName || '').trim();
  if (!text) return null;

  const commaParts = text.split(',').map((s) => s.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const picks = [];
    const cityPart = commaParts.find((p) => /\bCity\b|市|府$/i.test(p));
    const districtPart = commaParts.find((p) =>
      /District|County|Province|อำเภอ|จังหวัด|县|府$/i.test(p)
    );
    if (cityPart) picks.push(cityPart);
    if (districtPart && districtPart !== cityPart) picks.push(districtPart);
    if (picks.length === 0) {
      picks.push(...commaParts.slice(1, 3).filter(isLikelyGeoLocalitySegment));
    }
    const label = picks.filter(Boolean).join(' · ');
    if (label) return label.slice(0, 128);
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

  return extractKnownCityMentionFromPlaceName(text);
}

function extractKnownCityMentionFromPlaceName(placeName) {
  const text = String(placeName || '').trim();
  if (!text) return null;

  if (/\bChai Badan\b/i.test(text) || text.includes('ชัยบาดาล')) {
    return 'Chai Badan District';
  }
  if (/\bPattaya\b/i.test(text) || text.includes('พัทยา') || text.includes('芭提雅')) {
    return 'Pattaya · 芭提雅';
  }
  if (/\bBangkok\b/i.test(text) || text.includes('曼谷')) {
    return 'Bangkok';
  }
  if (/\bChiang Mai\b/i.test(text) || text.includes('清迈')) {
    return 'Chiang Mai';
  }
  if (/\bPhuket\b/i.test(text) || text.includes('普吉')) {
    return 'Phuket';
  }
  if (text.includes('春武里') || /\bChon Buri\b/i.test(text)) {
    return 'Chon Buri';
  }
  if (/\bAyutthaya\b|\bAyuthaya\b/i.test(text) || text.includes('อยุธยา')) {
    return 'Ayutthaya';
  }

  return null;
}

function isDegeneratePublicLabel(label, placeName) {
  const l = String(label || '').trim();
  const p = String(placeName || '').trim();
  if (!l || !p) return false;
  if (l.toLowerCase() === p.toLowerCase()) return true;
  const words = p.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words[words.length - 1].toLowerCase() === l.toLowerCase()) {
    return true;
  }
  if (/^[\u0E00-\u0E7F]+$/.test(l) && l.length <= 6 && p.includes(l)) {
    return true;
  }
  return false;
}

module.exports = {
  isLikelyGeoLocalitySegment,
  extractGeocodeQueryCandidates,
  extractKnownCityMentionFromPlaceName,
  buildFallbackPublicLabelFromPlaceName,
  isDegeneratePublicLabel,
};
