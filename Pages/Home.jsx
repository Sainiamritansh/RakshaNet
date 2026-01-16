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
import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';

const SOS = () => {
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
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
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'RakshaNet needs access to your location for emergency alerts',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: position.timestamp,
          };
          setCurrentLocation(location);
          resolve(location);
        },
        (error) => {
          console.log('Location error:', error);
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  };

  const handleSOSClick = async () => {
    const hasPermission = await requestLocationPermission();
    if (hasPermission) {
      setShowModal(true);
    } else {
      Alert.alert(
        'Permission Required',
        'Location permission is required for emergency alerts'
      );
    }
  };

  const handleEmergencySelect = async (emergency) => {
    setSelectedEmergency(emergency);
    setIsProcessing(true);

    try {
      const location = await getCurrentLocation();
      
      const emergencyData = {
        type: emergency.name,
        emergencyNumber: emergency.number,
        location: location,
        timestamp: new Date().toISOString(),
      };

      console.log('Emergency Alert Data:', emergencyData);

      // TODO: Integrate with your backend
      // Import your EmergencyService and call:
      // await EmergencyService.sendAlert(emergencyData);

      setTimeout(() => {
        setIsProcessing(false);
        
        Alert.alert(
          'Emergency Alert Sent!',
          `${emergency.name}\nEmergency Number: ${emergency.number}\n\nYour location and details have been shared with emergency contacts.\n\nWould you like to call emergency services?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setShowModal(false);
                setSelectedEmergency(null);
              }
            },
            {
              text: 'Call Now',
              onPress: () => {
                Linking.openURL(`tel:${emergency.number}`);
                setShowModal(false);
                setSelectedEmergency(null);
              }
            }
          ]
        );
      }, 2000);

    } catch (error) {
      setIsProcessing(false);
      Alert.alert('Error', 'Failed to get location. Please try again.');
      console.error('Emergency alert error:', error);
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
      
      {/* Back Button */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>RakshaNet</Text>
        <Text style={styles.tagline}>Your Safety Network</Text>
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
          Press SOS button in case of emergency. Your location and alert will be sent to emergency contacts and authorities.
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
                <Text style={styles.modalSubtitle}>Choose the type of emergency</Text>
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
                    <Text style={styles.emergencyNumber}>📞 {emergency.number}</Text>
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
                  <Text style={styles.processingStep}>📞 Alerting emergency contacts...</Text>
                  <Text style={styles.processingStep}>🚨 Notifying authorities...</Text>
                </View>
              </View>
            )}

            {/* Footer Note */}
            {!isProcessing && (
              <View style={styles.modalFooter}>
                <Text style={styles.footerText}>
                  Your location and emergency details will be shared with registered contacts and local authorities immediately.
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
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
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

export default SOS;