import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING, SHADOWS } from '../src/theme';

const { width, height } = Dimensions.get('window');

export default function LocationPage() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [sosActive, setSosActive] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [accuracy, setAccuracy] = useState(null);
  const [address, setAddress] = useState(null);
  const mapRef = useRef(null);

  // Demo contacts to share with
  const shareContacts = [
    { id: 1, name: 'Priya', initials: 'PS', color: '#E91E63' },
    { id: 2, name: 'Arjun', initials: 'AK', color: '#1E88E5' },
    { id: 3, name: 'Ananya', initials: 'AN', color: '#43A047' },
  ];

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
        async (loc) => {
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setLocation(coords);
          setSpeed(loc.coords.speed ?? 0);
          setAccuracy(loc.coords.accuracy ?? null);

          // Try to reverse geocode
          try {
            const [addr] = await Location.reverseGeocodeAsync(coords);
            if (addr) {
              setAddress(addr.name || addr.street || addr.city || 'Current Location');
            }
          } catch (e) {
            // Geocoding might fail — that's ok
          }

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

  const handleShareLocation = () => {
    if (!location) return;
    Alert.alert(
      '📍 Location Shared',
      `Your live location has been shared!\n\nLat: ${location.latitude.toFixed(5)}\nLng: ${location.longitude.toFixed(5)}`,
      [{ text: 'OK' }]
    );
  };

  if (errorMsg) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWarm} />
        <View style={styles.errorIconBg}>
          <Ionicons name="location-outline" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <Text style={styles.errorHint}>Please enable location in Settings</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWarm} />
        <View style={styles.loadingPulse}>
          <Ionicons name="navigate" size={36} color={COLORS.accent} />
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
        customMapStyle={mapStyle}
      >
        <Marker
          coordinate={location}
          title="You are here"
          pinColor={COLORS.info}
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
      </MapView>

      {/* Top Bar — Green tinted */}
      <View style={styles.topBar}>
        <LinearGradient
          colors={['rgba(230, 245, 230, 0.95)', 'rgba(230, 245, 230, 0.92)']}
          style={styles.topBarGradient}
        >
          <TouchableOpacity style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Share your location</Text>
          <View style={styles.topBarAvatar}>
            <Ionicons name="person" size={18} color={COLORS.accent} />
          </View>
        </LinearGradient>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Drag handle */}
        <View style={styles.sheetHandle} />

        {/* Location Info */}
        <Text style={styles.locationName}>
          {address || 'Current Location'}
        </Text>
        <Text style={styles.locationCoords}>
          {location.latitude.toFixed(4)}° N, {location.longitude.toFixed(4)}° E
        </Text>

        {/* Share With Section */}
        <Text style={styles.shareLabel}>SHARE WITH</Text>
        <View style={styles.shareRow}>
          {shareContacts.map((contact) => (
            <View key={contact.id} style={styles.shareContact}>
              <View style={[styles.shareAvatar, { backgroundColor: contact.color }]}>
                <Text style={styles.shareInitials}>{contact.initials}</Text>
              </View>
              <Text style={styles.shareName}>{contact.name}</Text>
            </View>
          ))}
          <View style={styles.shareContact}>
            <TouchableOpacity style={styles.shareAddBtn}>
              <Ionicons name="add" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
            <Text style={styles.shareName}>More</Text>
          </View>
        </View>

        {/* Share CTA */}
        <TouchableOpacity style={styles.shareCTA} onPress={handleShareLocation} activeOpacity={0.85}>
          <Ionicons name="navigate-circle" size={22} color={COLORS.textPrimary} />
          <Text style={styles.shareCTAText}>Share Live Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Subtle map style — lighter tones
const mapStyle = [
  { elementType: 'geometry', stylers: [{ saturation: -30 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { featureType: 'water', stylers: [{ color: '#c9e8d0' }] },
];

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
    backgroundColor: COLORS.bgWarm,
    paddingHorizontal: 40,
  },
  loadingPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  errorIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.primary,
    marginTop: 8,
  },
  errorHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 6,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    flex: 1,
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.textDark,
    marginLeft: SPACING.sm,
  },
  topBarAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.bgLight,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: 36,
    ...SHADOWS.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.divider,
    alignSelf: 'center',
    marginBottom: SPACING.xl,
  },
  locationName: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  locationCoords: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  shareLabel: {
    ...TYPOGRAPHY.overline,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  shareContact: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  shareAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  shareName: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  shareAddBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgWarm,
  },
  shareCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  shareCTAText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
});