import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

let AsyncStorage: any
if (Platform.OS !== 'web') {
  AsyncStorage = require('@react-native-async-storage/async-storage').default
}

const supabaseUrl = 'https://tqkccugnneulsopycjap.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxa2NjdWdubmV1bHNvcHljamFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjkyNDQsImV4cCI6MjA3NzMwNTI0NH0.FkIzRcZlPyBNLXxXmC9Xacg0xXg2JdJCbYcZsJND__E'

const options =
  Platform.OS === 'web'
    ? {} // web automatically uses localStorage
    : {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options)
