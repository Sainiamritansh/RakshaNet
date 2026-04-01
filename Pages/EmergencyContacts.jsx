import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ScrollView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerDeviceForSiren } from "../services/SOSSirenService";
import { COLORS, TYPOGRAPHY, RADIUS, SPACING, SHADOWS } from "../src/theme";

const MY_PHONE_KEY = "@my_phone_number";
const CONTACTS_KEY = "@emergency_contacts";

const EmergencyContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [myPhone, setMyPhone] = useState("");
  const [myPhoneInput, setMyPhoneInput] = useState("");
  const [myPhoneSaved, setMyPhoneSaved] = useState(false);

  useEffect(() => {
    loadContacts();
    loadMyPhone();
    const interval = setInterval(() => {
      loadContacts();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadContacts = async () => {
    try {
      const savedContacts = await AsyncStorage.getItem(CONTACTS_KEY);
      if (savedContacts !== null) {
        setContacts(JSON.parse(savedContacts));
      } else {
        setContacts([]);
      }
    } catch (error) {
      console.error("❌ Failed to load contacts:", error);
      setContacts([]);
    }
  };

  const loadMyPhone = async () => {
    try {
      const saved = await AsyncStorage.getItem(MY_PHONE_KEY);
      if (saved) {
        setMyPhone(saved);
        setMyPhoneInput(saved);
        setMyPhoneSaved(true);
      }
    } catch (e) {}
  };

  const saveMyPhone = async () => {
    const cleaned = myPhoneInput.replace(/[\s\-\(\)]/g, "");
    if (cleaned.length < 10) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }
    await AsyncStorage.setItem(MY_PHONE_KEY, cleaned);
    setMyPhone(cleaned);
    setMyPhoneSaved(true);
    await registerDeviceForSiren(cleaned);
    Alert.alert(
      "✅ Saved",
      "Your number is saved. You will now receive SOS sirens.",
    );
  };

  const saveContacts = async (newContacts) => {
    try {
      const jsonValue = JSON.stringify(newContacts);
      await AsyncStorage.setItem(CONTACTS_KEY, jsonValue);
      setContacts(newContacts);
    } catch (error) {
      Alert.alert("Error", "Failed to save contact: " + error.message);
    }
  };

  const addOrUpdateContact = () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Error", "Please enter name and phone number");
      return;
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
    if (cleanPhone.length < 10) {
      Alert.alert(
        "Error",
        "Please enter a valid phone number (at least 10 digits)",
      );
      return;
    }

    if (editingId) {
      const updatedContacts = contacts.map((c) =>
        c.id === editingId
          ? {
              ...c,
              name: name.trim(),
              phone: cleanPhone,
              phoneNumber: cleanPhone,
              relationship: relationship.trim(),
            }
          : c,
      );
      saveContacts(updatedContacts);
      Alert.alert("✅ Updated", `${name} has been updated`);
      setEditingId(null);
    } else {
      const newContact = {
        id: Date.now().toString(),
        name: name.trim(),
        phone: cleanPhone,
        phoneNumber: cleanPhone,
        relationship: relationship.trim() || "Emergency Contact",
        addedAt: new Date().toISOString(),
      };
      const updatedContacts = [...contacts, newContact];
      saveContacts(updatedContacts);
      Alert.alert("✅ Added", `${newContact.name} added successfully!`);
    }

    setName("");
    setPhone("");
    setRelationship("");
  };

  const editContact = (contact) => {
    setName(contact.name);
    setPhone(contact.phone || contact.phoneNumber);
    setRelationship(contact.relationship || "");
    setEditingId(contact.id);
  };

  const cancelEdit = () => {
    setName("");
    setPhone("");
    setRelationship("");
    setEditingId(null);
  };

  const deleteContact = (id, contactName) => {
    Alert.alert(
      "Delete Contact",
      `Are you sure you want to delete ${contactName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const updatedContacts = contacts.filter((c) => c.id !== id);
            saveContacts(updatedContacts);
          },
        },
      ],
    );
  };

  const callContact = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const clearAllContacts = () => {
    Alert.alert(
      "Clear All Contacts",
      "Are you sure you want to delete ALL emergency contacts?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem(CONTACTS_KEY);
            setContacts([]);
          },
        },
      ],
    );
  };

  const getColorByIndex = (index) => {
    const colors = [
      COLORS.primary,
      COLORS.info,
      COLORS.successDark,
      COLORS.warning,
      "#8E24AA",
      "#00ACC1",
    ];
    return colors[index % colors.length];
  };

  const renderContact = ({ item, index }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactRow}>
        <View
          style={[styles.avatar, { backgroundColor: getColorByIndex(index) }]}
        >
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.contactDetails}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>{item.phone}</Text>
          {item.relationship && (
            <View style={styles.relationshipBadge}>
              <Ionicons name="heart" size={10} color={COLORS.primary} />
              <Text style={styles.relationshipText}>{item.relationship}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.contactActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.callBtn]}
          onPress={() => callContact(item.phone)}
        >
          <Ionicons name="call" size={18} color={COLORS.info} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.smsBtn]}
          onPress={() => Linking.openURL(`sms:${item.phone}`)}
        >
          <Ionicons name="chatbubble" size={18} color={COLORS.successDark} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => editContact(item)}
        >
          <Ionicons name="create" size={18} color={COLORS.warning} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => deleteContact(item.id, item.name)}
        >
          <Ionicons name="trash" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Red Header Bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerBrand}>RakshaNet</Text>
        <View style={styles.headerRight}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{contacts.length}</Text>
          </View>
          {contacts.length > 0 && (
            <TouchableOpacity
              onPress={clearAllContacts}
              style={styles.clearBtn}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Page Title */}
      <View style={styles.titleSection}>
        <Text style={styles.pageTitle}>Guardian Network</Text>
        <Text style={styles.pageSubtitle}>
          Manage your circle of support and care
        </Text>
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* My Primary Device */}
        <View style={styles.deviceCard}>
          <View style={styles.deviceHeader}>
            <View style={styles.deviceIconBg}>
              <Ionicons name="phone-portrait" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.deviceTitle}>My Primary Device</Text>
            {myPhoneSaved && (
              <View style={styles.connectedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={styles.connectedText}>Connected</Text>
              </View>
            )}
          </View>

          <Text style={styles.devicePhone}>
            {myPhoneSaved ? myPhone : "No number registered"}
          </Text>
          <Text style={styles.deviceHint}>
            Required to receive SOS siren alerts from others
          </Text>

          <View style={styles.phoneInputRow}>
            <View style={styles.phoneInputWrapper}>
              <Text style={styles.phonePrefix}>+1</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="(555) 012-3456"
                value={myPhoneInput}
                onChangeText={setMyPhoneInput}
                keyboardType="phone-pad"
                placeholderTextColor={COLORS.textMutedLight}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.registerBtn,
              myPhoneSaved && styles.registerBtnSaved,
            ]}
            onPress={saveMyPhone}
          >
            <Ionicons
              name={myPhoneSaved ? "checkmark-circle" : "arrow-forward"}
              size={20}
              color={COLORS.textPrimary}
            />
            <Text style={styles.registerBtnText}>
              {myPhoneSaved ? "Number Saved ✓" : "Register Now"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Add New Guardian */}
        <View style={styles.formCard}>
          <View style={styles.formTitleRow}>
            <Ionicons name="person-add" size={20} color={COLORS.primary} />
            <Text style={styles.formTitle}>
              {editingId ? "Edit Guardian" : "Add New Guardian"}
            </Text>
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons
              name="person-outline"
              size={20}
              color={COLORS.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              placeholderTextColor={COLORS.textMutedLight}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons
              name="heart-outline"
              size={20}
              color={COLORS.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Relationship"
              value={relationship}
              onChangeText={setRelationship}
              placeholderTextColor={COLORS.textMutedLight}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons
              name="call-outline"
              size={20}
              color={COLORS.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor={COLORS.textMutedLight}
            />
          </View>

          <View style={styles.buttonRow}>
            {editingId && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelEdit}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.saveButton, editingId && styles.updateButton]}
              onPress={addOrUpdateContact}
            >
              <Ionicons
                name={editingId ? "checkmark-circle" : "add-circle"}
                size={22}
                color={COLORS.textPrimary}
              />
              <Text style={styles.saveButtonText}>
                {editingId ? "Update" : "Save Guardian"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Guardians */}
        <View style={styles.listSection}>
          {contacts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="people-outline" size={48} color={COLORS.textMutedLight} />
              </View>
              <Text style={styles.emptyText}>No guardians yet</Text>
              <Text style={styles.emptySubtext}>
                Add your first guardian to get started
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>Active Guardians</Text>
                <View style={styles.fullGuardBadge}>
                  <Text style={styles.fullGuardText}>Full Guard</Text>
                </View>
              </View>
              <FlatList
                data={contacts}
                renderItem={renderContact}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default EmergencyContacts;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgLightGrey,
  },

  // Red Header Bar
  headerBar: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerBrand: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  countBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  countText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Title Section
  titleSection: {
    backgroundColor: COLORS.primary,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
  },
  pageTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  pageSubtitle: {
    ...TYPOGRAPHY.caption,
    color: "rgba(255,255,255,0.7)",
  },

  scrollContent: {
    flex: 1,
  },

  // My Primary Device
  deviceCard: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
    backgroundColor: COLORS.bgLight,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.md,
  },
  deviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  deviceIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryBg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.sm,
  },
  deviceTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textDark,
    flex: 1,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
  },
  connectedText: {
    ...TYPOGRAPHY.small,
    color: COLORS.success,
  },
  devicePhone: {
    ...TYPOGRAPHY.body,
    color: COLORS.textDark,
    fontWeight: "600",
    marginBottom: SPACING.xs,
  },
  deviceHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  phoneInputRow: {
    marginBottom: SPACING.md,
  },
  phoneInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgLightGrey,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
  },
  phonePrefix: {
    ...TYPOGRAPHY.body,
    fontWeight: "700",
    color: COLORS.textDark,
    paddingHorizontal: SPACING.lg,
    borderRightWidth: 1,
    borderRightColor: "#EEEEEE",
    paddingVertical: SPACING.lg,
  },
  phoneInput: {
    flex: 1,
    height: 50,
    ...TYPOGRAPHY.body,
    color: COLORS.textDark,
    paddingHorizontal: SPACING.lg,
  },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  registerBtnSaved: {
    backgroundColor: COLORS.successDark,
  },
  registerBtnText: {
    color: COLORS.textPrimary,
    ...TYPOGRAPHY.body,
    fontWeight: "700",
  },

  // Add New Guardian Form
  formCard: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.bgLight,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.md,
  },
  formTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  formTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textDark,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.bgLightGrey,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  inputIcon: {
    marginRight: SPACING.md,
  },
  input: {
    flex: 1,
    height: 50,
    ...TYPOGRAPHY.body,
    color: COLORS.textDark,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: SPACING.sm,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    gap: SPACING.sm,
  },
  updateButton: {
    backgroundColor: COLORS.successDark,
  },
  cancelButton: {
    flex: 0.4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgLightGrey,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
  },
  saveButtonText: {
    color: COLORS.textPrimary,
    ...TYPOGRAPHY.body,
    fontWeight: "700",
  },
  cancelButtonText: {
    color: "#757575",
    ...TYPOGRAPHY.body,
    fontWeight: "600",
  },

  // Active Guardians List
  listSection: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  listTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textDark,
  },
  fullGuardBadge: {
    backgroundColor: COLORS.primaryBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
  },
  fullGuardText: {
    ...TYPOGRAPHY.small,
    color: COLORS.primary,
  },
  contactCard: {
    backgroundColor: COLORS.bgLight,
    borderRadius: RADIUS.xl - 2,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  contactDetails: {
    marginLeft: 14,
    flex: 1,
  },
  contactName: {
    ...TYPOGRAPHY.body,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  contactPhone: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  relationshipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  relationshipText: {
    ...TYPOGRAPHY.small,
    color: COLORS.primary,
  },
  contactActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  callBtn: {
    backgroundColor: COLORS.infoLight,
  },
  smsBtn: {
    backgroundColor: COLORS.successLight,
  },
  editBtn: {
    backgroundColor: COLORS.warningLight,
  },
  deleteBtn: {
    backgroundColor: COLORS.dangerLight,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.divider,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
  },
  emptySubtext: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMutedLight,
    marginTop: 6,
  },
});
