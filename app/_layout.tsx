import { StripeProvider } from "@stripe/stripe-react-native";
import { Slot, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Alert } from "react-native";
import * as Linking from "expo-linking";
import FloatingChatbot from "./(tabs)/FloatingChatbot"; // Correct path
import { Biometrics } from "../lib/biometrics";
import { supabase } from "../lib/supabase";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const handleInitialFlow = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && (initialUrl.includes("access_token") || initialUrl.includes("create-new-password"))) {
        handleDeepLink(initialUrl);
      } else {
        checkBiometricLogin();
      }
    };

    handleInitialFlow();

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        router.push({
          pathname: "/intake/confirm",
          params: {
            reminderId: data.reminderId,
            medicineName: data.medicineName,
            scheduledTime: data.scheduledTime,
          },
        });
      }
    );

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          const isEnabled = await Biometrics.isEnabled();
          if (isEnabled) {
            await Biometrics.saveSession(session.refresh_token);
          }
        }
      }
    });

    return () => {
      subscription.remove();
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkBiometricLogin = async () => {
    const hasSession = await Biometrics.hasSavedSession();
    const isEnabled = await Biometrics.isEnabled();

    if (hasSession && isEnabled) {
      const authenticated = await Biometrics.authenticate();
      if (authenticated) {
        const refreshToken = await Biometrics.getSession();
        if (refreshToken) {
          // Use refreshSession instead of setSession to explicitly rotate the token
          const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken,
          });

          if (!error && data.session) {
            router.replace("/home");
          } else {
            console.log("Biometric session refresh failed:", error);
            router.replace("/login");
          }
        }
      } else {
        // User cancelled or failed biometrics -> Go to login
        router.replace("/login");
      }
    }
  };

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Handle initial URL if app was closed
    // Linking.getInitialURL() is handled in the main useEffect to avoid race conditions

    return () => subscription.remove();
  }, []);

  const handleDeepLink = async (url: string) => {
    // Explicitly sign out to clear any stale state/invalid tokens
    await supabase.auth.signOut();

    // Parse the URL
    let { queryParams } = Linking.parse(url);
    let access_token = queryParams?.access_token;
    let refresh_token = queryParams?.refresh_token;

    // Fallback: Manually parse hash if tokens are missing (Supabase often uses #)
    if (!access_token || !refresh_token) {
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        const hash = url.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);
        access_token = params.get('access_token');
        refresh_token = params.get('refresh_token');
      }
    }

    // Handle array vs string cases
    const accessToken = Array.isArray(access_token) ? access_token[0] : access_token;
    const refreshToken = Array.isArray(refresh_token) ? refresh_token[0] : refresh_token;

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!error) {
        router.replace("/create-new-password");
      }
    }
  };

  return (
    <StripeProvider publishableKey="pk_test_51SZjX3BeY3ZAHzFTA7Ow7C1P4RN1pYcw4pJdlx0WhcKUHYkkHeiBhnlX4YBRDHBvwufenHtaULHB9sxVeZqNYMgZ00nQo5Sfve">
      <Slot />
      <FloatingChatbot />
    </StripeProvider>
  );
}