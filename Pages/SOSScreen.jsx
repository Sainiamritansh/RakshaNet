// SOSScreen.jsx
// Place this in: Pages/SOSScreen.jsx

import React, { useEffect, useRef } from 'react';
import {
    Text,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Animated,
    Vibration,
    StatusBar,
    Platform,
    View,
} from 'react-native';

export default function SOSScreen({ navigation }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
    // Vibrate on open to confirm shortcut triggered
    Vibration.vibrate([0, 200, 100, 200, 100, 200]);

    // Fade in
    Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
    }).start();

    // Pulse the SOS button
    const pulse = Animated.loop(
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])
    );
    pulse.start();

    return () => pulse.stop();
}, []);

const callEmergency = () => {
    Vibration.vibrate(300);
    Linking.openURL('tel:112');
};

const callPolice = () => Linking.openURL('tel:100');
const callAmbulance = () => Linking.openURL('tel:108');

return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
    <StatusBar barStyle="light-content" backgroundColor="#0d0000" />

      {/* Header */}
    <View style={styles.header}>
        <View style={styles.alertBadge}>
        <Text style={styles.alertText}>⚠ EMERGENCY MODE ACTIVE</Text>
        </View>
        <Text style={styles.subtitle}>Volume ×3 shortcut triggered</Text>
    </View>

      {/* Big SOS Button */}
    <View style={styles.sosWrapper}>
        <Animated.View style={[styles.sosRing, { transform: [{ scale: pulseAnim }] }]} />
        <TouchableOpacity style={styles.sosButton} onPress={callEmergency}>
        <Text style={styles.sosLabel}>SOS</Text>
        <Text style={styles.sosSubLabel}>Tap to call 112</Text>
        </TouchableOpacity>
    </View>

      {/* Quick Call Buttons */}
    <View style={styles.quickRow}>
        <TouchableOpacity style={[styles.quickBtn, { borderColor: '#3b6fd4' }]} onPress={callPolice}>
        <Text style={styles.quickIcon}>🚔</Text>
        <Text style={styles.quickLabel}>Police</Text>
        <Text style={styles.quickNumber}>100</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.quickBtn, { borderColor: '#d43b3b' }]} onPress={callAmbulance}>
        <Text style={styles.quickIcon}>🚑</Text>
        <Text style={styles.quickLabel}>Ambulance</Text>
        <Text style={styles.quickNumber}>108</Text>
        </TouchableOpacity>
    </View>

      {/* Dismiss */}
    <TouchableOpacity style={styles.dismissBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.dismissText}>✕  Dismiss — I'm Safe</Text>
    </TouchableOpacity>
    </Animated.View>
);
}

const styles = StyleSheet.create({
container: {
    flex: 1,
    backgroundColor: '#0d0000',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
},
header: {
    alignItems: 'center',
    gap: 8,
},
alertBadge: {
    backgroundColor: '#ff000020',
    borderWidth: 1,
    borderColor: '#ff000060',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
},
alertText: {
    color: '#ff4444',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 2,
    fontWeight: '700',
},
subtitle: {
    color: '#663333',
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
},
sosWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
    height: 220,
},
sosRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 3,
    borderColor: '#ff000050',
},
sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#cc0000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#ff3333',
    shadowColor: '#ff0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
},
sosLabel: {
    color: '#ffffff',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 4,
},
sosSubLabel: {
    color: '#ffaaaa',
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 4,
},
quickRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
},
quickBtn: {
    flex: 1,
    backgroundColor: '#1a0000',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
},
quickIcon: {
    fontSize: 28,
},
quickLabel: {
    color: '#cccccc',
    fontSize: 13,
    fontWeight: '600',
},
quickNumber: {
    color: '#666677',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 1,
},
dismissBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 30,
},
dismissText: {
    color: '#666677',
    fontSize: 13,
    letterSpacing: 1,
},
});
