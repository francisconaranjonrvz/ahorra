import { z } from 'zod';

import { supabase } from '@/data/supabase';

const householdSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  base_currency: z.literal('EUR'),
});
export type HouseholdDto = z.infer<typeof householdSchema>;

/** Households a los que pertenece el usuario autenticado (join vía RLS, no hace falta filtrar por user_id). */
export async function listMyHouseholds(): Promise<HouseholdDto[]> {
  const { data, error } = await supabase.from('households').select('*').order('created_at');
  if (error) throw error;
  return householdSchema.array().parse(data);
}

/**
 * RPC `create_household` (migración 20260804000002): crea el household — el trigger
 * `households_seed_owner` autoinscribe al creador como owner — y siembra la taxonomía
 * por defecto es-ES salvo que se pida explícitamente empezar en blanco.
 */
export async function createHousehold(name: string, seedDefaults = true): Promise<HouseholdDto> {
  const { data, error } = await supabase.rpc('create_household', {
    household_name: name,
    seed_defaults: seedDefaults,
  });
  if (error) throw error;
  return householdSchema.parse(data);
}
