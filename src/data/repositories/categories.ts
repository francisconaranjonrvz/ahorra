import { supabase } from '@/data/supabase';
import { categorySchema, type CategoryDto } from '@/domain/schemas/category';

export async function listCategories(householdId: string): Promise<CategoryDto[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return categorySchema.array().parse(data);
}

export async function createCategory(input: {
  household_id: string;
  parent_id: string | null;
  name: string;
  kind: 'expense' | 'income';
  icon?: string | null;
  color?: string | null;
}): Promise<CategoryDto> {
  const { data, error } = await supabase.from('categories').insert(input).select().single();
  if (error) throw error;
  return categorySchema.parse(data);
}
