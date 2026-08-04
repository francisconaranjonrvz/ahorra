import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { createCustomFieldDef, listCustomFieldDefs } from '@/data/repositories/custom-fields';
import { useSessionStore } from '@/state/session';
import { colors, radius, spacing, typography } from '@/ui/theme';

export default function CustomFieldsSettings() {
  const householdId = useSessionStore((s) => s.householdId);
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: defs } = useQuery({
    queryKey: ['custom-field-defs', householdId],
    queryFn: () => listCustomFieldDefs(householdId!),
    enabled: !!householdId,
  });

  async function onCreate() {
    if (!label.trim() || !householdId) return;
    const key = label
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '') // á→a tras la normalización NFD
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 31);
    setCreating(true);
    try {
      await createCustomFieldDef({
        household_id: householdId,
        key,
        label: label.trim(),
        type: 'text',
      });
      setLabel('');
      await queryClient.invalidateQueries({ queryKey: ['custom-field-defs', householdId] });
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={defs ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.xs }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={typography.body}>{item.label}</Text>
            <Text style={typography.caption}>{item.type}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={typography.body}>Sin campos personalizados todavía.</Text>}
      />

      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="Nombre del campo (tipo texto)"
          value={label}
          onChangeText={setLabel}
        />
        <TouchableOpacity style={styles.button} onPress={onCreate} disabled={creating}>
          <Text style={styles.buttonText}>{creating ? '…' : 'Añadir'}</Text>
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
});
