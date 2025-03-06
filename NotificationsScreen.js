import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { Surface, IconButton, Badge, ActivityIndicator } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (same as in App.js)
const supabaseUrl = 'https://btfcwdipcwtkizcmmfqw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0ZmN3ZGlwY3d0a2l6Y21tZnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1NDIyMDEsImV4cCI6MjA1NjExODIwMX0.cGG48aLVYGmMwT0GsK6M7j6CBIq7JCMR65Az1qgQpaM';
const supabase = createClient(supabaseUrl, supabaseKey);

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Set up realtime listener for new products
  useEffect(() => {
    fetchNotifications();
    
    // Create subscription to listen for new products
    const channel = supabase.channel('schema-db-changes');
    
    const subscription = channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          console.log('New product added:', payload);
          handleNewProduct(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to product changes');
        }
      });

    // Check network status initially
    checkNetworkStatus();
    
    // Clean up subscription when component unmounts
    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  const checkNetworkStatus = async () => {
    try {
      const { data, error } = await supabase.from('products').select('count');
      setIsOnline(!error);
    } catch (error) {
      setIsOnline(false);
    }
  };

  const handleNewProduct = async (product) => {
    try {
      const notification = {
        id: Date.now().toString(),
        type: 'new_product',
        message: `New product added: ${product.name}`,
        details: `Price: ₱${product.price.toFixed(2)}`,
        createdAt: new Date().toISOString(),
        read: false,
        productId: product.id
      };
      
      console.log('Creating notification for new product:', notification);
      
      // Add to state first
      setNotifications(currentNotifications => [notification, ...currentNotifications]);
      
      // Then save to AsyncStorage
      const storedNotifications = await AsyncStorage.getItem('notifications');
      let allNotifications = [];
      
      if (storedNotifications) {
        allNotifications = JSON.parse(storedNotifications);
      }
      
      await AsyncStorage.setItem(
        'notifications', 
        JSON.stringify([notification, ...allNotifications])
      );
      
      console.log('Notification saved successfully');
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const storedNotifications = await AsyncStorage.getItem('notifications');
      if (storedNotifications) {
        const parsedNotifications = JSON.parse(storedNotifications);
        // Sort by date, newest first
        parsedNotifications.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setNotifications(parsedNotifications);
        console.log(`Loaded ${parsedNotifications.length} notifications`);
      } else {
        console.log('No stored notifications found');
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const updatedNotifications = notifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true } 
          : notification
      );
      setNotifications(updatedNotifications);
      await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const updatedNotifications = notifications.map(notification => ({ ...notification, read: true }));
      setNotifications(updatedNotifications);
      await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const updatedNotifications = notifications.filter(
        notification => notification.id !== notificationId
      );
      setNotifications(updatedNotifications);
      await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      setNotifications([]);
      await AsyncStorage.removeItem('notifications');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
    checkNetworkStatus();
  };

  const unreadCount = notifications.filter(notification => !notification.read).length;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.headerActions}>
          {!isOnline && (
            <Text style={styles.offlineIndicator}>Offline</Text>
          )}
          {unreadCount > 0 && (
            <IconButton 
              icon="check-all" 
              onPress={markAllAsRead}
              tooltip="Mark all as read"
            />
          )}
          {notifications.length > 0 && (
            <IconButton 
              icon="delete-sweep" 
              onPress={clearAllNotifications}
              tooltip="Clear all notifications"
            />
          )}
        </View>
      </View>
      
      <ScrollView
        style={styles.notificationList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications yet</Text>
            {!isOnline && (
              <Text style={styles.offlineNote}>
                You're offline. Connect to receive new product notifications.
              </Text>
            )}
          </View>
        ) : (
          notifications.map(notification => (
            <Surface 
              key={notification.id} 
              style={[
                styles.notificationItem,
                !notification.read && styles.unreadNotification
              ]}
            >
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                  {!notification.read && (
                    <Badge size={8} style={styles.unreadBadge} />
                  )}
                </View>
                {notification.details && (
                  <Text style={styles.notificationDetails}>
                    {notification.details}
                  </Text>
                )}
                <Text style={styles.notificationTime}>
                  {new Date(notification.createdAt).toLocaleString()}
                </Text>
              </View>
              <View style={styles.actionButtons}>
                {!notification.read && (
                  <IconButton 
                    icon="check" 
                    size={20} 
                    onPress={() => markAsRead(notification.id)} 
                    style={styles.actionButton}
                  />
                )}
                <IconButton 
                  icon="delete" 
                  size={20} 
                  onPress={() => deleteNotification(notification.id)} 
                  style={styles.actionButton}
                />
              </View>
            </Surface>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineIndicator: {
    color: 'red',
    fontWeight: 'bold',
    marginRight: 10,
  },
  notificationList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  unreadNotification: {
    backgroundColor: '#e8f5e9',
    borderLeftWidth: 4,
    borderLeftColor: '#2e7d32',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationMessage: {
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },
  notificationDetails: {
    fontSize: 14,
    marginTop: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  unreadBadge: {
    backgroundColor: '#2e7d32',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    margin: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
  },
  offlineNote: {
    fontSize: 14,
    color: '#757575',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});

export default NotificationsScreen;