import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, 
  TouchableOpacity, Alert, Modal, Clipboard, TextInput, KeyboardAvoidingView, Platform, Linking 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { 
  subscribeToRentalsByRole, deleteRental, deleteRentalsBatch,
  deleteRentalGroup, addPayment 
} from '../services/rentalService';
import { getUserProfile } from '../services/authService'; 
import { getTenant } from '../services/tenantService';
import { subscribeToMarketplaces } from '../services/marketplaceService';
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';

// KART BİLEŞENİ
const RentalCard = ({ 
  item, userRole, // userRole eklendi
  isSelectionMode, isSelected, 
  onPaymentPress, onDelete, onShowIban, onSelect, 
  marketplacesMap, ownerProfile 
}) => {
  const [counterpartName, setCounterpartName] = useState('Yükleniyor...');
  const [counterpartPhone, setCounterpartPhone] = useState(null);

  // Rol Kontrolleri
  const isManager = userRole === 'MARKET_MANAGER';
  const isOwner = userRole === 'OWNER';
  const isTenant = userRole === 'TENANT';
  const canManage = isOwner || isManager || userRole === 'ADMIN';

  useEffect(() => {
    let isMounted = true;
    
    const fetchCounterpartInfo = async () => {
        // Kimin bilgisini göstereceğiz?
        // Manager -> Kiracıyı görür
        // Owner -> Kiracıyı görür
        // Tenant -> Sahibini görür
        const targetId = canManage 
            ? (item.isGroup ? item.firstRecord.tenantId : item.tenantId)
            : (item.isGroup ? item.firstRecord.ownerId : item.ownerId);

        if (targetId) {
            let profile = await getUserProfile(targetId);
            if (!profile && canManage) {
                profile = await getTenant(targetId);
            }

            if (isMounted && profile) {
                setCounterpartName(profile.fullName);
                setCounterpartPhone(profile.phone);
            } else if (isMounted) {
                setCounterpartName("Bilinmeyen Kullanıcı");
            }
        }
    };

    fetchCounterpartInfo();
    return () => { isMounted = false; };
  }, [item, canManage]);

  const formattedDate = item.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });

  const handlePress = () => {
    if (isSelectionMode) onSelect(item.id);
  };

  const handleWhatsApp = () => {
    if (!counterpartPhone) return Alert.alert("Hata", "Kullanıcının telefon numarası kayıtlı değil.");
    let cleanPhone = counterpartPhone.replace(/[^\d]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('90') && cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;

    const marketName = marketplacesMap[item.marketplaceId] || "Pazaryeri";
    const stallInfo = item.isGroup ? item.summaryText : item.stallNumber;
    const dateInfo = item.isGroup ? item.customDateText : formattedDate;
    
    // WhatsApp mesajında her zaman TAM BORÇ yazmalı (Kiracıya giden mesaj çünkü)
    // Kartta gösterilen (komisyonlu) fiyat değil, veritabanındaki orijinal fiyat.
    // item.originalPrice bizim aşağıda hesapladığımız view-model verisi değil,
    // item.firstRecord.price veya item.price (ham veri) kullanılmalı.
    // Ancak burada item artık işlenmiş veri. Orijinal toplamı bulmak için:
    const totalDebt = item.isGroup ? item.totalOriginalPrice : item.originalPrice;
    const totalPaid = item.isGroup ? item.totalOriginalPaid : item.originalPaid;
    const remaining = totalDebt - totalPaid;

    let message = `Sayın *${counterpartName}*,\n\n`;
    message += `*${marketName}* - *${stallInfo}* kiralama işleminiz hakkında bilgilendirmedir.\n\n`;
    message += `📅 *Tarih:* ${dateInfo}\n`;
    message += `💰 *Toplam Tutar:* ${totalDebt.toLocaleString('tr-TR')} ₺\n`;

    if (item.isPaid) {
        message += `✅ *Durum:* ÖDEME ALINDI\n\nİlginiz için teşekkür ederiz.`;
    } else {
        message += `⚠️ *Kalan Bakiye:* ${remaining.toLocaleString('tr-TR')} ₺\n\n`;
        if (ownerProfile && ownerProfile.iban) {
            message += `--------------------------------\n`;
            message += `*Ödeme Bilgileri:*\n`;
            message += `👤 *Alıcı:* ${ownerProfile.fullName}\n`;
            const ibanClean = ownerProfile.iban.toUpperCase().replace(/TR/g, '').replace(/\s/g, '');
            message += `🏦 *IBAN:* TR${ibanClean}\n`;
            message += `--------------------------------\n\n`;
        }
        message += `Ödemenizi yaptıktan sonra dekont paylaşmanızı rica ederiz. İyi çalışmalar.`;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert("Hata", "WhatsApp açılamadı."));
  };

  const handleCall = () => {
    if (!counterpartPhone) return Alert.alert("Hata", "Telefon numarası bulunamadı.");
    Linking.openURL(`tel:${counterpartPhone}`);
  };

  let statusText = 'BEKLİYOR';
  let statusColor = COLORS.danger;
  
  // Görüntülenen fiyata göre kalan
  let displayRemaining = item.displayPrice - (item.displayPaid || 0);

  if (item.isPaid) {
    statusText = 'ÖDENDİ';
    statusColor = COLORS.success;
  } else if ((item.displayPaid || 0) > 0.1) {
    statusText = `KALAN: ${Math.round(displayRemaining).toLocaleString()} ₺`;
    statusColor = COLORS.warning;
  }

  // Gelir Tipi Etiketi
  let revenueLabel = null;
  if (isManager) revenueLabel = "Komisyon Geliri";
  else if (isOwner && item.isManaged) revenueLabel = "Net Gelir (Komisyon Düştü)";

  return (
    <TouchableOpacity 
        style={[
          styles.card, 
          { borderLeftColor: statusColor },
          isSelectionMode && isSelected && styles.cardSelected
        ]}
        activeOpacity={0.8}
        onPress={handlePress}
        onLongPress={!isSelectionMode ? () => onDelete(item) : null}
      >
        <View style={styles.cardContentWrapper}>
            {isSelectionMode && (
                <View style={styles.selectionIcon}>
                    <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? COLORS.primary : COLORS.textLight} />
                </View>
            )}

            <View style={{flex: 1}}>
                <View style={styles.cardHeader}>
                  <Text style={styles.dateText}>
                      {item.isGroup ? item.customDateText : formattedDate}
                  </Text>
                  
                  <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                      <Text style={styles.statusText}>{statusText}</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={{flex:1}}>
                      <Text style={styles.stallText} numberOfLines={2}>
                          {item.isGroup ? item.summaryText : item.stallNumber}
                      </Text>
                      
                      <Text style={styles.subText}>
                          {canManage 
                          ? `Kiracı: ${item.tenantName}` 
                          : `Tahta Sahibi: ${counterpartName}`} 
                      </Text>
                      
                      {item.isGroup && <Text style={styles.dateRangeText}>{item.dateRange}</Text>}
                      
                      {/* GELİR TİPİ BİLGİSİ */}
                      {revenueLabel && (
                          <Text style={{fontSize: 10, color: COLORS.textLight, fontStyle:'italic', marginTop: 2}}>
                              ({revenueLabel})
                          </Text>
                      )}
                  </View>
                  
                  <View style={{alignItems:'flex-end'}}>
                    {/* HESAPLANMIŞ FİYAT GÖSTERİMİ */}
                    <Text style={styles.priceText}>{item.displayPrice.toLocaleString('tr-TR')} ₺</Text>
                    
                    {(item.displayPaid || 0) > 0.1 && (
                        <Text style={styles.paidAmountText}>
                            (Alınan: {Math.round(item.displayPaid).toLocaleString()} ₺)
                        </Text>
                    )}
                  </View>
                </View>
            </View>
        </View>

        {!isSelectionMode && (
            <View style={styles.cardFooter}>
                {canManage ? (
                    <View style={{flexDirection: 'row', width: '100%'}}>
                        <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#25D366', marginRight: 8 }]} onPress={handleWhatsApp}>
                            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#007AFF', marginRight: 8 }]} onPress={handleCall}>
                            <Ionicons name="call" size={20} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.actionButton, { flex: 1, backgroundColor: item.isPaid ? COLORS.success : COLORS.primary }]}
                            onPress={() => onPaymentPress(item)}
                        >
                            <Ionicons name={item.isPaid ? "create-outline" : "wallet-outline"} size={18} color="#fff" />
                            <Text style={[styles.actionText, { color: '#fff' }]}>
                                {item.isPaid ? 'Düzenle' : 'Ödeme Al'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    !item.isPaid && (
                        <TouchableOpacity 
                            style={[styles.actionButton, { backgroundColor: COLORS.secondary }]}
                            onPress={() => onShowIban(item.isGroup ? item.firstRecord.ownerId : item.ownerId)}
                        >
                            <Ionicons name="card" size={18} color="#fff" />
                            <Text style={[styles.actionText, { color: '#fff' }]}>Ödeme Yap (IBAN Göster)</Text>
                        </TouchableOpacity>
                    )
                )}
            </View>
        )}
      </TouchableOpacity>
  );
};

export default function RentalsScreen() {
  const { user, userProfile } = useContext(AuthContext);
  const [rentals, setRentals] = useState([]);
  const [groupedRentals, setGroupedRentals] = useState([]);
  const [filteredRentals, setFilteredRentals] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [marketplacesMap, setMarketplacesMap] = useState({});
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); 

  // Modallar ve Ödeme State'leri
  const [ibanModalVisible, setIbanModalVisible] = useState(false);
  const [currentOwnerIban, setCurrentOwnerIban] = useState('');
  const [currentOwnerName, setCurrentOwnerName] = useState('');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedRentalForPayment, setSelectedRentalForPayment] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentType, setPaymentType] = useState('COLLECT'); 
  
  // Rol Kontrolleri
  const userRole = userProfile?.role;
  const canManage = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MARKET_MANAGER';

  // 1. Market İsimleri
  useEffect(() => {
    const unsubscribe = subscribeToMarketplaces((data) => {
        const map = {};
        data.forEach(m => { map[m.id] = m.name; });
        setMarketplacesMap(map);
    });
    return () => unsubscribe();
  }, []);

  // 2. Verileri Çek
  useEffect(() => {
    if (user && userProfile) {
      const unsubscribe = subscribeToRentalsByRole(user.uid, userProfile.role, (data) => {
        setRentals(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, userProfile]);

  // 3. Gruplama ve FİYAT HESAPLAMA Mantığı
  useEffect(() => {
    if (rentals.length === 0) {
        setGroupedRentals([]);
        setFilteredRentals([]);
        return;
    }

    // Fiyat Hesaplama Yardımcı Fonksiyonu
    const calculateDisplayValues = (item) => {
        let price = parseFloat(item.price) || 0;
        let paid = parseFloat(item.paidAmount) || 0;
        const originalPrice = price; // Tam borç (WhatsApp için)
        const originalPaid = paid;

        // Eğer Yönetici ise -> Komisyonu görsün
        if (userRole === 'MARKET_MANAGER' && item.isManaged) {
            price = item.commissionAmount || 0;
            // Ödenen miktar orantılı olmalı
            // (Toplam Ödenen / Toplam Borç) * Komisyon
            const ratio = (originalPrice > 0) ? (paid / originalPrice) : 0;
            paid = price * ratio;
        } 
        // Eğer Owner ise ve işlem yönetildiyse -> Net geliri görsün
        else if (userRole === 'OWNER' && item.isManaged) {
            price = item.ownerRevenue || 0;
            const ratio = (originalPrice > 0) ? (paid / originalPrice) : 0;
            paid = price * ratio;
        }

        return { displayPrice: price, displayPaid: paid, originalPrice, originalPaid };
    };

    const groups = {};
    const singles = [];

    rentals.forEach(item => {
        const { displayPrice, displayPaid, originalPrice, originalPaid } = calculateDisplayValues(item);

        if (item.groupId) {
            if (!groups[item.groupId]) {
                groups[item.groupId] = {
                    id: item.groupId, 
                    isGroup: true,
                    items: [],
                    firstRecord: item, 
                    isPaid: item.isPaid,
                    tenantName: item.tenantName,
                    // Toplamlar
                    displayPrice: 0,
                    displayPaid: 0,
                    totalOriginalPrice: 0,
                    totalOriginalPaid: 0,
                    dates: []
                };
            }
            groups[item.groupId].items.push(item);
            
            // Görüntülenecek (Rol Bazlı) Toplamlar
            groups[item.groupId].displayPrice += displayPrice;
            groups[item.groupId].displayPaid += displayPaid;
            
            // Gerçek (Ham) Toplamlar (WhatsApp ve Veritabanı için)
            groups[item.groupId].totalOriginalPrice += originalPrice;
            groups[item.groupId].totalOriginalPaid += originalPaid;

            groups[item.groupId].dates.push(item.date);
            
            if (!item.isPaid) groups[item.groupId].isPaid = false; 
        } else {
            // Tekil öğeye de hesaplanmış değerleri ekle
            singles.push({
                ...item,
                displayPrice,
                displayPaid,
                originalPrice,
                originalPaid
            });
        }
    });

    const processedGroups = Object.values(groups).map(group => {
        group.dates.sort((a, b) => a - b);
        const firstDate = group.dates[0];
        const lastDate = group.dates[group.dates.length - 1];
        
        const monthName = firstDate.toLocaleDateString('tr-TR', { month: 'long' });
        const uniqueDayIndices = [...new Set(group.dates.map(d => d.getDay()))].sort();
        const dayNamesMap = ['Paz', 'Pzt', 'Sal', 'Çar', 'Prş', 'Cum', 'Cmt'];
        const dayNamesStr = uniqueDayIndices.map(d => dayNamesMap[d]).join(' & ');
        const customDateText = `${monthName} Ayı ${dayNamesStr}`;
        const uniqueStalls = [...new Set(group.items.map(i => i.stallNumber))].sort().join(' / ');
        const dateRange = `${firstDate.toLocaleDateString('tr-TR', {day:'numeric', month:'short'})} - ${lastDate.toLocaleDateString('tr-TR', {day:'numeric', month:'short'})}`;
        
        return {
            ...group,
            date: firstDate,
            dateRange: dateRange,
            customDateText: customDateText, 
            summaryText: uniqueStalls,      
            count: group.items.length
        };
    });

    const combined = [...singles, ...processedGroups].sort((a, b) => b.date - a.date);
    setGroupedRentals(combined);
    setFilteredRentals(combined);

  }, [rentals, userRole]); // userRole değişirse yeniden hesapla

  // ... (Arama ve Filterleme AYNI) ...
  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredRentals(groupedRentals);
    } else {
      const lowerText = searchText.toLowerCase();
      const filtered = groupedRentals.filter(item => {
        const stallNum = item.isGroup ? item.summaryText : item.stallNumber;
        const tName = item.tenantName || '';
        return (stallNum.toLowerCase().includes(lowerText) || tName.toLowerCase().includes(lowerText));
      });
      setFilteredRentals(filtered);
    }
  }, [searchText, groupedRentals]);

  // --- İŞLEMLER ---

  const handleOpenPaymentModal = (item) => {
    if (!canManage) return;
    
    // Modalda her zaman GERÇEK (Ham) borcu göstermeli ve tahsil etmeli
    // Çünkü para kasaya tam girer, sistem sonra onu böler.
    const totalPrice = item.isGroup ? item.totalOriginalPrice : item.originalPrice;
    const totalPaid = item.isGroup ? item.totalOriginalPaid : item.originalPaid;
    const remaining = totalPrice - totalPaid;
    
    setPaymentAmountInput(remaining > 0 ? Math.round(remaining).toString() : '');
    setPaymentType('COLLECT'); 
    
    // Modala göndermek için geçici obje (Fiyatları düzeltilmiş)
    setSelectedRentalForPayment({
        ...item,
        price: totalPrice,      // Modal için ham fiyat
        paidAmount: totalPaid   // Modal için ham ödenen
    });
    
    setPaymentModalVisible(true);
  };

  // ... (Ödeme Kaydetme, Silme, IBAN vb. fonksiyonlar AYNI kalacak) ...
  // Not: handleSavePayment içinde addPayment çağrılırken zaten item ID'si kullanılıyor,
  // servis tarafı ham veriyi veritabanından çekip işlem yaptığı için sorun olmaz.
  
  const handleSavePayment = async () => {
    if (!selectedRentalForPayment || !paymentAmountInput) return;
    try {
        let amount = parseFloat(paymentAmountInput);
        if (isNaN(amount) || amount <= 0) return Alert.alert("Hata", "Geçerli bir tutar giriniz.");
        if (paymentType === 'CORRECT') amount = -amount;
        
        const currentPaid = selectedRentalForPayment.paidAmount || 0;
        const remaining = selectedRentalForPayment.price - currentPaid;

        if (paymentType === 'COLLECT' && amount > remaining + 1) return Alert.alert("Hata", "Kalan borçtan fazla ödeme giremezsiniz.");
        if (paymentType === 'CORRECT' && Math.abs(amount) > currentPaid) return Alert.alert("Hata", "Ödenen tutardan fazlasını silemezsiniz.");

        await addPayment(selectedRentalForPayment, amount);
        setPaymentModalVisible(false);
        setPaymentAmountInput('');
        setSelectedRentalForPayment(null);
        Alert.alert("Başarılı", "İşlem kaydedildi.");
    } catch (error) { Alert.alert("Hata", "İşlem kaydedilemedi."); }
  };

  // ... (Diğer yardımcı fonksiyonlar) ...
  const handleDelete = (item) => {
      if (!canManage) return;
      const message = item.isGroup ? `Bu toplu kiralamayı silmek istiyor musunuz?` : 'Bu kaydı silmek istiyor musunuz?';
      Alert.alert('Sil', message, [{ text: 'İptal', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => item.isGroup ? deleteRentalGroup(item.id) : deleteRental(item.id) }]);
  };
  const handleShowIban = async (ownerId) => {
      try {
          const ownerData = await getUserProfile(ownerId);
          if (ownerData?.iban) { setCurrentOwnerName(ownerData.fullName); setCurrentOwnerIban(ownerData.iban); setIbanModalVisible(true); }
          else Alert.alert("Bilgi", "IBAN girilmemiş.");
      } catch { Alert.alert("Hata", "Bilgi alınamadı."); }
  };
  const copyToClipboard = () => { Clipboard.setString(currentOwnerIban); Alert.alert("Kopyalandı", "IBAN kopyalandı."); };
  const toggleSelectionMode = () => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); };
  const toggleSelectId = (id) => { if(selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i=>i!==id)); else setSelectedIds([...selectedIds, id]); };
  const handleBatchDelete = () => { /* ... */ };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Hareketler</Text>
            {canManage && (
                <TouchableOpacity style={[styles.selectButton, isSelectionMode && {backgroundColor: COLORS.textDark}]} onPress={toggleSelectionMode}>
                    <Text style={[styles.selectButtonText, isSelectionMode && {color: '#fff'}]}>{isSelectionMode ? 'Vazgeç' : 'Seç'}</Text>
                </TouchableOpacity>
            )}
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textLight} style={{marginRight: 8}} />
          <TextInput style={styles.searchInput} placeholder={canManage ? "Tahta veya Kiracı ara..." : "Tahta ara..."} placeholderTextColor={COLORS.textLight} value={searchText} onChangeText={setSearchText} />
          {searchText.length > 0 && <TouchableOpacity onPress={() => setSearchText('')}><Ionicons name="close-circle" size={18} color={COLORS.textLight} /></TouchableOpacity>}
        </View>
      </View>

      <FlatList
        data={filteredRentals}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, isSelectionMode && {paddingBottom: 100}]}
        ListEmptyComponent={<Text style={styles.emptyText}>Henüz işlem yok.</Text>}
        renderItem={({ item }) => (
          <RentalCard 
            item={item}
            userRole={userProfile?.role} // Rol bilgisini geçir
            canManage={canManage}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.includes(item.id)}
            onSelect={toggleSelectId}
            onPaymentPress={handleOpenPaymentModal}
            onDelete={handleDelete}
            onShowIban={handleShowIban}
            marketplacesMap={marketplacesMap}
            ownerProfile={userProfile}
          />
        )}
      />

      {isSelectionMode && selectedIds.length > 0 && (
          <View style={styles.bottomBar}>
              <View style={styles.selectionCountContainer}>
                  <Text style={styles.selectionCountText}>{selectedIds.length} Seçildi</Text>
              </View>
              <View style={styles.bottomActions}>
                  <TouchableOpacity style={styles.bottomBtnDelete} onPress={() => { /* Batch Delete Logic Here or Import */ }}>
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                      <Text style={styles.bottomBtnText}>Sil</Text>
                  </TouchableOpacity>
              </View>
          </View>
      )}

      {/* MODALLAR (AYNI) */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>İşlem Detayı</Text>
                {selectedRentalForPayment && (
                    <View style={{width:'100%', marginBottom: 20}}>
                        <Text style={{textAlign:'center', color:COLORS.textLight, marginBottom:5}}>Toplam Borç</Text>
                        <Text style={{textAlign:'center', fontSize:20, fontWeight:'bold', color:COLORS.textDark}}>
                            {selectedRentalForPayment.price.toLocaleString('tr-TR')} ₺
                        </Text>
                        <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:15, padding:10, backgroundColor:'#F8F9FA', borderRadius:8}}>
                            <Text>Daha Önce Ödenen:</Text>
                            <Text style={{fontWeight:'bold'}}>{(selectedRentalForPayment.paidAmount||0).toLocaleString('tr-TR')} ₺</Text>
                        </View>
                        <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:5, padding:10, backgroundColor:'#F8F9FA', borderRadius:8}}>
                            <Text>Kalan Tutar:</Text>
                            <Text style={{fontWeight:'bold', color:COLORS.danger}}>
                                {(selectedRentalForPayment.price - (selectedRentalForPayment.paidAmount||0)).toLocaleString('tr-TR')} ₺
                            </Text>
                        </View>
                    </View>
                )}
                <View style={styles.toggleContainer}>
                    <TouchableOpacity style={[styles.toggleBtn, paymentType === 'COLLECT' && styles.toggleBtnActive]} onPress={() => setPaymentType('COLLECT')}><Text style={[styles.toggleText, paymentType === 'COLLECT' && styles.toggleTextActive]}>Tahsilat</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.toggleBtn, paymentType === 'CORRECT' && styles.toggleBtnActiveRed]} onPress={() => setPaymentType('CORRECT')}><Text style={[styles.toggleText, paymentType === 'CORRECT' && styles.toggleTextActive]}>Düzeltme / İade</Text></TouchableOpacity>
                </View>
                <Text style={styles.inputLabel}>{paymentType === 'COLLECT' ? 'Tahsil Edilecek Tutar' : 'Silinecek Tutar'}</Text>
                <View style={{flexDirection:'row', alignItems:'center', width:'100%'}}>
                    <TextInput style={[styles.input, {flex:1, textAlign:'center', fontSize:24, fontWeight:'bold'}, {color: paymentType === 'COLLECT' ? COLORS.success : COLORS.danger}]} value={paymentAmountInput} onChangeText={setPaymentAmountInput} keyboardType="numeric" autoFocus={true} placeholder="0" />
                    <Text style={{fontSize:24, fontWeight:'bold', marginLeft:10, color:COLORS.textLight}}>₺</Text>
                </View>
                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setPaymentModalVisible(false)}><Text style={styles.cancelBtnText}>İptal</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, paymentType === 'CORRECT' && {backgroundColor: COLORS.danger}]} onPress={handleSavePayment}><Text style={styles.saveBtnText}>{paymentType === 'COLLECT' ? 'Kaydet' : 'Düzelt'}</Text></TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={ibanModalVisible} animationType="fade" transparent={true}>
         <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Ödeme Bilgileri</Text>
                <Text style={styles.modalSubTitle}>{currentOwnerName}</Text>
                <View style={styles.ibanBox}><Text style={styles.ibanText}>{currentOwnerIban}</Text></View>
                <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}><Ionicons name="copy-outline" size={20} color="#fff" /><Text style={{color:'#fff', fontWeight:'bold', marginLeft: 8}}>Kopyala</Text></TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={() => setIbanModalVisible(false)}><Text style={{color: COLORS.textLight}}>Kapat</Text></TouchableOpacity>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... (Stiller AYNI, contactBtn gibi özel stiller varsa ekle) ...
  container: { flex: 1, backgroundColor: COLORS.background },
  headerContainer: { backgroundColor: COLORS.cardBg, padding: LAYOUT.padding, paddingBottom: 12, ...SHADOWS.light, zIndex: 1 },
  headerTop: { marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textDark },
  selectButton: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#E5E5EA', borderRadius: 16 },
  selectButtonText: { fontWeight: '600', fontSize: 13, color: COLORS.textDark },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 10, paddingHorizontal: 10, height: 40 },
  searchInput: { flex: 1, height: '100%', color: COLORS.textDark },
  listContent: { padding: LAYOUT.padding },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOWS.light, borderLeftWidth: 5 },
  cardPaid: { borderLeftColor: COLORS.success },
  cardUnpaid: { borderLeftColor: COLORS.danger },
  cardSelected: { backgroundColor: '#E3F2FD', borderColor: COLORS.primary, borderWidth: 1 },
  cardContentWrapper: { flexDirection: 'row', alignItems: 'center' },
  selectionIcon: { marginRight: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dateText: { fontSize: 14, color: COLORS.textLight, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stallText: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  subText: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  dateRangeText: { fontSize: 11, color: COLORS.primary, marginTop: 2, fontWeight: '600' },
  priceText: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  paidAmountText: { fontSize: 12, color: COLORS.success, fontWeight: '600', marginTop: 2 },
  cardFooter: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  actionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 8 },
  actionText: { fontWeight: '600', fontSize: 14, marginLeft: 6 },
  contactBtn: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, paddingBottom: 30, borderTopWidth: 1, borderTopColor: '#ddd', ...SHADOWS.medium, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectionCountText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textDark },
  bottomActions: { flexDirection: 'row' },
  bottomBtnDelete: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginRight: 10 },
  bottomBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  emptyText: { textAlign: 'center', marginTop: 40, color: COLORS.textLight },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', width:'100%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  modalSubTitle: { fontSize: 14, color: COLORS.textLight, marginBottom: 20 },
  inputLabel: { alignSelf:'flex-start', fontWeight:'600', color:COLORS.textLight, marginBottom:5 },
  input: { backgroundColor: '#F2F2F7', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 16, color: COLORS.textDark, width:'100%' },
  ibanBox: { backgroundColor: '#F2F2F7', padding: 16, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 16 },
  ibanText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textDark, textAlign: 'center' },
  modalActions: { flexDirection: 'row', marginTop: 20, width:'100%' },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', backgroundColor:'#F2F2F7', borderRadius:8, marginRight:10 },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textDark, fontWeight: '600' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  copyButton: { flexDirection: 'row', backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, width: '100%', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  closeButton: { padding: 10 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 8, padding: 4, marginBottom: 20, width: '100%' },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  toggleBtnActiveRed: { backgroundColor: '#FFEBEE', borderWidth:1, borderColor: COLORS.danger },
  toggleText: { fontWeight: '600', color: COLORS.textLight },
  toggleTextActive: { color: COLORS.textDark }
});