import { db } from '../config/firebase';
import { 
  collection, addDoc, deleteDoc, updateDoc, doc, 
  query, where, orderBy, onSnapshot, writeBatch, getDocs, increment 
} from 'firebase/firestore';

const RENTALS_COLLECTION = 'rentals';

// Belirli bir Rol için kiralama geçmişi
export const subscribeToRentalsByRole = (userId, role, callback) => {
  let q;
  if (role === 'ADMIN') {
    q = query(collection(db, RENTALS_COLLECTION), orderBy('date', 'desc'));
  } else if (role === 'OWNER') {
    q = query(collection(db, RENTALS_COLLECTION), where('ownerId', '==', userId), orderBy('date', 'desc'));
  } else {
    q = query(collection(db, RENTALS_COLLECTION), where('tenantId', '==', userId), orderBy('date', 'desc'));
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
  const groupId = rentalsDataArray.length > 1 ? `GROUP_${Date.now()}` : null;

  rentalsDataArray.forEach(rental => {
    const docRef = doc(collection(db, RENTALS_COLLECTION));
    batch.set(docRef, {
      ...rental,
      groupId: groupId,
      createdAt: new Date(),
      isPaid: false,
      paidAmount: 0
    });
  });

  await batch.commit();
};

export const deleteRental = async (rentalId) => {
  const ref = doc(db, RENTALS_COLLECTION, rentalId);
  await deleteDoc(ref);
};

export const deleteRentalGroup = async (groupId) => {
  try {
    const q = query(collection(db, RENTALS_COLLECTION), where('groupId', '==', groupId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Grup silme hatası:", error);
    throw error;
  }
};

export const toggleRentalPaymentStatus = async (rentalId, currentStatus) => {
  const ref = doc(db, RENTALS_COLLECTION, rentalId);
  await updateDoc(ref, { isPaid: !currentStatus });
};

export const toggleRentalGroupPaymentStatus = async (groupId, currentStatus) => {
  try {
    const q = query(collection(db, RENTALS_COLLECTION), where('groupId', '==', groupId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    const newStatus = !currentStatus;

    snapshot.forEach(doc => {
      batch.update(doc.ref, { isPaid: newStatus });
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Grup ödeme hatası:", error);
    throw error;
  }
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

export const deleteRentalsBatch = async (rentalIds) => {
  try {
    const batch = writeBatch(db);
    rentalIds.forEach(id => {
      const ref = doc(db, RENTALS_COLLECTION, id);
      batch.delete(ref);
    });
    await batch.commit();
  } catch (error) {
    console.error("Toplu silme hatası:", error);
    throw error;
  }
};

export const markRentalsPaidBatch = async (rentalIds, isPaidStatus) => {
  try {
    const batch = writeBatch(db);
    rentalIds.forEach(id => {
      const ref = doc(db, RENTALS_COLLECTION, id);
      batch.update(ref, { isPaid: isPaidStatus });
    });
    await batch.commit();
  } catch (error) {
    console.error("Toplu güncelleme hatası:", error);
    throw error;
  }
};

export const addPayment = async (item, amountToAdd) => {
  try {
    const batch = writeBatch(db);
    const amount = parseFloat(amountToAdd);

    if (item.isGroup) {
      // GRUP ÖDEMESİ:
      // Girilen tutarı, gruptaki öğe sayısına bölerek her birine eşit dağıtıyoruz.
      // Bu sayede matematiksel bütünlük korunur.
      const q = query(collection(db, RENTALS_COLLECTION), where('groupId', '==', item.id));
      const snapshot = await getDocs(q);
      
      const count = snapshot.size;
      if (count === 0) return;

      const amountPerItem = amount / count;

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const newPaidAmount = (data.paidAmount || 0) + amountPerItem;
        const totalPrice = parseFloat(data.price) || 0;
        
        // Eğer ödenen miktar toplam fiyatı geçtiyse veya eşitse "Ödendi" işaretle
        // Ufak kuruş hatalarını önlemek için 0.1 tolerans
        const isFullyPaid = newPaidAmount >= (totalPrice - 0.1); 

        batch.update(docSnap.ref, {
          paidAmount: increment(amountPerItem),
          isPaid: isFullyPaid
        });
      });

    } else {
      // TEKLİ ÖDEME
      const ref = doc(db, RENTALS_COLLECTION, item.id);
      const newPaidAmount = (item.paidAmount || 0) + amount;
      const isFullyPaid = newPaidAmount >= (item.price - 0.1);

      batch.update(ref, {
        paidAmount: increment(amount),
        isPaid: isFullyPaid
      });
    }

    await batch.commit();
  } catch (error) {
    console.error("Ödeme ekleme hatası:", error);
    throw error;
  }
};