import React, { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useLocalSearchParams, router } from "expo-router";

export default function EditMedicine() {
  const params = useLocalSearchParams();
  const pharmacyId = params.pharmacyId;
  const medicineId = params.id;
  const medicineData = params.medicineData ? JSON.parse(params.medicineData) : null;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [medicineDetails, setMedicineDetails] = useState(null);
  const [referenceDetails, setReferenceDetails] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    price: "",
    stock: "",
  });

  useEffect(() => {
    if (!medicineId || !pharmacyId) return;
    fetchMedicineDetails();
  }, [medicineId, pharmacyId]);

  const fetchMedicineDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("pharmacy_medicine")
        .select(`
          *,
          medicine_reference (
            drug_id,
            medicine_name,
            generic_name,
            manufacturer,
            category,
            dosage,
            purpose,
            how_to_take
          )
        `)
        .eq("id", medicineId)
        .eq("pharmacy_id", Number(pharmacyId))
        .single();

      if (error) {
        Alert.alert("Error", "Failed to load medicine details");
        router.back();
        return;
      }

      setMedicineDetails(data);
      setFormData({
        price: data.price?.toString() ?? "0",
        stock: data.stock?.toString() ?? "0",
      });

      setReferenceDetails(data.medicine_reference);
    } catch (e) {
      Alert.alert("Error", "Unexpected error occurred");
      router.back();
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchReferenceDetails = async (referenceId) => {
    try {
      console.log('🔍 Fetching reference details for ID:', referenceId);

      const { data, error } = await supabase
        .from("medicine_reference")
        .select("*")
        .eq("drug_id", referenceId)
        .single();

      if (error) {
        console.error('❌ Reference fetch error:', error);
        // Don't show alert here, just log
        return;
      }

      console.log('✅ Reference details fetched:', data?.medicine_name);
      setReferenceDetails(data);
    } catch (error) {
      console.error('❌ Error in fetchReferenceDetails:', error);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.price || !formData.stock) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const price = parseFloat(formData.price);
    const stock = parseInt(formData.stock);

    if (isNaN(price) || price <= 0) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    if (isNaN(stock) || stock < 0) {
      Alert.alert("Error", "Please enter a valid stock quantity");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("pharmacy_medicine")
        .update({
          price: price,
          stock: stock,
        })
        .eq("id", medicineId)
        .eq("pharmacy_id", Number(pharmacyId));

      if (error) throw error;

      Alert.alert(
        "Success",
        "Medicine updated successfully",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error("Error updating medicine:", error);
      Alert.alert("Error", "Failed to update medicine. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Medicine",
      "Are you sure you want to delete this medicine from your inventory? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("pharmacy_medicine")
                .delete()
                .eq("id", medicineId)
                .eq("pharmacy_id", Number(pharmacyId));

              if (error) throw error;

              Alert.alert(
                "Success",
                "Medicine deleted successfully",
                [
                  {
                    text: "OK",
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error) {
              console.error("Error deleting medicine:", error);
              Alert.alert("Error", "Failed to delete medicine. Please try again.");
            }
          },
        },
      ]
    );
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading medicine details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!medicineDetails || !referenceDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Medicine not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ width: 60 }} />
        </View>

        <Text style={styles.title}>Edit Medicine</Text>

        <Text style={styles.subtitle}>
          Update the details of the medicine in your inventory
        </Text>

        {/* Medicine Information (Read-only) */}
        <View style={styles.medicineInfoCard}>
          <Text style={styles.medicineName}>{referenceDetails.medicine_name}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Generic Name:</Text>
            <Text style={styles.infoValue}>{referenceDetails.generic_name || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dosage:</Text>
            <Text style={styles.infoValue}>{referenceDetails.dosage || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Category:</Text>
            <Text style={styles.infoValue}>{referenceDetails.category || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Manufacturer:</Text>
            <Text style={styles.infoValue}>{referenceDetails.manufacturer || "N/A"}</Text>
          </View>
        </View>

        {/* Editable Fields */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Inventory Details</Text>

          <View style={styles.row}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Price (RM) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Stock Quantity *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="number-pad"
                value={formData.stock}
                onChangeText={(text) => setFormData({ ...formData, stock: text })}
              />
            </View>
          </View>

          {/* Current Status */}
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Current Status:</Text>
            <View style={styles.statusBadges}>
              {parseInt(formData.stock) <= 50 && (
                <View style={[styles.badge, styles.lowStockBadge]}>
                  <Text style={styles.badgeText}>Low Stock</Text>
                </View>
              )}
              {parseFloat(formData.price) > 100 && (
                <View style={[styles.badge, styles.rxBadge]}>
                  <Text style={styles.badgeText}>Rx Only</Text>
                </View>
              )}
              {parseInt(formData.stock) > 200 && (
                <View style={[styles.badge, styles.goodStockBadge]}>
                  <Text style={styles.badgeText}>Good Stock</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={handleDelete}
            disabled={loading}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.submitButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: "#0ea5e9",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    flex: 1,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  medicineInfoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  medicineName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    color: "#0f172a",
    flex: 1,
  },
  formSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  formGroup: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#0f172a",
  },
  statusContainer: {
    marginTop: 12,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
    marginBottom: 8,
  },
  statusBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#fff",
  },
  lowStockBadge: {
    backgroundColor: "#ef4444",
  },
  rxBadge: {
    backgroundColor: "#f59e0b",
  },
  goodStockBadge: {
    backgroundColor: "#10b981",
  },
  infoBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoBoxLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
  },
  infoBoxText: {
    fontSize: 14,
    color: "#0f172a",
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  button: {
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    flex: 1,
  },
  deleteButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#dc2626",
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  submitButton: {
    backgroundColor: "#0ea5e9",
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },
});