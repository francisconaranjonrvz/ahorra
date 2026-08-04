-- Guarda contra la pausa automática de Supabase free tier a los 7 días sin
-- actividad de BD (plan, riesgo #2). Expuesta a `anon` a propósito: el keep-alive
-- de GitHub Actions no necesita autenticarse, solo tocar Postgres.
create or replace function public.keepalive()
returns int language sql stable as $$ select 1; $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
