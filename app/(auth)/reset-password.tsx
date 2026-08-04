import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { supabase } from '@/data/supabase';
import { colors, radius, spacing, typography } from '@/ui/theme';

/**
 * Recuperación por código OTP de 6 dígitos (no por enlace) — decisión del plan §0.3:
 * evita el mismo problema de deep link fragil que descartó los magic links de login.
 */
export default function ResetPassword() {
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function requestCode() {
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    setSubmitting(false);
    if (err) return setError(err.message);
    setStep('confirm');
  }

  async function confirmReset() {
    setError(null);
    setSubmitting(true);
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    if (verifyErr) {
      setSubmitting(false);
      return setError(verifyErr.message);
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    if (updateErr) return setError(updateErr.message);
    router.replace('/(auth)/sign-in');
  }

  return (
    <View style={styles.container}>
      <Text style={typography.title}>Recuperar contraseña</Text>

      {step === 'request' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={requestCode} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Enviando…' : 'Enviar código'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[typography.caption, { marginBottom: spacing.sm }]}>
            Introduce el código de 6 dígitos que te hemos enviado a {email}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Código"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <TextInput
            style={styles.input}
            placeholder="Nueva contraseña"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={confirmReset} disabled={submitting}>
            <Text style={styles.buttonText}>
              {submitting ? 'Guardando…' : 'Cambiar contraseña'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
        <Text style={typography.caption}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.bg },
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
