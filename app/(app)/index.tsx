import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { listTopLevelBudgetProgress } from '@/data/repositories/budgets';
import { formatCentsEs, toCents } from '@/domain/money';
import { useSessionStore } from '@/state/session';
import { useUiStore } from '@/state/ui';
import { GlassCard } from '@/ui/primitives/GlassCard';
import { colors, spacing, typography } from '@/ui/theme';

export default function Dashboard() {
  const householdId = useSessionStore((s) => s.householdId);
  const selectedMonth = useUiStore((s) => s.selectedMonth);

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budget-progress', householdId, selectedMonth],
    queryFn: () =>
      listTopLevelBudgetProgress({ householdId: householdId!, periodMonth: selectedMonth }),
    enabled: !!householdId,
  });

  if (!householdId) {
    return (
      <View style={styles.container}>
        <Text style={typography.body}>Configura tu household en Ajustes para empezar.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[typography.title, { marginBottom: spacing.md }]}>Este mes</Text>
      <FlatList
        data={budgets ?? []}
        keyExtractor={(item) => item.budget_id}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={typography.body}>Sin presupuestos definidos este mes.</Text>
          ) : null
        }
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <GlassCard>
            <Text style={typography.heading}>{formatCentsEs(toCents(item.spent_cents))}</Text>
            <Text style={typography.caption}>
              de {formatCentsEs(toCents(item.amount_cents))} presupuestados
            </Text>
          </GlassCard>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg },
});
