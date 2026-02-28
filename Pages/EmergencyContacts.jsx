import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTACTS_KEY = '@emergency_contacts';

const EmergencyContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadContacts();
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
      console.error('❌ Failed to load contacts:', error);
      setContacts([]);
    }
  };

  const saveContacts = async (newContacts) => {
    try {
      const jsonValue = JSON.stringify(newContacts);
      await AsyncStorage.setItem(CONTACTS_KEY, jsonValue);
      setContacts(newContacts);
    } catch (error) {
      Alert.alert('Error', 'Failed to save contact: ' + error.message);
    }
  };

  const addOrUpdateContact = () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please enter name and phone number');
      return;
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number (at least 10 digits)');
      return;
    }

    if (editingId) {
      const updatedContacts = contacts.map(c =>
        c.id === editingId
          ? { ...c, name: name.trim(), phone: cleanPhone, phoneNumber: cleanPhone, relationship: relationship.trim() }
          : c
      );
      saveContacts(updatedContacts);
      Alert.alert('✅ Updated', `${name} has been updated`);
      setEditingId(null);
    } else {
      const newContact = {
        id: Date.now().toString(),
        name: name.trim(),
        phone: cleanPhone,
        phoneNumber: cleanPhone,
        relationship: relationship.trim() || 'Emergency Contact',
        addedAt: new Date().toISOString(),
      };
      const updatedContacts = [...contacts, newContact];
      saveContacts(updatedContacts);
      Alert.alert('✅ Added', `${newContact.name} added successfully!`);
    }

    setName('');
    setPhone('');
    setRelationship('');
  };

  const editContact = (contact) => {
    setName(contact.name);
    setPhone(contact.phone || contact.phoneNumber);
    setRelationship(contact.relationship || '');
    setEditingId(contact.id);
  };

  const cancelEdit = () => {
    setName('');
    setPhone('');
    setRelationship('');
    setEditingId(null);
  };

  const deleteContact = (id, contactName) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contactName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedContacts = contacts.filter(c => c.id !== id);
            saveContacts(updatedContacts);
          },
        },
      ]
    );
  };

  const callContact = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const clearAllContacts = () => {
    Alert.alert(
      'Clear All Contacts',
      'Are you sure you want to delete ALL emergency contacts?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(CONTACTS_KEY);
            setContacts([]);
          },
        },
      ]
    );
  };

  const getColorByIndex = (index) => {
    const colors = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1'];
    return colors[index % colors.length];
  };

  const renderContact = ({ item, index }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactRow}>
        <View style={[styles.avatar, { backgroundColor: getColorByIndex(index) }]}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.contactDetails}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>{item.phone}</Text>
          {item.relationship && (
            <View style={styles.relationshipBadge}>
              <Ionicons name="heart" size={10} color="#E53935" />
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
          <Ionicons name="call" size={18} color="#1E88E5" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.smsBtn]}
          onPress={() => Linking.openURL(`sms:${item.phone}`)}
        >
          <Ionicons name="chatbubble" size={18} color="#43A047" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => editContact(item)}
        >
          <Ionicons name="create" size={18} color="#FB8C00" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => deleteContact(item.id, item.name)}
        >
          <Ionicons name="trash" size={18} color="#E53935" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F5F6FA" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Emergency</Text>
          <Text style={styles.title}>Contacts</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{contacts.length}</Text>
          </View>
          {contacts.length > 0 && (
            <TouchableOpacity onPress={clearAllContacts} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={20} color="#E53935" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Add/Edit Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {editingId ? '✏️ Edit Contact' : '+ Add New Contact'}
          </Text>

          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color="#9E9E9E" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Contact Name *"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#BDBDBD"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="call-outline" size={20} color="#9E9E9E" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Phone Number *"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#BDBDBD"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="heart-outline" size={20} color="#9E9E9E" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Relationship (optional)"
              value={relationship}
              onChangeText={setRelationship}
              placeholderTextColor="#BDBDBD"
            />
          </View>

          <View style={styles.buttonRow}>
            {editingId && (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.addButton, editingId && styles.updateButton]}
              onPress={addOrUpdateContact}
            >
              <Ionicons
                name={editingId ? 'checkmark-circle' : 'add-circle'}
                size={22}
                color="#FFFFFF"
              />
              <Text style={styles.addButtonText}>
                {editingId ? 'Update' : 'Add Contact'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contacts List */}
        <View style={styles.listSection}>
          {contacts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="people-outline" size={48} color="#BDBDBD" />
              </View>
              <Text style={styles.emptyText}>No emergency contacts</Text>
              <Text style={styles.emptySubtext}>
                Add your first contact to get started
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.listTitle}>
                Your Contacts ({contacts.length})
              </Text>
              <FlatList
                data={contacts}
                renderItem={renderContact}
                keyExtractor={item => item.id}
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
    backgroundColor: '#F5F6FA',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 55,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: '#F5F6FA',
  },
  headerLabel: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countBadge: {
    backgroundColor: '#E53935',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  // Form
  formCard: {
    marginHorizontal: 20,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 15,
    color: '#1A1A2E',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
  },
  updateButton: {
    backgroundColor: '#43A047',
  },
  cancelButton: {
    flex: 0.4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingVertical: 15,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButtonText: {
    color: '#757575',
    fontSize: 15,
    fontWeight: '600',
  },
  // List
  listSection: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 14,
  },
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contactDetails: {
    marginLeft: 14,
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  contactPhone: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 2,
  },
  relationshipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  relationshipText: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: '500',
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtn: {
    backgroundColor: '#E3F2FD',
  },
  smsBtn: {
    backgroundColor: '#E8F5E9',
  },
  editBtn: {
    backgroundColor: '#FFF8E1',
  },
  deleteBtn: {
    backgroundColor: '#FFEBEE',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9E9E9E',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BDBDBD',
    marginTop: 6,
  },
});