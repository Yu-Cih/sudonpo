// Supabase 用戶端初始化：供 index.html 的 gallery.js / guestbook.js 共用。
// 用傳統 <script>（非 module）載入，必須排在 supabase CDN 之後、
// gallery.js / guestbook.js 之前。publishable（anon）key 本就是公開金鑰。
const supabaseClient = supabase.createClient(
  'https://pptlvorexginzakrbehm.supabase.co',
  'sb_publishable_qYEycFbdpPUNwh4DPG0GlQ_XbxCNDVI'
);
