import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MessageSquare } from 'lucide-react-native';

const CHATS = [
  { id: '1', client: 'Emma W.', status: 'AI Handling', preview: 'Bot: "I have a 4pm available..."', time: '2m ago' },
  { id: '2', client: 'James K.', status: 'Human Needed', preview: 'Client: "Do you offer highlights?"', time: '15m ago' },
];

export default function FrontDeskScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.screenTitle}>Front Desk</Text>
      <Text style={styles.sectionHeader}>ACTIVE AI CONVERSATIONS</Text>
      {CHATS.map(chat => {
        const isAI = chat.status === 'AI Handling';
        return (
          <TouchableOpacity key={chat.id} style={styles.infoCard}>
            <View style={[styles.iconBox, { backgroundColor: isAI ? '#f5f3ff' : '#fee2e2' }]}>
              <MessageSquare size={20} color={isAI ? '#5e50be' : '#ef4444'} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.infoTitle}>{chat.client}</Text>
              <Text style={styles.infoSub} numberOfLines={1}>{chat.preview}</Text>
            </View>
            <Text style={styles.timeText}>{chat.time}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', padding: 16 },
  screenTitle: { fontSize: 28, fontWeight: 'bold', color: '#111', marginTop: 10, marginBottom: 20 },
  sectionHeader: { fontSize: 11, fontWeight: 'bold', color: '#9ca3af', marginBottom: 16, letterSpacing: 1 },
  infoCard: { flexDirection: 'row', backgroundColor: 'white', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#111' },
  infoSub: { fontSize: 13, color: '#666', marginTop: 2 },
  timeText: { fontSize: 12, color: '#9ca3af' },
});
