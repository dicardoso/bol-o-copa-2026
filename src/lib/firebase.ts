import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// In dev mode, use the default emulator database (no named database ID needed).
// In production, use the named database from config.
const isEmulated = import.meta.env.DEV;
export const db = isEmulated
  ? getFirestore(app)
  : getFirestore(app, firebaseConfig.firestoreDatabaseId);

if (isEmulated) {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  console.log('[Firebase] Using local emulators (Firestore :8080, Auth :9099)');
}

/**
 * Validates the connection to Firestore as required by system constraints.
 */
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: Client is offline.");
    } else {
      // It's normal for the document to not exist, but network should work
      console.log("Firebase network verified.");
    }
  }
}
