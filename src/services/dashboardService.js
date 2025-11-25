import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const RENTALS_COLLECTION = 'rentals';
const STALLS_COLLECTION = 'stalls';
const MARKETPLACES_COLLECTION = 'marketplaces';
const USERS_COLLECTION = 'users';

export const getDashboardStats = async (userId, role) => {
  const now = new Date();
  
  // --- 1. ADMIN'E ÖZEL GENEL İSTATİSTİKLER ---
  let adminStats = {};
  
  if (role === 'ADMIN') {
    // Kullanıcı Sayısı
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const totalUsers = usersSnap.size;

    // Pazar Yeri Sayısı
    const marketsSnap = await getDocs(collection(db, MARKETPLACES_COLLECTION));
    const totalMarketplaces = marketsSnap.size;

    // Tahta Sayısı
    const stallsSnap = await getDocs(collection(db, STALLS_COLLECTION));
    const totalStalls = stallsSnap.size;

    // Tüm Kiralamalar (Toplam Ciro için)
    const allRentalsSnap = await getDocs(collection(db, RENTALS_COLLECTION));
    let totalPlatformRevenue = 0;
    let totalCompletedRentals = 0;

    allRentalsSnap.forEach(doc => {
      const data = doc.data();
      // Sadece ödenmişleri ciroya ekle (veya istersen hepsini ekle)
      if (data.isPaid) {
        totalPlatformRevenue += (parseFloat(data.price) || 0);
      }
      totalCompletedRentals++;
    });

    adminStats = {
      totalUsers,
      totalMarketplaces,
      totalStalls,
      totalCompletedRentals,
      totalPlatformRevenue
    };
  }

  // --- 2. MEVCUT SORGULAR (GRAFİK VE AYLIK DURUM) ---
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(now.getMonth() - 5);

  let q;
  if (role === 'ADMIN') {
    // Admin: Son 6 aydaki TÜM hareketler (Grafik için)
    q = query(
        collection(db, RENTALS_COLLECTION),
        where('date', '>=', sixMonthsAgo),
        orderBy('date', 'asc')
    );
  } else if (role === 'OWNER') {
    q = query(
        collection(db, RENTALS_COLLECTION),
        where('ownerId', '==', userId),
        where('date', '>=', sixMonthsAgo),
        orderBy('date', 'asc')
    );
  } else {
    q = query(
        collection(db, RENTALS_COLLECTION),
        where('tenantId', '==', userId),
        where('date', '>=', sixMonthsAgo),
        orderBy('date', 'asc')
    );
  }

  const snapshot = await getDocs(q);
  const rentals = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

  // --- 3. AYLIK VE GRAFİK HESAPLAMALARI ---
  let currentMonthTotal = 0;
  const currentMonthKey = now.toISOString().slice(0, 7); 
  
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(now.getMonth() - 1);
  const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);

  let thisMonthCount = 0;
  let lastMonthCount = 0;

  const chartDataMap = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(now.getMonth() - i);
    const key = d.toLocaleString('tr-TR', { month: 'short' });
    chartDataMap[key] = 0;
  }
  const orderedLabels = Object.keys(chartDataMap).reverse(); 

  rentals.forEach(rental => {
    const rentalDate = rental.date.toDate();
    const amount = parseFloat(rental.price) || 0;
    const monthName = rentalDate.toLocaleString('tr-TR', { month: 'short' });
    const monthKey = rentalDate.toISOString().slice(0, 7);

    if (chartDataMap.hasOwnProperty(monthName)) {
      chartDataMap[monthName] += amount;
    }

    if (monthKey === currentMonthKey) {
      currentMonthTotal += amount;
      thisMonthCount++; 
    }

    if (monthKey === lastMonthKey) {
      lastMonthCount++;
    }
  });

  const chartData = {
    labels: orderedLabels,
    datasets: [{
      data: orderedLabels.map(label => chartDataMap[label])
    }]
  };

  // --- 4. SAHİPLER İÇİN POTANSİYEL CİRO ---
  let totalPotentialIncome = 0;
  if (role === 'OWNER') {
    // ... (Mevcut potansiyel hesaplama kodu aynen kalacak)
    const year = now.getFullYear();
    const month = now.getMonth();
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
    ...adminStats // Admin verilerini ekle
  };
};