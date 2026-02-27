import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';

export default function LocationPage() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [sosActive, setSosActive] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [accuracy, setAccuracy] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let subscriber;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied');
        return;
      }

      subscriber = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (loc) => {
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setLocation(coords);
          setSpeed(loc.coords.speed ?? 0);
          setAccuracy(loc.coords.accuracy ?? null);

          // Auto move map to new location
          mapRef.current?.animateToRegion({
            ...coords,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      );
    })();

    return () => subscriber?.remove();
  }, []);

  const handleSOS = () => {
    setSosActive(true);
    Alert.alert(
      '🆘 SOS Activated!',
      `Your live location has been shared!\n\nLat: ${location?.latitude.toFixed(5)}\nLng: ${location?.longitude.toFixed(5)}`,
      [{ text: 'OK', onPress: () => setSosActive(false) }]
    );
  };

  if (errorMsg) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>❌ {errorMsg}</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>📍 Fetching your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Main Marker */}
        <Marker
          coordinate={location}
          title="You are here"
          pinColor={sosActive ? 'red' : '#1D4ED8'}
        />

        {/* Accuracy Circle */}
        {accuracy && (
          <Circle
            center={location}
            radius={accuracy}
            fillColor="rgba(29, 78, 216, 0.1)"
            strokeColor="rgba(29, 78, 216, 0.4)"
            strokeWidth={1}
          />
        )}

        {/* SOS Red Circle */}
        {sosActive && (
          <Circle
            center={location}
            radius={200}
            fillColor="rgba(220, 38, 38, 0.2)"
            strokeColor="rgba(220, 38, 38, 0.8)"
            strokeWidth={2}
          />
        )}
      </MapView>

      {/* Info Card on Top */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>📍 Live Location</Text>
        <Text style={styles.infoText}>Lat: {location.latitude.toFixed(6)}</Text>
        <Text style={styles.infoText}>Lng: {location.longitude.toFixed(6)}</Text>
        <Text style={styles.infoText}>
          ⚡ Speed: {(speed * 3.6).toFixed(1)} km/h
        </Text>
        {accuracy && (
          <Text style={styles.infoText}>
            🎯 Accuracy: ±{accuracy.toFixed(0)}m
          </Text>
        )}
      </View>

      {/* SOS Button */}
      <TouchableOpacity
        style={[styles.sosButton, sosActive && styles.sosActive]}
        onPress={handleSOS}
        activeOpacity={0.8}
      >
        <Text style={styles.sosText}>
          {sosActive ? '🆘 SOS SENT!' : '🆘 SOS'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
  },
  loadingText: {
    fontSize: 18,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '600',
  },
  infoCard: {
    position: 'absolute',
    top: 50,
    left: 15,
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 12,
    borderRadius: 12,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
  },
  sosButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 50,
    paddingVertical: 16,
    borderRadius: 50,
    elevation: 6,
  },
  sosActive: {
    backgroundColor: '#7F1D1D',
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});