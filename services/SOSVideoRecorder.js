// Pages/SOSPage.js (or whatever your SOS page is called)
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Camera } from 'expo-camera';
import SOSVideoRecorder from '../services/SOSVideoRecorder';
import { Audio } from 'expo-av';

export default function SOSPage() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sirenSound, setSirenSound] = useState(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    checkAndRequestPermissions();
    
    return () => {
      // Cleanup
      if (sirenSound) {
        sirenSound.unloadAsync();
      }
    };
  }, []);

  const checkAndRequestPermissions = async () => {
    const hasPerms = await SOSVideoRecorder.hasPermissions();
    
    if (!hasPerms) {
      const granted = await SOSVideoRecorder.requestPermissions();
      setHasPermission(granted);
      
      if (!granted) {
        Alert.alert(
          'Permissions Required',
          'Camera, audio, and storage permissions are required for SOS video recording.',
          [{ text: 'OK' }]
        );
      }
    } else {
      setHasPermission(true);
    }
  };

  const playSiren = async () => {
    try {
      // Load and play your siren sound
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/siren.mp3'), // Make sure you have this file
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      setSirenSound(sound);
    } catch (error) {
      console.error('Failed to play siren:', error);
    }
  };

  const stopSiren = async () => {
    if (sirenSound) {
      await sirenSound.stopAsync();
      await sirenSound.unloadAsync();
      setSirenSound(null);
    }
  };

  const handleSOSPress = async () => {
    if (!hasPermission) {
      Alert.alert('Error', 'Permissions not granted');
      return;
    }

    try {
      // Play siren
      await playSiren();

      // Start video recording
      SOSVideoRecorder.setCameraRef(cameraRef.current);
      await SOSVideoRecorder.startRecording();
      setIsRecording(true);

      Alert.alert(
        'SOS Activated',
        'Siren playing and video recording started',
        [
          {
            text: 'Stop SOS',
            onPress: handleStopSOS,
            style: 'destructive'
          }
        ]
      );

    } catch (error) {
      console.error('SOS activation failed:', error);
      Alert.alert('Error', 'Failed to activate SOS');
    }
  };

  const handleStopSOS = async () => {
    try {
      // Stop siren
      await stopSiren();

      // Stop recording
      const video = await SOSVideoRecorder.stopRecording();
      setIsRecording(false);

      if (video) {
        // Save video to device
        await SOSVideoRecorder.saveVideoToDevice(video.uri);
        Alert.alert('Success', 'SOS stopped. Video saved to your device.');
      }

    } catch (error) {
      console.error('Failed to stop SOS:', error);
      Alert.alert('Error', 'Failed to stop SOS properly');
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting permissions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hidden camera for recording */}
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={Camera.Constants.Type.back}
      />

      <View style={styles.content}>
        <Text style={styles.title}>Raksha-Net Emergency</Text>
        
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.sosButton, isRecording && styles.sosButtonActive]}
          onPress={isRecording ? handleStopSOS : handleSOSPress}
        >
          <Text style={styles.sosButtonText}>
            {isRecording ? 'STOP SOS' : 'SOS'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.infoText}>
          Press the button to activate emergency mode
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 40,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ff0000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  sosButtonActive: {
    backgroundColor: '#ff6b6b',
  },
  sosButtonText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  infoText: {
    color: '#888',
    marginTop: 30,
    textAlign: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff0000',
    marginRight: 8,
  },
  recordingText: {
    color: '#ff0000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  text: {
    color: '#fff',
    fontSize: 18,
  },
});