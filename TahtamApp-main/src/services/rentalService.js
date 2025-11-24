import { db } from '../config/firebase';
import { collection, addDoc, deleteDoc, doc, query, where, onSnapshot, writeBatch, getDocs } from 'firebase/firestore';

const RENTALS_COLLECTION = 'rentals';

// Belirli bir Pazar ve Tarih için kiralamaları getir
export const subscribeToRentalsByDate = (marketId, dateString, callback) => {
  // dateString formatı: "2023-11-21"
  const q = query(
    collection(db, RENTALS_COLLECTION),
    where('marketplaceId', '==', marketId),
    where('dateString', '==', dateString) // Sadece o günü getir
  );

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(data);
  });
};

// TEKLİ veya TOPLU KİRALAMA (Transaction Batch kullanarak)
export const createRental = async (rentalsDataArray) => {
  // rentalsDataArray: [{ stallId, dateString, ... }, { ... }]
  const batch = writeBatch(db);

  rentalsDataArray.forEach(rental => {
    const docRef = doc(collection(db, RENTALS_COLLECTION));
    batch.set(docRef, {
      ...rental,
      createdAt: new Date(),
      isPaid: false
    });
  });

  await batch.commit();
};

// KİRA İPTAL / SİLME
export const deleteRental = async (rentalId) => {
  const ref = doc(db, RENTALS_COLLECTION, rentalId);
  await deleteDoc(ref);
};

// ÇAKIŞMA KONTROLÜ (Örn: Aylık kiralarken arada dolu gün var mı?)
export const checkAvailability = async (stallId, dateStrings) => {
  // Basitçe o tahta için o tarihlerde kayıt var mı bakar
  const q = query(
    collection(db, RENTALS_COLLECTION),
    where('stallId', '==', stallId),
    where('dateString', 'in', dateStrings) // Firestore 'in' sorgusu (max 10 eleman destekler, dikkat)
  );
  
  // Not: 'in' sorgusu 10 elemanla sınırlı olduğu için döngüyle kontrol etmek daha güvenli olabilir.
  // Şimdilik basit kontrol için getDocs kullanıyoruz.
  const snapshot = await getDocs(q);
  return snapshot.empty; // Boşsa uygundur
};