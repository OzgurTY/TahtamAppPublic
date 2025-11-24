import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons'; // İkon paketi

// Ekranlarımız
import MarketplacesScreen from '../screens/MarketplacesScreen';
import StallsScreen from '../screens/StallsScreen';
import TenantsScreen from '../screens/TenantsScreen';
import DashboardScreen from '../screens/DashboardScreen';
import { COLORS } from '../styles/theme';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false, // Ekranların kendi başlıkları var, navigasyonunkini gizle
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: {
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Dashboard') {
              iconName = focused ? 'pie-chart' : 'pie-chart-outline';
            } else if (route.name === 'Marketplaces') {
              iconName = focused ? 'storefront' : 'storefront-outline';
            } else if (route.name === 'Stalls') {
              iconName = focused ? 'grid' : 'grid-outline';
            } else if (route.name === 'Tenants') {
              iconName = focused ? 'people' : 'people-outline';
            } 

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
          options={{ title: 'Pazaryerleri' }}
        />
        <Tab.Screen 
          name="Stalls" 
          component={StallsScreen} 
          options={{ title: 'Tahtalar' }}
        />
        <Tab.Screen 
          name="Tenants" 
          component={TenantsScreen} 
          options={{ title: 'Kiracılar' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}