-- ============================================================
--  分組點名 · 雲端同步（全團共用）
--  貼到「同一個」Supabase 專案的 SQL Editor 執行即可。
--  單檔 App 與 Next.js 平台版都用這張表。
-- ============================================================

create table if not exists rosters (
  code text primary key,                 -- 團隊代碼（全團一致，請取不易猜到的字串）
  data jsonb not null default '[]'::jsonb,-- 名單：[{n:姓名, g:組別, p:是否到齊}]
  updated_at timestamptz default now()
);

alter table rosters enable row level security;

-- 以「團隊代碼」共用：anon 可讀寫。
-- 注意：anon key 會放在前端、屬半公開；請務必用不易猜到的團隊代碼當作密碼。
drop policy if exists "roster read"   on rosters;
create policy "roster read"   on rosters for select using (true);
drop policy if exists "roster insert" on rosters;
create policy "roster insert" on rosters for insert with check (true);
drop policy if exists "roster update" on rosters;
create policy "roster update" on rosters for update using (true);

-- 若日後要更嚴格：改用 Supabase Edge Function 或 RPC 驗證代碼後再寫入。
