import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const RENTALS_COLLECTION = 'rentals';
const STALLS_COLLECTION = 'stalls';
const MARKETPLACES_COLLECTION = 'marketplaces';
const USERS_COLLECTION = 'users';

// YENİ PARAMETRE: referenceDate (Varsayılan: Bugün)
export const getDashboardStats = async (userId, role, referenceDate = new Date()) => {
  // Gelen tarihi kopyala (Mutasyon riskini önle)
  const targetDate = new Date(referenceDate);
  
  // --- 1. ADMIN GENEL İSTATİSTİKLERİ (Tarihten bağımsız) ---
  let adminStats = {};
  if (role === 'ADMIN') {
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const marketsSnap = await getDocs(collection(db, MARKETPLACES_COLLECTION));
    const stallsSnap = await getDocs(collection(db, STALLS_COLLECTION));
    
    // Toplam Ciro (Tüm zamanlar)
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

  // --- 2. TARİH HESAPLAMALARI (Target Date'e göre) ---
  // Grafik için seçili tarihten geriye 5 ay gidiyoruz
  const sixMonthsAgo = new Date(targetDate);
  sixMonthsAgo.setMonth(targetDate.getMonth() - 5);
  sixMonthsAgo.setDate(1); // Ayın başı

  // Gelecek ayın başı (Sorgu bitişi için)
  const nextMonthOfTarget = new Date(targetDate);
  nextMonthOfTarget.setMonth(targetDate.getMonth() + 1);
  nextMonthOfTarget.setDate(1);

  // Firestore Sorgusu
  let q;
  const commonFilters = [
    where('date', '>=', sixMonthsAgo),
    // Grafikte geleceği göstermemek için sınırlayabiliriz ama şimdilik açık bırakalım
    orderBy('date', 'asc')
  ];

  if (role === 'ADMIN') {
    q = query(collection(db, RENTALS_COLLECTION), ...commonFilters);
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
  
  // GEÇEN AYIN ANAHTARI
  const prevMonthDate = new Date(targetDate);
  prevMonthDate.setDate(1); // Ay atlama sorununu önlemek için
  prevMonthDate.setMonth(targetDate.getMonth() - 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
  const prevMonthKey = `${prevYear}-${prevMonth}`;

  let currentMonthTotal = 0;
  let thisMonthCount = 0;
  let lastMonthCount = 0;

  const chartDataMap = {};
  const orderedLabels = [];
  
  // Son 6 Ayın Etiketlerini Oluştur (Yerel Saat ile)
  for(let i=5; i>=0; i--) {
      const d = new Date(targetDate);
      d.setDate(1);
      d.setMonth(targetDate.getMonth() - i);
      const label = d.toLocaleDateString('tr-TR', { month: 'short' });
      orderedLabels.push(label);
      chartDataMap[label] = 0;
  }

  rentals.forEach(rental => {
    const rentalDate = rental.date.toDate(); // Firebase Timestamp -> JS Date
    const amount = parseFloat(rental.price) || 0;
    
    // KİRALAMA AY ANAHTARI (YEREL SAAT)
    const y = rentalDate.getFullYear();
    const m = String(rentalDate.getMonth() + 1).padStart(2, '0');
    const rentalMonthKey = `${y}-${m}`;
    
    const monthNameShort = rentalDate.toLocaleDateString('tr-TR', { month: 'short' });

    // Grafiğe Ekle
    if (chartDataMap[monthNameShort] !== undefined) {
        chartDataMap[monthNameShort] += amount;
    }

    // Bu Ayın Verisi mi?
    if (rentalMonthKey === targetMonthKey) {
      currentMonthTotal += amount;
      thisMonthCount++;
    }

    // Geçen Ayın Verisi mi?
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

  // --- 4. POTANSİYEL CİRO (Sadece Owner ve Seçili Ay İçin) ---
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