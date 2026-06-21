// 複製此檔案為 config.local.js，填入你的 Supabase 憑證
// cp js/config.example.js js/config.local.js

window.supabaseClient = supabase.createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
);
