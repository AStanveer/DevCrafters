import React from "react";
import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, Pressable, ScrollView, useWindowDimensions, ImageSourcePropType } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNavigation from "../../components/BottomNavigation";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useCallback } from "react";
import { Biometrics } from "../../lib/biometrics";

type SettingRowProps = {
  title: string;
  subtitle: string;
  icon: ImageSourcePropType;
  onPress?: () => void;
};

const SettingRow: React.FC<SettingRowProps> = ({ title, subtitle, icon, onPress }) => (
  <Pressable style={styles.settingRow} onPress={onPress}>
    {/* Light blue circle with icon inside */}
    <View style={styles.iconCircle}>
      <Image source={icon} style={styles.settingIcon} resizeMode="contain" />
    </View>

    <View style={styles.settingText}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingSubtitle}>{subtitle}</Text>
    </View>
  </Pressable>
);

const Profile: React.FC = () => {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [userData, setUserData] = useState({ username: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [disposalCount, setDisposalCount] = useState(0); // Initialize with 0

  useFocusEffect(
    useCallback(() => {
      fetchDisposalCount();
    }, [])
  );

  const fetchDisposalCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('medicines')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_disposable', true);

      if (error) console.error('Error fetching disposal count:', error);
      else setDisposalCount(count || 0);

    } catch (error) {
      console.error('Error in fetchDisposalCount:', error);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', user.id)
          .single();

        console.log('User ID:', user.id); // Debug log
        console.log('Profile data:', profile); // Debug log

        if (profile) {
          setUserData({
            username: profile.username,
            email: user.email || 'No email' // Get email from auth user
          });
        } else {
          // If no profile exists, use auth user data
          setUserData({
            username: 'User',
            email: user.email || 'No email'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };



  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.profileTitle}>Profile</Text>
          <Text style={styles.profileSubtitle}>Manage your account settings</Text>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <LinearGradient
            colors={['#0ea5e9', '#0284c7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {userData.username ? userData.username.substring(0, 2).toUpperCase() : 'U'}
            </Text>
          </LinearGradient>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userData.username || 'User'}</Text>
            <Text style={styles.userEmail}>{userData.email || 'No email'}</Text>
          </View>
        </View>

        {/* Medicine Disposal Card */}
        <Pressable
          style={[styles.disposalCardContainer]}
          onPress={() => router.push("/disposalListScreen")}
        >
          <LinearGradient
            colors={disposalCount > 0 ? ['#fef2f2', '#fff7ed'] : ['#f8fafc', '#f9fafb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.disposalCard, disposalCount > 0 && styles.disposalCardAlert]}
          >
            <View style={[styles.disposalIconBox, disposalCount > 0 ? styles.disposalIconBoxAlert : styles.disposalIconBoxDefault]}>
              <Feather name="trash-2" size={16} color={disposalCount > 0 ? "#ef4444" : "#94a3b8"} />
            </View>

            <View style={styles.disposalContent}>
              <Text style={styles.disposalTitle}>Medicine Disposal List</Text>
              <Text style={styles.disposalSubtitle}>
                {disposalCount > 0
                  ? `${disposalCount} ${disposalCount === 1 ? 'item' : 'items'} pending disposal`
                  : 'No items for disposal'
                }
              </Text>
            </View>

            <View style={styles.disposalRight}>
              {disposalCount > 0 && (
                <View style={styles.disposalBadge}>
                  <Text style={styles.disposalBadgeText}>{disposalCount}</Text>
                </View>
              )}
              <Feather name="chevron-right" size={16} color="#94a3b8" />
            </View>
          </LinearGradient>
        </Pressable>

        {/* Settings */}
        <View style={styles.settingsContainer}>

          <SettingRow
            title="Order History"
            subtitle="View your past orders"
            icon={require("../../assets/profileMedicalHis.png")}
            onPress={() => router.push("/orderHistory")}
          />
          <SettingRow
            title="Personal Information"
            subtitle="Update your details"
            icon={require("../../assets/profilePersonalIn.png")}
            onPress={() => router.push("/personal-information")} // Navigate to PersonalInformation
          />
          <SettingRow
            title="Medical History"
            subtitle="View reports and records"
            icon={require("../../assets/profileMedicalHis.png")}
            onPress={() => router.push("/MedicationHistoryScreen")}
          />
          <SettingRow
            title="Payment Methods"
            subtitle="Saved cards and wallets"
            icon={require("../../assets/profilePayment.png")}
          />
          <SettingRow
            title="Pharmacies"
            subtitle="Manage preferred locations"
            icon={require("../../assets/profilePharmacy.png")}
            onPress={() => router.push("/pharmacyLocator")}
          />
          <SettingRow
            title="Privacy & Security"
            subtitle="Control your data"
            icon={require("../../assets/profilePrivacy.png")}
            onPress={() => router.push("/privacySecurityScreen")}
          />
          <SettingRow
            title="Help & Support"
            subtitle="Get assistance"
            icon={require("../../assets/profileHelp.png")}
            onPress={() => router.push("/helpSupport")}
          />
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={async () => {
          await Biometrics.deleteSession();
          await supabase.auth.signOut();
          router.push("/login");
        }}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        {/* Version */}
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>

      {/* Bottom navigation */}
      <BottomNavigation />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  // Header
  header: { padding: 20 },
  profileTitle: { fontSize: 20, fontWeight: "bold", color: "#0f172a" },
  profileSubtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },

  // User card
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 16,
    marginTop: 10,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  userInfo: { marginLeft: 16 },
  userName: { fontSize: 16, fontWeight: "bold", color: "#0f172a" },
  userEmail: { fontSize: 12, color: "#64748b", marginTop: 2 },
  userSince: { fontSize: 12, color: "#64748b", marginTop: 2 },

  // Settings
  settingsContainer: { marginTop: 20 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 15,
    marginVertical: 6,
    elevation: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(14, 165, 233, 0.3)", // light blue circle
    justifyContent: "center",
    alignItems: "center",
  },
  settingIcon: { width: 24, height: 24 },
  settingText: { flex: 1, marginLeft: 12 },
  settingTitle: { fontSize: 14, fontWeight: "bold", color: "#0f172a" },
  settingSubtitle: { fontSize: 12, color: "#64748b", marginTop: 2 },

  // Logout
  logoutButton: {
    marginTop: 30,
    alignSelf: "center",
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 20,
  },
  logoutText: { color: "#fff", fontSize: 14, fontWeight: "bold" },

  // Version
  versionText: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    marginVertical: 20,
  },

  // Disposal Card
  disposalCardContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    backgroundColor: 'white', // fallback
  },
  disposalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  disposalCardAlert: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  disposalIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  disposalIconBoxAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  disposalIconBoxDefault: {
    backgroundColor: '#f1f5f9',
  },
  disposalContent: {
    flex: 1,
  },
  disposalTitle: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  disposalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  disposalRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disposalBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  disposalBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default Profile;