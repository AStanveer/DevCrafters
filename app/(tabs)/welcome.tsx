import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function welcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* App Logo */}
      <Image
        source={require("../../assets/pilloraLogo.png")} 
        style={styles.logo}
      />

      {/* Title */}
      <Text style={styles.title}>Welcome to Pillora</Text>

      {/* Subtitle / Intro */}
      <Text style={styles.subtitle}>
        Your medication companion, on time
      </Text>

      {/* Illustration */}
      <Image
        source={require("../../assets/welcome-illustration.png")} 
        style={styles.illustration}
        resizeMode="contain"
      />

      {/* Get Started Button */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/login")}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>

      {/* Footer */}
      <Text style={styles.footerText}>© 2025 Pillora. All rights reserved.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E7F1FF", // light blue background
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1C3F94",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#4A4A4A",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  illustration: {
    width: "90%",
    height: 220,
    marginBottom: 50,
  },
  button: {
    backgroundColor: "#1C3F94",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footerText: {
    fontSize: 12,
    color: "#777",
    marginTop: 40,
  },
});