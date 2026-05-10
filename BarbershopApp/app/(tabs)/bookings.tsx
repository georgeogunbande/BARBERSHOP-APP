import { View, Text, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';

export default function BookingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Bookings</Text>
      <View style={styles.placeholderCard}>
        <Calendar size={48} color="#ddd" />
        <Text style={styles.placeholderText}>Calendar View Integration</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', padding: 16 },
  screenTitle: { fontSize: 28, fontWeight: 'bold', color: '#111', marginTop: 10 },
  placeholderCard: { flex: 1, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#ddd', borderRadius: 24, marginVertical: 40 },
  placeholderText: { marginTop: 16, color: '#9ca3af', fontWeight: '600' },
});
