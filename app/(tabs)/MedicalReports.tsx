import React, { useEffect, useState, useRef } from "react";
import {
  Text,
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
  Dimensions,
  Linking,
  RefreshControl,
  Modal,
  TouchableWithoutFeedback
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { supabase } from "../../lib/supabase";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';
import { Feather } from "@expo/vector-icons";

const { width: screenWidth } = Dimensions.get('window');

const MedicalReports = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'History' | 'Reports'>('Reports');
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [isPickingStartDate, setIsPickingStartDate] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [filteredReports, setFilteredReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bucketReady, setBucketReady] = useState(false);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

  const scrollViewRef = useRef<ScrollView>(null);

  // Helper function to parse dates from database
  const parseDateFromDB = (dateString: string): Date => {
    if (!dateString) return new Date();

    // If date is in YYYY-MM-DD format (from our save)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    // If date is ISO string (contains T)
    if (dateString.includes('T')) {
      const date = new Date(dateString);
      // Adjust for timezone offset to get local date
      const timezoneOffset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() + timezoneOffset);
    }

    // Default parsing
    return new Date(dateString);
  };

  // Helper to decode base64 to Uint8Array (replaces atob)
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

  useFocusEffect(
    React.useCallback(() => {
      if (activeTab === 'Reports') {
        fetchGeneratedReports();
      }
    }, [activeTab])
  );

  useEffect(() => {
    fetchUser();
    fetchGeneratedReports();
    checkStorageBucket();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredReports(reports);
    } else {
      const filtered = reports.filter(report =>
        report.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${formatDateForDisplay(parseDateFromDB(report.start_date))} - ${formatDateForDisplay(parseDateFromDB(report.end_date))}`
          .toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredReports(filtered);
    }
  }, [searchQuery, reports]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchGeneratedReports();
    setRefreshing(false);
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      console.log('User ID:', user.id);
    }
  };

  const checkStorageBucket = async () => {
    try {
      console.log('Checking storage bucket...');
      const { data, error } = await supabase.storage
        .from('medical-reports')
        .list('', { limit: 1 });

      if (error) {
        console.log('Bucket check error:', error.message);
        setBucketReady(false);
      } else {
        console.log('✅ Storage bucket is accessible');
        setBucketReady(true);
      }
    } catch (error) {
      console.error('Error checking bucket:', error);
      setBucketReady(false);
    }
  };

  const fetchGeneratedReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('medical_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
      setFilteredReports(data || []);
      console.log('Fetched reports:', data?.length || 0);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicationHistory = async (start: Date, end: Date) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        return [];
      }

      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);

      console.log('Fetching medication history from:',
        startDate.toLocaleString(), 'to', endDate.toLocaleString());

      const startTimestamp = startDate.getTime();
      const endTimestamp = endDate.getTime();

      const { data, error } = await supabase
        .from('intake')
        .select('*')
        .eq('user_id', user.id)
        .order('intake_time', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const filteredData = (data || []).filter(record => {
        const recordTime = new Date(record.intake_time).getTime();
        return recordTime >= startTimestamp && recordTime <= endTimestamp;
      });

      console.log('Total records:', data?.length || 0);
      console.log('Filtered records:', filteredData.length);
      return filteredData;
    } catch (error) {
      console.error('Error fetching medication history:', error);
      return [];
    }
  };

  const openDatePicker = (isStartDate: boolean) => {
    setIsPickingStartDate(isStartDate);
    setShowDateModal(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      if (isPickingStartDate) {
        newDate.setHours(0, 0, 0, 0);
        setStartDate(newDate);
      } else {
        newDate.setHours(23, 59, 59, 999);
        setEndDate(newDate);
      }
    }
    setShowDateModal(false);
  };

  const generatePDFFromHistory = async () => {
    if (startDate > endDate) {
      Alert.alert("Invalid Date Range", "Start date must be before end date");
      return;
    }

    setIsGenerating(true);
    try {
      console.log('Generating PDF for date range:', formatDateForDisplay(startDate), 'to', formatDateForDisplay(endDate));
      const medicationHistory = await fetchMedicationHistory(startDate, endDate);

      console.log('Medication history records:', medicationHistory.length);

      if (medicationHistory.length === 0) {
        Alert.alert("No Data", "No medication history found for the selected date range. Please select a different range.");
        return;
      }

      const groupedByDate: { [date: string]: any[] } = {};
      medicationHistory.forEach(record => {
        const date = formatDateForDisplay(new Date(record.intake_time));
        if (!groupedByDate[date]) {
          groupedByDate[date] = [];
        }
        groupedByDate[date].push(record);
      });

      const htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 30px; 
                line-height: 1.6;
                color: #333;
              }
              .header { 
                text-align: center; 
                margin-bottom: 40px;
                padding-bottom: 20px;
                border-bottom: 2px solid #0ea5e9;
              }
              .header h1 {
                color: #0ea5e9;
                margin-bottom: 10px;
              }
              .report-info {
                background-color: #f8fafc;
                padding: 15px;
                borderRadius: 10px;
                margin-bottom: 30px;
              }
              .date-section {
                margin-bottom: 25px;
                page-break-inside: avoid;
              }
              .date-title {
                font-weight: bold; 
                color: #0ea5e9; 
                margin-bottom: 15px;
                font-size: 18px;
                padding-bottom: 5px;
                border-bottom: 1px solid #e2e8f0;
              }
              .medication-card {
                background-color: #fff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 10px;
              }
              .medication-name {
                font-weight: bold;
                color: #0f172a;
                font-size: 16px;
                margin-bottom: 4px;
              }
              .medication-time {
                color: #64748b;
                font-size: 14px;
              }
              .medication-details {
                color: #475569;
                font-size: 14px;
                margin-top: 4px;
              }
              .footer { 
                margin-top: 50px; 
                font-size: 12px; 
                color: #64748b;
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
              }
              .watermark {
                position: fixed;
                opacity: 0.1;
                font-size: 80px;
                color: #0ea5e9;
                transform: rotate(-45deg);
                top: 40%;
                left: 10%;
                z-index: -1;
              }
              @page {
                margin: 20mm;
              }
            </style>
          </head>
          <body>
            <div class="watermark">MEDICAL REPORT</div>
            
            <div class="header">
              <h1>MEDICATION HISTORY REPORT</h1>
              <p style="color: #64748b; font-size: 16px;">Medication Intake Summary</p>
            </div>
            
            <div class="report-info">
              <div style="display: flex; justify-content: space-between;">
                <div>
                  <p><strong>Report Period:</strong> ${formatDateForDisplay(startDate)} to ${formatDateForDisplay(endDate)}</p>
                  <p><strong>Generated On:</strong> ${formatDateTimeForDisplay(new Date())}</p>
                </div>
                <div>
                  <p><strong>Total Records:</strong> ${medicationHistory.length}</p>
                  <p><strong>Report ID:</strong> MH-${Date.now().toString().slice(-8)}</p>
                </div>
              </div>
            </div>
            
            ${Object.entries(groupedByDate).map(([date, records]) => `
              <div class="date-section">
                <div class="date-title">${date}</div>
                ${records.map(record => `
                  <div class="medication-card">
                    <div class="medication-name">${record.medicine_name || 'Unknown Medication'}</div>
                    <div class="medication-time">
                      Time: ${formatTimeForDisplay(new Date(record.intake_time))}
                    </div>
                    ${record.dosage ? `<div class="medication-details">Dosage: ${record.dosage}</div>` : ''}
                    ${record.notes ? `<div class="medication-details">Notes: ${record.notes}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            `).join('')}
            
            <div class="footer">
              <p><strong>Disclaimer:</strong> This report is generated automatically from your medication intake records.</p>
              <p>For any medical concerns, please consult with your healthcare provider directly.</p>
              <p style="margin-top: 20px;">
                <strong>Confidentiality Notice:</strong> This document contains privileged and confidential information.
                Unauthorized disclosure is prohibited.
              </p>
            </div>
          </body>
        </html>
      `;

      console.log('Generating PDF file...');
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        width: 612,
        height: 792,
      });

      console.log('PDF generated at:', uri);

      const localFileName = `Medication_Report_${formatDateForFileName(startDate)}_to_${formatDateForFileName(endDate)}.pdf`;
      const localUri = FileSystem.cacheDirectory + localFileName;

      console.log('Copying PDF to local cache:', localUri);
      await FileSystem.copyAsync({
        from: uri,
        to: localUri
      });

      const fileContent = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileName = `medical_report_${userId}_${Date.now()}.pdf`;
      const filePath = `${userId}/${fileName}`;

      console.log('Uploading to Supabase storage:', filePath);

      const byteArray = decodeBase64ToUint8Array(fileContent);

      let storageUrl = localUri;
      let uploadSuccess = false;

      if (bucketReady) {
        try {
          const { data: storageData, error: storageError } = await supabase.storage
            .from('medical-reports')
            .upload(filePath, byteArray, {
              contentType: 'application/pdf',
              cacheControl: '3600',
              upsert: false
            });

          if (storageError) {
            console.error('Storage upload error:', storageError);
            throw new Error(`Storage upload failed: ${storageError.message}`);
          }

          const { data: urlData } = supabase.storage
            .from('medical-reports')
            .getPublicUrl(filePath);

          storageUrl = urlData.publicUrl;
          uploadSuccess = true;
          console.log('✅ Uploaded to Supabase storage:', storageUrl);
        } catch (uploadError) {
          console.error('Upload failed, saving locally only:', uploadError);
        }
      }

      const fileInfo = await FileSystem.getInfoAsync(localUri);
      const fileSize = fileInfo.exists ? (fileInfo as any).size || 0 : 0;

      console.log('Saving to database...');
      // Save dates as YYYY-MM-DD format (no timezone)
      const startDateStr = startDate.getFullYear() + '-' +
        String(startDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(startDate.getDate()).padStart(2, '0');

      const endDateStr = endDate.getFullYear() + '-' +
        String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(endDate.getDate()).padStart(2, '0');

      const { data: reportData, error: dbError } = await supabase
        .from('medical_reports')
        .insert([
          {
            user_id: userId,
            file_name: fileName,
            file_url: storageUrl,
            file_size: fileSize,
            start_date: startDateStr, // Save as YYYY-MM-DD
            end_date: endDateStr, // Save as YYYY-MM-DD
            title: `Medication History - ${formatDateForDisplay(startDate)} to ${formatDateForDisplay(endDate)}`,
            description: `Medication intake report from ${formatDateForDisplay(startDate)} to ${formatDateForDisplay(endDate)}`,
            storage_path: filePath,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      let successMessage = `✅ PDF generated with ${medicationHistory.length} records\n\n`;
      successMessage += `📅 Period: ${formatDateForDisplay(startDate)} to ${formatDateForDisplay(endDate)}\n`;
      successMessage += `💾 Saved locally on your device\n`;

      if (uploadSuccess) {
        successMessage += `☁️ Also backed up to cloud storage`;

        Alert.alert(
          "Success!",
          successMessage,
          [
            {
              text: "OK",
              style: "default",
              onPress: () => {
                fetchGeneratedReports();
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }
            }
          ]
        );
      } else {
        successMessage += `⚠️ Cloud backup failed (local copy saved)`;

        Alert.alert(
          "Success!",
          successMessage,
          [
            {
              text: "OK",
              style: "default",
              onPress: () => {
                fetchGeneratedReports();
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }
            }
          ]
        );
      }

    } catch (error: any) {
      console.error('PDF generation error:', error);
      Alert.alert("Error", `Failed to generate PDF: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDateForDisplay = (date: Date | string) => {
    const dateObj = date instanceof Date ? date : parseDateFromDB(date);

    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTimeForDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeForDisplay = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateForFileName = (date: Date) => {
    // Use local date for filename
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const downloadPDF = async (report: any) => {
    setDownloading(report.id);
    try {
      // First download the file locally
      let localUri = '';

      if (report.storage_path && bucketReady) {
        try {
          console.log('Downloading from Supabase:', report.storage_path);
          const { data, error } = await supabase.storage
            .from('medical-reports')
            .download(report.storage_path);

          if (error) throw error;

          const fileName = report.file_name || `medical_report_${report.id}.pdf`;
          localUri = FileSystem.cacheDirectory + fileName;

          const base64data = await blobToBase64(data);
          const base64Content = base64data.split(',')[1];

          await FileSystem.writeAsStringAsync(
            localUri,
            base64Content,
            { encoding: FileSystem.EncodingType.Base64 }
          );

        } catch (storageError) {
          console.log('Storage download failed:', storageError);
          // If storage download fails, try to use local file URL
          if (report.file_url && report.file_url.includes('file://')) {
            localUri = report.file_url;
          } else {
            Alert.alert(
              "Download Error",
              "Could not download the file. Please try generating a new report.",
              [{ text: "OK" }]
            );
            setDownloading(null);
            return;
          }
        }
      } else if (report.file_url && report.file_url.includes('file://')) {
        localUri = report.file_url;
      } else {
        Alert.alert(
          "File Access",
          "Could not access the file. Please try generating a new report.",
          [{ text: "OK" }]
        );
        setDownloading(null);
        return;
      }

      // Now show the save options dialog
      Alert.alert(
        "Save Medical Report",
        "Choose how you'd like to save or share this report:",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setDownloading(null)
          },
          {
            text: "Save to Device",
            onPress: async () => {
              try {
                // Request media library permission
                if (Platform.OS === 'ios') {
                  const { status } = await MediaLibrary.requestPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert("Permission Required", "Please grant permission to save files to your device.");
                    return;
                  }
                }

                // Create a permanent copy in documents directory
                const fileName = report.file_name || `medical_report_${report.id}.pdf`;
                const documentDir = FileSystem.documentDirectory;
                const destinationUri = documentDir + fileName;

                await FileSystem.copyAsync({
                  from: localUri,
                  to: destinationUri
                });

                if (Platform.OS === 'android') {
                  // On Android, we can save to downloads folder
                  const downloadsDir = FileSystem.cacheDirectory + '../Download/';
                  const downloadUri = downloadsDir + fileName;

                  try {
                    await FileSystem.copyAsync({
                      from: localUri,
                      to: downloadUri
                    });
                    Alert.alert("✅ Saved!", "Report saved to your device's Downloads folder.");
                  } catch (e) {
                    Alert.alert("✅ Saved!", "Report saved to app's document folder.");
                  }
                } else {
                  Alert.alert("✅ Saved!", "Report saved to your device.");
                }

              } catch (error: any) {
                console.error('Save error:', error);
                Alert.alert("Error", "Failed to save report to device.");
              } finally {
                setDownloading(null);
              }
            }
          },
          {
            text: "Email as Attachment",
            onPress: () => {
              const emailUrl = `mailto:?subject=Medical Report&body=Attached is your medical report.&attachment=${localUri}`;
              Linking.openURL(emailUrl).catch(err => {
                Alert.alert("Error", "Could not open email client.");
              });
              setDownloading(null);
            }
          }
        ]
      );

    } catch (error: any) {
      Alert.alert("Error", `Failed to access report: ${error.message}`);
      setDownloading(null);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
    });
  };

  const deleteReport = async (report: any) => {
    setDeleting(report.id);

    Alert.alert(
      "Delete Report",
      `Are you sure you want to delete "${report.title}"?\n\nThis will delete from both:\n• Cloud storage\n• Database records\n\n⚠️ This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setDeleting(null)
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (report.storage_path && bucketReady) {
                const { error: storageError } = await supabase.storage
                  .from('medical-reports')
                  .remove([report.storage_path]);

                if (storageError && !storageError.message.includes('not found')) {
                  console.warn('Storage delete warning:', storageError.message);
                }
              }

              const { error: dbError } = await supabase
                .from('medical_reports')
                .delete()
                .eq('id', report.id);

              if (dbError) throw dbError;

              Alert.alert("✅ Success", "Report deleted successfully");
              fetchGeneratedReports();
            } catch (error: any) {
              Alert.alert("Error", `Failed to delete report: ${error.message}`);
            } finally {
              setDeleting(null);
            }
          }
        }
      ]
    );
  };

  const formatDateSimple = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getWeekday = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short'
    });
  };

  return (
    <SafeAreaView style={styles.medicalReports}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#0ea5e9"]}
            tintColor="#0ea5e9"
          />
        }
      >
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.headerCard}>
            <View style={styles.headerContent}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.push('/(tabs)/profile')}
              >
                <Image
                  style={styles.backIcon}
                  resizeMode="cover"
                  source={require('../../assets/backArrow.png')}
                />
              </TouchableOpacity>
              <Image
                style={styles.headerIcon}
                resizeMode="cover"
                source={require('../../assets/PDFB.png')}
              />
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Medical Reports</Text>
                <Text style={styles.headerSubtitle}>Generate and manage your medical reports</Text>
                {!bucketReady && (
                  <Text style={styles.warningText}>
                    ⚠️ Cloud storage not configured - reports will be saved locally only
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'History' && styles.activeTabButton
              ]}
              onPress={() => router.push('/(tabs)/MedicationHistoryScreen')}
            >
              <Text style={[
                styles.tabButtonText,
                activeTab === 'History' && styles.activeTabButtonText
              ]}>
                History
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'Reports' && styles.activeTabButton
              ]}
              onPress={() => setActiveTab('Reports')}
            >
              <Text style={[
                styles.tabButtonText,
                activeTab === 'Reports' && styles.activeTabButtonText
              ]}>
                Reports
              </Text>
            </TouchableOpacity>
          </View>

          {/* Reports Tab Content */}
          {activeTab === 'Reports' && (
            <View style={styles.reportsContent}>

              {/* Generate Report Card */}
              <View style={styles.generateCard}>
                <View style={styles.generateHeader}>
                  <Image
                    style={styles.generateIcon}
                    resizeMode="cover"
                    source={require('../../assets/PDFB.png')}
                  />
                  <View style={styles.generateTextContainer}>
                    <Text style={styles.generateTitle}>Generate PDF Report</Text>
                    <Text style={styles.generateSubtitle}>Select date range for report</Text>
                    <Text style={styles.generateInfo}>
                      📱 Files are saved locally on your device {bucketReady && "and backed up to cloud"}
                    </Text>
                  </View>
                </View>

                <View style={styles.dateSection}>
                  <Text style={styles.dateRangeHint}>
                    Select exact start and end dates for your report
                  </Text>

                  <View style={styles.dateInputsContainer}>
                    <View style={styles.dateInputWrapper}>
                      <Text style={styles.dateLabel}>Start Date</Text>
                      <TouchableOpacity
                        style={styles.dateInput}
                        onPress={() => openDatePicker(true)}
                      >
                        <Text style={styles.dateInputText}>{formatDateSimple(startDate)}</Text>
                        <Text style={styles.datePickerHint}>
                          {getWeekday(startDate)}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.dateInputWrapper}>
                      <Text style={styles.dateLabel}>End Date</Text>
                      <TouchableOpacity
                        style={styles.dateInput}
                        onPress={() => openDatePicker(false)}
                      >
                        <Text style={styles.dateInputText}>{formatDateSimple(endDate)}</Text>
                        <Text style={styles.datePickerHint}>
                          {getWeekday(endDate)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.generateButton,
                      isGenerating && styles.generateButtonDisabled
                    ]}
                    onPress={generatePDFFromHistory}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.generateButtonText}>
                        📄 Generate PDF Report
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Generated Reports Section */}
              <View style={styles.generatedSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Generated Reports</Text>
                  <View style={styles.reportCountContainer}>
                    <TouchableOpacity onPress={fetchGeneratedReports}>
                      <Text style={styles.refreshText}>🔄 Refresh</Text>
                    </TouchableOpacity>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{filteredReports.length} reports</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.searchContainer}>
                  <Image
                    style={styles.searchIcon}
                    resizeMode="cover"
                    source={require('../../assets/searchPDFIcon.png')}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by report name or date range"
                    placeholderTextColor="#64748b"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Text style={styles.clearSearch}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.reportsList}>
                  {loading ? (
                    <ActivityIndicator size="large" color="#0ea5e9" style={styles.loader} />
                  ) : filteredReports.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Image source={require('../../assets/PDFw.png')} style={styles.emptyIcon} />
                      <Text style={styles.emptyText}>
                        {searchQuery ? 'No reports match your search' : 'No reports generated yet'}
                      </Text>
                      <Text style={styles.emptySubText}>
                        {searchQuery ? 'Try a different search term' : 'Generate your first medical report to get started'}
                      </Text>
                    </View>
                  ) : (
                    filteredReports.map((report) => (
                      <View key={report.id} style={styles.reportCard}>
                        <View style={styles.reportContent}>
                          <Image
                            style={styles.reportIcon}
                            resizeMode="cover"
                            source={require('../../assets/PDFB.png')}
                          />
                          <View style={styles.reportDetails}>
                            <Text style={styles.reportTitle} numberOfLines={1}>
                              {report.title}
                            </Text>
                            <Text style={styles.reportDateRange}>
                              {formatDateForDisplay(report.start_date)} - {formatDateForDisplay(report.end_date)}
                            </Text>
                            <View style={styles.reportMeta}>
                              <Text style={styles.reportMetaText}>
                                {report.file_size ? `${Math.round(report.file_size / 1024)} KB` : 'N/A'}
                              </Text>
                              <Text style={styles.reportMetaSeparator}>•</Text>
                              <Text style={styles.reportMetaText}>
                                {formatDateForDisplay(report.created_at)}
                              </Text>
                            </View>
                            {report.file_url && report.file_url.includes('file://') && (
                              <Text style={styles.localBadge}>📱 Local File</Text>
                            )}
                            {report.file_url && !report.file_url.includes('file://') && (
                              <Text style={styles.cloudBadge}>☁️ Cloud Backup</Text>
                            )}
                          </View>
                          <View style={styles.reportActions}>
                            <TouchableOpacity
                              style={styles.actionButton}
                              onPress={() => router.push({
                                pathname: '/(tabs)/shareReport',
                                params: { report: JSON.stringify(report) }
                              })}
                            >
                              <Feather name="share-2" size={20} color="#0ea5e9" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.actionButton}
                              onPress={() => downloadPDF(report)}
                              disabled={downloading === report.id}
                            >
                              {downloading === report.id ? (
                                <ActivityIndicator size="small" color="#0ea5e9" />
                              ) : (
                                <Image
                                  style={styles.actionIcon}
                                  resizeMode="cover"
                                  source={require('../../assets/downloadPDFB.png')}
                                />
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => deleteReport(report)}
                              disabled={deleting === report.id}
                            >
                              {deleting === report.id ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.deleteButtonText}>×</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDateModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Select {isPickingStartDate ? 'Start' : 'End'} Date
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowDateModal(false)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={isPickingStartDate ? startDate : endDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    maximumDate={isPickingStartDate ? endDate : new Date()}
                    minimumDate={isPickingStartDate ? undefined : startDate}
                    themeVariant="light"
                    style={styles.datePicker}
                  />
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowDateModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => handleDateChange({ type: 'set' }, isPickingStartDate ? startDate : endDate)}
                  >
                    <Text style={styles.confirmButtonText}>Select Date</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  medicalReports: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },

  // Header Styles
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    marginRight: 8,
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
    fontFamily: "Arimo-Regular",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748b",
    fontFamily: "Arimo-Regular",
    marginTop: 4,
  },
  warningText: {
    fontSize: 12,
    color: "#f59e0b",
    fontFamily: "Arimo-Regular",
    marginTop: 6,
    fontStyle: "italic",
  },
  debugSection: {
    flexDirection: 'row',
    gap: 8,
  },
  debugButton: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: 'center',
    flex: 1,
  },
  debugButtonText: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Arimo-Regular",
    fontWeight: '500',
  },

  // Tab Styles
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    padding: 4,
    borderRadius: 20,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
  },
  activeTabButton: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
    fontFamily: "Arimo-Regular",
  },
  activeTabButtonText: {
    color: "#0ea5e9",
    fontWeight: "bold",
  },

  // Reports Content
  reportsContent: {
    gap: 20,
  },

  // Generate Card
  generateCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  generateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  generateIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#e0f2fe",
  },
  generateTextContainer: {
    flex: 1,
  },
  generateTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    fontFamily: "Arimo-Regular",
  },
  generateSubtitle: {
    fontSize: 14,
    color: "#64748b",
    fontFamily: "Arimo-Regular",
    marginTop: 2,
  },
  generateInfo: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Arimo-Regular",
    marginTop: 4,
    fontStyle: "italic",
  },

  // Date Section
  dateSection: {
    gap: 16,
  },
  dateRangeHint: {
    fontSize: 13,
    color: "#94a3b8",
    fontFamily: "Arimo-Regular",
    textAlign: "center",
    fontStyle: "italic",
  },
  dateInputsContainer: {
    flexDirection: screenWidth > 768 ? "row" : "column",
    gap: 16,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    fontFamily: "Arimo-Regular",
    marginBottom: 8,
  },
  dateInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minHeight: 56,
    justifyContent: "center",
  },
  dateInputText: {
    fontSize: 16,
    color: "#0f172a",
    fontFamily: "Arimo-Regular",
    fontWeight: "500",
  },
  datePickerHint: {
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: "Arimo-Regular",
    marginTop: 4,
  },
  generateButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Arimo-Regular",
  },

  // Generated Section
  generatedSection: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    fontFamily: "Arimo-Regular",
  },
  reportCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshText: {
    fontSize: 12,
    color: "#0ea5e9",
    fontFamily: "Arimo-Regular",
    fontWeight: '500',
  },
  badge: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#0f172a",
    fontFamily: "Arimo-Regular",
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    fontFamily: "Arimo-Regular",
  },
  clearSearch: {
    fontSize: 14,
    color: "#0ea5e9",
    fontFamily: "Arimo-Regular",
    fontWeight: '500',
    marginLeft: 8,
  },

  // Reports List
  reportsList: {
    gap: 12,
  },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  reportContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#e0f2fe",
  },
  reportDetails: {
    flex: 1,
    gap: 4,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    fontFamily: "Arimo-Regular",
  },
  reportDateRange: {
    fontSize: 14,
    color: "#64748b",
    fontFamily: "Arimo-Regular",
  },
  reportMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reportMetaText: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Arimo-Regular",
  },
  reportMetaSeparator: {
    fontSize: 12,
    color: "#64748b",
  },
  localBadge: {
    fontSize: 10,
    color: "#0ea5e9",
    fontFamily: "Arimo-Regular",
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  cloudBadge: {
    fontSize: 10,
    color: "#10b981",
    fontFamily: "Arimo-Regular",
    backgroundColor: "#d1fae5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  reportActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  actionIcon: {
    width: 20,
    height: 20,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Arimo-Regular",
    lineHeight: 22,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    color: "#64748b",
    fontFamily: "Arimo-Regular",
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 14,
    color: "#94a3b8",
    fontFamily: "Arimo-Regular",
    textAlign: "center",
  },

  // Loader
  loader: {
    marginVertical: 40,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    fontFamily: "Arimo-Regular",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  datePickerContainer: {
    padding: 20,
    alignItems: 'center',
  },
  datePicker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 200 : undefined,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
    fontFamily: "Arimo-Regular",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    fontFamily: "Arimo-Regular",
  },
});

export default MedicalReports;