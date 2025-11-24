import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { AuthContext } from '../context/AuthContext';

// Ekranlar
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MarketplacesScreen from '../screens/MarketplacesScreen';
import StallsScreen from '../screens/StallsScreen';
import TenantsScreen from '../screens/TenantsScreen';
import RentalsScreen from '../screens/RentalsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { COLORS } from '../styles/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const RootStack = createStackNavigator();

// 1. GİRİŞ YAPMAMIŞ (AUTH) STACK
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// 2. ANA SEKMELER (TABS)
function MainTabs() {
  const { userProfile } = useContext(AuthContext);
  
  const isOwner = userProfile?.role === 'OWNER';
  const isAdmin = userProfile?.role === 'ADMIN';
  
  // Admin veya Owner ise 'Yönetim' sekmelerini göster
  const canManage = isOwner || isAdmin;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'pie-chart' : 'pie-chart-outline';
          else if (route.name === 'Marketplaces') iconName = focused ? 'storefront' : 'storefront-outline';
          // OwnerStalls için ikon
          else if (route.name === 'OwnerStalls') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Tenants') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Rentals') iconName = focused ? 'receipt' : 'receipt-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{ title: 'Özet' }} 
      />
      
      <Tab.Screen 
        name="Marketplaces" 
        component={MarketplacesScreen} 
        options={{ title: 'Pazarlar' }} 
      />
      
      {/* TAHTALARIM SEKME AYARI:
          Sadece Owner/Admin görür. Kiracıda bu sekme HİÇ YOKTUR (Boşluk olmaz).
          Kiracı tahtalara 'Pazarlar' -> 'Pazar Seç' -> 'StallsScreen' yoluyla (Stack üzerinden) ulaşır.
      */}
      {canManage && (
        <Tab.Screen 
          name="OwnerStalls" // Benzersiz isim
          component={StallsScreen} 
          options={{ title: 'Tahtalarım' }} 
        />
      )}
      
      {canManage && (
        <Tab.Screen 
          name="Tenants" 
          component={TenantsScreen} 
          options={{ title: 'Müşteriler' }} 
        />
      )}

      <Tab.Screen 
        name="Rentals" 
        component={RentalsScreen} 
        options={{ title: 'Hareketler' }} 
      />
      
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'Profil' }} 
      />
    </Tab.Navigator>
  );
}

// 3. GİRİŞ YAPMIŞ KULLANICI İÇİN GENEL STACK
// Tab menüsünün dışında kalan, ama login olmuş kullanıcının gidebileceği detay sayfaları burada.
function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Ana Menü */}
      <Stack.Screen name="MainTabs" component={MainTabs} />
      
      {/* Detay Sayfaları (Pazarlar listesinden buraya yönlenilecek) */}
      <Stack.Screen 
        name="Stalls" 
        component={StallsScreen} 
        options={{ 
          headerShown: true, 
          title: 'Tahtalar',
          headerBackTitle: 'Geri'
        }} 
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}