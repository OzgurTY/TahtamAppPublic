import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Modal, 
  TextInput, StyleSheet, Alert, SafeAreaView, StatusBar, ScrollView, Switch, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars'; 

import { subscribeToMarketplaces } from '../services/marketplaceService';
import { subscribeToStallsByMarket, addStall, updateStall, deleteStall } from '../services/stallService';
import { subscribeToTenants } from '../services/tenantService';
import { createRental, deleteRental, subscribeToRentalsByDate, checkAvailability } from '../services/rentalService';
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';
import { AuthContext } from '../context/AuthContext';
import { getUserProfile } from '../services/authService';
import { sendPushNotification } from '../services/notificationService';

// --- TAKVİM DİL AYARLARI ---
LocaleConfig.locales['tr'] = {
  monthNames: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
  monthNamesShort: ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
  dayNames: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
  dayNamesShort: ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'],
  today: 'Bugün'
};
LocaleConfig.defaultLocale = 'tr';

const SHORT_DAY_LABELS = {
  'MONDAY': 'Pzt', 'TUESDAY': 'Sal', 'WEDNESDAY': 'Çrş',
  'THURSDAY': 'Prş', 'FRIDAY': 'Cum', 'SATURDAY': 'Cmt', 'SUNDAY': 'Paz'
};
const ALL_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export default function StallsScreen({ route }) { 
  const { user, userProfile } = useContext(AuthContext);
  const isOwner = userProfile?.role === 'OWNER';
  const isAdmin = userProfile?.role === 'ADMIN';
  const isTenant = userProfile?.role === 'TENANT';

  // --- STATE ---
  const [marketplaces, setMarketplaces] = useState([]);
  const [selectedMarketId, setSelectedMarketId] = useState(null);
  const [stalls, setStalls] = useState([]);
  const [rentals, setRentals] = useState([]); 
  const [tenants, setTenants] = useState([]);

  const [selectedDate, setSelectedDate] = useState(new Date());

  // Modallar
  const [stallModalVisible, setStallModalVisible] = useState(false);
  const [rentalModalVisible, setRentalModalVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Formlar
  const [activeStall, setActiveStall] = useState(null); 
  const [stallNumber, setStallNumber] = useState('');
  const [productTypes, setProductTypes] = useState('');
  const [pricesByDay, setPricesByDay] = useState({}); 
  
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [searchTenantText, setSearchTenantText] = useState('');
  const [isMonthMode, setIsMonthMode] = useState(false);
  const [agreedTotalPrice, setAgreedTotalPrice] = useState(''); 
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStallIds, setSelectedStallIds] = useState([]); 

  // --- YARDIMCI FONKSİYONLAR ---
  const getDayId = (date) => ALL_DAYS[date.getDay()];
  
  const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const formatDateDisplay = (date) => date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // --- TAKVİM İŞARETLEME ---
  const markedDates = useMemo(() => {
    if (!selectedMarketId || marketplaces.length === 0) return {};

    const currentMarket = marketplaces.find(m => m.id === selectedMarketId);
    if (!currentMarket || !currentMarket.openDays) return {};

    const marks = {};
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 1); 
    const end = new Date(today.getFullYear(), today.getMonth() + 6, 1); 

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDateKey(d);
      const dayName = ALL_DAYS[d.getDay()];
      
      if (currentMarket.openDays.includes(dayName)) {
        marks[dateStr] = { 
          marked: true, 
          dotColor: COLORS.success, 
          textColor: COLORS.textDark 
        };
      } else {
        marks[dateStr] = { 
          textColor: '#C6C6C8', 
          activeOpacity: 0.5 
        };
      }
    }

    const selectedStr = formatDateKey(selectedDate);
    marks[selectedStr] = {
      ...marks[selectedStr],
      selected: true, 
      selectedColor: COLORS.primary,
      selectedTextColor: '#ffffff',
      dotColor: '#ffffff'
    };

    return marks;
  }, [selectedMarketId, marketplaces, selectedDate]);


  // --- VERİ ÇEKME ---
  useEffect(() => {
    if (route.params?.marketId) setSelectedMarketId(route.params.marketId);
  }, [route.params]);

  useEffect(() => {
    const unsubMarket = subscribeToMarketplaces((data) => {
      setMarketplaces(data);
      if (!route.params?.marketId && !selectedMarketId && data.length > 0) setSelectedMarketId(data[0].id);
    });
    const unsubTenant = subscribeToTenants(setTenants);
    return () => { unsubMarket(); unsubTenant(); }
  }, []);

  useEffect(() => {
    if (selectedMarketId) {
      const filterOwnerId = isOwner ? user.uid : null;
      const unsubStalls = subscribeToStallsByMarket(selectedMarketId, setStalls, filterOwnerId);
      return () => unsubStalls();
    } else { setStalls([]); }
  }, [selectedMarketId, isOwner, user.uid]);

  useEffect(() => {
    if (selectedMarketId) {
      const dateKey = formatDateKey(selectedDate);
      const unsubRentals = subscribeToRentalsByDate(selectedMarketId, dateKey, setRentals);
      return () => unsubRentals();
    }
  }, [selectedMarketId, selectedDate]);

  const currentMarket = marketplaces.find(m => m.id === selectedMarketId);
  const isMarketOpenToday = currentMarket?.openDays?.includes(getDayId(selectedDate));

  // --- HESAPLAMA ---
  const getPriceForDay = (stall, dateObj) => {
    const dayId = getDayId(dateObj);
    if (stall.prices && stall.prices[dayId]) return parseFloat(stall.prices[dayId]);
    return parseFloat(stall.price) || 0;
  };

  const calculateRentDays = () => {
    if (!isMonthMode) return 1;
    let count = 0;
    const currentMonth = selectedDate.getMonth();
    let tempDate = new Date(selectedDate);
    while (tempDate.getMonth() === currentMonth) {
      const dayName = ALL_DAYS[tempDate.getDay()];
      if (selectedWeekdays.includes(dayName)) count++;
      tempDate.setDate(tempDate.getDate() + 1);
    }
    return count;
  };

  const getSelectedStallsObjects = () => {
    if (isSelectionMode) return stalls.filter(s => selectedStallIds.includes(s.id));
    return activeStall ? [activeStall] : [];
  };

  // Toplam hesaplama
  const calculateStandardTotal = () => {
    const targets = getSelectedStallsObjects();
    let total = 0;
    targets.forEach(stall => {
      if (isMonthMode) {
        const currentMonth = selectedDate.getMonth();
        let tempDate = new Date(selectedDate);
        while (tempDate.getMonth() === currentMonth) {
          const dayName = ALL_DAYS[tempDate.getDay()];
          if (selectedWeekdays.includes(dayName)) total += getPriceForDay(stall, tempDate);
          tempDate.setDate(tempDate.getDate() + 1);
        }
      } else {
        total += getPriceForDay(stall, selectedDate);
      }
    });
    return total;
  };

  const standardTotal = calculateStandardTotal();
  const rentDaysCount = calculateRentDays();
  const targetStalls = getSelectedStallsObjects();

  const getStallStatus = (stallId) => {
    const rental = rentals.find(r => r.stallId === stallId);
    return rental ? { isOccupied: true, tenantName: rental.tenantName, rentalId: rental.id } : { isOccupied: false };
  };

  const handlePriceChange = (day, text) => setPricesByDay(prev => ({ ...prev, [day]: text }));

  const handleSaveStall = async () => {
    if (!stallNumber || !selectedMarketId) return Alert.alert('Hata', 'Tahta no ve Pazar gereklidir.');
    const cleanPrices = {};
    let firstValidPrice = 0;
    Object.keys(pricesByDay).forEach(day => {
      if (pricesByDay[day]) {
        cleanPrices[day] = parseFloat(pricesByDay[day]);
        if (!firstValidPrice) firstValidPrice = cleanPrices[day];
      }
    });
    const payload = {
      stallNumber,
      productTypes: productTypes.split(',').map(t=>t.trim()).filter(t=>t),
      marketplaceId: selectedMarketId,
      prices: cleanPrices,
      price: firstValidPrice
    };
    try {
      if (isEditing) await updateStall(activeStall.id, payload);
      else await addStall(payload, user.uid);
      setStallModalVisible(false);
    } catch (error) { Alert.alert('Hata', 'Kaydedilemedi'); }
  };

  const openStallModal = (stall = null) => {
    if (!selectedMarketId) return Alert.alert('Uyarı', 'Lütfen pazar seçin');
    if (stall) {
      setIsEditing(true);
      setActiveStall(stall);
      setStallNumber(stall.stallNumber);
      setProductTypes(stall.productTypes?.join(', ') || '');
      if (stall.prices) {
        const formattedPrices = {};
        Object.keys(stall.prices).forEach(k => formattedPrices[k] = stall.prices[k].toString());
        setPricesByDay(formattedPrices);
      } else {
        const initialPrices = {};
        currentMarket?.openDays?.forEach(day => initialPrices[day] = stall.price?.toString() || '');
        setPricesByDay(initialPrices);
      }
    } else {
      setIsEditing(false);
      setActiveStall(null);
      setStallNumber('');
      setProductTypes('');
      setPricesByDay({});
    }
    setStallModalVisible(true);
  };

  const prepareRentalModal = (stallOrNull) => {
    setActiveStall(stallOrNull);
    setRentalModalVisible(true);
    setSearchTenantText('');
    setSelectedTenant(null);
    setAgreedTotalPrice('');
    setIsMonthMode(false);
    const currentDayName = ALL_DAYS[selectedDate.getDay()];
    setSelectedWeekdays([currentDayName]); 
  };

  const handleStallPress = (stall) => {
    if (!isMarketOpenToday) {
        Alert.alert("Kapalı", "Bu pazar bugün kapalı olduğu için işlem yapılamaz.");
        return;
    }

    if (isSelectionMode) {
        if (selectedStallIds.includes(stall.id)) setSelectedStallIds(selectedStallIds.filter(id => id !== stall.id));
        else setSelectedStallIds([...selectedStallIds, stall.id]);
        return;
    }
    const status = getStallStatus(stall.id);
    if (status.isOccupied) {
      Alert.alert(`${stall.stallNumber} - Dolu`, `Kiracı: ${status.tenantName}`, [
        { text: 'Kapat', style: 'cancel' },
        (isAdmin || isOwner) ? { text: 'Kirayı İptal Et', style: 'destructive', onPress: () => deleteRental(status.rentalId) } : null
      ].filter(Boolean));
    } else {
      prepareRentalModal(stall);
    }
  };

  const handleBatchRentalPress = () => {
    if (selectedStallIds.length === 0) return;
    const validStalls = getSelectedStallsObjects().filter(s => !getStallStatus(s.id).isOccupied);
    if (validStalls.length === 0) return Alert.alert("Uyarı", "Seçtiğiniz tahtaların hepsi dolu.");
    prepareRentalModal(null);
  };

  const handleStallOptions = (stall) => {
    if (isTenant) return;
    if (isSelectionMode) return;
    Alert.alert(`${stall.stallNumber} İşlemleri`, 'Seçiminiz:', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteStall(stall.id) },
      { text: 'Düzenle', onPress: () => openStallModal(stall) }
    ]);
  };

  // --- KİRALAMA OLUŞTURMA (KESİN FİYAT MANTIĞI) ---
  const handleCreateRental = async () => {
    if (!isTenant && !selectedTenant) {
        return Alert.alert('Hata', 'Lütfen bir kiracı seçin.');
    }
    
    const targetStallsList = getSelectedStallsObjects().filter(s => !getStallStatus(s.id).isOccupied);
    if (targetStallsList.length === 0) return;

    // --- 1. ADIM: TÜM KİRALAMA KALEMLERİNİ OLUŞTUR ---
    // Önce "yapılacaklar listesi"ni çıkarıyoruz ki toplam fiyatı bilelim
    // ve dağıtımı ona göre yapalım.
    let allRentalItems = [];
    
    const tenantId = isTenant ? user.uid : selectedTenant?.id;
    const tenantName = isTenant ? userProfile.fullName : selectedTenant?.fullName;

    targetStallsList.forEach(stall => {
        const effectiveOwnerId = stall.ownerId || (isOwner ? user.uid : null);
        
        if (isMonthMode) {
            const currentMonth = selectedDate.getMonth();
            let tempDate = new Date(selectedDate);
            
            while (tempDate.getMonth() === currentMonth) {
                const dayName = ALL_DAYS[tempDate.getDay()];
                if (selectedWeekdays.includes(dayName)) {
                    const dateKey = formatDateKey(new Date(tempDate));
                    const originalPrice = getPriceForDay(stall, tempDate);
                    
                    allRentalItems.push({
                        marketplaceId: selectedMarketId,
                        stallId: stall.id,
                        stallNumber: stall.stallNumber,
                        ownerId: effectiveOwnerId,
                        tenantId,
                        tenantName,
                        dateString: dateKey,
                        date: new Date(tempDate),
                        originalPrice: originalPrice, // Ham fiyat
                        finalPrice: 0 // Sonra hesaplanacak
                    });
                }
                tempDate.setDate(tempDate.getDate() + 1);
            }
        } else {
            const dateKey = formatDateKey(selectedDate);
            const originalPrice = getPriceForDay(stall, selectedDate);
            
            allRentalItems.push({
                marketplaceId: selectedMarketId,
                stallId: stall.id,
                stallNumber: stall.stallNumber,
                ownerId: effectiveOwnerId,
                tenantId,
                tenantName,
                dateString: dateKey,
                date: new Date(selectedDate),
                originalPrice: originalPrice,
                finalPrice: 0
            });
        }
    });

    if (allRentalItems.length === 0) return;

    // --- 2. ADIM: MÜSAİTLİK KONTROLÜ ---
    const checks = [];
    // Her tahta için tarihleri grupla (API çağrısını azalt)
    const stallsMap = {};
    allRentalItems.forEach(item => {
        if(!stallsMap[item.stallId]) stallsMap[item.stallId] = [];
        stallsMap[item.stallId].push(item.dateString);
    });

    // Kontrol sorgularını oluştur
    Object.keys(stallsMap).forEach(stallId => {
        // Tahta numarasını bulmak için örnek bir item'a bak
        const exampleItem = allRentalItems.find(i => i.stallId === stallId);
        checks.push(
            checkAvailability(stallId, stallsMap[stallId])
             .then(conflicts => ({ stallNumber: exampleItem.stallNumber, conflicts }))
        );
    });

    try {
        const results = await Promise.all(checks);
        const errors = results.filter(r => r.conflicts.length > 0);
        
        if (errors.length > 0) {
            const errorMsg = errors.map(e => `${e.stallNumber} dolu:\n${e.conflicts.join(', ')}`).join('\n\n');
            Alert.alert("Çakışma!", `İşlem iptal edildi.\n\n${errorMsg}`);
            return;
        }

        // --- 3. ADIM: FİYAT DAĞITIMI (KURUŞ HASSASİYETİ) ---
        
        // Toplam Standart Fiyat
        const totalStandardPrice = allRentalItems.reduce((sum, item) => sum + item.originalPrice, 0);
        
        // Hedef Fiyat (Anlaşılan veya Standart)
        let targetTotal = totalStandardPrice;
        const isCustomPrice = !isTenant && agreedTotalPrice && parseFloat(agreedTotalPrice) > 0;
        if (isCustomPrice) {
            targetTotal = parseFloat(agreedTotalPrice);
        }

        // Dağıtım Algoritması:
        // Eğer standart fiyat 0 ise (bedava), hedef de 0 olur.
        // Değilse oransal dağıt.
        if (totalStandardPrice > 0) {
            let remainingToDistribute = targetTotal;
            
            allRentalItems.forEach((item, index) => {
                // Son eleman mı? Kalanın hepsini ona ver (Kuruş farkını düzeltmek için)
                if (index === allRentalItems.length - 1) {
                    // 2 ondalık basamağa yuvarla (floating point hatasını önle)
                    item.finalPrice = Math.round(remainingToDistribute * 100) / 100;
                } else {
                    // Oranla: (ItemFiyatı / ToplamStandart) * HedefToplam
                    const ratio = item.originalPrice / totalStandardPrice;
                    let share = targetTotal * ratio;
                    share = Math.round(share * 100) / 100; // 2 hane yuvarla
                    
                    item.finalPrice = share;
                    remainingToDistribute -= share;
                }
            });
        } else {
            // Orijinal fiyat 0 ise hepsi 0
            allRentalItems.forEach(item => item.finalPrice = 0);
        }

        // Payload Hazır (Gereksiz alanları temizle)
        const rentalsPayload = allRentalItems.map(item => ({
            marketplaceId: item.marketplaceId,
            stallId: item.stallId,
            stallNumber: item.stallNumber,
            ownerId: item.ownerId,
            tenantId: item.tenantId,
            tenantName: item.tenantName,
            price: item.finalPrice, // <-- ARTIK KURUŞU KURUŞUNA DENK
            dateString: item.dateString,
            date: item.date
        }));

        const dayNamesStr = isMonthMode 
            ? selectedWeekdays.map(d => SHORT_DAY_LABELS[d]).join(', ') 
            : SHORT_DAY_LABELS[ALL_DAYS[selectedDate.getDay()]];

        Alert.alert(
          'Kiralama Özeti',
          `${targetStallsList.length} Tahta\nGünler: ${dayNamesStr}\n\nToplam: ${targetTotal.toLocaleString('tr-TR')} ₺`,
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Onayla', onPress: () => submitRentals(rentalsPayload) }
          ]
        );

    } catch (error) {
        console.error("Beklenmedik Hata:", error);
        Alert.alert("Hata", "İşlem sırasında bir hata oluştu.");
    }
  };

  const submitRentals = async (payload) => {
    try {
      await createRental(payload);
      setRentalModalVisible(false);
      setIsSelectionMode(false);
      setSelectedStallIds([]);
      
      Alert.alert('Başarılı', 'Kiralama tamamlandı.');

      // --- YENİ: BİLDİRİM GÖNDERME ---
      // Payload içindeki benzersiz ownerId'leri bul (Genelde hepsi aynıdır ama toplu işlemde farklı olabilir)
      const uniqueOwners = [...new Set(payload.map(item => item.ownerId))];
      
      // Her bir tahta sahibine bildirim at
      uniqueOwners.forEach(async (ownerId) => {
        if (ownerId) {
            const ownerProfile = await getUserProfile(ownerId);
            if (ownerProfile?.pushToken) {
                // Mesaj: "Ahmet Yılmaz yeni bir kiralama yaptı!"
                const tenantName = userProfile?.fullName || "Bir kiracı";
                const count = payload.filter(p => p.ownerId === ownerId).length;
                
                await sendPushNotification(
                    ownerProfile.pushToken, 
                    "🔔 Yeni Kiralama Var!", 
                    `${tenantName}, ${count} adet işlem gerçekleştirdi. Detaylar için tıklayın.`
                );
            }
        }
      });
      // -------------------------------

    } catch (error) { Alert.alert('Hata', 'Kiralama yapılamadı.'); }
  };

  const toggleWeekdaySelection = (dayId) => {
    if (selectedWeekdays.includes(dayId)) {
      if (selectedWeekdays.length > 1) setSelectedWeekdays(selectedWeekdays.filter(d => d !== dayId));
      else Alert.alert("Uyarı", "En az bir gün seçili olmalıdır.");
    } else { setSelectedWeekdays([...selectedWeekdays, dayId]); }
  };

  const renderStall = ({ item }) => {
    const status = getStallStatus(item.id);
    const isSelected = selectedStallIds.includes(item.id);
    const displayPrice = getPriceForDay(item, selectedDate);
    return (
      <TouchableOpacity 
        style={[
            styles.card, 
            status.isOccupied ? styles.cardOccupied : styles.cardEmpty,
            isSelectionMode && isSelected && styles.cardSelected
        ]} 
        onPress={() => handleStallPress(item)}
        onLongPress={() => handleStallOptions(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          <View style={[styles.stallIcon, status.isOccupied ? styles.iconOccupied : styles.iconEmpty, isSelectionMode && isSelected && {backgroundColor: COLORS.primary}]}>
             {isSelectionMode ? (
                 <Ionicons name={isSelected ? "checkmark" : "ellipse-outline"} size={20} color={isSelected ? "#fff" : COLORS.textLight} />
             ) : (
                 <Text style={{fontWeight: 'bold', color: status.isOccupied ? COLORS.danger : COLORS.primary}}>{item.stallNumber.substring(0,2)}</Text>
             )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.stallNumber}>{item.stallNumber}</Text>
            {status.isOccupied ? (
              <Text style={styles.tenantName}>{status.tenantName}</Text>
            ) : (
              <Text style={styles.stallTypes}>{item.productTypes?.join(', ') || 'Boş'}</Text>
            )}
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>{displayPrice ? `${displayPrice}₺` : '-'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // isCustomPrice'ı burada tanımlamaya gerek yok, fonksiyon içinde tanımladık.
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tahtalar</Text>
        <View style={{flexDirection:'row'}}>
            {(isAdmin || isOwner) && (
              <>
                <TouchableOpacity style={[styles.actionButton, {backgroundColor: isSelectionMode ? COLORS.textDark : '#E5E5EA', marginRight: 8}]} onPress={() => {
                    if (isSelectionMode) { setIsSelectionMode(false); setSelectedStallIds([]); } 
                    else setIsSelectionMode(true);
                }}>
                    <Text style={[styles.actionButtonText, {color: isSelectionMode ? '#fff' : COLORS.textDark}]}>{isSelectionMode ? 'Vazgeç' : 'Seç'}</Text>
                </TouchableOpacity>
                {!isSelectionMode && (
                    <TouchableOpacity style={[styles.actionButton, {backgroundColor: COLORS.primary}]} onPress={() => openStallModal(null)}>
                    <Text style={[styles.actionButtonText, {color: '#fff'}]}>+ Tahta</Text>
                    </TouchableOpacity>
                )}
              </>
            )}
        </View>
      </View>

      <View style={[styles.dateControl, !isMarketOpenToday && {backgroundColor: '#FFEBEE'}]}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.arrowBtn}>
          <Ionicons name="chevron-back" size={24} color={isMarketOpenToday ? COLORS.primary : COLORS.danger} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCalendarVisible(true)} style={{alignItems: 'center', padding: 5}}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
             <Text style={[styles.dateText, !isMarketOpenToday && {color: COLORS.danger}]}>{formatDateDisplay(selectedDate)}</Text>
             <Ionicons name="calendar-outline" size={18} color={isMarketOpenToday ? COLORS.primary : COLORS.danger} style={{marginLeft: 6}} />
          </View>
          <Text style={[styles.subDateText, !isMarketOpenToday && {color: COLORS.danger}]}>{isMarketOpenToday ? 'Pazar Açık' : 'PAZAR KAPALI'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => changeDate(1)} style={styles.arrowBtn}>
          <Ionicons name="chevron-forward" size={24} color={isMarketOpenToday ? COLORS.primary : COLORS.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 16}}>
          {marketplaces.map(market => (
            <TouchableOpacity key={market.id} style={[styles.chip, selectedMarketId === market.id && styles.chipActive]} onPress={() => setSelectedMarketId(market.id)}>
              <Text style={[styles.chipText, selectedMarketId === market.id && styles.chipTextActive]}>{market.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{flex: 1}}>
        {isMarketOpenToday ? (
            <FlatList data={stalls} renderItem={renderStall} keyExtractor={item => item.id} contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={styles.emptyText}>Kayıtlı tahta yok.</Text>} />
        ) : (
            <View style={styles.closedContainer}>
                <Ionicons name="lock-closed-outline" size={64} color="#E5E5EA" />
                <Text style={styles.closedTitle}>Pazar Yeri Kapalı</Text>
                <Text style={styles.closedText}>{currentMarket?.name} bugün kapalı.</Text>
            </View>
        )}
        {isSelectionMode && selectedStallIds.length > 0 && (
            <View style={styles.bottomBar}>
                <Text style={styles.bottomBarText}>{selectedStallIds.length} Tahta Seçildi</Text>
                <TouchableOpacity style={styles.bottomBarButton} onPress={handleBatchRentalPress}><Text style={styles.bottomBarButtonText}>Kirala</Text></TouchableOpacity>
            </View>
        )}
      </View>

      {/* MODALLAR AYNI KALDI */}
      <Modal visible={calendarVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContainer}>
            <Text style={styles.modalTitle}>Tarih Seçiniz</Text>
            <Calendar
              firstDay={1}
              current={formatDateKey(selectedDate)}
              onDayPress={day => {
                const [y, m, d] = day.dateString.split('-').map(Number);
                const safeDate = new Date(y, m - 1, d, 12, 0, 0);
                setSelectedDate(safeDate);
                setCalendarVisible(false);
              }}
              markedDates={markedDates}
              theme={{
                todayTextColor: COLORS.primary,
                arrowColor: COLORS.primary,
                textDayFontWeight: '600',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: 'bold',
                selectedDayBackgroundColor: COLORS.primary,
                selectedDayTextColor: '#ffffff'
              }}
            />
            <TouchableOpacity style={styles.closeCalendarBtn} onPress={() => setCalendarVisible(false)}>
              <Text style={styles.closeCalendarText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={stallModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{isEditing ? 'Tahtayı Düzenle' : 'Yeni Tahta'}</Text>
                <TextInput style={styles.input} placeholder="Tahta No" placeholderTextColor={COLORS.textLight} value={stallNumber} onChangeText={setStallNumber} />
                <View style={{marginBottom: 10}}>
                    <Text style={styles.sectionHeader}>Günlük Fiyatlar:</Text>
                    {currentMarket?.openDays?.map(day => (
                        <View key={day} style={styles.priceInputRow}>
                            <Text style={styles.dayLabel}>{SHORT_DAY_LABELS[day]}:</Text>
                            <TextInput style={styles.smallInput} placeholder="0" keyboardType="numeric" value={pricesByDay[day] || ''} onChangeText={(text) => handlePriceChange(day, text)} />
                            <Text style={{marginLeft: 5, fontWeight: 'bold'}}>₺</Text>
                        </View>
                    ))}
                </View>
                <TextInput style={styles.input} placeholder="Ürünler" placeholderTextColor={COLORS.textLight} value={productTypes} onChangeText={setProductTypes} />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setStallModalVisible(false)}><Text style={styles.cancelBtnText}>İptal</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStall}><Text style={styles.saveBtnText}>Kaydet</Text></TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={rentalModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { height: '90%' }]}>
            <Text style={styles.modalTitle}>{targetStalls.length > 1 ? 'Toplu Kiralama' : 'Kiralama İşlemi'}</Text>
            <Text style={styles.subTitle}>{targetStalls.length > 1 ? `${targetStalls.length} tahta seçildi` : activeStall?.stallNumber}</Text>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Tek Gün</Text>
              <Switch trackColor={{ false: "#767577", true: COLORS.primary }} onValueChange={() => setIsMonthMode(!isMonthMode)} value={isMonthMode} />
              <Text style={[styles.switchLabel, {fontWeight: isMonthMode ? 'bold': 'normal', color: isMonthMode ? COLORS.primary : 'black'}]}>Ayı Kapat</Text>
            </View>
            {isMonthMode && (
                <View style={styles.daySelectionContainer}>
                    <Text style={styles.daySelectionTitle}>Hangi Günler?</Text>
                    <View style={styles.dayButtonsRow}>
                        {currentMarket?.openDays?.map(dayId => {
                            const isActive = selectedWeekdays.includes(dayId);
                            return (
                                <TouchableOpacity key={dayId} style={[styles.dayButton, isActive && styles.dayButtonActive]} onPress={() => toggleWeekdaySelection(dayId)}>
                                    <Text style={[styles.dayButtonText, isActive && styles.dayButtonTextActive]}>{SHORT_DAY_LABELS[dayId]}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}
            <View style={styles.priceSummaryCard}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Liste Fiyatı:</Text>
                <Text style={styles.priceValue}>{standardTotal.toLocaleString('tr-TR')} ₺</Text>
              </View>
              {!isTenant && (
                <View style={styles.discountInputContainer}>
                    <Text style={styles.discountLabel}>Anlaşılan Tutar:</Text>
                    <TextInput style={styles.discountInput} placeholder={`${standardTotal}`} value={agreedTotalPrice} onChangeText={setAgreedTotalPrice} keyboardType="numeric" />
                    <Text style={styles.currencySuffix}>₺</Text>
                </View>
              )}
            </View>
            {!isTenant && (
                <>
                    <TextInput style={[styles.input, {marginTop: 10}]} placeholder="Kiracı Ara..." placeholderTextColor={COLORS.textLight} value={searchTenantText} onChangeText={setSearchTenantText} />
                    <FlatList data={tenants.filter(t => t.fullName.toLowerCase().includes(searchTenantText.toLowerCase()))} keyExtractor={item => item.id} renderItem={({ item }) => (
                            <TouchableOpacity style={[styles.tenantItem, selectedTenant?.id === item.id && styles.tenantItemActive]} onPress={() => setSelectedTenant(item)}>
                                <Ionicons name={selectedTenant?.id === item.id ? "radio-button-on" : "radio-button-off"} size={20} color={COLORS.primary} />
                                <Text style={styles.tenantItemText}>{item.fullName}</Text>
                            </TouchableOpacity>
                        )} ListEmptyComponent={<Text style={{textAlign:'center', color: '#999', marginTop: 10}}>Kiracı bulunamadı.</Text>} />
                </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRentalModalVisible(false)}><Text style={styles.cancelBtnText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateRental}><Text style={styles.saveBtnText}>Tamamla</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: LAYOUT.padding, backgroundColor: COLORS.cardBg, ...SHADOWS.light },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textDark },
  actionButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  actionButtonText: { fontWeight: '600', fontSize: 13 },
  dateControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#E1F5FE' },
  arrowBtn: { padding: 10 },
  dateText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  subDateText: { fontSize: 10, color: COLORS.textLight },
  filterContainer: { paddingVertical: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E5E5EA', marginRight: 8, marginLeft: 8 },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.textDark },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  listContent: { padding: LAYOUT.padding, paddingBottom: 80 },
  closedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 20 },
  closedTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textDark, marginTop: 16 },
  closedText: { fontSize: 16, color: COLORS.textLight, textAlign: 'center', marginTop: 8 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: LAYOUT.borderRadius, padding: 12, marginBottom: 10, ...SHADOWS.light, borderWidth: 2, borderColor: 'transparent' },
  cardOccupied: { borderColor: '#FFCDD2', backgroundColor: '#FFF5F5' },
  cardEmpty: { borderColor: 'transparent' },
  cardSelected: { borderColor: COLORS.primary, backgroundColor: '#E3F2FD' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  stallIcon: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  iconEmpty: { backgroundColor: '#E1F5FE' },
  iconOccupied: { backgroundColor: '#FFEBEE' },
  cardInfo: { flex: 1 },
  stallNumber: { fontSize: 16, fontWeight: '600', color: COLORS.textDark },
  tenantName: { fontSize: 14, color: COLORS.danger, fontWeight: '700', marginTop: 2 },
  stallTypes: { fontSize: 12, color: COLORS.textLight },
  priceBadge: { backgroundColor: '#F2F2F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priceText: { fontSize: 12, fontWeight: '600', color: COLORS.success },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#ddd', ...SHADOWS.medium },
  bottomBarText: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  bottomBarButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  bottomBarButtonText: { color: '#fff', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20, alignItems: 'center' },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '90%', width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 5 },
  subTitle: { textAlign: 'center', color: COLORS.textLight, marginBottom: 15 },
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, padding: 10, backgroundColor: '#F9F9F9', borderRadius: 8 },
  switchLabel: { fontSize: 12, marginHorizontal: 8 },
  priceSummaryCard: { backgroundColor: '#F0F8FF', padding: 12, borderRadius: 8, marginBottom: 10, borderColor: '#B0E0E6', borderWidth: 1 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { color: COLORS.textLight, fontSize: 14 },
  priceValue: { fontWeight: 'bold', fontSize: 14, color: COLORS.textDark },
  discountInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  discountLabel: { fontWeight: '700', color: COLORS.primary, fontSize: 14 },
  discountInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.primary, borderRadius: 6, width: 100, padding: 6, textAlign: 'right', fontWeight: 'bold', fontSize: 16 },
  currencySuffix: { marginLeft: 6, fontWeight: 'bold', color: COLORS.textDark },
  input: { backgroundColor: '#F2F2F7', padding: 12, borderRadius: 8, marginBottom: 10, color: COLORS.textDark },
  tenantItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  tenantItemActive: { backgroundColor: '#F0F8FF' },
  tenantItemText: { marginLeft: 10, fontSize: 16 },
  modalActions: { flexDirection: 'row', marginTop: 10 },
  cancelBtn: { padding: 14, flex: 1, alignItems: 'center' },
  saveBtn: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, flex: 1, alignItems: 'center' },
  cancelBtnText: { color: COLORS.danger, fontWeight: '600' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 20, color: COLORS.textLight },
  daySelectionContainer: { marginBottom: 15 },
  daySelectionTitle: { fontSize: 12, fontWeight: '600', color: COLORS.textLight, marginBottom: 8, textAlign: 'center' },
  dayButtonsRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  dayButton: { backgroundColor: '#F2F2F7', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, marginHorizontal: 4, marginBottom: 4, borderWidth: 1, borderColor: 'transparent' },
  dayButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayButtonText: { fontSize: 12, color: COLORS.textDark },
  dayButtonTextActive: { color: '#fff', fontWeight: '700' },
  sectionHeader: { fontSize: 14, fontWeight: '600', color: COLORS.textLight, marginBottom: 8 },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dayLabel: { width: 80, fontSize: 14, color: COLORS.textDark },
  smallInput: { flex: 1, backgroundColor: '#F2F2F7', padding: 8, borderRadius: 6, color: COLORS.textDark, textAlign: 'right' },
  calendarModalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 10, width: '100%', alignSelf: 'center' },
  closeCalendarBtn: { marginTop: 15, backgroundColor: '#F2F2F7', padding: 12, borderRadius: 8, alignItems: 'center' },
  closeCalendarText: { color: COLORS.textDark, fontWeight: 'bold' }
});