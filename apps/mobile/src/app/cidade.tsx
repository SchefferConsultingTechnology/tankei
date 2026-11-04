import { BRAZIL_STATES, type CityWithStations } from '@tankei/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCities } from '@/api/queries';
import { usePlace } from '@/place';
import { colors, fontSize, radius, spacing } from '@/theme';

/** Sem acentos e em minúsculas, para a busca: "São José" → "sao jose". */
function searchable(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Escolha de cidade em dois passos: estado e cidade (ADR 0014). */
export default function ChooseCityScreen() {
  const { place, setPlace } = usePlace();
  const [state, setState] = useState<string | null>(
    place.kind === 'city' ? place.municipality.state : null,
  );
  const [search, setSearch] = useState('');
  const cities = useCities(state);

  const filtered = useMemo(() => {
    const term = searchable(search.trim());
    const list = cities.data ?? [];
    return term ? list.filter((c) => searchable(c.name).includes(term)) : list;
  }, [cities.data, search]);

  function choose(city: CityWithStations) {
    setPlace({
      kind: 'city',
      municipality: { code: city.code, name: city.name, state: city.state },
    });
    router.back();
  }

  if (!state) {
    return (
      <FlatList
        data={BRAZIL_STATES}
        keyExtractor={(item) => item.code}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.step}>Escolha o estado</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => setState(item.code)}
            accessibilityRole="button"
          >
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.muted}>{item.code}</Text>
          </Pressable>
        )}
      />
    );
  }

  const stateName = BRAZIL_STATES.find((s) => s.code === state)?.name;
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.step}>Cidades de {stateName}</Text>
          <Pressable
            onPress={() => {
              setState(null);
              setSearch('');
            }}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Trocar estado</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar cidade"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoFocus
          accessibilityLabel="Buscar cidade"
        />
      </View>
      {cities.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : cities.isError ? (
        <Text style={styles.error}>{cities.error.message}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.muted}>Nenhuma cidade encontrada.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => choose(item)}
              accessibilityRole="button"
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.muted}>
                {item.stations} {item.stations === 1 ? 'posto' : 'postos'}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  step: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  link: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  search: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowTitle: { color: colors.text, fontSize: fontSize.lg },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  loading: { marginTop: spacing.xl },
  error: { color: colors.danger, padding: spacing.xl, textAlign: 'center' },
});
