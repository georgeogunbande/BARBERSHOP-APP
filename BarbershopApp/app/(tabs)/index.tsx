import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { TrendingUp, Zap, Play } from 'lucide-react-native';

const RECOVERIES = [
  { id: '1', name: 'David R.', time: '11:00 AM', amount: '$70', type: 'Cancellation filled', color: '#7c3aed' },
  { id: '2', name: 'Sarah L.', time: '2:30 PM', amount: '$120', type: 'No-show recovered', color: '#10b981' },
];

const WEEKLY_DATA = [
  { day: 'M', height: 40 }, { day: 'T', height: 80 }, { day: 'W', height: 55 },
  { day: 'T', height: 100 }, { day: 'F', height: 65 }, { day: 'S', height: 120 }, { day: 'S', height: 5 },
];

export default function AutoPilotScreen() {
  const [isScanning, setIsScanning] = useState(false);

  const handleManualRecovery = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      Alert.alert('Success', 'AI found 2 waitlist matches for tomorrow!');
    }, 2000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>AutoPilot</Text>
          <Text style={styles.lastSync}>Last scan: 2 mins ago</Text>
        </View>
        <View style={styles.activeBadge}>
          <View style={styles.greenDot} />
          <Text style={styles.activeBadgeText}>Watching 24/7</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartLabel}>WEEKLY RECOVERY</Text>
            <Text style={styles.chartTotal}>$710.00</Text>
          </View>
          <View style={styles.trendBadge}>
            <TrendingUp size={14} color="#10b981" />
            <Text style={styles.trendText}>+12%</Text>
          </View>
        </View>
        <View style={styles.barContainer}>
          {WEEKLY_DATA.map((item, i) => (
            <View key={i} style={styles.barColumn}>
              <View style={[styles.bar, { height: item.height }]} />
              <Text style={styles.barDay}>{item.day}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.manualActionCard} onPress={handleManualRecovery} disabled={isScanning}>
        <View style={styles.manualIconBox}>
          {isScanning ? <ActivityIndicator color="white" /> : <Play size={20} color="white" fill="white" />}
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.manualTitle}>{isScanning ? 'Scanning...' : 'Recover $140 now'}</Text>
          <Text style={styles.manualSub}>AI detected 2 open slots tomorrow.</Text>
        </View>
        <Zap size={20} color="#5e50be" />
      </TouchableOpacity>

      <Text style={styles.sectionHeader}>RECENT RECOVERIES</Text>
      {RECOVERIES.map(item => (
        <View key={item.id} style={styles.infoCard}>
          <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
            <Zap size={18} color={item.color} fill={item.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.infoTitle}>{item.name}</Text>
            <Text style={styles.infoSub}>{item.type}</Text>
          </View>
          <Text style={styles.amountText}>{item.amount}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10, marginBottom: 20 },
  screenTitle: { fontSize: 28, fontWeight: 'bold', color: '#111' },
  lastSync: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 6 },
  activeBadgeText: { color: '#065f46', fontSize: 12, fontWeight: 'bold' },
  chartCard: { backgroundColor: '#f9fafb', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#f3f4f6' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  chartLabel: { fontSize: 11, fontWeight: 'bold', color: '#9ca3af', letterSpacing: 1 },
  chartTotal: { fontSize: 32, fontWeight: 'bold', color: '#111' },
  trendBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trendText: { color: '#059669', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  barContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
  barColumn: { alignItems: 'center', width: 30 },
  bar: { width: 14, backgroundColor: '#5e50be', borderRadius: 4 },
  barDay: { fontSize: 11, color: '#9ca3af', marginTop: 8 },
  manualActionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f3ff', padding: 18, borderRadius: 20, marginTop: 16, borderWidth: 1, borderColor: '#ddd6fe' },
  manualIconBox: { width: 44, height: 44, backgroundColor: '#5e50be', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  manualTitle: { fontSize: 17, fontWeight: 'bold', color: '#1e1b4b' },
  manualSub: { fontSize: 13, color: '#5e50be', marginTop: 2 },
  sectionHeader: { fontSize: 11, fontWeight: 'bold', color: '#9ca3af', marginTop: 32, marginBottom: 16, letterSpacing: 1 },
  infoCard: { flexDirection: 'row', backgroundColor: 'white', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center', marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#111' },
  infoSub: { fontSize: 13, color: '#666', marginTop: 2 },
  amountText: { fontWeight: 'bold', color: '#10b981' },
});
