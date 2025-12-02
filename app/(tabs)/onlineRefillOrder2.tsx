import * as React from "react";
import {Text, StyleSheet, View, Pressable, Image, TextInput, ScrollView, Alert} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";

// Import your actual images
const backArrow = require("../../assets/backArrow.png");
const forwardIcon = require("../../assets/forwardIcon.png");

const OnlineRefillOrder2 = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Helper function to safely get params
  const getParam = (key: string): string => {
    const value = params[key];
    if (Array.isArray(value)) {
      return value[0] || "";
    }
    return value || "";
  };
  
  // Get data with safe defaults
  const medicineId = getParam("medicineId");
  const medicineName = getParam("medicineName");
  const dosage = getParam("dosage");
  const genericName = getParam("genericName");
  const pharmacyId = getParam("pharmacyId");
  const pharmacyName = getParam("pharmacyName");
  const pharmacyAddress = getParam("pharmacyAddress");
  const readyTime = getParam("readyTime");
  const distanceParam = getParam("distance");
  const currentStock = getParam("currentStock");
  const pharmacyStock = getParam("pharmacyStock");
  const passedUnitPrice = parseFloat(getParam("unitPrice")) || 0;
  
  // Fix: Parse distance safely and check for NaN
  const distanceNum = parseFloat(distanceParam);
  const distance = isNaN(distanceNum) ? "" : distanceNum.toFixed(1);
  
  const [quantity, setQuantity] = React.useState("30");
  const [unitPrice, setUnitPrice] = React.useState<number | null>(null);
  const [priceMessage, setPriceMessage] = React.useState<string>("Fetching latest price...");
  const [isLoadingPrice, setIsLoadingPrice] = React.useState(false);
  
  // Calculate total
  const quantityNum = parseInt(quantity) || 0;
  const totalPrice = (unitPrice ?? 0) * quantityNum;
  
  // Debug log to check params
  React.useEffect(() => {
    console.log("🔍 OnlineRefillOrder2 - Received params:", {
      medicineId,
      medicineName,
      dosage,
      genericName,
      pharmacyId,
      pharmacyName,
      pharmacyAddress,
      readyTime,
      distanceParam,
      distance,
      currentStock,
      passedUnitPrice
    });
  }, [medicineId, medicineName, params]);

  React.useEffect(() => {
    let isMounted = true;

    const fetchUnitPrice = async () => {
      if (!medicineName || medicineName === "Medicine") {
        if (isMounted) {
          setUnitPrice(null);
          setPriceMessage("No medicine selected. Please go back and pick a medicine.");
        }
        return;
      }

      setIsLoadingPrice(true);

      try {
        setPriceMessage("Fetching price...");
        console.log("🔍 Looking for price for medicine:", medicineName);

        // FIRST: Try to fetch price by medicine name
        const { data: priceData, error: priceError } = await supabase
          .from('medicine_prices')
          .select('unit_price')
          .ilike('medicine_name', `%${medicineName}%`)
          .limit(1)
          .maybeSingle();

        console.log("📊 Price query result:", { priceData, priceError });

        if (!priceError && typeof priceData?.unit_price === "number") {
          console.log("✅ Found price by name:", priceData.unit_price);
          if (isMounted) {
            setUnitPrice(priceData.unit_price);
            setPriceMessage("");
            setIsLoadingPrice(false);
          }
          return;
        }

        // SECOND: If not found by exact name, try generic name
        if (genericName) {
          console.log("🔍 Trying generic name:", genericName);
          const { data: genericPriceData } = await supabase
            .from('medicine_prices')
            .select('unit_price')
            .ilike('generic_name', `%${genericName}%`)
            .limit(1)
            .maybeSingle();

          if (genericPriceData?.unit_price) {
            console.log("✅ Found price by generic name:", genericPriceData.unit_price);
            if (isMounted) {
              setUnitPrice(genericPriceData.unit_price);
              setPriceMessage(`Using generic price for ${genericName}`);
              setIsLoadingPrice(false);
            }
            return;
          }
        }

        // THIRD: Check if passed unit price is valid
        if (passedUnitPrice > 0) {
          console.log("📥 Using passed unit price:", passedUnitPrice);
          if (isMounted) {
            setUnitPrice(passedUnitPrice);
            setPriceMessage("");
            setIsLoadingPrice(false);
          }
          return;
        }

        // If all attempts fail
        console.warn("❌ No price found for medicine:", medicineName);
        if (isMounted) {
          setUnitPrice(null);
          setPriceMessage("Price not available for this medicine.");
          setIsLoadingPrice(false);
        }
      } catch (error) {
        console.error("💥 Failed to fetch unit price:", error);
        if (isMounted) {
          setUnitPrice(null);
          setPriceMessage("Unable to fetch price. Please try again later.");
          setIsLoadingPrice(false);
        }
      }
    };

    fetchUnitPrice();

    return () => {
      isMounted = false;
    };
  }, [medicineName, genericName, passedUnitPrice]);
  
  const handleContinue = () => {
    if (quantityNum === 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }

    // Check if requested quantity exceeds pharmacy stock
    if (pharmacyStock && parseInt(pharmacyStock) >= 0 && quantityNum > parseInt(pharmacyStock)) {
      Alert.alert(
        "Insufficient Stock",
        `The pharmacy only has ${pharmacyStock} units of this medicine available. Please reduce your quantity or choose a different pharmacy.`
      );
      return;
    }
    
    if (unitPrice === null || unitPrice <= 0) {
      Alert.alert(
        "Price Not Available",
        "No price found for this medicine. Would you like to:\n\n1. Continue with estimated price (RM 25.00)\n2. Go back and try again",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Use Estimated Price",
            onPress: () => {
              const estimatedPrice = 25.00;
              const paramsToPass: Record<string, string> = {
                medicineId: medicineId,
                unitPrice: estimatedPrice.toString(),
                medicineName,
                dosage,
                genericName,
                pharmacyName,
                pharmacyAddress,
                quantity: quantity,
                totalPrice: (estimatedPrice * quantityNum).toFixed(2),
                currentStock: currentStock || "0"
              };
              
              if (readyTime) paramsToPass.readyTime = readyTime;
              if (distance) paramsToPass.distance = distance;
              if (pharmacyId) paramsToPass.pharmacyId = pharmacyId;
              if (pharmacyStock) paramsToPass.pharmacyStock = pharmacyStock;
              
              router.push({
                pathname: "/(tabs)/onlineRefillOrder3",
                params: paramsToPass
              });
            }
          }
        ]
      );
      return;
    }
    
    // Pass data to next screen
    const paramsToPass: Record<string, string> = {
      medicineId: medicineId,
      unitPrice: unitPrice.toString(),
      medicineName,
      dosage,
      genericName,
      pharmacyName,
      pharmacyAddress,
      quantity: quantity,
      totalPrice: totalPrice.toFixed(2),
      currentStock: currentStock || "0"
    };
    
    // Only add optional fields if they exist and are valid
    if (readyTime) paramsToPass.readyTime = readyTime;
    if (distance) paramsToPass.distance = distance;
    if (pharmacyId) paramsToPass.pharmacyId = pharmacyId;
    if (pharmacyStock) paramsToPass.pharmacyStock = pharmacyStock;
    
    console.log("📤 Passing to OnlineRefillOrder3:", paramsToPass);
    
    router.push({
      pathname: "/(tabs)/onlineRefillOrder3",
      params: paramsToPass
    });
  };
  
  const handleBack = () => {
    router.back();
  };
  
  const handleQuantityChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');
    setQuantity(numericText);
  };
  
  // Function to safely display distance
  const formatDistance = () => {
    if (!distance) return "";
    return `${distance} km`;
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Image source={backArrow} style={styles.backIcon} resizeMode="contain" />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.requestRefill}>Request Refill</Text>
            <Text style={styles.medicineName}>
              {medicineName || "Medicine"} {dosage || ""}
            </Text>
          </View>
        </View>

        {/* Progress Steps */}
        <View style={styles.progressContainer}>
          <View style={styles.progressStep}>
            <View style={[styles.stepCircle, styles.stepCompleted]}>
              <Text style={styles.stepTextCompleted}>✓</Text>
            </View>
            <Text style={styles.stepLabelCompleted}>Pharmacy</Text>
          </View>
          <View style={styles.stepLineCompleted} />
          <View style={styles.progressStep}>
            <View style={[styles.stepCircle, styles.stepActive]}>
              <Text style={styles.stepTextActive}>2</Text>
            </View>
            <Text style={styles.stepLabelActive}>Quantity</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.progressStep}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepText}>3</Text>
            </View>
            <Text style={styles.stepLabel}>Payment</Text>
          </View>
        </View>

        {/* Price Status Banner */}
        {isLoadingPrice && (
          <View style={styles.priceStatusBanner}>
            <Text style={styles.priceStatusBannerText}>
              ⏳ Fetching price for {medicineName}...
            </Text>
          </View>
        )}
        
        {!isLoadingPrice && priceMessage && (
          <View style={[
            styles.priceStatusBanner,
            unitPrice !== null ? styles.priceStatusSuccess : styles.priceStatusWarning
          ]}>
            <Text style={styles.priceStatusBannerText}>
              {unitPrice !== null ? `✅ Price: RM ${unitPrice.toFixed(2)}` : `⚠️ ${priceMessage}`}
            </Text>
          </View>
        )}

        {/* Quantity Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Quantity</Text>
          
          <View style={styles.quantityCard}>
            <View style={styles.quantityInputContainer}>
              <Text style={styles.quantityLabel}>Number of pills/units</Text>
              <TextInput
                style={styles.quantityInput}
                value={quantity}
                onChangeText={handleQuantityChange}
                keyboardType="numeric"
                placeholder="Enter quantity"
                placeholderTextColor="#94A3B8"
                maxLength={4}
              />
              
              {quantityNum > 0 && unitPrice !== null && (
                <View style={styles.priceBreakdown}>
                  <Text style={styles.priceBreakdownText}>
                    {quantity} × RM {unitPrice.toFixed(2)} = 
                    <Text style={styles.totalPriceText}> RM {totalPrice.toFixed(2)}</Text>
                  </Text>
                </View>
              )}
              
              {quantityNum > 0 && unitPrice === null && (
                <View style={styles.priceWarning}>
                  <Text style={styles.priceWarningText}>
                    Price not available. Total cannot be calculated.
                  </Text>
                </View>
              )}
            </View>
            
            {/* Quick Quantity Buttons */}
            <View style={styles.quickQuantityContainer}>
              <Text style={styles.quickQuantityLabel}>Quick select:</Text>
              <View style={styles.quantityButtons}>
                <Pressable style={styles.quantityButton} onPress={() => setQuantity("15")}>
                  <Text style={styles.quantityButtonText}>15</Text>
                </Pressable>
                <Pressable style={styles.quantityButton} onPress={() => setQuantity("30")}>
                  <Text style={styles.quantityButtonText}>30</Text>
                </Pressable>
                <Pressable style={styles.quantityButton} onPress={() => setQuantity("60")}>
                  <Text style={styles.quantityButtonText}>60</Text>
                </Pressable>
                <Pressable style={styles.quantityButton} onPress={() => setQuantity("90")}>
                  <Text style={styles.quantityButtonText}>90</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          
          <View style={styles.summaryCard}>
            {/* Medicine Info */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Medicine:</Text>
              <Text style={styles.summaryValue}>
                {medicineName || "Not specified"} {dosage || ""}
              </Text>
            </View>
            
            {/* Generic Name - Only show if available */}
            {genericName ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Generic Name:</Text>
                <Text style={styles.summaryValue}>{genericName}</Text>
              </View>
            ) : null}
            
            {/* Pharmacy Info */}
            {pharmacyName ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pharmacy:</Text>
                <Text style={styles.summaryValue}>{pharmacyName}</Text>
              </View>
            ) : null}
            
            {/* Pharmacy Address - Only show if available */}
            {pharmacyAddress ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Address:</Text>
                <Text style={styles.summaryValueAddress}>{pharmacyAddress}</Text>
              </View>
            ) : null}
            
            {/* Ready Time - Only show if available */}
            {readyTime ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ready Time:</Text>
                <Text style={styles.summaryValue}>{readyTime}</Text>
              </View>
            ) : null}
            
            {/* Distance - Only show if valid */}
            {distance ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Distance:</Text>
                <Text style={styles.summaryValue}>{formatDistance()}</Text>
              </View>
            ) : null}
            
            {/* Current Stock - Only show if available */}
            {currentStock ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Current Stock:</Text>
                <Text style={styles.summaryValue}>{currentStock} units</Text>
              </View>
            ) : null}

            {/* Pharmacy Stock - Only show if available */}
            {pharmacyStock && parseInt(pharmacyStock) >= 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Pharmacy Stock:</Text>
                <View style={styles.summaryValueColumn}>
                  <Text style={styles.summaryValue}>{pharmacyStock} units at pharmacy</Text>
                  {parseInt(pharmacyStock) === 0 && (
                    <Text style={styles.stockWarningText}>⚠️ Out of stock at pharmacy</Text>
                  )}
                  {parseInt(pharmacyStock) > 0 && parseInt(pharmacyStock) < 10 && (
                    <Text style={styles.stockWarningText}>⚠️ Low stock at pharmacy</Text>
                  )}
                  {parseInt(pharmacyStock) >= 10 && (
                    <Text style={styles.stockAvailableText}>✅ Available at pharmacy</Text>
                  )}
                </View>
              </View>
            ) : null}
            
            <View style={styles.summaryDivider} />
            
            {/* Price Breakdown */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Unit Price:</Text>
              <View style={styles.summaryValueColumn}>
                <Text style={[
                  styles.summaryValue,
                  unitPrice === null && styles.missingDataText
                ]}>
                  {unitPrice !== null ? `RM ${unitPrice.toFixed(2)}` : "Not available"}
                </Text>
                {priceMessage && unitPrice === null && (
                  <Text style={styles.priceMessageText}>{priceMessage}</Text>
                )}
              </View>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Quantity:</Text>
              <Text style={styles.summaryValue}>
                {quantityNum > 0 ? `${quantity} units` : "Not set"}
              </Text>
            </View>
            
            <View style={styles.summaryDivider} />
            
            {/* Total */}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.summaryTotalLabel}>Total Amount:</Text>
              <Text style={[
                styles.summaryTotalValue,
                totalPrice === 0 && unitPrice === null && styles.missingDataText
              ]}>
                {totalPrice > 0 ? `RM ${totalPrice.toFixed(2)}` : "RM 0.00"}
              </Text>
            </View>
          </View>
        </View>

        {/* Continue Button */}
        <Pressable
          style={[
            styles.continueButton,
            (quantityNum === 0 || unitPrice === null || isLoadingPrice ||
             (pharmacyStock && parseInt(pharmacyStock) >= 0 && quantityNum > parseInt(pharmacyStock)))
              && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={quantityNum === 0 || unitPrice === null || isLoadingPrice ||
                   (pharmacyStock !== undefined && pharmacyStock !== "" && parseInt(pharmacyStock) >= 0 && quantityNum > parseInt(pharmacyStock))}
        >
          <Text style={styles.continueButtonText}>
            {isLoadingPrice
              ? "Loading Price..."
              : unitPrice === null
                ? "Price Not Available"
                : pharmacyStock && parseInt(pharmacyStock) >= 0 && quantityNum > parseInt(pharmacyStock)
                ? `Insufficient Stock - Only ${pharmacyStock} Available`
                : `Continue to Payment - RM ${totalPrice.toFixed(2)}`
            }
          </Text>
          {!isLoadingPrice && unitPrice !== null &&
           !(pharmacyStock && parseInt(pharmacyStock) >= 0 && quantityNum > parseInt(pharmacyStock)) && (
            <Image source={forwardIcon} style={styles.arrowIcon} resizeMode="contain" />
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 40,
  },
  headerSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backIcon: {
    width: 20,
    height: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  requestRefill: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  medicineName: {
    fontSize: 16,
    color: "#64748b",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  progressStep: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  stepCompleted: {
    backgroundColor: "#0ea5e9",
  },
  stepActive: {
    backgroundColor: "#0ea5e9",
  },
  stepText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  stepTextCompleted: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  stepTextActive: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  stepLabel: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  stepLabelCompleted: {
    fontSize: 12,
    color: "#0ea5e9",
    fontWeight: "600",
    textAlign: "center",
  },
  stepLabelActive: {
    fontSize: 12,
    color: "#0ea5e9",
    fontWeight: "600",
    textAlign: "center",
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 8,
    marginBottom: 20,
  },
  stepLineCompleted: {
    flex: 1,
    height: 2,
    backgroundColor: "#0ea5e9",
    marginHorizontal: 8,
    marginBottom: 20,
  },
  priceStatusBanner: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  priceStatusSuccess: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  priceStatusWarning: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  priceStatusBannerText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 16,
  },
  quantityCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quantityInputContainer: {
    marginBottom: 20,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 8,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    marginBottom: 12,
  },
  priceBreakdown: {
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  priceBreakdownText: {
    fontSize: 16,
    color: "#0369a1",
    fontWeight: "500",
  },
  totalPriceText: {
    color: "#0ea5e9",
    fontWeight: "700",
    fontSize: 18,
  },
  priceWarning: {
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  priceWarningText: {
    fontSize: 14,
    color: "#92400e",
    textAlign: "center",
  },
  quickQuantityContainer: {
    marginTop: 8,
  },
  quickQuantityLabel: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 12,
  },
  quantityButtons: {
    flexDirection: "row",
    gap: 12,
  },
  quantityButton: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quantityButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  totalRow: {
    alignItems: "center",
    marginBottom: 0,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#64748b",
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
    flex: 2,
    textAlign: "right",
  },
  summaryValueColumn: {
    flex: 2,
    alignItems: "flex-end",
  },
  summaryValueAddress: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
    flex: 2,
    textAlign: "right",
    flexWrap: "wrap",
  },
  missingDataText: {
    color: "#ef4444",
    fontWeight: "600",
  },
  priceMessageText: {
    fontSize: 12,
    color: "#f97316",
    marginTop: 4,
  },
  stockWarningText: {
    fontSize: 12,
    color: "#f97316",
    marginTop: 4,
    fontWeight: "500",
  },
  stockAvailableText: {
    fontSize: 12,
    color: "#10b981",
    marginTop: 4,
    fontWeight: "500",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 16,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0ea5e9",
  },
  continueButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#0ea5e9",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: "#94a3b8",
    shadowColor: "#94a3b8",
  },
  continueButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  arrowIcon: {
    width: 16,
    height: 16,
  },
});

export default OnlineRefillOrder2;
