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
import { triggerSOSSiren } from "../services/SOSSirenService";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Battery from "expo-battery";
import * as Network from "expo-network";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import socket from "../services/socket";
import { db } from "../services/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  syncContactsToNative,
  openAccessibilitySettings,
  isSOSServiceEnabled,
} from "../services/SOSBackgroundService";
import { COLORS, TYPOGRAPHY, RADIUS, SPACING, SHADOWS } from "../src/theme";

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
  const [showMoreTypes, setShowMoreTypes] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0.8)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  // Core 4 emergency types (shown prominently)
  const coreEmergencyTypes = [
    {
      id: 1,
      name: "Medical",
      icon: "medkit",
      color: COLORS.primary,
      number: "108",
      description: "Ambulance, injuries, and medical help",
    },
    {
      id: 2,
      name: "Police",
      icon: "shield",
      color: COLORS.primary,
      number: "100",
      description: "Safety threats, suspicious activity",
    },
    {
      id: 3,
      name: "Fire",
      icon: "flame",
      color: COLORS.primary,
      number: "101",
      description: "Fire hazards, gas leaks, chemical spills",
    },
    {
      id: 4,
      name: "Disaster",
      icon: "thunderstorm",
      color: COLORS.primary,
      number: "112",
      description: "Floods, earthquakes or large-scale emergencies",
    },
  ];

  // Additional types (collapsible)
  const extraEmergencyTypes = [
    {
      id: 5,
      name: "Road Accident",
      icon: "car",
      color: COLORS.primary,
      number: "108",
      description: "Accident Emergency",
    },
    {
      id: 6,
      name: "Cyber SOS",
      icon: "phone-portrait",
      color: COLORS.primary,
      number: "1930",
      description: "Cyber Crime Helpline",
    },
    {
      id: 7,
      name: "UPI Fraud",
      icon: "card",
      color: COLORS.primary,
      number: "1930",
      description: "Report Online & UPI Fraud",
    },
  ];

  const allEmergencyTypes = [...coreEmergencyTypes, ...extraEmergencyTypes];

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
      ]),
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
      ]),
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
          console.warn(
            "⚠️ Firebase failed, trying AsyncStorage:",
            firebaseError.message,
          );
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

  const sendEmergencySMS = async (
    location,
    battery,
    network,
    emergencyType,
  ) => {
    if (emergencyContacts.length === 0) {
      Alert.alert(
        "⚠️ No Contacts",
        "No emergency contacts found. Add contacts in the Contacts tab.",
      );
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

  const broadcastDistressSignal = (
    location,
    battery,
    network,
    emergencyType,
  ) => {
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
      Alert.alert(
        "Permission Required",
        "Location permission is required for emergency alerts",
      );
      return;
    }
    if (!permissions.call) {
      Alert.alert(
        "Permission Required",
        "Phone call permission is required to call emergency services",
      );
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
      const smsResult = await sendEmergencySMS(
        location,
        battery,
        network,
        emergency.name,
      );
      broadcastDistressSignal(location, battery, network, emergency.name);

      // 🚨 Trigger siren on emergency contacts' devices
      const contactPhones = emergencyContacts
        .map((c) => c.phone || c.phoneNumber)
        .filter(Boolean);
      const locationString = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
      await triggerSOSSiren(
        "RakshaNet User",
        "SOS",
        locationString,
        contactPhones,
      );

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
        ],
      );
    }
  };

  const closeModal = () => {
    if (!isProcessing) {
      setShowModal(false);
      setSelectedEmergency(null);
      setShowMoreTypes(false);
    }
  };

  const getContactColor = (index) => {
    const colors = [
      COLORS.primary,
      COLORS.info,
      COLORS.successDark,
      COLORS.warning,
      "#8E24AA",
      "#00ACC1",
    ];
    return colors[index % colors.length];
  };

  const renderEmergencyRow = (emergency) => (
    <TouchableOpacity
      key={emergency.id}
      style={[
        styles.emergencyRow,
        isProcessing && styles.disabledOption,
      ]}
      onPress={() => handleEmergencySelect(emergency)}
      disabled={isProcessing}
      activeOpacity={0.7}
    >
      <View style={styles.emergencyIconCircle}>
        <Ionicons name={emergency.icon} size={22} color={COLORS.primary} />
      </View>
      <View style={styles.emergencyInfo}>
        <Text style={styles.emergencyName}>{emergency.name}</Text>
        <Text style={styles.emergencyDescription}>
          {emergency.description}
        </Text>
      </View>
      {selectedEmergency?.id === emergency.id && isProcessing ? (
        <View style={styles.processingBadge}>
          <Text style={styles.processingBadgeText}>Sending...</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.callNowBtn}
          onPress={() => handleEmergencySelect(emergency)}
          disabled={isProcessing}
        >
          <Text style={styles.callNowText}>CALL{'\n'}{emergency.number}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Red Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.appName}>RakshaNet</Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.headerIconBtn}>
                <Ionicons name="notifications-outline" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIconBtn}>
                <Ionicons name="settings-outline" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={COLORS.textMuted} />
            <Text style={styles.searchPlaceholder}>Search...</Text>
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

          <Text style={styles.sosLabel}>Help Secure</Text>
          <Text style={styles.sosHint}>Tap for immediate emergency assistance</Text>
        </View>

        {/* Safety Contacts Section */}
        <View style={styles.contactsSection}>
          <View style={styles.contactsHeader}>
            <Text style={styles.sectionTitle}>Safety Contacts</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Contacts")}>
              <Ionicons name="add-circle" size={28} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {emergencyContacts.length === 0 ? (
            <View style={styles.emptyContacts}>
              <Ionicons name="people-outline" size={48} color={COLORS.textMutedLight} />
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
                  <Text style={styles.contactRelation}>
                    {contact.relationship || "Emergency Contact"}
                  </Text>
                </View>
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.contactActionBtn}
                    onPress={() =>
                      Linking.openURL(
                        `tel:${contact.phone || contact.phoneNumber}`,
                      )
                    }
                  >
                    <Ionicons name="call" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contactActionBtn}
                    onPress={() =>
                      Linking.openURL(
                        `sms:${contact.phone || contact.phoneNumber}`,
                      )
                    }
                  >
                    <Ionicons name="chatbubble" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contactActionBtn}
                    onPress={() => navigation.navigate("Location")}
                  >
                    <Ionicons name="location" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Volume Shortcut Card — Dark */}
        <TouchableOpacity
          style={[
            styles.volumeCard,
            sosServiceEnabled && styles.volumeCardActive,
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
                      await syncContactsToNative(emergencyContacts);
                      await openAccessibilitySettings();
                    },
                  },
                ],
              );
            } else {
              await syncContactsToNative(emergencyContacts);
              Alert.alert(
                "✅ Active",
                "Background SOS is enabled. Volume Up ×3 will trigger emergency alert from anywhere.",
              );
            }
          }}
          activeOpacity={0.8}
        >
          <View style={styles.volumeCardContent}>
            <View style={styles.volumeIconRow}>
              <View style={styles.volumeIcon}>
                <Ionicons
                  name={sosServiceEnabled ? "shield-checkmark" : "volume-high"}
                  size={24}
                  color={sosServiceEnabled ? COLORS.success : COLORS.textPrimary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.volumeTitle}>
                  {sosServiceEnabled
                    ? "Volume Shortcut Active"
                    : "Volume Shortcut"}
                </Text>
                <Text style={styles.volumeSubtitle}>
                  {sosServiceEnabled
                    ? "Press Volume Up ×3 to trigger SOS from anywhere"
                    : "Enable to trigger SOS from anywhere"}
                </Text>
              </View>
            </View>
            <View style={styles.volumeFooterIcons}>
              <Ionicons name="volume-high" size={18} color="rgba(255,255,255,0.4)" />
              <Ionicons name="call" size={18} color="rgba(255,255,255,0.4)" />
              <Ionicons name="location" size={18} color="rgba(255,255,255,0.4)" />
              <Ionicons name="people" size={18} color="rgba(255,255,255,0.4)" />
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Emergency Selection Modal — Step 3 */}
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
              <View style={styles.modalHeaderInner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>What is your emergency?</Text>
                  <Text style={styles.modalSubtitle}>
                    Tap the category that best fits your situation to quickly connect with help.
                  </Text>
                </View>
                {!isProcessing && (
                  <TouchableOpacity
                    onPress={closeModal}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Core 4 Emergency Options */}
            <ScrollView style={styles.optionsContainer}>
              {coreEmergencyTypes.map(renderEmergencyRow)}

              {/* More options toggle */}
              <TouchableOpacity
                style={styles.showMoreBtn}
                onPress={() => setShowMoreTypes(!showMoreTypes)}
              >
                <Text style={styles.showMoreText}>
                  {showMoreTypes ? "Show less" : "More emergency types"}
                </Text>
                <Ionicons
                  name={showMoreTypes ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>

              {showMoreTypes && extraEmergencyTypes.map(renderEmergencyRow)}
            </ScrollView>

            {/* Processing State */}
            {isProcessing && (
              <View style={styles.processingContainer}>
                <Text style={styles.processingTitle}>
                  ⏳ Sending emergency alert...
                </Text>
                <View style={styles.processingSteps}>
                  <Text style={styles.processingStep}>
                    📍 Getting your location...
                  </Text>
                  <Text style={styles.processingStep}>
                    🔋 Checking battery level...
                  </Text>
                  <Text style={styles.processingStep}>
                    📶 Checking network status...
                  </Text>
                  <Text style={styles.processingStep}>
                    📱 Notifying emergency contacts...
                  </Text>
                  <Text style={styles.processingStep}>
                    📡 Broadcasting to nearby users...
                  </Text>
                  <Text style={styles.processingStep}>
                    📞 Preparing to call...
                  </Text>
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
    backgroundColor: COLORS.bgLight,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // ── Header ──
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: SPACING.xxl,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  appName: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
  },
  headerIcons: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.circle,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  searchPlaceholder: {
    ...TYPOGRAPHY.body,
    color: "rgba(255,255,255,0.6)",
  },

  // ── SOS Section ──
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
    borderColor: COLORS.primary,
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
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.glow,
  },
  sosText: {
    ...TYPOGRAPHY.hero,
    color: COLORS.textPrimary,
  },
  sosLabel: {
    marginTop: 16,
    ...TYPOGRAPHY.h3,
    color: COLORS.textDark,
  },
  sosHint: {
    marginTop: 6,
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },

  // ── Safety Contacts ──
  contactsSection: {
    marginHorizontal: SPACING.xl,
    marginTop: 10,
    backgroundColor: COLORS.bgLight,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.md,
  },
  contactsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textDark,
  },
  emptyContacts: {
    alignItems: "center",
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    marginTop: 10,
  },
  addContactBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
  },
  addContactText: {
    color: COLORS.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
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
    color: COLORS.textPrimary,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 14,
  },
  contactName: {
    ...TYPOGRAPHY.body,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  contactRelation: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  contactActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  contactActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryBg,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Volume Shortcut Card ──
  volumeCard: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgDarkCard,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  volumeCardActive: {
    backgroundColor: COLORS.bgDarkElevated,
  },
  volumeCardContent: {
    padding: SPACING.xl,
  },
  volumeIconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  volumeIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.xxl,
    backgroundColor: "rgba(229, 57, 53, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  volumeTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  volumeSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  volumeFooterIcons: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.bgLight,
    borderTopLeftRadius: RADIUS.xxl + 4,
    borderTopRightRadius: RADIUS.xxl + 4,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  modalHeader: {
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.lg,
  },
  modalHeaderInner: {
    backgroundColor: COLORS.primary,
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
    opacity: 0.9,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: SPACING.md,
  },

  // Emergency Rows
  optionsContainer: {
    padding: SPACING.lg,
    maxHeight: 420,
  },
  emergencyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.bgLight,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  disabledOption: {
    opacity: 0.6,
  },
  emergencyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.xxl,
    backgroundColor: COLORS.primaryBg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  emergencyInfo: {
    flex: 1,
  },
  emergencyName: {
    ...TYPOGRAPHY.body,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  emergencyDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  callNowBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    minWidth: 60,
  },
  callNowText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 14,
  },
  processingBadge: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  processingBadgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  showMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  showMoreText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },

  processingContainer: {
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.primaryBg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  processingTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: "600",
    color: COLORS.primaryDark,
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  processingSteps: {
    paddingLeft: SPACING.sm,
  },
  processingStep: {
    ...TYPOGRAPHY.caption,
    color: "#4B5563",
    marginBottom: 6,
  },
  modalFooter: {
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.bgLightGrey,
    borderRadius: RADIUS.md,
  },
  footerText: {
    ...TYPOGRAPHY.small,
    color: "#757575",
    textAlign: "center",
    lineHeight: 18,
  },
});

export default Home;
