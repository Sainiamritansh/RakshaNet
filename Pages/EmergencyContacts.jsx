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
    
    // Also reload when app comes to foreground
    const interval = setInterval(() => {
      loadContacts();
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadContacts = async () => {
    try {
      console.log('📥 Loading contacts from AsyncStorage...');
      const savedContacts = await AsyncStorage.getItem(CONTACTS_KEY);
      console.log('📥 Raw data:', savedContacts);
      
      if (savedContacts !== null) {
        const parsed = JSON.parse(savedContacts);
        setContacts(parsed);
        console.log('✅ Loaded contacts:', parsed.length, 'contacts');
        console.log('📋 Contact details:', JSON.stringify(parsed, null, 2));
      } else {
        console.log('📭 No saved contacts found');
        setContacts([]);
      }
    } catch (error) {
      console.error('❌ Failed to load contacts:', error);
      Alert.alert('Error', 'Failed to load contacts: ' + error.message);
      setContacts([]);
    }
  };

  const saveContacts = async (newContacts) => {
    try {
      const jsonValue = JSON.stringify(newContacts);
      await AsyncStorage.setItem(CONTACTS_KEY, jsonValue);
      setContacts(newContacts);
      console.log('✅ Saved contacts:', newContacts.length, 'Data:', jsonValue);
      
      // Verify save
      const verification = await AsyncStorage.getItem(CONTACTS_KEY);
      console.log('✅ Verified save:', verification ? 'Success' : 'Failed');
    } catch (error) {
      console.error('❌ Failed to save contacts:', error);
      Alert.alert('Error', 'Failed to save contact: ' + error.message);
    }
  };

  const addOrUpdateContact = () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please enter name and phone number');
      return;
    }

    // Clean and validate phone
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number (at least 10 digits)');
      return;
    }

    if (editingId) {
      // Update existing contact
      const updatedContacts = contacts.map(c => 
        c.id === editingId 
          ? { ...c, name: name.trim(), phone: cleanPhone, phoneNumber: cleanPhone, relationship: relationship.trim() }
          : c
      );
      saveContacts(updatedContacts);
      Alert.alert('✅ Updated', `${name} has been updated`);
      setEditingId(null);
    } else {
      // Add new contact
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
    
    // Clear form
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
            Alert.alert('Deleted', `${contactName} removed`);
          },
        },
      ]
    );
  };

  const callContact = (phoneNumber, contactName) => {
    Alert.alert(
      'Call Contact',
      `Call ${contactName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => Linking.openURL(`tel:${phoneNumber}`)
        }
      ]
    );
  };

  const sendSMS = (phoneNumber, contactName) => {
    Alert.alert(
      'Send SMS',
      `Send message to ${contactName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => Linking.openURL(`sms:${phoneNumber}`)
        }
      ]
    );
  };

  const exportContacts = async () => {
    try {
      const contactsText = contacts.map(c => 
        `${c.name} - ${c.phone} (${c.relationship || 'N/A'})`
      ).join('\n');
      
      Alert.alert(
        'Emergency Contacts',
        contactsText || 'No contacts to export',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const clearAllContacts = () => {
    Alert.alert(
      'Clear All Contacts',
      'Are you sure you want to delete ALL emergency contacts? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(CONTACTS_KEY);
            setContacts([]);
            Alert.alert('Cleared', 'All contacts have been removed');
          }
        }
      ]
    );
  };

  const renderContact = ({ item, index }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactHeader}>
        <View style={styles.contactInfo}>
          <View style={[styles.iconCircle, { backgroundColor: getColorByIndex(index) }]}>
            <Text style={styles.iconText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.contactDetails}>
            <Text style={styles.contactName}>{item.name}</Text>
            <Text style={styles.contactPhone}>{item.phone}</Text>
            {item.relationship && (
              <Text style={styles.contactRelationship}>
                <Ionicons name="heart" size={12} color="#ff6b6b" /> {item.relationship}
              </Text>
            )}
          </View>
        </View>
      </View>
      
      <View style={styles.contactActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => callContact(item.phone, item.name)}
        >
          <Ionicons name="call" size={20} color="#4a90e2" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => sendSMS(item.phone, item.name)}
        >
          <Ionicons name="chatbubble" size={20} color="#10b981" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => editContact(item)}
        >
          <Ionicons name="create" size={20} color="#f59e0b" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => deleteContact(item.id, item.name)}
        >
          <Ionicons name="trash" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const getColorByIndex = (index) => {
    const colors = ['#4a90e2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[index % colors.length];
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>🚨 Emergency Contacts</Text>
        <Text style={styles.subtitle}>
          Contacts will receive SMS alerts during emergencies
        </Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{contacts.length}</Text>
            <Text style={styles.statLabel}>Contacts</Text>
          </View>
          
          {contacts.length > 0 && (
            <>
              <TouchableOpacity 
                style={styles.statBox}
                onPress={exportContacts}
              >
                <Ionicons name="document-text" size={24} color="#4a90e2" />
                <Text style={styles.statLabel}>View All</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.statBox}
                onPress={clearAllContacts}
              >
                <Ionicons name="trash" size={24} color="#ef4444" />
                <Text style={styles.statLabel}>Clear All</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.formTitle}>
            {editingId ? '✏️ Edit Contact' : '➕ Add New Contact'}
          </Text>
          
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Contact Name *"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Phone Number *"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="heart-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Relationship (optional)"
              value={relationship}
              onChangeText={setRelationship}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.buttonRow}>
            {editingId && (
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={cancelEdit}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.button, styles.addButton, editingId && styles.updateButton]} 
              onPress={addOrUpdateContact}
            >
              <Ionicons 
                name={editingId ? "checkmark-circle-outline" : "add-circle-outline"} 
                size={24} 
                color="#fff" 
              />
              <Text style={styles.addButtonText}>
                {editingId ? 'Update Contact' : 'Add Contact'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.listContainer}>
          {contacts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={80} color="#ccc" />
              <Text style={styles.emptyText}>No emergency contacts yet</Text>
              <Text style={styles.emptySubtext}>
                Add your first contact to get started
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>
                  📋 Your Contacts ({contacts.length})
                </Text>
                <TouchableOpacity onPress={loadContacts}>
                  <Ionicons name="refresh-outline" size={24} color="#4a90e2" />
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={contacts}
                renderItem={renderContact}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  statBox: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    minWidth: 80,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4a90e2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 2,
    marginBottom: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
  },
  addButton: {
    backgroundColor: '#4a90e2',
  },
  updateButton: {
    backgroundColor: '#10b981',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  list: {
    paddingBottom: 20,
  },
  contactCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  contactHeader: {
    marginBottom: 12,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  contactDetails: {
    marginLeft: 15,
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  contactRelationship: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});