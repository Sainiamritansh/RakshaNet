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

const { width } = Dimensions.get('window');
const HISTORY_KEY = '@scan_history';

const COLORS = { safe: '#10B981', suspicious: '#F59E0B', scam: '#EF4444' };
const LABELS = { safe: 'Safe', suspicious: 'Suspicious', scam: 'Scam' };

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

    // Score count-up effect
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

        // Reset & animate
        setResult(null);
        setCommunity(null);
        setScanning(true);
        resultSlide.setValue(400);
        resultOpacity.setValue(0);

        // Pulse animation
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(scanPulse, { toValue: 1.06, duration: 400, useNativeDriver: true }),
                Animated.timing(scanPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
            ])
        );
        pulse.start();

        // 1. Local analysis
        const analysis = fullScan(scanInput, scanType === 'number' ? 'number' : 'message');

        // 2. Community check (for numbers)
        let communityData = null;
        if (scanType === 'number') {
            communityData = await getCommunityReports(scanInput);
            setCommunity(communityData);

            // If 10+ reports → auto-scam
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

            // Subscribe to live updates
            if (unsubRef.current) unsubRef.current();
            unsubRef.current = subscribeToCommunityReports(scanInput, (count) => {
                setLiveCount(count);
            });
        }

        // Artificial delay for UX
        await new Promise(r => setTimeout(r, 1500));

        pulse.stop();
        scanPulse.setValue(1);
        setScanning(false);
        setResult(analysis);

        // Animate result card in
        Animated.parallel([
            Animated.spring(resultSlide, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
            Animated.timing(resultOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();

        // Save to history
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

    // ── Get result color ──
    const getColor = (cat) => COLORS[cat] || '#9E9E9E';
    const getLabel = (cat) => LABELS[cat] || 'Unknown';

    // ── Render ──
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" backgroundColor="#0F0F0F" />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerLabel}>RakshaNet</Text>
                    <Text style={styles.headerTitle}>Scam Scanner</Text>
                    <Text style={styles.headerSub}>Check any number or message for scams</Text>
                </View>

                {/* Input Tabs */}
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'number' && styles.tabActive]}
                        onPress={() => { setActiveTab('number'); setResult(null); setInput(''); }}
                    >
                        <Ionicons name="call" size={16} color={activeTab === 'number' ? '#FFF' : '#888'} />
                        <Text style={[styles.tabText, activeTab === 'number' && styles.tabTextActive]}>Scan Number</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'message' && styles.tabActive]}
                        onPress={() => { setActiveTab('message'); setResult(null); setInput(''); }}
                    >
                        <Ionicons name="chatbubble" size={16} color={activeTab === 'message' ? '#FFF' : '#888'} />
                        <Text style={[styles.tabText, activeTab === 'message' && styles.tabTextActive]}>Scan Message</Text>
                    </TouchableOpacity>
                </View>

                {/* Input */}
                <View style={styles.inputCard}>
                    <TextInput
                        style={[styles.input, activeTab === 'message' && styles.inputMultiline]}
                        placeholder={activeTab === 'number' ? 'Enter phone number...' : 'Paste message text here...'}
                        placeholderTextColor="#555"
                        value={input}
                        onChangeText={setInput}
                        keyboardType={activeTab === 'number' ? 'phone-pad' : 'default'}
                        multiline={activeTab === 'message'}
                        numberOfLines={activeTab === 'message' ? 4 : 1}
                    />
                </View>

                {/* Scan Button */}
                <Animated.View style={{ transform: [{ scale: scanPulse }] }}>
                    <TouchableOpacity
                        style={[styles.scanBtn, scanning && styles.scanBtnActive]}
                        onPress={() => handleScan()}
                        disabled={scanning}
                        activeOpacity={0.8}
                    >
                        {scanning ? (
                            <View style={styles.scanBtnContent}>
                                <ActivityIndicator color="#FFF" size="small" />
                                <Text style={styles.scanBtnText}>SCANNING...</Text>
                            </View>
                        ) : (
                            <View style={styles.scanBtnContent}>
                                <Ionicons name="scan" size={22} color="#FFF" />
                                <Text style={styles.scanBtnText}>SCAN NOW</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* Community Warning (shown before result if reports exist) */}
                {community && community.found && (
                    <View style={styles.communityCard}>
                        <View style={styles.communityHeader}>
                            <Ionicons name="people" size={20} color="#F59E0B" />
                            <Text style={styles.communityTitle}>Community Reports</Text>
                        </View>
                        <Text style={styles.communityCount}>
                            {community.verdict === 'confirmed' ? '🔴 CONFIRMED SCAM by community' :
                                community.verdict === 'many' ? '🚨 Many users reported this as scam' :
                                    community.verdict === 'few' ? '⚠️ A few users flagged this' :
                                        'Be the first to report this'}
                        </Text>
                        <View style={styles.communityStats}>
                            <View style={styles.commStat}>
                                <Text style={styles.commStatIcon}>👥</Text>
                                <Text style={styles.commStatText}>{liveCount || community.reportCount} reported</Text>
                            </View>
                            {community.firstReported && (
                                <View style={styles.commStat}>
                                    <Text style={styles.commStatIcon}>📅</Text>
                                    <Text style={styles.commStatText}>First: {community.firstReported}</Text>
                                </View>
                            )}
                            {community.mostCommonCategory && (
                                <View style={styles.commStat}>
                                    <Text style={styles.commStatIcon}>🏷️</Text>
                                    <Text style={styles.commStatText}>
                                        Type: {REPORT_CATEGORIES.find(c => c.id === community.mostCommonCategory)?.label || community.mostCommonCategory}
                                    </Text>
                                </View>
                            )}
                        </View>
                        {/* Report count bar */}
                        <View style={styles.reportBar}>
                            <View style={[styles.reportBarFill, {
                                width: `${Math.min((community.reportCount / 20) * 100, 100)}%`,
                                backgroundColor: community.reportCount > 10 ? '#EF4444' : community.reportCount > 5 ? '#F59E0B' : '#10B981',
                            }]} />
                        </View>
                    </View>
                )}

                {/* Result Card */}
                {result && (
                    <Animated.View style={[
                        styles.resultCard,
                        {
                            transform: [{ translateY: resultSlide }], opacity: resultOpacity,
                            borderColor: getColor(result.category) + '40'
                        },
                    ]}>
                        {/* Score Circle */}
                        <View style={styles.scoreSection}>
                            <View style={[styles.scoreCircle, { borderColor: getColor(result.category) }]}>
                                <Text style={[styles.scoreNumber, { color: getColor(result.category) }]}>
                                    {displayScore}
                                </Text>
                            </View>
                            <Text style={styles.scoreLabel}>Scam Probability</Text>
                        </View>

                        {/* Verdict */}
                        <View style={[styles.verdictBadge, { backgroundColor: getColor(result.category) + '15', borderColor: getColor(result.category) }]}>
                            <Ionicons
                                name={result.category === 'safe' ? 'shield-checkmark' : result.category === 'suspicious' ? 'warning' : 'alert-circle'}
                                size={24} color={getColor(result.category)}
                            />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={[styles.verdictTitle, { color: getColor(result.category) }]}>
                                    {result.category === 'safe' ? 'This appears to be Safe' :
                                        result.category === 'suspicious' ? 'This looks Suspicious' :
                                            'HIGH RISK - Likely a SCAM!'}
                                </Text>
                                <Text style={styles.verdictSub}>
                                    {result.category === 'safe' ? 'No spam indicators found' :
                                        result.category === 'suspicious' ? 'Be careful before responding' :
                                            'Do not respond or click any links'}
                                </Text>
                            </View>
                        </View>

                        {/* Reasons */}
                        {result.reasons && result.reasons.length > 0 && (
                            <View style={styles.reasonsSection}>
                                <Text style={styles.reasonsTitle}>
                                    {result.category === 'scam' ? '🚨 Alert Triggers:' : '⚠️ Reasons:'}
                                </Text>
                                {result.reasons.map((r, i) => (
                                    <View key={i} style={styles.reasonRow}>
                                        <View style={[styles.reasonDot, { backgroundColor: getColor(result.category) }]} />
                                        <Text style={styles.reasonText}>{r}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Trigger words */}
                        {result.triggers && result.triggers.length > 0 && (
                            <View style={styles.triggersRow}>
                                {result.triggers.slice(0, 6).map((t, i) => (
                                    <View key={i} style={[styles.triggerChip, { borderColor: getColor(result.category) }]}>
                                        <Text style={[styles.triggerText, { color: getColor(result.category) }]}>{t}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Action Buttons */}
                        <View style={styles.resultActions}>
                            {result.category === 'safe' ? (
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                                    onPress={() => setShowReport(true)}
                                >
                                    <Ionicons name="flag" size={16} color="#FFF" />
                                    <Text style={styles.actionBtnText}>Mark as Spam</Text>
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
                                        onPress={() => setShowReport(true)}
                                    >
                                        <Ionicons name="flag" size={16} color="#FFF" />
                                        <Text style={styles.actionBtnText}>Report</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: '#6B7280' }]}
                                        onPress={() => Alert.alert('Blocked', 'Number added to blocklist.')}
                                    >
                                        <Ionicons name="ban" size={16} color="#FFF" />
                                        <Text style={styles.actionBtnText}>Block</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </Animated.View>
                )}

                {/* Scan History */}
                {history.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.historyTitle}>Recent Scans</Text>
                        {history.slice(0, 8).map((item) => (
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
                                <View style={[styles.historyDot, { backgroundColor: getColor(item.category) }]} />
                                <View style={styles.historyInfo}>
                                    <Text style={styles.historyInput} numberOfLines={1}>
                                        {item.input}
                                    </Text>
                                    <Text style={styles.historyTime}>
                                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {item.communityCount > 0 ? ` · 👥 ${item.communityCount}` : ''}
                                    </Text>
                                </View>
                                <View style={[styles.historyBadge, { backgroundColor: getColor(item.category) + '20', borderColor: getColor(item.category) }]}>
                                    <Text style={[styles.historyBadgeText, { color: getColor(item.category) }]}>
                                        {getLabel(item.category)}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

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

                        {/* Category Selector */}
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

                        {/* Note */}
                        <TextInput
                            style={styles.reportNoteInput}
                            placeholder="Add a note (optional)..."
                            placeholderTextColor="#555"
                            value={reportNote}
                            onChangeText={setReportNote}
                            multiline
                            numberOfLines={2}
                        />

                        {/* Submit */}
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
    container: { flex: 1, backgroundColor: '#0F0F0F' },
    scroll: { paddingBottom: 20 },

    // Header
    header: { paddingTop: 55, paddingHorizontal: 24, paddingBottom: 12 },
    headerLabel: { fontSize: 12, color: '#EF4444', fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
    headerTitle: { fontSize: 30, fontWeight: '900', color: '#FFF', marginTop: 4 },
    headerSub: { fontSize: 13, color: '#666', marginTop: 4 },

    // Tabs
    tabRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 4 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
    tabActive: { backgroundColor: '#EF4444' },
    tabText: { fontSize: 14, color: '#888', fontWeight: '600' },
    tabTextActive: { color: '#FFF' },

    // Input
    inputCard: {
        marginHorizontal: 20, marginTop: 16, backgroundColor: '#1A1A1A',
        borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A',
    },
    input: { color: '#FFF', fontSize: 16, paddingHorizontal: 18, paddingVertical: 16 },
    inputMultiline: { minHeight: 100, textAlignVertical: 'top' },

    // Scan button
    scanBtn: {
        marginHorizontal: 20, marginTop: 16, backgroundColor: '#EF4444',
        borderRadius: 16, paddingVertical: 16, alignItems: 'center',
        shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    },
    scanBtnActive: { backgroundColor: '#B91C1C' },
    scanBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    scanBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: 2 },

    // Community
    communityCard: {
        marginHorizontal: 20, marginTop: 16, backgroundColor: '#1C1917',
        borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F59E0B30',
    },
    communityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    communityTitle: { fontSize: 15, fontWeight: '700', color: '#F59E0B' },
    communityCount: { fontSize: 13, color: '#CCC', marginBottom: 10 },
    communityStats: { gap: 6 },
    commStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    commStatIcon: { fontSize: 14 },
    commStatText: { fontSize: 13, color: '#AAA' },
    reportBar: { height: 4, backgroundColor: '#2A2A2A', borderRadius: 2, marginTop: 10 },
    reportBarFill: { height: 4, borderRadius: 2 },

    // Result card
    resultCard: {
        marginHorizontal: 20, marginTop: 16, backgroundColor: '#111827',
        borderRadius: 20, padding: 20, borderWidth: 1,
    },
    scoreSection: { alignItems: 'center', marginBottom: 16 },
    scoreCircle: {
        width: 90, height: 90, borderRadius: 45, borderWidth: 4,
        justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F',
    },
    scoreNumber: { fontSize: 32, fontWeight: '900' },
    scoreLabel: { fontSize: 12, color: '#777', marginTop: 6, fontWeight: '600', letterSpacing: 1 },

    // Verdict
    verdictBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
    verdictTitle: { fontSize: 16, fontWeight: '800' },
    verdictSub: { fontSize: 12, color: '#999', marginTop: 3 },

    // Reasons
    reasonsSection: { marginBottom: 14 },
    reasonsTitle: { fontSize: 13, color: '#CCC', fontWeight: '700', marginBottom: 8 },
    reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 },
    reasonDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
    reasonText: { fontSize: 13, color: '#AAA', flex: 1 },

    // Triggers
    triggersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    triggerChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    triggerText: { fontSize: 11, fontWeight: '600' },

    // Actions
    resultActions: { flexDirection: 'row', gap: 10 },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 12, borderRadius: 12, gap: 6,
    },
    actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

    // History
    historySection: { marginHorizontal: 20, marginTop: 24 },
    historyTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', marginBottom: 12 },
    historyCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
        borderRadius: 14, padding: 14, marginBottom: 8,
        borderWidth: 1, borderColor: '#222',
    },
    historyDot: { width: 10, height: 10, borderRadius: 5 },
    historyInfo: { flex: 1, marginLeft: 12 },
    historyInput: { fontSize: 14, color: '#DDD', fontWeight: '600' },
    historyTime: { fontSize: 11, color: '#666', marginTop: 3 },
    historyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    historyBadgeText: { fontSize: 11, fontWeight: '700' },

    // Report modal
    reportOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
    reportSheet: {
        backgroundColor: '#111827', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12,
    },
    reportHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    reportTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', marginBottom: 8 },
    reportPreview: { fontSize: 13, color: '#777', marginBottom: 16 },
    reportLabel: { fontSize: 14, fontWeight: '700', color: '#CCC', marginBottom: 10 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    categoryBtn: {
        width: (width - 72) / 3, paddingVertical: 12, alignItems: 'center',
        backgroundColor: '#1A1A2E', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A',
    },
    categoryBtnActive: { borderColor: '#EF4444', backgroundColor: '#EF444415' },
    categoryIcon: { fontSize: 22, marginBottom: 4 },
    categoryLabel: { fontSize: 10, color: '#888', fontWeight: '600', textAlign: 'center' },
    categoryLabelActive: { color: '#EF4444' },
    reportNoteInput: {
        backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, color: '#FFF',
        fontSize: 14, minHeight: 60, textAlignVertical: 'top', marginBottom: 16,
        borderWidth: 1, borderColor: '#2A2A2A',
    },
    submitBtn: {
        backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 16,
        alignItems: 'center', marginBottom: 10,
    },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    reportCancel: { alignItems: 'center', paddingVertical: 10 },
    reportCancelText: { color: '#666', fontSize: 14 },
});
