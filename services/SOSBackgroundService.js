import { NativeModules, Platform } from 'react-native';

const { SOSNativeModule } = NativeModules;

/**
 * Sync emergency contacts to native SharedPreferences
 * so the AccessibilityService can read them even when the app is closed.
 */
export async function syncContactsToNative(contacts) {
    if (Platform.OS !== 'android' || !SOSNativeModule) {
        console.log('SOSNativeModule not available');
        return false;
    }

    try {
        const contactsJson = JSON.stringify(contacts);
        await SOSNativeModule.syncContacts(contactsJson);
        console.log('✅ Contacts synced to native:', contacts.length, 'contacts');
        return true;
    } catch (error) {
        console.error('❌ Failed to sync contacts to native:', error);
        return false;
    }
}

/**
 * Check if the app was launched via the background SOS shortcut (volume up x3).
 */
export async function checkSOSIntent() {
    if (Platform.OS !== 'android' || !SOSNativeModule) {
        return false;
    }

    try {
        const triggered = await SOSNativeModule.checkSOSIntent();
        return triggered;
    } catch (error) {
        console.error('Error checking SOS intent:', error);
        return false;
    }
}

/**
 * Open Android Accessibility Settings so user can enable the background SOS service.
 */
export async function openAccessibilitySettings() {
    if (Platform.OS !== 'android' || !SOSNativeModule) {
        return false;
    }

    try {
        await SOSNativeModule.openAccessibilitySettings();
        return true;
    } catch (error) {
        console.error('Error opening accessibility settings:', error);
        return false;
    }
}

/**
 * Check if the accessibility service is currently enabled.
 */
export async function isSOSServiceEnabled() {
    if (Platform.OS !== 'android' || !SOSNativeModule) {
        return false;
    }

    try {
        const enabled = await SOSNativeModule.isServiceEnabled();
        return enabled;
    } catch (error) {
        console.error('Error checking service status:', error);
        return false;
    }
}
