import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/main/HomeScreen';
import BooksScreen from '../screens/main/BooksScreen';
import ScanScreen from '../screens/main/ScanScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import BorrowingsScreen from '../screens/main/BorrowingsScreen';
import BookDetailsScreen from '../screens/main/BookDetailsScreen';
import { Colors, FontSize } from '../constants/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: Colors.surface800, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: Colors.surface600 },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700', fontSize: FontSize.lg },
        tabBarStyle: { backgroundColor: Colors.surface800, borderTopWidth: 1, borderTopColor: Colors.surface600, height: 60, paddingBottom: 8, paddingTop: 4 },
        tabBarActiveTintColor: Colors.primary400,
        tabBarInactiveTintColor: Colors.surface400,
        tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, string> = {
            HomeTab: focused ? 'home' : 'home-outline',
            BooksTab: focused ? 'book' : 'book-outline',
            ScanTab: focused ? 'qr-code' : 'qr-code-outline',
            NotificationsTab: focused ? 'notifications' : 'notifications-outline',
            ProfileTab: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Beranda', headerTitle: 'Perpustakaan Digital' }} />
      <Tab.Screen name="BooksTab" component={BooksScreen} options={{ title: 'Buku', headerTitle: 'Koleksi Buku' }} />
      <Tab.Screen name="ScanTab" component={ScanScreen} options={{ title: 'Scan', headerTitle: 'QR Scanner' }} />
      <Tab.Screen name="NotificationsTab" component={NotificationsScreen} options={{ title: 'Notifikasi', headerTitle: 'Notifikasi' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profil', headerTitle: 'Profil Saya' }} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.surface900 } }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Borrowings" component={BorrowingsScreen} />
      <Stack.Screen name="BookDetails" component={BookDetailsScreen} />
    </Stack.Navigator>
  );
}
