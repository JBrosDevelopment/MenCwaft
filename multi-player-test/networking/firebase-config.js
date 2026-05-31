import { initializeApp }
from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBOSo7XdWc6zNxe-rAhZCg99sNj6VW1efY",
    authDomain: "voxel-multiplayer-test.firebaseapp.com",
    projectId: "voxel-multiplayer-test",
    storageBucket: "voxel-multiplayer-test.firebasestorage.app",
    messagingSenderId: "65416105420",
    appId: "1:65416105420:web:b407a4e2ca735fd2406169"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);