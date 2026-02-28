import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

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
        <Ionicons name="location-outline" size={64} color="#E53935" />
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Text style={styles.errorHint}>Please enable location in Settings</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.centered}>
        <View style={styles.loadingPulse}>
          <Ionicons name="navigate" size={36} color="#E53935" />
        </View>
        <Text style={styles.loadingText}>Fetching your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

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
        showsMyLocationButton={false}
      >
        <Marker
          coordinate={location}
          title="You are here"
          pinColor={sosActive ? '#E53935' : '#1E88E5'}
        />

        {accuracy && (
          <Circle
            center={location}
            radius={accuracy}
            fillColor="rgba(30, 136, 229, 0.08)"
            strokeColor="rgba(30, 136, 229, 0.3)"
            strokeWidth={1}
          />
        )}

        {sosActive && (
          <Circle
            center={location}
            radius={200}
            fillColor="rgba(229, 57, 53, 0.15)"
            strokeColor="rgba(229, 57, 53, 0.6)"
            strokeWidth={2}
          />
        )}
      </MapView>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarInner}>
          <Text style={styles.topBarLabel}>Location</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="speedometer-outline" size={16} color="#757575" />
            <Text style={styles.infoValue}>{(speed * 3.6).toFixed(1)} km/h</Text>
          </View>
          {accuracy && (
            <View style={styles.infoItem}>
              <Ionicons name="radio-outline" size={16} color="#757575" />
              <Text style={styles.infoValue}>±{accuracy.toFixed(0)}m</Text>
            </View>
          )}
        </View>
        <Text style={styles.coordText}>
          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
        </Text>
      </View>

      {/* Bottom Contact Banner */}
      <View style={styles.bottomBanner}>
        <View style={styles.bannerContent}>
          <View style={styles.bannerAvatar}>
            <Ionicons name="navigate" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle}>My Location</Text>
            <Text style={styles.bannerSubtitle}>Share your live location</Text>
          </View>
          <TouchableOpacity
            style={[styles.sosButtonSmall, sosActive && styles.sosActiveSmall]}
            onPress={handleSOS}
            activeOpacity={0.8}
          >
            <Text style={styles.sosTextSmall}>
              {sosActive ? '🆘 SENT' : 'SOS'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
    backgroundColor: '#F5F6FA',
    paddingHorizontal: 40,
  },
  loadingPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#616161',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    color: '#E53935',
    fontWeight: '700',
    marginTop: 16,
  },
  errorHint: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 8,
  },
  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  topBarLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E53935',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E53935',
    marginRight: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E53935',
    letterSpacing: 1,
  },
  // Info card
  infoCard: {
    position: 'absolute',
    top: 120,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#424242',
  },
  coordText: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 6,
  },
  // Bottom banner
  bottomBanner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  bannerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E88E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerInfo: {
    flex: 1,
    marginLeft: 14,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  sosButtonSmall: {
    backgroundColor: '#E53935',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 4,
  },
  sosActiveSmall: {
    backgroundColor: '#B71C1C',
  },
  sosTextSmall: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
});