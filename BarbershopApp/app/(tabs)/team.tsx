import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Users } from 'lucide-react-native';

export default function TeamScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Team</Text>
        <TouchableOpacity style={styles.addBadge}>
          <Plus size={16} color="#065f46" />
          <Text style={styles.addBadgeText}>Add</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.infoCard}>
        <Users size={20} color="#5e50be" />
        <Text style={styles.infoTitle}>Manage Staff & Permissions</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10, marginBottom: 20 },
  screenTitle: { fontSize: 28, fontWeight: 'bold', color: '#111' },
  addBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addBadgeText: { color: '#065f46', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  infoCard: { flexDirection: 'row', backgroundColor: 'white', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', gap: 12 },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#111' },
});
