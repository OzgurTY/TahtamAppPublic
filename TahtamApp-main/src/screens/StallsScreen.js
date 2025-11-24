import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Modal, 
  TextInput, StyleSheet, Alert, SafeAreaView, StatusBar, ScrollView, Switch, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToMarketplaces } from '../services/marketplaceService';
import { subscribeToStallsByMarket, addStall, updateStall, deleteStall } from '../services/stallService';
import { subscribeToTenants } from '../services/tenantService';
import { createRental, deleteRental, subscribeToRentalsByDate } from '../services/rentalService';
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';

// Gün Çeviri Sözlüğü
const DAY_LABELS = {
  'MONDAY': 'Pazartesi', 'TUESDAY': 'Salı', 'WEDNESDAY': 'Çarşamba',
  'THURSDAY': 'Perşembe', 'FRIDAY': 'Cuma', 'SATURDAY': 'Cumartesi', 'SUNDAY': 'Pazar'
};
const SHORT_DAY_LABELS = {
  'MONDAY': 'Pzt', 'TUESDAY': 'Sal', 'WEDNESDAY': 'Çrş',
  'THURSDAY': 'Prş', 'FRIDAY': 'Cum', 'SATURDAY': 'Cmt', 'SUNDAY': 'Paz'
};

const ALL_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export default function StallsScreen() {
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
  const [isEditing, setIsEditing] = useState(false);
  
  // Formlar (Tahta)
  const [activeStall, setActiveStall] = useState(null); 
  const [stallNumber, setStallNumber] = useState('');
  const [productTypes, setProductTypes] = useState('');
  
  // YENİ: Gün bazlı fiyatlar state'i (Örn: { 'TUESDAY': '500', 'SATURDAY': '750' })
  const [pricesByDay, setPricesByDay] = useState({});
  
  // Formlar (Kiralama)
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [searchTenantText, setSearchTenantText] = useState('');
  const [isMonthMode, setIsMonthMode] = useState(false);
  const [agreedTotalPrice, setAgreedTotalPrice] = useState(''); 
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStallIds, setSelectedStallIds] = useState([]); 

  // --- YARDIMCI FONKSİYONLAR ---
  
  const getDayId = (date) => ALL_DAYS[date.getDay()];
  const formatDateKey = (date) => date.toISOString().split('T')[0];
  
  const formatDateDisplay = (date) => {
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
  };

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // --- VERİ ÇEKME ---

  useEffect(() => {
    const unsubMarket = subscribeToMarketplaces((data) => {
      setMarketplaces(data);
      if (!selectedMarketId && data.length > 0) setSelectedMarketId(data[0].id);
    });
    const unsubTenant = subscribeToTenants(setTenants);
    return () => { unsubMarket(); unsubTenant(); }
  }, []);

  useEffect(() => {
    if (selectedMarketId) {
      const unsubStalls = subscribeToStallsByMarket(selectedMarketId, setStalls);
      return () => unsubStalls();
    } else {
      setStalls([]);
    }
  }, [selectedMarketId]);

  useEffect(() => {
    if (selectedMarketId) {
      const dateKey = formatDateKey(selectedDate);
      const unsubRentals = subscribeToRentalsByDate(selectedMarketId, dateKey, setRentals);
      return () => unsubRentals();
    }
  }, [selectedMarketId, selectedDate]);

  const currentMarket = marketplaces.find(m => m.id === selectedMarketId);
  const isMarketOpenToday = currentMarket?.openDays?.includes(getDayId(selectedDate));

  // --- HESAPLAMA FONKSİYONLARI ---

  // Bir tahtanın belirli bir gündeki fiyatını getir
  const getPriceForDay = (stall, dateObj) => {
    const dayId = getDayId(dateObj);
    // Önce gün bazlı fiyatlara bak, yoksa eski usul 'price' alanına bak, o da yoksa 0
    if (stall.prices && stall.prices[dayId]) {
      return parseFloat(stall.prices[dayId]);
    }
    return parseFloat(stall.price) || 0;
  };

  // Kiralama Gün Sayısı
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

  // TOPLAM LİSTE FİYATI HESABI (Dinamik Fiyatlı)
  const targetStalls = getSelectedStallsObjects();
  
  // Bu biraz karmaşık: Seçili her tahta için, seçili her günü döngüye alıp o günün fiyatını toplamalıyız.
  const calculateStandardTotal = () => {
    let total = 0;
    targetStalls.forEach(stall => {
      if (isMonthMode) {
        const currentMonth = selectedDate.getMonth();
        let tempDate = new Date(selectedDate);
        while (tempDate.getMonth() === currentMonth) {
          const dayName = ALL_DAYS[tempDate.getDay()];
          if (selectedWeekdays.includes(dayName)) {
            total += getPriceForDay(stall, tempDate);
          }
          tempDate.setDate(tempDate.getDate() + 1);
        }
      } else {
        // Tek gün
        total += getPriceForDay(stall, selectedDate);
      }
    });
    return total;
  };

  const standardTotal = calculateStandardTotal();
  const rentDaysCount = calculateRentDays();

  // --- İŞLEM FONKSİYONLARI ---

  const getStallStatus = (stallId) => {
    const rental = rentals.find(r => r.stallId === stallId);
    return rental ? { isOccupied: true, tenantName: rental.tenantName, rentalId: rental.id } : { isOccupied: false };
  };

  // Günlük Fiyat Inputlarını Güncelle
  const handlePriceChange = (day, text) => {
    setPricesByDay(prev => ({ ...prev, [day]: text }));
  };

  // TAHTA KAYDETME (GÜNCELLENMİŞ)
  const handleSaveStall = async () => {
    if (!stallNumber || !selectedMarketId) return Alert.alert('Hata', 'Tahta no ve Pazar gereklidir.');

    // pricesByDay içindeki boş değerleri temizle
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
      prices: cleanPrices, // YENİ: Gün bazlı fiyat haritası
      price: firstValidPrice // Geriye uyumluluk ve varsayılan gösterim için bir tane fiyat
    };

    try {
      if (isEditing) await updateStall(activeStall.id, payload);
      else await addStall(payload);
      setStallModalVisible(false);
    } catch (error) { Alert.alert('Hata', 'Kaydedilemedi'); }
  };

  // Modal Açma (Ekle/Düzenle)
  const openStallModal = (stall = null) => {
    if (!selectedMarketId) return Alert.alert('Uyarı', 'Lütfen pazar seçin');
    
    if (stall) {
      // Düzenleme Modu
      setIsEditing(true);
      setActiveStall(stall);
      setStallNumber(stall.stallNumber);
      setProductTypes(stall.productTypes?.join(', ') || '');
      
      // Mevcut fiyatları yükle veya eskiden kalma tek fiyatı varsa onu dağıt
      if (stall.prices) {
        // Object değerlerini stringe çevir (Input için)
        const formattedPrices = {};
        Object.keys(stall.prices).forEach(k => formattedPrices[k] = stall.prices[k].toString());
        setPricesByDay(formattedPrices);
      } else {
        // Eski veri yapısı (sadece .price var)
        const initialPrices = {};
        currentMarket?.openDays?.forEach(day => initialPrices[day] = stall.price?.toString() || '');
        setPricesByDay(initialPrices);
      }
    } else {
      // Yeni Ekleme Modu
      setIsEditing(false);
      setActiveStall(null);
      setStallNumber('');
      setProductTypes('');
      setPricesByDay({});
    }
    setStallModalVisible(true);
  };

  const toggleWeekdaySelection = (dayId) => {
    if (selectedWeekdays.includes(dayId)) {
      if (selectedWeekdays.length > 1) setSelectedWeekdays(selectedWeekdays.filter(d => d !== dayId));
      else Alert.alert("Uyarı", "En az bir gün seçili olmalıdır.");
    } else {
      setSelectedWeekdays([...selectedWeekdays, dayId]);
    }
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
    if (!isMarketOpenToday) return;

    if (isSelectionMode) {
        if (selectedStallIds.includes(stall.id)) setSelectedStallIds(selectedStallIds.filter(id => id !== stall.id));
        else setSelectedStallIds([...selectedStallIds, stall.id]);
        return;
    }

    const status = getStallStatus(stall.id);
    if (status.isOccupied) {
      Alert.alert(`${stall.stallNumber} - Dolu`, `Kiracı: ${status.tenantName}`, [
        { text: 'Kapat', style: 'cancel' },
        { text: 'Kirayı İptal Et', style: 'destructive', onPress: () => deleteRental(status.rentalId) }
      ]);
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
    if(isSelectionMode) return;
    Alert.alert(`${stall.stallNumber} İşlemleri`, 'Seçiminiz:', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteStall(stall.id) },
      { text: 'Düzenle', onPress: () => openStallModal(stall) }
    ]);
  };

  const handleCreateRental = async () => {
    if (!selectedTenant) return Alert.alert('Hata', 'Kiracı seçilmedi.');
    
    const targetStallsList = getSelectedStallsObjects().filter(s => !getStallStatus(s.id).isOccupied);
    if (targetStallsList.length === 0) return;

    const rentalsToCreate = [];
    const isCustomPrice = agreedTotalPrice && parseFloat(agreedTotalPrice) > 0;

    // Eğer özel fiyat varsa indirim oranı hesapla (Oran = Anlaşılan / Liste Fiyatı)
    let discountRatio = 1;
    if (isCustomPrice && standardTotal > 0) {
      discountRatio = parseFloat(agreedTotalPrice) / standardTotal;
    }

    targetStallsList.forEach(stall => {
        if (isMonthMode) {
            const currentMonth = selectedDate.getMonth();
            let tempDate = new Date(selectedDate);
            
            while (tempDate.getMonth() === currentMonth) {
                const dayName = ALL_DAYS[tempDate.getDay()];
                
                if (selectedWeekdays.includes(dayName)) {
                    // O günün orijinal fiyatını bul
                    const originalPrice = getPriceForDay(stall, tempDate);
                    // Eğer indirim varsa oranı uygula, yoksa orijinali kullan
                    const finalPrice = isCustomPrice ? (originalPrice * discountRatio) : originalPrice;

                    rentalsToCreate.push({
                        marketplaceId: selectedMarketId,
                        stallId: stall.id,
                        stallNumber: stall.stallNumber,
                        tenantId: selectedTenant.id,
                        tenantName: selectedTenant.fullName,
                        price: finalPrice,
                        dateString: formatDateKey(tempDate),
                        date: new Date(tempDate)
                    });
                }
                tempDate.setDate(tempDate.getDate() + 1);
            }
        } else {
            // Tek gün
            const originalPrice = getPriceForDay(stall, selectedDate);
            const finalPrice = isCustomPrice ? (originalPrice * discountRatio) : originalPrice;

            rentalsToCreate.push({
                marketplaceId: selectedMarketId,
                stallId: stall.id,
                stallNumber: stall.stallNumber,
                tenantId: selectedTenant.id,
                tenantName: selectedTenant.fullName,
                price: finalPrice,
                dateString: formatDateKey(selectedDate),
                date: new Date(selectedDate)
            });
        }
    });

    const totalAmount = rentalsToCreate.reduce((acc, r) => acc + r.price, 0);
    const dayNamesStr = isMonthMode 
        ? selectedWeekdays.map(d => SHORT_DAY_LABELS[d]).join(', ') 
        : SHORT_DAY_LABELS[ALL_DAYS[selectedDate.getDay()]];

    Alert.alert(
      'Kiralama Özeti',
      `${targetStallsList.length} Tahta\nGünler: ${dayNamesStr}\n\nToplam: ${Math.round(totalAmount)} ₺`,
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Onayla', onPress: () => submitRentals(rentalsToCreate) }
      ]
    );
  };

  const submitRentals = async (payload) => {
    try {
      await createRental(payload);
      setRentalModalVisible(false);
      setIsSelectionMode(false);
      setSelectedStallIds([]);
      Alert.alert('Başarılı', 'Kiralama tamamlandı.');
    } catch (error) {
      Alert.alert('Hata', 'Kiralama yapılamadı.');
    }
  };

  // --- RENDER ---
  const renderStall = ({ item }) => {
    const status = getStallStatus(item.id);
    const isSelected = selectedStallIds.includes(item.id);
    
    // Listede GÖSTERİLECEK FİYAT (Seçili güne göre dinamik)
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
          <View style={[
              styles.stallIcon, 
              status.isOccupied ? styles.iconOccupied : styles.iconEmpty,
              isSelectionMode && isSelected && {backgroundColor: COLORS.primary}
            ]}>
             {isSelectionMode ? (
                 <Ionicons name={isSelected ? "checkmark" : "ellipse-outline"} size={20} color={isSelected ? "#fff" : COLORS.textLight} />
             ) : (
                 <Text style={{fontWeight: 'bold', color: status.isOccupied ? COLORS.danger : COLORS.primary}}>
                    {item.stallNumber.substring(0,2)}
                 </Text>
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
            {/* DİNAMİK FİYAT GÖSTERİMİ */}
            <Text style={styles.priceText}>{displayPrice ? `${displayPrice}₺` : '-'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tahtalar</Text>
        <View style={{flexDirection:'row'}}>
            <TouchableOpacity 
                style={[styles.actionButton, {backgroundColor: isSelectionMode ? COLORS.textDark : '#E5E5EA', marginRight: 8}]} 
                onPress={() => {
                    if (isSelectionMode) { setIsSelectionMode(false); setSelectedStallIds([]); } 
                    else setIsSelectionMode(true);
                }}
            >
                <Text style={[styles.actionButtonText, {color: isSelectionMode ? '#fff' : COLORS.textDark}]}>{isSelectionMode ? 'Vazgeç' : 'Seç'}</Text>
            </TouchableOpacity>

            {!isSelectionMode && (
                <TouchableOpacity style={[styles.actionButton, {backgroundColor: COLORS.primary}]} onPress={() => openStallModal(null)}>
                <Text style={[styles.actionButtonText, {color: '#fff'}]}>+ Tahta</Text>
                </TouchableOpacity>
            )}
        </View>
      </View>

      <View style={[styles.dateControl, !isMarketOpenToday && {backgroundColor: '#FFEBEE'}]}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.arrowBtn}>
          <Ionicons name="chevron-back" size={24} color={isMarketOpenToday ? COLORS.primary : COLORS.danger} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={[styles.dateText, !isMarketOpenToday && {color: COLORS.danger}]}>{formatDateDisplay(selectedDate)}</Text>
          <Text style={[styles.subDateText, !isMarketOpenToday && {color: COLORS.danger}]}>{isMarketOpenToday ? 'Pazar Açık' : 'PAZAR KAPALI'}</Text>
        </View>
        <TouchableOpacity onPress={() => changeDate(1)} style={styles.arrowBtn}>
          <Ionicons name="chevron-forward" size={24} color={isMarketOpenToday ? COLORS.primary : COLORS.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 16}}>
          {marketplaces.map(market => (
            <TouchableOpacity 
              key={market.id} 
              style={[styles.chip, selectedMarketId === market.id && styles.chipActive]}
              onPress={() => setSelectedMarketId(market.id)}
            >
              <Text style={[styles.chipText, selectedMarketId === market.id && styles.chipTextActive]}>{market.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{flex: 1}}>
        {isMarketOpenToday ? (
            <FlatList
            data={stalls}
            renderItem={renderStall}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyText}>Kayıtlı tahta yok.</Text>}
            />
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
                <TouchableOpacity style={styles.bottomBarButton} onPress={handleBatchRentalPress}>
                    <Text style={styles.bottomBarButtonText}>Kirala</Text>
                </TouchableOpacity>
            </View>
        )}
      </View>


      {/* --- TAHTA EKLEME / DÜZENLEME MODALI (GÜNCELLENDİ) --- */}
      <Modal visible={stallModalVisible} animationType="slide" transparent={true}>
         <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{isEditing ? 'Tahtayı Düzenle' : 'Yeni Tahta'}</Text>
            
            <TextInput 
                style={styles.input} 
                placeholder="Tahta No (Örn: A-10)" 
                placeholderTextColor={COLORS.textLight} 
                value={stallNumber} 
                onChangeText={setStallNumber} 
            />
            
            {/* GÜNLÜK FİYAT GİRİŞLERİ */}
            <View style={{marginBottom: 10}}>
                <Text style={styles.sectionHeader}>Günlük Fiyatlar:</Text>
                {currentMarket?.openDays?.map(day => (
                    <View key={day} style={styles.priceInputRow}>
                        <Text style={styles.dayLabel}>{DAY_LABELS[day]}:</Text>
                        <TextInput 
                            style={styles.smallInput} 
                            placeholder="0" 
                            keyboardType="numeric"
                            value={pricesByDay[day] || ''}
                            onChangeText={(text) => handlePriceChange(day, text)}
                        />
                        <Text style={{marginLeft: 5, fontWeight: 'bold'}}>₺</Text>
                    </View>
                ))}
            </View>

            <TextInput 
                style={styles.input} 
                placeholder="Ürünler (Virgülle ayırın)" 
                placeholderTextColor={COLORS.textLight} 
                value={productTypes} 
                onChangeText={setProductTypes} 
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setStallModalVisible(false)}><Text style={styles.cancelBtnText}>İptal</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStall}><Text style={styles.saveBtnText}>Kaydet</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* KİRALAMA MODALI (AYNI KALDI) */}
      <Modal visible={rentalModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { height: '90%' }]}>
            <Text style={styles.modalTitle}>
                {targetStalls.length > 1 ? 'Toplu Kiralama' : 'Kiralama İşlemi'}
            </Text>
            <Text style={styles.subTitle}>
                {targetStalls.length > 1 ? `${targetStalls.length} tahta seçildi` : activeStall?.stallNumber}
            </Text>
            
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Tek Gün</Text>
              <Switch 
                trackColor={{ false: "#767577", true: COLORS.primary }}
                onValueChange={() => setIsMonthMode(!isMonthMode)}
                value={isMonthMode}
              />
              <Text style={[styles.switchLabel, {fontWeight: isMonthMode ? 'bold': 'normal', color: isMonthMode ? COLORS.primary : 'black'}]}>
                Ayı Kapat
              </Text>
            </View>

            {isMonthMode && (
                <View style={styles.daySelectionContainer}>
                    <Text style={styles.daySelectionTitle}>Hangi Günler?</Text>
                    <View style={styles.dayButtonsRow}>
                        {currentMarket?.openDays?.map(dayId => {
                            const isActive = selectedWeekdays.includes(dayId);
                            return (
                                <TouchableOpacity 
                                    key={dayId} 
                                    style={[styles.dayButton, isActive && styles.dayButtonActive]}
                                    onPress={() => toggleWeekdaySelection(dayId)}
                                >
                                    <Text style={[styles.dayButtonText, isActive && styles.dayButtonTextActive]}>
                                        {SHORT_DAY_LABELS[dayId]}
                                    </Text>
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
              
              <View style={styles.discountInputContainer}>
                <Text style={styles.discountLabel}>Anlaşılan Tutar:</Text>
                <TextInput 
                  style={styles.discountInput}
                  placeholder={`${standardTotal}`}
                  value={agreedTotalPrice}
                  onChangeText={setAgreedTotalPrice}
                  keyboardType="numeric"
                />
                <Text style={styles.currencySuffix}>₺</Text>
              </View>
            </View>

            <TextInput 
              style={[styles.input, {marginTop: 10}]} placeholder="Kiracı Ara..." placeholderTextColor={COLORS.textLight}
              value={searchTenantText} onChangeText={setSearchTenantText} 
            />

            <FlatList
              data={tenants.filter(t => t.fullName.toLowerCase().includes(searchTenantText.toLowerCase()))}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.tenantItem, selectedTenant?.id === item.id && styles.tenantItemActive]}
                  onPress={() => setSelectedTenant(item)}
                >
                  <Ionicons name={selectedTenant?.id === item.id ? "radio-button-on" : "radio-button-off"} size={20} color={COLORS.primary} />
                  <Text style={styles.tenantItemText}>{item.fullName}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{textAlign:'center', color: '#999', marginTop: 10}}>Kiracı bulunamadı.</Text>}
            />
            
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
  // ... (Eski stiller aynı) ...
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '90%' },
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

  // YENİ FİYAT GİRİŞ STİLLERİ
  sectionHeader: { fontSize: 14, fontWeight: '600', color: COLORS.textLight, marginBottom: 8 },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dayLabel: { width: 80, fontSize: 14, color: COLORS.textDark },
  smallInput: { flex: 1, backgroundColor: '#F2F2F7', padding: 8, borderRadius: 6, color: COLORS.textDark, textAlign: 'right' }
});