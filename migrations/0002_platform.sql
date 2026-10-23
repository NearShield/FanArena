create table if not exists platform_creator (
  id integer primary key,
  name text not null,
  bio text not null,
  remix_url text not null,
  constraint platform_creator_one check (id = 1)
);

create table if not exists platform_games (
  id serial primary key,
  title text not null,
  url text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

insert into platform_creator (id, name, bio, remix_url)
values (
  1,
  'Andrei RPK',
  'Building games on Remix.',
  'https://remix.gg/@andrei_rpk'
)
on conflict (id) do nothing;

insert into platform_games (title, url, description)
select
  'Endgame Legends',
  'https://remix.gg/g/endgame-legends',
  'Choose your legendary hero and defend a ruined compound from an invading alien army. Co-op mode available.'
where not exists (
  select 1 from platform_games where url = 'https://remix.gg/g/endgame-legends'
);
