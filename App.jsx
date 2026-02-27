import React, { useEffect, useState, useRef, useCallback } from "react";
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
import { useVolumeShortcut } from "./services/useVolumeShortcut"; 
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
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === "Home") iconName = "home-outline";
          else if (route.name === "Location") iconName = "location-outline";
          else if (route.name === "Info") iconName = "cloud-outline";
          else if (route.name === "Contacts") iconName = "people-outline";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "tomato",
        tabBarInactiveTintColor: "gray",
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
    </Tab.Navigator>
  );
}

export default function App() {
  const [location, setLocation] = useState({ lon: 0, lat: 0 });
  const soundRef = useRef(null);

  useEffect(() => {
    getCoord();
    requestNotificationPermissions();

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