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
    downloadToPhone: '下载到手机',
    downloadingAll: '下载中…',
    prepareShare: '准备分享',
    preparingShare: '准备中…',
    shareToApp: '分享到应用',
    openInBrowser: '用系统浏览器打开',
    openInBrowserBusy: '正在尝试打开…',
    copyPageLink: '复制本页链接',
    copyPageLinkDone: '链接已复制，请粘贴到 Safari / Chrome 打开',
    copyPageLinkFailed: '复制失败，请手动长按地址栏复制链接',
    inAppBannerTitle: '当前在 {app} 内打开',
    inAppBannerBody:
      '微信 / LINE 等内置浏览器通常无法下载或分享图片。请用手机自带浏览器（Safari / Chrome）打开本页后再操作。',
    inAppHowToIos: 'iPhone：点右上角「⋯」→ 选择「在 Safari 中打开」或「在浏览器中打开」。',
    inAppHowToAndroid: 'Android：可点下方按钮尝试用 Chrome 打开；若无反应，点右上角「⋯」→「在浏览器中打开」。',
    inAppSaveBlocked:
      '当前 App 内置浏览器无法完成下载/分享。请先用系统浏览器打开本页，再点「下载到手机」或「分享到应用」。',
    actionsHint:
      '「下载到手机」会一次性下载全部图片（与单张「下载」相同方式）。「分享到应用」需点两次：第一次准备文件，准备完成后再点一次打开系统分享。微信 / LINE 内请先用系统浏览器打开。',
    savePreparing: '准备中…',
    prepareProgress: '正在准备 {cur}/{total}…',
    prepareReadyShare: '准备完成，请点「分享到应用」',
    readyCountLabel: '已准备 {n} 张',
    shareToAppHint: '在系统面板中选择要分享到的 App。',
    sharingHint: '请在系统面板选择要分享的应用…',
    sharingBusy: '打开分享中…',
    shareBatchProgress: '第 {cur}/{total} 批分享…',
    shareUnsupported: '系统不支持文件分享，请改用「下载到手机」或长按图片保存',
    saveProgress: '正在下载 {cur}/{total}…',
    saveDoneShare: '已打开系统分享',
    saveDoneSequential: '已开始下载全部图片',
    saveFailed: '操作失败，请尝试单张下载或长按图片保存',
    downloadOne: '下载',
    downloadFailed: '下载失败，请长按图片保存',
    capturedLabel: '拍摄',
    photoAlt: '图片',
    emptyGallery: '图库暂无内容',
    errorInvalidLink:
      '链接无效或尚未生效。常见原因：上传/分享后还没有点「保存到服务器」，或链接已被重新生成。请让分享方保存后再发链接。',
    errorNoPhotos: '该图库目前没有图片，请让分享方重新上传并保存。',
    errorLoadFailed: '加载图库失败',
    labelCondo: '公寓',
    labelBuilding: '楼栋',
    labelOccupancy: '出租状态',
    occupancyRented: '已出租',
    occupancyVacant: '未出租',
    labelRent: '租金',
    labelDeposit: '押金',
    labelArea: '面积',
    labelLayout: '户型',
    labelElectricFee: '电费',
    labelWaterFee: '水费',
    labelTv: '电视',
    labelInternet: '网络',
    labelDoorAccess: '门禁',
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
    downloadToPhone: 'Download to phone',
    downloadingAll: 'Downloading…',
    prepareShare: 'Prepare to share',
    preparingShare: 'Preparing…',
    shareToApp: 'Share to app',
    openInBrowser: 'Open in system browser',
    openInBrowserBusy: 'Trying to open…',
    copyPageLink: 'Copy page link',
    copyPageLinkDone: 'Link copied — paste into Safari / Chrome',
    copyPageLinkFailed: 'Could not copy. Long-press the address bar to copy the link.',
    inAppBannerTitle: 'Opened inside {app}',
    inAppBannerBody:
      'In-app browsers (WeChat, LINE, etc.) usually cannot download or share photos. Open this page in Safari or Chrome first.',
    inAppHowToIos: 'iPhone: tap ⋯ at the top right → “Open in Safari” / “Open in Browser”.',
    inAppHowToAndroid:
      'Android: try the button below to open Chrome. If nothing happens, tap ⋯ → “Open in browser”.',
    inAppSaveBlocked:
      'This in-app browser cannot download or share. Open this page in your system browser, then tap “Download to phone” or “Share to app”.',
    actionsHint:
      '“Download to phone” downloads all photos at once (same as each photo’s Download). “Share to app” needs two taps: first prepares files, then tap again to open the system share sheet. In WeChat / LINE, open in the system browser first.',
    savePreparing: 'Preparing…',
    prepareProgress: 'Preparing {cur}/{total}…',
    prepareReadyShare: 'Ready — tap “Share to app”',
    readyCountLabel: '{n} photos ready',
    shareToAppHint: 'Choose the app you want in the system share sheet.',
    sharingHint: 'Choose an app in the system share sheet…',
    sharingBusy: 'Opening share…',
    shareBatchProgress: 'Sharing batch {cur}/{total}…',
    shareUnsupported: 'File sharing is unavailable. Use “Download to phone” or long-press a photo.',
    saveProgress: 'Downloading {cur}/{total}…',
    saveDoneShare: 'Share sheet opened',
    saveDoneSequential: 'Started downloading all photos',
    saveFailed: 'Something went wrong. Try downloading one photo or long-press to save.',
    downloadOne: 'Download',
    downloadFailed: 'Download failed. Long-press the photo to save.',
    capturedLabel: 'Taken',
    photoAlt: 'Photo',
    emptyGallery: 'This gallery is empty',
    errorInvalidLink:
      'This link is invalid or not active yet. Common causes: changes were not saved to the server, or the link was regenerated. Ask the sender to save and share again.',
    errorNoPhotos: 'This gallery has no photos yet. Ask the sender to upload and save again.',
    errorLoadFailed: 'Failed to load gallery',
    labelCondo: 'Condo',
    labelBuilding: 'Building',
    labelOccupancy: 'Status',
    occupancyRented: 'Rented',
    occupancyVacant: 'Vacant',
    labelRent: 'Rent',
    labelDeposit: 'Deposit',
    labelArea: 'Area',
    labelLayout: 'Layout',
    labelElectricFee: 'Electricity',
    labelWaterFee: 'Water',
    labelTv: 'TV',
    labelInternet: 'Internet',
    labelDoorAccess: 'Access',
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
    downloadToPhone: 'ดาวน์โหลดลงมือถือ',
    downloadingAll: 'กำลังดาวน์โหลด…',
    prepareShare: 'เตรียมแชร์',
    preparingShare: 'กำลังเตรียม…',
    shareToApp: 'แชร์ไปแอป',
    openInBrowser: 'เปิดในเบราว์เซอร์ของเครื่อง',
    openInBrowserBusy: 'กำลังพยายามเปิด…',
    copyPageLink: 'คัดลอกลิงก์หน้านี้',
    copyPageLinkDone: 'คัดลอกลิงก์แล้ว — วางใน Safari / Chrome',
    copyPageLinkFailed: 'คัดลอกไม่สำเร็จ กดค้างที่แถบที่อยู่เพื่อคัดลอกลิงก์',
    inAppBannerTitle: 'เปิดอยู่ใน {app}',
    inAppBannerBody:
      'เบราว์เซอร์ในแอป (WeChat / LINE ฯลฯ) มักดาวน์โหลดหรือแชร์รูปไม่ได้ กรุณาเปิดหน้านี้ใน Safari หรือ Chrome ก่อน',
    inAppHowToIos: 'iPhone: กด ⋯ มุมขวาบน →「เปิดใน Safari」/「เปิดในเบราว์เซอร์」',
    inAppHowToAndroid:
      'Android: ลองปุ่มด้านล่างเพื่อเปิด Chrome หากไม่ตอบสนอง กด ⋯ →「เปิดในเบราว์เซอร์」',
    inAppSaveBlocked:
      'เบราว์เซอร์ในแอปนี้ดาวน์โหลด/แชร์ไม่ได้ กรุณาเปิดหน้านี้ในเบราว์เซอร์ของเครื่องก่อน แล้วกด「ดาวน์โหลดลงมือถือ」หรือ「แชร์ไปแอป」',
    actionsHint:
      '「ดาวน์โหลดลงมือถือ」จะดาวน์โหลดรูปทั้งหมดในครั้งเดียว (เหมือนปุ่มดาวน์โหลดทีละรูป) 「แชร์ไปแอป」ต้องกดสองครั้ง: ครั้งแรกเตรียมไฟล์ พร้อมแล้วกดอีกครั้งเพื่อเปิดแผงแชร์ หากเปิดใน WeChat / LINE ให้เปิดด้วยเบราว์เซอร์ของเครื่องก่อน',
    savePreparing: 'กำลังเตรียม…',
    prepareProgress: 'กำลังเตรียม {cur}/{total}…',
    prepareReadyShare: 'พร้อมแล้ว — กด「แชร์ไปแอป」',
    readyCountLabel: 'เตรียมแล้ว {n} รูป',
    shareToAppHint: 'ในแผงระบบ เลือกแอปที่ต้องการแชร์',
    sharingHint: 'เลือกแอปในแผงแชร์ของระบบ…',
    sharingBusy: 'กำลังเปิดแชร์…',
    shareBatchProgress: 'แชร์ชุดที่ {cur}/{total}…',
    shareUnsupported: 'แชร์ไฟล์ไม่ได้ กรุณาใช้「ดาวน์โหลดลงมือถือ」หรือกดค้างที่รูป',
    saveProgress: 'กำลังดาวน์โหลด {cur}/{total}…',
    saveDoneShare: 'เปิดแผงแชร์แล้ว',
    saveDoneSequential: 'เริ่มดาวน์โหลดรูปทั้งหมดแล้ว',
    saveFailed: 'ไม่สำเร็จ ลองดาวน์โหลดทีละรูป หรือกดค้างที่รูป',
    downloadOne: 'ดาวน์โหลด',
    downloadFailed: 'ดาวน์โหลดไม่สำเร็จ กรุณากดค้างที่รูปเพื่อบันทึก',
    capturedLabel: 'ถ่ายเมื่อ',
    photoAlt: 'รูป',
    emptyGallery: 'ยังไม่มีรูปในคลัง',
    errorInvalidLink:
      'ลิงก์ไม่ถูกต้องหรือยังไม่มีผล สาเหตุที่พบบ่อย: ยังไม่ได้กดบันทึกไปยังเซิร์ฟเวอร์ หรือลิงก์ถูกสร้างใหม่ กรุณาให้ผู้แชร์บันทึกแล้วส่งลิงก์อีกครั้ง',
    errorNoPhotos: 'คลังนี้ยังไม่มีรูป กรุณาให้ผู้แชร์อัปโหลดแล้วบันทึกอีกครั้ง',
    errorLoadFailed: 'โหลดคลังรูปไม่สำเร็จ',
    labelCondo: 'คอนโด',
    labelBuilding: 'อาคาร',
    labelOccupancy: 'สถานะ',
    occupancyRented: 'ปล่อยเช่าแล้ว',
    occupancyVacant: 'ยังไม่ปล่อยเช่า',
    labelRent: 'ค่าเช่า',
    labelDeposit: 'เงินประกัน',
    labelArea: 'พื้นที่',
    labelLayout: 'แบบห้อง',
    labelElectricFee: 'ค่าไฟ',
    labelWaterFee: 'ค่าน้ำ',
    labelTv: 'ทีวี',
    labelInternet: 'อินเทอร์เน็ต',
    labelDoorAccess: 'คีย์การ์ด',
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
  if (text.includes('图库暂无图片') || text.includes('图库暂无内容') || text.includes('没有图片')) {
    return galleryShareT(locale, 'errorNoPhotos');
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
