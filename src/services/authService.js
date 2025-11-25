import { auth, db } from '../config/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  deleteUser // <-- YENİ
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'; // <-- deleteDoc EKLENDİ

// YENİ KULLANICI KAYDI
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
  } catch (error) {
    console.error("Kayıt hatası:", error);
    throw error;
  }
};

// GİRİŞ YAPMA
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Giriş hatası:", error);
    throw error;
  }
};

// ÇIKIŞ YAPMA
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Çıkış hatası:", error);
    throw error;
  }
};

// KULLANICI ROLÜNÜ VE BİLGİLERİNİ GETİRME
export const getUserProfile = async (uid) => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  } else {
    return null;
  }
};

// PROFİL GÜNCELLEME
export const updateUserProfile = async (uid, data) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, data);
  } catch (error) {
    console.error("Profil güncelleme hatası:", error);
    throw error;
  }
};

// YENİ: HESAP SİLME
export const deleteUserAccount = async () => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // 1. Firestore'daki profil verisini sil
    await deleteDoc(doc(db, "users", user.uid));

    // 2. Authentication hesabını sil
    // Not: Bu işlem kullanıcının "yakın zamanda" giriş yapmış olmasını gerektirir.
    await deleteUser(user);
  } catch (error) {
    console.error("Hesap silme hatası:", error);
    throw error;
  }
};