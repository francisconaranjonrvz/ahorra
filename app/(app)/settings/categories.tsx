import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { createCategory, listCategories } from '@/data/repositories/categories';
import { buildCategoryTree, type CategoryNode } from '@/domain/category-tree';
import { useSessionStore } from '@/state/session';
import { colors, radius, spacing, typography } from '@/ui/theme';

function TreeRow({ node, depth }: { node: CategoryNode; depth: number }) {
  return (
    <>
      <View style={[styles.row, { paddingLeft: spacing.md + depth * spacing.lg }]}>
        <Text style={typography.body}>{node.name}</Text>
      </View>
      {node.children.map((child) => (
        <TreeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default function CategoriesSettings() {
  const householdId = useSessionStore((s) => s.householdId);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: rows } = useQuery({
    queryKey: ['categories', householdId],
    queryFn: () => listCategories(householdId!),
    enabled: !!householdId,
  });

  const tree = buildCategoryTree(
    (rows ?? []).map((r) => ({
      id: r.id,
      parentId: r.parent_id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      kind: r.kind,
      path: r.path,
      depth: r.depth,
      isArchived: r.is_archived,
      sortOrder: r.sort_order,
    })),
  );

  async function onCreate() {
    if (!name.trim() || !householdId) return;
    setCreating(true);
    setError(null);
    try {
      await createCategory({
        household_id: householdId,
        parent_id: null,
        name: name.trim(),
        kind: 'expense',
      });
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['categories', householdId] });
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('duplicate')
          ? 'Ya existe una categoría con ese nombre.'
          : 'No se pudo crear la categoría.',
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tree}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TreeRow node={item} depth={0} />}
        ListEmptyComponent={<Text style={typography.body}>Sin categorías todavía.</Text>}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="Nueva categoría raíz"
          value={name}
          onChangeText={setName}
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
    marginBottom: spacing.xs,
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
  error: { color: colors.danger, marginTop: spacing.sm },
});
