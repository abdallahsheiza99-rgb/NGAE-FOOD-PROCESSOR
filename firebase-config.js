/**
 * =====================================================================
 * FIREBASE CONFIGURATION - NGAE FOOD PROCESSORS HUB
 * =====================================================================
 * 
 * HATUA ZA KUPATA CONFIG YAKO:
 * 1. Nenda: https://console.firebase.google.com/
 * 2. Bonyeza "Add project" → weka jina (k.m. "ngae-food-hub") → Continue
 * 3. Disable Google Analytics (si lazima) → Create project
 * 4. Baada ya project kuundwa → bonyeza ikoni ya "</>  Web"
 * 5. Weka app nickname (k.m. "ngae-web") → Register app
 * 6. Nakili values zote kutoka kwa firebaseConfig → weka hapa chini
 * 
 * HATUA ZA KUWEZESHA FIRESTORE:
 * 7. Kwenye Firebase Console → Build → Firestore Database
 * 8. Create database → Start in test mode → Next → Enable
 * 
 * =====================================================================
 */

const firebaseConfig = {
    apiKey: "AIzaSyDAkqMsW7BCHU8Lyst31nlMob88xunSu8s",
    authDomain: "ngae-food-hub.firebaseapp.com",
    projectId: "ngae-food-hub",
    storageBucket: "ngae-food-hub.firebasestorage.app",
    messagingSenderId: "402927032763",
    appId: "1:402927032763:web:d3b3b23d7e5ec840d68c9e",
    measurementId: "G-8JJHPT1678"
};

// Export kwa matumizi ya app.js
window.FIREBASE_CONFIG = firebaseConfig;
