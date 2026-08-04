import { Link } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { supabase } from '@/data/supabase';
import { colors, radius, spacing, typography } from '@/ui/theme';

const ITEMS = [
  { href: '/(app)/settings/household', label: 'Household' },
  { href: '/(app)/settings/categories', label: 'Categorías' },
  { href: '/(app)/settings/custom-fields', label: 'Campos personalizados' },
  { href: '/(app)/settings/budgets', label: 'Presupuestos' },
] as const;

export default function SettingsHub() {
  return (
    <View style={styles.container}>
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} asChild>
          <TouchableOpacity style={styles.row}>
            <Text style={typography.body}>{item.label}</Text>
          </TouchableOpacity>
        </Link>
      ))}

      <TouchableOpacity
        style={[styles.row, styles.signOut]}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={[typography.body, { color: colors.danger }]}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.bg, gap: spacing.sm },
  row: { backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md },
  signOut: { marginTop: spacing.xl },
});
