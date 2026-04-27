-- ================================================================
-- PASO 1: Ejecutar este SQL en Supabase > SQL Editor > New query
-- ================================================================

-- Tabla de encargados (usuarios del sistema)
create table if not exists encargados (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  usuario text not null unique,
  pass text not null,
  tel text,
  cat text, -- mujer-joven | mujer-adulta | varon-joven | varon-adulto
  rol text default 'encargado', -- encargado | admin
  created_at timestamptz default now()
);

-- Tabla de visitas
create table if not exists visitas (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  edad int,
  genero text, -- F | M
  tel text,
  fecha date,
  notas text,
  historial jsonb default '[]',
  encargado_id uuid references encargados(id) on delete set null,
  encargado_nombre text,
  creado_por uuid,
  created_at timestamptz default now()
);

-- Tabla de notificaciones
create table if not exists notificaciones (
  id uuid default gen_random_uuid() primary key,
  para_id uuid,
  para_nombre text,
  tipo text,
  visita_id uuid references visitas(id) on delete cascade,
  visita_nombre text,
  visita_tel text,
  visita_edad int,
  visita_genero text,
  visita_fecha date,
  leida boolean default false,
  created_at timestamptz default now()
);

-- ================================================================
-- PASO 2: Deshabilitar Row Level Security (para uso interno)
-- ================================================================
alter table encargados disable row level security;
alter table visitas disable row level security;
alter table notificaciones disable row level security;

-- ================================================================
-- MIGRACIÓN: Agregar columna estado a visitas
-- Ejecutar si la tabla ya existe
-- ================================================================
alter table visitas add column if not exists estado text default 'activa';

-- ================================================================
-- MIGRACIÓN: Nuevos campos en visitas
-- Ejecutar si la tabla ya existe
-- ================================================================
alter table visitas add column if not exists direccion text;
alter table visitas add column if not exists barrio text;
alter table visitas add column if not exists localidad text;
alter table visitas add column if not exists tipo_decision text;
alter table visitas add column if not exists tomado_por text;

-- ================================================================
-- LISTO. Ahora podés subir la app a Netlify/Vercel.
-- ================================================================
