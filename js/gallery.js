// index.html 的圖片載入邏輯：店員輪播、本週 VIP、微醺瞬拍。
// 全部從 Supabase Storage 取圖，依賴 js/supabase.js 先初始化好的全域 supabaseClient。
// 用傳統 <script>（非 module）載入，才能直接用瀏覽器開啟 index.html。

// ===== Team member photo carousels =====
// (Re)initialise a carousel for whatever .member-slide elements it currently holds.
function initCarousel(carousel) {
  const track = carousel.querySelector('.member-carousel-track');
  const slides = carousel.querySelectorAll('.member-slide');
  const dotsWrap = carousel.querySelector('.member-carousel-dots');
  const prevBtn = carousel.querySelector('.prev');
  const nextBtn = carousel.querySelector('.next');
  if (!track || slides.length === 0) return;

  let index = 0;
  dotsWrap.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('span');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });
  const dots = dotsWrap.querySelectorAll('span');

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, di) => d.classList.toggle('active', di === index));
  }
  goTo(0);

  // assign (not addEventListener) so re-init never stacks duplicate handlers
  prevBtn.onclick = () => goTo(index - 1);
  nextBtn.onclick = () => goTo(index + 1);

  // Hide nav controls when there is only one photo
  const multi = slides.length > 1;
  carousel.querySelectorAll('.member-carousel-btn, .member-carousel-dots')
    .forEach(el => el.style.display = multi ? '' : 'none');
}

// Init placeholders immediately so controls are correct before Supabase responds.
document.querySelectorAll('[data-carousel]').forEach(initCarousel);

// ===== Load each member's photos from Supabase Storage =====
// Bucket "Team" is private + flat; files are named "<prefix>-1.jpg", "<prefix>-2.jpg"…
// Each .team-member carries data-prefix; we list once, filter by prefix, sign URLs.
const TEAM_BUCKET = 'Team';
const TEAM_URL_TTL = 60 * 60; // signed URL valid for 1 hour (per page load)
const TEAM_DEBUG = true;      // 除錯訊息；一切正常後可改成 false

// 從 supabase Storage 讀取每位店員的照片，並依照 data-prefix 填入對應的 carousel
async function loadTeamPhotos() {
  const log = (...a) => { if (TEAM_DEBUG) console.log('%c[Team]', 'color:#c9a84c', ...a); };

  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    console.warn('[Team] supabaseClient 未初始化'); return;
  }
  const members = document.querySelectorAll('.team-member[data-prefix]');
  log(`找到 ${members.length} 位有 data-prefix 的店員`);
  if (!members.length) return;

  // 1) 列出 bucket 根目錄
  const { data: files, error } = await supabaseClient
    .storage.from(TEAM_BUCKET)
    .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

  if (error) {
    console.error(`[Team] list('${TEAM_BUCKET}') 失敗：`, error.message,
      '\n→ 多半是 Storage 缺少給 anon 的 SELECT policy，或 bucket 名稱大小寫不符。');
    return;
  }

  const entries = files || [];
  log(`bucket「${TEAM_BUCKET}」根目錄共 ${entries.length} 筆：`, entries.map(f => f.name));

  if (entries.length === 0) {
    console.warn('[Team] list 成功但回傳 0 筆。常見原因：'
      + '\n① Storage 缺少 anon 的 SELECT policy（list 會回空陣列而非報錯）'
      + '\n② 檔案其實放在子資料夾，根目錄沒有檔案'
      + `\n③ bucket 名稱大小寫不符（目前用「${TEAM_BUCKET}」）`);
  }
  // Supabase 把「資料夾」也列出來，其 id 為 null
  const folders = entries.filter(f => !f.id);
  if (folders.length) {
    console.warn('[Team] 偵測到子資料夾（非平鋪）：', folders.map(f => f.name),
      '\n→ 若照片放在資料夾內，需改用 list(\'資料夾名\') 或把檔案改放根目錄。');
  }
  const allNames = entries.filter(f => f.id).map(f => f.name).filter(n => !n.startsWith('.'));

  // 2) 每位店員依 prefix 比對 → 簽名 → 塞圖
  for (const member of members) {
    const prefix = (member.dataset.prefix || '').trim();
    const name = (member.querySelector('.team-name') || {}).textContent || '(無名)';
    const carousel = member.querySelector('[data-carousel]');
    if (!prefix) { log(`「${name}」尚未設定 data-prefix，略過`); continue; }
    if (!carousel) continue;

    const names = allNames
      .filter(n => n.startsWith(prefix + '-'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    log(`「${name}」prefix="${prefix}" → 對到 ${names.length} 張：`, names);

    if (!names.length) {
      console.warn(`[Team]「${name}」prefix="${prefix}" 對不到任何檔案。`
        + `請確認檔名是「${prefix}-1.jpg」這種格式、且放在 bucket 根目錄。`);
      continue;
    }

    const { data: signed, error: signErr } = await supabaseClient
      .storage.from(TEAM_BUCKET)
      .createSignedUrls(names, TEAM_URL_TTL);
    if (signErr) {
      console.error(`[Team]「${name}」createSignedUrls 失敗：`, signErr.message); continue;
    }
    const failed = (signed || []).filter(s => s.error);
    if (failed.length) console.warn('[Team] 部分檔案簽名失敗：', failed);

    const urls = (signed || []).filter(s => s && s.signedUrl).map(s => s.signedUrl);
    if (!urls.length) { console.warn(`[Team]「${name}」沒有可用的簽名網址`); continue; }

    carousel.querySelector('.member-carousel-track').innerHTML = urls
      .map(u => `<div class="member-slide" style="background-image:url('${u}')"></div>`)
      .join('');
    initCarousel(carousel);
    log(`「${name}」已載入 ${urls.length} 張 ✓`);
  }
}
loadTeamPhotos();

// ===== Weekly VIP photo (Supabase Storage, bucket "VIP", single file "vip.png") =====
async function loadVipPhoto() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  const el = document.getElementById('vipPhoto');
  if (!el) return;

  const { data, error } = await supabaseClient
    .storage.from('VIP').createSignedUrl('vip.png', 60 * 60);
  if (error || !data || !data.signedUrl) {
    console.warn('[VIP] 取得 vip.png 簽名失敗：', error ? error.message
      : '無回傳網址（確認 bucket「VIP」有 vip.png，且已給 anon 的 SELECT policy）');
    return;
  }

  el.style.backgroundImage = `url('${data.signedUrl}')`;
  const ph = el.querySelector('.placeholder-text');
  if (ph) ph.style.display = 'none';
  console.log('%c[VIP]', 'color:#c9a84c', 'vip.png 已載入 ✓');
}
loadVipPhoto();

// ===== Tipsy Moment / 微醺瞬拍 gallery (Supabase Storage, bucket "Voices") =====
const VOICES_BUCKET = 'Voices';
const VOICES_PREFIX = 'voices';  // 檔名前綴（voices-1.jpg…）；若整個 bucket 都屬此區可設為 ''
const VOICES_TTL = 60 * 60;

async function loadVoicesPhotos() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  const grid = document.querySelector('#voice_photos .photo-grid');
  if (!grid) return;

  // 前端顯示上限 = 目前 grid 內的版位數（要調整就增減 HTML 裡的 .photo-cell）
  const limit = grid.querySelectorAll('.photo-cell').length || 9;

  const { data: files, error } = await supabaseClient
    .storage.from(VOICES_BUCKET)
    .list('', { limit: 1000, sortBy: { column: 'updated_at', order: 'desc' } });
  if (error) {
    console.warn('[Voices] list 失敗：', error.message,
      '（確認 bucket「Voices」存在且已給 anon 的 SELECT policy）');
    return;
  }

  const photos = (files || [])
    .filter(f => f.id && (!VOICES_PREFIX || f.name.startsWith(VOICES_PREFIX + '-')))
    // 依 Last modified（updated_at）由新到舊；超過上限時只取最新的 N 張
    .sort((a, b) =>
      new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
    .slice(0, limit);

  console.log('%c[Voices]', 'color:#c9a84c',
    `bucket 共 ${(files || []).length} 筆，對到 ${photos.length} 張（上限 ${limit}）：`,
    photos.map(p => p.name));
  if (!photos.length) return;

  const names = photos.map(p => p.name);
  const { data: signed, error: signErr } = await supabaseClient
    .storage.from(VOICES_BUCKET).createSignedUrls(names, VOICES_TTL);
  if (signErr) { console.warn('[Voices] 簽名失敗：', signErr.message); return; }

  // createSignedUrls 會依傳入順序回傳，所以維持「最新在前」
  const urls = (signed || []).filter(s => s && s.signedUrl).map(s => s.signedUrl);
  if (!urls.length) return;

  grid.innerHTML = urls
    .map(u => `<div class="photo-cell image-slot" style="background-image:url('${u}')"></div>`)
    .join('');
  console.log('%c[Voices]', 'color:#c9a84c', `已載入 ${urls.length} 張 ✓`);
}
loadVoicesPhotos();
