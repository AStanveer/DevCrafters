// SupabaseChatbot.ts - COMPLETE VERSION WITH MEDICINE DATABASE
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

// Types
interface IntentData {
  patterns: string[];
  responses: string[];
}

interface ChatbotIntents {
  [key: string]: IntentData;
}

interface KeywordRule {
  keywords: string[];
  contextWords?: string[];
  response: string;
  category: string;
}

export class SupabaseChatbot {
  private localIntents: ChatbotIntents = {};
  public isOnline: boolean = true;
  private conversationHistory: string[] = [];
  
  // SMART KEYWORD DETECTION RULES
  private keywordRules: KeywordRule[] = [
    // MEDICATION REFILL DETECTION
    {
      keywords: ['running low', 'getting low', 'almost empty', 'nearly out', 'low supply', 'low on', 'almost out', 'finishing soon', 'last few', 'need more', 'out of', 'no more'],
      contextWords: ['medicine', 'medication', 'pill', 'tablet', 'prescription', 'drug', 'pills', 'tablets'],
      response: "📋 Your medication is running low? Please go to the **Refill Feature** and select your pharmacy for a refill request. You should request refills 3-5 days before running out completely. Would you like me to guide you through the refill process?",
      category: 'medication_refill'
    },
    
    // MEDICINE INFORMATION QUERIES
    {
      keywords: ['side effect', 'side effects', 'adverse effect', 'reaction'],
      contextWords: ['medicine', 'medication', 'drug', 'pill', 'tablet', 'capsule', 'injection'],
      response: "🤔 I can check side effects for you! Please tell me the **name of the medicine** you're asking about. For example: 'side effects of paracetamol' or 'what are the side effects of ibuprofen?'",
      category: 'medicine_side_effects_ask'
    },
    {
      keywords: ['side effects of', 'side effects for', 'effects of', 'reaction to'],
      response: "💊 Let me check that for you...",
      category: 'medicine_side_effects_lookup'
    },
    {
      keywords: ['how to take', 'how should i take', 'dosage for', 'dose of', 'when to take'],
      contextWords: ['medicine', 'medication', 'drug'],
      response: "📝 I can check dosage instructions! Please tell me the **medicine name**. For example: 'how to take metformin' or 'what is the dosage for amoxicillin?'",
      category: 'medicine_dosage_ask'
    },
    {
      keywords: ['purpose of', 'what is', 'what does', 'used for', 'treats', 'treat'],
      contextWords: ['medicine', 'medication', 'drug', 'pill'],
      response: "🧪 I can tell you about that medicine! Please specify the **medicine name**. For example: 'what is lisinopril for?' or 'purpose of ventolin'",
      category: 'medicine_purpose_ask'
    },
    {
      keywords: ['interaction', 'interact with', 'mix with', 'take with', 'combine with'],
      contextWords: ['medicine', 'medication', 'drug'],
      response: "⚠️ I can check drug interactions! Please tell me the **medicine name**. For example: 'does ibuprofen interact with aspirin?' or 'interactions of warfarin'",
      category: 'medicine_interactions_ask'
    },
    {
      keywords: ['warnings', 'precautions', 'risks', 'danger', 'contraindications'],
      contextWords: ['medicine', 'medication', 'drug'],
      response: "🚨 I can check safety warnings! Please specify the **medicine name**. For example: 'warnings for prednisolone' or 'precautions with metformin'",
      category: 'medicine_warnings_ask'
    },
    
    // SIDE EFFECTS DETECTION (General)
    {
      keywords: ['feeling sick', 'nausea', 'dizziness', 'headache', 'rash', 'allergic', 'sick from', 'bad reaction'],
      contextWords: ['medicine', 'medication', 'after taking', 'from the pill', 'taking'],
      response: "🤒 Experiencing side effects? Please **stop taking the medication** and contact your doctor or pharmacist immediately. Some side effects are normal, but serious ones need medical attention. Describe your symptoms to your healthcare provider.",
      category: 'side_effects'
    },
    
    // PRICE/COST DETECTION
    {
      keywords: ['price', 'cost', 'how much', 'expensive', 'cheap', 'insurance', 'co-pay', 'co pay', 'payment', 'pay for'],
      contextWords: ['medicine', 'medication', 'prescription', 'drug', 'pill'],
      response: "💰 For pricing information, please check the **Pricing Feature** in the app or contact your pharmacy directly. Prices vary based on insurance, dosage, and pharmacy location. You can also compare prices between different pharmacies in the app.",
      category: 'pricing'
    },
    
    // INTERACTIONS DETECTION
    {
      keywords: ['interaction', 'interact', 'mix', 'take with', 'alcohol', 'food', 'drink', 'combine'],
      contextWords: ['medicine', 'medication', 'pill', 'with'],
      response: "⚠️ Medication interactions are important! Check the **Interactions Feature** in the app to see if your medications interact with food, alcohol, or other drugs. Always consult your pharmacist before mixing medications.",
      category: 'interactions'
    },
    
    // DOSAGE/TIMING DETECTION
    {
      keywords: ['dosage', 'dose', 'how many', 'frequency', 'morning', 'night', 'with food', 'empty stomach', 'how often'],
      contextWords: ['medicine', 'medication', 'pill', 'take'],
      response: "⏰ For dosage instructions, please check the **Medication Details** section in the app. Always follow your doctor's prescription. If you're unsure, contact your pharmacist. Taking medication at the right time is crucial for effectiveness.",
      category: 'dosage'
    },
    
    // PHARMACY LOCATION/HOURS
    {
      keywords: ['pharmacy', 'location', 'near me', 'hours', 'open', 'close', '24 hour', '24/7', 'find pharmacy', 'where pharmacy'],
      contextWords: ['find', 'locate', 'where is', 'when', 'nearest'],
      response: "📍 Looking for a pharmacy? Use the **Pharmacy Locator Feature** to find pharmacies near you with current hours, contact information, and services offered. You can filter by 24-hour pharmacies or specific services.",
      category: 'pharmacy_location'
    },
    
    // PRESCRIPTION STATUS
    {
      keywords: ['status', 'ready', 'pick up', 'when ready', 'processed', 'filled', 'refill ready', 'when will it be ready'],
      contextWords: ['prescription', 'refill', 'order', 'medication'],
      response: "📦 Check your prescription status in the **Prescription Tracker Feature**. You'll see if it's being processed, ready for pickup, or if there are any issues. You'll also receive notifications when it's ready.",
      category: 'prescription_status'
    },

    {
  keywords: ['reminder', 'how to make reminder'],
  response: "⏰ **How to make reminder for medicine:**\n\nFirst, click on the reminder tab. Choose the time and the amount of the taking medicine per day. When it reaches the time, it will pop out as a notification for you to take your respective medicine. After taking the medicine, do not forget to click on 'I already took the medicine' confirmation button.",
  category: 'reminder_exact'
},
{
  keywords: ['identify medicine', 'how to identify medicine', 'eyes is not good', 'eyes are not good'],
  response: "👁️ **How to identify medicine when vision is poor:**\n\nFirst, click on the scan icon from the navigation tab. Then, you can choose to take photo of the medicine package or just upload the photo of the package of the medicine. This is the feature to detect and identify the medicine name. Next, it will show the name and all the details of the medicine. After that, you can choose to scan again or just add the medicine to your medicine list by clicking 'Add to My Med' button.",
  category: 'identification_exact'
},
{
  keywords: ['analytics', 'view my analytics', 'how to view my analytics'],
  response: "📊 **How to view your analytics:**\n\nFirstly, click on the analytics button on the navigation tab. Next, you can track base on weekly, monthly, quarter year or even yearly record by switching the tracking adherence at the top of the page. Besides, you can choose to see on your adherence, intake and also trends by also switching the tab at the middle of the page.",
  category: 'analytics_exact'
},
{
  keywords: ['view medicine list', 'how to view my medicine list', 'medicine list'],
  response: "📋 **How to view medicine list:**\n\nFirstly, click on the meds icon at the navigation tab. You can see all the medicine at the all tab. You can also add the medicine by clicking the add medication button. If there is medicine expired today, it will pop up at the Due Today tab. If there is medicine at the Low Stock tab, you need to pay attention to it because it is about to finish. You can choose to click on the medicine and click Request Refill.\n\nAt the request refill, you will be direct to select the pharmacy, quantity and continue to the payment. After the payment is successfully made, you will need to wait for the pharmacy to notify you for the pickup.",
  category: 'medlist_exact'
},
{
  keywords: ['refill medicine', 'how to refill my medicine'],
  response: "🔄 **How to refill medicine:**\n\nFirst, click on the meds icon at the navigation button. Next, click on the medicine you desire to refill. After that, click on request refill.\n\nAt the request refill, you will be direct to select the pharmacy, quantity and continue to the payment. After the payment is successfully made, you will need to wait for the pharmacy to notify you for the pickup.",
  category: 'refill_exact'
}

    
  ];

  constructor() {
    this.loadLocalIntents();
    this.checkConnection();
  }

  private async checkConnection() {
    try {
      const { error } = await supabase
        .from('chatbot_intents')
        .select('id')
        .limit(1);
      
      this.isOnline = !error;
      console.log(`📡 Database connection: ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);
    } catch (error: any) {
      this.isOnline = false;
      console.log('⚠️ Offline mode - will sync later');
    }
  }

  private async loadLocalIntents() {
    try {
      const saved = await AsyncStorage.getItem('chatbot_intents');
      this.localIntents = saved ? JSON.parse(saved) : this.getDefaultIntents();
    } catch (error) {
      this.localIntents = this.getDefaultIntents();
    }
  }

  private getDefaultIntents(): ChatbotIntents {
    return {
      greeting: {
        patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
        responses: ['Hello! 👋 How can I help you with your medications today?', 'Hi there! I\'m your pharmacy assistant. What can I help you with?', 'Hey! Need help with prescriptions, refills, or medication questions?']
      },
      goodbye: {
        patterns: ['bye', 'goodbye', 'see you', 'thanks bye', 'thank you bye'],
        responses: ['Goodbye! 👋 Stay healthy!', 'See you! Remember to take your medications on time.', 'Bye! Contact me anytime for medication assistance.']
      },
      thanks: {
        patterns: ['thank you', 'thanks', 'appreciate', 'helpful'],
        responses: ['You\'re welcome! 😊 Happy to help with your medication needs.', 'Glad I could help! Let me know if you have more questions.', 'Anytime! Stay healthy!']
      }
    };
  }

  // ========== MEDICINE DATABASE LOOKUP ==========
  async getMedicineInfo(medicineName: string): Promise<string | null> {
    if (!this.isOnline) {
      console.log('⚠️ Cannot check medicine database: Offline');
      return null;
    }
    
    try {
      console.log(`🔍 Looking up medicine: ${medicineName}`);
      
      // Search by medicine name or generic name
      const { data, error } = await supabase
        .from('medicine_reference')
        .select('*')
        .or(`medicine_name.ilike.%${medicineName}%,generic_name.ilike.%${medicineName}%`)
        .limit(1);

      if (error) {
        console.error('❌ Medicine query error:', error.message);
        return null;
      }

      if (data && data.length > 0) {
        const medicine = data[0];
        console.log(`✅ Found medicine: ${medicine.medicine_name}`);
        return this.formatMedicineResponse(medicine);
      }
      
      console.log(`❌ Medicine not found: ${medicineName}`);
      return null;
    } catch (error: any) {
      console.error('Medicine lookup failed:', error.message);
      return null;
    }
  }

  private formatMedicineResponse(medicine: any): string {
    const response = `
💊 **${medicine.medicine_name}** (${medicine.generic_name})

**Purpose:**
${medicine.purpose}

**How to Take:**
${medicine.how_to_take}

**Common Side Effects:**
${medicine.common_side_effects}

**⚠️ Serious Side Effects (Seek Medical Help):**
${medicine.serious_side_effects}

**🚨 Warnings:**
${medicine.warnings}

**💊 Drug Interactions:**
${medicine.drug_interactions || 'No significant interactions noted'}

**💊 Dosage:** ${medicine.dosage}
**🏭 Manufacturer:** ${medicine.manufacturer}
**📁 Category:** ${medicine.category}
**📦 Storage:** ${medicine.storage}

_This information is for educational purposes only. Always consult your doctor or pharmacist for medical advice._`;

    return response;
  }

  // ========== EXTRACT MEDICINE NAME FROM QUERY ==========
  private extractMedicineName(input: string): string | null {
    const medicinePatterns = [
      /side effects of (\w+)/i,
      /side effects for (\w+)/i,
      /effects of (\w+)/i,
      /how to take (\w+)/i,
      /dosage of (\w+)/i,
      /dose of (\w+)/i,
      /what is (\w+)/i,
      /what does (\w+) do/i,
      /purpose of (\w+)/i,
      /(\w+) side effects/i,
      /(\w+) dosage/i,
      /(\w+) how to take/i,
      /interactions of (\w+)/i,
      /(\w+) interactions/i,
      /warnings for (\w+)/i,
      /(\w+) warnings/i,
      /information about (\w+)/i,
      /tell me about (\w+)/i,
      /about (\w+)/i,
      /details of (\w+)/i,
      /medicine (\w+)/i,
      /drug (\w+)/i,
      /medication (\w+)/i
    ];
    
    for (const pattern of medicinePatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        const medicineName = match[1].toLowerCase();
        console.log(`💊 Extracted medicine name: "${medicineName}" from "${input}"`);
        return medicineName;
      }
    }
    
    // Check if input is just a medicine name
    const commonMedicines = [
      'paracetamol', 'panadol', 'prednisolone', 'ventolin', 'amoxil', 'lisinopril', 
      'ibuprofen', 'nexium', 'ciplox', 'zyrtec', 'lipitor', 'omeprazole', 
      'diclofenac', 'flagyl', 'glucophage', 'augmentin', 'norvasc', 'synthroid',
      'lasix', 'claritin', 'amaryl', 'acetaminophen', 'salbutamol', 'amoxicillin',
      'esomeprazole', 'ciprofloxacin', 'cetirizine', 'atorvastatin', 'furosemide',
      'loratadine', 'metformin', 'amlodipine', 'levothyroxine', 'glimepiride'
    ];
    
    const lowerInput = input.toLowerCase();
    for (const med of commonMedicines) {
      if (lowerInput.includes(med)) {
        console.log(`💊 Recognized medicine name: "${med}" in "${input}"`);
        return med;
      }
    }
    
    return null;
  }

  // ========== SMART KEYWORD DETECTION ==========
  private detectSmartKeywords(input: string): string | null {
    const lowerInput = input.toLowerCase();
    
    // Store matches with scores
    const matches: { rule: KeywordRule; score: number }[] = [];
    
    for (const rule of this.keywordRules) {
      let score = 0;
      
      // Check for keywords
      for (const keyword of rule.keywords) {
        if (lowerInput.includes(keyword)) {
          score += 2; // Base score for keyword match
          
          // Bonus for exact phrase match
          if (lowerInput.includes(` ${keyword} `) || 
              lowerInput.startsWith(keyword) || 
              lowerInput.endsWith(keyword)) {
            score += 1;
          }
        }
      }
      
      // Check for context words (if specified)
      if (rule.contextWords && rule.contextWords.length > 0) {
        const hasContext = rule.contextWords.some(context => lowerInput.includes(context));
        if (hasContext) {
          score += 1; // Bonus for context
        }
      }
      
      // Add to matches if score is sufficient
      if (score >= 2) {
        matches.push({ rule, score });
      }
    }
    
    // Return the highest scoring match
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0];
      
      console.log(`✅ Smart detection: "${bestMatch.rule.category}" with score ${bestMatch.score}`);
      
      // Add some variety to responses
      const responses = [
        bestMatch.rule.response,
        `${bestMatch.rule.response}\n\nIs there anything else I can help you with?`,
        `${bestMatch.rule.response}\n\nWould you like more information about this?`
      ];
      
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    return null;
  }

  // ========== FUZZY MATCHING ==========
  private fuzzyMatch(input: string, pattern: string): boolean {
    const inputWords = input.toLowerCase().split(/\s+/);
    const patternWords = pattern.toLowerCase().split(/\s+/);
    
    // Check if at least 60% of pattern words are in input
    const matches = patternWords.filter(word => {
      // Skip very short common words
      if (word.length < 3) return true;
      
      return inputWords.some(inputWord => 
        inputWord.includes(word) || word.includes(inputWord)
      );
    });
    
    return matches.length / patternWords.length >= 0.6;
  }

  // ========== MAIN TRAINING METHOD ==========
  async train(intentName: string, pattern: string, response: string, userId?: string): Promise<boolean> {
    console.log(`🎯 Training: "${intentName}" | Pattern: "${pattern}" | Response: "${response}"`);
    
    const cleanIntent = intentName.toLowerCase().trim();
    const cleanPattern = pattern.toLowerCase().trim();
    const cleanResponse = response.trim();
    
    if (!cleanIntent || !cleanPattern || !cleanResponse) {
      console.log('❌ Training failed: Missing fields');
      return false;
    }

    let supabaseSuccess = false;
    let localSuccess = false;

    // ====== STEP 1: SAVE TO SUPABASE DATABASE ======
    if (this.isOnline) {
      try {
        console.log('💾 Saving to Supabase database...');
        
        // Check if intent already exists
        const { data: existingIntent, error: fetchError } = await supabase
          .from('chatbot_intents')
          .select('*')
          .eq('intent_name', cleanIntent)
          .maybeSingle();

        if (fetchError) {
          console.error('❌ Error checking existing intent:', fetchError.message || fetchError);
        }

        if (existingIntent) {
          // UPDATE existing intent
          console.log(`📝 Updating existing intent: ${cleanIntent}`);
          
          // Merge patterns
          const existingPatterns = existingIntent.patterns || [];
          const updatedPatterns = Array.from(
            new Set([...existingPatterns, cleanPattern])
          );
          
          // Merge responses
          const existingResponses = existingIntent.responses || [];
          const updatedResponses = Array.from(
            new Set([...existingResponses, cleanResponse])
          );

          // Update in Supabase
          const { error: updateError } = await supabase
            .from('chatbot_intents')
            .update({
              patterns: updatedPatterns,
              responses: updatedResponses,
              trained_at: new Date().toISOString(),
              trained_by: userId || existingIntent.trained_by
            })
            .eq('id', existingIntent.id);

          if (updateError) {
            console.error('❌ Supabase update error:', updateError.message || updateError);
          } else {
            supabaseSuccess = true;
            console.log(`✅ Updated in Supabase: ${cleanIntent}`);
          }
        } else {
          // INSERT new intent
          console.log(`🆕 Creating new intent in Supabase: ${cleanIntent}`);
          
          const { error: insertError } = await supabase
            .from('chatbot_intents')
            .insert({
              intent_name: cleanIntent,
              patterns: [cleanPattern],
              responses: [cleanResponse],
              trained_by: userId,
              is_active: true,
              created_at: new Date().toISOString(),
              trained_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('❌ Supabase insert error:', insertError.message || insertError);
          } else {
            supabaseSuccess = true;
            console.log(`✅ Created in Supabase: ${cleanIntent}`);
          }
        }
      } catch (error: any) {
        console.error('❌ Supabase operation failed:', error.message || error);
        this.isOnline = false;
      }
    } else {
      console.log('⚠️ Cannot save to Supabase: Offline');
    }

    // ====== STEP 2: SAVE LOCALLY ======
    try {
      console.log('📱 Saving locally as backup...');
      localSuccess = await this.saveLocal(cleanIntent, cleanPattern, cleanResponse);
      if (localSuccess) {
        console.log(`✅ Saved locally: ${cleanIntent}`);
      }
    } catch (error: any) {
      console.error('❌ Local save error:', error.message || error);
    }

    // ====== RETURN RESULT ======
    if (supabaseSuccess) {
      console.log(`🎉 Training complete! Saved to database for everyone.`);
      return true;
    } else if (localSuccess) {
      console.log(`💾 Training saved locally only (database offline). Will sync later.`);
      return true;
    } else {
      console.log('❌ Training failed completely');
      return false;
    }
  }

  private async saveLocal(intentName: string, pattern: string, response: string): Promise<boolean> {
    try {
      if (!this.localIntents[intentName]) {
        this.localIntents[intentName] = { patterns: [], responses: [] };
      }
      
      if (!this.localIntents[intentName].patterns.includes(pattern)) {
        this.localIntents[intentName].patterns.push(pattern);
      }
      
      if (!this.localIntents[intentName].responses.includes(response)) {
        this.localIntents[intentName].responses.push(response);
      }
      
      await AsyncStorage.setItem('chatbot_intents', JSON.stringify(this.localIntents));
      return true;
    } catch (error: any) {
      console.error('Local save error:', error.message || error);
      return false;
    }
  }

  // ========== SYNC METHOD ==========
  async syncToSupabase(userId?: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 Syncing local intents to Supabase...');
      
      if (!this.isOnline) {
        await this.checkConnection();
        if (!this.isOnline) {
          return { success: false, message: '❌ Cannot sync: No internet connection' };
        }
      }

      let syncedCount = 0;
      let errorCount = 0;

      // Sync each local intent to Supabase
      for (const [intentName, intentData] of Object.entries(this.localIntents)) {
        try {
          // Check if intent exists in Supabase
          const { data: existingIntent } = await supabase
            .from('chatbot_intents')
            .select('*')
            .eq('intent_name', intentName)
            .maybeSingle();

          if (existingIntent) {
            // Merge and update
            const mergedPatterns = Array.from(
              new Set([...(existingIntent.patterns || []), ...intentData.patterns])
            );
            const mergedResponses = Array.from(
              new Set([...(existingIntent.responses || []), ...intentData.responses])
            );

            const { error: updateError } = await supabase
              .from('chatbot_intents')
              .update({
                patterns: mergedPatterns,
                responses: mergedResponses,
                trained_at: new Date().toISOString()
              })
              .eq('id', existingIntent.id);

            if (updateError) throw updateError;
          } else {
            // Create new intent
            const { error: insertError } = await supabase
              .from('chatbot_intents')
              .insert({
                intent_name: intentName,
                patterns: intentData.patterns,
                responses: intentData.responses,
                trained_by: userId,
                is_active: true
              });

            if (insertError) throw insertError;
          }
          
          syncedCount++;
          console.log(`✅ Synced intent: ${intentName}`);
        } catch (error: any) {
          errorCount++;
          console.error(`❌ Failed to sync intent ${intentName}:`, error.message || error);
        }
      }

      return {
        success: errorCount === 0,
        message: `🔄 Sync complete: ${syncedCount} intents synced, ${errorCount} errors`
      };
    } catch (error: any) {
      console.error('Sync failed:', error.message || error);
      return { success: false, message: `❌ Sync failed: ${error.message || 'Unknown error'}` };
    }
  }

  // ========== SMART GET RESPONSE ==========
  async getResponse(userInput: string): Promise<string> {
    const input = userInput.toLowerCase().trim();
    
    if (!input) return "Please type something!";
    
    // Add to conversation history (keep last 10 messages)
    this.conversationHistory.push(`User: ${input}`);
    if (this.conversationHistory.length > 10) {
      this.conversationHistory.shift();
    }
    
    // Check emergency keywords (highest priority)
    const emergencyKeywords = ['emergency', 'urgent', '911', 'heart attack', 'stroke', 'chest pain', 'bleeding', 'overdose', 'cant breathe', 'difficulty breathing'];
    if (emergencyKeywords.some(keyword => input.includes(keyword))) {
      return "🚨 **EMERGENCY ALERT**: Call 911 or emergency services immediately! This is a medical emergency. Do not wait. If someone is unconscious, having chest pain, difficulty breathing, or severe bleeding, call emergency services NOW!";
    }
    
    // ====== MEDICINE DATABASE LOOKUP ======
    const medicineName = this.extractMedicineName(input);
    if (medicineName) {
      const medicineInfo = await this.getMedicineInfo(medicineName);
      if (medicineInfo) {
        return medicineInfo;
      } else {
        // If medicine not found, try to help user phrase the query better
        if (input.includes('side effect') || input.includes('side effects')) {
          return `❌ I couldn't find "${medicineName}" in our medicine database. Please check the spelling or try asking about another medication. You can ask about: paracetamol, ibuprofen, amoxicillin, metformin, etc.`;
        }
      }
    }
    
    // ====== SMART KEYWORD DETECTION ======
    const smartResponse = this.detectSmartKeywords(input);
    if (smartResponse) {
      // Learn from this interaction
      await this.learnFromInteraction(input, smartResponse);
      return smartResponse;
    }
    
    // ====== TRY SUPABASE DATABASE ======
    if (this.isOnline) {
      try {
        const { data: intents, error } = await supabase
          .from('chatbot_intents')
          .select('*')
          .eq('is_active', true);

        if (!error && intents && intents.length > 0) {
          for (const intent of intents) {
            const patterns = intent.patterns || [];
            const responses = intent.responses || [];
            
            // Check each pattern with fuzzy matching
            for (const pattern of patterns) {
              if (this.fuzzyMatch(input, pattern)) {
                console.log(`✅ Database fuzzy match: "${pattern}" in "${input}"`);
                
                // Save to local for faster access next time
                await this.saveLocal(intent.intent_name, pattern, responses[0]);
                
                // Return random response with contextual follow-up
                const randomIndex = Math.floor(Math.random() * responses.length);
                return `${responses[randomIndex]}\n\nIs there anything else about this I can help clarify?`;
              }
            }
          }
        }
      } catch (error: any) {
        console.log('⚠️ Database fetch failed:', error.message || error);
        this.isOnline = false;
      }
    }
    
    // ====== FALLBACK TO LOCAL STORAGE ======
    for (const [intentName, intent] of Object.entries(this.localIntents)) {
      for (const pattern of intent.patterns) {
        if (this.fuzzyMatch(input, pattern)) {
          console.log(`✅ Local fuzzy match: "${pattern}" in "${input}"`);
          const responses = intent.responses;
          if (responses.length > 0) {
            return responses[Math.floor(Math.random() * responses.length)];
          }
        }
      }
    }
    
    // ====== CONTEXT-AWARE FALLBACK ======
    // Check if user is asking about medications generally
    if (input.includes('medicine') || input.includes('medication') || input.includes('pill') || input.includes('prescription') || input.includes('drug')) {
      return `💊 I can help with medication questions! Try asking specifically:
• "What are the side effects of [medicine name]?"
• "How to take [medicine name]?"
• "What is [medicine name] for?"
• "Interactions of [medicine name]"

Examples: "side effects of ibuprofen", "how to take metformin", "what is lisinopril"`;
    }
    
    // ====== GENERAL HELPFUL RESPONSE ======
    const helpfulResponses = [
      "I'm here to help with medication-related questions! You can ask about:\n• Medicine side effects\n• How to take medications\n• Drug interactions\n• Refill requests\n• Pharmacy locations\n\nTry: 'side effects of paracetamol' or 'how to get a refill'",
      "I specialize in pharmacy and medication assistance. Try asking about specific medicines or:\n• 'My medicine is running low'\n• 'Find a pharmacy near me'\n• 'Check prescription status'\n• 'Medication costs'\n\nOr ask about a specific medicine like ibuprofen, metformin, or amoxicillin.",
      "I want to help you with your medication needs! Could you be more specific? For example:\n📋 'I need a refill'\n🤒 'Side effects of [medicine]'\n💰 'Cost of [medicine]'\n📍 'Pharmacy near me'\n⏰ 'How to take [medicine]'\n📚 'What is [medicine] for?'"
    ];
    
    return helpfulResponses[Math.floor(Math.random() * helpfulResponses.length)];
  }

  // ========== LEARN FROM INTERACTIONS ==========
  private async learnFromInteraction(userInput: string, botResponse: string): Promise<void> {
    try {
      // Extract potential intent from the interaction
      const categories = ['refill', 'side effect', 'price', 'interaction', 'dosage', 'pharmacy', 'prescription', 'medicine'];
      const matchedCategory = categories.find(category => 
        userInput.includes(category) || botResponse.includes(category)
      );
      
      if (matchedCategory) {
        // Save to local learning
        if (!this.localIntents[matchedCategory]) {
          this.localIntents[matchedCategory] = { patterns: [], responses: [] };
        }
        
        // Add pattern if not already there
        if (!this.localIntents[matchedCategory].patterns.includes(userInput)) {
          this.localIntents[matchedCategory].patterns.push(userInput);
        }
        
        // Add response if not already there
        if (!this.localIntents[matchedCategory].responses.includes(botResponse)) {
          this.localIntents[matchedCategory].responses.push(botResponse);
        }
        
        // Save to AsyncStorage
        await AsyncStorage.setItem('chatbot_intents', JSON.stringify(this.localIntents));
        console.log(`🧠 Learned from interaction: ${matchedCategory}`);
      }
    } catch (error) {
      console.log('Could not learn from interaction:', error);
    }
  }
}