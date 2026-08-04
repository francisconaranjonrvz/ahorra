import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { createHousehold, listMyHouseholds } from '@/data/repositories/household';
import { useSessionStore } from '@/state/session';
import { colors, radius, spacing, typography } from '@/ui/theme';

export default function HouseholdSettings() {
  const householdId = useSessionStore((s) => s.householdId);
  const setHouseholdId = useSessionStore((s) => s.setHouseholdId);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: households, refetch } = useQuery({
    queryKey: ['households'],
    queryFn: listMyHouseholds,
  });

  async function onCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const household = await createHousehold(name.trim());
      setName('');
      await refetch();
      setHouseholdId(household.id);
    } catch {
      setError('No se pudo crear el household.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={households ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, item.id === householdId && styles.rowActive]}
            onPress={() => setHouseholdId(item.id)}
          >
            <Text style={typography.body}>{item.name}</Text>
            {item.id === householdId ? <Text style={typography.caption}>Activo</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={typography.body}>Aún no perteneces a ningún household.</Text>
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="Nombre del household"
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity style={styles.button} onPress={onCreate} disabled={creating}>
          <Text style={styles.buttonText}>{creating ? '…' : 'Crear'}</Text>
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
  rowActive: { borderWidth: 1, borderColor: colors.primary },
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
