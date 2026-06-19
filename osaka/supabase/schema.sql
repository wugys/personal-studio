-- ============================================================
--  AI 智慧旅遊管家 · Supabase Schema (MVP)
--  在 Supabase → SQL Editor 貼上整段執行即可。
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  subtitle text,
  start_date date,
  end_date date,
  leader_name text,
  leader_phone_tw text,
  leader_phone_jp text,
  agency_name text,
  agency_contacts jsonb default '[]'::jsonb,
  meet_info text,
  outbound text,
  inbound text,
  hotel_name text,
  hotel_address text,
  hotel_phone text,
  weather_note text,
  fx_rate numeric default 0.21,
  notes text,
  is_public boolean default true,
  created_at timestamptz default now()
);

create table if not exists trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  day_no int not null,
  date date,
  weekday text,
  theme text,
  guide_message text,
  quick jsonb default '[]'::jsonb,
  sort int default 0,
  unique (trip_id, day_no)
);

create table if not exists spots (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references trip_days(id) on delete cascade,
  idx int not null,
  name text not null,
  type text,
  lat double precision,
  lng double precision,
  feature text,
  eat text,
  play text,
  buy text,
  tip text,
  videos jsonb default '[]'::jsonb,
  sort int default 0
);

create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  category text,
  question text not null,
  answer text not null,
  sort int default 0
);

create table if not exists phrases (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  category text,
  jp text not null,
  romaji text,
  zh text,
  is_emergency boolean default false,
  sort int default 0
);

create table if not exists emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  label text not null,
  phone text,
  note text,
  sort int default 0
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

-- ---------- Row Level Security ----------
alter table trips enable row level security;
alter table trip_days enable row level security;
alter table spots enable row level security;
alter table faqs enable row level security;
alter table phrases enable row level security;
alter table emergency_contacts enable row level security;
alter table profiles enable row level security;

drop policy if exists "public read trips" on trips;
create policy "public read trips" on trips for select using (is_public = true);

drop policy if exists "public read days" on trip_days;
create policy "public read days" on trip_days for select using (
  exists (select 1 from trips t where t.id = trip_days.trip_id and t.is_public = true));

drop policy if exists "public read spots" on spots;
create policy "public read spots" on spots for select using (
  exists (select 1 from trip_days d join trips t on t.id = d.trip_id
          where d.id = spots.day_id and t.is_public = true));

drop policy if exists "public read faqs" on faqs;
create policy "public read faqs" on faqs for select using (
  trip_id is null or exists (select 1 from trips t where t.id = faqs.trip_id and t.is_public = true));

drop policy if exists "public read phrases" on phrases;
create policy "public read phrases" on phrases for select using (
  trip_id is null or exists (select 1 from trips t where t.id = phrases.trip_id and t.is_public = true));

drop policy if exists "public read emergency" on emergency_contacts;
create policy "public read emergency" on emergency_contacts for select using (
  exists (select 1 from trips t where t.id = emergency_contacts.trip_id and t.is_public = true));

drop policy if exists "own profile read" on profiles;
create policy "own profile read" on profiles for select using (auth.uid() = id);
drop policy if exists "own profile insert" on profiles;
create policy "own profile insert" on profiles for insert with check (auth.uid() = id);
drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles for update using (auth.uid() = id);
-- 內容資料的寫入請用 Supabase 後台（service_role 會略過 RLS）。


-- ============================================================
--  種子資料 (Seed) — 只在尚未匯入時執行，可重複貼上
-- ============================================================
do $$
begin
if not exists (select 1 from trips where code = 'KIX6D70619A5') then
  insert into trips (code, title, subtitle, start_date, end_date, leader_name, leader_phone_tw, leader_phone_jp, agency_name, agency_contacts, meet_info, outbound, inbound, hotel_name, hotel_address, hotel_phone, weather_note, fx_rate) values ('KIX6D70619A5', '超值大阪 ＋ 奈良 五日', 'D7 亞航 · 五日精選', '2026-06-19', '2026-06-23', '趙又葳 BONNIE', '0910-401-458', '080-7141-8597', '找到了旅行社', '[{"name": "吳小姐", "phone": "0978-277-997"}, {"name": "陳小姐", "phone": "0985-337-241"}]'::jsonb, '6/19 13:10 桃園第一航廈 · 亞航 2 號櫃檯後方中間（領隊穿背心、持紅色鯉魚旗）', 'D7378 桃園 15:40 → 關西 19:30', 'D7379 關西 20:55 → 桃園 23:05', 'Rita Hotel 難波', '大阪市西成区中開 1-3-12', '06-6537-7032', '6/19–6/23 大阪 23–29°C、降雨機率 40–90%。帶雨具、穿防滑好走鞋，備暈車藥、感冒藥與慢性藥。', 0.21);
  insert into trip_days (trip_id, day_no, date, weekday, theme, guide_message, quick, sort) values ((select id from trips where code='KIX6D70619A5'), 1, '2026-06-19', '週五', '抵達 · 啟程', '歡迎啟程。今天最重要的是準時集合：13:10 在桃園機場第一航廈亞航 2 號櫃檯後方中間位置找領隊（穿雙向旅行社背心、持紅色鯉魚旗），先報到、分組。班機 15:40 起飛，飛行約 3 小時，晚間入住難波 Rita Hotel。', '[{"k": "集合時間", "v": "13:10 桃一航廈"}, {"k": "別忘了", "v": "行動電源放手提"}]'::jsonb, 1);
  insert into trip_days (trip_id, day_no, date, weekday, theme, guide_message, quick, sort) values ((select id from trips where code='KIX6D70619A5'), 2, '2026-06-20', '週六', '奈良 · 世界遺產', '今日前進奈良，世界文化遺產之旅。鹿仙貝拿出來要快餵，鹿群會圍上來討食，有些鹿還會鞠躬！春日大社參道偏長，請穿好走的鞋。午後到門真三井 OUTLET & LaLaPORT 採買，記得帶護照享免稅。', '[{"k": "重點", "v": "餵鹿動作要快"}, {"k": "購物", "v": "帶護照辦免稅"}]'::jsonb, 2);
  insert into trip_days (trip_id, day_no, date, weekday, theme, guide_message, quick, sort) values ((select id from trips where code='KIX6D70619A5'), 3, '2026-06-21', '週日', '自由 · 環球影城', '今日自由活動，兩種玩法二選一。想衝環球影城（自費）建議搭電車一早入園，先抽超級任天堂世界整理券；不去 USJ 也可跟著導遊的電車之旅逛梅田、心齋橋（電車費自理約 1000 日幣），不參加亦可自行活動。', '[{"k": "二選一", "v": "USJ 或 電車逛街"}, {"k": "USJ 撇步", "v": "一早抽任天堂整理券"}]'::jsonb, 3);
  insert into trip_days (trip_id, day_no, date, weekday, theme, guide_message, quick, sort) values ((select id from trips where code='KIX6D70619A5'), 4, '2026-06-22', '週一', '天王寺 · 新世界', '今日跟著導遊搭電車（費用自理約 1000 日幣）玩天王寺、新世界一帶，亦可自由活動。新世界的串炸（串カツ）醬汁「禁止二次沾」，這是大阪規矩！阿倍野 HARUKAS 是日本最高樓，可上展望台俯瞰大阪。', '[{"k": "大阪規矩", "v": "串炸只能沾一次"}, {"k": "最高樓", "v": "HARUKAS 300 展望台"}]'::jsonb, 4);
  insert into trip_days (trip_id, day_no, date, weekday, theme, guide_message, quick, sort) values ((select id from trips where code='KIX6D70619A5'), 5, '2026-06-23', '週二', '大阪城 · 黑門 · 回程', '行程最後一天，搭電車玩大阪城公園（不上天守閣，外觀拍照）與「大阪的廚房」黑門市場，邊走邊吃海膽、和牛串、河豚。晚間 20:55 班機回桃園；午後可慢慢逛，離開前再次確認隨身物品。', '[{"k": "回程班機", "v": "20:55 起飛"}, {"k": "離開前", "v": "再次清點隨身物"}]'::jsonb, 5);
  insert into spots (day_id, idx, name, type, lat, lng, feature, eat, play, buy, tip, videos, sort)
  select d.id, x.idx, x.name, x.type, x.lat, x.lng, x.feature, x.eat, x.play, x.buy, x.tip, x.videos, x.sort
  from (values
    (1, 1, '桃園國際機場 第一航廈', '交通', 25.0797, 121.2342, '亞航 D7378 15:40 起飛。集合點：正門進入直走到底，後排橫向櫃台前、2 號櫃檯後方中間。', null, null, null, '13:10 準時集合先找領隊報到。免費託運 20kg ＋ 手提 7kg；鋰電池、行動電源務必放手提。', '[{"label": "亞航打包", "q": "亞航 行李 規定 打包"}]'::jsonb, 1),
    (1, 2, '關西國際機場 KIX', '交通', 34.432, 135.2304, '19:30 抵達。入境前備妥護照（效期需逾 6 個月）與 Visit Japan Web 入境、海關 QR 碼截圖。', null, null, null, '全程無機上餐食，可先在台灣用餐或自費預訂機餐。海關禁帶肉類、生鮮入境。', '[{"label": "入境攻略", "q": "關西機場 入境 Visit Japan Web 教學"}]'::jsonb, 2),
    (1, 3, 'Rita Hotel 難波', '住宿', 34.647, 135.4955, '大阪市西成区中開 1-3-12。連住四晚的據點，鄰近難波與大國町，生活機能便利。', '鄰近難波／新今宮，便利商店宵夜、平價拉麵，隔天可早起覓食。', null, null, '晚間抵達，附近便利商店、藥妝可先補給。飯店電話 06-6537-7032。', '[{"label": "難波周邊", "q": "大阪 難波 美食 周邊"}]'::jsonb, 3)
  ) as x(day_no, idx, name, type, lat, lng, feature, eat, play, buy, tip, videos, sort)
  join trip_days d on d.day_no = x.day_no and d.trip_id = (select id from trips where code='KIX6D70619A5');
  insert into spots (day_id, idx, name, type, lat, lng, feature, eat, play, buy, tip, videos, sort)
  select d.id, x.idx, x.name, x.type, x.lat, x.lng, x.feature, x.eat, x.play, x.buy, x.tip, x.videos, x.sort
  from (values
    (2, 1, '奈良公園（鹿公園）', '景點', 34.6851, 135.843, '1200 多頭野生鹿自由漫步，被視為神的使者，是日本最具代表性的療癒風景。', '中谷堂高速搗艾草麻糬（午後現搗最熱、食べログ百名店）、大佛布丁、麵鬪庵福袋烏龍麵。', '餵鹿（鹿仙貝約 200 日幣，鹿會鞠躬討食）、順遊東大寺大佛、二月堂遠眺。', '柿の葉壽司（平宗／中谷本舖）、奈良漬、鹿造型紀念品。', '鹿仙貝拿出來要快餵；別讓鹿咬到塑膠袋。', '[{"label": "奈良美食", "q": "奈良 必吃美食 中谷堂"}, {"label": "一日遊", "q": "奈良 一日遊 攻略"}]'::jsonb, 1),
    (2, 2, '春日大社', '世界遺產', 34.6818, 135.8483, '世界文化遺產。朱紅社殿搭配約 3000 座銅燈籠與石燈籠，藤浪之屋的萬燈籠夢幻必看。', null, '朱紅迴廊、萬燈籠、夫婦大國社求姻緣。', null, '參道從入口到本殿頗長，穿好走鞋。', '[{"label": "春日大社", "q": "春日大社 奈良 導覽"}]'::jsonb, 2),
    (2, 3, '平城宮跡歷史公園', '景點', 34.6911, 135.7956, '奈良時代皇宮遺址。復原的朱雀門與第一次大極殿氣勢恢宏，腹地廣闊、免費參觀。', null, '朱雀門、第一次大極殿、遣唐使船（免費）。', null, '遮蔽少，做好防曬、補水。', '[{"label": "平城宮跡", "q": "平城宮跡 朱雀門"}]'::jsonb, 3),
    (2, 4, '三井 OUTLET & LaLaPORT 門真', '購物', 34.737, 135.586, '2023 年底開幕的關西最大級複合商場，OUTLET 加大型購物中心一次逛足。', 'LaLaPORT 美食街、超市熟食。', null, '服飾鞋包特價、UNIQLO／GU、運動品牌；滿 5000 日圓持護照可退稅。', '結帳前先出示護照辦免稅。', '[{"label": "門真Outlet", "q": "三井 OUTLET 門真 LaLaPORT"}, {"label": "必買", "q": "日本 OUTLET 必買 戰利品"}]'::jsonb, 4)
  ) as x(day_no, idx, name, type, lat, lng, feature, eat, play, buy, tip, videos, sort)
  join trip_days d on d.day_no = x.day_no and d.trip_id = (select id from trips where code='KIX6D70619A5');
  insert into spots (day_id, idx, name, type, lat, lng, feature, eat, play, buy, tip, videos, sort)
  select d.id, x.idx, x.name, x.type, x.lat, x.lng, x.feature, x.eat, x.play, x.buy, x.tip, x.videos, x.sort
  from (values
    (3, 1, '日本環球影城 USJ', '自費景點', 34.6654, 135.4323, '哈利波特魔法世界、超級任天堂世界（瑪利歐＋咚奇剛）、小小兵樂園，2026 邁入 25 週年。', '奇諾比奧咖啡（蘑菇造型）、活米村奶油啤酒。', '超級任天堂世界（咚奇剛瘋狂礦車最新、瑪利歐賽車、耀西）、哈利波特禁忌之旅、飛天翼龍、小小兵乘車遊、好萊塢美夢。', '任天堂世界限定商品、能量手環、小小兵周邊。', '一早入園先抽超級任天堂世界整理券或加購快速通關；能量手環可收集印章。', '[{"label": "USJ攻略", "q": "環球影城 USJ 攻略"}, {"label": "任天堂世界", "q": "超級任天堂世界 咚奇剛 攻略"}, {"label": "必買必吃", "q": "環球影城 必買 美食"}]'::jsonb, 1),
    (3, 2, '梅田 · GRAND FRONT 大阪', '購物', 34.7048, 135.4946, '大阪站直結的複合商業區，百貨、餐飲、空中庭園展望台一帶熱鬧繁華。', '阪急百貨 B1 甜點、梅田美食街。', '梅田藍天大廈空中庭園展望台、瀧見小路昭和食街。', '阪急百貨、LUCUA、GRAND FRONT、阪急三番街、Yodobashi 梅田。', '梅田地下街錯綜（被戲稱迷宮），記好出口編號。', '[{"label": "梅田攻略", "q": "大阪 梅田 攻略 逛街"}, {"label": "梅田美食", "q": "梅田 美食 推薦"}]'::jsonb, 2),
    (3, 3, '心齋橋筋 · 道頓堀', '購物·美食', 34.6723, 135.501, '大阪最熱鬧的拱廊商店街，串連道頓堀；固力果跑跑人看板、章魚燒、藥妝一次滿足。', '章魚燒（くくる／道樂WANAKA／十八番）、金龍拉麵（免費泡菜蒜泥）、神座拉麵、一蘭、蟹道樂、大起水產迴轉壽司、美津の大阪燒、HARBS 草莓塔。', '固力果跑跑人、戎橋打卡、道頓堀水上觀光船、法善寺橫丁。', '藥妝（松本清試用最齊、SUGI 開到 24 點、大國便宜但結帳要逐項核對）、唐吉訶德。', '大國藥妝走道擠、結帳偶有掉包多刷爭議，刷卡務必核對清點。', '[{"label": "道頓堀美食", "q": "道頓堀 必吃 美食"}, {"label": "藥妝必買", "q": "大阪 心齋橋 藥妝 必買"}, {"label": "必買清單", "q": "大阪 必買 2026"}]'::jsonb, 3)
  ) as x(day_no, idx, name, type, lat, lng, feature, eat, play, buy, tip, videos, sort)
  join trip_days d on d.day_no = x.day_no and d.trip_id = (select id from trips where code='KIX6D70619A5');
  insert into spots (day_id, idx, name, type, lat, lng, feature, eat, play, buy, tip, videos, sort)
  select d.id, x.idx, x.name, x.type, x.lat, x.lng, x.feature, x.eat, x.play, x.buy, x.tip, x.videos, x.sort
  from (values
    (4, 1, '難波八阪神社', '景點', 34.6601, 135.497, '巨大獅子頭舞台（高約 12 公尺）震撼吸睛，傳說大獅子吞食厄運、招來好運。', null, '獅子殿正面拍照（免費參拜）。', null, null, '[{"label": "八阪神社", "q": "難波八阪神社 獅子殿"}]'::jsonb, 1),
    (4, 2, '阿倍野 HARUKAS 近鐵百貨', '購物·景點', 34.6457, 135.5135, '高 300 公尺的日本最高摩天大樓，近鐵百貨本店加 HARUKAS 300 展望台。', '百貨美食樓層、天王寺周邊。', 'HARUKAS 300 展望台、あべのハルカス美術館。', '近鐵百貨本店、Q''s Mall，退稅櫃台集中辦理。', '登展望台需另購票；天氣好可遠眺大阪灣與生駒山。', '[{"label": "HARUKAS", "q": "阿倍野 HARUKAS 300 展望台"}, {"label": "天王寺逛街", "q": "天王寺 阿倍野 逛街 美食"}]'::jsonb, 2),
    (4, 3, '天王寺公園', '景點', 34.6491, 135.5145, '市區綠洲，內有天王寺動物園與日本庭園慶澤園，緊鄰 HARUKAS。', 'てんしば園區內咖啡餐廳。', 'てんしば草地、天王寺動物園、慶澤園。', null, null, '[{"label": "天王寺公園", "q": "天王寺公園 てんしば"}]'::jsonb, 3),
    (4, 4, '新世界 · 通天閣', '景點·美食', 34.6524, 135.5063, '昭和懷舊風情街，通天閣地標與幸運之神 Biliken，串炸（串カツ）發源地。', '串炸達摩 だるま（發源店，醬汁禁二次沾）、どて燒、各式串炸名店。', '通天閣展望台、摸 Biliken 腳底許願、ジャンジャン横丁懷舊。', 'Biliken 周邊、昭和懷舊紀念品。', '串炸醬汁「二度漬け禁止」只能沾一次！', '[{"label": "新世界串炸", "q": "新世界 串炸 達摩 通天閣"}, {"label": "通天閣", "q": "通天閣 新世界 攻略"}]'::jsonb, 4)
  ) as x(day_no, idx, name, type, lat, lng, feature, eat, play, buy, tip, videos, sort)
  join trip_days d on d.day_no = x.day_no and d.trip_id = (select id from trips where code='KIX6D70619A5');
  insert into spots (day_id, idx, name, type, lat, lng, feature, eat, play, buy, tip, videos, sort)
  select d.id, x.idx, x.name, x.type, x.lat, x.lng, x.feature, x.eat, x.play, x.buy, x.tip, x.videos, x.sort
  from (values
    (5, 1, '大阪城公園', '景點', 34.6873, 135.5259, '豐臣秀吉建造的名城，護城河、石垣與西之丸庭園壯觀。本行程於外觀拍照（不上天守閣）。', 'JO-TERRACE OSAKA 餐廳、公園內咖啡。', '天守閣外觀＋護城河經典構圖、西之丸庭園、極樂橋、御座船。', null, '公園腹地大，留意集合時間。', '[{"label": "大阪城", "q": "大阪城公園 導覽"}]'::jsonb, 1),
    (5, 2, '黑門市場', '美食', 34.6652, 135.5061, '有「大阪廚房」之稱的傳統市場，生鮮、海膽、和牛串、河豚、現烤海鮮應有盡有。', '海膽、和牛串、現烤干貝牡蠣、河豚、黑門三平、鮪魚、現切水果（草莓／哈密瓜）、玉子燒。', null, '海鮮、當季水果、漬物伴手禮。', '8 點開市、現買現吃、現金方便；別吃太撐，留意班機時間。', '[{"label": "黑門市場", "q": "黑門市場 必吃 美食"}, {"label": "必吃海鮮", "q": "黑門市場 推薦 海鮮"}]'::jsonb, 2),
    (5, 3, '關西國際機場 → 桃園', '交通', 34.432, 135.2304, '亞航 D7379 20:55 起飛，23:05 抵達桃園。', null, null, '關西機場免稅店、最後採購伴手禮。', '提早辦理 check-in 與退稅；離開前再次確認護照與隨身物品。', '[{"label": "退稅攻略", "q": "關西機場 退稅 流程"}]'::jsonb, 3)
  ) as x(day_no, idx, name, type, lat, lng, feature, eat, play, buy, tip, videos, sort)
  join trip_days d on d.day_no = x.day_no and d.trip_id = (select id from trips where code='KIX6D70619A5');
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '天氣 · 穿著', '六月大阪要穿什麼？', '23–29°C 偏熱、早晚有溫差，白天短袖＋薄外套；降雨機率高，務必帶折傘、穿防滑好走鞋。', 0);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '天氣 · 穿著', '去環球影城穿什麼？', '好走鞋＋薄外套走整天，帶防曬、帽子、水；排隊可能曬太陽。', 1);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '金錢 · 支付', '帶多少日幣夠？', '餐食、電車、零食抓每天約 5,000–8,000 日幣；大筆購物可刷卡。團規現金上限美金 1 萬等值、新台幣 6 萬。', 2);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '金錢 · 支付', '可以刷卡嗎？', '百貨、連鎖、大店可刷卡與行動支付；黑門市場、串炸小店、攤販建議用現金。', 3);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '金錢 · 支付', '退稅怎麼辦？', '同一店家當日滿 5,000 日圓，結帳前出示護照辦免稅；退稅品會封袋，離境前別拆封使用。', 4);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '網路 · 電器', '網路怎麼解決？', '出發前買日本 eSIM 或網卡最方便，落地開通即用。', 5);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '網路 · 電器', '插頭、電壓要轉接嗎？', '日本與台灣同為 A 型雙平腳插頭、電壓 100V，台灣電器大多可直接用（高功率電器留意）。', 6);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '飲食', '飛機上有餐嗎？', '亞航 D7 全程不含餐，先吃飽或自費預訂；特殊餐須開票前說明。', 7);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '飲食', '串炸可以沾兩次嗎？', '不行！串炸醬汁「二度漬け禁止」，只能沾一次。', 8);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '禮儀 · 生活', '要給小費嗎？', '日本沒有小費文化，不用給。', 9);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '禮儀 · 生活', '街上垃圾桶很少？', '是的，垃圾多隨身帶回飯店或便利商店旁丟；邊走邊吃請在攤位旁吃完再走。', 10);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '入境 · 行李', 'Visit Japan Web 一定要嗎？', '強烈建議先登錄並截圖入境＋海關 QR，過關最快；沒用紙本也可，機上向空服員索取。', 11);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '入境 · 行李', '行李超重怎麼辦？', '免費託運 20kg、手提 7kg，超重現場依航空公司規定加收。', 12);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '入境 · 行李', '哪些東西不能帶？', '肉類／肉製品／生鮮禁帶入境日本；行動電源、鋰電池須放手提；防風打火機、含電池捲髮器禁帶上機。', 13);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '景點', '鹿仙貝哪裡買？', '奈良公園內小販即有，約 200 日幣一份；拿出來要快餵，別讓鹿咬到塑膠袋。', 14);
  insert into faqs (trip_id, category, question, answer, sort) values ((select id from trips where code='KIX6D70619A5'), '景點', 'USJ 要買快速通關嗎？', '旺季人多可考慮；不買也行，一早入園先抽超級任天堂世界整理券。', 15);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '點餐 · 餐廳', 'これをください', 'kore o kudasai', '我要這個', false, 0);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '點餐 · 餐廳', 'メニューをください', 'menyū o kudasai', '請給我菜單', false, 1);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '點餐 · 餐廳', 'お会計お願いします', 'okaikei onegai shimasu', '麻煩結帳', false, 2);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '點餐 · 餐廳', 'とても美味しいです', 'totemo oishii desu', '非常好吃', false, 3);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '購物 · 免稅', '免税できますか？', 'menzei dekimasu ka?', '可以免稅嗎？', false, 4);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '購物 · 免稅', 'いくらですか？', 'ikura desu ka?', '多少錢？', false, 5);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '購物 · 免稅', 'カードで払えますか？', 'kādo de haraemasu ka?', '可以刷卡嗎？', false, 6);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '購物 · 免稅', '袋をください', 'fukuro o kudasai', '請給我袋子', false, 7);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '問路 · 溝通', 'すみません', 'sumimasen', '不好意思／抱歉', false, 8);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '問路 · 溝通', 'トイレはどこですか？', 'toire wa doko desu ka?', '廁所在哪裡？', false, 9);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '問路 · 溝通', '駅はどこですか？', 'eki wa doko desu ka?', '車站在哪裡？', false, 10);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '問路 · 溝通', '中国語か英語わかりますか？', 'chūgokugo ka eigo wakarimasu ka?', '您會中文或英文嗎？', false, 11);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '緊急', '助けて！', 'tasukete!', '救命！', true, 12);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '緊急', '救急車を呼んでください', 'kyūkyūsha o yonde kudasai', '請叫救護車', true, 13);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '緊急', '警察を呼んでください', 'keisatsu o yonde kudasai', '請叫警察', true, 14);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '緊急', '気分が悪いです', 'kibun ga warui desu', '我不太舒服', true, 15);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '緊急', '病院へ連れて行ってください', 'byōin e tsurete itte kudasai', '請帶我去醫院', true, 16);
  insert into phrases (trip_id, category, jp, romaji, zh, is_emergency, sort) values ((select id from trips where code='KIX6D70619A5'), '緊急', 'パスポートをなくしました', 'pasupōto o nakushimashita', '我的護照不見了', true, 17);
  insert into emergency_contacts (trip_id, label, phone, note, sort) values ((select id from trips where code='KIX6D70619A5'), '領隊 趙又葳 BONNIE（台灣）', '0910-401-458', '台灣手機', 0);
  insert into emergency_contacts (trip_id, label, phone, note, sort) values ((select id from trips where code='KIX6D70619A5'), '領隊 趙又葳 BONNIE（日本）', '080-7141-8597', '日本手機', 1);
  insert into emergency_contacts (trip_id, label, phone, note, sort) values ((select id from trips where code='KIX6D70619A5'), '找到了旅行社 · 吳小姐', '0978-277-997', '', 2);
  insert into emergency_contacts (trip_id, label, phone, note, sort) values ((select id from trips where code='KIX6D70619A5'), '找到了旅行社 · 陳小姐', '0985-337-241', '', 3);
  insert into emergency_contacts (trip_id, label, phone, note, sort) values ((select id from trips where code='KIX6D70619A5'), '駐大阪辦事處 · 急難救助專線', '+81-90-8794-4568', '車禍、緊急就醫、搶劫、被捕等緊急求助專用', 4);
  insert into emergency_contacts (trip_id, label, phone, note, sort) values ((select id from trips where code='KIX6D70619A5'), '駐大阪辦事處 · 領務（護照／簽證）', '+81-6-6227-8623', '上班時間', 5);
  insert into emergency_contacts (trip_id, label, phone, note, sort) values ((select id from trips where code='KIX6D70619A5'), '日本報警', '110', '', 6);
  insert into emergency_contacts (trip_id, label, phone, note, sort) values ((select id from trips where code='KIX6D70619A5'), '日本火災／救護車', '119', '', 7);
end if;
end $$;
