import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type { HistoryEntryDto } from "@/lib/types";
import { api } from "@/lib/api";

type Props = {
  entry: HistoryEntryDto;
  onRemoved: (id: string) => void;
};

export function DownloadItem({ entry, onRemoved }: Props) {
  const [busy, setBusy] = useState(false);

  const remove = useCallback(() => {
    Alert.alert(
      "Remove from history",
      "This only removes the history entry on the server.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await api.delete(`/history/${entry.id}`);
                onRemoved(entry.id);
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [entry.id, onRemoved]);

  return (
    <View style={styles.card}>
      <Text style={styles.title} numberOfLines={2}>
        {entry.title}
      </Text>
      <Text style={styles.url} numberOfLines={2}>
        {entry.source_url}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {entry.artifact_uri}
      </Text>
      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={remove}
      >
        <Text style={styles.btnText}>{busy ? "Removing…" : "Remove"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: "600", color: "#fafafa" },
  url: { fontSize: 13, color: "#a1a1aa" },
  meta: { fontSize: 12, color: "#52525b" },
  btn: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3f3f46",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fecaca", fontWeight: "600", fontSize: 13 },
});
