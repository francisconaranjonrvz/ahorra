import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseExpenseText } from '@/ai/client';
import { responseToDrafts, type ExpenseDraft } from '@/ai/to-draft';
import { todayInMadrid } from '@/domain/civil-date';
import { formatCentsEs, toCents } from '@/domain/money';
import { useSessionStore } from '@/state/session';
import { GlassCard } from '@/ui/primitives/GlassCard';
import { colors, radius, spacing, typography } from '@/ui/theme';

export default function Assistant() {
  const householdId = useSessionStore((s) => s.householdId);
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<ExpenseDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onParse() {
    if (!householdId) {
      setError('Sin household activo');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await parseExpenseText({
        household_id: householdId,
        text,
        client_today: todayInMadrid(),
      });
      setDrafts(responseToDrafts(response));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al contactar con el agente');
    } finally {
      setLoading(false);
    }
  }

  function onUseDraft(draft: ExpenseDraft) {
    router.push({
      pathname: '/(app)/expenses/new',
      params: {
        amount: draft.amount_cents !== null ? String(draft.amount_cents / 100) : undefined,
        merchant: draft.merchant ?? undefined,
        occurredOn: draft.occurred_on,
      },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={typography.title}>Asistente</Text>
      <TextInput
        style={styles.input}
        placeholder="42 euros de compra en el Mercadona ayer"
        value={text}
        onChangeText={setText}
        multiline
      />
      <TouchableOpacity style={styles.button} onPress={onParse} disabled={loading || !text}>
        <Text style={styles.buttonText}>{loading ? 'Analizando…' : 'Analizar'}</Text>
      </TouchableOpacity>

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      {drafts.map((draft, i) => (
        <GlassCard key={i}>
          {draft.clarification ? (
            <Text style={typography.body}>{draft.clarification}</Text>
          ) : (
            <>
              <Text style={typography.heading}>
                {draft.amount_cents !== null
                  ? formatCentsEs(toCents(draft.amount_cents))
                  : '¿Importe?'}
              </Text>
              <Text style={typography.caption}>
                {draft.merchant ?? 'Sin comercio'} · {draft.occurred_on}
                {draft.needsConfirmation ? ' · revisar' : ''}
              </Text>
            </>
          )}
          <TouchableOpacity onPress={() => onUseDraft(draft)} style={styles.useButton}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Usar como borrador</Text>
          </TouchableOpacity>
        </GlassCard>
      ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: '#fff',
    minHeight: 60,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  useButton: { marginTop: spacing.sm },
});
