import { db } from '../config/firebase';
import { 
  collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, 
  where, getDocs, writeBatch 
} from 'firebase/firestore';

const COLLECTION_NAME = 'marketplaces';
const STALLS_COLLECTION = 'stalls';
const RENTALS_COLLECTION = 'rentals';

// Gerçek zamanlı veri dinleyicisi (Aynı kaldı)
export const subscribeToMarketplaces = (callback) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('name'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
};

export const addMarketplace = async (marketData) => {
  try {
    await addDoc(collection(db, COLLECTION_NAME), marketData);
  } catch (error) {
    console.error("Ekleme hatası:", error);
    throw error;
  }
};

export const updateMarketplace = async (id, marketData) => {
  try {
    const ref = doc(db, COLLECTION_NAME, id);
    await updateDoc(ref, marketData);
  } catch (error) {
    console.error("Güncelleme hatası:", error);
    throw error;
  }
};

// --- GÜNCELLENEN SİLME FONKSİYONU (Zincirleme Silme) ---
export const deleteMarketplace = async (id) => {
  try {
    const batch = writeBatch(db);

    // 1. Adım: Bu pazara ait KİRALAMA KAYITLARINI (Rentals) bul ve silme listesine ekle
    // (Önce bunları siliyoruz ki referanslar bozulmasın)
    const rentalsQuery = query(
      collection(db, RENTALS_COLLECTION), 
      where('marketplaceId', '==', id)
    );
    const rentalsSnapshot = await getDocs(rentalsQuery);
    rentalsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 2. Adım: Bu pazara ait TAHTALARI (Stalls) bul ve silme listesine ekle
    const stallsQuery = query(
      collection(db, STALLS_COLLECTION), 
      where('marketplaceId', '==', id)
    );
    const stallsSnapshot = await getDocs(stallsQuery);
    stallsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 3. Adım: PAZARYERİNİ (Marketplace) silme listesine ekle
    const marketRef = doc(db, COLLECTION_NAME, id);
    batch.delete(marketRef);

    // 4. Adım: Tüm silme işlemlerini tek seferde uygula (Commit)
    await batch.commit();

    console.log(`Pazar (${id}) ve bağlı tüm veriler temizlendi.`);
  } catch (error) {
    console.error("Zincirleme silme hatası:", error);
    throw error;
  }
};