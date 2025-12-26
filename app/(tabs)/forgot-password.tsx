import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Text,
  Image,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "../../lib/supabase";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendResetLink = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    setLoading(true);
    const redirectUrl = Linking.createURL('/create-new-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert(
        "Success!",
        "Password reset link sent! Check your email.",
        [{ text: "OK", onPress: () => router.push("/login") }]
      );
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.forgotPassword}>
      <LinearGradient
        colors={["#f8fafc", "#e0f2fe"]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.container}>
          {/* Heading */}
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email to receive reset instructions.
          </Text>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputRow}>
              <Image
                source={require("../../assets/emailIcon.png")}
                style={styles.icon}
              />
              <TextInput
                placeholder="john.doe@example.com"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              We'll send you an email with instructions to reset your password.
              The link will expire in 24 hours.
            </Text>
          </View>

          {/* Send Reset Link Button */}
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendResetLink}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Text>
          </Pressable>

          {/* Sign In Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password?</Text>
            <Pressable onPress={() => router.push("/login")}>
              <Text style={styles.signInText}> Sign In</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  forgotPassword: { flex: 1, backgroundColor: "#fff" },
  background: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  container: { width: "100%", maxWidth: 400, alignItems: "center", gap: 20 },
  title: { fontSize: 22, fontWeight: "600", color: "#0f172a" },
  subtitle: { color: "#64748b", textAlign: "center", fontSize: 14, marginBottom: 20 },
  inputContainer: { width: "100%" },
  label: { color: "#0f172a", fontSize: 14, marginBottom: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1.3,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    height: 42,
  },
  icon: { width: 20, height: 20, marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: "#334155" },
  infoBox: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  infoText: { color: "#1c398e", fontSize: 12 },
  button: {
    backgroundColor: "#0ea5e9",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    width: "100%",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "500" },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: { flexDirection: "row", marginTop: 10 },
  footerText: { color: "#64748b", fontSize: 13 },
  signInText: { color: "#0ea5e9", fontSize: 13, fontWeight: "500" },
});