import { useRouter } from 'expo-router';
import { Zap, Check } from 'lucide-react-native';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';

const SETUP_ITEMS = [
  'Your barber profile',
  'Availability & working hours',
  'Services & pricing',
  'Payment preferences',
];

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a0533" />

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconWrapper}>
          <Zap size={48} color="#c084fc" fill="#c084fc" />
        </View>

        {/* Heading */}
        <Text style={styles.heading}>Welcome to</Text>
        <Text style={styles.headingAccent}>Flatpurse Flow</Text>
        <Text style={styles.subheading}>
          Your all-in-one barbershop booking & management app.
        </Text>

        {/* Setup Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>YOU'LL SET UP</Text>
          {SETUP_ITEMS.map((item) => (
            <View key={item} style={styles.cardRow}>
              <View style={styles.checkCircle}>
                <Check size={12} color="#7c3aed" strokeWidth={3} />
              </View>
              <Text style={styles.cardRowText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0533',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#2e0d57',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
    color: '#f3e8ff',
    textAlign: 'center',
  },
  headingAccent: {
    fontSize: 30,
    fontWeight: '800',
    color: '#c084fc',
    textAlign: 'center',
    marginTop: -6,
  },
  subheading: {
    fontSize: 15,
    color: '#a78bca',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
    marginBottom: 8,
  },
  card: {
    width: '100%',
    backgroundColor: '#ede9fe',
    borderRadius: 20,
    padding: 24,
    gap: 14,
    marginTop: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7c3aed',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ddd6fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRowText: {
    fontSize: 15,
    color: '#3b0764',
    fontWeight: '500',
  },
  button: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
