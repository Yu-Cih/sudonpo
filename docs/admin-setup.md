# 後台（admin.html）設定清單 — Supabase GitHub OAuth + RLS

這份清單一次做完，`admin.html` 就能用你的 GitHub 帳號登入並管理 Storage / DB。
**重點觀念：真正擋住壞人的是「RLS / Storage policy」，不是「隱藏網址」。** 一定要把第 3、4 步做完，後台才安全。

---

## 步驟 0：先確認你要保護什麼

- Storage buckets：`Team`、`VIP`、`Voices`（目前 private，前台用 signed URL 讀）
- DB 資料表：`comments`（`user_name`, `message`, `created_at`）
- 目標權限：
  - 一般訪客（anon）：只能**讀**（前台 gallery/guestbook 照常運作），並保留 `comments` 的**新增**（留言板要能留言）。
  - 你本人（GitHub 登入後）：Storage 與 `comments` 的**新增 / 修改 / 刪除**全開。

---

## 步驟 1：在 GitHub 建立 OAuth App

1. 進 GitHub → Settings → Developer settings → **OAuth Apps** → **New OAuth App**。
2. 填寫：
   - **Application name**：隨意，例如 `SUDONPO Admin`
   - **Homepage URL**：你的網站首頁，例如 `https://<你的帳號>.github.io/<repo>/`
   - **Authorization callback URL**：**固定填 Supabase 的 callback**，格式為：
     ```
     https://pptlvorexginzakrbehm.supabase.co/auth/v1/callback
     ```
     （這是你 Supabase 專案的網址 + `/auth/v1/callback`，不是你的網站網址）
3. 建立後記下 **Client ID**，並按 **Generate a new client secret** 取得 **Client Secret**。

---

## 步驟 2：在 Supabase 開通 GitHub Provider

1. Supabase Dashboard → **Authentication** → **Providers** → **GitHub** → 開啟。
2. 貼上步驟 1 的 **Client ID** 與 **Client Secret**，儲存。
3. Supabase Dashboard → **Authentication** → **URL Configuration**：
   - **Site URL**：填你的網站首頁網址。
   - **Redirect URLs**：把後台頁網址加進允許清單，兩個都加（本機測試 + 正式站）：
     ```
     http://localhost:8000/admin.html
     https://<你的帳號>.github.io/<repo>/admin.html
     ```
   > 沒加進這裡，登入後會被擋在 redirect 這關。

---

## 步驟 2.5：本機測試 — 啟動 local server 與登入

> **一定要用 server 開，不能用檔案直接雙擊（`file://`）。** OAuth 會用到瀏覽器儲存的驗證票據，`file://` 沒有固定 origin，登入一定會失敗。

### 1. 在專案根目錄啟動 server

```bash
cd /到你的/bar-website        # 專案根目錄（有 admin.html 那層）
python3 -m http.server 8000   # 固定用 8000 埠，才能對上 Redirect URL
```

> `python3 -m http.server` 預設就是 8000；若你改了埠號，下面的網址和 Supabase Redirect URLs 也要一起改成相同埠。

### 2. 開後台頁

瀏覽器打開：

```
http://localhost:8000/admin.html
```

### 3. 確認 Supabase Redirect URLs 有這行（步驟 2 已設，這裡再核對一次）

Authentication → URL Configuration → **Redirect URLs** 必須**完全一致**地包含：

```
http://localhost:8000/admin.html
```

> 少一個埠、多一個斜線、用了 `127.0.0.1` 而非 `localhost` 都算不一致，登入完會被丟回 **Site URL（正式站首頁）**，並出現 `bad_oauth_state / OAuth state has expired`——因為流程「在 localhost 開始、卻在別的網域結束」，票據對不上。

### 4. 登入

1. 用**無痕視窗**開 `http://localhost:8000/admin.html`（避免舊的 OAuth state 干擾）。
2. 按「使用 GitHub 登入」→ GitHub 授權 → 正確的話會**跳回 `localhost:8000/admin.html`** 並登入成功。
3. 成功後右上角會顯示你的 email 與 **uid**，接著做步驟 3。

### 本機常見錯誤對照

| 現象 | 原因 | 解法 |
|---|---|---|
| `provider is not enabled` | Supabase 還沒開 GitHub provider | 回步驟 2 開啟並填 Client ID/Secret |
| 登入後被丟回正式站首頁 + `bad_oauth_state` | localhost 網址沒進 Redirect URLs | 依上面第 3 點加入 `http://localhost:8000/admin.html` |
| `redirect_uri mismatch` | GitHub OAuth App 的 callback 填錯 | callback 要填 Supabase 的 `/auth/v1/callback`，非你的網站 |
| 用 `file://` 開，按了沒反應 | 沒透過 server | 用 `python3 -m http.server 8000` 再從 `http://localhost:8000` 開 |

---

## 步驟 3：拿到你自己的 user id（uid）

RLS 要鎖定「只有你」，最穩的做法是綁定你的 Supabase user id。

1. 先用 `admin.html` 點一次「用 GitHub 登入」（此時 RLS 還沒設，登入本身不受影響）。
2. 登入後，頁面右上角會顯示你的 **User ID（uid）**，把它複製下來。
   （或到 Supabase Dashboard → Authentication → Users 找到你那筆，複製 `UID`。）
3. 下面所有 SQL 裡的 `YOUR-UID` 都換成這個值。

---

## 步驟 4：設定 RLS / Storage Policy（安全核心）

到 Supabase Dashboard → **SQL Editor**，把 `YOUR-UID` 換掉後整段執行。

```sql
-- ========== comments 資料表 ==========
alter table public.comments enable row level security;

-- 訪客可讀（前台彈幕）
create policy "comments public read"
  on public.comments for select
  using ( true );

-- 訪客可留言（前台留言板）
create policy "comments public insert"
  on public.comments for insert
  with check ( true );

-- 只有你能修改
create policy "comments admin update"
  on public.comments for update to authenticated
  using ( auth.uid() = 'YOUR-UID' )
  with check ( auth.uid() = 'YOUR-UID' );

-- 只有你能刪除
create policy "comments admin delete"
  on public.comments for delete to authenticated
  using ( auth.uid() = 'YOUR-UID' );


-- ========== Storage（Team / VIP / Voices）==========
-- storage.objects 預設已啟用 RLS。以下針對三個 bucket。

-- 訪客 / 前台可讀（維持現有 signed URL 讀圖）
create policy "storage public read"
  on storage.objects for select
  using ( bucket_id in ('Team','VIP','Voices') );

-- 只有你能上傳
create policy "storage admin insert"
  on storage.objects for insert to authenticated
  with check ( bucket_id in ('Team','VIP','Voices') and auth.uid() = 'YOUR-UID' );

-- 只有你能覆蓋 / 更新
create policy "storage admin update"
  on storage.objects for update to authenticated
  using ( bucket_id in ('Team','VIP','Voices') and auth.uid() = 'YOUR-UID' )
  with check ( bucket_id in ('Team','VIP','Voices') and auth.uid() = 'YOUR-UID' );

-- 只有你能刪除
create policy "storage admin delete"
  on storage.objects for delete to authenticated
  using ( bucket_id in ('Team','VIP','Voices') and auth.uid() = 'YOUR-UID' );
```

> 若你原本就手動建過「anon SELECT」policy，看到名稱衝突可先刪舊的，或把上面對應那條改名。
> 重點是每個 bucket / 表對 select 都要有「讀」的 policy，否則前台會壞掉。

---

## 步驟 5：把 uid 填進 admin.html（可選但建議）

`admin.html` 最上面有一個設定：

```js
const ALLOWED_UIDS = []; // ← 填入你的 uid，例如 ['xxxxxxxx-....']
```

- 填了之後：非你本人登入 → 前端直接顯示「無權限」並登出（UX 提示）。
- **就算不填也沒關係**，因為第 4 步的 RLS 才是真正的門鎖；填它只是讓畫面更早擋下來。

---

## 步驟 6：驗收（很重要）

1. **登入成功**：用 GitHub 登入 `admin.html`，能看到 Storage / DB 內容。
2. **能改**：試著上傳一張圖、刪一筆留言，成功。
3. **RLS 真的有效（關鍵測試）**：開一個**沒登入**的無痕視窗，到前台留言板留言應該**成功**（anon insert 開著），但任何刪除 / 上傳的嘗試應該**失敗**。
   - 更嚴謹：登出後在 console 直接呼叫 `supabaseClient.from('comments').delete()...`，應回傳權限錯誤。若能刪掉 → RLS 沒設對，回去檢查第 4 步。

---

## 常見問題

- **登入後跳回首頁而不是後台**：檢查步驟 2 的 Redirect URLs 有沒有把 `admin.html` 那兩行加進去。
- **callback 錯誤 redirect_uri mismatch**：步驟 1 的 callback URL 必須是 Supabase 的 `/auth/v1/callback`，不是你的網站。
- **前台圖片 / 留言消失**：多半是漏掉「public read / public insert」那幾條 select/insert policy。
