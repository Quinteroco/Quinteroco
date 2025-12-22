// Firebase configuration - REPLACE WITH YOUR PROJECT SETTINGS
const firebaseConfig = {
    apiKey: "AIzaSyDEGm92iUZ50IxLhfx5p6BAUonZpapxS4c",
    authDomain: "booking-zafiro.firebaseapp.com",
    projectId: "booking-zafiro",
    storageBucket: "booking-zafiro.firebasestorage.app",
    messagingSenderId: "303821951384",
    appId: "1:303821951384:web:e103676061171b38205bed",
    measurementId: "G-Z2LP13MB6X"
};

// Initialize Firebase (Compatibility mode for simplicity in this demo)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
