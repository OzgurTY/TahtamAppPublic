import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const RENTALS_COLLECTION = 'rentals';
const STALLS_COLLECTION = 'stalls';
const MARKETPLACES_COLLECTION = 'marketplaces';

export const getDashboardStats = async () => {
  const now = new Date();
  
  // --- 1. POTANSİYEL CİRO HESABI (GÜNCELLENDİ) ---
  const year = now.getFullYear();
  const month = now.getMonth();
  // Ayın son gününü bularak o ayın kaç çektiğini hesapla
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Bu ay hangi günden kaç tane var? (Örn: 4 Salı, 5 Cuma)
  const dayCounts = {
    'SUNDAY': 0, 'MONDAY': 0, 'TUESDAY': 0, 'WEDNESDAY': 0, 
    'THURSDAY': 0, 'FRIDAY': 0, 'SATURDAY': 0
  };
  
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayName = dayNames[date.getDay()];
    dayCounts[dayName]++;
  }

  // Pazaryerlerini ve açık günlerini çek
  const marketsSnap = await getDocs(collection(db, MARKETPLACES_COLLECTION));
  const markets = {};
  marketsSnap.forEach(doc => {
    markets[doc.id] = doc.data().openDays || [];
  });

  // Tahtaları çek ve potansiyeli hesapla
  const stallsSnap = await getDocs(collection(db, STALLS_COLLECTION));
  let totalPotentialIncome = 0;

  stallsSnap.forEach(doc => {
    const stall = doc.data();
    const marketId = stall.marketplaceId;
    const defaultPrice = parseFloat(stall.price) || 0;
    
    // Eğer bu tahtanın pazarı sistemde varsa
    if (markets[marketId]) {
      const openDays = markets[marketId]; // Pazarın açık olduğu günler (Örn: ['TUESDAY', 'SATURDAY'])
      
      // Her bir açık gün için hesap yap
      openDays.forEach(day => {
        const countOfThatDay = dayCounts[day] || 0; // Bu ay o günden kaç tane var?
        
        // O GÜNÜN FİYATINI BELİRLE
        let dailyPrice = defaultPrice;
        
        // Eğer tahtanın o güne özel fiyatı varsa onu kullan
        if (stall.prices && stall.prices[day]) {
            dailyPrice = parseFloat(stall.prices[day]);
        }
        
        // (O günün fiyatı * O günün ay içindeki sayısı)
        totalPotentialIncome += (dailyPrice * countOfThatDay);
      });
    }
  });

  // --- 2. MEVCUT DURUM ve KARŞILAŞTIRMA (AYNI KALDI) ---
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(now.getMonth() - 5);

  const q = query(
    collection(db, RENTALS_COLLECTION),
    where('date', '>=', sixMonthsAgo),
    orderBy('date', 'asc')
  );

  const snapshot = await getDocs(q);
  const rentals = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

  let currentMonthIncome = 0;
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
      currentMonthIncome += amount;
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

  return {
    totalPotentialIncome,
    currentMonthIncome,
    activeRentalsCount: rentals.length,
    thisMonthCount,
    lastMonthCount, 
    chartData
  };
};