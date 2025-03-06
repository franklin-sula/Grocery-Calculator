import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Dimensions } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { IconButton, Provider as PaperProvider, Badge } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import screens
import GroceryScreen from './GroceryScreen';
import NotificationsScreen from './NotificationsScreen';

// Initialize Supabase client
const supabaseUrl = 'https://btfcwdipcwtkizcmmfqw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0ZmN3ZGlwY3d0a2l6Y21tZnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1NDIyMDEsImV4cCI6MjA1NjExODIwMX0.cGG48aLVYGmMwT0GsK6M7j6CBIq7JCMR65Az1qgQpaM';
const supabase = createClient(supabaseUrl, supabaseKey);

const Tab = createBottomTabNavigator();

export default function App() {
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Check for unread notifications
  useEffect(() => {
    const checkUnreadNotifications = async () => {
      try {
        const storedNotifications = await AsyncStorage.getItem('notifications');
        if (storedNotifications) {
          const notifications = JSON.parse(storedNotifications);
          const unreadCount = notifications.filter(notification => !notification.read).length;
          setUnreadNotifications(unreadCount);
        }
      } catch (error) {
        console.error('Error checking unread notifications:', error);
      }
    };

    checkUnreadNotifications();

    // Set up notification listeners for database changes
    const setupRealtimeListeners = async () => {
      try {
        // Initialize the channel for product changes
        const channel = supabase.channel('product-changes');
        
        // Subscribe to INSERT events on the products table
        channel
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'products',
            }, 
            async (payload) => {
              console.log('Real-time update received:', payload);
              
              // Create a new notification
              const notification = {
                id: Date.now().toString(),
                type: 'new_product',
                message: `New product added: ${payload.new.name}`,
                details: `Price: ₱${payload.new.price.toFixed(2)}`,
                createdAt: new Date().toISOString(),
                read: false,
                productId: payload.new.id
              };
              
              // Get existing notifications
              const storedNotifications = await AsyncStorage.getItem('notifications');
              let allNotifications = [];
              
              if (storedNotifications) {
                allNotifications = JSON.parse(storedNotifications);
              }
              
              // Add the new notification
              allNotifications = [notification, ...allNotifications];
              await AsyncStorage.setItem('notifications', JSON.stringify(allNotifications));
              
              // Update the unread count
              setUnreadNotifications(prev => prev + 1);
            }
          )
          .subscribe();
        
        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error('Error setting up realtime listeners:', error);
      }
    };

    const unsubscribe = setupRealtimeListeners();

    // Check for unread notifications periodically
    const interval = setInterval(checkUnreadNotifications, 5000);
    
    return () => {
      clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <PaperProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;
              
              if (route.name === 'Grocery') {
                iconName = focused ? 'cart' : 'cart-outline';
              } else if (route.name === 'Notifications') {
                iconName = focused ? 'bell' : 'bell-outline';
              }
              
              return (
                <>
                  <IconButton
                    icon={iconName}
                    size={size}
                    color={color}
                    style={styles.tabIcon}
                  />
                  {route.name === 'Notifications' && unreadNotifications > 0 && (
                    <Badge
                      visible={true}
                      size={16}
                      style={styles.notificationBadge}
                    >
                      {unreadNotifications}
                    </Badge>
                  )}
                </>
              );
            },
            tabBarActiveTintColor: '#2e7d32',
            tabBarInactiveTintColor: 'gray',
            headerShown: false,
          })}
          listeners={({ navigation, route }) => ({
            // Reset notification count when navigating to the notifications screen
            tabPress: e => {
              if (route.name === 'Notifications') {
                // We don't mark all as read here automatically since
                // that's handled in the NotificationsScreen component
              }
            },
          })}
        >
          <Tab.Screen name="Grocery" component={GroceryScreen} />
          <Tab.Screen name="Notifications" component={NotificationsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    margin: 0,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
});