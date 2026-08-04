import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_RUNS_PER_MINUTE = 10;

/**
 * Throttle propio antes de llamar al proveedor (plan §3.5): protege la cuota de
 * NVIDIA Build frente a un bucle de reintentos del cliente. `client` debe ser
 * el service-role client (bypassa RLS para poder contar entre households).
 */
export async function isRateLimited(client: SupabaseClient, userId: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await client
    .from('agent_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneMinuteAgo);

  if (error) throw error;
  return (count ?? 0) >= MAX_RUNS_PER_MINUTE;
}
