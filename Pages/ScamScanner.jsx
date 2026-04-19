import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
    Alert, StatusBar, Animated, Modal, ScrollView, Dimensions,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fullScan } from '../services/ScamChecker';
import {
    getCommunityReports, submitReport, subscribeToCommunityReports,
    REPORT_CATEGORIES,
} from '../services/CommunityReports';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING, SHADOWS } from '../src/theme';

const { width } = Dimensions.get('window');
const HISTORY_KEY = '@scan_history';

const STATUS_COLORS = { safe: '#43A047', suspicious: '#E65100', scam: '#C62828' };
const STATUS_LABELS = { safe: 'Safe', suspicious: 'Suspicious', scam: 'Scam' };
const STATUS_ICONS = { safe: 'checkmark-circle', suspicious: 'alert-circle', scam: 'close-circle' };

export default function ScamScanner() {
    // ── State ──
    const [activeTab, setActiveTab] = useState('number');
    const [input, setInput] = useState('');
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState(null);
    const [community, setCommunity] = useState(null);
    const [history, setHistory] = useState([]);
    const [showReport, setShowReport] = useState(false);
    const [reportCategory, setReportCategory] = useState('');
    const [reportNote, setReportNote] = useState('');
    const [submittingReport, setSubmittingReport] = useState(false);
    const [liveCount, setLiveCount] = useState(0);

    // ── Animations ──
    const resultSlide = useRef(new Animated.Value(400)).current;
    const resultOpacity = useRef(new Animated.Value(0)).current;
    const scanPulse = useRef(new Animated.Value(1)).current;
    const scoreAnim = useRef(new Animated.Value(0)).current;
    const [displayScore, setDisplayScore] = useState(0);
    const unsubRef = useRef(null);

    useEffect(() => {
        loadHistory();
        return () => { if (unsubRef.current) unsubRef.current(); };
    }, []);

    useEffect(() => {
        if (result) {
            scoreAnim.setValue(0);
            Animated.timing(scoreAnim, {
                toValue: result.score,
                duration: 1200,
                useNativeDriver: false,
            }).start();

            const listener = scoreAnim.addListener(({ value }) => {
                setDisplayScore(Math.round(value));
            });
            return () => scoreAnim.removeListener(listener);
        }
    }, [result]);

    const loadHistory = async () => {
        try {
            const data = await AsyncStorage.getItem(HISTORY_KEY);
            setHistory(data ? JSON.parse(data) : []);
        } catch { setHistory([]); }
    };

    const saveHistory = async (record) => {
        try {
            const existing = await AsyncStorage.getItem(HISTORY_KEY);
            const list = existing ? JSON.parse(existing) : [];
            list.unshift(record);
            const trimmed = list.slice(0, 20);
            await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
            setHistory(trimmed);
        } catch (e) { console.error('History save error:', e); }
    };

    // ── Scan Logic ──
    const handleScan = async (overrideInput, overrideType) => {
        const scanInput = overrideInput || input;
        const scanType = overrideType || activeTab;
        if (!scanInput.trim()) {
            Alert.alert('Empty Input', `Please enter a ${scanType === 'number' ? 'phone number' : 'message'} to scan.`);
            return;
        }

        setResult(null);
        setCommunity(null);
        setScanning(true);
        resultSlide.setValue(400);
        resultOpacity.setValue(0);

        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(scanPulse, { toValue: 1.03, duration: 400, useNativeDriver: true }),
                Animated.timing(scanPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
            ])
        );
        pulse.start();

        const analysis = fullScan(scanInput, scanType === 'number' ? 'number' : 'message');

        let communityData = null;
        if (scanType === 'number') {
            communityData = await getCommunityReports(scanInput);
            setCommunity(communityData);

            if (communityData.found && communityData.reportCount >= 10) {
                analysis.score = Math.max(analysis.score, 85);
                analysis.category = 'scam';
                analysis.reasons = analysis.reasons || [];
                analysis.reasons.push(`Reported by ${communityData.reportCount} community members`);
            } else if (communityData.found && communityData.reportCount >= 3) {
                analysis.score = Math.max(analysis.score, Math.min(analysis.score + 20, 100));
                analysis.reasons = analysis.reasons || [];
                analysis.reasons.push(`Reported by ${communityData.reportCount} user(s)`);
                if (analysis.score >= 70) analysis.category = 'scam';
                else if (analysis.score >= 31) analysis.category = 'suspicious';
            }

            if (unsubRef.current) unsubRef.current();
            unsubRef.current = subscribeToCommunityReports(scanInput, (count) => {
                setLiveCount(count);
            });
        }

        await new Promise(r => setTimeout(r, 1500));

        pulse.stop();
        scanPulse.setValue(1);
        setScanning(false);
        setResult(analysis);

        Animated.parallel([
            Animated.spring(resultSlide, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
            Animated.timing(resultOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();

        await saveHistory({
            id: `scan_${Date.now()}`,
            input: scanInput,
            type: scanType,
            score: analysis.score,
            category: analysis.category,
            communityCount: communityData?.reportCount || 0,
            timestamp: Date.now(),
        });
    };

    // ── Report Submit ──
    const handleSubmitReport = async () => {
        if (!reportCategory) {
            Alert.alert('Select Category', 'Please choose a scam category.');
            return;
        }
        setSubmittingReport(true);
        const success = await submitReport({
            number: activeTab === 'number' ? input : '',
            messagePreview: activeTab === 'message' ? input : '',
            category: reportCategory,
            userNote: reportNote,
        });
        setSubmittingReport(false);
        setShowReport(false);
        setReportCategory('');
        setReportNote('');

        if (success) {
            Alert.alert('✅ Reported!', 'You protected the community. Thank you!');
        } else {
            Alert.alert('Error', 'Failed to submit report. Please try again.');
        }
    };

    const getColor = (cat) => STATUS_COLORS[cat] || '#9E9E9E';
    const getLabel = (cat) => STATUS_LABELS[cat] || 'Unknown';
    const getIcon = (cat) => STATUS_ICONS[cat] || 'ellipse';

    const getTimeAgo = (timestamp) => {
        const diff = Date.now() - timestamp;
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours} HOURS AGO`;
        const days = Math.floor(hours / 24);
        if (days === 1) return 'YESTERDAY';
        return `${days} DAYS AGO`;
    };

    const getResultLabel = (cat) => {
        if (cat === 'safe') return 'SAFE RESULT';
        if (cat === 'suspicious') return 'SUSPICIOUS';
        return 'VERIFIED';
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWarm} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                {/* Header — Greeting style */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerAvatar}>
                            <Ionicons name="person" size={20} color={COLORS.primary} />
                        </View>
                        <Text style={styles.headerGreeting}>Namaste, Guardian</Text>
                    </View>
                    <TouchableOpacity style={styles.bellBtn}>
                        <Ionicons name="notifications-outline" size={22} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Page Title */}
                <View style={styles.titleSection}>
                    <Text style={styles.pageTitle}>Scam Scanner</Text>
                    <Text style={styles.pageSubtitle}>
                        Protect yourself from phishing and fraudulent links in real-time.
                    </Text>
                </View>

                {/* Input Card */}
                <View style={styles.inputCard}>
                    <TextInput
                        style={[styles.input, activeTab === 'message' && styles.inputMultiline]}
                        placeholder="Paste link or message here..."
                        placeholderTextColor={COLORS.textMuted}
                        value={input}
                        onChangeText={setInput}
                        keyboardType={activeTab === 'number' ? 'phone-pad' : 'default'}
                        multiline={activeTab === 'message'}
                        numberOfLines={activeTab === 'message' ? 3 : 1}
                    />
                    <View style={styles.inputSearchIcon}>
                        <Ionicons name="search" size={20} color={COLORS.textMuted} />
                    </View>
                </View>

                {/* Scan Button — Orange/Red gradient feel */}
                <Animated.View style={{ transform: [{ scale: scanPulse }] }}>
                    <TouchableOpacity
                        style={[styles.scanBtn, scanning && styles.scanBtnActive]}
                        onPress={() => handleScan()}
                        disabled={scanning}
                        activeOpacity={0.85}
                    >
                        {scanning ? (
                            <View style={styles.scanBtnContent}>
                                <ActivityIndicator color="#FFF" size="small" />
                                <Text style={styles.scanBtnText}>Scanning...</Text>
                            </View>
                        ) : (
                            <View style={styles.scanBtnContent}>
                                <Text style={styles.scanBtnText}>Scan Now</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* Result Card — Alert style */}
                {result && (
                    <Animated.View style={[
                        styles.resultCard,
                        {
                            transform: [{ translateY: resultSlide }],
                            opacity: resultOpacity,
                            backgroundColor: result.category === 'scam' ? '#FFF3E0' :
                                result.category === 'suspicious' ? '#FFF8E1' : COLORS.accentBg,
                            borderColor: result.category === 'scam' ? '#FFCC02' :
                                result.category === 'suspicious' ? '#F59E0B' : COLORS.accent,
                        },
                    ]}>
                        <View style={styles.resultHeader}>
                            <View style={[styles.resultIconBg, {
                                backgroundColor: result.category === 'scam' ? '#FFE0B2' :
                                    result.category === 'suspicious' ? '#FFF3E0' : '#C8E6C9',
                            }]}>
                                <Ionicons
                                    name={result.category === 'scam' ? 'warning' : result.category === 'suspicious' ? 'alert-circle' : 'shield-checkmark'}
                                    size={28}
                                    color={getColor(result.category)}
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: SPACING.md }}>
                                <Text style={[styles.resultTitle, { color: getColor(result.category) }]}>
                                    {result.category === 'scam' ? 'Danger! Phishing Link\nDetected' :
                                        result.category === 'suspicious' ? 'Suspicious Content\nDetected' :
                                            'Content Appears Safe'}
                                </Text>
                                <Text style={styles.resultSubLabel}>
                                    {result.category === 'scam' ? 'HIGH RISK SECURITY ALERT' :
                                        result.category === 'suspicious' ? 'MEDIUM RISK' :
                                            'LOW RISK'}
                                </Text>
                            </View>
                        </View>

                        {result.reasons && result.reasons.length > 0 && (
                            <Text style={styles.resultDescription}>
                                {result.reasons[0]}
                            </Text>
                        )}

                        {/* Action Buttons */}
                        {result.category !== 'safe' && (
                            <View style={styles.resultActions}>
                                <TouchableOpacity
                                    style={styles.resultActionBtn}
                                    onPress={() => setShowReport(true)}
                                >
                                    <Ionicons name="flag" size={16} color={COLORS.primary} />
                                    <Text style={styles.resultActionText}>Report</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.resultActionBtn}
                                    onPress={() => Alert.alert('Blocked', 'Added to blocklist.')}
                                >
                                    <Ionicons name="ban" size={16} color={COLORS.textSecondary} />
                                    <Text style={styles.resultActionText}>Block</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>
                )}

                {/* Scan History */}
                {history.length > 0 && (
                    <View style={styles.historySection}>
                        <View style={styles.historyHeader}>
                            <Text style={styles.historyTitle}>Scan History</Text>
                            <Text style={styles.historyCount}>PAST {Math.min(history.length, 3)} SCANS</Text>
                        </View>
                        {history.slice(0, 5).map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.historyCard}
                                onPress={() => {
                                    setInput(item.input);
                                    setActiveTab(item.type);
                                    handleScan(item.input, item.type);
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.historyDot, { backgroundColor: getColor(item.category) }]}>
                                    <Ionicons name={getIcon(item.category)} size={14} color={COLORS.bgLight} />
                                </View>
                                <View style={styles.historyInfo}>
                                    <Text style={styles.historyInput} numberOfLines={1}>
                                        {item.input}
                                    </Text>
                                    <Text style={styles.historyMeta}>
                                        {getTimeAgo(item.timestamp)} • {getResultLabel(item.category)}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={COLORS.textMutedLight} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Security Tip Card */}
                <View style={styles.tipCard}>
                    <View style={styles.tipIconBg}>
                        <Ionicons name="bulb" size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.tipInfo}>
                        <Text style={styles.tipTitle}>Security Tip</Text>
                        <Text style={styles.tipText}>
                            Never share your OTP or PIN over a link, even if the website looks official.
                        </Text>
                    </View>
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>

            {/* Report Modal */}
            <Modal visible={showReport} transparent animationType="slide">
                <View style={styles.reportOverlay}>
                    <View style={styles.reportSheet}>
                        <View style={styles.reportHandle} />
                        <Text style={styles.reportTitle}>Report Scam</Text>
                        <Text style={styles.reportPreview} numberOfLines={2}>
                            {input}
                        </Text>

                        <Text style={styles.reportLabel}>Select Category:</Text>
                        <View style={styles.categoryGrid}>
                            {REPORT_CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[styles.categoryBtn, reportCategory === cat.id && styles.categoryBtnActive]}
                                    onPress={() => setReportCategory(cat.id)}
                                >
                                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                                    <Text style={[styles.categoryLabel, reportCategory === cat.id && styles.categoryLabelActive]}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={styles.reportNoteInput}
                            placeholder="Add a note (optional)..."
                            placeholderTextColor={COLORS.textMuted}
                            value={reportNote}
                            onChangeText={setReportNote}
                            multiline
                            numberOfLines={2}
                        />

                        <TouchableOpacity
                            style={styles.submitBtn}
                            onPress={handleSubmitReport}
                            disabled={submittingReport}
                        >
                            {submittingReport ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit Report</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.reportCancel} onPress={() => setShowReport(false)}>
                            <Text style={styles.reportCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgWarm },
    scroll: { paddingBottom: 20 },

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
        backgroundColor: COLORS.primaryBg,
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

    // Input
    inputCard: {
        marginHorizontal: SPACING.xxl,
        backgroundColor: COLORS.bgLight,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        ...SHADOWS.sm,
    },
    input: {
        color: COLORS.textDark,
        ...TYPOGRAPHY.body,
        paddingVertical: SPACING.md,
    },
    inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
    inputSearchIcon: {
        paddingBottom: SPACING.sm,
    },

    // Scan button
    scanBtn: {
        marginHorizontal: SPACING.xxl,
        marginTop: SPACING.lg,
        backgroundColor: '#E65100',
        borderRadius: RADIUS.lg,
        paddingVertical: SPACING.lg,
        alignItems: 'center',
        ...SHADOWS.md,
    },
    scanBtnActive: { backgroundColor: '#BF360C' },
    scanBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    scanBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },

    // Result
    resultCard: {
        marginHorizontal: SPACING.xxl,
        marginTop: SPACING.xl,
        borderRadius: RADIUS.lg,
        padding: SPACING.xl,
        borderWidth: 1,
    },
    resultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    resultIconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultTitle: {
        ...TYPOGRAPHY.body,
        fontWeight: '800',
        lineHeight: 20,
    },
    resultSubLabel: {
        ...TYPOGRAPHY.tiny,
        color: '#E65100',
        letterSpacing: 1,
        marginTop: 4,
        fontWeight: '700',
    },
    resultDescription: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        lineHeight: 18,
        marginTop: SPACING.sm,
    },
    resultActions: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.lg,
    },
    resultActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    resultActionText: {
        ...TYPOGRAPHY.small,
        color: COLORS.textSecondary,
    },

    // History
    historySection: {
        marginHorizontal: SPACING.xxl,
        marginTop: SPACING.xxl,
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    historyTitle: {
        ...TYPOGRAPHY.h3,
        color: COLORS.textDark,
    },
    historyCount: {
        ...TYPOGRAPHY.tiny,
        color: COLORS.textMuted,
        letterSpacing: 0.5,
    },
    historyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    historyDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    historyInfo: {
        flex: 1,
        marginLeft: SPACING.md,
    },
    historyInput: {
        ...TYPOGRAPHY.body,
        fontWeight: '600',
        color: COLORS.textDark,
    },
    historyMeta: {
        ...TYPOGRAPHY.tiny,
        color: COLORS.textMuted,
        marginTop: 3,
        letterSpacing: 0.3,
    },

    // Security Tip
    tipCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: SPACING.xxl,
        marginTop: SPACING.xxl,
        backgroundColor: COLORS.primaryBg,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
    },
    tipIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.bgLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    tipInfo: { flex: 1 },
    tipTitle: {
        ...TYPOGRAPHY.body,
        fontWeight: '700',
        color: COLORS.primary,
    },
    tipText: {
        ...TYPOGRAPHY.small,
        color: COLORS.textSecondary,
        marginTop: 2,
        lineHeight: 16,
    },

    // Report modal
    reportOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.overlay },
    reportSheet: {
        backgroundColor: COLORS.bgLight,
        borderTopLeftRadius: RADIUS.xxl,
        borderTopRightRadius: RADIUS.xxl,
        paddingHorizontal: SPACING.xxl,
        paddingBottom: 40,
        paddingTop: SPACING.md,
    },
    reportHandle: {
        width: 40,
        height: 4,
        backgroundColor: COLORS.divider,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: SPACING.lg,
    },
    reportTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.textDark,
        marginBottom: SPACING.sm,
    },
    reportPreview: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textMuted,
        marginBottom: SPACING.lg,
    },
    reportLabel: {
        ...TYPOGRAPHY.body,
        fontWeight: '700',
        color: COLORS.textDark,
        marginBottom: SPACING.md,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginBottom: SPACING.lg,
    },
    categoryBtn: {
        width: (width - 72) / 3,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        backgroundColor: COLORS.bgWarm,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    categoryBtnActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryBg,
    },
    categoryIcon: { fontSize: 22, marginBottom: 4 },
    categoryLabel: {
        ...TYPOGRAPHY.tiny,
        color: COLORS.textMuted,
        textAlign: 'center',
    },
    categoryLabelActive: { color: COLORS.primary },
    reportNoteInput: {
        backgroundColor: COLORS.bgWarm,
        borderRadius: RADIUS.md,
        padding: SPACING.lg,
        color: COLORS.textDark,
        ...TYPOGRAPHY.body,
        minHeight: 60,
        textAlignVertical: 'top',
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    submitBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING.lg,
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    submitBtnText: { color: '#FFF', ...TYPOGRAPHY.body, fontWeight: '800' },
    reportCancel: { alignItems: 'center', paddingVertical: SPACING.md },
    reportCancelText: { color: COLORS.textMuted, ...TYPOGRAPHY.body },
});
