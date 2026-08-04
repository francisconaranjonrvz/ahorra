import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { listExpenses } from '@/data/repositories/expenses';
import {
  formatCivilDateEs,
  startOfMonthCivil,
  toCivilDate,
  type CivilDate,
} from '@/domain/civil-date';
import { formatCentsEs, toCents } from '@/domain/money';
import { useSessionStore } from '@/state/session';
import { useUiStore } from '@/state/ui';
import { colors, radius, spacing, typography } from '@/ui/theme';

function nextMonthCivil(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const next = new Date(Date.UTC(y!, m!, 1));
  return toCivilDate(next);
}

export default function ExpensesList() {
  const householdId = useSessionStore((s) => s.householdId);
  const selectedMonth = useUiStore((s) => s.selectedMonth);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', householdId, selectedMonth],
    queryFn: () =>
      listExpenses({
        householdId: householdId!,
        from: startOfMonthCivil(selectedMonth),
        to: nextMonthCivil(selectedMonth),
      }),
    enabled: !!householdId,
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={expenses ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !isLoading ? <Text style={typography.body}>Sin gastos este mes.</Text> : null
        }
        contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <Link href={`/(app)/expenses/${item.id}`} asChild>
            <TouchableOpacity style={styles.row}>
              <View>
                <Text style={typography.body}>{item.merchant ?? 'Sin comercio'}</Text>
                <Text style={typography.caption}>
                  {formatCivilDateEs(item.occurred_on as CivilDate)}
                </Text>
              </View>
              <Text style={typography.heading}>{formatCentsEs(toCents(item.amount_cents))}</Text>
            </TouchableOpacity>
          </Link>
        )}
      />

      <Link href="/(app)/expenses/new" asChild>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
});
