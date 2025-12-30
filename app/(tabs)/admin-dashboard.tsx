import React, { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useLocalSearchParams, router } from "expo-router";


export default function AdminDashboard() {
  const params = useLocalSearchParams();
  const pharmacyId = params.pharmacyId;

  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [stats, setStats] = useState([
    {
      label: "Pending",
      count: 0,
      color: "#f59e0b",
      bgColor: "#fff7ed",
      borderColor: "rgba(245, 158, 11, 0.3)",
      image: require("../../assets/pending.png"),
      status: "pending"
    },
    {
      label: "Preparing",
      count: 0,
      color: "#3b82f6",
      bgColor: "#eff6ff",
      borderColor: "rgba(59, 130, 246, 0.3)",
      image: require("../../assets/preparing.png"),
      status: "preparing"
    },
    {
      label: "Ready",
      count: 0,
      color: "#10b981",
      bgColor: "#ecfdf5",
      borderColor: "rgba(16, 185, 129, 0.3)",
      image: require("../../assets/ready.png"),
      status: "ready"
    },
    {
      label: "Collected",
      count: 0,
      color: "#8b5cf6",
      bgColor: "#f5f3ff",
      borderColor: "rgba(139, 92, 246, 0.3)",
      image: require("../../assets/collected.png"),
      status: "collected"
    },
  ]);

  // Filter options
  const filterOptions = [
    { label: "All Orders", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Preparing", value: "preparing" },
    { label: "Ready", value: "ready" },
    { label: "Collected", value: "collected" },
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
    fetchPharmacyOrders(numericId);

    // CORRECTED: Subscribe to orders table with proper syntax
    const channel = supabase
      .channel(`pharmacy-orders-${numericId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'orders',
          filter: `pharmacy_id=eq.${numericId}`
        },
        (payload) => {
          console.log('Real-time update:', payload);

          // Handle different event types
          if (payload.eventType === 'INSERT') {
            console.log('New order inserted:', payload.new);
          } else if (payload.eventType === 'UPDATE') {
            console.log('Order updated:', payload.new);
          } else if (payload.eventType === 'DELETE') {
            console.log('Order deleted:', payload.old);
          }

          // Refresh the dashboard
          fetchPharmacyOrders(numericId);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to order changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to order changes');
        } else if (status === 'TIMED_OUT') {
          console.error('Subscription timed out');
        }
      });

    // Cleanup function
    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [pharmacyId]);

  const fetchPharmacyOrders = async (id) => {
    try {
      setLoading(true);

      const numericId = id || Number(String(pharmacyId).trim());

      const { data, error } = await supabase
        .from('orders_with_profile')
        .select('*')
        .eq('pharmacy_id', numericId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        setOrders([]);
        setFilteredOrders([]);
        calculateStats([]);
        return;
      }

      const formatted = data.map(o => ({
        id: 'ORD-' + String(o.order_id).slice(0, 8).toUpperCase(),
        customer: o.username || 'Unknown',
        status: o.status?.toLowerCase() || 'pending',
        statusColor: getStatusColor(o.status),
        medicines: [o.medicine_name || 'None'],
        total: 'RM ' + Number(o.total_amount).toFixed(2),
        date: o.created_at
          ? new Date(o.created_at).toLocaleDateString('en-GB')
          : 'N/A',
        time: o.created_at
          ? new Date(o.created_at).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'N/A',
        rawData: o
      }));

      setOrders(formatted);
      // Apply the current active filter to new data
      applyFilter(activeFilter, formatted);
      calculateStats(formatted);
    } catch (e) {
      console.error(e);
      setOrders([]);
      setFilteredOrders([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'pending': return "#f59e0b";
      case 'processing':
      case 'preparing': return "#3b82f6";
      case 'ready':
      case 'completed': return "#10b981";
      case 'cancelled': return "#ef4444";
      case 'collected': return "#8b5cf6";
      default: return "#64748b";
    }
  };

  const applyFilter = (filterValue, ordersList = orders) => {
    if (filterValue === "all") {
      setFilteredOrders(ordersList);
      return;
    }

    // Filter by status
    const filtered = ordersList.filter(order => order.status === filterValue);
    setFilteredOrders(filtered);
  };

  const handleFilterPress = (filterValue) => {
    setActiveFilter(filterValue);
    applyFilter(filterValue); // THIS WAS MISSING
  };

  // Also fix the calculateStats to use status field instead of label
  const calculateStats = (ordersList) => {
    const pending = ordersList.filter(o => o.status === 'pending').length;
    const preparing = ordersList.filter(o => o.status === 'preparing').length;
    const ready = ordersList.filter(o => o.status === 'ready').length;
    const collected = ordersList.filter(o => o.status === 'collected').length;

    setStats(prev => prev.map(stat => {
      switch(stat.status) { // Changed from stat.label to stat.status
        case 'pending': return { ...stat, count: pending };
        case 'preparing': return { ...stat, count: preparing };
        case 'ready': return { ...stat, count: ready };
        case 'collected': return { ...stat, count: collected };
        default: return stat;
      }
    }));
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
          <Image
            source={require("../../assets/orders.png")}
            style={styles.avatar}
          />
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
                index > 1 && styles.statCardBottomRow
              ]}
            >
              <View style={styles.statContent}>
                <View style={[styles.statIconContainer, { backgroundColor: `${stat.color}15` }]}>
                  <Image
                    source={stat.image}
                    style={styles.statImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text style={[styles.statCount, { color: stat.color }]}>{stat.count}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
          >
            {filterOptions.map((filter) => (
              <TouchableOpacity
                key={filter.value}
                style={[
                  styles.filterButton,
                  activeFilter === filter.value && styles.filterButtonActive
                ]}
                onPress={() => handleFilterPress(filter.value)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterText,
                  activeFilter === filter.value && styles.filterTextActive
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Orders Section */}
        <View style={styles.ordersContainer}>
          <View style={styles.ordersHeader}>
            <Text style={styles.ordersTitle}>Orders</Text>
            <View style={styles.ordersCountContainer}>
              <Text style={styles.ordersCount}>{filteredOrders.length} order(s)</Text>
              {activeFilter !== "all" && (
                <TouchableOpacity
                  style={styles.clearFilterButton}
                  onPress={() => handleFilterPress("all")}
                >
                  <Text style={styles.clearFilterText}>Clear filter</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Loading and Empty States */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text>Loading orders...</Text>
            </View>
          ) : filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeFilter === "all"
                  ? "No orders yet for your pharmacy"
                  : `No ${activeFilter} orders found`}
              </Text>
            </View>
          ) : (
            // Orders List
            filteredOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                activeOpacity={0.7}
                onPress={() => router.push({
                  pathname: "/order-details",
                  params: {
                    id: order.id,
                    customer: order.customer,
                    status: order.status,
                    statusColor: order.statusColor,
                    medicines: JSON.stringify(order.medicines),
                    total: order.total,
                    date: order.date,
                    time: order.time,
                    rawData: JSON.stringify(order.rawData),
                    pharmacyId: pharmacyId
                  }
                })}
              >
                {/* Order Header */}
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <View style={styles.orderIdRow}>
                      <Text style={styles.orderId}>{order.id}</Text>
                    </View>
                    <Text style={styles.customerName}>{order.customer}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: order.statusColor }]}>
                    <Text style={styles.statusText}>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Medicines List */}
                <View style={styles.medicinesContainer}>
                  {order.medicines.map((medicine, index) => (
                    <View key={index} style={styles.medicineRow}>
                      <Image
                        source={require("../../assets/pillIcon.png")}
                        style={styles.medicineIcon}
                      />
                      <Text style={styles.medicineText}>{medicine}</Text>
                    </View>
                  ))}
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Order Footer */}
                <View style={styles.orderFooter}>
                  <View style={styles.totalContainer}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalAmount}>{order.total}</Text>
                  </View>
                  <View style={styles.timeContainer}>
                    <Text style={styles.dateText}>{order.date}</Text>
                    <Text style={styles.timeText}>{order.time}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Info Card */}
        <LinearGradient
          colors={['#eff6ff', '#ecfeff']}
          style={styles.infoCard}
          useAngle={true}
          angle={135}
        >
        </LinearGradient>
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
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardBottomRow: {
    marginBottom: 0,
  },
  statContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statImage: {
    width: 30,
    height: 30,
    borderRadius: 12,
  },
  statTextContainer: {
    flex: 1,
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

  // Filter Container
  filterContainer: {
    marginBottom: 24,
  },
  filterScrollView: {
    flexGrow: 0,
  },
  filterButton: {
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    minWidth: 100,
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#0ea5e9",
    borderColor: "#0ea5e9",
  },
  filterText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  filterTextActive: {
    color: "#fff",
  },

  // Orders Section
  ordersContainer: {
    marginBottom: 24,
  },
  ordersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ordersTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#0f172a",
  },
  ordersCountContainer: {
    alignItems: "flex-end",
  },
  ordersCount: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  clearFilterButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearFilterText: {
    fontSize: 11,
    color: "#0ea5e9",
    textDecorationLine: "underline",
  },

  // Loading & Empty States
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },

  // Order Card
  orderCard: {
    backgroundColor: "#fff",
    borderWidth: 1.7,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    padding: 11,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 11,
  },
  orderInfo: {
    flex: 1,
  },
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  orderId: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
    marginRight: 8,
  },
  rxBadge: {
    borderWidth: 0.9,
    borderColor: "#f59e0b",
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  rxText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#f59e0b",
  },
  customerName: {
    fontSize: 12,
    color: "#64748b",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#fff",
  },

  // Medicines
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 11,
  },
  medicinesContainer: {
    gap: 6,
  },
  medicineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  medicineIcon: {
    width: 14,
    height: 14,
  },
  medicineText: {
    fontSize: 12,
    color: "#64748b",
    flex: 1,
  },

  // Order Footer
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalContainer: {
    gap: 4,
  },
  totalLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0ea5e9",
  },
  timeContainer: {
    alignItems: "flex-end",
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: "#64748b",
  },
  timeText: {
    fontSize: 12,
    color: "#64748b",
  },

  // Info Card
  infoCard: {
    borderWidth: 1.7,
    borderColor: "rgba(219, 234, 254, 0.5)",
    borderRadius: 20,
    padding: 11,
    marginBottom: 24,
  },
  infoContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1c398e",
  },
  infoDescription: {
    fontSize: 12,
    color: "rgba(20, 71, 230, 0.8)",
    lineHeight: 16,
  },
});