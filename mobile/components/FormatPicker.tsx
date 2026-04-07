import { Pressable, StyleSheet, Text, View } from "react-native";

export type DownloadFormat = {
  kind: "video" | "audio";
  qualityId: string;
};

const QUALITY = [
  { id: "best", label: "Best" },
  { id: "1080", label: "1080p" },
  { id: "720", label: "720p" },
  { id: "480", label: "480p" },
] as const;

type Props = {
  value: DownloadFormat;
  onChange: (v: DownloadFormat) => void;
  disabled?: boolean;
};

export function FormatPicker({ value, onChange, disabled }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Output</Text>
      <View style={styles.row}>
        {(["video", "audio"] as const).map((k) => (
          <Pressable
            key={k}
            disabled={disabled}
            style={[
              styles.kind,
              value.kind === k && styles.kindActive,
              disabled && styles.disabled,
            ]}
            onPress={() => onChange({ ...value, kind: k })}
          >
            <Text
              style={[
                styles.kindText,
                value.kind === k && styles.kindTextActive,
              ]}
            >
              {k === "video" ? "Video" : "Audio"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.subLabel}>Quality</Text>
      <View style={styles.qualityWrap}>
        {QUALITY.map((q) => (
          <Pressable
            key={q.id}
            disabled={disabled}
            style={[
              styles.qualityChip,
              value.qualityId === q.id && styles.qualityChipActive,
              disabled && styles.disabled,
            ]}
            onPress={() => onChange({ ...value, qualityId: q.id })}
          >
            <Text
              style={[
                styles.qualityText,
                value.qualityId === q.id && styles.qualityTextActive,
              ]}
            >
              {q.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  subLabel: { fontSize: 12, color: "#71717a" },
  row: { flexDirection: "row", gap: 10 },
  kind: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3f3f46",
    alignItems: "center",
    backgroundColor: "#18181b",
  },
  kindActive: {
    borderColor: "#0ea5e9",
    backgroundColor: "#0c4a6e33",
  },
  kindText: { color: "#a1a1aa", fontWeight: "600" },
  kindTextActive: { color: "#e0f2fe" },
  disabled: { opacity: 0.45 },
  qualityWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  qualityChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
  },
  qualityChipActive: {
    borderColor: "#0ea5e9",
    backgroundColor: "#0c4a6e44",
  },
  qualityText: { color: "#d4d4d8", fontSize: 13, fontWeight: "500" },
  qualityTextActive: { color: "#e0f2fe" },
});
