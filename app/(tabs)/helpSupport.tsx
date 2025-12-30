import * as React from "react";
import { 
  ScrollView, 
  StyleSheet, 
  Pressable, 
  Text, 
  View, 
  Image, 
  Dimensions,
  TextInput,
  Alert 
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNavigation from "../../components/BottomNavigation";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "../../lib/supabase";

const { width: screenWidth } = Dimensions.get('window');

const HelpSupport = () => {
  const [expandedFaqs, setExpandedFaqs] = React.useState<number[]>([]);
  const [subject, setSubject] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  
  // Get current user info on component mount
  React.useEffect(() => {
    getUserInfo();
  }, []);

  const getUserInfo = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error("Error getting user:", error);
      setUserEmail(null);
      return;
    }
    
    if (user?.email) {
      setUserEmail(user.email);
      console.log("User email:", user.email);
    } else {
      setUserEmail(null);
      // You might want to handle this case - maybe show a login prompt
      console.warn("User is logged in but email is not available");
    }
  } catch (error) {
    console.error("Unexpected error getting user info:", error);
    setUserEmail(null);
  }
};

  const toggleFaq = (index: number) => {
    setExpandedFaqs(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleSubmitTicket = async () => {
    // Validate inputs
    if (!subject.trim()) {
      Alert.alert("Missing Subject", "Please enter a subject for your support ticket.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Missing Description", "Please describe your issue or question.");
      return;
    }

    if (description.trim().length < 10) {
      Alert.alert("Description Too Short", "Please provide more details about your issue (at least 10 characters).");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert("Authentication Error", "Please sign in to submit a support ticket.");
        setIsSubmitting(false);
        return;
      }

      // Insert ticket into Supabase
      const { data, error } = await supabase
        .from('support_ticket')
        .insert([
          {
            user_id: user.id,
            subject: subject.trim(),
            description: description.trim(),
            reviewed: false
            // created_at will be automatically set by Supabase
          }
        ])
        .select(); // Return the inserted data

      if (error) {
        console.error("Error submitting ticket:", error);
        Alert.alert(
          "Submission Failed", 
          "There was an error submitting your ticket. Please try again."
        );
      } else {
        // Success - clear form and show confirmation
        setSubject("");
        setDescription("");
        
        Alert.alert(
          "Ticket Submitted Successfully!",
          `Your support ticket has been submitted. We'll review it and get back to you at ${user.email}. Ticket ID: ${data[0]?.support_id || 'N/A'}`,
          [
            { 
              text: "OK", 
              onPress: () => console.log("Ticket submitted successfully") 
            }
          ]
        );
        
        // Optional: Log the submission for debugging
        console.log("Ticket submitted:", data[0]);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      Alert.alert(
        "Unexpected Error", 
        "An unexpected error occurred. Please try again later."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqItems = [
    {
      question: "How do I scan my medication?",
      answer: "Use the camera feature in the app to scan your medication label. Make sure you have good lighting and hold your phone steady."
    },
    {
      question: "How do I set up medication reminders?",
      answer: "Go to Home tab > Reminders > + Add New. You can set multiple reminders per day."
    },
    {
      question: "Can I order refills through the app?",
      answer: "Yes, you can request prescription refills directly through the app. We'll contact your pharmacy on your behalf."
    },
    {
      question: "How do I add a payment method?",
      answer: "Go to Profile > Payment Methods > Add New. We accept credit/debit cards and digital wallets."
    },
    {
      question: "Is my medical data secure?",
      answer: "Yes, we use bank-level encryption and comply with HIPAA regulations. Your data is never shared without your consent."
    },
    {
      question: "What if I miss a dose?",
      answer: "The app will show missed doses in your Analytics. You can log them manually and the app will adjust your adherence statistics."
    },
    {
      question: "How do I find nearby pharmacies?",
      answer: "Use the \"Find Pharmacies\" in the app, which shows pharmacies near you with hours, contact info, and directions."
    }
    // add more FAQs as needed
  ];

  const supportMethods = [
    {
      title: "Live Chat",
      description: "Chat with our support team",
      availability: "Available 9 AM - 6 PM MYT",
      icon: "chatbubbles" as const,
      onPress: () => Alert.alert("Live Chat", "This feature will open a chat window. Coming soon!")
    },
    {
      title: "Email Support",
      description: "support@pillora.my",
      availability: "Response within 24 hours",
      icon: "mail" as const,
      onPress: () => {
        // Open email client
        Alert.alert(
          "Email Support", 
          "You can email us at support@pillora.my",
          [
            { text: "Copy Email", onPress: () => {
              // Code to copy to clipboard would go here
              Alert.alert("Copied", "Email address copied to clipboard");
            }},
            { text: "OK", style: "cancel" }
          ]
        );
      }
    },
    {
      title: "Phone Support",
      description: "+60 00-000 0000",
      availability: "Mon-Fri, 9 AM - 6 PM MYT",
      icon: "call" as const,
      onPress: () => {
        Alert.alert(
          "Phone Support", 
          "Call us at +60 3-2123 4567",
          [
            { text: "Call", onPress: () => {
              // Code to initiate phone call would go here
              console.log("Initiating call to +60 3-2123 4567");
            }},
            { text: "Copy Number", onPress: () => {
              // Code to copy to clipboard would go here
              Alert.alert("Copied", "Phone number copied to clipboard");
            }},
            { text: "Cancel", style: "cancel" }
          ]
        );
      }
    }
  ];

  const helpResources = [
    {
      title: "User Guide",
      description: "Learn how to use Pillora",
      icon: "book" as const,
      onPress: () => Alert.alert("User Guide", "Opening user guide...")
    },
    {
      title: "Video Tutorials",
      description: "Watch step-by-step guides",
      icon: "videocam" as const,
      onPress: () => Alert.alert("Video Tutorials", "Opening video tutorials...")
    },
    {
      title: "Terms & Privacy",
      description: "Read our policies",
      icon: "shield-checkmark" as const,
      onPress: () => Alert.alert("Terms & Privacy", "Opening terms and privacy policies...")
    },
    {
      title: "Report a Problem",
      description: "Report bugs or issues",
      icon: "bug" as const,
      onPress: () => Alert.alert("Report a Problem", "Opening bug report form...")
    }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient 
        colors={['#f8fafc', 'rgba(239, 246, 255, 0.3)', 'rgba(236, 254, 255, 0.2)']}
        locations={[0, 0.5, 1]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>Help & Support</Text>
              <Text style={styles.subtitle}>
                {userEmail ? `We're here to help you, ${userEmail.split('@')[0]}` : "We're here to help you"}
              </Text>
            </View>
          </View>

          {/* Contact Us Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Us</Text>
            
            {supportMethods.map((method, index) => (
              <Pressable 
                key={index} 
                style={styles.card} 
                onPress={method.onPress}
                disabled={isSubmitting}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardIconContainer}>
                    <Ionicons name={method.icon} size={24} color="#0ea5e9" />
                  </View>
                  <View style={styles.cardTextContainer}>
                    <Text style={styles.cardTitle}>{method.title}</Text>
                    <Text style={styles.cardDescription}>{method.description}</Text>
                    <Text style={styles.cardAvailability}>{method.availability}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#64748b" />
                </View>
              </Pressable>
            ))}
          </View>

          {/* Support Ticket Section */}
          <View style={styles.section}>
            <View style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <Ionicons name="document-text" size={20} color="#0ea5e9" />
                <Text style={styles.sectionTitle}>Submit Support Ticket</Text>
              </View>
              
              <View style={styles.ticketForm}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Subject *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="What is your issue about?"
                    placeholderTextColor="#94a3b8"
                    value={subject}
                    onChangeText={setSubject}
                    editable={!isSubmitting}
                    maxLength={100}
                  />
                  <Text style={styles.charCounter}>
                    {subject.length}/100 characters
                  </Text>
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Description *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Please describe your issue or question in detail..."
                    placeholderTextColor="#94a3b8"
                    value={description}
                    onChangeText={setDescription}
                    editable={!isSubmitting}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    maxLength={1000}
                  />
                  <Text style={styles.charCounter}>
                    {description.length}/1000 characters (Minimum 10)
                  </Text>
                </View>
                
                <View style={styles.submitInfo}>
                  <Ionicons name="information-circle" size={16} color="#64748b" />
                  <Text style={styles.submitInfoText}>
                    We'll respond to your ticket within 24 hours at {userEmail || "your registered email"}
                  </Text>
                </View>
                
                <LinearGradient
                  colors={['#0ea5e9', '#0284c7']}
                  style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Pressable 
                    onPress={handleSubmitTicket} 
                    disabled={isSubmitting}
                    style={styles.submitButtonPressable}
                  >
                    {isSubmitting ? (
                      <View style={styles.submittingContainer}>
                        <Ionicons name="time" size={20} color="#fff" />
                        <Text style={styles.submitButtonText}>Submitting...</Text>
                      </View>
                    ) : (
                      <View style={styles.submitButtonContent}>
                        <Ionicons name="paper-plane" size={20} color="#fff" />
                        <Text style={styles.submitButtonText}>Submit Ticket</Text>
                      </View>
                    )}
                  </Pressable>
                </LinearGradient>
              </View>
            </View>
          </View>

          {/* FAQ Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            
            {faqItems.map((faq, index) => (
              <Pressable 
                key={index} 
                style={styles.faqItem}
                onPress={() => toggleFaq(index)}
                disabled={isSubmitting}
              >
                <View style={styles.faqQuestion}>
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <Ionicons 
                    name={expandedFaqs.includes(index) ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#64748b" 
                  />
                </View>
                {expandedFaqs.includes(index) && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/* Help Resources */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Help Resources</Text>
            
            <View style={styles.resourcesGrid}>
              {helpResources.map((resource, index) => (
                <Pressable 
                  key={index} 
                  style={styles.resourceCard} 
                  onPress={resource.onPress}
                  disabled={isSubmitting}
                >
                  <View style={styles.resourceContent}>
                    <View style={styles.resourceIconContainer}>
                      <Ionicons name={resource.icon} size={24} color="#0ea5e9" />
                    </View>
                    <Text style={styles.resourceTitle}>{resource.title}</Text>
                    <Text style={styles.resourceDescription}>{resource.description}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Emergency Notice */}
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyHeader}>
              <Ionicons name="warning" size={24} color="#ef4444" />
              <Text style={styles.emergencyTitle}>Medical Emergency</Text>
            </View>
            <Text style={styles.emergencyText}>
              This app is not for emergencies. Call 999 (Malaysia) or visit the nearest hospital immediately.
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Pillora Support Team • Available 24/7</Text>
          </View>
        </ScrollView>
        
        {/* Bottom Navigation */}
        <View style={styles.bottomNavWrapper}>
          <BottomNavigation />
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  headerContent: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    fontFamily: 'Arimo-Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    fontFamily: 'Arimo-Regular',
    lineHeight: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    fontFamily: 'Arimo-SemiBold',
    marginBottom: 16,
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    fontFamily: 'Arimo-SemiBold',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Arimo-Regular',
    marginBottom: 2,
  },
  cardAvailability: {
    fontSize: 12,
    color: '#0ea5e9',
    fontFamily: 'Arimo-Regular',
  },
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ticketForm: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    fontFamily: 'Arimo-SemiBold',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 16,
    fontFamily: 'Arimo-Regular',
    color: '#0f172a',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Arimo-Regular',
    textAlign: 'right',
    marginTop: 4,
    marginRight: 4,
  },
  submitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  submitInfoText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Arimo-Regular',
    marginLeft: 8,
    flex: 1,
  },
  submitButton: {
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonPressable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submittingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Arimo-SemiBold',
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontFamily: 'Arimo-Regular',
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Arimo-Regular',
    lineHeight: 20,
  },
  resourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  resourceCard: {
    width: (screenWidth - 48) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginHorizontal: 8,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  resourceContent: {
    alignItems: 'center',
  },
  resourceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    fontFamily: 'Arimo-SemiBold',
    textAlign: 'center',
    marginBottom: 4,
  },
  resourceDescription: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Arimo-Regular',
    textAlign: 'center',
  },
  emergencyCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    fontFamily: 'Arimo-SemiBold',
    marginLeft: 8,
  },
  emergencyText: {
    fontSize: 14,
    color: '#0f172a',
    fontFamily: 'Arimo-Regular',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Arimo-Regular',
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
});

export default HelpSupport;