import { db } from '../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';

const COLLECTION_NAME = 'stalls';

// Seçilen Pazaryerine ait tahtaları getirir
export const subscribeToStallsByMarket = (marketId, callback) => {
  if (!marketId) return () => {};

  // marketId'ye göre filtrele ve numaraya göre sırala
  const q = query(
    collection(db, COLLECTION_NAME), 
    where('marketplaceId', '==', marketId),
    orderBy('stallNumber') 
  );
  
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(data);
  });
};

export const addStall = async (stallData) => {
  await addDoc(collection(db, COLLECTION_NAME), stallData);
};

export const updateStall = async (id, stallData) => {
  const ref = doc(db, COLLECTION_NAME, id);
  await updateDoc(ref, stallData);
};

export const deleteStall = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  await deleteDoc(ref);
};