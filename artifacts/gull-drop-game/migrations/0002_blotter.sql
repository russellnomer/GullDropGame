create table if not exists blotter (
  id         serial primary key,
  handle     text not null,
  score      integer not null,
  combo      integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists blotter_score_idx on blotter (score desc);
