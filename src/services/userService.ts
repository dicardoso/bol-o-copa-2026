import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
}

export interface UserSecuritySettings {
  twoStepVerification: boolean;
  publicProfile: boolean;
}

export const userService = {
  async updateProfile(uid: string, data: any) {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async updatePreferences(uid: string, prefs: UserPreferences) {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), { preferences: prefs });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async updateSecurity(uid: string, security: UserSecuritySettings) {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), { security: security });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }
};
