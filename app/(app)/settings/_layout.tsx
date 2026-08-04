import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Ajustes' }} />
      <Stack.Screen name="household" options={{ title: 'Household' }} />
      <Stack.Screen name="categories" options={{ title: 'Categorías' }} />
      <Stack.Screen name="custom-fields" options={{ title: 'Campos personalizados' }} />
      <Stack.Screen name="budgets" options={{ title: 'Presupuestos' }} />
    </Stack>
  );
}
