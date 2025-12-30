import React, { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useLocalSearchParams, router } from "expo-router";

export default function AddMedicine() {
  const params = useLocalSearchParams();
  const pharmacyId = params.pharmacyId;

  const [loading, setLoading] = useState(false);
  const [medicineOptions, setMedicineOptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    referenceId: "",
    price: "",
    stock: "",
    reorderAt: "",
  });

  // Predefined categories
  const categories = [
    "Pain Relief",
    "Antibiotics",
    "Diabetes",
    "Antihistamine",
    "Gastrointestinal",
    "Cardiovascular",
    "Vitamins",
    "Other",
  ];

  useEffect(() => {
    // Fetch medicine references for search/selection
    fetchMedicineReferences();
  }, []);

  const fetchMedicineReferences = async () => {
    try {
      const { data, error } = await supabase
        .from("medicine_reference")
        .select("drug_id, medicine_name, generic_name, manufacturer, category, dosage")
        .order("medicine_name", { ascending: true });

      if (error) throw error;
      setMedicineOptions(data || []);
    } catch (error) {
      console.error("Error fetching medicine references:", error);
    }
  };

  const handleSearchMedicine = async (text) => {
    setSearchQuery(text);
    if (text.length > 2) {
      try {
        const { data, error } = await supabase
          .from("medicine_reference")
          .select("drug_id, medicine_name, generic_name, manufacturer, category, dosage")
          .or(`medicine_name.ilike.%${text}%,generic_name.ilike.%${text}%,manufacturer.ilike.%${text}%`)
          .order("medicine_name", { ascending: true })
          .limit(10);

        if (error) throw error;
        setMedicineOptions(data || []);
      } catch (error) {
        console.error("Error searching medicines:", error);
      }
    }
  };

  const handleSelectMedicine = (medicine) => {
    setSelectedMedicine(medicine);
    setFormData((prev) => ({
      ...prev,
      referenceId: medicine.drug_id,
    }));
    setShowMedicineModal(false);
    setSearchQuery(medicine.medicine_name);
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedMedicine) {
      Alert.alert("Error", "Please select a medicine");
      return;
    }
    if (!formData.price || !formData.stock) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const price = parseFloat(formData.price);
    const stock = parseInt(formData.stock);
    const reorderAt = formData.reorderAt ? parseInt(formData.reorderAt) : Math.floor(stock * 0.2);

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

      const { error } = await supabase.from("pharmacy_medicine").insert([
        {
          pharmacy_id: Number(pharmacyId),
          reference_id: formData.referenceId,
          price: price,
          stock: stock,
        },
      ]);

      if (error) throw error;

      Alert.alert(
        "Success",
        "Medicine added successfully",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error("Error adding medicine:", error);
      Alert.alert("Error", "Failed to add medicine. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add New Medicine</Text>
          <View style={{ width: 60 }} />
        </View>

        <Text style={styles.subtitle}>
          Enter the details of the medicine to add to inventory
        </Text>

        {/* Medicine Search and Selection */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Medicine Name *</Text>
          <TouchableOpacity
            style={styles.medicineInput}
            onPress={() => setShowMedicineModal(true)}
          >
            <Text style={selectedMedicine ? styles.medicineSelectedText : styles.placeholderText}>
              {selectedMedicine ? selectedMedicine.medicine_name : "Select a medicine..."}
            </Text>
          </TouchableOpacity>
          {selectedMedicine && (
            <View style={styles.medicineDetails}>
              <Text style={styles.medicineDetailText}>
                <Text style={styles.detailLabel}>Generic:</Text> {selectedMedicine.generic_name || "N/A"}
              </Text>
              <Text style={styles.medicineDetailText}>
                <Text style={styles.detailLabel}>Manufacturer:</Text> {selectedMedicine.manufacturer || "N/A"}
              </Text>
              <Text style={styles.medicineDetailText}>
                <Text style={styles.detailLabel}>Category:</Text> {selectedMedicine.category || "N/A"}
              </Text>
              <Text style={styles.medicineDetailText}>
                <Text style={styles.detailLabel}>Dosage:</Text> {selectedMedicine.dosage || "N/A"}
              </Text>
            </View>
          )}
        </View>

        {/* Price, Stock, and Reorder Fields */}
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

        <View style={styles.formSection}>
          <Text style={styles.label}>Reorder At (Optional)</Text>
          <Text style={styles.hint}>
            When stock reaches this quantity, you'll get a low stock alert.
            {formData.stock ? ` Suggested: ${Math.floor(parseInt(formData.stock) * 0.2)}` : ""}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={formData.stock ? Math.floor(parseInt(formData.stock) * 0.2).toString() : "0"}
            keyboardType="number-pad"
            value={formData.reorderAt}
            onChangeText={(text) => setFormData({ ...formData, reorderAt: text })}
          />
        </View>

        {/* Notes/Additional Info */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any additional information about this medicine..."
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
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
              {loading ? "Adding..." : "Add Medicine"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Medicine Selection Modal */}
      <Modal
        visible={showMedicineModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Medicine</Text>
              <TouchableOpacity
                onPress={() => setShowMedicineModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search medicine name, generic name, or manufacturer..."
              value={searchQuery}
              onChangeText={handleSearchMedicine}
              autoFocus
            />

            <ScrollView style={styles.medicineList}>
              {medicineOptions.length === 0 ? (
                <Text style={styles.emptyText}>No medicines found</Text>
              ) : (
                medicineOptions.map((medicine) => (
                  <TouchableOpacity
                    key={medicine.drug_id}
                    style={styles.medicineItem}
                    onPress={() => handleSelectMedicine(medicine)}
                  >
                    <View style={styles.medicineItemContent}>
                      <Text style={styles.medicineItemName}>{medicine.medicine_name}</Text>
                      <Text style={styles.medicineItemDetails}>
                        {medicine.generic_name} • {medicine.dosage || "N/A"} • {medicine.manufacturer || "N/A"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  formSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
  },
  medicineInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: "#94a3b8",
  },
  medicineSelectedText: {
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "500",
  },
  medicineDetails: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  medicineDetailText: {
    fontSize: 12,
    color: "#475569",
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: "600",
    color: "#334155",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  formGroup: {
    flex: 1,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#0f172a",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#64748b",
  },
  submitButton: {
    backgroundColor: "#0ea5e9",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: "#64748b",
  },
  searchInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    margin: 16,
    fontSize: 16,
    color: "#0f172a",
  },
  medicineList: {
    maxHeight: 400,
  },
  medicineItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  medicineItemContent: {
    gap: 4,
  },
  medicineItemName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#0f172a",
  },
  medicineItemDetails: {
    fontSize: 12,
    color: "#64748b",
  },
  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    padding: 32,
  },
});