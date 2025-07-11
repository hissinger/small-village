-- rooms table
create table
  public.rooms (
    id uuid not null default gen_random_uuid (),
    created_at timestamp with time zone not null default now(),
    title text null,
    constraint rooms_pkey primary key (id)
  ) TABLESPACE pg_default;


-- users table
create table
  public.users (
    name text not null default ''::text,
    character_index integer not null,
    created_at timestamp with time zone not null default now(),
    x integer not null,
    y integer not null,
    id text not null,
    last_active timestamp with time zone not null default now(),
    constraint users_pkey primary key (id)
  ) tablespace pg_default;


-- sessions table
create table
  public.sessions (
    user_id text not null,
    created_at timestamp with time zone not null default now(),
    id text not null,
    tracks jsonb not null,
    constraint sessions_pkey primary key (id),
    constraint sessions_id_key unique (id),
    constraint sessions_user_id_fkey foreign key (user_id) references users (id) on delete cascade
  ) tablespace pg_default;


--- receiving old records when delete event is received
alter table
  sessions replica identity full;