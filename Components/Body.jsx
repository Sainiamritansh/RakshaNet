import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import React, { useState, useEffect, useRef } from 'react';
import { Camera } from 'expo-camera';
import * as LocalAuthentication from 'expo-local-authentication';
import circle from "../assets/sos.png";
import * as Font from "expo-font";
import { Audio } from 'expo-av';
import audio from "../assets/eas.mp3";
import { useNavigation } from '@react-navigation/native';
import * as Battery from "expo-battery";
import * as Network from "expo-network";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import AsyncStorage from '@react-native-async-storage/async-storage';
import SOSVideoRecorder from "../services/SOSVideoRecorder";

const CONTACTS_KEY = '@emergency_contacts';

const Body = ({ handleChange }) => {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [sound, setSound] = useState(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const cameraRef = useRef(null);
  const navigation = useNavigation();

  useEffect(() => {
    async function loadFonts() {
      await Font.loadAsync({
        "Poppins": require("../assets/fonts/Poppins-Regular.ttf"),
        "Kanit": require("../assets/fonts/Kanit-Bold.ttf"),
      });
      setFontsLoaded(true);
    }

    async function checkPermissions() {
      const hasPerms = await SOSVideoRecorder.hasPermissions();
      if (!hasPerms) {
        const granted = await SOSVideoRecorder.requestPermissions();
        setHasPermissions(granted);
      } else {
        setHasPermissions(true);
      }
    }

    loadFonts();
    checkPermissions();
  }, []);

  const playSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(audio, {
        isLooping: true, // Loop the siren continuously
        volume: 1.0,
      });
      setSound(sound);
      await sound.playAsync();
    } catch (error) {
      console.log(error);
    }
  };

  const stopSound = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
    }
  };

  const getSOSDetails = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Location permission not granted");
    }

    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;

    const batteryLevel = await Battery.getBatteryLevelAsync();
    const batteryPercent = Math.round(batteryLevel * 100);

    const networkState = await Network.getNetworkStateAsync();

    return {
      latitude,
      longitude,
      batteryPercent,
      networkType: networkState.type,
      isConnected: networkState.isConnected,
    };
  };

  const createSOSMessage = (data) => {
    return `
🚨 RAKSHANET SOS 🚨

📍 Location:
https://maps.google.com/?q=${data.latitude},${data.longitude}

🔋 Battery: ${data.batteryPercent}%
📶 Network: ${data.networkType}

⏰ ${new Date().toLocaleString()}

📹 Emergency video recording started
`;
  };

  const sendSOS = async () => {
    try {
      const data = await getSOSDetails();
      const message = createSOSMessage(data);

      // Get saved emergency contacts
      const savedContacts = await AsyncStorage.getItem(CONTACTS_KEY);
      
      if (!savedContacts) {
        Alert.alert(
          'No Emergency Contacts',
          'Please add emergency contacts first',
          [{ text: 'OK' }]
        );
        return;
      }

      const contacts = JSON.parse(savedContacts);
      
      if (contacts.length === 0) {
        Alert.alert(
          'No Emergency Contacts',
          'Please add emergency contacts first',
          [{ text: 'OK' }]
        );
        return;
      }

      // Send SMS to all contacts
      for (const contact of contacts) {
        const url = `sms:${contact.phone}?body=${encodeURIComponent(message)}`;
        const supported = await Linking.canOpenURL(url);
        
        if (supported) {
          await Linking.openURL(url);
          // Small delay between opening multiple SMS
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`SOS sent to ${contacts.length} contact(s)`);
    } catch (err) {
      console.log("SOS failed:", err.message);
      Alert.alert('Error', 'Failed to send SOS messages');
    }
  };

  // 🎥 START VIDEO RECORDING
  const startVideoRecording = async () => {
    if (!hasPermissions) {
      Alert.alert("Permissions Required", "Camera permissions needed for video recording");
      return;
    }

    try {
      SOSVideoRecorder.setCameraRef(cameraRef.current);
      await SOSVideoRecorder.startRecording();
      setIsRecording(true);
      console.log("📹 Video recording started - will continue until authentication");
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  // 🛑 STOP VIDEO RECORDING
  const stopVideoRecording = async () => {
    try {
      const video = await SOSVideoRecorder.stopRecording();
      setIsRecording(false);

      if (video && video.uri) {
        // Save video to device
        const savedUri = await SOSVideoRecorder.saveVideoToDevice(video.uri);
        console.log("✅ Video saved:", savedUri);
        Alert.alert("Emergency Ended", "Video has been saved to your device");
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  // 🔐 AUTHENTICATE TO STOP SOS
  const authenticateToStop = async () => {
    try {
      // Check if device supports biometric authentication
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          "Stop Emergency Mode",
          "Authenticate to stop SOS",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Stop SOS", onPress: stopSOSMode }
          ]
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to stop emergency mode",
        fallbackLabel: "Use Passcode",
        disableDeviceFallback: false,
      });

      if (result.success) {
        await stopSOSMode();
      } else {
        Alert.alert("Authentication Failed", "Please try again to stop SOS mode");
      }
    } catch (error) {
      console.error("Authentication error:", error);
    }
  };

  // 🛑 STOP SOS MODE
  const stopSOSMode = async () => {
    setSosActive(false);
    handleChange(false);
    await stopSound();
    await stopVideoRecording();
    Alert.alert("Emergency Mode Deactivated", "You are now safe");
    navigation.navigate('Location');
  };

  // 🚨 MAIN SOS HANDLER
  const handleSOSPress = async () => {
    if (sosActive) {
      // If SOS is already active, authenticate to stop it
      await authenticateToStop();
      return;
    }

    try {
      setSosActive(true);

      // Start siren (looping)
      playSound();
      
      // Start video recording
      await startVideoRecording();
      
      // Activate SOS state
      handleChange(true);

      // Send WhatsApp SOS
      await sendSOS();

      // Show alert with authentication option
      Alert.alert(
        "🚨 EMERGENCY MODE ACTIVE",
        "Siren is playing and video is recording.\n\nAuthenticate to stop emergency mode.",
        [
          {
            text: "Stop Emergency",
            onPress: authenticateToStop,
            style: "destructive"
          }
        ],
        { cancelable: false }
      );

    } catch (error) {
      console.error("SOS activation failed:", error);
      Alert.alert("Error", "Failed to activate SOS");
      setSosActive(false);
    }
  };

  if (!fontsLoaded) {
    return <ActivityIndicator size="large" style={s.loader} />;
  }

  return (
    <View style={s.container}>
      {/* Hidden Camera for Recording */}
      {hasPermissions && (
        <Camera
          ref={cameraRef}
          style={s.camera}
          type={Camera.Constants.Type.back}
        />
      )}

      <View style={s.c1}>
        <View style={s.r1}>
          <Text style={s.title}>
            {sosActive ? "🚨 EMERGENCY MODE ACTIVE" : "Are you in an Emergency?"}
          </Text>
          <Text style={s.desc}>
            {sosActive 
              ? "Authenticate with FaceID/Fingerprint to stop" 
              : "Press the SOS button we are here to help you!"}
          </Text>
          
          {isRecording && (
            <View style={s.recordingIndicator}>
              <View style={s.recordingDot} />
              <Text style={s.recordingText}>Recording...</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.c2}>
        <TouchableOpacity
          style={[s.btn, sosActive && s.btnActive]}
          onPress={handleSOSPress}
        >
          <Image 
            source={circle} 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
          />
        </TouchableOpacity>
        
        {sosActive && (
          <Text style={s.stopText}>Tap to Stop Emergency</Text>
        )}
      </View>
    </View>
  );
};

export default Body;

const s = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  camera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  c1: {
    width: "100%",
    height: '30%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  c2: {
    width: "100%",
    height: '70%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  r1: {
    width: "100%",
    height: '100%',
    justifyContent: 'center',
    backgroundColor: 'rgba(215, 210, 210, 0.97)',
    borderRadius: 20,
    padding: 20
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    fontFamily: 'Kanit'
  },
  desc: {
    fontSize: 16,
    fontFamily: 'Poppins'
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff0000',
    marginRight: 6,
  },
  recordingText: {
    color: '#ff0000',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Poppins',
  },
  btn: {
    width: "100%",
    height: "100%",
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnActive: {
    opacity: 0.8,
  },
  stopText: {
    position: 'absolute',
    bottom: 50,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff0000',
    fontFamily: 'Kanit',
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});