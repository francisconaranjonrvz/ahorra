import { supabase } from '@/data/supabase';
import { customFieldDefSchema, type CustomFieldDefDto } from '@/domain/schemas/custom-field';

export async function listCustomFieldDefs(householdId: string): Promise<CustomFieldDefDto[]> {
  const { data, error } = await supabase
    .from('custom_field_defs')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return customFieldDefSchema.array().parse(data);
}

export async function createCustomFieldDef(input: {
  household_id: string;
  key: string;
  label: string;
  type: CustomFieldDefDto['type'];
  options?: string[] | null;
  required?: boolean;
}): Promise<CustomFieldDefDto> {
  const { data, error } = await supabase.from('custom_field_defs').insert(input).select().single();
  if (error) throw error;
  return customFieldDefSchema.parse(data);
}
