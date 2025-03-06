import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions, SafeAreaView, ScrollView, ToastAndroid } from 'react-native';
import { Button, Surface, IconButton, Badge, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Initialize Supabase client
const supabaseUrl = 'https://btfcwdipcwtkizcmmfqw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0ZmN3ZGlwY3d0a2l6Y21tZnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1NDIyMDEsImV4cCI6MjA1NjExODIwMX0.cGG48aLVYGmMwT0GsK6M7j6CBIq7JCMR65Az1qgQpaM';
const supabase = createClient(supabaseUrl, supabaseKey);

const { width } = Dimensions.get('window');

const GroceryScreen = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      if (state.isConnected) {
        syncDataWithServer();
      } else {
        showToast('You are offline. Using cached data.');
      }
    });

    return () => unsubscribe();
  }, []);

  // Load initial data
  useEffect(() => {
    loadDataFromStorage();
    fetchProducts();
  }, []);

  // Save cart to storage whenever it changes
  useEffect(() => {
    saveCartToStorage(cart);
  }, [cart]);

  const showToast = (message) => {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  };

  const loadDataFromStorage = async () => {
    try {
      // Load products from storage
      const storedProducts = await AsyncStorage.getItem('products');
      if (storedProducts) {
        setProducts(JSON.parse(storedProducts));
      }

      // Load cart from storage
      const storedCart = await AsyncStorage.getItem('cart');
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading data from storage:', error);
      setIsLoading(false);
    }
  };

  const saveProductsToStorage = async (productsData) => {
    try {
      await AsyncStorage.setItem('products', JSON.stringify(productsData));
    } catch (error) {
      console.error('Error saving products to storage:', error);
    }
  };

  const saveCartToStorage = async (cartData) => {
    try {
      await AsyncStorage.setItem('cart', JSON.stringify(cartData));
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  };

  const syncDataWithServer = async () => {
    // Only perform sync operations if we have network
    if (isOnline) {
      await fetchProducts();
    }
  };

  const fetchProducts = async () => {
    if (!isOnline) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*');

      if (error) {
        console.error('Error fetching products:', error);
      } else {
        setProducts(data);
        saveProductsToStorage(data);
      }
    } catch (error) {
      console.error('Network error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startScanning = async () => {
    if (!permission?.granted) {
      await requestPermission();
      if (!permission?.granted) {
        alert("Sorry, we need camera permissions to scan barcodes");
        return;
      }
    }
    setScanning(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    const product = products.find(p => p.barcode === data);
    if (product) {
      setScannedProduct({ ...product, quantity: 1 });
    } else {
      alert("Product not found");
      setScanning(false);
    }
  };

  const addToCart = (product) => {
    setCart(current => {
      const existing = current.find(item => item.id === product.id);
      
      if (existing) {
        return current.map(item => 
          item.id === product.id ? 
          { ...item, quantity: item.quantity + 1 } : 
          item
        );
      } else {
        return [...current, { ...product, quantity: 1 }];
      }
    });
    
    if (scannedProduct) {
      setScannedProduct(null);
      setScanning(false);
    }
  };

  const updateQuantity = (productId, change) => {
    setCart(current => {
      const updatedCart = current.map(item => {
        if (item.id === productId) {
          const newQuantity = Math.max(0, item.quantity + change);
          return newQuantity === 0 ? null : { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean); // Remove items with quantity 0
      
      return updatedCart;
    });
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={styles.loadingText}>Loading grocery calculator...</Text>
      </SafeAreaView>
    );
  }

  if (scanning) {
    return (
      <SafeAreaView style={styles.container}>
        {scannedProduct ? (
          <View style={styles.scannedProductContainer}>
            <Text style={styles.scannedProductTitle}>Scanned Product</Text>
            <Surface style={styles.scannedProductCard}>
              <Text style={styles.scannedProductName}>{scannedProduct.name}</Text>
              <Text style={styles.scannedProductPrice}>₱{scannedProduct.price.toFixed(2)}</Text>
              <Button 
                mode="contained"
                onPress={() => addToCart(scannedProduct)}
                style={styles.addButton}
              >
                Add to Cart
              </Button>
              <Button 
                mode="outlined"
                onPress={() => {
                  setScannedProduct(null);
                  setScanning(false);
                }}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
            </Surface>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <Text style={styles.scanTitle}>Scan Product Barcode</Text>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "code128"],
              }}
              onBarcodeScanned={handleBarCodeScanned}
            >
              <View style={styles.overlay}>
                <Button
                  mode="contained"
                  onPress={() => setScanning(false)}
                  style={styles.cancelScanButton}
                >
                  Cancel Scan
                </Button>
              </View>
            </CameraView>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Grocery Calculator</Text>
        <View style={styles.headerActions}>
          {!isOnline && <Text style={styles.offlineIndicator}>Offline</Text>}
          <IconButton 
            icon="barcode-scan" 
            size={28} 
            onPress={startScanning} 
          />
          {totalItems > 0 && (
            <Badge size={24} style={styles.badge}>
              {totalItems}
            </Badge>
          )}
        </View>
      </View>
      
      <View style={styles.content}>
        {/* Product List */}
        <View style={styles.productListContainer}>
          <Text style={styles.sectionTitle}>Available Products</Text>
          {products.length === 0 ? (
            <View style={styles.emptyProductsContainer}>
              <Text style={styles.emptyText}>No products available.</Text>
              <Button 
                mode="outlined"
                onPress={fetchProducts}
                disabled={!isOnline}
                style={styles.refreshButton}
              >
                Refresh Products
              </Button>
            </View>
          ) : (
            <ScrollView>
              {products.map(product => (
                <Surface key={product.id} style={styles.productCard}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productPrice}>₱{product.price.toFixed(2)}</Text>
                    {product.stock !== undefined && (
                      <Text style={[styles.stockText, product.stock <= 5 && styles.lowStockText]}>
                        {product.stock <= 0 ? "Out of stock" : `Stock: ${product.stock}`}
                      </Text>
                    )}
                  </View>
                  <IconButton
                    icon="plus"
                    mode="contained"
                    size={20}
                    onPress={() => addToCart(product)}
                    disabled={product.stock !== undefined && product.stock <= 0}
                  />
                </Surface>
              ))}
            </ScrollView>
          )}
        </View>
        
        {/* Cart */}
        <View style={styles.cartContainer}>
          <Text style={styles.sectionTitle}>Your Cart</Text>
          {cart.length === 0 ? (
            <Text style={styles.emptyCartText}>Your cart is empty</Text>
          ) : (
            <>
              <ScrollView style={styles.cartItems}>
                {cart.map(item => (
                  <Surface key={item.id} style={styles.cartItemCard}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemPrice}>
                        ₱{(item.price * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.quantityControl}>
                      <IconButton
                        icon="minus"
                        size={16}
                        mode="outlined"
                        onPress={() => updateQuantity(item.id, -1)}
                      />
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                      <IconButton
                        icon="plus"
                        size={16}
                        mode="outlined"
                        onPress={() => updateQuantity(item.id, 1)}
                      />
                    </View>
                  </Surface>
                ))}
              </ScrollView>
              <Surface style={styles.totalContainer}>
                <Text style={styles.totalTitle}>Total:</Text>
                <Text style={styles.totalAmount}>₱{totalPrice.toFixed(2)}</Text>
              </Surface>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f5f5f5',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
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
    badge: {
      position: 'absolute',
      top: -5,
      right: -5,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    productListContainer: {
      flex: 1,
      marginBottom: 16,
    },
    cartContainer: {
      flex: 1,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 10,
    },
    productCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      marginBottom: 8,
      borderRadius: 8,
    },
    productInfo: {
      flex: 1,
    },
    productName: {
      fontSize: 16,
      fontWeight: '500',
    },
    productPrice: {
      fontSize: 14,
      color: '#2e7d32',
      fontWeight: '600',
    },
    cartItems: {
      flex: 1,
    },
    cartItemCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      marginBottom: 8,
      borderRadius: 8,
    },
    cartItemInfo: {
      flex: 1,
    },
    cartItemName: {
      fontSize: 16,
      fontWeight: '500',
    },
    cartItemPrice: {
      fontSize: 14,
      color: '#2e7d32',
      fontWeight: '600',
    },
    quantityControl: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    quantityText: {
      fontSize: 16,
      marginHorizontal: 8,
      minWidth: 24,
      textAlign: 'center',
    },
    totalContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderRadius: 8,
      marginTop: 8,
    },
    totalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    totalAmount: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#2e7d32',
    },
    emptyCartText: {
      textAlign: 'center',
      paddingVertical: 20,
      opacity: 0.6,
    },
    cameraContainer: {
      flex: 1,
      backgroundColor: 'black',
    },
    scanTitle: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      padding: 16,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    camera: {
      flex: 1,
      width: Dimensions.get("window").width,
      height: Dimensions.get("window").height,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'transparent',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: 50,
    },
    cancelScanButton: {
      marginBottom: 20,
      backgroundColor: 'black',
      color: 'white',
    },
    scannedProductContainer: {
      flex: 1,
      padding: 20,
      backgroundColor: '#f5f5f5',
      justifyContent: 'center',
    },
    scannedProductTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 16,
      textAlign: 'center',
    },
    scannedProductCard: {
      padding: 20,
      borderRadius: 8,
      elevation: 4,
    },
    scannedProductName: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 8,
    },
    scannedProductPrice: {
      fontSize: 18,
      fontWeight: '600',
      color: '#2e7d32',
      marginBottom: 20,
    },
    addButton: {
      marginBottom: 12,
    },
    cancelButton: {
      marginBottom: 4,
    },
  });

export default GroceryScreen;