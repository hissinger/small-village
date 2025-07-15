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
    room_id uuid null default gen_random_uuid (),
    constraint users_pkey primary key (id),
    constraint users_room_id_fkey foreign KEY (room_id) references rooms (id) on delete CASCADE
  ) TABLESPACE pg_default;

