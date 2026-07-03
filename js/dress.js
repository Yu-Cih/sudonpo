// dress.html 的圖片載入邏輯：頁首 Banner 主視覺 + 禮服穿搭照。
// 全部從 Supabase Storage 的 "Dress" bucket 取圖，依賴 js/supabase.js 先初始化好的全域 supabaseClient。
// 用傳統 <script>（非 module）載入，才能直接用瀏覽器開啟 dress.html。

const DRESS_BUCKET = 'Dress';
const DRESS_TTL = 60 * 60;               // 簽名網址有效 1 小時（每次載入頁面重簽）
const DRESS_BANNER_FILE = 'dress-banner.jpg';
const DRESS_DEBUG = true;                // 除錯訊息；一切正常後可改成 false

// ===== 頁首滿版 Banner（bucket 根目錄的 dress-banner.jpg）=====
async function loadDressBanner() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  const el = document.querySelector('.dress-banner');
  if (!el) return;

  const { data, error } = await supabaseClient
    .storage.from(DRESS_BUCKET).createSignedUrl(DRESS_BANNER_FILE, DRESS_TTL);
  if (error || !data || !data.signedUrl) {
    console.warn(`[Dress] banner「${DRESS_BANNER_FILE}」簽名失敗：`, error ? error.message
      : `無回傳網址（確認 bucket「${DRESS_BUCKET}」有此檔，且已給 anon 的 SELECT policy）`);
    return;
  }
  el.style.backgroundImage = `url('${data.signedUrl}')`;
  if (DRESS_DEBUG) console.log('%c[Dress]', 'color:#c9a84c', `${DRESS_BANNER_FILE} 已載入 ✓`);
}
loadDressBanner();

// ===== 禮服穿搭照（dress-1.jpg、dress-2.jpg…，依序填入現有版位）=====
async function loadDressPhotos() {
  const log = (...a) => { if (DRESS_DEBUG) console.log('%c[Dress]', 'color:#c9a84c', ...a); };

  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    console.warn('[Dress] supabaseClient 未初始化'); return;
  }
  const slots = document.querySelectorAll('#dress .dress-slot .team-photo');
  if (!slots.length) return;

  // 1) 列出 bucket 根目錄
  const { data: files, error } = await supabaseClient
    .storage.from(DRESS_BUCKET)
    .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) {
    console.error(`[Dress] list('${DRESS_BUCKET}') 失敗：`, error.message,
      '\n→ 多半是 Storage 缺少給 anon 的 SELECT policy，或 bucket 名稱大小寫不符。');
    return;
  }

  // 2) 只取 dress-<數字> 的穿搭照（排除 dress-banner），依編號數字排序
  const names = (files || [])
    .filter(f => f.id && /^dress-\d+\./i.test(f.name))
    .map(f => f.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  log(`bucket「${DRESS_BUCKET}」對到 ${names.length} 張穿搭照：`, names);

  if (!names.length) {
    console.warn('[Dress] 找不到 dress-1.jpg 這類穿搭照。'
      + `請確認檔名格式（dress-1.jpg…）、放在 bucket「${DRESS_BUCKET}」根目錄，且已給 anon 的 SELECT policy。`);
    return;
  }

  // 3) 一次簽名，依序填入現有版位（多的照片忽略、少的版位維持 placeholder）
  const { data: signed, error: signErr } = await supabaseClient
    .storage.from(DRESS_BUCKET).createSignedUrls(names, DRESS_TTL);
  if (signErr) { console.warn('[Dress] createSignedUrls 失敗：', signErr.message); return; }

  const urls = (signed || []).filter(s => s && s.signedUrl).map(s => s.signedUrl);
  if (!urls.length) { console.warn('[Dress] 沒有可用的簽名網址'); return; }

  slots.forEach((slot, i) => {
    if (!urls[i]) return;
    slot.style.backgroundImage = `url('${urls[i]}')`;
    const ph = slot.querySelector('.placeholder-text');
    if (ph) ph.style.display = 'none';
  });
  log(`已填入 ${Math.min(urls.length, slots.length)} / ${slots.length} 個版位 ✓`);
}
loadDressPhotos();
