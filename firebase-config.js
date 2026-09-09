/* firebase-config.js */
// Replace with your actual Firebase project configuration
if (typeof FIREBASE_CONFIG === 'undefined') {
    var FIREBASE_CONFIG = {
        apiKey: "AIzaSyD-_J-ajwXuJ7cy1kaebPnhSmeFLrEqlbk",
        authDomain: "kobpat-22831.firebaseapp.com",
        projectId: "kobpat-22831",
        storageBucket: "kobpat-22831.firebasestorage.app",
        messagingSenderId: "250425839101",
        appId: "1:250425839101:web:3d2307688c61c0b1d9dd94"
    };
}

// Keep the current login path until Auth accounts, UID profiles and Rules have
// passed Emulator/staging checks. Change to "firebase" only during coordinated cutover.
if (typeof DEPOSIT_AUTH_MODE === 'undefined') {
    var DEPOSIT_AUTH_MODE = 'legacy';
}
