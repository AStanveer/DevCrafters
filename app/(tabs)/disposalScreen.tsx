import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    Linking,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";

import BottomNavigation from "../../components/BottomNavigation";
import { supabase } from "../../lib/supabase";

export default function DisposalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const [isMarkedAsDisposed, setIsMarkedAsDisposed] = useState(false);
    const [medicine, setMedicine] = useState({
        name: "Loading...",
        dosage: "",
    });

    // Fetch medicine data
    React.useEffect(() => {
        if (params.id) fetchMedicineData();
    }, [params.id]);

    const fetchMedicineData = async () => {
        try {
            const { data, error } = await supabase
                .from("medicines")
                .select("medicine_name, dosage")
                .eq("medicine_id", params.id)
                .single();

            if (error) throw error;

            if (data) {
                setMedicine({
                    name: data.medicine_name,
                    dosage: data.dosage,
                });
            }
        } catch (error) {
            console.error("Error fetching medicine:", error);
        }
    };

    // Request location permission before opening Google Maps
    const handleFindDropOff = async () => {
        try {
            const { status } =
                await Location.requestForegroundPermissionsAsync();

            if (status !== "granted") {
                Alert.alert(
                    "Permission Required",
                    "Location permission is needed to find nearby drop-off sites."
                );
                return;
            }

            // Get current location (optional but confirms permission works)
            const location = await Location.getCurrentPositionAsync({});

            console.log("User Location:", location.coords);

            // Open Google Maps search
            const url =
                "https://www.google.com/maps/search/medicine+drop+off+locations";

            await Linking.openURL(url);
        } catch (error) {
            console.error("Error opening maps:", error);
            Alert.alert("Error", "Unable to open Google Maps");
        }
    };

    const handleMarkAsDisposed = async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                Alert.alert("Error", "User not authenticated");
                return;
            }

            const { error } = await supabase.from("disposal_log").insert({
                medicine_id: params.id,
                user_id: user.id,
                action_type: "DISPOSED_PHYSICALLY",
                can_revert: false,
                action_timestamp: new Date().toISOString(),
            });

            if (error) throw error;

            setIsMarkedAsDisposed(true);

            Alert.alert("Success", "Medicine marked as disposed");
        } catch (error) {
            console.error("Error marking as disposed:", error);
            Alert.alert("Error", "Failed to mark as disposed");
        }
    };

    const basicSteps = [
        "Remove medicine from original container",
        "Mix with undesirable substance",
        "Place mixture in sealed bag",
        "Dispose in household trash",
    ];

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <LinearGradient
                    style={styles.gradientBg}
                    locations={[0, 0.5, 1]}
                    colors={[
                        "#f8fafc",
                        "rgba(239, 246, 255, 0.3)",
                        "rgba(236, 254, 255, 0.2)",
                    ]}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <Pressable
                                onPress={() => router.back()}
                                style={styles.backButton}
                            >
                                <Feather
                                    name="arrow-left"
                                    size={24}
                                    color="#0f172a"
                                />
                            </Pressable>

                            <View>
                                <Text style={styles.title}>
                                    Medicine Disposal
                                </Text>
                                <Text style={styles.subtitle}>
                                    Safe disposal guidance
                                </Text>
                            </View>
                        </View>

                        {/* Medicine Card */}
                        <View style={styles.medCard}>
                            <View style={styles.medCardContent}>
                                <View>
                                    <Text style={styles.medName}>
                                        {medicine.name}
                                    </Text>

                                    <Text style={styles.medDosage}>
                                        {medicine.dosage}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Main Instruction */}
                        <LinearGradient
                            colors={["#f0f9ff", "#eff6ff"]}
                            style={styles.warningCard}
                        >
                            <View
                                style={[
                                    styles.warningContent,
                                    {
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 16,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.warningIconCircle,
                                        {
                                            backgroundColor:
                                                "rgba(14, 165, 233, 0.1)",
                                        },
                                    ]}
                                >
                                    <Feather
                                        name="map-pin"
                                        size={28}
                                        color="#0ea5e9"
                                    />
                                </View>

                                <Text
                                    style={[
                                        styles.warningText,
                                        {
                                            textAlign: "center",
                                            fontSize: 16,
                                            lineHeight: 24,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={{
                                            fontWeight: "600",
                                            color: "#0f172a",
                                        }}
                                    >
                                        To ensure safe disposal, select an
                                        authorized drop-off site below.
                                    </Text>
                                </Text>
                            </View>

                            <Pressable
                                style={styles.findButton}
                                onPress={handleFindDropOff}
                            >
                                <LinearGradient
                                    colors={["#0ea5e9", "#2563eb"]}
                                    style={styles.buttonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Feather
                                        name="map-pin"
                                        size={18}
                                        color="white"
                                        style={{ marginRight: 8 }}
                                    />

                                    <Text style={styles.buttonText}>
                                        Find Nearby Drop-Off Sites
                                    </Text>
                                </LinearGradient>
                            </Pressable>
                        </LinearGradient>

                        {/* Home Disposal Option */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>
                                If Take-Back Not Available
                            </Text>

                            <Pressable
                                onPress={() =>
                                    router.push({
                                        pathname: "/disposalDetailScreen",
                                        params: { id: params.id },
                                    })
                                }
                            >
                                <Text style={styles.linkText}>
                                    View Detailed Guide
                                </Text>
                            </Pressable>
                        </View>

                        <View style={styles.stepsCard}>
                            <Text style={styles.stepsTitle}>
                                Basic Home Disposal Steps
                            </Text>

                            <View style={styles.stepsList}>
                                {basicSteps.map((step, index) => (
                                    <View
                                        key={index}
                                        style={styles.stepItem}
                                    >
                                        <View style={styles.checkCircle}>
                                            <Feather
                                                name="check"
                                                size={12}
                                                color="#0ea5e9"
                                            />
                                        </View>

                                        <Text style={styles.stepText}>
                                            {step}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Action Button */}
                        <Pressable
                            style={[
                                styles.mainButton,
                                isMarkedAsDisposed &&
                                    styles.disabledButton,
                            ]}
                            onPress={handleMarkAsDisposed}
                            disabled={isMarkedAsDisposed}
                        >
                            <LinearGradient
                                colors={
                                    isMarkedAsDisposed
                                        ? ["#94a3b8", "#64748b"]
                                        : ["#0ea5e9", "#2563eb"]
                                }
                                style={styles.buttonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {isMarkedAsDisposed ? (
                                    <>
                                        <Feather
                                            name="check-circle"
                                            size={18}
                                            color="white"
                                            style={{ marginRight: 8 }}
                                        />

                                        <Text style={styles.buttonText}>
                                            Marked as Disposed
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={styles.buttonText}>
                                        Mark as Disposed
                                    </Text>
                                )}
                            </LinearGradient>
                        </Pressable>
                    </ScrollView>
                </LinearGradient>

                <BottomNavigation />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },

    container: {
        flex: 1,
    },

    gradientBg: {
        flex: 1,
    },

    scrollContainer: {
        padding: 20,
        paddingBottom: 100,
    },

    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 24,
    },

    backButton: {
        padding: 8,
        marginLeft: -8,
        marginRight: 12,
    },

    title: {
        fontSize: 24,
        fontWeight: "700",
        color: "#0f172a",
    },

    subtitle: {
        fontSize: 14,
        color: "#64748b",
    },

    medCard: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
        borderWidth: 1,
        borderColor: "rgba(14, 165, 233, 0.2)",
    },

    medCardContent: {
        gap: 12,
    },

    medName: {
        fontSize: 18,
        fontWeight: "700",
        color: "#0f172a",
    },

    medDosage: {
        fontSize: 14,
        color: "#64748b",
    },

    warningCard: {
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "rgba(14, 165, 233, 0.3)",
    },

    warningContent: {
        flexDirection: "row",
        gap: 16,
        marginBottom: 16,
    },

    warningIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "rgba(14, 165, 233, 0.1)",
        alignItems: "center",
        justifyContent: "center",
    },

    warningText: {
        fontSize: 14,
        color: "#1e293b",
        lineHeight: 20,
    },

    findButton: {
        height: 56,
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#0ea5e9",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },

    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },

    sectionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748b",
    },

    linkText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#0ea5e9",
    },

    stepsCard: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },

    stepsTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: "#0f172a",
        marginBottom: 12,
    },

    stepsList: {
        gap: 12,
    },

    stepItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },

    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "rgba(14, 165, 233, 0.1)",
        alignItems: "center",
        justifyContent: "center",
    },

    stepText: {
        fontSize: 14,
        color: "#334155",
    },

    mainButton: {
        height: 52,
        borderRadius: 16,
        overflow: "hidden",
        shadowColor: "#0ea5e9",
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
        marginBottom: 20,
    },

    disabledButton: {
        opacity: 0.8,
    },

    buttonGradient: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },

    buttonText: {
        fontSize: 16,
        fontWeight: "600",
        color: "white",
    },
});