import { db } from '../config/firebase';
import { 
  collection, addDoc, deleteDoc, updateDoc, doc, 
  query, where, orderBy, onSnapshot, writeBatch, getDocs 
} from 'firebase/firestore';

const RENTALS_COLLECTION = 'rentals';

// Belirli bir Rol için kiralama geçmişi
export const subscribeToRentalsByRole = (userId, role, callback) => {
  let q;

  if (role === 'ADMIN') {
    // ADMIN: Hiçbir filtre yok, tüm geçmişi görür
    q = query(
      collection(db, RENTALS_COLLECTION),
      orderBy('date', 'desc')
    );
  } else if (role === 'OWNER') {
    // OWNER: Sadece kendi mülklerinin kirasını görür
    q = query(
      collection(db, RENTALS_COLLECTION),
      where('ownerId', '==', userId),
      orderBy('date', 'desc')
    );
  } else {
    // TENANT: Sadece kendi ödemelerini görür
    q = query(
      collection(db, RENTALS_COLLECTION),
      where('tenantId', '==', userId),
      orderBy('date', 'desc')
    );
  }

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
    }));
    callback(data);
  });
};

// Belirli bir tarih için kiralamaları getir (Takvim görünümü için)
export const subscribeToRentalsByDate = (marketId, dateString, callback) => {
  const q = query(
    collection(db, RENTALS_COLLECTION),
    where('marketplaceId', '==', marketId),
    where('dateString', '==', dateString)
  );
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
};

// Kiralama Yap (Batch)
export const createRental = async (rentalsDataArray) => {
  const batch = writeBatch(db);
  rentalsDataArray.forEach(rental => {
    const docRef = doc(collection(db, RENTALS_COLLECTION));
    batch.set(docRef, { ...rental, createdAt: new Date(), isPaid: false });
  });
  await batch.commit();
};

export const deleteRental = async (rentalId) => {
  const ref = doc(db, RENTALS_COLLECTION, rentalId);
  await deleteDoc(ref);
};

export const toggleRentalPaymentStatus = async (rentalId, currentStatus) => {
  const ref = doc(db, RENTALS_COLLECTION, rentalId);
  await updateDoc(ref, { isPaid: !currentStatus });
};

export const checkAvailability = async (stallId, dateStrings) => {
  if (!dateStrings || dateStrings.length === 0) return [];
  const sortedDates = [...dateStrings].sort();
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];
  const q = query(
    collection(db, RENTALS_COLLECTION),
    where('stallId', '==', stallId),
    where('dateString', '>=', startDate),
    where('dateString', '<=', endDate)
  );
  const snapshot = await getDocs(q);
  const existingRentals = snapshot.docs.map(doc => doc.data().dateString);
  const conflicts = existingRentals.filter(date => dateStrings.includes(date));
  return conflicts; 
};