import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    ScrollView,
    Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { Feather } from "@expo/vector-icons";
import * as Sharing from 'expo-sharing';

export default function ShareReportScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [localUri, setLocalUri] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isPreparingFile = useRef(false);

    const report = params.report ? JSON.parse(params.report as string) : null;

    useEffect(() => {
        if (!report) {
            setError("No report data found");
            setLoading(false);
            return;
        }

        prepareFile();
    }, [report]);

    const prepareFile = async () => {
        if (isPreparingFile.current || localUri) return;
        
        isPreparingFile.current = true;
        setLoading(true);
        setError(null);

        try {
            let finalUri: string | null = null;

            // First check if we already have a local file URI
            if (report.file_url && report.file_url.startsWith("file://")) {
                const fileInfo = await FileSystem.getInfoAsync(report.file_url);
                if (fileInfo.exists) {
                    console.log("Using existing local file:", report.file_url);
                    finalUri = report.file_url;
                }
            }

            // If no local file, download from storage
            if (!finalUri && report.storage_path) {
                console.log("Downloading from storage:", report.storage_path);
                const { data, error: downloadError } = await supabase.storage
                    .from("medical-reports")
                    .download(report.storage_path);

                if (downloadError) throw downloadError;
                if (!data) throw new Error("Downloaded file data is empty.");

                const fileName = report.file_name || `report_${report.id}.pdf`;
                const uri = FileSystem.cacheDirectory + fileName;

                // Clean up any existing file with the same name
                try {
                    const existingFile = await FileSystem.getInfoAsync(uri);
                    if (existingFile.exists) {
                        await FileSystem.deleteAsync(uri);
                    }
                } catch (e) {
                    console.log("No existing file to delete");
                }

                // Convert blob to base64
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(data);
                    reader.onload = () => {
                        if (typeof reader.result === 'string') {
                            const base64Data = reader.result.split(',')[1];
                            if (base64Data) {
                                resolve(base64Data);
                            } else {
                                reject(new Error("Failed to extract base64 data."));
                            }
                        } else {
                            reject(new Error("Failed to read file as base64 data URL."));
                        }
                    };
                    reader.onerror = (error) => reject(error);
                });

                await FileSystem.writeAsStringAsync(uri, base64, {
                  encoding: "base64",
                });

                // Verify the file was written
                const fileInfo = await FileSystem.getInfoAsync(uri);
                if (!fileInfo.exists) {
                    throw new Error("Failed to save file locally.");
                }
                
                console.log("File saved successfully:", uri);
                finalUri = uri;
            } 
            // Try external URL as fallback
            else if (!finalUri && report.file_url) {
                console.log("Downloading from external URL:", report.file_url);
                const fileName = `report_${report.id}.pdf`;
                const uri = FileSystem.cacheDirectory + fileName;
                
                // Clean up any existing file with the same name
                try {
                    const existingFile = await FileSystem.getInfoAsync(uri);
                    if (existingFile.exists) {
                        await FileSystem.deleteAsync(uri);
                    }
                } catch (e) {
                    console.log("No existing file to delete");
                }
                
                const { uri: downloadedUri } = await FileSystem.downloadAsync(report.file_url, uri);
                
                // Verify download
                const fileInfo = await FileSystem.getInfoAsync(downloadedUri);
                if (!fileInfo.exists) {
                    throw new Error("Failed to download file.");
                }
                
                console.log("File downloaded successfully:", downloadedUri);
                finalUri = downloadedUri;
            } 
            else if (!finalUri) {
                throw new Error("No file URL or storage path found");
            }

            setLocalUri(finalUri);
            setError(null);
        } catch (error: any) {
            console.error("Error preparing file:", error);
            setError(error.message || "Failed to prepare file");
            setLocalUri(null);
        } finally {
            setLoading(false);
            isPreparingFile.current = false;
        }
    };

    const handleShare = async () => {
        if (!localUri) {
            Alert.alert("Error", "File is not ready yet. Please wait.");
            return;
        }

        try {
            console.log('Sharing file from:', localUri);
            
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(localUri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Share ${report?.title || 'Medical Report'}`,
                    UTI: 'com.adobe.pdf'
                });
            } else {
                Alert.alert("Sharing not available", "Unable to share on this device");
            }
        } catch (error: any) {
            console.error('Sharing error:', error);
            Alert.alert("Sharing Error", `Failed to share PDF: ${error.message}`);
        }
    };

    // Show error if no report
    if (!report) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Image
                            source={require("../../assets/backArrow.png")} 
                            style={styles.backIcon}
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Share Report</Text>
                </View>
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>No report data available</Text>
                    <TouchableOpacity 
                        style={styles.button}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.buttonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Image
                        source={require("../../assets/backArrow.png")}
                        style={styles.backIcon}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Share Report</Text>
            </View>

            <ScrollView 
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.mainContent}>
                    <View style={styles.previewCard}>
                        <View style={styles.iconWrapper}>
                            <Image
                                source={require("../../assets/PDFB.png")}
                                style={styles.pdfIcon}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.reportTitle}>{report?.title || "Medical Report"}</Text>
                        <View style={styles.dateContainer}>
                            <Feather name="calendar" size={14} color="#64748b" />
                            <Text style={styles.reportDate}>
                                {report?.start_date} - {report?.end_date}
                            </Text>
                        </View>
                        {report?.file_size && (
                            <Text style={styles.fileSize}>
                                {Math.round(report.file_size / 1024)} KB
                            </Text>
                        )}
                    </View>

                    <View style={styles.actionSection}>
                        {loading ? (
                            <View style={styles.statusContainer}>
                                <ActivityIndicator size="large" color="#0ea5e9" />
                                <Text style={styles.statusText}>Preparing document...</Text>
                            </View>
                        ) : error ? (
                            <View style={styles.statusContainer}>
                                <Feather name="alert-circle" size={32} color="#ef4444" />
                                <Text style={styles.errorText}>{error}</Text>
                                <TouchableOpacity 
                                    style={styles.retryButton}
                                    onPress={prepareFile}
                                >
                                    <Text style={styles.retryButtonText}>Try Again</Text>
                                </TouchableOpacity>
                            </View>
                        ) : localUri ? (
                            <View style={styles.shareContainer}>
                                <Text style={styles.shareHint}>Ready to share</Text>
                                <TouchableOpacity
                                    style={styles.shareButton}
                                    onPress={handleShare}
                                    activeOpacity={0.9}
                                >
                                    <Feather name="share-2" size={20} color="#fff" style={styles.shareIcon} />
                                    <Text style={styles.shareButtonText}>Share Report</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.statusContainer}>
                                <Text style={styles.statusText}>File not ready</Text>
                                <TouchableOpacity 
                                    style={styles.retryButton}
                                    onPress={prepareFile}
                                >
                                    <Text style={styles.retryButtonText}>Prepare File</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// Styles remain the same...
const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: "#f8fafc" 
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
    },
    backButton: { 
        padding: 8,
        marginRight: 8,
        marginLeft: -8,
    },
    backIcon: { 
        width: 24, 
        height: 24,
        tintColor: "#0f172a",
    },
    headerTitle: { 
        fontSize: 18, 
        fontWeight: "600", 
        color: "#0f172a" 
    },
    content: { 
        flexGrow: 1,
    },
    mainContent: {
        padding: 24,
        alignItems: 'center',
    },
    previewCard: {
        backgroundColor: "#fff",
        borderRadius: 24,
        padding: 32,
        alignItems: "center",
        width: '100%',
        borderWidth: 1,
        borderColor: "#e2e8f0",
        shadowColor: "#64748b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 40,
    },
    iconWrapper: {
        width: 100,
        height: 100,
        backgroundColor: "#f0f9ff",
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    pdfIcon: { 
        width: 50, 
        height: 50,
        tintColor: "#0ea5e9",
    },
    reportTitle: { 
        fontSize: 20, 
        fontWeight: "700", 
        color: "#0f172a", 
        textAlign: "center", 
        marginBottom: 12,
        lineHeight: 28,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: "#f8fafc",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
        marginBottom: 8,
    },
    reportDate: { 
        fontSize: 14, 
        color: "#64748b",
        fontWeight: "500",
    },
    fileSize: {
        fontSize: 12,
        color: "#94a3b8",
        marginTop: 4,
    },
    actionSection: {
        width: '100%',
    },
    statusContainer: { 
        alignItems: "center", 
        justifyContent: "center",
        padding: 20,
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderStyle: 'dashed',
    },
    statusText: { 
        marginTop: 12, 
        color: "#64748b",
        fontSize: 15,
        fontWeight: "500",
    },
    errorText: { 
        fontSize: 15, 
        color: "#ef4444", 
        textAlign: "center",
        marginVertical: 12,
    },
    retryButton: {
        marginTop: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: "#f1f5f9",
        borderRadius: 8,
    },
    retryButtonText: {
        color: "#475569",
        fontWeight: "600",
        fontSize: 14,
    },
    shareContainer: {
        width: '100%',
        alignItems: 'center',
        gap: 12,
    },
    shareHint: {
        fontSize: 14,
        color: "#94a3b8",
        fontWeight: "500",
    },
    shareButton: {
        backgroundColor: "#0ea5e9",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 16,
        width: '100%',
        shadowColor: "#0ea5e9",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    shareIcon: {
        marginRight: 10,
    },
    shareButtonText: { 
        fontSize: 18, 
        fontWeight: "600", 
        color: "#fff",
        letterSpacing: 0.5,
    },
    // Error state styles
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    button: {
        backgroundColor: "#0ea5e9",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 16,
    },
    buttonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 15,
    },
});