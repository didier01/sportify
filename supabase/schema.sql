-- 1. Habilitar la extensión UUID si no está activa
create extension if not exists "uuid-ossp";

-- 2. Tabla de Jugadores
create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  name text,
  nickname text not null unique,
  preferred_position text not null check (preferred_position in ('GK', 'DF', 'MF', 'FW')),
  base_rating float not null default 6.0 check (base_rating >= 1.0 and base_rating <= 10.0),
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabla de Partidos
create table if not exists matches (
  id uuid default gen_random_uuid() primary key,
  date date not null default current_date,
  youtube_url text,
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabla de Calificaciones y asignaciones de equipo por Partido
create table if not exists match_players (
  match_id uuid references matches(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  team char(1) not null check (team in ('A', 'B')),
  match_rating float check (match_rating >= 1.0 and match_rating <= 10.0),
  primary key (match_id, player_id)
);

-- 5. Tabla de Eventos del Partido (goles, tarjetas, mvp)
create table if not exists match_events (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade not null,
  event_type text not null check (event_type in ('goal', 'card_yellow', 'card_red', 'mvp')),
  minute integer check (minute >= 0),
  player_id uuid references players(id) on delete cascade not null,
  assistant_id uuid references players(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Vista para consolidar estadísticas históricas por jugador en tiempo real
create or replace view v_player_stats as
select 
  p.id as player_id,
  p.name,
  p.nickname,
  p.preferred_position,
  p.base_rating,
  p.is_active,
  -- Partidos Jugados
  count(distinct mp.match_id) as matches_played,
  -- Goles totales
  count(distinct case when me.event_type = 'goal' and me.player_id = p.id then me.id end) as goals,
  -- Asistencias totales
  count(distinct case when me.event_type = 'goal' and me.assistant_id = p.id then me.id end) as assists,
  -- Win Rate (%)
  coalesce(
    (count(distinct case 
      when mp.team = 'A' and m.team_a_score > m.team_b_score then m.id
      when mp.team = 'B' and m.team_b_score > m.team_a_score then m.id 
     end)::float / nullif(count(distinct mp.match_id), 0) * 100), 0
  ) as win_rate,
  -- Rating Promedio en partidos (si no hay calificaciones de partido, usar el base_rating)
  coalesce(avg(mp.match_rating), p.base_rating) as average_rating
from players p
left join match_players mp on mp.player_id = p.id
left join matches m on m.id = mp.match_id
left join match_events me on me.match_id = mp.match_id and (me.player_id = p.id or me.assistant_id = p.id)
group by p.id, p.name, p.nickname, p.preferred_position, p.base_rating, p.is_active;
