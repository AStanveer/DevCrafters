import React, { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useLocalSearchParams, router } from "expo-router";

export default function MedicineInventory() {
  const params = useLocalSearchParams();
  const pharmacyId = params.pharmacyId;

  const [medicines, setMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState([]);

  const [stats, setStats] = useState([
    {
      label: "Total Items",
      count: 0,
      color: "#0ea5e9",
      bgColor: "#f0f9ff",
      borderColor: "rgba(14, 165, 233, 0.2)",
      gradientColors: ["rgba(14, 165, 233, 0.1)", "rgba(0, 0, 0, 0)"],
    },
    {
      label: "Low Stock",
      count: 0,
      color: "#ef4444",
      bgColor: "#fef2f2",
      borderColor: "rgba(239, 68, 68, 0.2)",
      gradientColors: ["rgba(239, 68, 68, 0.1)", "rgba(0, 0, 0, 0)"],
    },
    {
      label: "Categories",
      count: 0,
      color: "#3b82f6",
      bgColor: "#eff6ff",
      borderColor: "#bedbff",
      gradientColors: ["#dbeafe", "rgba(0, 0, 0, 0)"],
    },
    {
      label: "Total Units",
      count: 0,
      color: "#8b5cf6",
      bgColor: "#f5f3ff",
      borderColor: "#e9d4ff",
      gradientColors: ["#f3e8ff", "rgba(0, 0, 0, 0)"],
    },
  ]);

  // Filter options
  const categoryOptions = [
    { label: "All Categories", value: "all" },
    { label: "Low Stock", value: "low_stock" },
    { label: "Pain Relief", value: "Pain Relief" },
    { label: "Antibiotics", value: "Antibiotics" },
    { label: "Diabetes", value: "Diabetes" },
    { label: "Antihistamine", value: "Antihistamine" },
    { label: "Gastrointestinal", value: "Gastrointestinal" },
  ];

  useEffect(() => {
    if (!pharmacyId) {
      console.log("No pharmacyId provided");
      return;
    }

    const numericId = Number(pharmacyId);
    if (isNaN(numericId)) {
      console.log("Invalid pharmacyId:", pharmacyId);
      return;
    }

    // Initial fetch
    fetchInventory(numericId);

    // Subscribe to pharmacy_medicine table changes
    const channel = supabase
      .channel(`pharmacy-medicine-${numericId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pharmacy_medicine",
          filter: `pharmacy_id=eq.${numericId}`,
        },
        () => {
          console.log("Medicine inventory changed, refreshing...");
          fetchInventory(numericId);
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pharmacyId]);

  const fetchInventory = async (pharmacyId) => {
    try {
      setLoading(true);

      // Fetch pharmacy medicines with medicine reference details
      const { data: pharmacyMedicines, error: pharmacyError } = await supabase
        .from("pharmacy_medicine")
        .select(`
          *,
          medicine_reference (
            drug_id,
            medicine_name,
            generic_name,
            manufacturer,
            category,
            dosage
          )
        `)
        .eq("pharmacy_id", pharmacyId);

      if (pharmacyError) throw pharmacyError;

      // Format the data
      const formattedMedicines = (pharmacyMedicines || []).map((item) => {
        const ref = item.medicine_reference || {};
        const isLowStock = (item.stock || 0) <= 50;

        return {
          id: item.id,
          referenceId: ref.drug_id,
          name: ref.medicine_name || "Unknown Medicine",
          genericName: ref.generic_name || "",
          dosage: ref.dosage || "",
          manufacturer: ref.manufacturer || "Unknown",
          category: ref.category || "Uncategorized",
          price: item.price ? `RM ${item.price.toFixed(2)}` : "RM 0.00",
          stock: item.stock || 0,
          isLowStock,
          units: `${item.stock || 0} units`,
          rawData: item,
        };
      });

      setMedicines(formattedMedicines);
      setFilteredMedicines(formattedMedicines);

      // Calculate stats
      calculateStats(formattedMedicines);

      // Extract unique categories
      const uniqueCategories = [
        "all",
        ...new Set(formattedMedicines.map((m) => m.category).filter(Boolean)),
      ];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      Alert.alert("Error", "Failed to load inventory");
      setMedicines([]);
      setFilteredMedicines([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (medicinesList) => {
    const totalItems = medicinesList.length;
    const lowStock = medicinesList.filter((m) => m.isLowStock).length;
    const uniqueCategories = new Set(
      medicinesList.map((m) => m.category).filter(Boolean)
    ).size;

    const totalUnits = medicinesList.reduce((total, medicine) => {
      return total + (Number(medicine.stock) || 0);
    }, 0);

    setStats((prev) =>
      prev.map((stat) => {
        switch (stat.label) {
          case "Total Items":
            return { ...stat, count: totalItems };
          case "Low Stock":
            return { ...stat, count: lowStock };
          case "Categories":
            return { ...stat, count: uniqueCategories };
          case "Total Units":
            return { ...stat, count: totalUnits };
          default:
            return stat;
        }
      })
    );
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    applyFilters(text, selectedCategory);
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
    applyFilters(searchQuery, category);
  };

  const applyFilters = (search, category) => {
    let filtered = medicines;

    // Apply search filter
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.genericName.toLowerCase().includes(query) ||
          item.manufacturer.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (category !== "all") {
      if (category === "low_stock") {
        // Filter for low stock items
        filtered = filtered.filter((item) => item.isLowStock);
      } else {
        // Filter by regular category
        filtered = filtered.filter((item) => item.category === category);
      }
    }

    setFilteredMedicines(filtered);
  };

  const handleAddMedicine = () => {
    router.push({
      pathname: "/admin-add-medicine",
      params: { pharmacyId },
    });
  };

  const handleEditMedicine = (medicine) => {
    router.push({
      pathname: "/admin-edit-medicine",
      params: {
        id: medicine.id,
        pharmacyId,
        medicineData: JSON.stringify(medicine.rawData),
      },
    });
  };

  const handleDeleteMedicine = async (medicineId) => {
    Alert.alert(
      "Delete Medicine",
      "Are you sure you want to delete this medicine?",
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
                .eq("id", medicineId);

              if (error) throw error;

              Alert.alert("Success", "Medicine deleted successfully");
            } catch (error) {
              console.error("Error deleting medicine:", error);
              Alert.alert("Error", "Failed to delete medicine");
            }
          },
        },
      ]
    );
  };

  const getStockColor = (stock, isLowStock) => {
    if (isLowStock) return "#ef4444";
    if (stock > 200) return "#10b981";
    return "#0f172a";
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Pharmacist Dashboard</Text>
              <Text style={styles.subtitle}>Manage customer orders</Text>
            </View>

            {/* Logout Button - moved inside header */}
            <Pressable
              style={styles.logoutButton}
              onPress={async () => {
                try {
                  await supabase.auth.signOut();
                  router.push("/login");
                } catch (error) {
                  console.error("Logout error:", error);
                  // Optionally show error message to user
                }
              }}
            >
              <Image
                source={require("../../assets/logout.png")}
                style={styles.logoutIcon}
              />
            </Pressable>
          </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, styles.tabInactive]}
            onPress={() =>
              router.push({
                pathname: "/admin-dashboard",
                params: { pharmacyId },
              })
            }
          >
            <Text style={styles.tabTextInactive}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, styles.tabActive]}>
            <Text style={styles.tabTextActive}>Inventory</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={[
                styles.statCard,
                {
                  backgroundColor: stat.bgColor,
                  borderColor: stat.borderColor,
                },
              ]}
            >
              <View style={styles.statContent}>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text style={[styles.statCount, { color: stat.color }]}>
                    {stat.count}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Add Medicine Button */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddMedicine}>
          <LinearGradient
            colors={["#0ea5e9", "#0284c7"]}
            style={styles.addButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            angle={135}
            useAngle
          >
            <Text style={styles.addButtonText}>Add New Medicine</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Search and Filter */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Image
              source={require("../../assets/searchIcon.png")}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, generic name, or manufacturer..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScrollView}
          >
            {categoryOptions.map((category) => (
              <TouchableOpacity
                key={category.value}
                style={[
                  styles.categoryButton,
                  selectedCategory === category.value &&
                    styles.categoryButtonActive,
                ]}
                onPress={() => handleCategoryFilter(category.value)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === category.value &&
                      styles.categoryButtonTextActive,
                  ]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Inventory Header */}
        <View style={styles.inventoryHeader}>
          <Text style={styles.inventoryTitle}>Medicine Inventory</Text>
          <Text style={styles.inventoryCount}>
            {filteredMedicines.length} medicine(s)
          </Text>
        </View>

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text>Loading inventory...</Text>
          </View>
        ) : filteredMedicines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery || selectedCategory !== "all"
                ? "No medicines found matching your criteria"
                : "No medicines in inventory. Add your first medicine!"}
            </Text>
          </View>
        ) : (
          /* Medicine Cards */
          filteredMedicines.map((medicine) => (
            <View key={medicine.id} style={styles.medicineCard}>
              {/* Medicine Header */}
              <View style={styles.medicineHeader}>
                <View style={styles.medicineInfo}>
                  <View style={styles.medicineNameRow}>
                    <Text style={styles.medicineName}>{medicine.name}</Text>
                    {medicine.isLowStock && (
                      <View style={styles.lowStockBadge}>
                        <Text style={styles.lowStockText}>Low Stock</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.medicineDetails}>
                    {medicine.genericName} • {medicine.dosage}
                  </Text>
                </View>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: "#e0f2fe" },
                  ]}
                >
                  <Text style={styles.categoryText}>{medicine.category}</Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Stock and Price */}
              <View style={styles.stockPriceContainer}>
                <View style={styles.stockContainer}>
                  <Text style={styles.label}>Stock</Text>
                  <Text
                    style={[
                      styles.stockValue,
                      { color: getStockColor(medicine.stock, medicine.isLowStock) },
                    ]}
                  >
                    {medicine.units}
                  </Text>
                </View>
                <View style={styles.priceContainer}>
                  <Text style={styles.label}>Price</Text>
                  <Text style={styles.priceValue}>{medicine.price}</Text>
                </View>
              </View>

              {/* Manufacturer */}
              <View style={styles.manufacturerContainer}>
                <Text style={styles.label}>Manufacturer</Text>
                <Text style={styles.manufacturerValue}>
                  {medicine.manufacturer}
                </Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEditMedicine(medicine)}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteMedicine(medicine.id)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
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
    paddingHorizontal: 15,
    paddingTop: 15,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "500",
    color: "#0f172a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoutIcon:{
    width: 30,
    height: 30,
  },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  tabInactive: {
    backgroundColor: "transparent",
  },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabTextInactive: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  tabTextActive: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
  },

  // Stats Cards
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    width: "48%",
    height: 85,
    borderWidth: 1.7,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
  },
  statContent: {
    flex: 1,
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 4,
    fontWeight: "500",
  },
  statCount: {
    fontSize: 24,
    fontWeight: "600",
  },

  // Add Button
  addButton: {
    marginBottom: 24,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 14,
  },
  addButtonGradient: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#fff",
  },

  // Search and Filter
  searchContainer: {
    marginBottom: 24,
    gap: 8,
  },
  searchInputContainer: {
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    top: 14,
    width: 16,
    height: 16,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 40,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
  },
  categoryScrollView: {
    flexGrow: 0,
  },
  categoryButton: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: "#0ea5e9",
    borderColor: "#0ea5e9",
  },
  categoryButtonText: {
    fontSize: 14,
    color: "#64748b",
  },
  categoryButtonTextActive: {
    color: "#fff",
  },

  // Inventory Header
  inventoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  inventoryTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#0f172a",
  },
  inventoryCount: {
    fontSize: 12,
    color: "#64748b",
  },

  // Loading & Empty States
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
  },

  // Medicine Card
  medicineCard: {
    backgroundColor: "#fff",
    borderWidth: 1.7,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  medicineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  medicineInfo: {
    flex: 1,
  },
  medicineNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  medicineName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
    marginRight: 8,
  },

  lowStockBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  lowStockText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#fff",
  },
  medicineDetails: {
    fontSize: 12,
    color: "#64748b",
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 14,
  },
  categoryText: {
    fontSize: 12,
    color: "#0c4a6e",
    fontWeight: "500",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 12,
  },

  // Stock and Price
  stockPriceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  stockContainer: {
    flex: 1,
  },
  priceContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  label: {
    fontSize: 10,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  stockValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0ea5e9",
  },

  // Manufacturer
  manufacturerContainer: {
    marginBottom: 12,
  },
  manufacturerValue: {
    fontSize: 12,
    color: "#0f172a",
    marginTop: 4,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  editButtonText: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fee2e2",
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "500",
  },
});