-- Ahorra — esquema inicial. Ver plan de arquitectura §1 para el razonamiento detrás
-- de cada decisión (path materializado, SECURITY DEFINER, occurred_on como date civil…).

create extension if not exists pgcrypto;

create schema if not exists app;
grant usage on schema app to authenticated;

-- =========================================================================
-- 0. Helpers genéricos (no referencian tablas todavía creadas)
-- =========================================================================

create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- =========================================================================
-- 1. Identidad y household
-- =========================================================================

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

create table public.households (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) between 1 and 80),
  base_currency  char(3) not null default 'EUR' check (base_currency = 'EUR'),
  created_at     timestamptz not null default now()
);

create type public.household_role as enum ('owner','member');

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.household_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user on public.household_members (user_id);

-- SECURITY DEFINER para saltar RLS y evitar la recursión de policies sobre
-- household_members que se consultan a sí mismas. `language sql` se resuelve/valida
-- en el momento de CREATE FUNCTION (a diferencia de plpgsql), por eso van aquí,
-- después de que household_members ya exista, y no en un bloque "0. Helpers" al inicio.
create or replace function app.household_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select hm.household_id from public.household_members hm
  where hm.user_id = (select auth.uid());
$$;

create or replace function app.is_member(h uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members hm
                 where hm.household_id = h and hm.user_id = (select auth.uid()));
$$;

create or replace function app.is_owner(h uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members hm
                 where hm.household_id = h and hm.user_id = (select auth.uid())
                   and hm.role = 'owner');
$$;

-- El creador de un household se autoinscribe como owner en la misma transacción;
-- sin esto la policy de SELECT lo dejaría fuera de su propio household recién creado.
create or replace function app.households_seed_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, (select auth.uid()), 'owner');
  return new;
end $$;
create trigger households_seed_owner after insert on public.households
for each row execute function app.households_seed_owner();

-- =========================================================================
-- 2. Taxonomía de categorías (jerarquía ≤3 niveles, path materializado)
-- =========================================================================

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  parent_id    uuid references public.categories(id) on delete restrict,
  name         text not null check (length(btrim(name)) between 1 and 60),
  icon         text,
  color        text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind         text not null default 'expense' check (kind in ('expense','income')),
  -- path materializado raíz→hoja (incluye self). Permite rollups de subárbol
  -- con un solo índice GIN y sin CTE recursivo en cada consulta.
  path         uuid[] not null default '{}',
  depth        smallint not null default 0 check (depth between 0 and 2), -- ≤3 niveles
  is_archived  boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index categories_name_uniq on public.categories
  (household_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));
create index categories_household on public.categories (household_id) where not is_archived;
create index categories_path_gin on public.categories using gin (path);

create or replace function app.categories_set_path() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  if new.parent_id is null then
    new.path := array[new.id]; new.depth := 0;
  else
    select c.household_id, c.path, c.depth into p
      from public.categories c where c.id = new.parent_id;
    if p is null then raise exception 'categoría padre inexistente'; end if;
    if p.household_id <> new.household_id then raise exception 'padre de otro household'; end if;
    if new.id = any(p.path) then raise exception 'ciclo en la jerarquía'; end if;
    new.path  := p.path || new.id;
    new.depth := p.depth + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger categories_set_path before insert or update of parent_id, household_id
on public.categories for each row execute function app.categories_set_path();

-- Al mover una categoría hay que reescribir el prefijo del path de todo su subárbol.
-- El CHECK de depth vuelve a evaluarse por fila y aborta si la mueves demasiado hondo.
create or replace function app.categories_fix_subtree() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.categories c
     set path  = new.path || c.path[(array_position(c.path, new.id) + 1):],
         depth = (array_length(new.path, 1)
                  + array_length(c.path[(array_position(c.path, new.id) + 1):], 1))::smallint - 1
   where c.household_id = new.household_id and c.id <> new.id and new.id = any(c.path);
  return null;
end $$;
create trigger categories_fix_subtree after update of parent_id on public.categories
for each row when (old.parent_id is distinct from new.parent_id)
execute function app.categories_fix_subtree();

create trigger categories_touch before update on public.categories
for each row execute function app.touch_updated_at();

-- =========================================================================
-- 3. Campos personalizados (definiciones + JSONB en expenses.custom)
-- =========================================================================

create type public.custom_field_type as enum ('text','number','boolean','date','select');

create table public.custom_field_defs (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  -- `key` es el identificador estable dentro de expenses.custom; `label` es
  -- renombrable sin migrar datos. Separarlos evita reescrituras de JSONB.
  key          text not null check (key ~ '^[a-z][a-z0-9_]{0,30}$'),
  label        text not null check (length(btrim(label)) between 1 and 60),
  type         public.custom_field_type not null,
  options      text[],
  required     boolean not null default false,
  applies_to   uuid[] not null default '{}',   -- category_ids; vacío = todas
  sort_order   int not null default 0,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, key),
  check (type <> 'select' or coalesce(array_length(options,1),0) > 0)
);

create trigger custom_field_defs_touch before update on public.custom_field_defs
for each row execute function app.touch_updated_at();

-- =========================================================================
-- 4. Gastos
-- =========================================================================

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  category_id   uuid references public.categories(id) on delete set null,
  amount_cents  integer not null check (amount_cents > 0),  -- signo lo da categories.kind
  currency      char(3) not null default 'EUR' check (currency = 'EUR'),
  occurred_on   date not null,                              -- fecha civil Europe/Madrid, no timestamptz
  merchant      text check (length(merchant) <= 120),
  note          text check (length(note) <= 500),
  custom        jsonb not null default '{}'::jsonb check (jsonb_typeof(custom) = 'object'),
  source        text not null default 'manual' check (source in ('manual','agent','import')),
  agent_run_id  uuid,                                       -- trazabilidad de escrituras del agente
  created_by    uuid not null references auth.users(id) default auth.uid(),
  -- Idempotencia de la cola offline: reintentar un push nunca duplica.
  client_mutation_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz                                 -- tombstone para sync incremental
);

create unique index expenses_cmid_uniq on public.expenses (household_id, client_mutation_id)
  where client_mutation_id is not null;
create index expenses_by_date on public.expenses (household_id, occurred_on desc)
  where deleted_at is null;
create index expenses_by_cat on public.expenses (household_id, category_id, occurred_on desc)
  where deleted_at is null;
-- Sin filtro de deleted_at: el delta sync necesita ver los tombstones.
create index expenses_sync on public.expenses (household_id, updated_at desc);
create index expenses_custom_gin on public.expenses using gin (custom jsonb_path_ops);
create index expenses_merchant_trgm on public.expenses (household_id, lower(merchant))
  where deleted_at is null;

create trigger expenses_touch before update on public.expenses
for each row execute function app.touch_updated_at();

-- =========================================================================
-- 5. Presupuestos
-- =========================================================================

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  amount_cents integer not null check (amount_cents >= 0),
  -- true = el presupuesto agrega el gasto de la categoría y todos sus descendientes.
  includes_descendants boolean not null default true,
  rollover     boolean not null default false,   -- reservado fase 2, no implementar
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, category_id, period_month)
);
create index budgets_period on public.budgets (household_id, period_month);

create trigger budgets_touch before update on public.budgets
for each row execute function app.touch_updated_at();

-- =========================================================================
-- 6. Agente: auditoría y caché de análisis
-- =========================================================================

create table public.agent_runs (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  kind         text not null check (kind in ('parse_expense','analyze')),
  model        text not null,
  prompt_tokens int, completion_tokens int, latency_ms int,
  status       text not null check (status in
                 ('ok','schema_error','repaired','provider_error','rate_limited','timeout')),
  raw_output   text,   -- solo cuando status <> 'ok', para iterar el prompt
  created_at   timestamptz not null default now()
);
create index agent_runs_recent on public.agent_runs (household_id, created_at desc);
-- Ventana para el throttle propio (contrato del agente §3.5 del plan)
create index agent_runs_user_window on public.agent_runs (user_id, created_at desc);

-- Los análisis son caros y estables dentro de un mes: se cachean.
create table public.ai_insights (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  period_month date not null,
  payload      jsonb not null,
  input_digest text not null,   -- hash de los agregados; si no cambia, no se regenera
  generated_at timestamptz not null default now(),
  unique (household_id, period_month)
);

alter table public.expenses add constraint expenses_agent_run_fk
  foreign key (agent_run_id) references public.agent_runs(id) on delete set null;

-- =========================================================================
-- 7. Vista de progreso de presupuesto
-- =========================================================================

-- is_top_level marca los presupuestos que se pintan en el dashboard: aquellos
-- cuya categoría no tiene ningún ancestro con presupuesto en el mismo period_month
-- (decisión de UI: solo se ve la barra del padre; el detalle del hijo aparece al
-- entrar en esa categoría).
-- security_invoker: sin esto la vista se ejecutaría como su owner y saltaría la RLS.
create or replace view public.v_budget_progress with (security_invoker = on) as
select b.id as budget_id, b.household_id, b.category_id, b.period_month,
       b.amount_cents, b.includes_descendants,
       coalesce(sum(e.amount_cents), 0)::bigint as spent_cents,
       not exists (
         select 1 from public.budgets pb
         join public.categories pc on pc.id = pb.category_id
         join public.categories c  on c.id = b.category_id
         where pb.household_id = b.household_id
           and pb.period_month = b.period_month
           and pb.category_id <> b.category_id
           and pc.id = any(c.path[1:array_length(c.path,1)-1])   -- pc es ancestro estricto de c
       ) as is_top_level
from public.budgets b
left join public.expenses e
  on  e.household_id = b.household_id
  and e.deleted_at is null
  and e.occurred_on >= b.period_month
  and e.occurred_on <  (b.period_month + interval '1 month')::date
  and (case when b.includes_descendants
            then e.category_id in (select d.id from public.categories d
                                   where d.household_id = b.household_id
                                     and b.category_id = any(d.path))
            else e.category_id = b.category_id end)
group by b.id;

-- =========================================================================
-- 8. RLS — deny by default
-- =========================================================================

alter table public.profiles          enable row level security;
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.categories        enable row level security;
alter table public.custom_field_defs enable row level security;
alter table public.expenses          enable row level security;
alter table public.budgets           enable row level security;
alter table public.agent_runs        enable row level security;
alter table public.ai_insights       enable row level security;

-- Forzar RLS también al owner de las tablas: evita fugas por conexiones de servicio
-- mal configuradas. La service_role key sigue saltándosela (BYPASSRLS).
alter table public.expenses force row level security;
alter table public.categories force row level security;

revoke all on all tables in schema public from anon;
revoke all on function app.household_ids(), app.is_member(uuid), app.is_owner(uuid) from public, anon;
grant execute on function app.household_ids(), app.is_member(uuid), app.is_owner(uuid) to authenticated;

-- profiles
create policy profiles_self_rw on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_read_cohabitants on public.profiles for select to authenticated
  using (exists (select 1 from public.household_members hm
                 where hm.user_id = public.profiles.id
                   and hm.household_id in (select app.household_ids())));

-- households
create policy households_read   on public.households for select to authenticated
  using (app.is_member(id));
create policy households_create on public.households for insert to authenticated
  with check (true);                       -- el trigger households_seed_owner lo convierte en owner
create policy households_admin  on public.households for update to authenticated
  using (app.is_owner(id)) with check (app.is_owner(id));
create policy households_delete on public.households for delete to authenticated
  using (app.is_owner(id));

-- household_members (helpers SECURITY DEFINER ⇒ sin recursión)
create policy hm_read   on public.household_members for select to authenticated
  using (app.is_member(household_id));
create policy hm_admin  on public.household_members for insert to authenticated
  with check (app.is_owner(household_id));
create policy hm_update on public.household_members for update to authenticated
  using (app.is_owner(household_id)) with check (app.is_owner(household_id));
create policy hm_delete on public.household_members for delete to authenticated
  using (app.is_owner(household_id) or user_id = (select auth.uid()));  -- salirse siempre se puede

-- Datos del household: mismo patrón en las 6 tablas.
create policy categories_rw on public.categories for all to authenticated
  using (app.is_member(household_id)) with check (app.is_member(household_id));
create policy custom_field_defs_rw on public.custom_field_defs for all to authenticated
  using (app.is_member(household_id)) with check (app.is_member(household_id));
create policy expenses_rw on public.expenses for all to authenticated
  using (app.is_member(household_id)) with check (app.is_member(household_id));
create policy budgets_rw on public.budgets for all to authenticated
  using (app.is_member(household_id)) with check (app.is_member(household_id));
create policy ai_insights_read on public.ai_insights for select to authenticated
  using (app.is_member(household_id));

-- agent_runs: escribe la Edge Function con service_role (bypassa RLS); el usuario solo lee lo suyo.
create policy agent_runs_read on public.agent_runs for select to authenticated
  using (app.is_member(household_id));
