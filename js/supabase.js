// Supabase 用戶端初始化：供前台頁面（index.html 的 gallery.js / guestbook.js、
// dress.html 的 dress.js）共用。用傳統 <script>（非 module）載入，必須排在
// supabase CDN 之後、各頁自己的 script 之前。publishable（anon）key 本就是公開金鑰。
//
// persistSession: false —— 前台一律以 anon 身分存取。admin.html 登入後，
// supabase-js 會把 session 寫進 localStorage，且預設 storageKey 只跟專案 ref 有關
// （sb-<ref>-auth-token），因此同一個 origin 的前台會自動撈回那個 session，
// 改以 authenticated JWT 送出請求。若 Storage / 資料表的 SELECT policy 是給 anon 的，
// 登入後前台就會被 RLS 擋掉（Storage 會偽裝成 404 not_found，難以察覺）。
// 關掉持久化後 client 改用 memory storage、不讀 localStorage，前台便與後台登入狀態隔離。
// 前台沒有任何功能需要登入身分，故一併關掉 token 續期與 OAuth 網址解析。
const supabaseClient = supabase.createClient(
  'https://pptlvorexginzakrbehm.supabase.co',
  'sb_publishable_qYEycFbdpPUNwh4DPG0GlQ_XbxCNDVI',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
