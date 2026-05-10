import { Tabs } from 'expo-router';
import { Bot, Calendar, Settings, Users, Zap } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 85,
          borderTopColor: '#f3f4f6',
          paddingBottom: 20,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarActiveTintColor: '#5e50be',
        tabBarInactiveTintColor: '#9ca3af',
      }}>
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color }) => <Calendar size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="front-desk"
        options={{
          title: 'Front Desk',
          tabBarIcon: ({ color }) => <Bot size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'AutoPilot',
          tabBarIcon: ({ color }) => <Zap size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
