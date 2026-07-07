-- koe-survey スキーマ＋RLS
-- Supabaseダッシュボード > SQL Editor に全文貼り付けて実行する（1回だけ）

-- ============ テーブル ============

create table if not exists public.surveys (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  client     text not null,            -- 仮名推奨: 'nd', 'cw' など
  title      text not null,
  status     text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  definition jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.responses (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references public.surveys(id) on delete cascade,
  channel     text,
  answers     jsonb not null,
  -- 匿名性のため「日」までしか持たない（時刻で個人が推定できないように）
  answered_on date not null default current_date
);

create index if not exists idx_responses_survey on public.responses(survey_id);

-- ============ RLS ============

alter table public.surveys   enable row level security;
alter table public.responses enable row level security;

-- 認証済みユーザー（平井さん）は全権
create policy "auth_all_surveys" on public.surveys
  for all to authenticated using (true) with check (true);

create policy "auth_select_responses" on public.responses
  for select to authenticated using (true);

create policy "auth_delete_responses" on public.responses
  for delete to authenticated using (true);

-- 匿名（回答者）:
--   surveysへのSELECTポリシーは作らない＝一覧の列挙は不可能。
--   回答画面はRPC get_survey(slug) 経由でのみ設問定義を取得する。
--   responsesはopenなサーベイへのINSERTのみ。SELECT/UPDATE/DELETE不可。

create or replace function public.is_survey_open(sid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.surveys where id = sid and status = 'open');
$$;

create policy "anon_insert_responses" on public.responses
  for insert to anon
  with check (is_survey_open(survey_id));

-- slugを知っている人だけが設問定義を取れる（openのみ）
create or replace function public.get_survey(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', id, 'slug', slug, 'title', title, 'definition', definition
  )
  from public.surveys
  where slug = p_slug and status = 'open';
$$;

revoke all on function public.get_survey(text) from public;
grant execute on function public.get_survey(text) to anon, authenticated;
revoke all on function public.is_survey_open(uuid) from public;

-- ============ 動作メモ ============
-- ・anonキーはフロントに置いてよい（守りはこのRLSが担う）
-- ・service_roleキーは絶対にリポジトリ・フロントに置かない
-- ・管理者アカウントは Authentication > Users > Add user で1人作る（メール＋パスワード）
