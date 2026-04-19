import React, { useEffect, useRef, useState } from 'react';
import {
    Text,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Animated,
    Vibration,
    StatusBar,
    View,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING, ANIM } from '../src/theme';

const { width } = Dimensions.get('window');

export default function SOSScreen({ navigation }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const triangleScale = useRef(new Animated.Value(1)).current;
    const triangleOpacity = useRef(new Animated.Value(1)).current;
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [alertStatus, setAlertStatus] = useState({
        smsSent: false,
        locationShared: false,
        broadcastActive: false,
        alertSounding: false,
    });

    useEffect(() => {
        Vibration.vibrate([0, 200, 100, 200, 100, 200]);

        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();

        const scalePulse = Animated.loop(
            Animated.sequence([
                Animated.timing(triangleScale, {
                    toValue: ANIM.sosTrianglePulse.scaleTo,
                    duration: ANIM.sosTrianglePulse.scaleDuration / 2,
                    useNativeDriver: true,
                }),
                Animated.timing(triangleScale, {
                    toValue: ANIM.sosTrianglePulse.scaleFrom,
                    duration: ANIM.sosTrianglePulse.scaleDuration / 2,
                    useNativeDriver: true,
                }),
            ])
        );

        const opacityFlash = Animated.loop(
            Animated.sequence([
                Animated.timing(triangleOpacity, {
                    toValue: ANIM.sosTriangleFlash.opacityTo,
                    duration: ANIM.sosTriangleFlash.opacityDuration / 2,
                    useNativeDriver: true,
                }),
                Animated.timing(triangleOpacity, {
                    toValue: ANIM.sosTriangleFlash.opacityFrom,
                    duration: ANIM.sosTriangleFlash.opacityDuration / 2,
                    useNativeDriver: true,
                }),
            ])
        );

        scalePulse.start();
        opacityFlash.start();

        const timer = setInterval(() => {
            setElapsedSeconds((prev) => prev + 1);
        }, 1000);

        setTimeout(() => setAlertStatus((s) => ({ ...s, smsSent: true })), 800);
        setTimeout(() => setAlertStatus((s) => ({ ...s, locationShared: true })), 1500);
        setTimeout(() => setAlertStatus((s) => ({ ...s, broadcastActive: true })), 2200);
        setTimeout(() => setAlertStatus((s) => ({ ...s, alertSounding: true })), 3000);

        return () => {
            scalePulse.stop();
            opacityFlash.stop();
            clearInterval(timer);
        };
    }, []);

    const cancelAlert = () => {
        Vibration.cancel();
        navigation.goBack();
    };

    const formatTime = (seconds) => seconds.toString().padStart(2, '0');

    const statusItems = [
        { key: 'smsSent', label: 'Emergency SMS Sent', icon: 'chatbubble', active: alertStatus.smsSent },
        { key: 'locationShared', label: 'Live Location Shared', icon: 'location', active: alertStatus.locationShared },
        { key: 'broadcastActive', label: 'Network Broadcast Active', icon: 'radio', active: alertStatus.broadcastActive },
        { key: 'alertSounding', label: 'Local Alert Sounding', icon: 'volume-high', active: alertStatus.alertSounding },
    ];

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
            <LinearGradient
                colors={[COLORS.primaryDark, '#2D0A0A', COLORS.bgDark]}
                style={styles.gradient}
            >
                <View style={styles.header}>
                    <Text style={styles.sosTitle}>SOS ACTIVE</Text>
                    <Text style={styles.sosSubtitle}>Help is being dispatched</Text>
                </View>

                <View style={styles.centerSection}>
                    <View style={styles.countdownCircle}>
                        <Text style={styles.countdownNumber}>{formatTime(elapsedSeconds)}</Text>
                    </View>
                    <Animated.View
                        style={[
                            styles.triangleContainer,
                            {
                                transform: [{ scale: triangleScale }],
                                opacity: triangleOpacity,
                            },
                        ]}
                    >
                        <View style={styles.triangleBg}>
                            <Ionicons name="warning" size={64} color={COLORS.textPrimary} />
                        </View>
                    </Animated.View>
                </View>

                <View style={styles.statusSection}>
                    <Text style={styles.statusTitle}>Alert Status</Text>
                    {statusItems.map((item) => (
                        <View key={item.key} style={styles.statusRow}>
                            <View style={[styles.statusCheck, item.active && styles.statusCheckActive]}>
                                <Ionicons
                                    name={item.active ? "checkmark" : "hourglass-outline"}
                                    size={14}
                                    color={item.active ? COLORS.textPrimary : 'rgba(255,255,255,0.4)'}
                                />
                            </View>
                            <Ionicons
                                name={item.icon}
                                size={18}
                                color={item.active ? COLORS.primary : 'rgba(255,255,255,0.3)'}
                                style={{ marginRight: SPACING.sm }}
                            />
                            <Text style={[styles.statusLabel, item.active && styles.statusLabelActive]}>
                                {item.label}
                            </Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.cancelBtn} onPress={cancelAlert}>
                    <Ionicons name="close" size={22} color={COLORS.textPrimary} />
                    <Text style={styles.cancelText}>CANCEL ALERT</Text>
                </TouchableOpacity>
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 60,
        paddingHorizontal: SPACING.xxl,
    },
    header: { alignItems: 'center', gap: SPACING.sm },
    sosTitle: {
        ...TYPOGRAPHY.h1,
        fontSize: 32,
        color: COLORS.textPrimary,
        letterSpacing: 4,
    },
    sosSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, letterSpacing: 1 },
    centerSection: { alignItems: 'center', gap: SPACING.xxl },
    countdownCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(229, 57, 53, 0.1)',
    },
    countdownNumber: { ...TYPOGRAPHY.h1, fontSize: 32, color: COLORS.primary },
    triangleContainer: { alignItems: 'center', justifyContent: 'center' },
    triangleBg: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(229, 57, 53, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusSection: { width: '100%', gap: SPACING.md },
    statusTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.sm },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(229, 57, 53, 0.08)',
        borderRadius: RADIUS.md,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderWidth: 1,
        borderColor: 'rgba(229, 57, 53, 0.15)',
    },
    statusCheck: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    statusCheckActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
    statusLabel: { ...TYPOGRAPHY.body, color: 'rgba(255,255,255,0.4)', flex: 1 },
    statusLabelActive: { color: COLORS.textPrimary },
    cancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING.lg,
        paddingHorizontal: SPACING.xxxl,
        width: '100%',
        gap: SPACING.sm,
    },
    cancelText: { ...TYPOGRAPHY.body, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: 2 },
});
