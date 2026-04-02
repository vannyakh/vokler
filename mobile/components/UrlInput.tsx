import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  editable?: boolean;
  onSubmit?: () => void;
};

export function UrlInput({
  value,
  onChangeText,
  editable = true,
  onSubmit,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>URL</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        placeholder="https://…"
        placeholderTextColor="#52525b"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        editable={editable}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmit}
        returnKeyType="done"
      />
      <Pressable
        style={({ pressed }) => [
          styles.paste,
          pressed && styles.pastePressed,
        ]}
        onPress={async () => {
          const text = await Clipboard.getStringAsync();
          if (text) onChangeText(text.trim());
        }}
      >
        <Text style={styles.pasteText}>Paste from clipboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#a1a1aa",
  },
  input: {
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#fafafa",
    backgroundColor: "#18181b",
  },
  inputFocused: {
    borderColor: "#0ea5e9",
  },
  paste: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  pastePressed: { opacity: 0.7 },
  pasteText: { color: "#0ea5e9", fontWeight: "600", fontSize: 14 },
});
