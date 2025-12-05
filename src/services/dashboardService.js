import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const RENTALS_COLLECTION = 'rentals';
const STALLS_COLLECTION = 'stalls';
const MARKETPLACES_COLLECTION = 'marketplaces';
const USERS_COLLECTION = 'users';

export const getDashboardStats = async (userId, role, referenceDate = new Date()) => {
  const targetDate = new Date(referenceDate);
  
  // --- 1. ADMIN İSTATİSTİKLERİ ---
  let adminStats = {};
  if (role === 'ADMIN') {
    // ... (Admin için sayımlar buraya, mevcut kodundaki gibi kalsın)
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const marketsSnap = await getDocs(collection(db, MARKETPLACES_COLLECTION));
    const stallsSnap = await getDocs(collection(db, STALLS_COLLECTION));
    const allRentalsSnap = await getDocs(collection(db, RENTALS_COLLECTION));
    let totalPlatformRevenue = 0;
    allRentalsSnap.forEach(doc => { if (doc.data().isPaid) totalPlatformRevenue += (parseFloat(doc.data().price) || 0); });
    adminStats = { totalUsers: usersSnap.size, totalMarketplaces: marketsSnap.size, totalStalls: stallsSnap.size, totalPlatformRevenue };
  }

  // --- 2. TARİH FİLTRELERİ ---
  const sixMonthsAgo = new Date(targetDate);
  sixMonthsAgo.setMonth(targetDate.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  let q;
  const commonFilters = [
    where('date', '>=', sixMonthsAgo),
    orderBy('date', 'asc')
  ];

  if (role === 'ADMIN') {
    q = query(collection(db, RENTALS_COLLECTION), ...commonFilters);
  } else if (role === 'MARKET_MANAGER') {
    // YENİ: Yönetici sadece kendi aracılık ettiği işlemleri görür
    q = query(collection(db, RENTALS_COLLECTION), where('managerId', '==', userId), ...commonFilters);
  } else if (role === 'OWNER') {
    q = query(collection(db, RENTALS_COLLECTION), where('ownerId', '==', userId), ...commonFilters);
  } else {
    q = query(collection(db, RENTALS_COLLECTION), where('tenantId', '==', userId), ...commonFilters);
  }

  const snapshot = await getDocs(q);
  const rentals = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

  // --- 3. HESAPLAMALAR ---
  const targetYear = targetDate.getFullYear();
  const targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const targetMonthKey = `${targetYear}-${targetMonth}`;
  
  const prevMonthDate = new Date(targetDate);
  prevMonthDate.setDate(1);
  prevMonthDate.setMonth(targetDate.getMonth() - 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
  const prevMonthKey = `${prevYear}-${prevMonth}`;

  let currentMonthTotal = 0;
  let thisMonthCount = 0;
  let lastMonthCount = 0;

  const chartDataMap = {};
  const orderedLabels = [];
  for(let i=5; i>=0; i--) {
      const d = new Date(targetDate);
      d.setDate(1);
      d.setMonth(targetDate.getMonth() - i);
      const label = d.toLocaleDateString('tr-TR', { month: 'short' });
      orderedLabels.push(label);
      chartDataMap[label] = 0;
  }

  rentals.forEach(rental => {
    const rentalDate = rental.date.toDate();
    
    // *** GELİR HESABI ***
    const amountFull = parseFloat(rental.price) || 0;
    let amountToCount = amountFull;

    if (role === 'MARKET_MANAGER') {
        // Yönetici için gelir = Komisyon
        amountToCount = rental.commissionAmount || 0;
    } else if (role === 'OWNER') {
        // Sahip için gelir = Net Gelir (Eğer yönetici kesintisi varsa)
        if (rental.isManaged) {
            amountToCount = rental.ownerRevenue || 0;
        } else {
            amountToCount = amountFull;
        }
    }

    const y = rentalDate.getFullYear();
    const m = String(rentalDate.getMonth() + 1).padStart(2, '0');
    const rentalMonthKey = `${y}-${m}`;
    const monthNameShort = rentalDate.toLocaleDateString('tr-TR', { month: 'short' });

    if (chartDataMap[monthNameShort] !== undefined) {
        chartDataMap[monthNameShort] += amountToCount;
    }

    if (rentalMonthKey === targetMonthKey) {
      currentMonthTotal += amountToCount;
      thisMonthCount++;
    }

    if (rentalMonthKey === prevMonthKey) {
      lastMonthCount++;
    }
  });

  const chartData = {
    labels: orderedLabels,
    datasets: [{ data: orderedLabels.map(label => chartDataMap[label] || 0) }]
  };

  // Potansiyel ciro (Sadece Owner için anlamlı, Manager için belki toplam pazar kapasitesi x komisyon olabilir ama şimdilik 0)
  let totalPotentialIncome = 0;
  // ... (Owner potansiyel ciro hesabı mevcut koddaki gibi kalabilir)

  return {
    role,
    totalPotentialIncome,
    currentMonthTotal,
    activeRentalsCount: rentals.length,
    thisMonthCount,
    lastMonthCount, 
    chartData,
    ...adminStats
  };
};