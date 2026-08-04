import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from '@/data/supabase';
import { restoreHouseholdId, useSessionStore } from '@/state/session';

const queryClient = new QueryClient();

/** Redirige entre (auth) y (app) según haya sesión — expo-router no tiene guards nativos. */
function useSessionGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { session, isLoading, setSession, setLoading, setHouseholdId } = useSessionStore();

  useEffect(() => {
    void restoreHouseholdId();
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      // Sin sesión recuperable (o storage roto) ⇒ tratar como "sin sesión", nunca dejar
      // el guard colgado sin redirigir a sign-in.
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Sin esto, el household activo persistido sobrevive al cierre de sesión y se
      // "hereda" si otro usuario inicia sesión después en el mismo dispositivo.
      if (event === 'SIGNED_OUT') setHouseholdId(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [setSession, setLoading, setHouseholdId]);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, isLoading, segments, router]);
}

function RootNavigation() {
  useSessionGuard();
  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigation />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
