import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD5LkbygXnyMI2w0r7Cs9cwB9-VjMjlh-0",
  authDomain: "likha-sis.firebaseapp.com",
  projectId: "likha-sis",
  storageBucket: "likha-sis.firebasestorage.app",
  messagingSenderId: "116245880464",
  appId: "1:116245880464:web:8250e26f283e58e4064215",
};

const appName = "adminCreateApp";
const secondaryApp =
  getApps().find((app) => app.name === appName) ||
  initializeApp(firebaseConfig, appName);

const secondaryAuth = getAuth(secondaryApp);

/**
 * Creates a new teacher account in Firebase Auth using an isolated secondary app instance.
 * Immediately signs out of the secondary app so the admin's primary session is not affected.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>} The UID of the newly created account.
 */
export async function createTeacherAccount(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password
    );
    const uid = userCredential.user.uid;
    await signOut(secondaryAuth);
    return uid;
  } catch (error) {
    await signOut(secondaryAuth).catch(() => {});
    throw error;
  }
}
