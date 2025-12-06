import { auth, db } from '../config/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  deleteUser 
} from 'firebase/auth';
import { 
  doc, setDoc, getDoc, updateDoc, deleteDoc, 
  collection, getDocs, query, orderBy 
} from 'firebase/firestore';

export const registerUser = async (email, password, userData) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      ...userData,
      createdAt: new Date()
    });
    return user;
  } catch (error) { throw error; }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) { throw error; }
};

export const logoutUser = async () => {
  try { await signOut(auth); } catch (error) { throw error; }
};

export const getUserProfile = async (uid) => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};

export const updateUserProfile = async (uid, data) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, data);
};

export const deleteUserAccount = async () => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, "users", user.uid));
    await deleteUser(user);
  } catch (error) { throw error; }
};

// --- YENİ: ADMIN FONKSİYONLARI ---

export const getAllUsers = async () => {
  try {
    const q = query(collection(db, "users"), orderBy("email"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) { console.error(error); return []; }
};

export const updateUserRole = async (userId, roleData) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, roleData);
  } catch (error) { throw error; }
};