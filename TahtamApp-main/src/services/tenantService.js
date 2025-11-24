import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';

const COLLECTION_NAME = 'tenants';

export const subscribeToTenants = (callback) => {
  // İsim sırasına göre getir
  const q = query(collection(db, COLLECTION_NAME), orderBy('fullName'));
  
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(data);
  });
};

export const addTenant = async (tenantData) => {
  // Formdan gelen veriler: fullName, phone, note
  // Otomatik eklenenler: balance (0), createdAt
  const payload = {
    ...tenantData,
    balance: 0, 
    createdAt: new Date()
  };
  await addDoc(collection(db, COLLECTION_NAME), payload);
};

export const updateTenant = async (id, tenantData) => {
  const ref = doc(db, COLLECTION_NAME, id);
  await updateDoc(ref, tenantData);
};

export const deleteTenant = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  await deleteDoc(ref);
};