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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const CONTACTS_KEY = '@emergency_contacts';

const EmergencyContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const savedContacts = await AsyncStorage.getItem(CONTACTS_KEY);
      if (savedContacts) {
        setContacts(JSON.parse(savedContacts));
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const saveContacts = async (newContacts) => {
    try {
      await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(newContacts));
      setContacts(newContacts);
    } catch (error) {
      console.error('Failed to save contacts:', error);
      Alert.alert('Error', 'Failed to save contact');
    }
  };

  const addContact = () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please enter both name and phone number');
      return;
    }

    // Basic phone validation
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    const newContact = {
      id: Date.now().toString(),
      name: name.trim(),
      phone: phone.trim(),
    };

    const updatedContacts = [...contacts, newContact];
    saveContacts(updatedContacts);
    
    setName('');
    setPhone('');
    Alert.alert('Success', 'Emergency contact added');
  };

  const deleteContact = (id) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this contact?',
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

  const renderContact = ({ item }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactInfo}>
        <Ionicons name="person-circle" size={40} color="#4a90e2" />
        <View style={styles.contactDetails}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>{item.phone}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => deleteContact(item.id)}
        style={styles.deleteButton}
      >
        <Ionicons name="trash" size={24} color="#ff3b30" />
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Emergency Contacts</Text>
        <Text style={styles.subtitle}>
          Add contacts who will receive your SOS alert
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Contact Name"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Ionicons name="call" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor="#999"
          />
        </View>

        <TouchableOpacity style={styles.addButton} onPress={addContact}>
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add Contact</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        {contacts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>No emergency contacts yet</Text>
            <Text style={styles.emptySubtext}>
              Add contacts who should receive your SOS alerts
            </Text>
          </View>
        ) : (
          <FlatList
            data={contacts}
            renderItem={renderContact}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  inputContainer: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    marginBottom: 15,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a90e2',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  listContainer: {
    flex: 1,
    marginTop: 10,
  },
  list: {
    padding: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  },
  deleteButton: {
    padding: 10,
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