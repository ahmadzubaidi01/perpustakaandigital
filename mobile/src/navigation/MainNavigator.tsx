import React from 'react';
import { TouchableOpacity, View } from 'react-native';
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
import ChatScreen from '../screens/main/ChatScreen';
import ChatRoomScreen from '../screens/main/ChatRoomScreen';
import QrGeneratorScreen from '../screens/main/QrGeneratorScreen';
import CategoryManagementScreen from '../screens/main/CategoryManagementScreen';
import SchoolManagementScreen from '../screens/main/SchoolManagementScreen';
import RegionManagementScreen from '../screens/main/RegionManagementScreen';
import UserManagementScreen from '../screens/main/UserManagementScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import ManagementScreen from '../screens/main/ManagementScreen';
import BookCreateEditScreen from '../screens/main/BookCreateEditScreen';
import { FontSize } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const isAdmin = user?.user_role && user.user_role !== 'student_member';
  const { chatUnreadCount } = useNotificationStore();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface800, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.surface600 },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: FontSize.lg },
        tabBarStyle: { backgroundColor: colors.surface800, borderTopWidth: 1, borderTopColor: colors.surface600, height: 60 + insets.bottom, paddingBottom: insets.bottom > 0 ? insets.bottom : 8, paddingTop: 4 },
        tabBarActiveTintColor: colors.primary400,
        tabBarInactiveTintColor: colors.surface400,
        tabBarLabelStyle: { fontSize: FontSize.xs, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, string> = {
            HomeTab: focused ? 'home' : 'home-outline',
            BooksTab: focused ? 'book' : 'book-outline',
            ScanTab: focused ? 'qr-code' : 'qr-code-outline',
            ManagementTab: focused ? 'grid' : 'grid-outline',
            ProfileTab: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] as any} size={size} color={color} />;
        },
        headerRight: () => {
          const { isDark, toggleTheme, colors: themeColors } = useTheme();
          return (
            <TouchableOpacity
              onPress={toggleTheme}
              style={{ marginRight: 16, padding: 8, borderRadius: 20, backgroundColor: themeColors.surface700 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isDark ? 'sunny' : 'moon'}
                size={18}
                color={isDark ? themeColors.accent500 : themeColors.primary400}
              />
            </TouchableOpacity>
          );
        }
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Beranda',
          headerTitle: 'Perpustakaan Digital',
        }}
      />
      <Tab.Screen name="BooksTab" component={BooksScreen} options={{ title: 'Buku', headerTitle: 'Koleksi Buku' }} />
      <Tab.Screen name="ScanTab" component={ScanScreen} options={{ title: 'Scan', headerTitle: 'QR Scanner' }} />
      {isAdmin && (
        <Tab.Screen
          name="ManagementTab"
          component={ManagementScreen}
          options={{
            title: 'Manajemen',
            headerTitle: 'Manajemen',
            tabBarBadge: chatUnreadCount > 0 ? chatUnreadCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              fontSize: 10,
              lineHeight: 14,
              height: 16,
              minWidth: 16,
              borderRadius: 8,
            }
          }}
        />
      )}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={({ navigation }) => ({
          title: 'Profil',
          headerTitle: 'Profil Saya',
          headerRight: () => {
            const { isDark, toggleTheme, colors: themeColors } = useTheme();
            const { hasUnread } = useNotificationStore();
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Notifications')}
                  style={{ padding: 8, borderRadius: 20, backgroundColor: themeColors.surface700, position: 'relative' }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="notifications-outline" size={18} color={themeColors.text} />
                  {hasUnread && (
                    <View
                      style={{
                        position: 'absolute',
                        right: 6,
                        top: 6,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#EF4444',
                        borderWidth: 1.5,
                        borderColor: themeColors.surface700,
                      }}
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleTheme}
                  style={{ padding: 8, borderRadius: 20, backgroundColor: themeColors.surface700 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isDark ? 'sunny' : 'moon'}
                    size={18}
                    color={isDark ? themeColors.accent500 : themeColors.primary400}
                  />
                </TouchableOpacity>
              </View>
            );
          }
        })}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface900 } }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Borrowings" component={BorrowingsScreen} />
      <Stack.Screen name="BookDetails" component={BookDetailsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <Stack.Screen name="QrGenerator" component={QrGeneratorScreen} />
      <Stack.Screen name="CategoryManagement" component={CategoryManagementScreen} />
      <Stack.Screen name="SchoolManagement" component={SchoolManagementScreen} />
      <Stack.Screen name="RegionManagement" component={RegionManagementScreen} />
      <Stack.Screen name="UserManagement" component={UserManagementScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="BookCreateEdit" component={BookCreateEditScreen} />
    </Stack.Navigator>
  );
}
