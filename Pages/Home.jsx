import React, { useState, useEffect, useRef } from "react";
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
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Battery from "expo-battery";
import * as Network from "expo-network";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socket from "../services/socket";
import { db } from "../services/firebase";
import { collection, getDocs } from "firebase/firestore";
import { syncContactsToNative, openAccessibilitySettings, isSOSServiceEnabled } from "../services/SOSBackgroundService";

const { width } = Dimensions.get("window");
const CONTACTS_KEY = "@emergency_contacts";

const Home = () => {
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [locationShared, setLocationShared] = useState(false);
  const [sosServiceEnabled, setSOSServiceEnabled] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0.8)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  const emergencyTypes = [
    {
      id: 1,
      name: "Medical Emergency",
      icon: "medkit",
      color: "#EF4444",
      number: "108",
      description: "Ambulance & Medical Help",
    },
    {
      id: 2,
      name: "Police Threat",
      icon: "shield",
      color: "#3B82F6",
      number: "100",
      description: "Police Emergency",
    },
    {
      id: 3,
      name: "Fire Emergency",
      icon: "flame",
      color: "#F97316",
      number: "101",
      description: "Fire Department",
    },
    {
      id: 4,
      name: "Natural Disaster",
      icon: "thunderstorm",
      color: "#A855F7",
      number: "112",
      description: "Disaster Management",
    },
    {
      id: 5,
      name: "Road Accident Help",
      icon: "car",
      color: "#EAB308",
      number: "108",
      description: "Accident Emergency",
    },
    {
      id: 6,
      name: "Cyber SOS/Fraud SOS",
      icon: "phone-portrait",
      color: "#14B8A6",
      number: "1930",
      description: "Cyber Crime Helpline",
    },
    {
      id: 7,
      name: "Online Scam / UPI Fraud",
      icon: "card",
      color: "#6366F1",
      number: "1930",
      description: "Report Online & UPI Fraud",
    },
  ];

  useEffect(() => {
    // Pulse animation for SOS button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Ring animation
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.3,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    loadEmergencyContacts();
    checkServiceStatus();

    const interval = setInterval(() => {
      loadEmergencyContacts();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const loadEmergencyContacts = async () => {
    try {
      if (db) {
        try {
          const contactsRef = collection(db, "emergencyContacts");
          const snapshot = await getDocs(contactsRef);
          const contacts = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          if (contacts.length > 0) {
            setEmergencyContacts(contacts);
            return;
          }
        } catch (firebaseError) {
          console.warn("⚠️ Firebase failed, trying AsyncStorage:", firebaseError.message);
        }
      }

      const savedContacts = await AsyncStorage.getItem(CONTACTS_KEY);
      if (savedContacts) {
        const contacts = JSON.parse(savedContacts);
        setEmergencyContacts(contacts);
      } else {
        setEmergencyContacts([]);
      }
    } catch (error) {
      console.error("❌ Error loading emergency contacts:", error);
      setEmergencyContacts([]);
    }
  };

  // Sync contacts to native whenever they change
  useEffect(() => {
    if (emergencyContacts.length > 0) {
      syncContactsToNative(emergencyContacts);
    }
  }, [emergencyContacts]);

  const checkServiceStatus = async () => {
    const enabled = await isSOSServiceEnabled();
    setSOSServiceEnabled(enabled);
  };

  const requestAllPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const { status: locationStatus } =
          await Location.requestForegroundPermissionsAsync();
        const permissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.SEND_SMS,
          PermissionsAndroid.PERMISSIONS.CALL_PHONE,
        ]);
        return {
          location: locationStatus === "granted",
          sms: permissions["android.permission.SEND_SMS"] === "granted",
          call: permissions["android.permission.CALL_PHONE"] === "granted",
        };
      } catch (err) {
        console.warn("❌ Permission error:", err);
        return { location: false, sms: false, call: false };
      }
    }
    return { location: true, sms: true, call: true };
  };

  const getCurrentLocation = async () => {
    try {
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
      setLocationShared(true);
      return locationData;
    } catch (error) {
      console.log("❌ Location error:", error);
      throw error;
    }
  };

  const getBatteryLevel = async () => {
    try {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      const batteryState = await Battery.getBatteryStateAsync();
      return {
        level: Math.round(batteryLevel * 100),
        state:
          batteryState === Battery.BatteryState.CHARGING
            ? "Charging"
            : batteryState === Battery.BatteryState.FULL
              ? "Full"
              : "Not Charging",
      };
    } catch (error) {
      return { level: "Unknown", state: "Unknown" };
    }
  };

  const getNetworkInfo = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return {
        type: networkState.type,
        isConnected: networkState.isConnected,
        isInternetReachable: networkState.isInternetReachable,
      };
    } catch (error) {
      return { type: "Unknown", isConnected: false };
    }
  };

  const sendEmergencySMS = async (location, battery, network, emergencyType) => {
    if (emergencyContacts.length === 0) {
      Alert.alert("⚠️ No Contacts", "No emergency contacts found. Add contacts in the Contacts tab.");
      return { sent: 0, failed: 0 };
    }

    const message = `🚨 EMERGENCY ALERT from RakshaNet 🚨\n\nType: ${emergencyType}\nLocation: https://maps.google.com/?q=${location.latitude},${location.longitude}\nCoordinates: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}\nBattery: ${battery.level}% (${battery.state})\nNetwork: ${network.type}\nTime: ${new Date().toLocaleString()}\n\nThis is an automated emergency alert. Please respond immediately!`;

    try {
      const phoneNumbers = emergencyContacts
        .map((contact) => contact.phone || contact.phoneNumber)
        .filter((phone) => phone)
        .join(";");

      if (!phoneNumbers) {
        Alert.alert("⚠️ Error", "No valid phone numbers found in contacts");
        return { sent: 0, failed: emergencyContacts.length };
      }

      const url = `sms:${phoneNumbers}?body=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { sent: emergencyContacts.length, failed: 0 };
      } else {
        Alert.alert("Error", "Cannot open SMS app on this device");
        return { sent: 0, failed: emergencyContacts.length };
      }
    } catch (error) {
      return { sent: 0, failed: emergencyContacts.length };
    }
  };

  const makeEmergencyCall = async (phoneNumber) => {
    try {
      const url = `tel:${phoneNumber}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      } else {
        Alert.alert("Error", "Cannot make phone calls on this device");
        return false;
      }
    } catch (error) {
      Alert.alert("Call Error", error.message);
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
      accuracy: location.accuracy,
    };
    socket.emit("send_distress", distressData);
  };

  const handleSOSClick = async () => {
    const permissions = await requestAllPermissions();
    if (!permissions.location) {
      Alert.alert("Permission Required", "Location permission is required for emergency alerts");
      return;
    }
    if (!permissions.call) {
      Alert.alert("Permission Required", "Phone call permission is required to call emergency services");
      return;
    }
    setShowModal(true);
  };

  const handleEmergencySelect = async (emergency) => {
    setSelectedEmergency(emergency);
    setIsProcessing(true);
    try {
      const location = await getCurrentLocation();
      const battery = await getBatteryLevel();
      const network = await getNetworkInfo();
      const smsResult = await sendEmergencySMS(location, battery, network, emergency.name);
      broadcastDistressSignal(location, battery, network, emergency.name);

      setIsProcessing(false);
      setShowModal(false);
      setSelectedEmergency(null);

      const alertMessage = `${emergency.name}\n\n✅ Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}\n✅ Battery: ${battery.level}% (${battery.state})\n✅ Network: ${network.type}\n✅ SMS sent to ${smsResult.sent}/${emergencyContacts.length} contacts\n✅ Broadcast sent\n\nCalling ${emergency.number} now...`;

      Alert.alert("🚨 Emergency Alert Sent!", alertMessage, [
        {
          text: "OK",
          onPress: () => makeEmergencyCall(emergency.number),
        },
      ]);
    } catch (error) {
      console.error("❌ Emergency alert error:", error);
      setIsProcessing(false);
      Alert.alert(
        "Error",
        `Failed: ${error.message}\n\nTrying to call ${emergency.number} anyway...`,
        [
          {
            text: "OK",
            onPress: () => {
              makeEmergencyCall(emergency.number);
              setShowModal(false);
              setSelectedEmergency(null);
            },
          },
        ]
      );
    }
  };

  const closeModal = () => {
    if (!isProcessing) {
      setShowModal(false);
      setSelectedEmergency(null);
    }
  };

  const getContactColor = (index) => {
    const colors = ["#E53935", "#1E88E5", "#43A047", "#FB8C00", "#8E24AA", "#00ACC1"];
    return colors[index % colors.length];
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F6FA" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Emergency</Text>
            <Text style={styles.appName}>RakshaNet</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* SOS Button Section */}
        <View style={styles.sosSection}>
          {/* Animated ring */}
          <Animated.View
            style={[
              styles.sosRingOuter,
              {
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
          />

          {/* Static ring */}
          <View style={styles.sosRingStatic} />

          {/* SOS Button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.sosButton}
              onPress={handleSOSClick}
              activeOpacity={0.8}
            >
              <Text style={styles.sosText}>SOS</Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.sosHint}>Tap for Emergency Alert</Text>
        </View>

        {/* Emergency Contacts Section */}
        <View style={styles.contactsSection}>
          <View style={styles.contactsHeader}>
            <Text style={styles.contactsTitle}>Your Emergency Contacts</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Contacts")}>
              <Ionicons name="add-circle" size={28} color="#E53935" />
            </TouchableOpacity>
          </View>

          {emergencyContacts.length === 0 ? (
            <View style={styles.emptyContacts}>
              <Ionicons name="people-outline" size={48} color="#BDBDBD" />
              <Text style={styles.emptyText}>No emergency contacts yet</Text>
              <TouchableOpacity
                style={styles.addContactBtn}
                onPress={() => navigation.navigate("Contacts")}
              >
                <Text style={styles.addContactText}>+ Add Contact</Text>
              </TouchableOpacity>
            </View>
          ) : (
            emergencyContacts.slice(0, 4).map((contact, index) => (
              <View key={contact.id || index} style={styles.contactCard}>
                <View
                  style={[
                    styles.contactAvatar,
                    { backgroundColor: getContactColor(index) },
                  ]}
                >
                  <Text style={styles.contactInitial}>
                    {contact.name ? contact.name.charAt(0).toUpperCase() : "?"}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>
                    {contact.phone || contact.phoneNumber}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.contactCallBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${contact.phone || contact.phoneNumber}`)
                  }
                >
                  <Ionicons name="call" size={18} color="#E53935" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Location Status */}
        <View style={styles.locationStatus}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: locationShared ? "#43A047" : "#BDBDBD" },
            ]}
          />
          <Text style={styles.statusText}>
            {locationShared
              ? "Your Live location is Shared"
              : "Location will be shared on SOS"}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => navigation.navigate("Location")}
          >
            <Ionicons name="navigate" size={22} color="#1E88E5" />
            <Text style={styles.quickActionLabel}>Live Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => navigation.navigate("Info")}
          >
            <Ionicons name="cloudy" size={22} color="#FB8C00" />
            <Text style={styles.quickActionLabel}>Weather</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={() => navigation.navigate("Contacts")}
          >
            <Ionicons name="people" size={22} color="#8E24AA" />
            <Text style={styles.quickActionLabel}>Contacts</Text>
          </TouchableOpacity>
        </View>

        {/* Background SOS Service */}
        <TouchableOpacity
          style={[
            styles.bgSOSCard,
            sosServiceEnabled && styles.bgSOSCardActive,
          ]}
          onPress={async () => {
            if (!sosServiceEnabled) {
              Alert.alert(
                "Enable Background SOS",
                "This lets you trigger SOS by pressing Volume Up 3 times — even when the app is closed.\n\nYou'll need to enable RakshaNet in Accessibility Settings.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Open Settings",
                    onPress: async () => {
                      // Sync contacts first
                      await syncContactsToNative(emergencyContacts);
                      await openAccessibilitySettings();
                    },
                  },
                ]
              );
            } else {
              // Sync contacts when tapped if already enabled
              await syncContactsToNative(emergencyContacts);
              Alert.alert("✅ Active", "Background SOS is enabled. Volume Up ×3 will trigger emergency alert from anywhere.");
            }
          }}
          activeOpacity={0.8}
        >
          <View style={styles.bgSOSIcon}>
            <Ionicons
              name={sosServiceEnabled ? "shield-checkmark" : "shield-outline"}
              size={24}
              color={sosServiceEnabled ? "#43A047" : "#E53935"}
            />
          </View>
          <View style={styles.bgSOSInfo}>
            <Text style={styles.bgSOSTitle}>
              {sosServiceEnabled ? "Background SOS Active" : "Enable Background SOS"}
            </Text>
            <Text style={styles.bgSOSSubtitle}>
              {sosServiceEnabled
                ? "Volume Up ×3 works even when app is closed"
                : "Press Volume Up ×3 anytime to trigger SOS"}
            </Text>
          </View>
          <Ionicons
            name={sosServiceEnabled ? "checkmark-circle" : "chevron-forward"}
            size={22}
            color={sosServiceEnabled ? "#43A047" : "#9E9E9E"}
          />
        </TouchableOpacity>
      </ScrollView>

      {/* Emergency Selection Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Emergency Type</Text>
                <Text style={styles.modalSubtitle}>
                  This will notify contacts and call emergency services
                </Text>
              </View>
              {!isProcessing && (
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
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
                    isProcessing && styles.disabledOption,
                  ]}
                  onPress={() => handleEmergencySelect(emergency)}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <View style={styles.emergencyIconContainer}>
                    <Ionicons name={emergency.icon} size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.emergencyInfo}>
                    <Text style={styles.emergencyName}>{emergency.name}</Text>
                    <Text style={styles.emergencyDescription}>
                      {emergency.description}
                    </Text>
                    <Text style={styles.emergencyNumber}>
                      📞 Will call {emergency.number}
                    </Text>
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
                <Text style={styles.processingTitle}>
                  ⏳ Sending emergency alert...
                </Text>
                <View style={styles.processingSteps}>
                  <Text style={styles.processingStep}>📍 Getting your location...</Text>
                  <Text style={styles.processingStep}>🔋 Checking battery level...</Text>
                  <Text style={styles.processingStep}>📶 Checking network status...</Text>
                  <Text style={styles.processingStep}>📱 Notifying emergency contacts...</Text>
                  <Text style={styles.processingStep}>📡 Broadcasting to nearby users...</Text>
                  <Text style={styles.processingStep}>📞 Preparing to call...</Text>
                </View>
              </View>
            )}

            {/* Footer Note */}
            {!isProcessing && (
              <View style={styles.modalFooter}>
                <Text style={styles.footerText}>
                  ⚠️ Emergency services will be called after sending the alert.
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
    backgroundColor: "#F5F6FA",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 55,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  headerLabel: {
    fontSize: 13,
    color: "#E53935",
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A2E",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E53935",
    justifyContent: "center",
    alignItems: "center",
  },
  // SOS Section
  sosSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    marginTop: 10,
  },
  sosRingOuter: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: "#E53935",
  },
  sosRingStatic: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "rgba(229, 57, 53, 0.15)",
  },
  sosButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#E53935",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#E53935",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  sosText: {
    fontSize: 42,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 4,
  },
  sosHint: {
    marginTop: 20,
    fontSize: 14,
    color: "#9E9E9E",
    fontWeight: "500",
  },
  // Contacts Section
  contactsSection: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  contactsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  contactsTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  emptyContacts: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: "#9E9E9E",
    marginTop: 10,
  },
  addContactBtn: {
    marginTop: 12,
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addContactText: {
    color: "#E53935",
    fontWeight: "600",
    fontSize: 14,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  contactInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  contactInfo: {
    flex: 1,
    marginLeft: 14,
  },
  contactName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A2E",
  },
  contactPhone: {
    fontSize: 13,
    color: "#9E9E9E",
    marginTop: 2,
  },
  contactCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFEBEE",
    justifyContent: "center",
    alignItems: "center",
  },
  // Location Status
  locationStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 13,
    color: "#616161",
    fontWeight: "500",
  },
  // Quick Actions
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionLabel: {
    fontSize: 12,
    color: "#616161",
    fontWeight: "600",
    marginTop: 8,
  },
  // Background SOS Card
  bgSOSCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FFCDD2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  bgSOSCardActive: {
    borderColor: "#C8E6C9",
    backgroundColor: "#F1F8E9",
  },
  bgSOSIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFEBEE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  bgSOSInfo: {
    flex: 1,
  },
  bgSOSTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  bgSOSSubtitle: {
    fontSize: 12,
    color: "#9E9E9E",
    marginTop: 3,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    backgroundColor: "#E53935",
    padding: 20,
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#FFFFFF",
    opacity: 0.9,
    marginTop: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  optionsContainer: {
    padding: 16,
    maxHeight: 380,
  },
  emergencyOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledOption: {
    opacity: 0.6,
  },
  emergencyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  emergencyInfo: {
    flex: 1,
  },
  emergencyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  emergencyDescription: {
    fontSize: 13,
    color: "#FFFFFF",
    opacity: 0.9,
    marginBottom: 3,
  },
  emergencyNumber: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  loadingText: {
    fontSize: 24,
  },
  processingContainer: {
    padding: 16,
    marginHorizontal: 16,
    backgroundColor: "#FFEBEE",
    borderRadius: 16,
    marginBottom: 8,
  },
  processingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#C62828",
    textAlign: "center",
    marginBottom: 12,
  },
  processingSteps: {
    paddingLeft: 8,
  },
  processingStep: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 6,
  },
  modalFooter: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
  },
  footerText: {
    fontSize: 12,
    color: "#757575",
    textAlign: "center",
    lineHeight: 18,
  },
});

export default Home;
