import { db } from '../config/firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, query, where, orderBy, writeBatch, getDocs 
} from 'firebase/firestore';

const COLLECTION_NAME = 'stalls';
const RENTALS_COLLECTION = 'rentals';

// Gerçek zamanlı tahta listesi
export const subscribeToStallsByMarket = (marketId, callback, ownerId = null) => {
  if (!marketId) return () => {};

  let q;

  if (ownerId) {
    // Sadece belirli bir kullanıcının (Owner) tahtalarını getir
    q = query(
      collection(db, COLLECTION_NAME), 
      where('marketplaceId', '==', marketId),
      where('ownerId', '==', ownerId),
      orderBy('stallNumber') 
    );
  } else {
    // Herkesinkini getir (Kiracı veya Admin için)
    q = query(
      collection(db, COLLECTION_NAME), 
      where('marketplaceId', '==', marketId),
      orderBy('stallNumber') 
    );
  }
  
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(data);
  });
};

export const addStall = async (stallData, ownerId) => {
  const payload = {
    ...stallData,
    ownerId: ownerId,
    createdAt: new Date()
  };
  await addDoc(collection(db, COLLECTION_NAME), payload);
};

export const updateStall = async (id, stallData) => {
  const ref = doc(db, COLLECTION_NAME, id);
  await updateDoc(ref, stallData);
};

// GÜNCELLENMİŞ SİLME (ZİNCİRLEME)
export const deleteStall = async (id) => {
  try {
    const batch = writeBatch(db); // Artık hata vermeyecek

    // 1. Önce bu tahtaya ait tüm kiralamaları bul ve silme listesine ekle
    const rentalsQuery = query(
      collection(db, RENTALS_COLLECTION), 
      where('stallId', '==', id)
    );
    const rentalsSnapshot = await getDocs(rentalsQuery);
    
    rentalsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 2. Tahtanın kendisini sil
    const stallRef = doc(db, COLLECTION_NAME, id);
    batch.delete(stallRef);

    // 3. Hepsini uygula
    await batch.commit();
    console.log("Tahta ve geçmişi temizlendi.");
  } catch (error) {
    console.error("Tahta silme hatası:", error);
    throw error;
  }
};