import { auth, db } from '../config/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

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

export const updateUserProfile = async (uid, data) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, data);
  } catch (error) {
    console.error("Profil güncelleme hatası:", error);
    throw error;
  }
};