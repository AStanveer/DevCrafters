import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Text,
  Image,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

export default function CreateNewPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let mounted = true;

    const setupSession = async () => {
      // 1. Check if we already have a session
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (initialSession && mounted) {
        return;
      }

      // 2. If not, wait for the session to be set by _layout.tsx
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && mounted) {
          // Session received
        }
      });

      // 3. Set a timeout to show error if session never arrives (e.g. 5 seconds)
      setTimeout(async () => {
        if (!mounted) return;
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          Alert.alert(
            "Error",
            "Unable to verify your reset request. Please request a new reset link.",
            [{ text: "OK", onPress: () => router.push("/forgot-password") }]
          );
        }
      }, 5000);

      return () => {
        authListener.subscription.unsubscribe();
      };
    };

    setupSession();

    return () => {
      mounted = false;
    };
  }, []);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert("Error", "Please fill in both password fields");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (error.message.includes("token") || error.message.includes("session")) {
          Alert.alert(
            "Session Expired",
            "Your reset link has expired. Please request a new one.",
            [{ text: "OK", onPress: () => router.push("/forgot-password") }]
          );
        } else {
          Alert.alert("Error", error.message);
        }
      } else {
        Alert.alert("Success", "Password updated successfully", [
          { text: "OK", onPress: () => router.replace("/login") },
        ]);
      }
    } catch {
      Alert.alert("Error", "Unexpected error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Create New Password</Text>
      <Text style={styles.subtitle}>
        Choose a strong password to secure your account
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>New Password</Text>
        <View style={styles.inputRow}>
          <Image source={require("../assets/passwordIcon.png")} style={styles.icon} />
          <TextInput
            placeholder="Enter new password"
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Image
              source={
                showPassword
                  ? require("../assets/eye-open.png")
                  : require("../assets/eye-closed.png")
              }
              style={styles.eyeIcon}
            />
          </Pressable>
        </View>

        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.inputRow}>
          <Image source={require("../assets/passwordIcon.png")} style={styles.icon} />
          <TextInput
            placeholder="Confirm new password"
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
          />
          <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Image
              source={
                showConfirmPassword
                  ? require("../assets/eye-open.png")
                  : require("../assets/eye-closed.png")
              }
              style={styles.eyeIcon}
            />
          </Pressable>
        </View>

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Updating..." : "Reset Password"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Remember your password?</Text>
        <Pressable onPress={() => router.push("/login")}>
          <Text style={styles.link}>Sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E0EFF6",
    padding: 24,
    justifyContent: "left",
  },
  title: {
    fontSize: 22,
    color: "#0f172a",
    fontWeight: "600",
    textAlign: "left",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "left",
    marginBottom: 24,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    color: "#0f172a",
    fontSize: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 42,
    backgroundColor: "#f8fafc",
  },
  icon: { width: 18, height: 18, tintColor: "#64748b", marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: "#0f172a" },
  eyeIcon: { width: 18, height: 18, tintColor: "#64748b" },
  button: {
    backgroundColor: "#0ea5e9",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 20,
    alignItems: "center",
  },
  disabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontWeight: "500", fontSize: 15 },
  footer: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: { color: "#64748b", fontSize: 13 },
  link: { color: "#0ea5e9", fontSize: 13, fontWeight: "500", marginLeft: 5 },
});