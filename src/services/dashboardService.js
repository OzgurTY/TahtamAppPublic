import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const RENTALS_COLLECTION = 'rentals';
const STALLS_COLLECTION = 'stalls';
const MARKETPLACES_COLLECTION = 'marketplaces';
const USERS_COLLECTION = 'users';

export const getDashboardStats = async (userId, role, referenceDate = new Date()) => {
  const targetDate = new Date(referenceDate);
  
  // --- 1. ADMIN GENEL İSTATİSTİKLERİ ---
  let adminStats = {};
  if (role === 'ADMIN') {
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const marketsSnap = await getDocs(collection(db, MARKETPLACES_COLLECTION));
    const stallsSnap = await getDocs(collection(db, STALLS_COLLECTION));
    
    const allRentalsSnap = await getDocs(collection(db, RENTALS_COLLECTION));
    let totalPlatformRevenue = 0;
    allRentalsSnap.forEach(doc => {
        if (doc.data().isPaid) totalPlatformRevenue += (parseFloat(doc.data().price) || 0);
    });

    adminStats = {
      totalUsers: usersSnap.size,
      totalMarketplaces: marketsSnap.size,
      totalStalls: stallsSnap.size,
      totalPlatformRevenue
    };
  }

  // --- 2. TARİH HESAPLAMALARI ---
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

  // --- 3. İSTATİSTİKLER ---
  
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
    
    // *** GELİR HESABI (NET/BRÜT/KOMİSYON) ***
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
    // Tenant için her zaman tam ödenen miktar giderdir

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
    datasets: [{
      data: orderedLabels.map(label => chartDataMap[label] || 0)
    }]
  };

  // --- 4. POTANSİYEL CİRO (OWNER İÇİN) ---
  let totalPotentialIncome = 0;
  if (role === 'OWNER') {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayCounts = { 'SUNDAY': 0, 'MONDAY': 0, 'TUESDAY': 0, 'WEDNESDAY': 0, 'THURSDAY': 0, 'FRIDAY': 0, 'SATURDAY': 0 };
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    for (let d = 1; d <= daysInMonth; d++) {
        dayCounts[dayNames[new Date(year, month, d).getDay()]]++;
    }

    const marketsSnap = await getDocs(collection(db, MARKETPLACES_COLLECTION));
    const markets = {};
    marketsSnap.forEach(doc => markets[doc.id] = doc.data().openDays || []);

    const stallsQuery = query(collection(db, STALLS_COLLECTION), where('ownerId', '==', userId));
    const stallsSnap = await getDocs(stallsQuery);

    stallsSnap.forEach(doc => {
        const stall = doc.data();
        const marketId = stall.marketplaceId;
        const defaultPrice = parseFloat(stall.price) || 0;
        if (markets[marketId]) {
            const openDays = markets[marketId];
            openDays.forEach(day => {
                const countOfThatDay = dayCounts[day] || 0;
                let dailyPrice = defaultPrice;
                if (stall.prices && stall.prices[day]) dailyPrice = parseFloat(stall.prices[day]);
                totalPotentialIncome += (dailyPrice * countOfThatDay);
            });
        }
    });
  }

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