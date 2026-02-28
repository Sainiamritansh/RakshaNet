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
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function SOSScreen({ navigation }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const ringScale = useRef(new Animated.Value(0.8)).current;
    const ringOpacity = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        // Vibrate on open
        Vibration.vibrate([0, 200, 100, 200, 100, 200]);

        // Fade in
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();

        // Pulse the SOS button
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        );
        pulse.start();

        // Ring animation
        const ring = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(ringScale, { toValue: 1.4, duration: 1500, useNativeDriver: true }),
                    Animated.timing(ringOpacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(ringScale, { toValue: 0.8, duration: 0, useNativeDriver: true }),
                    Animated.timing(ringOpacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
                ]),
            ])
        );
        ring.start();

        return () => {
            pulse.stop();
            ring.stop();
        };
    }, []);

    const callEmergency = () => {
        Vibration.vibrate(300);
        Linking.openURL('tel:112');
    };

    const callPolice = () => Linking.openURL('tel:100');
    const callAmbulance = () => Linking.openURL('tel:108');

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <StatusBar barStyle="light-content" backgroundColor="#B71C1C" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.alertBadge}>
                    <Ionicons name="warning" size={14} color="#FFFFFF" />
                    <Text style={styles.alertText}>EMERGENCY MODE ACTIVE</Text>
                </View>
                <Text style={styles.subtitle}>Volume ×3 shortcut triggered</Text>
            </View>

            {/* Big SOS Button */}
            <View style={styles.sosWrapper}>
                <Animated.View
                    style={[
                        styles.sosRingOuter,
                        { transform: [{ scale: ringScale }], opacity: ringOpacity },
                    ]}
                />
                <View style={styles.sosRingStatic} />
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity style={styles.sosButton} onPress={callEmergency}>
                        <Text style={styles.sosLabel}>SOS</Text>
                        <Text style={styles.sosSubLabel}>Tap to call 112</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* Quick Call Buttons */}
            <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickBtn} onPress={callPolice}>
                    <View style={[styles.quickIconBg, { backgroundColor: 'rgba(30, 136, 229, 0.15)' }]}>
                        <Ionicons name="shield" size={26} color="#1E88E5" />
                    </View>
                    <Text style={styles.quickLabel}>Police</Text>
                    <Text style={styles.quickNumber}>100</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickBtn} onPress={callAmbulance}>
                    <View style={[styles.quickIconBg, { backgroundColor: 'rgba(229, 57, 53, 0.15)' }]}>
                        <Ionicons name="medkit" size={26} color="#E53935" />
                    </View>
                    <Text style={styles.quickLabel}>Ambulance</Text>
                    <Text style={styles.quickNumber}>108</Text>
                </TouchableOpacity>
            </View>

            {/* Dismiss */}
            <TouchableOpacity style={styles.dismissBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="close-circle-outline" size={20} color="rgba(255,255,255,0.6)" />
                <Text style={styles.dismissText}>Dismiss — I'm Safe</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#B71C1C',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        gap: 10,
    },
    alertBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: 25,
        paddingHorizontal: 18,
        paddingVertical: 8,
        gap: 8,
    },
    alertText: {
        color: '#FFFFFF',
        fontSize: 12,
        letterSpacing: 2,
        fontWeight: '800',
    },
    subtitle: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        letterSpacing: 1,
    },
    sosWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 240,
        height: 240,
    },
    sosRingOuter: {
        position: 'absolute',
        width: 230,
        height: 230,
        borderRadius: 115,
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    sosRingStatic: {
        position: 'absolute',
        width: 210,
        height: 210,
        borderRadius: 105,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    sosButton: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#E53935',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 20,
    },
    sosLabel: {
        color: '#FFFFFF',
        fontSize: 52,
        fontWeight: '900',
        letterSpacing: 6,
    },
    sosSubLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
        letterSpacing: 1,
        marginTop: 4,
        fontWeight: '500',
    },
    quickRow: {
        flexDirection: 'row',
        gap: 16,
        width: '100%',
    },
    quickBtn: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 20,
        paddingVertical: 20,
        alignItems: 'center',
        gap: 8,
    },
    quickIconBg: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickLabel: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    quickNumber: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
    },
    dismissBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 30,
        gap: 8,
    },
    dismissText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
});
