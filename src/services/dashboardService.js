import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const RENTALS_COLLECTION = 'rentals';
const STALLS_COLLECTION = 'stalls';
const MARKETPLACES_COLLECTION = 'marketplaces';

export const getDashboardStats = async (userId, role) => {
  const now = new Date();
  
  // --- 1. SORGULARI HAZIRLA ---
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(now.getMonth() - 5);

  // Temel sorgu: Son 6 ay
  let q = query(
    collection(db, RENTALS_COLLECTION),
    where('date', '>=', sixMonthsAgo),
    orderBy('date', 'asc')
  );

  // ROL FİLTRESİ EKLE
  // Not: Firebase'de composite index gerekebilir. Hata verirse linke tıkla.
  if (role === 'OWNER') {
    // Sahip sadece KENDİ mülklerinin kirasını görür
    q = query(
        collection(db, RENTALS_COLLECTION),
        where('ownerId', '==', userId),
        where('date', '>=', sixMonthsAgo),
        orderBy('date', 'asc')
    );
  } else if (role === 'TENANT') {
    // Kiracı sadece KENDİ yaptığı kiralamaları görür
    q = query(
        collection(db, RENTALS_COLLECTION),
        where('tenantId', '==', userId),
        where('date', '>=', sixMonthsAgo),
        orderBy('date', 'asc')
    );
  }

  const snapshot = await getDocs(q);
  const rentals = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

  // --- 2. İSTATİSTİKLERİ HESAPLA ---
  
  let currentMonthTotal = 0;
  const currentMonthKey = now.toISOString().slice(0, 7); // "2023-11"
  
  // Geçen Ay
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(now.getMonth() - 1);
  const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);

  let thisMonthCount = 0;
  let lastMonthCount = 0;

  // Grafik Verisi (Son 6 ayın isimleri)
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

    // Grafiği doldur
    if (chartDataMap.hasOwnProperty(monthName)) {
      chartDataMap[monthName] += amount;
    }

    // Bu Ay Toplamı (Owner için Gelir, Tenant için Gider)
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

  // --- 3. SAHİPLER İÇİN POTANSİYEL CİRO (TENANT İÇİN GEREKSİZ) ---
  let totalPotentialIncome = 0;
  
  if (role === 'OWNER') {
    // Sadece Owner'ın potansiyelini hesapla
    // ... (Eski potansiyel hesaplama kodunu buraya alıyoruz ama sadece Owner'ın tahtaları için)
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

    // Sadece bu sahibin tahtalarını çek
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
    role, // Ekran tarafında ne göstereceğimizi bilmek için
    totalPotentialIncome, // Sadece Owner'da dolu
    currentMonthTotal, // Owner için Gelir, Tenant için Gider
    activeRentalsCount: rentals.length,
    thisMonthCount,
    lastMonthCount, 
    chartData
  };
};