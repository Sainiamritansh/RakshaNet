import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, Vibration
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../services/firebase';
import { collection, getDocs } from 'firebase/firestore';
import socket from '../services/socket';

const CONTACTS_KEY = '@emergency_contacts';

export default function SOSScreen({ navigation }) {
  const [isRecording, setIsRecording] = useState(false);
  const [sirenSound, setSirenSound] = useState(null);
  const [status, setStatus] = useState('🚨 Activating Emergency...');
  const [done, setDone] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  useEffect(() => {
    // Vibrate on open
    Vibration.vibrate([500, 300, 500, 300, 500]);

    // Auto trigger everything immediately
    triggerFullEmergency();

    return () => {
      stopSiren();
    };
  }, []);

  // ─── SIREN ───────────────────────────────────────────
  const playSiren = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/eas.mp3'),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      setSirenSound(sound);
    } catch (error) {
      console.error('Siren error:', error);
    }
  };

  const stopSiren = async () => {
    if (sirenSound) {
      await sirenSound.stopAsync();
      await sirenSound.unloadAsync();
      setSirenSound(null);
    }
  };

  // ─── LOAD CONTACTS ───────────────────────────────────
  const loadContacts = async () => {
    try {
      if (db) {
        const snapshot = await getDocs(collection(db, 'emergencyContacts'));
        const contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (contacts.length > 0) return contacts;
      }
    } catch (e) {}
    const saved = await AsyncStorage.getItem(CONTACTS_KEY);
    return saved ? JSON.parse(saved) : [];
  };

  // ─── MAIN EMERGENCY TRIGGER ──────────────────────────
  const triggerFullEmergency = async () => {
    try {
      // 1. Play siren immediately
      setStatus('🔊 Playing siren...');
      await playSiren();

      // 2. Start camera recording
      setStatus('📹 Starting video recording...');
      if (permission?.granted && cameraRef.current) {
        cameraRef.current.recordAsync({ maxDuration: 60 }).then((video) => {
          console.log('Video recorded:', video?.uri);
        });
        setIsRecording(true);
      }

      // 3. Get location
      setStatus('📍 Getting your location...');
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        setStatus('❌ Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;

      // 4. Get battery
      setStatus('🔋 Checking battery...');
      const batteryLevel = await Battery.getBatteryLevelAsync();
      const battery = Math.round(batteryLevel * 100);

      // 5. Get network
      setStatus('📶 Checking network...');
      const network = await Network.getNetworkStateAsync();

      // 6. Load contacts
      setStatus('📞 Loading emergency contacts...');
      const contacts = await loadContacts();

      // 7. Build SMS message
      const message = `🚨 EMERGENCY ALERT - IMMEDIATE HELP NEEDED 🚨

Category: ⚠️ EMERGENCY IMP HELP
Location: https://maps.google.com/?q=${latitude},${longitude}
Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
Battery: ${battery}%
Network: ${network.type}
Time: ${new Date().toLocaleString()}

Triggered via Volume Shortcut. This person needs IMMEDIATE help!`;

      // 8. Send SMS
      setStatus('📱 Sending emergency SMS...');
      if (contacts.length > 0) {
        const phones = contacts
          .map(c => c.phone || c.phoneNumber)
          .filter(Boolean)
          .join(';');

        const url = `sms:${phones}?body=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) await Linking.openURL(url);
      } else {
        setStatus('⚠️ No contacts found - add in Contacts tab');
      }

      // 9. Broadcast via Socket
      setStatus('📡 Broadcasting distress signal...');
      socket.emit('send_distress', {
        type: 'EMERGENCY IMP HELP',
        message: 'IMMEDIATE HELP NEEDED - Volume shortcut triggered!',
        lat: latitude,
        lon: longitude,
        battery: battery,
        network: network.type,
        timestamp: new Date().toISOString(),
      });

      // Done!
      setStatus('✅ Emergency Alert Sent!');
      setDone(true);

    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
      console.error('Emergency error:', error);
    }
  };

  // ─── MANUAL STOP ─────────────────────────────────────
  const handleStopSOS = async () => {
    await stopSiren();

    if (isRecording && cameraRef.current) {
      await cameraRef.current.stopRecording();
      setIsRecording(false);
    }

    navigation.goBack();
  };

  // ─── UI ──────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Hidden Camera for recording */}
      {permission?.granted && (
        <CameraView
          ref={cameraRef}
          style={styles.hiddenCamera}
          facing="back"
          mode="video"
        />
      )}

      {/* Title */}
      <Text style={styles.title}>🚨 EMERGENCY SOS</Text>
      <Text style={styles.category}>⚠️ EMERGENCY IMP HELP</Text>

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>● Recording Video</Text>
        </View>
      )}

      {/* Status Box */}
      <View style={styles.statusBox}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {/* Success Box */}
      {done && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>
            ✅ Contacts notified!{'\n'}
            📹 Video recording in progress{'\n'}
            🔊 Siren playing
          </Text>
        </View>
      )}

      {/* Stop Button */}
      <TouchableOpacity style={styles.stopButton} onPress={handleStopSOS}>
        <Text style={styles.stopText}>⛔ STOP SOS</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Volume Up x3 triggered this alert</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7F1D1D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  category: {
    fontSize: 20,
    color: '#FCA5A5',
    fontWeight: '600',
    marginBottom: 30,
    textAlign: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF0000',
    marginRight: 8,
  },
  recordingText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusBox: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    marginBottom: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 28,
  },
  successBox: {
    backgroundColor: '#065F46',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    marginBottom: 20,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 28,
  },
  stopButton: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 50,
    paddingVertical: 16,
    borderRadius: 50,
    marginTop: 10,
    elevation: 5,
  },
  stopText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    color: '#FCA5A5',
    fontSize: 13,
  },
});