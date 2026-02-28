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

const { width } = Dimensions.get('window');

const CONFIDENCE_COLORS = {
    safe: '#4CAF50',
    low: '#8BC34A',
    medium: '#FFC107',
    high: '#F44336',
    blocked: '#9E9E9E',
};

const CONFIDENCE_LABELS = {
    safe: 'Safe',
    low: 'Low Risk',
    medium: 'Suspicious',
    high: 'Spam',
    blocked: 'Blocked',
};

export default function SpamShield() {
    const [shieldActive, setShieldActive] = useState(false);
    const [history, setHistory] = useState([]);
    const [blocklist, setBlocklist] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('history'); // history | blocklist
    const [expandedId, setExpandedId] = useState(null);
    const [alertRecord, setAlertRecord] = useState(null);
    const [showAlert, setShowAlert] = useState(false);
    const slideAnim = useRef(new Animated.Value(300)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        loadData();
        initShield();

        // Pulse animation for active shield
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
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

    const handleUnblock = async (number) => {
        Alert.alert('Unblock?', `Unblock ${number}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Unblock', onPress: async () => {
                    await unblockNumber(number);
                    await loadData();
                }
            },
        ]);
    };

    const handleClearHistory = () => {
        Alert.alert('Clear History?', 'Delete all spam history records?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: async () => { await clearHistory(); await loadData(); } },
        ]);
    };

    // ───── Render SMS Item ─────
    const renderSMSItem = ({ item }) => {
        const isExpanded = expandedId === item.id;
        const confColor = CONFIDENCE_COLORS[item.confidence] || '#9E9E9E';
        const confLabel = CONFIDENCE_LABELS[item.confidence] || 'Unknown';
        const links = item.links || [];
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString([], { day: '2-digit', month: 'short' });

        return (
            <TouchableOpacity
                style={styles.smsCard}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
                activeOpacity={0.8}
            >
                {/* Header Row */}
                <View style={styles.smsHeader}>
                    <View style={styles.smsHeaderLeft}>
                        <View style={[styles.confDot, { backgroundColor: confColor }]} />
                        <View>
                            <Text style={styles.smsSender}>{item.sender}</Text>
                            <Text style={styles.smsTime}>{dateStr} · {timeStr}</Text>
                        </View>
                    </View>
                    <View style={styles.smsHeaderRight}>
                        <View style={[styles.confBadge, { backgroundColor: confColor + '20', borderColor: confColor }]}>
                            <Text style={[styles.confText, { color: confColor }]}>{confLabel}</Text>
                        </View>
                        {item.action && item.action !== 'none' && (
                            <View style={styles.actionBadge}>
                                <Text style={styles.actionBadgeText}>
                                    {item.action === 'blocked' ? '🚫' : item.action === 'reported' ? '📢' : ''}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Preview */}
                <Text style={styles.smsPreview} numberOfLines={isExpanded ? 0 : 2}>
                    {item.safeText || item.body}
                </Text>

                {/* Links Warning */}
                {links.length > 0 && (
                    <View style={styles.linkWarning}>
                        <Ionicons name="warning" size={14} color="#FFC107" />
                        <Text style={styles.linkWarningText}>
                            {links.length} link(s) detected — ⚠️ Link blocked by RakshaNet
                        </Text>
                    </View>
                )}

                {/* Expanded Details */}
                {isExpanded && (
                    <View style={styles.expandedSection}>
                        {/* Reasons */}
                        {item.reasons && item.reasons.length > 0 && (
                            <View style={styles.reasonsBox}>
                                <Text style={styles.reasonsTitle}>Detection Reasons:</Text>
                                {item.reasons.map((r, i) => (
                                    <Text key={i} style={styles.reasonItem}>• {r}</Text>
                                ))}
                            </View>
                        )}

                        {/* Score */}
                        <View style={styles.scoreRow}>
                            <Text style={styles.scoreLabel}>Spam Score:</Text>
                            <View style={styles.scoreBar}>
                                <View style={[styles.scoreFill, { width: `${item.score || 0}%`, backgroundColor: confColor }]} />
                            </View>
                            <Text style={[styles.scoreValue, { color: confColor }]}>{item.score || 0}%</Text>
                        </View>

                        {/* Actions */}
                        <View style={styles.expandedActions}>
                            <TouchableOpacity
                                style={[styles.expandedBtn, { backgroundColor: '#F44336' }]}
                                onPress={() => handleBlock(item.sender, item.id)}
                            >
                                <Ionicons name="ban" size={16} color="#FFF" />
                                <Text style={styles.expandedBtnText}>Block</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.expandedBtn, { backgroundColor: '#FF9800' }]}
                                onPress={() => handleReport(item.sender, item.body, item.id)}
                            >
                                <Ionicons name="flag" size={16} color="#FFF" />
                                <Text style={styles.expandedBtnText}>Report</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    // ───── Render Blocklist Item ─────
    const renderBlockItem = ({ item }) => (
        <View style={styles.blockCard}>
            <View style={styles.blockInfo}>
                <Ionicons name="ban" size={20} color="#F44336" />
                <View style={{ marginLeft: 12 }}>
                    <Text style={styles.blockNumber}>{item.number}</Text>
                    <Text style={styles.blockDate}>
                        Blocked {new Date(item.blockedAt).toLocaleDateString()}
                    </Text>
                </View>
            </View>
            <TouchableOpacity
                style={styles.unblockBtn}
                onPress={() => handleUnblock(item.number)}
            >
                <Text style={styles.unblockText}>Unblock</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerLabel}>SMS Protection</Text>
                        <Text style={styles.headerTitle}>Spam Shield</Text>
                    </View>
                    <Animated.View style={[styles.shieldIcon, shieldActive && styles.shieldActive, { transform: [{ scale: shieldActive ? pulseAnim : 1 }] }]}>
                        <Ionicons
                            name={shieldActive ? 'shield-checkmark' : 'shield-outline'}
                            size={28}
                            color={shieldActive ? '#4CAF50' : '#9E9E9E'}
                        />
                    </Animated.View>
                </View>

                {/* Shield Toggle */}
                <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                        <View style={[styles.activeDot, { backgroundColor: shieldActive ? '#4CAF50' : '#F44336' }]} />
                        <Text style={styles.toggleLabel}>
                            {shieldActive ? 'Shield Active — Monitoring SMS' : 'Shield Inactive'}
                        </Text>
                    </View>
                    <Switch
                        value={shieldActive}
                        onValueChange={toggleShield}
                        trackColor={{ false: '#333', true: '#2E7D32' }}
                        thumbColor={shieldActive ? '#4CAF50' : '#666'}
                    />
                </View>

                {/* Quick Actions */}
                <View style={styles.quickRow}>
                    <TouchableOpacity style={styles.quickBtn} onPress={handleScanInbox}>
                        <Ionicons name="scan" size={18} color="#FFC107" />
                        <Text style={styles.quickBtnText}>Scan Inbox</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickBtn} onPress={handleClearHistory}>
                        <Ionicons name="trash-outline" size={18} color="#F44336" />
                        <Text style={styles.quickBtnText}>Clear</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'history' && styles.tabActive]}
                    onPress={() => setActiveTab('history')}
                >
                    <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                        History ({history.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'blocklist' && styles.tabActive]}
                    onPress={() => setActiveTab('blocklist')}
                >
                    <Text style={[styles.tabText, activeTab === 'blocklist' && styles.tabTextActive]}>
                        Blocklist ({blocklist.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'history' ? (
                history.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="shield-checkmark" size={64} color="#2E7D32" />
                        <Text style={styles.emptyTitle}>All Clear!</Text>
                        <Text style={styles.emptySubtitle}>No spam messages detected yet</Text>
                    </View>
                ) : (
                    <FlatList
                        data={history}
                        renderItem={renderSMSItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E53935" />
                        }
                    />
                )
            ) : (
                blocklist.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="list-outline" size={64} color="#555" />
                        <Text style={styles.emptyTitle}>No Blocked Numbers</Text>
                        <Text style={styles.emptySubtitle}>Blocked numbers will appear here</Text>
                    </View>
                ) : (
                    <FlatList
                        data={blocklist}
                        renderItem={renderBlockItem}
                        keyExtractor={item => item.number}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )
            )}

            {/* Spam Alert Modal — slides up */}
            {alertRecord && (
                <Modal visible={showAlert} transparent animationType="none">
                    <View style={styles.alertOverlay}>
                        <Animated.View style={[styles.alertContainer, { transform: [{ translateY: slideAnim }] }]}>
                            <View style={styles.alertHandle} />
                            <View style={styles.alertHeader}>
                                <Ionicons name="warning" size={32} color="#F44336" />
                                <Text style={styles.alertTitle}>SPAM DETECTED</Text>
                            </View>
                            <Text style={styles.alertSender}>{alertRecord.sender}</Text>
                            <Text style={styles.alertPreview} numberOfLines={3}>{alertRecord.body}</Text>

                            <View style={[styles.alertConfBadge, {
                                backgroundColor: (CONFIDENCE_COLORS[alertRecord.confidence] || '#999') + '20',
                                borderColor: CONFIDENCE_COLORS[alertRecord.confidence] || '#999',
                            }]}>
                                <Text style={[styles.alertConfText, { color: CONFIDENCE_COLORS[alertRecord.confidence] }]}>
                                    {(CONFIDENCE_LABELS[alertRecord.confidence] || 'Unknown').toUpperCase()} CONFIDENCE
                                </Text>
                            </View>

                            {alertRecord.reasons && alertRecord.reasons.length > 0 && (
                                <View style={styles.alertReasons}>
                                    {alertRecord.reasons.slice(0, 3).map((r, i) => (
                                        <Text key={i} style={styles.alertReasonText}>• {r}</Text>
                                    ))}
                                </View>
                            )}

                            <View style={styles.alertActions}>
                                <TouchableOpacity
                                    style={[styles.alertBtn, { backgroundColor: '#F44336' }]}
                                    onPress={() => handleBlock(alertRecord.sender, alertRecord.id)}
                                >
                                    <Ionicons name="ban" size={18} color="#FFF" />
                                    <Text style={styles.alertBtnText}>Block Number</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.alertBtn, { backgroundColor: '#FF9800' }]}
                                    onPress={() => handleReport(alertRecord.sender, alertRecord.body, alertRecord.id)}
                                >
                                    <Ionicons name="flag" size={18} color="#FFF" />
                                    <Text style={styles.alertBtnText}>Report Number</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={styles.alertDismiss}
                                onPress={() => setShowAlert(false)}
                            >
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
    container: { flex: 1, backgroundColor: '#1A1A2E' },

    // Header
    header: {
        paddingTop: 55,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: '#16213E',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerLabel: { fontSize: 13, color: '#E53935', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
    headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
    shieldIcon: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
    },
    shieldActive: { borderColor: 'rgba(76, 175, 80, 0.5)', backgroundColor: 'rgba(76, 175, 80, 0.1)' },

    // Toggle
    toggleRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
        paddingHorizontal: 16, paddingVertical: 12, marginTop: 14,
    },
    toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    activeDot: { width: 10, height: 10, borderRadius: 5 },
    toggleLabel: { fontSize: 14, color: '#CCC', fontWeight: '600' },

    // Quick actions
    quickRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    quickBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
        paddingVertical: 10, gap: 8,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    quickBtnText: { fontSize: 13, color: '#AAA', fontWeight: '600' },

    // Tabs
    tabs: {
        flexDirection: 'row', marginHorizontal: 20, marginTop: 16,
        backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4,
    },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    tabActive: { backgroundColor: '#E53935' },
    tabText: { fontSize: 14, color: '#888', fontWeight: '600' },
    tabTextActive: { color: '#FFF' },

    // List
    listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },

    // SMS Card
    smsCard: {
        backgroundColor: '#16213E', borderRadius: 16, padding: 16, marginBottom: 10,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    smsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    smsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    confDot: { width: 12, height: 12, borderRadius: 6 },
    smsSender: { fontSize: 15, fontWeight: '700', color: '#EEE' },
    smsTime: { fontSize: 11, color: '#777', marginTop: 2 },
    smsHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    confBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    confText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    actionBadge: { marginLeft: 2 },
    actionBadgeText: { fontSize: 14 },
    smsPreview: { fontSize: 13, color: '#AAA', marginTop: 10, lineHeight: 19 },
    linkWarning: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255, 193, 7, 0.08)', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 6, marginTop: 8,
    },
    linkWarningText: { fontSize: 11, color: '#FFC107', fontWeight: '500', flex: 1 },

    // Expanded
    expandedSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 },
    reasonsBox: { marginBottom: 10 },
    reasonsTitle: { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 4 },
    reasonItem: { fontSize: 12, color: '#AAA', marginLeft: 4, marginTop: 2 },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    scoreLabel: { fontSize: 12, color: '#888', fontWeight: '600' },
    scoreBar: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3 },
    scoreFill: { height: 6, borderRadius: 3 },
    scoreValue: { fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' },
    expandedActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    expandedBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 10, borderRadius: 10, gap: 6,
    },
    expandedBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

    // Block card
    blockCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#16213E', borderRadius: 14, padding: 16, marginBottom: 10,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    blockInfo: { flexDirection: 'row', alignItems: 'center' },
    blockNumber: { fontSize: 15, fontWeight: '700', color: '#EEE' },
    blockDate: { fontSize: 11, color: '#777', marginTop: 2 },
    unblockBtn: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
        borderWidth: 1, borderColor: '#F44336',
    },
    unblockText: { fontSize: 12, fontWeight: '700', color: '#F44336' },

    // Empty state
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: '#666', marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: '#555', marginTop: 6 },

    // Alert modal
    alertOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    alertContainer: {
        backgroundColor: '#16213E', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12,
    },
    alertHandle: {
        width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2, alignSelf: 'center', marginBottom: 16,
    },
    alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    alertTitle: { fontSize: 22, fontWeight: '900', color: '#F44336', letterSpacing: 1 },
    alertSender: { fontSize: 16, fontWeight: '700', color: '#EEE', marginBottom: 8 },
    alertPreview: { fontSize: 14, color: '#AAA', lineHeight: 20, marginBottom: 12 },
    alertConfBadge: {
        alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 10, borderWidth: 1, marginBottom: 12,
    },
    alertConfText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    alertReasons: { marginBottom: 16 },
    alertReasonText: { fontSize: 13, color: '#999', marginTop: 3 },
    alertActions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    alertBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, borderRadius: 14, gap: 8,
    },
    alertBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    alertDismiss: { alignItems: 'center', paddingVertical: 10 },
    alertDismissText: { color: '#777', fontSize: 14, fontWeight: '500' },
});
