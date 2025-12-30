import * as React from "react";
import { useCallback, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import * as FileSystem from "expo-file-system/legacy";
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  Image,
  ScrollView,
  useWindowDimensions,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const ScanPackage = () => {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [image, setImage] = useState<string | null>(null);

  const decodeBase64ToUint8Array = (base64: string): Uint8Array => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let outputLength = (base64.length / 4) * 3;
    if (base64.endsWith("==")) outputLength -= 2;
    else if (base64.endsWith("=")) outputLength -= 1;

    const bytes = new Uint8Array(outputLength);
    let byteIndex = 0;

    for (let i = 0; i < base64.length; i += 4) {
      const enc1 = chars.indexOf(base64[i]);
      const enc2 = chars.indexOf(base64[i + 1]);
      const enc3 = chars.indexOf(base64[i + 2]);
      const enc4 = chars.indexOf(base64[i + 3]);

      const triplet = (enc1 << 18) | (enc2 << 12) | ((enc3 & 63) << 6) | (enc4 & 63);

      if (enc3 === 64) {
        bytes[byteIndex++] = (triplet >> 16) & 255;
      } else if (enc4 === 64) {
        bytes[byteIndex++] = (triplet >> 16) & 255;
        bytes[byteIndex++] = (triplet >> 8) & 255;
      } else {
        bytes[byteIndex++] = (triplet >> 16) & 255;
        bytes[byteIndex++] = (triplet >> 8) & 255;
        bytes[byteIndex++] = triplet & 255;
      }
    }

    return bytes;
  };

  const uploadPhoto = useCallback(async () => {
  try {
    console.log("🚀 Starting upload with NEW bucket...");

    // Ask for permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission required", "Photo library access is needed to upload a photo.");
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
      base64: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      console.log("Image selection was cancelled");
      return;
    }

    const photoUri = result.assets[0].uri;
    setImage(photoUri);

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      Alert.alert("Error", "User not logged in");
      return;
    }

    // Prepare image for upload
    const fileName = `${user.id}-${Date.now()}.jpg`;
    const base64 = (result.assets[0] as any).base64 
      ?? await FileSystem.readAsStringAsync(photoUri, { encoding: "base64" as any });
    const bytes = decodeBase64ToUint8Array(base64);

    // Upload to NEW storage bucket
    console.log("⬆️ Uploading to NEW bucket: medicine-images");
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('medicine-images')  // ← CHANGED to new bucket
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Storage upload error:", uploadError);
      Alert.alert("Upload failed", uploadError.message);
      return;
    }

    // Get public URL from NEW bucket
    const { data: { publicUrl } } = supabase.storage
      .from('medicine-images')  // ← CHANGED to new bucket
      .getPublicUrl(fileName);
    
    console.log("🌐 Public URL:", publicUrl);

    // Save to database
    console.log("💾 Saving to database...");
    const { data: insertData, error: insertError } = await supabase
      .from('user_captured_images_scan')
      .insert({
        user_id: user.id,
        image_url: publicUrl
      })
      .select();

    if (insertError) {
      console.error("❌ Database insert error:", insertError);
      Alert.alert("Database Error", insertError.message);
      return;
    }

    console.log("✅ SUCCESS! Image uploaded and saved to database!");
    Alert.alert("Success", "Image uploaded successfully!");
    
    router.push({
      pathname: "./TakePhotoAndAnalyseMedicine",
      params: { 
        fromUpload: "true",
        imageUrl: publicUrl
      },
    });

  } catch (error) {
    console.error("💥 Unexpected error:", error);
    Alert.alert("Error", "Something went wrong. Please try again.");
  }
}, [router]);

  // Responsive breakpoints
  const isSmallScreen = width < 375;
  const isMediumScreen = width >= 375 && width < 768;
  const isLargeScreen = width >= 768;
  const isExtraLarge = width >= 1024;

  // Dynamic padding based on screen size
  const getHorizontalPadding = () => {
    if (isExtraLarge) return width * 0.25;
    if (isLargeScreen) return width * 0.15;
    return 16;
  };

  // Dynamic card height based on screen size
  const getCardHeight = () => {
    if (isSmallScreen) return height * 0.35;
    if (isMediumScreen) return height * 0.4;
    if (isLargeScreen) return height * 0.45;
    return 380;
  };

  const dynamicStyles = {
    container: {
      paddingHorizontal: getHorizontalPadding(),
    },
    card: {
      height: getCardHeight(),
    },
    title: {
      fontSize: isLargeScreen ? 24 : isSmallScreen ? 16 : 18,
    },
    subtitle: {
      fontSize: isLargeScreen ? 16 : isSmallScreen ? 13 : 14,
    },
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.container, dynamicStyles.container]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Platform.OS === 'ios' ? 90 : 80 }
          ]}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <Text style={[styles.title, dynamicStyles.title]}>
              Scan Package
            </Text>
            <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
              Scan medicine packaging to identify and get information
            </Text>
          </View>

          {/* Camera Frame Card */}
          <View style={[styles.card, dynamicStyles.card]}>
            <View style={styles.cameraIconContainer}>
              <Image
                source={require("../../assets/cameraIcon.png")}
                style={[
                  styles.cameraIcon,
                  isLargeScreen && { width: 80, height: 80 }
                ]}
                resizeMode="contain"
              />
            </View>
            <Text style={[
              styles.cardText,
              isLargeScreen && { fontSize: 16 }
            ]}>
              Position medicine package in the frame
            </Text>
            <Text style={[
              styles.cardSubText,
              isLargeScreen && { fontSize: 14 }
            ]}>
              Make sure the label is readable
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={[
            styles.buttonRow,
            isLargeScreen && styles.buttonRowLarge
          ]}>
            <Pressable
              style={[
                styles.primaryButton,
                isLargeScreen && styles.buttonLarge
              ]}
              onPress={() => router.push("./TakePhotoAndAnalyseMedicine")}
            >
              <Image
                source={require("../../assets/cameraIcon.png")}
                style={styles.buttonIcon}
                resizeMode="contain"
              />
              <Text style={[
                styles.buttonTextPrimary,
                isLargeScreen && { fontSize: 16 }
              ]}>
                Take Photo
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.secondaryButton,
                isLargeScreen && styles.buttonLarge
              ]}
              onPress={uploadPhoto}
            >
              <Image
                source={require("../../assets/arrowIcon.png")}
                style={styles.buttonIcon}
                resizeMode="contain"
              />
              <Text style={[
                styles.buttonTextSecondary,
                isLargeScreen && { fontSize: 16 }
              ]}>
                Upload
              </Text>
            </Pressable>
          </View>

          {/* Tips Card */}
          <View style={[
            styles.tipsCard,
            isLargeScreen && { padding: 20 }
          ]}>
            <View style={styles.tipsHeader}>
              <Image
                source={require("../../assets/infoIcon.png")}
                style={[
                  styles.infoIcon,
                  isLargeScreen && { width: 20, height: 20 }
                ]}
                resizeMode="contain"
              />
              <Text style={[
                styles.tipsTitle,
                isLargeScreen && { fontSize: 16 }
              ]}>
                Tips for best results:
              </Text>
            </View>
            <View style={styles.tipsList}>
              <Text style={[
                styles.tip,
                isLargeScreen && { fontSize: 14, lineHeight: 22 }
              ]}>
                • Use good lighting
              </Text>
              <Text style={[
                styles.tip,
                isLargeScreen && { fontSize: 14, lineHeight: 22 }
              ]}>
                • Ensure package label is clearly visible
              </Text>
              <Text style={[
                styles.tip,
                isLargeScreen && { fontSize: 14, lineHeight: 22 }
              ]}>
                • Include barcode if possible
              </Text>
              <Text style={[
                styles.tip,
                isLargeScreen && { fontSize: 14, lineHeight: 22 }
              ]}>
                • Hold camera steady
              </Text>
              <Text style={[
                styles.tip,
                isLargeScreen && { fontSize: 14, lineHeight: 22 }
              ]}>
                • Avoid glare on reflective surfaces
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={[
          styles.bottomNav,
          isLargeScreen && styles.bottomNavLarge
        ]}>
          <Pressable 
            style={styles.navItem} 
            onPress={() => router.push("/home")}
          >
            <Image
              source={require("../../assets/homeIcon.png")}
              style={[
                styles.navIcon,
                isLargeScreen && { width: 24, height: 24 }
              ]}
              resizeMode="contain"
            />
            <Text style={[
              styles.navText,
              isLargeScreen && { fontSize: 12 }
            ]}>
              Home
            </Text>
          </Pressable>

          <Pressable 
            style={styles.navItem} 
            onPress={() => router.push("/meds")}
          >
            <Image
              source={require("../../assets/pillIcon.png")}
              style={[
                styles.navIcon,
                isLargeScreen && { width: 24, height: 24 }
              ]}
              resizeMode="contain"
            />
            <Text style={[
              styles.navText,
              isLargeScreen && { fontSize: 12 }
            ]}>
              Meds
            </Text>
          </Pressable>

          <View style={[
            styles.navItemActive,
            isLargeScreen && styles.navItemActiveLarge
          ]}>
            <Image
              source={require("../../assets/scanIcon.png")}
              style={[
                styles.navIconActive,
                isLargeScreen && { width: 28, height: 28 }
              ]}
              resizeMode="contain"
            />
            <Text style={[
              styles.navTextActive,
              isLargeScreen && { fontSize: 12 }
            ]}>
              Scan
            </Text>
          </View>

          <Pressable
            style={styles.navItem}
            onPress={() => router.push("/analytics")}
          >
            <Image
              source={require("../../assets/chartIcon.png")}
              style={[
                styles.navIcon,
                isLargeScreen && { width: 24, height: 24 }
              ]}
              resizeMode="contain"
            />
            <Text style={[
              styles.navText,
              isLargeScreen && { fontSize: 12 }
            ]}>
              Analytics
            </Text>
          </Pressable>

          <Pressable
            style={styles.navItem}
            onPress={() => router.push("/profile")}
          >
            <Image
              source={require("../../assets/profileIcon.png")}
              style={[
                styles.navIcon,
                isLargeScreen && { width: 24, height: 24 }
              ]}
              resizeMode="contain"
            />
            <Text style={[
              styles.navText,
              isLargeScreen && { fontSize: 12 }
            ]}>
              Profile
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 16,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    fontFamily: "Inter-SemiBold",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
    fontFamily: "Inter-Regular",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  cameraIconContainer: {
    marginBottom: 12,
  },
  cameraIcon: {
    width: 64,
    height: 64,
  },
  cardText: {
    fontSize: 14,
    textAlign: "center",
    color: "#0f172a",
    fontFamily: "Inter-Medium",
    marginBottom: 4,
  },
  cardSubText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    fontFamily: "Inter-Regular",
  },
  buttonRow: {
    flexDirection: "row",
    marginBottom: 24,
    gap: 12,
  },
  buttonRowLarge: {
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flex: 1,
    minHeight: 44,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flex: 1,
    minHeight: 44,
  },
  buttonLarge: {
    paddingVertical: 14,
    minHeight: 50,
  },
  buttonIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  buttonTextPrimary: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter-Medium",
    fontWeight: "500",
  },
  buttonTextSecondary: {
    color: "#0f172a",
    fontSize: 14,
    fontFamily: "Inter-Medium",
    fontWeight: "500",
  },
  tipsCard: {
    backgroundColor: "#eff6ff",
    borderColor: "#bedbff",
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
  },
  tipsTitle: {
    fontSize: 14,
    color: "#0f172a",
    fontFamily: "Inter-Medium",
    fontWeight: "500",
  },
  tipsList: {
    marginTop: 4,
    gap: 4,
  },
  tip: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
    fontFamily: "Inter-Regular",
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 72,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomNavLarge: {
    height: 80,
    paddingHorizontal: 40,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
    paddingVertical: 8,
  },
  navIcon: {
    width: 20,
    height: 20,
    marginBottom: 4,
  },
  navText: {
    fontSize: 10,
    color: "#64748b",
    fontFamily: "Inter-Regular",
    letterSpacing: 0.1,
  },
  navItemActive: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
  },
  navItemActiveLarge: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navIconActive: {
    width: 23,
    height: 23,
    marginBottom: 4,
  },
  navTextActive: {
    fontSize: 10,
    color: "#0ea5e9",
    fontFamily: "Inter-Medium",
    fontWeight: "500",
    letterSpacing: 0.1,
  },
});

export default ScanPackage;