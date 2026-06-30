/**
 * 图库公开分享页 — 按浏览器/系统语言展示文案
 * 支持：zh（默认）、en、th
 */

export const GALLERY_SHARE_LOCALES = ['zh', 'en', 'th'];

const MESSAGES = {
  zh: {
    pageTitle: '图片库',
    roomLabel: '房号',
    loading: '加载中…',
    listingTitle: '房源说明',
    drivePreviewTitle: 'Google 云端硬盘预览',
    drivePreviewHint:
      '点击下方网格可放大；批量下载请用下方按钮在 Google App 中打开（尤其安卓）。若预览空白，请确认文件夹已设为「知道链接的人可查看」。',
    iframeTitle: 'Google 云端硬盘图片预览',
    embedFallback: '无法嵌入预览，请使用下方按钮打开文件夹。',
    openInDrive: '在 Google 云端硬盘中打开',
    openInDriveHint: '下载、保存到相册请在 Google 页面操作',
    emptyGallery: '图库暂无内容',
    errorInvalidLink:
      '链接无效或尚未生效。常见原因：填写后还没有点「保存到服务器」，或链接已被重新生成。请让分享方保存后再发链接。',
    errorNoDrive: '分享方尚未配置 Google 云端硬盘文件夹链接，请让对方在图库中粘贴链接并保存。',
    errorLoadFailed: '加载图库失败',
    labelCondo: '公寓',
    labelBuilding: '楼栋',
    labelRent: '租金',
    labelDeposit: '押金',
    labelArea: '面积',
    labelLayout: '户型',
    labelTv: '电视',
    labelInternet: '网络',
    labelShootDate: '拍摄日期',
    layoutStudio: '开放式',
    layout1bedroom: '一室一厅',
    tvSmart: '智能电视',
    tvCable: '有线电视',
    internetYes: '有',
    internetNo: '无',
    unitBaht: '泰铢',
    unitSqm: '平方米',
    unitInch: '英寸'
  },
  en: {
    pageTitle: 'Photo Gallery',
    roomLabel: 'Room',
    loading: 'Loading…',
    listingTitle: 'Listing details',
    drivePreviewTitle: 'Google Drive preview',
    drivePreviewHint:
      'Tap the grid below to enlarge. For bulk download, use the button below to open in the Google app (especially on Android). If the preview is blank, make sure the folder is shared as “Anyone with the link can view”.',
    iframeTitle: 'Google Drive photo preview',
    embedFallback: 'Preview cannot be embedded. Please use the button below to open the folder.',
    openInDrive: 'Open in Google Drive',
    openInDriveHint: 'Download or save to your album from the Google page',
    emptyGallery: 'This gallery is empty',
    errorInvalidLink:
      'This link is invalid or not active yet. Common causes: changes were not saved to the server, or the link was regenerated. Ask the sender to save and share again.',
    errorNoDrive:
      'The sender has not configured a Google Drive folder link. Ask them to paste the link in the gallery and save.',
    errorLoadFailed: 'Failed to load gallery',
    labelCondo: 'Condo',
    labelBuilding: 'Building',
    labelRent: 'Rent',
    labelDeposit: 'Deposit',
    labelArea: 'Area',
    labelLayout: 'Layout',
    labelTv: 'TV',
    labelInternet: 'Internet',
    labelShootDate: 'Photo date',
    layoutStudio: 'Studio',
    layout1bedroom: '1 bedroom',
    tvSmart: 'smart tv',
    tvCable: 'cable tv',
    internetYes: 'Yes',
    internetNo: 'No',
    unitBaht: 'baht',
    unitSqm: 'sqm',
    unitInch: 'inch'
  },
  th: {
    pageTitle: 'คลังรูปภาพ',
    roomLabel: 'ห้อง',
    loading: 'กำลังโหลด…',
    listingTitle: 'รายละเอียดที่พัก',
    drivePreviewTitle: 'ตัวอย่าง Google Drive',
    drivePreviewHint:
      'แตะตารางด้านล่างเพื่อขยาย สำหรับดาวน์โหลดหลายไฟล์ ให้ใช้ปุ่มด้านล่างเปิดในแอป Google (โดยเฉพาะ Android) หากตัวอย่างว่าง ให้ตรวจสอบว่าโฟลเดอร์ตั้งค่าเป็น “ทุกคนที่มีลิงก์ดูได้”',
    iframeTitle: 'ตัวอย่างรูปภาพ Google Drive',
    embedFallback: 'ไม่สามารถฝังตัวอย่างได้ กรุณาใช้ปุ่มด้านล่างเปิดโฟลเดอร์',
    openInDrive: 'เปิดใน Google Drive',
    openInDriveHint: 'ดาวน์โหลดหรือบันทึกลงอัลบั้มได้ที่หน้า Google',
    emptyGallery: 'ยังไม่มีรูปในคลัง',
    errorInvalidLink:
      'ลิงก์ไม่ถูกต้องหรือยังไม่มีผล สาเหตุที่พบบ่อย: ยังไม่ได้กดบันทึกไปยังเซิร์ฟเวอร์ หรือลิงก์ถูกสร้างใหม่ กรุณาให้ผู้แชร์บันทึกแล้วส่งลิงก์อีกครั้ง',
    errorNoDrive:
      'ผู้แชร์ยังไม่ได้ตั้งค่าลิงก์โฟลเดอร์ Google Drive กรุณาให้วางลิงก์ในคลังแล้วบันทึก',
    errorLoadFailed: 'โหลดคลังรูปไม่สำเร็จ',
    labelCondo: 'คอนโด',
    labelBuilding: 'อาคาร',
    labelRent: 'ค่าเช่า',
    labelDeposit: 'เงินประกัน',
    labelArea: 'พื้นที่',
    labelLayout: 'แบบห้อง',
    labelTv: 'ทีวี',
    labelInternet: 'อินเทอร์เน็ต',
    labelShootDate: 'วันที่ถ่าย',
    layoutStudio: 'สตูดิโอ',
    layout1bedroom: '1 ห้องนอน',
    tvSmart: 'smart tv',
    tvCable: 'เคเบิลทีวี',
    internetYes: 'มี',
    internetNo: 'ไม่มี',
    unitBaht: 'บาท',
    unitSqm: 'ตร.ม.',
    unitInch: 'นิ้ว'
  }
};

/** @param {string} [raw] */
export function resolveGalleryShareLocale(raw) {
  const candidates = [];
  if (typeof raw === 'string' && raw.trim()) {
    candidates.push(raw.trim());
  } else if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages)) {
      candidates.push(...navigator.languages);
    }
    if (navigator.language) candidates.push(navigator.language);
  }
  for (const item of candidates) {
    const lower = String(item).toLowerCase();
    if (lower.startsWith('zh')) return 'zh';
    if (lower.startsWith('th')) return 'th';
    if (lower.startsWith('en')) return 'en';
  }
  return 'zh';
}

/** @param {'zh'|'en'|'th'} locale */
export function getGalleryShareMessages(locale) {
  const key = GALLERY_SHARE_LOCALES.includes(locale) ? locale : 'zh';
  return MESSAGES[key];
}

/** @param {'zh'|'en'|'th'} locale @param {keyof typeof MESSAGES.zh} key */
export function galleryShareT(locale, key) {
  const dict = getGalleryShareMessages(locale);
  return dict[key] ?? MESSAGES.zh[key] ?? key;
}

/**
 * 将后端中文错误映射为当前语言文案
 * @param {'zh'|'en'|'th'} locale
 * @param {string} msg
 */
export function translateGalleryShareError(locale, msg) {
  const text = String(msg || '').trim();
  if (!text) return galleryShareT(locale, 'errorLoadFailed');
  if (text.includes('链接无效') || text.includes('已失效')) {
    return galleryShareT(locale, 'errorInvalidLink');
  }
  if (text.includes('未配置 Google') || text.includes('云端硬盘')) {
    return galleryShareT(locale, 'errorNoDrive');
  }
  if (text === '加载图库失败') {
    return galleryShareT(locale, 'errorLoadFailed');
  }
  return text;
}

/** BCP 47 lang 属性 */
export function galleryShareHtmlLang(locale) {
  if (locale === 'en') return 'en';
  if (locale === 'th') return 'th';
  return 'zh-CN';
}
