-- rooms table
create table
  public.rooms (
    id uuid not null default gen_random_uuid (),
    created_at timestamp with time zone not null default now(),
    title text null,
    -- 방의 게임 월드 맵('village' | 'tilemap'). create-meeting 이 방 생성 시 저장하고,
    -- 클라이언트(resolveMap)가 알 수 없는 값/누락 시 기본 맵으로 폴백한다.
    map text not null default 'village',
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

