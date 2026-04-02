import { Pressable, StyleSheet, Text, View } from "react-native";

import type { JobDto } from "@/hooks/useDownload";

type Props = {
  job: JobDto | null;
  error: string | null;
  onDismiss: () => void;
};

export function ProgressCard({ job, error, onDismiss }: Props) {
  if (!job && !error) return null;

  if (error) {
    return (
      <View style={[styles.card, styles.cardError]}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Pressable style={styles.btn} onPress={onDismiss}>
          <Text style={styles.btnText}>Dismiss</Text>
        </Pressable>
      </View>
    );
  }

  if (!job) return null;

  const pct = Math.min(100, Math.max(0, job.progress));

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Job</Text>
        <Text style={styles.status}>{job.status}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.meta}>{Math.round(pct)}% · {job.platform ?? "auto"}</Text>
      {job.result_path ? (
        <Text style={styles.result} numberOfLines={2}>
          {job.result_path}
        </Text>
      ) : null}
      {job.error_message ? (
        <Text style={styles.errorBody}>{job.error_message}</Text>
      ) : null}
      {["completed", "failed"].includes(job.status) ? (
        <Pressable style={styles.btnGhost} onPress={onDismiss}>
          <Text style={styles.btnGhostText}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: 10,
  },
  cardError: { borderColor: "#7f1d1d" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#fafafa" },
  status: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0ea5e9",
    textTransform: "uppercase",
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#27272a",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#0ea5e9",
    borderRadius: 4,
  },
  meta: { fontSize: 13, color: "#a1a1aa" },
  result: { fontSize: 12, color: "#d4d4d8" },
  errorBody: { fontSize: 14, color: "#fecaca", lineHeight: 20 },
  btn: {
    marginTop: 4,
    backgroundColor: "#0ea5e9",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#0c0a09", fontWeight: "700" },
  btnGhost: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  btnGhostText: { color: "#a1a1aa", fontWeight: "600" },
});
