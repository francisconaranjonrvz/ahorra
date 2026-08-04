import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { listCategories } from '@/data/repositories/categories';
import { listBudgets, upsertBudget } from '@/data/repositories/budgets';
import { startOfMonthCivil, todayInMadrid } from '@/domain/civil-date';
import { centsFromEuroString, formatCentsEs, toCents } from '@/domain/money';
import { useSessionStore } from '@/state/session';
import { colors, radius, spacing, typography } from '@/ui/theme';

export default function BudgetsSettings() {
  const householdId = useSessionStore((s) => s.householdId);
  const queryClient = useQueryClient();
  const periodMonth = startOfMonthCivil(todayInMadrid());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['categories', householdId],
    queryFn: () => listCategories(householdId!),
    enabled: !!householdId,
  });

  const { data: budgets } = useQuery({
    queryKey: ['budgets', householdId, periodMonth],
    queryFn: () => listBudgets({ householdId: householdId!, periodMonth }),
    enabled: !!householdId,
  });

  async function onSave() {
    setError(null);
    const cents = centsFromEuroString(amountText);
    if (!householdId || !categoryId) return;
    if (cents === null) {
      setError('Importe no válido.');
      return;
    }
    setSaving(true);
    try {
      await upsertBudget({
        household_id: householdId,
        category_id: categoryId,
        period_month: periodMonth,
        amount_cents: cents,
      });
      setAmountText('');
      await queryClient.invalidateQueries({ queryKey: ['budgets', householdId, periodMonth] });
      await queryClient.invalidateQueries({ queryKey: ['budget-progress'] });
    } catch {
      setError('No se pudo guardar el presupuesto.');
    } finally {
      setSaving(false);
    }
  }

  const nameById = new Map((categories ?? []).map((c) => [c.id, c.name]));

  return (
    <View style={styles.container}>
      <Text style={typography.caption}>{periodMonth}</Text>

      <FlatList
        data={budgets ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.xs, marginVertical: spacing.md }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={typography.body}>
              {nameById.get(item.category_id) ?? item.category_id}
            </Text>
            <Text style={typography.heading}>{formatCentsEs(toCents(item.amount_cents))}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={typography.body}>Sin presupuestos este mes.</Text>}
      />

      <FlatList
        horizontal
        data={categories ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.xs }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, item.id === categoryId && styles.chipActive]}
            onPress={() => setCategoryId(item.id)}
          >
            <Text>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="Importe mensual (€)"
          keyboardType="decimal-pad"
          value={amountText}
          onChangeText={setAmountText}
        />
        <TouchableOpacity style={styles.button} onPress={onSave} disabled={saving || !categoryId}>
          <Text style={styles.buttonText}>{saving ? '…' : 'Guardar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg },
  row: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chip: {
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipActive: { borderWidth: 1, borderColor: colors.primary },
  createRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.sm },
});
