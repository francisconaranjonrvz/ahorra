import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { createExpense } from '@/data/repositories/expenses';
import { todayInMadrid } from '@/domain/civil-date';
import { newId } from '@/domain/id';
import { centsFromEuroString } from '@/domain/money';
import { useSessionStore } from '@/state/session';
import { colors, radius, spacing, typography } from '@/ui/theme';

/** Acepta prefill vía query params cuando llega desde el borrador del asistente (ver src/ai/to-draft.ts). */
export default function NewExpense() {
  const params = useLocalSearchParams<{
    amount?: string;
    merchant?: string;
    occurredOn?: string;
  }>();
  const householdId = useSessionStore((s) => s.householdId);
  const queryClient = useQueryClient();

  const [amountText, setAmountText] = useState(params.amount ?? '');
  const [merchant, setMerchant] = useState(params.merchant ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSave() {
    setError(null);
    const cents = centsFromEuroString(amountText);
    if (cents === null) {
      setError('Importe no válido');
      return;
    }
    if (!householdId) {
      setError('Sin household activo');
      return;
    }
    setSubmitting(true);
    try {
      await createExpense({
        household_id: householdId,
        category_id: null,
        amount_cents: cents,
        occurred_on: params.occurredOn ?? todayInMadrid(),
        merchant: merchant || null,
        note: note || null,
        source: 'manual',
        client_mutation_id: newId(),
      });
      // Sin esto la lista de gastos y el resumen de presupuesto se quedan con los
      // datos cacheados de antes de guardar — el nuevo gasto no aparece hasta refrescar.
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['budget-progress'] });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={typography.caption}>Importe (€)</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={amountText}
        onChangeText={setAmountText}
        placeholder="0,00"
      />

      <Text style={typography.caption}>Comercio</Text>
      <TextInput
        style={styles.input}
        value={merchant}
        onChangeText={setMerchant}
        placeholder="Mercadona"
      />

      <Text style={typography.caption}>Nota</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Opcional" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={onSave} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Guardando…' : 'Guardar'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg, gap: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: colors.danger, marginBottom: spacing.sm },
});
