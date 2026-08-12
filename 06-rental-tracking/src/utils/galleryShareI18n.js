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
    saveAll: '保存全部图片',
    savingAll: '准备中…',
    openInBrowser: '用系统浏览器打开',
    openInBrowserBusy: '正在尝试打开…',
    copyPageLink: '复制本页链接',
    copyPageLinkDone: '链接已复制，请粘贴到 Safari / Chrome 打开',
    copyPageLinkFailed: '复制失败，请手动长按地址栏复制链接',
    inAppBannerTitle: '当前在 {app} 内打开',
    inAppBannerBody:
      '微信 / LINE 等内置浏览器通常无法保存全部图片。请用手机自带浏览器（Safari / Chrome）打开本页后再点「保存全部图片」。',
    inAppHowToIos: 'iPhone：点右上角「⋯」→ 选择「在 Safari 中打开」或「在浏览器中打开」。',
    inAppHowToAndroid: 'Android：可点下方按钮尝试用 Chrome 打开；若无反应，点右上角「⋯」→「在浏览器中打开」。',
    inAppSaveBlocked:
      '当前 App 内置浏览器无法完成保存。请先用系统浏览器打开本页，再点「保存全部图片」。',
    saveAllHint:
      '手机：准备完成后点「保存到相册」，在系统分享里选存储到相册或分享到其它 App。若在微信 / LINE 内打开，请先用系统浏览器打开本页。电脑无分享时会逐张下载到浏览器下载目录。',
    savePreparing: '准备中…',
    prepareProgress: '正在准备 {cur}/{total}…',
    prepareReadyShare: '准备完成，请点「保存到相册」',
    prepareReadyDownload: '本浏览器不支持系统分享，已改为逐张下载',
    readyCountLabel: '已准备 {n} 张',
    saveToAlbum: '保存到相册 / 分享',
    downloadToFiles: '存到下载目录',
    albumVsDownloadHint: '在系统面板中选择「存储到相册」，或分享到微信等 App。',
    sharingHint: '请在系统面板选择保存或分享…',
    sharingBusy: '打开分享中…',
    shareBatchProgress: '第 {cur}/{total} 批分享…',
    shareUnsupported: '系统不支持文件分享，请逐张下载或长按图片保存',
    downloadToFilesHint: '正在触发浏览器下载…',
    saveProgress: '正在下载 {cur}/{total}…',
    saveDoneShare: '已打开系统分享',
    saveDoneSequential: '已触发浏览器下载',
    saveFailed: '保存失败，请尝试逐张下载或长按图片保存',
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
    saveAll: 'Save all photos',
    savingAll: 'Preparing…',
    openInBrowser: 'Open in system browser',
    openInBrowserBusy: 'Trying to open…',
    copyPageLink: 'Copy page link',
    copyPageLinkDone: 'Link copied — paste into Safari / Chrome',
    copyPageLinkFailed: 'Could not copy. Long-press the address bar to copy the link.',
    inAppBannerTitle: 'Opened inside {app}',
    inAppBannerBody:
      'In-app browsers (WeChat, LINE, etc.) usually cannot save all photos. Open this page in Safari or Chrome, then tap “Save all photos”.',
    inAppHowToIos: 'iPhone: tap ⋯ at the top right → “Open in Safari” / “Open in Browser”.',
    inAppHowToAndroid:
      'Android: try the button below to open Chrome. If nothing happens, tap ⋯ → “Open in browser”.',
    inAppSaveBlocked:
      'This in-app browser cannot finish saving. Open this page in your system browser first, then tap “Save all photos”.',
    saveAllHint:
      'On phone: after preparing, tap “Save to Photos / Share” and choose the album or another app. If you opened this in WeChat / LINE, switch to Safari or Chrome first. On desktop without share, photos download one by one.',
    savePreparing: 'Preparing…',
    prepareProgress: 'Preparing {cur}/{total}…',
    prepareReadyShare: 'Ready — tap “Save to Photos / Share”',
    prepareReadyDownload: 'Sharing unavailable; started browser downloads',
    readyCountLabel: '{n} photos ready',
    saveToAlbum: 'Save to Photos / Share',
    downloadToFiles: 'Save to Downloads',
    albumVsDownloadHint: 'In the system sheet, choose Save to Photos or share to an app.',
    sharingHint: 'Choose save or share in the system sheet…',
    sharingBusy: 'Opening share…',
    shareBatchProgress: 'Sharing batch {cur}/{total}…',
    shareUnsupported: 'File sharing is unavailable. Download one by one or long-press a photo.',
    downloadToFilesHint: 'Starting browser downloads…',
    saveProgress: 'Downloading {cur}/{total}…',
    saveDoneShare: 'Share sheet opened',
    saveDoneSequential: 'Browser downloads started',
    saveFailed: 'Save failed. Try downloading one by one or long-press a photo.',
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
    saveAll: 'บันทึกรูปทั้งหมด',
    savingAll: 'กำลังเตรียม…',
    openInBrowser: 'เปิดในเบราว์เซอร์ของเครื่อง',
    openInBrowserBusy: 'กำลังพยายามเปิด…',
    copyPageLink: 'คัดลอกลิงก์หน้านี้',
    copyPageLinkDone: 'คัดลอกลิงก์แล้ว — วางใน Safari / Chrome',
    copyPageLinkFailed: 'คัดลอกไม่สำเร็จ กดค้างที่แถบที่อยู่เพื่อคัดลอกลิงก์',
    inAppBannerTitle: 'เปิดอยู่ใน {app}',
    inAppBannerBody:
      'เบราว์เซอร์ในแอป (WeChat / LINE ฯลฯ) มักบันทึกรูปทั้งหมดไม่ได้ กรุณาเปิดหน้านี้ใน Safari หรือ Chrome แล้วกด「บันทึกรูปทั้งหมด」',
    inAppHowToIos: 'iPhone: กด ⋯ มุมขวาบน →「เปิดใน Safari」/「เปิดในเบราว์เซอร์」',
    inAppHowToAndroid:
      'Android: ลองปุ่มด้านล่างเพื่อเปิด Chrome หากไม่ตอบสนอง กด ⋯ →「เปิดในเบราว์เซอร์」',
    inAppSaveBlocked:
      'เบราว์เซอร์ในแอปนี้บันทึกไม่ได้ กรุณาเปิดหน้านี้ในเบราว์เซอร์ของเครื่องก่อน แล้วกด「บันทึกรูปทั้งหมด」',
    saveAllHint:
      'มือถือ: หลังเตรียมแล้ว กด「บันทึก/แชร์」แล้วเลือกอัลบั้มหรือแอปอื่น หากเปิดใน WeChat / LINE ให้เปิดด้วย Safari หรือ Chrome ก่อน คอมพิวเตอร์ที่แชร์ไม่ได้จะดาวน์โหลดทีละรูป',
    savePreparing: 'กำลังเตรียม…',
    prepareProgress: 'กำลังเตรียม {cur}/{total}…',
    prepareReadyShare: 'พร้อมแล้ว — กด「บันทึก/แชร์」',
    prepareReadyDownload: 'แชร์ไม่ได้ เริ่มดาวน์โหลดในเบราว์เซอร์แล้ว',
    readyCountLabel: 'เตรียมแล้ว {n} รูป',
    saveToAlbum: 'บันทึกลงอัลบั้ม / แชร์',
    downloadToFiles: 'บันทึกลงดาวน์โหลด',
    albumVsDownloadHint: 'ในแผงระบบ เลือกบันทึกลงอัลบั้ม หรือแชร์ไปแอป',
    sharingHint: 'เลือกบันทึกหรือแชร์ในแผงระบบ…',
    sharingBusy: 'กำลังเปิดแชร์…',
    shareBatchProgress: 'แชร์ชุดที่ {cur}/{total}…',
    shareUnsupported: 'แชร์ไฟล์ไม่ได้ กรุณาดาวน์โหลดทีละรูป หรือกดค้างที่รูป',
    downloadToFilesHint: 'กำลังเริ่มดาวน์โหลด…',
    saveProgress: 'กำลังดาวน์โหลด {cur}/{total}…',
    saveDoneShare: 'เปิดแผงแชร์แล้ว',
    saveDoneSequential: 'เริ่มดาวน์โหลดในเบราว์เซอร์แล้ว',
    saveFailed: 'บันทึกไม่สำเร็จ ลองดาวน์โหลดทีละรูป หรือกดค้างที่รูป',
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
