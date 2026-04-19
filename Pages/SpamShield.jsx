import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, StyleSheet,
    Alert, StatusBar, Animated, Modal, Switch, ScrollView,
    Dimensions, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    startMonitoring, stopMonitoring, isShieldActive,
    getSpamHistory, getBlocklist, blockNumber, unblockNumber,
    reportSpamToFirebase, updateHistoryAction, clearHistory,
    requestSMSPermissions, scanInboxSMS,
} from '../services/SMSMonitor';
import { fullAnalysis } from '../services/SpamChecker';
import { extractLinks, processMessageLinks } from '../services/LinkBlocker';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING, SHADOWS } from '../src/theme';

const { width } = Dimensions.get('window');

export default function SpamShield() {
    const [shieldActive, setShieldActive] = useState(false);
    const [smsMonitoring, setSmsMonitoring] = useState(true);
    const [callBlocker, setCallBlocker] = useState(true);
    const [linkBlocker, setLinkBlocker] = useState(true);
    const [scamAlerts, setScamAlerts] = useState(true);
    const [history, setHistory] = useState([]);
    const [blocklist, setBlocklist] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [alertRecord, setAlertRecord] = useState(null);
    const [showAlert, setShowAlert] = useState(false);
    const slideAnim = useRef(new Animated.Value(300)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        loadData();
        initShield();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.03, duration: 1500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    useEffect(() => {
        if (showAlert) {
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }).start();
        } else {
            Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }).start();
        }
    }, [showAlert]);

    const initShield = async () => {
        const active = await isShieldActive();
        setShieldActive(active);
    };

    const loadData = async () => {
        const h = await getSpamHistory();
        const b = await getBlocklist();
        setHistory(h);
        setBlocklist(b);
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    const toggleShield = async () => {
        if (shieldActive) {
            await stopMonitoring();
            setShieldActive(false);
        } else {
            const perms = await requestSMSPermissions();
            if (!perms) {
                Alert.alert('Permissions Required', 'SMS permissions are needed for spam shield to work.');
                return;
            }
            const started = await startMonitoring((record) => {
                setAlertRecord(record);
                setShowAlert(true);
                loadData();
            });
            if (started) setShieldActive(true);
        }
    };

    const handleScanInbox = async () => {
        Alert.alert('Scanning...', 'Scanning inbox for spam messages');
        const messages = await scanInboxSMS(30);
        let spamCount = 0;
        for (const msg of messages) {
            const result = await fullAnalysis(msg.body, msg.sender);
            if (result.isSpam) spamCount++;
        }
        Alert.alert('Scan Complete', `Found ${spamCount} suspicious messages out of ${messages.length} scanned.`);
        await loadData();
    };

    const handleBlock = async (sender, recordId) => {
        await blockNumber(sender, 'Manually blocked');
        if (recordId) await updateHistoryAction(recordId, 'blocked');
        await loadData();
        setShowAlert(false);
        Alert.alert('Blocked', `${sender} has been blocked.`);
    };

    const handleReport = async (sender, body, recordId) => {
        const success = await reportSpamToFirebase(sender, body);
        if (recordId) await updateHistoryAction(recordId, 'reported');
        await loadData();
        setShowAlert(false);
        Alert.alert(
            success ? 'Reported' : 'Error',
            success ? `${sender} reported to community database.` : 'Failed to report. Try again.'
        );
    };

    // Feature toggles
    const featureRows = [
        {
            key: 'sms',
            icon: 'chatbubble-ellipses',
            iconColor: '#7B1FA2',
            iconBg: '#F3E5F5',
            title: 'SMS Monitoring',
            subtitle: 'Scan incoming texts',
            value: smsMonitoring,
            onToggle: (val) => {
                setSmsMonitoring(val);
                if (!val && shieldActive) toggleShield();
                else if (val && !shieldActive) toggleShield();
            },
        },
        {
            key: 'call',
            icon: 'call',
            iconColor: '#C62828',
            iconBg: '#FFEBEE',
            title: 'Call Blocker',
            subtitle: 'Block unknown spam calls',
            value: callBlocker,
            onToggle: setCallBlocker,
        },
        {
            key: 'link',
            icon: 'link',
            iconColor: '#E65100',
            iconBg: '#FFF3E0',
            title: 'Link Blocker',
            subtitle: 'Block dangerous URLs',
            value: linkBlocker,
            onToggle: setLinkBlocker,
        },
        {
            key: 'alerts',
            icon: 'alert-circle',
            iconColor: '#F9A825',
            iconBg: '#FFFDE7',
            title: 'Scam Alerts',
            subtitle: 'Get notified of threats',
            value: scamAlerts,
            onToggle: setScamAlerts,
        },
    ];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWarm} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                }
            >
                {/* Header — Greeting */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerAvatar}>
                            <Ionicons name="person" size={20} color={COLORS.accent} />
                        </View>
                        <Text style={styles.headerGreeting}>Namaste, Guardian</Text>
                    </View>
                    <TouchableOpacity style={styles.bellBtn}>
                        <Ionicons name="notifications-outline" size={22} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Title */}
                <View style={styles.titleSection}>
                    <Text style={styles.pageTitle}>Spam Shield</Text>
                    <Text style={styles.pageSubtitle}>
                        Protect yourself from spam & fraud with our intelligent vigilance system.
                    </Text>
                </View>

                {/* Shield Status Card */}
                <Animated.View style={[styles.shieldCard, { transform: [{ scale: shieldActive ? pulseAnim : 1 }] }]}>
                    <View style={styles.shieldStatusRow}>
                        <View style={styles.shieldStatusLeft}>
                            <View style={[styles.shieldDot, { backgroundColor: shieldActive ? COLORS.accent : COLORS.textMuted }]} />
                            <Text style={[styles.shieldStatusLabel, { color: shieldActive ? COLORS.accent : COLORS.textMuted }]}>
                                {shieldActive ? 'SHIELD ACTIVE' : 'SHIELD INACTIVE'}
                            </Text>
                        </View>
                        <View style={styles.shieldIconBg}>
                            <Ionicons
                                name="shield-checkmark"
                                size={32}
                                color={shieldActive ? COLORS.accent : COLORS.textMutedLight}
                            />
                        </View>
                    </View>

                    <Text style={styles.shieldMessage}>
                        {shieldActive
                            ? 'Your digital perimeter is secured.'
                            : 'Your shield is inactive. Enable to protect.'}
                    </Text>

                    {/* Progress segments */}
                    <View style={styles.progressRow}>
                        {[0, 1, 2, 3].map((i) => (
                            <View
                                key={i}
                                style={[
                                    styles.progressSegment,
                                    { backgroundColor: shieldActive ? COLORS.accent : COLORS.divider },
                                ]}
                            />
                        ))}
                    </View>
                </Animated.View>

                {/* Feature Toggles */}
                <View style={styles.featuresSection}>
                    {featureRows.map((feature) => (
                        <View key={feature.key} style={styles.featureRow}>
                            <View style={[styles.featureIconBg, { backgroundColor: feature.iconBg }]}>
                                <Ionicons name={feature.icon} size={22} color={feature.iconColor} />
                            </View>
                            <View style={styles.featureInfo}>
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
                            </View>
                            <Switch
                                value={feature.value}
                                onValueChange={feature.onToggle}
                                trackColor={{ false: COLORS.divider, true: COLORS.accentBg }}
                                thumbColor={feature.value ? COLORS.accent : COLORS.textMutedLight}
                                ios_backgroundColor={COLORS.divider}
                            />
                        </View>
                    ))}
                </View>

                {/* Footer Status */}
                <View style={styles.footerCard}>
                    <Ionicons name="information-circle" size={18} color={COLORS.warning} />
                    <Text style={styles.footerText}>
                        Last scan completed 12 minutes ago. No threats detected in your recent messages or call history.
                    </Text>
                </View>
            </ScrollView>

            {/* Spam Alert Modal */}
            {alertRecord && (
                <Modal visible={showAlert} transparent animationType="none">
                    <View style={styles.alertOverlay}>
                        <Animated.View style={[styles.alertContainer, { transform: [{ translateY: slideAnim }] }]}>
                            <View style={styles.alertHandle} />
                            <View style={styles.alertHeader}>
                                <Ionicons name="warning" size={28} color={COLORS.danger} />
                                <Text style={styles.alertTitle}>SPAM DETECTED</Text>
                            </View>
                            <Text style={styles.alertSender}>{alertRecord.sender}</Text>
                            <Text style={styles.alertPreview} numberOfLines={3}>{alertRecord.body}</Text>

                            <View style={styles.alertActions}>
                                <TouchableOpacity
                                    style={[styles.alertBtn, { backgroundColor: COLORS.danger }]}
                                    onPress={() => handleBlock(alertRecord.sender, alertRecord.id)}
                                >
                                    <Ionicons name="ban" size={18} color="#FFF" />
                                    <Text style={styles.alertBtnText}>Block</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.alertBtn, { backgroundColor: COLORS.warning }]}
                                    onPress={() => handleReport(alertRecord.sender, alertRecord.body, alertRecord.id)}
                                >
                                    <Ionicons name="flag" size={18} color="#FFF" />
                                    <Text style={styles.alertBtnText}>Report</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.alertDismiss} onPress={() => setShowAlert(false)}>
                                <Text style={styles.alertDismissText}>Dismiss</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgWarm },
    scroll: { paddingBottom: 30 },

    // Header — Greeting
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 52,
        paddingBottom: SPACING.sm,
        paddingHorizontal: SPACING.xxl,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.accentBg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerGreeting: {
        ...TYPOGRAPHY.body,
        fontWeight: '700',
        color: COLORS.textDark,
    },
    bellBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Title
    titleSection: {
        paddingHorizontal: SPACING.xxl,
        paddingBottom: SPACING.lg,
    },
    pageTitle: {
        ...TYPOGRAPHY.h1,
        color: COLORS.textDark,
        marginBottom: SPACING.xs,
    },
    pageSubtitle: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },

    // Shield Status Card
    shieldCard: {
        marginHorizontal: SPACING.xxl,
        backgroundColor: COLORS.bgLight,
        borderRadius: RADIUS.xl,
        padding: SPACING.xl,
        ...SHADOWS.card,
        marginBottom: SPACING.xl,
    },
    shieldStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    shieldStatusLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    shieldDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    shieldStatusLabel: {
        ...TYPOGRAPHY.overline,
        fontWeight: '800',
    },
    shieldIconBg: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.bgWarm,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shieldMessage: {
        ...TYPOGRAPHY.h3,
        color: COLORS.textDark,
        marginBottom: SPACING.lg,
    },
    progressRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    progressSegment: {
        flex: 1,
        height: 5,
        borderRadius: 3,
    },

    // Feature Toggles
    featuresSection: {
        marginHorizontal: SPACING.xxl,
        gap: SPACING.md,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgLight,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.sm,
    },
    featureIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.lg,
    },
    featureInfo: {
        flex: 1,
    },
    featureTitle: {
        ...TYPOGRAPHY.body,
        fontWeight: '700',
        color: COLORS.textDark,
    },
    featureSubtitle: {
        ...TYPOGRAPHY.small,
        color: COLORS.textMuted,
        marginTop: 2,
    },

    // Footer
    footerCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginHorizontal: SPACING.xxl,
        marginTop: SPACING.xxl,
        backgroundColor: COLORS.bgLight,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        gap: SPACING.sm,
        ...SHADOWS.sm,
    },
    footerText: {
        ...TYPOGRAPHY.small,
        color: COLORS.textSecondary,
        flex: 1,
        lineHeight: 17,
    },

    // Alert modal
    alertOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.overlay },
    alertContainer: {
        backgroundColor: COLORS.bgLight,
        borderTopLeftRadius: RADIUS.xxl,
        borderTopRightRadius: RADIUS.xxl,
        paddingHorizontal: SPACING.xxl,
        paddingBottom: 40,
        paddingTop: SPACING.md,
    },
    alertHandle: {
        width: 40,
        height: 4,
        backgroundColor: COLORS.divider,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: SPACING.lg,
    },
    alertHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        marginBottom: SPACING.md,
    },
    alertTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.danger,
        letterSpacing: 1,
    },
    alertSender: {
        ...TYPOGRAPHY.body,
        fontWeight: '700',
        color: COLORS.textDark,
        marginBottom: SPACING.sm,
    },
    alertPreview: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        lineHeight: 19,
        marginBottom: SPACING.lg,
    },
    alertActions: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginBottom: SPACING.md,
    },
    alertBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.lg,
        borderRadius: RADIUS.md,
        gap: SPACING.sm,
    },
    alertBtnText: { color: '#FFF', ...TYPOGRAPHY.body, fontWeight: '700' },
    alertDismiss: { alignItems: 'center', paddingVertical: SPACING.md },
    alertDismissText: { color: COLORS.textMuted, ...TYPOGRAPHY.body },
});
