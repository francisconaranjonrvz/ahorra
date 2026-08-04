import { supabase } from '@/data/supabase';
import {
  parseExpenseRequestSchema,
  parseExpenseResponseSchema,
  type ParseExpenseRequest,
  type ParseExpenseResponse,
} from '@/domain/schemas/agent-contract';

export async function parseExpenseText(input: ParseExpenseRequest): Promise<ParseExpenseResponse> {
  const body = parseExpenseRequestSchema.parse(input);
  const { data, error } = await supabase.functions.invoke('agent-parse-expense', { body });
  if (error) throw error;
  return parseExpenseResponseSchema.parse(data);
}
