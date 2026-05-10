import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

const SETTINGS_ITEMS = ['Business Profile', 'Notification Prefs', 'Billing', 'AutoPilot Tuning'];

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.screenTitle}>Settings</Text>
      <View style={{ marginTop: 20 }}>
        {SETTINGS_ITEMS.map(item => (
          <TouchableOpacity key={item} style={styles.infoCard}>
            <Text style={styles.infoTitle}>{item}</Text>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', padding: 16 },
  screenTitle: { fontSize: 28, fontWeight: 'bold', color: '#111', marginTop: 10, marginBottom: 4 },
  infoCard: { flexDirection: 'row', backgroundColor: 'white', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', marginBottom: 10, justifyContent: 'space-between' },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#111' },
});
