import React, { useEffect, useState, useRef, useCallback } from "react";
import { checkSOSIntent } from "./services/SOSBackgroundService";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { setNotificationHandler } from "expo-notifications";
import { requestNotificationPermissions, showNotification } from "./services/Notification";
import { requestForegroundPermissionsAsync, getCurrentPositionAsync } from "expo-location";
import socket from "./services/socket";
import Home from "./Pages/Home";
import Location from "./Pages/Location";
import Weather from "./Pages/Weather";
import EmergencyContacts from "./Pages/EmergencyContacts";
import SOSScreen from "./Pages/SOSScreen";
import SplashScreen from "./Pages/SplashScreen";
import SpamShield from "./Pages/SpamShield";
import ScamScanner from "./Pages/ScamScanner";
import { useVolumeShortcut } from "./services/useVolumeShortcut";
import { startMonitoring, isShieldActive } from "./services/SMSMonitor";
import audio from "./assets/eas.mp3";
import { MarkersProvider } from "./context/MarkersContext";
import { auth, db } from "./services/firebase";

console.log("Firebase Auth:", auth);
console.log("Firestore DB:", db);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator(); // ✅ NEW

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ✅ NEW — Bottom tabs wrapped so we can attach volume shortcut + navigation
function MainTabs({ location }) {
  const navigation = useNavigation();

  // 🔴 Volume DOWN x3 → SOS Screen opens instantly
  useVolumeShortcut(
    useCallback(() => {
      navigation.navigate("SOS");
    }, [navigation])
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "Home") iconName = focused ? "shield-checkmark" : "shield-checkmark-outline";
          else if (route.name === "Location") iconName = focused ? "navigate" : "navigate-outline";
          else if (route.name === "Info") iconName = focused ? "cloudy" : "cloudy-outline";
          else if (route.name === "Contacts") iconName = focused ? "people" : "people-outline";
          else if (route.name === "Scanner") iconName = focused ? "search-circle" : "search-circle-outline";
          else if (route.name === "Shield") iconName = focused ? "shield" : "shield-half-outline";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#E53935",
        tabBarInactiveTintColor: "#9E9E9E",
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Home" component={Home} initialParams={location} />
      <Tab.Screen name="Location" component={Location} />
      <Tab.Screen name="Info" component={Weather} initialParams={location} />
      <Tab.Screen
        name="Contacts"
        component={EmergencyContacts}
        options={{ tabBarLabel: "Emergency" }}
      />
      <Tab.Screen
        name="Scanner"
        component={ScamScanner}
        options={{ tabBarLabel: "Scanner" }}
      />
      <Tab.Screen
        name="Shield"
        component={SpamShield}
        options={{ tabBarLabel: "Spam" }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [location, setLocation] = useState({ lon: 0, lat: 0 });
  const soundRef = useRef(null);
  const navigationRef = useRef(null);
  const [sosTriggered, setSOSTriggered] = useState(false);

  useEffect(() => {
    // Check if launched via background SOS shortcut
    checkSOSIntent().then((triggered) => {
      if (triggered) {
        console.log('🚨 App launched via SOS shortcut!');
        setSOSTriggered(true);
      }
    });

    getCoord();
    requestNotificationPermissions();

    // Auto-start SMS Shield if previously active
    isShieldActive().then((active) => {
      if (active) {
        startMonitoring((record) => {
          console.log('Spam detected:', record.sender);
        });
      }
    });

    const handleDistressSignal = async (data) => {
      console.log(data);
      try {
        const { sound } = await Audio.Sound.createAsync(audio);
        soundRef.current = sound;
        await sound.playAsync();
      } catch (error) {
        console.error("Error playing audio:", error);
      }

      const message = `Distress signal received: ${data.message}. Location: ${data.lat}, ${data.lon}`;
      showNotification("Time to be a hero", message);
    };

    socket.on("receive_distress", handleDistressSignal);

    return () => {
      socket.off("receive_distress", handleDistressSignal);
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  async function getCoord() {
    const { status } = await requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await getCurrentPositionAsync();
      setLocation({ lon: loc.coords.longitude, lat: loc.coords.latitude });
      console.log("Successfully got location");
    } else {
      setLocation({ lon: 0, lat: 0 });
      console.log("Location permission denied");
    }
  }

  return (
    <MarkersProvider>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          // If SOS was triggered from background, navigate to SOS screen
          if (sosTriggered) {
            navigationRef.current?.navigate('SOS');
            setSOSTriggered(false);
          }
        }}
        linking={{
          prefixes: ["panic://"],
          config: {
            screens: {
              Home: "home",
              Location: "location",
              Info: "info",
              Contacts: "contacts",
            },
          },
        }}
      >
        {/* ✅ Stack wraps tabs so SOS can appear on top of everything */}
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="Splash"
            component={SplashScreen}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen name="Main">
            {() => <MainTabs location={location} />}
          </Stack.Screen>

          {/* ✅ SOS Screen — opens fullscreen when volume pressed 3x */}
          <Stack.Screen
            name="SOS"
            component={SOSScreen}
            options={{
              animation: "fade",
              presentation: "fullScreenModal",
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </MarkersProvider>
  );
}