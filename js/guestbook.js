// index.html 的留言板（客之聲）/ 彈幕系統。
// 留言存於 Supabase 的 comments 資料表（user_name, message, created_at）；
// 依賴 js/supabase.js 先初始化好的全域 supabaseClient。
// 用傳統 <script>（非 module）載入，才能直接用瀏覽器開啟 index.html。

const danmakuArea = document.getElementById('danmakuArea');
const trackCount = 5;
const areaH = 300;
const guestbookForm = document.getElementById('guestbookForm');
const guestNameInput = document.getElementById('guestName');
const guestMessageInput = document.getElementById('guestMessage');
const guestbookStatus = document.getElementById('guestbookStatus');
function clampText(value, maxLength) {
  return Array.from(value.trim().replace(/[\u0000-\u001f\u007f]/g, '')).slice(0, maxLength).join('');
}

async function loadGuestComments() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from('comments')
    .select('user_name, message')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Supabase load error:', error);
    return [];
  }

  return (data || [])
    .map(item => ({
      name: clampText(String(item.user_name || ''), 5),
      text: clampText(String(item.message || ''), 20),
    }))
    .filter(item => item.name && item.text);
}

async function saveGuestComment(name, text) {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return false;

  const { error } = await supabaseClient
    .from('comments')
    .insert({ user_name: name, message: text });

  if (error) {
    console.error('Supabase insert error:', error);
    return false;
  }
  return true;
}

function createDanmakuComment(comment) {
  const item = document.createElement('div');
  item.className = 'danmaku-comment';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = Array.from(comment.name)[0] || '?';

  const text = document.createElement('div');
  text.className = 'text';

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = comment.name;

  text.append(name, document.createTextNode(comment.text));
  item.append(avatar, text);
  return item;
}

async function renderDanmaku() {
  const comments = await loadGuestComments();
  danmakuArea.replaceChildren();

  if (!comments.length) {
    const empty = document.createElement('p');
    empty.className = 'guestbook-empty';
    empty.textContent = '尚無留言，搶頭香！';
    empty.style.textAlign = 'center';
    empty.style.padding = '80px 0';
    danmakuArea.appendChild(empty);
    return;
  }

  const minSlots = 20;
  const items = [];
  while (items.length < minSlots) {
    items.push(...comments);
  }
  items.length = minSlots;

  for (let t = 0; t < trackCount; t++) {
  const track = document.createElement('div');
  track.className = 'danmaku-track';
  track.style.top = (t * (areaH / trackCount) + 10) + 'px';

  const duration = 25 + Math.random() * 15;
  const direction = t % 2 === 0 ? 'danmakuL' : 'danmakuR';
  track.style.animation = `${direction} ${duration}s linear infinite`;
  track.style.animationDelay = (-Math.random() * duration) + 's';

  const perTrack = 4;
  for (let c = 0; c < perTrack * 2; c++) {
    const cm = items[(t * perTrack + c) % items.length];
    track.appendChild(createDanmakuComment(cm));
  }
  danmakuArea.appendChild(track);
  }
}

guestbookForm.addEventListener('submit', async event => {
  event.preventDefault();

  const name = clampText(guestNameInput.value, 5);
  const text = clampText(guestMessageInput.value, 20);

  if (!name || !text) {
    guestbookStatus.textContent = '請輸入 ID 與留言';
    return;
  }

  const ok = await saveGuestComment(name, text);
  guestbookStatus.textContent = ok ? '留言已送出' : '送出失敗，請稍後再試';

  if (ok) {
    guestbookForm.reset();
    await renderDanmaku();
  }
});

renderDanmaku();

const danmakuStyle = document.createElement('style');
danmakuStyle.textContent = `
@keyframes danmakuL { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
@keyframes danmakuR { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
`;
document.head.appendChild(danmakuStyle);
