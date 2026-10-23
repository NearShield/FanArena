create table if not exists point_accounts (
  address text primary key,
  balance integer not null default 0 check (balance >= 0)
);

create table if not exists point_ledger (
  id serial primary key,
  address text not null,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists fan_creators (
  address text primary key,
  name text not null,
  bio text not null,
  remix_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists fan_tokens (
  address text primary key,
  name text not null,
  symbol text not null,
  created_at timestamptz not null default now()
);
