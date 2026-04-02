import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";

import { FormatPicker, type DownloadFormat } from "@/components/FormatPicker";
import { ProgressCard } from "@/components/ProgressCard";
import { UrlInput } from "@/components/UrlInput";
import { useDownload } from "@/hooks/useDownload";

export default function DownloadScreen() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<DownloadFormat>({
    kind: "video",
    qualityId: "best",
  });

  const { job, busy, error, start, reset } = useDownload();

  const onSubmit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert("URL required", "Paste a video or stream URL.");
      return;
    }
    try {
      await start(trimmed, format);
    } catch {
      /* surfaced via error state */
    }
  }, [url, format, start]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Vokler</Text>
        <Text style={styles.subtitle}>
          Paste a URL to queue a download on your Vokler API.
        </Text>
        <UrlInput
          value={url}
          onChangeText={setUrl}
          editable={!busy}
          onSubmit={onSubmit}
        />
        <FormatPicker value={format} onChange={setFormat} disabled={busy} />
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            busy && styles.primaryBtnDisabled,
            pressed && !busy && styles.primaryBtnPressed,
          ]}
          disabled={busy}
          onPress={onSubmit}
        >
          <Text style={styles.primaryBtnText}>
            {busy ? "Working…" : "Start download"}
          </Text>
        </Pressable>
        <ProgressCard job={job} error={error} onDismiss={reset} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#09090b" },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fafafa",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#a1a1aa",
    lineHeight: 22,
    marginTop: -8,
  },
  primaryBtn: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnPressed: { opacity: 0.9 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    color: "#0c0a09",
    fontWeight: "800",
    fontSize: 16,
  },
});
