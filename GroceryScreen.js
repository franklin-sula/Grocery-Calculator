import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, SafeAreaView, ScrollView, ToastAndroid, StatusBar, Platform } from 'react-native';
import { Button, Surface, IconButton, Badge, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Supabase is a database service - here we connect to it
// Initialize Supabase client with our project URL and API key
const supabaseUrl = 'https://btfcwdipcwtkizcmmfqw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0ZmN3ZGlwY3d0a2l6Y21tZnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1NDIyMDEsImV4cCI6MjA1NjExODIwMX0.cGG48aLVYGmMwT0GsK6M7j6CBIq7JCMR65Az1qgQpaM';
const supabase = createClient(supabaseUrl, supabaseKey);

// Get screen width to make our UI responsive
const { width } = Dimensions.get('window');

// This is our main component that manages the entire grocery app screen
const GroceryScreen = () => {
  // useState hooks create variables that, when changed, cause the UI to update
  const [products, setProducts] = useState([]); // List of all grocery products
  const [cart, setCart] = useState([]); // Items in the shopping cart
  const [showScanner, setShowScanner] = useState(true); // show product list instead of scanner
  const [showProductList, setShowProductList] = useState(false); // show product list
  const [scannedProduct, setScannedProduct] = useState(null); // Currently scanned product
  const [permission, requestPermission] = useCameraPermissions(); // Camera permissions
  const [isOnline, setIsOnline] = useState(true); // Network status
  const [isLoading, setIsLoading] = useState(true); // Loading state for data
  const [isScanning, setIsScanning] = useState(true); // Whether scanner is actively scanning
  const [scanCountdown, setScanCountdown] = useState(0); // Countdown timer for scan delay
  
  // useRef creates a value that persists between renders but doesn't cause re-renders
  const scanTimeoutRef = useRef(null); // Store timeout ID so we can clear it later

  // useEffect hooks run code when specific things happen or change
  
  // This useEffect runs once when the component loads and sets up network monitoring
  useEffect(() => {
    // Monitor network connectivity
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
      if (state.isConnected) {
        syncDataWithServer(); // If online, sync with server
      } else {
        showToast('You are offline. Using cached data.'); // If offline, notify user
      }
    });

    // Return function in useEffect cleans up when component unmounts
    return () => unsubscribe(); // Stop listening for network changes when screen closes
  }, []); // Empty array means this runs once when component loads

  // Load data when the app starts
  useEffect(() => {
    loadDataFromStorage(); // Load saved data from device storage
    fetchProducts(); // Download latest products from database
  }, []);

  // Save cart whenever it changes
  useEffect(() => {
    saveCartToStorage(cart);
  }, [cart]); // FIXED: Added cart as dependency to save when it changes

  // Request camera permission when app starts
  useEffect(() => {
    (async () => {
      if (!permission?.granted) {
        await requestPermission();
      }
    })();
  }, []);

  // Clean up timeouts to prevent memory leaks
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Handle countdown timer for scanning
  useEffect(() => {
    if (scanCountdown > 0) {
      const timerId = setTimeout(() => {
        setScanCountdown(scanCountdown - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    } else if (scanCountdown === 0 && !isScanning) {
      setIsScanning(true); // Resume scanning when countdown reaches 0
    }
  }, [scanCountdown, isScanning]);

  // Helper function to show toast messages on Android
  const showToast = (message) => {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  };

  // Load saved data from device storage
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

      setIsLoading(false); // Data loading complete
    } catch (error) {
      console.error('Error loading data from storage:', error);
      setIsLoading(false);
    }
  };

  // Save products to device storage for offline use
  const saveProductsToStorage = async (productsData) => {
    try {
      await AsyncStorage.setItem('products', JSON.stringify(productsData));
    } catch (error) {
      console.error('Error saving products to storage:', error);
    }
  };

  // Save cart to device storage
  const saveCartToStorage = async (cartData) => {
    try {
      await AsyncStorage.setItem('cart', JSON.stringify(cartData));
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  };

  // Sync data with server when online
  const syncDataWithServer = async () => {
    if (isOnline) {
      await fetchProducts();
    }
  };

  // Fetch products from the database
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
        setProducts(data); // Update products in state
        saveProductsToStorage(data); // Save for offline use
      }
    } catch (error) {
      console.error('Network error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle between scanner and product list views
  const toggleView = () => {
    setShowProductList(!showProductList);
    setShowScanner(!showScanner);
    // Reset scanning state when switching views
    setIsScanning(true);
    setScanCountdown(0);
  };

  // Reset scanner after delay
  const resetScanner = (delay = 3) => {
    setIsScanning(false);
    setScanCountdown(delay);
    showToast(`Scanner will resume in ${delay} seconds`);
  };

  // Handle barcode scanning
  const handleBarCodeScanned = ({ data }) => {
    // Only process if we are actively scanning
    if (!isScanning) return;
    
    // Look for product with matching barcode
    const product = products.find(p => p.barcode === data);
    if (product) {
      setScannedProduct({ ...product, quantity: 1 });
      setIsScanning(false); // Pause scanning while showing the product
    } else {
      alert("Product not found");
      // Add a delay before resuming scanning
      resetScanner();
    }
  };

  // Add product to shopping cart
  const addToCart = (product) => {
    setCart(current => {
      const existing = current.find(item => item.id === product.id);
      
      // If product already in cart, increase quantity, otherwise add it
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
    
    // If we just scanned this product, reset the scanner
    if (scannedProduct) {
      setScannedProduct(null);
      resetScanner();
    }
  };

  // Update quantity of product in cart
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

  // Calculate total items and price
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Show loading screen while data is loading
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <StatusBar backgroundColor="#ffffff" barStyle="dark-content" />
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={styles.loadingText}>Loading grocery calculator...</Text>
      </SafeAreaView>
    );
  }

  // Main UI render
  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <StatusBar backgroundColor="#ffffff" barStyle="dark-content" translucent={Platform.OS === 'android'} />
      
      {/* Header section with title and controls */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 10) : 10 }]}>
        <Text style={styles.title}>Grocery Calculator</Text>
        <View style={styles.headerActions}>
          {!isOnline && <Text style={styles.offlineIndicator}>Offline</Text>}
          <Button 
            mode="outlined"
            onPress={toggleView}
            style={styles.listProductsButton}
          >
            {showScanner ? "List of Products" : "Scanner"}
          </Button>
          {totalItems > 0 && (
            <Badge size={24} style={styles.badge}>
              {totalItems}
            </Badge>
          )}
        </View>
      </View>
      
      <View style={styles.content}>
        {/* Scanner or Product List Section */}
        <View style={styles.topSection}>
          {showScanner ? (
            <View style={styles.scannerContainer}>
              <View style={styles.scannerHeader}>
                <Text style={styles.sectionTitle}>Scan Product Barcode</Text>
                {scanCountdown > 0 && (
                  <View style={styles.countdownBadge}>
                    <Text style={styles.countdownText}>{scanCountdown}</Text>
                  </View>
                )}
              </View>
              
              {permission?.granted ? (
                scannedProduct ? (
                  <View style={styles.scannedProductContainer}>
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
                          resetScanner();
                        }}
                        style={styles.cancelButton}
                      >
                        Cancel
                      </Button>
                    </Surface>
                  </View>
                ) : (
                  <View style={styles.cameraWrapper}>
                    <CameraView
                      style={styles.camera}
                      facing="back"
                      barcodeScannerSettings={{
                        barcodeTypes: ["ean13", "ean8", "code128"],
                      }}
                      onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
                    />
                  </View>
                )
              ) : (
                <View style={styles.permissionContainer}>
                  <Text style={styles.permissionText}>Camera permission is required to scan barcodes</Text>
                  <Button 
                    mode="contained"
                    onPress={requestPermission}
                    style={styles.permissionButton}
                  >
                    Grant Permission
                  </Button>
                </View>
              )}
            </View>
          ) : (
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
          )}
        </View>
        
        {/* Cart section */}
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

// StyleSheet is used to create organized styles similar to CSS
const styles = StyleSheet.create({
  // Each style object has properties similar to CSS but using camelCase
  container: {
    flex: 1, // Take up all available space
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    justifyContent: 'center', // Center vertically
    alignItems: 'center', // Center horizontally
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  // This fixes the Android status bar overlap issue
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    elevation: 2, // Android shadow
    zIndex: 10, // Layer ordering
    // Remove duplicate paddingTop that causes overflow
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
  listProductsButton: {
    marginRight: 10,
  },
  offlineIndicator: {
    backgroundColor: '#f44336', // Red background for offline indicator
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    marginRight: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  topSection: {
    flex: 1,
    marginBottom: 16,
  },
  scannerContainer: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  countdownBadge: {
    backgroundColor: '#2e7d32',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cameraWrapper: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 8,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pauseText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  permissionButton: {
    marginTop: 10,
  },
  productListContainer: {
    flex: 1,
  },
  cartContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  stockText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  lowStockText: {
    color: '#f57c00',
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
  emptyProductsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    opacity: 0.6,
  },
  refreshButton: {
    marginTop: 10,
  },
  scannedProductContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
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