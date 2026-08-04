import { Stack } from 'expo-router';

export default function ExpensesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Gastos' }} />
      <Stack.Screen name="new" options={{ title: 'Nuevo gasto', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Gasto' }} />
    </Stack>
  );
}
