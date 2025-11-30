import { db } from '../config/firebase';
import { 
  collection, addDoc, deleteDoc, updateDoc, doc, 
  query, where, orderBy, onSnapshot, writeBatch, getDocs, increment 
} from 'firebase/firestore';

const RENTALS_COLLECTION = 'rentals';

// --- LİSTELEME FONKSİYONLARI ---

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

// --- İŞLEM FONKSİYONLARI ---

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

export const deleteRentalsBatch = async (rentalIds) => {
  const batch = writeBatch(db);
  rentalIds.forEach(id => {
    const ref = doc(db, RENTALS_COLLECTION, id);
    batch.delete(ref);
  });
  await batch.commit();
};

export const deleteRentalGroup = async (groupId) => {
  const q = query(collection(db, RENTALS_COLLECTION), where('groupId', '==', groupId));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
};

export const addPayment = async (item, amountToAdd) => {
  try {
    const batch = writeBatch(db);
    const amount = parseFloat(amountToAdd);

    if (item.isGroup) {
      // GRUP İŞLEMİ
      const q = query(collection(db, RENTALS_COLLECTION), where('groupId', '==', item.id));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) return;

      const rentals = snapshot.docs.map(doc => ({ ref: doc.ref, ...doc.data() }));

      if (amount > 0) {
        // --- SENARYO 1: ÖDEME EKLEME (POZİTİF) ---
        let remaining = amount;

        for (const rental of rentals) {
          if (remaining <= 0.01) break; // Para bittiyse dur

          const currentPaid = rental.paidAmount || 0;
          const price = parseFloat(rental.price) || 0;
          const debt = price - currentPaid;

          if (debt <= 0) continue; // Bu tahta zaten tam ödenmiş, sonrakine geç

          let pay = 0;
          // Borç kadarını mı ödeyelim, elimizdeki parayı mı?
          if (remaining >= debt) {
            pay = debt; // Borcu kapat
          } else {
            pay = remaining; // Paranın yettiği kadarını öde
          }

          const newPaid = currentPaid + pay;
          const isFullyPaid = newPaid >= (price - 0.1);

          batch.update(rental.ref, {
            paidAmount: isFullyPaid ? price : newPaid,
            isPaid: isFullyPaid
          });

          remaining -= pay; // Kullandığımız parayı düş
        }

      } else {
        // --- SENARYO 2: DÜZELTME / İADE (NEGATİF) ---
        let toDeduct = Math.abs(amount); // Düşülecek pozitif miktar (Örn: 500)

        // İadelerde tersten gitmek (veya baştan gitmek) bir tercih meselesidir.
        // Burada sırayla dolu olanlardan düşüyoruz.
        for (const rental of rentals) {
          if (toDeduct <= 0.01) break; // Düşülecek miktar bittiyse dur

          const currentPaid = rental.paidAmount || 0;
          
          if (currentPaid <= 0) continue; // Zaten ödenmemiş, bundan düşemeyiz

          let deduct = 0;
          // Bu tahtada düşecek kadar para var mı?
          if (currentPaid >= toDeduct) {
            deduct = toDeduct; // Hepsini buradan düşebiliriz
          } else {
            deduct = currentPaid; // Buradaki tüm parayı sıfırla, kalanı diğerinden düş
          }

          let newPaid = currentPaid - deduct;
          if (newPaid < 0) newPaid = 0;

          const price = parseFloat(rental.price) || 0;
          // Para düştüğü için muhtemelen artık "Ödenmedi" olacak
          const isFullyPaid = newPaid >= (price - 0.1);

          batch.update(rental.ref, {
            paidAmount: newPaid,
            isPaid: isFullyPaid
          });

          toDeduct -= deduct; // Düştüğümüz miktarı hedeften çıkar
        }
      }

    } else {
      // TEKLİ İŞLEM (Her zamanki gibi)
      const ref = doc(db, RENTALS_COLLECTION, item.id);
      const currentPaid = item.paidAmount || 0;
      let newPaidAmount = currentPaid + amount; // Eksi gelirse düşer
      
      if (newPaidAmount < 0) newPaidAmount = 0;

      const price = parseFloat(item.price) || 0;
      const isFullyPaid = newPaidAmount >= (price - 0.1);

      batch.update(ref, {
        paidAmount: isFullyPaid ? price : newPaidAmount,
        isPaid: isFullyPaid
      });
    }

    await batch.commit();
  } catch (error) {
    console.error("Ödeme işlemi hatası:", error);
    throw error;
  }
};

export const toggleRentalPaymentStatus = async (rentalId, currentStatus) => {
  const ref = doc(db, RENTALS_COLLECTION, rentalId);
  await updateDoc(ref, { isPaid: !currentStatus });
};

export const toggleRentalGroupPaymentStatus = async (groupId, currentStatus) => {
  const q = query(collection(db, RENTALS_COLLECTION), where('groupId', '==', groupId));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  const newStatus = !currentStatus;
  snapshot.forEach(doc => batch.update(doc.ref, { isPaid: newStatus }));
  await batch.commit();
};

export const markRentalsPaidBatch = async (rentalIds, isPaidStatus) => {
  const batch = writeBatch(db);
  rentalIds.forEach(id => {
    const ref = doc(db, RENTALS_COLLECTION, id);
    batch.update(ref, { isPaid: isPaidStatus });
  });
  await batch.commit();
};

// --- KRİTİK: BU FONKSİYONUN BURADA OLDUĞUNA EMİN OL ---
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