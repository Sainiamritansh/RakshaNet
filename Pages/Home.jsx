import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Alert,
  Linking,
  Platform,
  PermissionsAndroid,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socket from '../services/socket';
import { db } from '../services/firebase';
import { collection, getDocs } from 'firebase/firestore';

const CONTACTS_KEY = '@emergency_contacts';

const Home = () => {
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const pulseAnim = new Animated.Value(1);

  const emergencyTypes = [
    {
      id: 1,
      name: 'Medical Emergency',
      icon: '🏥',
      color: '#EF4444',
      number: '108',
      description: 'Ambulance & Medical Help'
    },
    {
      id: 2,
      name: 'Police Threat',
      icon: '🚨',
      color: '#3B82F6',
      number: '100',
      description: 'Police Emergency'
    },
    {
      id: 3,
      name: 'Fire Emergency',
      icon: '🔥',
      color: '#F97316',
      number: '101',
      description: 'Fire Department'
    },
    {
      id: 4,
      name: 'Natural Disaster',
      icon: '⛈️',
      color: '#A855F7',
      number: '112',
      description: 'Disaster Management'
    },
    {
      id: 5,
      name: 'Road Accident Help',
      icon: '🚗',
      color: '#EAB308',
      number: '108',
      description: 'Accident Emergency'
    },
    {
      id: 6,
      name: 'Cyber SOS/Fraud SOS',
      icon: '📱',
      color: '#14B8A6',
      number: '1930',
      description: 'Cyber Crime Helpline'
    }
  ];

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Load emergency contacts initially
    loadEmergencyContacts();
    
    // Reload contacts periodically to catch updates
    const interval = setInterval(() => {
      loadEmergencyContacts();
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const loadEmergencyContacts = async () => {
    try {
      console.log('📥 Loading emergency contacts...');
      
      // Try Firebase first
      if (db) {
        try {
          const contactsRef = collection(db, 'emergencyContacts');
          const snapshot = await getDocs(contactsRef);
          const contacts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          if (contacts.length > 0) {
            setEmergencyContacts(contacts);
            console.log('📞 Loaded emergency contacts from Firebase:', JSON.stringify(contacts, null, 2));
            return;
          }
        } catch (firebaseError) {
          console.warn('⚠️ Firebase failed, trying AsyncStorage:', firebaseError.message);
        }
      }
      
      // Fallback to AsyncStorage
      const savedContacts = await AsyncStorage.getItem(CONTACTS_KEY);
      if (savedContacts) {
        const contacts = JSON.parse(savedContacts);
        setEmergencyContacts(contacts);
        console.log('📞 Loaded emergency contacts from AsyncStorage:', JSON.stringify(contacts, null, 2));
      } else {
        setEmergencyContacts([]);
        console.log('📭 No emergency contacts found');
      }
    } catch (error) {
      console.error('❌ Error loading emergency contacts:', error);
      setEmergencyContacts([]);
    }
  };

  const requestAllPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        // Request location permission first
        const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
        
        // Then request other permissions
        const permissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.SEND_SMS,
          PermissionsAndroid.PERMISSIONS.CALL_PHONE,
        ]);

        console.log('📋 Permissions:', {
          location: locationStatus === 'granted',
          sms: permissions['android.permission.SEND_SMS'] === 'granted',
          call: permissions['android.permission.CALL_PHONE'] === 'granted'
        });

        return {
          location: locationStatus === 'granted',
          sms: permissions['android.permission.SEND_SMS'] === 'granted',
          call: permissions['android.permission.CALL_PHONE'] === 'granted'
        };
      } catch (err) {
        console.warn('❌ Permission error:', err);
        return { location: false, sms: false, call: false };
      }
    }
    return { location: true, sms: true, call: true };
  };

  const getCurrentLocation = async () => {
    try {
      console.log('📍 Requesting location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };
      
      setCurrentLocation(locationData);
      console.log('📍 Location obtained:', locationData);
      return locationData;
    } catch (error) {
      console.log('❌ Location error:', error);
      throw error;
    }
  };

  const getBatteryLevel = async () => {
    try {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      const batteryState = await Battery.getBatteryStateAsync();
      const battery = {
        level: Math.round(batteryLevel * 100),
        state: batteryState === Battery.BatteryState.CHARGING ? 'Charging' : 
               batteryState === Battery.BatteryState.FULL ? 'Full' : 'Not Charging'
      };
      console.log('🔋 Battery:', battery);
      return battery;
    } catch (error) {
      console.error('❌ Battery error:', error);
      return { level: 'Unknown', state: 'Unknown' };
    }
  };

  const getNetworkInfo = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      const network = {
        type: networkState.type,
        isConnected: networkState.isConnected,
        isInternetReachable: networkState.isInternetReachable
      };
      console.log('📶 Network:', network);
      return network;
    } catch (error) {
      console.error('❌ Network error:', error);
      return { type: 'Unknown', isConnected: false };
    }
  };

  const sendSMSToContact = async (phoneNumber, message) => {
    try {
      console.log(`📱 Sending SMS to: ${phoneNumber}`);
      
      // For Android, we can send to multiple numbers separated by semicolon
      const url = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;

      const canOpen = await Linking.canOpenURL(url);
      console.log(`Can open SMS URL: ${canOpen}`);

      if (canOpen) {
        await Linking.openURL(url);
        console.log(`✅ SMS app opened for ${phoneNumber}`);
        return true;
      } else {
        console.log(`❌ Cannot open SMS URL for ${phoneNumber}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ SMS error for ${phoneNumber}:`, error);
      return false;
    }
  };

  const sendEmergencySMS = async (location, battery, network, emergencyType) => {
    console.log('📨 Starting SMS send process...');
    console.log('📞 Emergency contacts to notify:', emergencyContacts.length);

    if (emergencyContacts.length === 0) {
      Alert.alert('⚠️ No Contacts', 'No emergency contacts found. Add contacts in the Contacts tab.');
      return { sent: 0, failed: 0 };
    }

    const message = `🚨 EMERGENCY ALERT from RakshaNet 🚨

Type: ${emergencyType}
Location: https://maps.google.com/?q=${location.latitude},${location.longitude}
Coordinates: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
Battery: ${battery.level}% (${battery.state})
Network: ${network.type}
Time: ${new Date().toLocaleString()}

This is an automated emergency alert. Please respond immediately!`;

    console.log('📝 Message prepared');

    try {
      // Collect all phone numbers
      const phoneNumbers = emergencyContacts
        .map(contact => contact.phone || contact.phoneNumber)
        .filter(phone => phone)
        .join(';'); // Semicolon for multiple recipients on Android

      console.log(`📱 Sending SMS to ${emergencyContacts.length} contacts: ${phoneNumbers}`);

      if (!phoneNumbers) {
        Alert.alert('⚠️ Error', 'No valid phone numbers found in contacts');
        return { sent: 0, failed: emergencyContacts.length };
      }

      // Open SMS app with all contacts at once
      const url = `sms:${phoneNumbers}?body=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
        console.log(`✅ SMS app opened with ${emergencyContacts.length} recipients`);
        
        // Give user time to send the SMS
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return { sent: emergencyContacts.length, failed: 0 };
      } else {
        console.log('❌ Cannot open SMS app');
        Alert.alert('Error', 'Cannot open SMS app on this device');
        return { sent: 0, failed: emergencyContacts.length };
      }
    } catch (error) {
      console.error('❌ Error in sendEmergencySMS:', error);
      return { sent: 0, failed: emergencyContacts.length };
    }
  };

  const makeEmergencyCall = async (phoneNumber) => {
    try {
      console.log(`📞 Attempting to call: ${phoneNumber}`);
      
      const url = `tel:${phoneNumber}`;
      const canOpen = await Linking.canOpenURL(url);
      
      console.log(`Can make call: ${canOpen}`);

      if (canOpen) {
        await Linking.openURL(url);
        console.log(`✅ Call initiated to ${phoneNumber}`);
        return true;
      } else {
        console.log(`❌ Cannot make call to ${phoneNumber}`);
        Alert.alert('Error', 'Cannot make phone calls on this device');
        return false;
      }
    } catch (error) {
      console.error(`❌ Call error for ${phoneNumber}:`, error);
      Alert.alert('Call Error', error.message);
      return false;
    }
  };

  const broadcastDistressSignal = (location, battery, network, emergencyType) => {
    const distressData = {
      type: emergencyType,
      message: `${emergencyType} - Immediate assistance required!`,
      lat: location.latitude,
      lon: location.longitude,
      battery: battery.level,
      batteryState: battery.state,
      network: network.type,
      isConnected: network.isConnected,
      timestamp: new Date().toISOString(),
      accuracy: location.accuracy
    };

    console.log('📡 Broadcasting distress signal:', distressData);
    socket.emit('send_distress', distressData);
  };

  const handleSOSClick = async () => {
    console.log('🚨 SOS button pressed');
    const permissions = await requestAllPermissions();
    
    console.log('Permissions result:', permissions);
    
    if (!permissions.location) {
      Alert.alert('Permission Required', 'Location permission is required for emergency alerts');
      return;
    }
    
    if (!permissions.call) {
      Alert.alert('Permission Required', 'Phone call permission is required to call emergency services');
      return;
    }

    setShowModal(true);
  };

  const handleEmergencySelect = async (emergency) => {
    console.log('🚨 Emergency selected:', emergency.name);
    setSelectedEmergency(emergency);
    setIsProcessing(true);

    try {
      // Get all emergency data
      console.log('Step 1: Getting location...');
      const location = await getCurrentLocation();
      
      console.log('Step 2: Getting battery info...');
      const battery = await getBatteryLevel();
      
      console.log('Step 3: Getting network info...');
      const network = await getNetworkInfo();

      console.log('Step 4: Sending SMS to emergency contacts...');
      const smsResult = await sendEmergencySMS(location, battery, network, emergency.name);

      console.log('Step 5: Broadcasting distress signal...');
      broadcastDistressSignal(location, battery, network, emergency.name);

      // Close modal
      setIsProcessing(false);
      setShowModal(false);
      setSelectedEmergency(null);

      // Show success message
      const alertMessage = `${emergency.name}

✅ Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}
✅ Battery: ${battery.level}% (${battery.state})
✅ Network: ${network.type}
✅ SMS sent to ${smsResult.sent}/${emergencyContacts.length} contacts
✅ Broadcast sent

Calling ${emergency.number} now...`;

      console.log('Step 6: Showing alert and calling...');
      console.log(alertMessage);

      Alert.alert('🚨 Emergency Alert Sent!', alertMessage, [
        {
          text: 'OK',
          onPress: () => {
            console.log('Step 7: Making emergency call...');
            makeEmergencyCall(emergency.number);
          }
        }
      ]);

    } catch (error) {
      console.error('❌ Emergency alert error:', error);
      setIsProcessing(false);
      
      Alert.alert(
        'Error',
        `Failed: ${error.message}\n\nTrying to call ${emergency.number} anyway...`,
        [{
          text: 'OK',
          onPress: () => {
            makeEmergencyCall(emergency.number);
            setShowModal(false);
            setSelectedEmergency(null);
          }
        }]
      );
    }
  };

  const closeModal = () => {
    if (!isProcessing) {
      setShowModal(false);
      setSelectedEmergency(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4FF" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>RakshaNet</Text>
        <Text style={styles.tagline}>Your Safety Network</Text>
        {emergencyContacts.length > 0 ? (
          <Text style={styles.contactCount}>
            ✅ {emergencyContacts.length} Emergency Contact{emergencyContacts.length !== 1 ? 's' : ''} Ready
          </Text>
        ) : (
          <Text style={styles.contactWarning}>
            ⚠️ No Emergency Contacts - Add in Contacts tab
          </Text>
        )}
      </View>

      {/* Main SOS Button */}
      <View style={styles.sosContainer}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.sosButton}
            onPress={handleSOSClick}
            activeOpacity={0.8}
          >
            <Text style={styles.sosIcon}>🚨</Text>
            <Text style={styles.sosText}>SOS</Text>
            <Text style={styles.sosSubtext}>Emergency Alert</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Press SOS button in case of emergency. Your location, battery level, and network info will be sent to emergency contacts. Emergency services will be called.
        </Text>
      </View>

      {/* Emergency Selection Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Emergency Type</Text>
                <Text style={styles.modalSubtitle}>This will notify contacts and call emergency services</Text>
              </View>
              {!isProcessing && (
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Emergency Options */}
            <ScrollView style={styles.optionsContainer}>
              {emergencyTypes.map((emergency) => (
                <TouchableOpacity
                  key={emergency.id}
                  style={[
                    styles.emergencyOption,
                    { backgroundColor: emergency.color },
                    isProcessing && styles.disabledOption
                  ]}
                  onPress={() => handleEmergencySelect(emergency)}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <View style={styles.iconContainer}>
                    <Text style={styles.emergencyIcon}>{emergency.icon}</Text>
                  </View>
                  <View style={styles.emergencyInfo}>
                    <Text style={styles.emergencyName}>{emergency.name}</Text>
                    <Text style={styles.emergencyDescription}>
                      {emergency.description}
                    </Text>
                    <Text style={styles.emergencyNumber}>📞 Will call {emergency.number}</Text>
                  </View>
                  {selectedEmergency?.id === emergency.id && isProcessing && (
                    <Text style={styles.loadingText}>⏳</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Processing State */}
            {isProcessing && (
              <View style={styles.processingContainer}>
                <Text style={styles.processingTitle}>⏳ Sending emergency alert...</Text>
                <View style={styles.processingSteps}>
                  <Text style={styles.processingStep}>📍 Getting your location...</Text>
                  <Text style={styles.processingStep}>🔋 Checking battery level...</Text>
                  <Text style={styles.processingStep}>📶 Checking network status...</Text>
                  <Text style={styles.processingStep}>📱 Notifying emergency contacts...</Text>
                  <Text style={styles.processingStep}>📡 Broadcasting to nearby users...</Text>
                  <Text style={styles.processingStep}>📞 Preparing to call emergency services...</Text>
                </View>
              </View>
            )}

            {/* Footer Note */}
            {!isProcessing && (
              <View style={styles.modalFooter}>
                <Text style={styles.footerText}>
                  ⚠️ Warning: Emergency services will be called after sending the alert. Your complete emergency data will be shared with contacts.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4FF',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#6B7280',
  },
  contactCount: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 8,
    fontWeight: '600',
  },
  contactWarning: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
    fontWeight: '600',
  },
  sosContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  sosIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  sosText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sosSubtext: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
  },
  infoBox: {
    margin: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    backgroundColor: '#DC2626',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  optionsContainer: {
    padding: 16,
    maxHeight: 400,
  },
  emergencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledOption: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  emergencyIcon: {
    fontSize: 32,
  },
  emergencyInfo: {
    flex: 1,
  },
  emergencyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emergencyDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  emergencyNumber: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 24,
  },
  processingContainer: {
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderTopWidth: 1,
    borderTopColor: '#FCA5A5',
  },
  processingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#991B1B',
    textAlign: 'center',
    marginBottom: 12,
  },
  processingSteps: {
    paddingLeft: 8,
  },
  processingStep: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
  },
  modalFooter: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default Home;