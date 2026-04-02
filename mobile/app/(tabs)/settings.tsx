import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { setApiBaseUrl } from "@/lib/api";

export default function SettingsScreen() {
  const { email, signedIn, signOut, refresh } = useAuth();
  const [baseUrl, setBaseUrl] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Session</Text>
      <View style={styles.card}>
        {signedIn ? (
          <>
            <Text style={styles.cardTitle}>Signed in</Text>
            <Text style={styles.mono}>{email ?? "—"}</Text>
            <Pressable style={styles.btn} onPress={signOut}>
              <Text style={styles.btnText}>Sign out</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>Not signed in</Text>
            <Text style={styles.hint}>
              Use your Vokler API credentials from the web app or add a login flow later.
              Tap refresh after storing tokens.
            </Text>
            <Pressable style={styles.btnSecondary} onPress={refresh}>
              <Text style={styles.btnSecondaryText}>Refresh session state</Text>
            </Pressable>
          </>
        )}
      </View>

      <Text style={styles.sectionLabel}>API base URL</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>
          Defaults to EXPO_PUBLIC_API_URL. Override per device for local dev.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="https://api.example.com"
          placeholderTextColor="#52525b"
          autoCapitalize="none"
          autoCorrect={false}
          value={baseUrl}
          onChangeText={setBaseUrl}
        />
        <Pressable
          style={[styles.btn, !baseUrl.trim() && styles.btnDisabled]}
          disabled={!baseUrl.trim()}
          onPress={() => setApiBaseUrl(baseUrl.trim())}
        >
          <Text style={styles.btnText}>Apply URL (runtime)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
    padding: 20,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#a1a1aa",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#fafafa" },
  mono: { fontSize: 14, color: "#e4e4e7" },
  hint: { fontSize: 14, color: "#a1a1aa", lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fafafa",
    fontSize: 15,
  },
  btn: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#0c0a09", fontWeight: "700", fontSize: 15 },
  btnSecondary: {
    borderWidth: 1,
    borderColor: "#3f3f46",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnSecondaryText: { color: "#e4e4e7", fontWeight: "600", fontSize: 15 },
});
