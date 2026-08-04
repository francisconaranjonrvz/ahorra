-- RPC que crea un household y opcionalmente siembra la taxonomía por defecto es-ES.
-- Vive en el servidor (no en seed.sql) porque debe ejecutarse también en producción,
-- cada vez que un usuario crea un household — seed.sql solo corre en `db reset` local.

create or replace function public.create_household(household_name text, seed_defaults boolean default true)
returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  h public.households;
  root record;
  root_id uuid;
begin
  insert into public.households (name) values (household_name) returning * into h;
  -- households_seed_owner (trigger) ya inscribe al creador como owner aquí.

  if seed_defaults then
    for root in
      select * from (values
        ('Vivienda',      array['Alquiler','Suministros','Comunidad']),
        ('Alimentación',  array['Supermercado','Restaurantes','Café']),
        ('Transporte',    array['Combustible','Transporte público','Taxi']),
        ('Ocio',          array[]::text[]),
        ('Salud',         array[]::text[]),
        ('Ropa',          array[]::text[]),
        ('Suscripciones', array[]::text[]),
        ('Otros',         array[]::text[])
      ) as t(root_name, children)
    loop
      insert into public.categories (household_id, parent_id, name, kind)
      values (h.id, null, root.root_name, 'expense')
      returning id into root_id;

      insert into public.categories (household_id, parent_id, name, kind)
      select h.id, root_id, unnest(root.children), 'expense';
    end loop;
  end if;

  return h;
end;
$$;

revoke all on function public.create_household(text, boolean) from public, anon;
grant execute on function public.create_household(text, boolean) to authenticated;
