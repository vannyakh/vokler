import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DownloadItem } from "@/components/DownloadItem";
import { api } from "@/lib/api";
import type { HistoryEntryDto } from "@/lib/types";

export default function HistoryScreen() {
  const [items, setItems] = useState<HistoryEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ items: HistoryEntryDto[] }>("/history");
    setItems(res.data.items ?? []);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No downloads yet. Finish a job to see it here.</Text>
        }
        renderItem={({ item }) => (
          <DownloadItem
            entry={item}
            onRemoved={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b" },
  centered: {
    flex: 1,
    backgroundColor: "#09090b",
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 16, paddingBottom: 32, gap: 12 },
  emptyList: { flexGrow: 1, padding: 16 },
  empty: {
    color: "#71717a",
    textAlign: "center",
    marginTop: 48,
    fontSize: 15,
    lineHeight: 22,
  },
});
