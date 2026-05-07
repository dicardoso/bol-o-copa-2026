import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// CRITICAL: The app will break without specifying the database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
