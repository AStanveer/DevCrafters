import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as React from "react";
import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNavigation from "../../components/BottomNavigation";
import { supabase } from "../../lib/supabase";

type Medicine = {
  id: string;
  name: string;
  strength: string;
  quantity: number;
  expiryDate?: string;
};

export default function Home() {
  const router = useRouter();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueTodayCount, setDueTodayCount] = useState(0);
  const [lowStockMed, setLowStockMed] = useState<Medicine | null>(null);

  useEffect(() => {
    const init = async () => {
      await logMissedIntakes();
      await fetchMedicines();
    };
    init();

    // Periodic check every 30 seconds for missed intakes
    const interval = setInterval(() => {
      logMissedIntakes();
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, []);

  // ------------------- Log Missed Intakes -------------------
  const logMissedIntakes = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      const { data: reminders, error: remindersError } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", user.id);

      if (remindersError || !reminders) return;

      const now = new Date();

      for (const reminder of reminders) {
        const scheduled = new Date(reminder.scheduled_time);
        const oneMinuteAfter = new Date(scheduled.getTime() + 60 * 1000);

        // Skip if intake already exists
        const { data: intakeExisting } = await supabase
          .from("intake")
          .select("*")
          .eq("reminder_id", reminder.id)
          .maybeSingle();
        if (intakeExisting) continue;

        // Skip if missed already exists
        const { data: missedExisting } = await supabase
          .from("missed_intake")
          .select("*")
          .eq("reminder_id", reminder.id)
          .maybeSingle();
        if (missedExisting) continue;

        // If scheduled + 1 minute has passed, insert as missed
        if (now >= oneMinuteAfter) {
          const malaysiaTimeISO = new Date(Date.now() + 8 * 60 * 60 * 1000)
            .toISOString()
            .replace("Z", "+08:00");

          const { error: insertError } = await supabase
            .from("missed_intake")
            .insert({
              user_id: user.id,
              reminder_id: reminder.id,
              medicine_name: reminder.medicine_name,
              scheduled_time: reminder.scheduled_time,
              missed_time: malaysiaTimeISO,
            });

          if (insertError) {
            console.error("Failed to insert missed intake:", insertError);
            continue;
          }

          console.log(`Missed intake logged for ${reminder.medicine_name}`);
        }
      }
    } catch (err) {
      console.error("Error logging missed intakes:", err);
    }
  };

  // ------------------- Fetch Medicines -------------------
  const fetchMedicines = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setLoading(false);
        return;
      }

      const { data: medicinesData, error: medicinesError } = await supabase
        .from("medicines")
        .select("*")
        .eq("user_id", user.id)
        .order("medicine_name", { ascending: true });

      if (medicinesError || !medicinesData) {
        setMedicines([]);
        setLoading(false);
        return;
      }

      const mappedMedicines: Medicine[] = medicinesData.map((med: any) => ({
        id: med.id,
        name: med.medicine_name || "",
        strength: med.dosage || "",
        quantity: med.current_stock || 0,
        expiryDate: med.expiry_date || undefined,
      }));

      setMedicines(mappedMedicines);

      // Calculate due today count
      const today = new Date();
      const dueToday = mappedMedicines.filter((med) => {
        if (!med.expiryDate) return false;
        const expiryDate = new Date(med.expiryDate);
        return (
          expiryDate.getFullYear() === today.getFullYear() &&
          expiryDate.getMonth() === today.getMonth() &&
          expiryDate.getDate() === today.getDate()
        );
      });
      setDueTodayCount(dueToday.length);

      // Find lowest stock medicine
      const lowStock = mappedMedicines
        .filter((med) => med.quantity <= 5)
        .sort((a, b) => a.quantity - b.quantity)[0] || null;
      setLowStockMed(lowStock);
    } catch (error) {
      console.error("Error fetching medicines:", error);
      setMedicines([]);
    } finally {
      setLoading(false);
    }
  };

  // ------------------- Render -------------------
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <LinearGradient
          style={styles.gradientBg}
          locations={[0, 0.5, 1]}
          colors={["#f8fafc", "rgba(239, 246, 255, 0.3)", "rgba(236, 254, 255, 0.2)"]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Upcoming Doses Card */}
            <LinearGradient
              style={styles.card}
              locations={[0, 1]}
              colors={["rgba(14, 165, 233, 0.05)", "rgba(0, 0, 0, 0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Pressable style={styles.cardPressable}>
                <Image source={require("../../assets/notiIconBlue.png")} style={styles.cardIcon} />
                <View>
                  <Text style={styles.cardTitle}>Upcoming Doses</Text>
                  <View style={styles.row}>
                    <Text style={styles.cardSubtitle}>
                      {dueTodayCount === 1
                        ? "1 medication due today"
                        : `${dueTodayCount} medications due today`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </LinearGradient>

            {/* Active Meds & Adherence */}
            <View style={styles.rowBetween}>
              <Pressable style={styles.smallCard} onPress={() => router.push("/meds")}>
                <View style={styles.smallCardContent}>
                  <Image source={require("../../assets/pillIconBlue.png")} style={styles.smallIcon} />
                  <Text style={styles.smallLabel}>Active Meds</Text>
                  <Text style={styles.smallValue}>{loading ? "..." : medicines.length}</Text>
                </View>
              </Pressable>

              <Pressable style={styles.smallCard}>
                <View style={styles.smallCardContent}>
                  <Image source={require("../../assets/arrowIconBlue.png")} style={styles.smallIcon} />
                  <Text style={styles.smallLabel}>Adherence</Text>
                  <Text style={styles.smallValue}>94%</Text>
                </View>
              </Pressable>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickGrid}>
                <Pressable style={styles.quickCard} onPress={() => router.push("/scan")}>
                  <Image source={require("../../assets/scanIconBlue.png")} style={styles.quickIcon} />
                  <Text style={styles.quickTitle}>Scan Medicine</Text>
                  <Text style={styles.quickSubtitle}>Identify pills instantly</Text>
                </Pressable>

                <Pressable style={styles.quickCard} onPress={() => router.push("/reminders")}>
                  <Image source={require("../../assets/notiIconPurple.png")} style={styles.quickIcon} />
                  <Text style={styles.quickTitle}>Reminders</Text>
                  <Text style={styles.quickSubtitle}>Manage notifications</Text>
                </Pressable>

                <Pressable style={styles.quickCard} onPress={() => router.push("/pharmacyLocator")}>
                  <Image source={require("../../assets/locationIconGreen.png")} style={styles.quickIcon} />
                  <Text style={styles.quickTitle}>Find Pharmacies</Text>
                  <Text style={styles.quickSubtitle}>Locate nearby stores</Text>
                </Pressable>

                <Pressable style={styles.quickCard} onPress={() => router.push("/analytics")}>
                  <Image source={require("../../assets/chartIconOrange.png")} style={styles.quickIcon} />
                  <Text style={styles.quickTitle}>Analytics</Text>
                  <Text style={styles.quickSubtitle}>View your insights</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </LinearGradient>

        {/* Bottom Navigation */}
        <View style={styles.bottomNavWrapper}>
          <BottomNavigation />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ------------------- Styles -------------------
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, position: "relative" },
  gradientBg: { flex: 1 },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  card: { borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  cardPressable: { flexDirection: "row", alignItems: "center", padding: 16 },
  cardIcon: { width: 40, height: 40, marginRight: 12 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  cardSubtitle: { fontSize: 14, color: "#475569", marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  smallCard: { flex: 1, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 20, marginHorizontal: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  smallCardContent: { alignItems: "center" },
  smallIcon: { width: 36, height: 36, marginBottom: 8 },
  smallLabel: { fontSize: 14, color: "#0f172a", fontWeight: "500" },
  smallValue: { fontSize: 18, color: "#0284c7", fontWeight: "700", marginTop: 4 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginBottom: 12 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 },
  quickCard: { width: "48%", backgroundColor: "#fff", borderRadius: 16, paddingVertical: 20, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  quickIcon: { width: 36, height: 36, marginBottom: 8 },
  quickTitle: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  quickSubtitle: { fontSize: 12, color: "#64748b", textAlign: "center" },
  bottomNavWrapper: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "white", borderTopWidth: 0.5, borderTopColor: "#e2e8f0", elevation: 8, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: -2 }, shadowRadius: 4 },
});

