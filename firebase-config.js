/**
 * =====================================================================
 * FIREBASE CONFIGURATION - NGAE FOOD PROCESSORS HUB
 * =====================================================================
 * 
 * HATUA ZA KUPATA CONFIG YAKO:
 * 1. Nenda: https://console.firebase.google.com/
 * 2. Bonyeza "Add project" ΓåÆ weka jina (k.m. "ngae-food-hub") ΓåÆ Continue
 * 3. Disable Google Analytics (si lazima) ΓåÆ Create project
 * 4. Baada ya project kuundwa ΓåÆ bonyeza ikoni ya "</>  Web"
 * 5. Weka app nickname (k.m. "ngae-web") ΓåÆ Register app
 * 6. Nakili values zote kutoka kwa firebaseConfig ΓåÆ weka hapa chini
 * 
 * HATUA ZA KUWEZESHA FIRESTORE:
 * 7. Kwenye Firebase Console ΓåÆ Build ΓåÆ Firestore Database
 * 8. Create database ΓåÆ Start in test mode ΓåÆ Next ΓåÆ Enable
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