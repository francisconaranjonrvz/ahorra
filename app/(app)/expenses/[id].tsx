import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { softDeleteExpense } from '@/data/repositories/expenses';
import { colors, radius, spacing, typography } from '@/ui/theme';

export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  async function onDelete() {
    await softDeleteExpense(id);
    await queryClient.invalidateQueries({ queryKey: ['expenses'] });
    await queryClient.invalidateQueries({ queryKey: ['budget-progress'] });
    router.back();
  }

  return (
    <View style={styles.container}>
      <Text style={typography.caption}>ID</Text>
      <Text style={typography.body}>{id}</Text>

      <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteText}>Eliminar gasto</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg },
  deleteButton: {
    marginTop: spacing.xl,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: { color: colors.danger, fontWeight: '600' },
});
