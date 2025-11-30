import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, 
  TouchableOpacity, Alert, Modal, Clipboard, TextInput, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { 
  subscribeToRentalsByRole, deleteRental, deleteRentalsBatch,
  deleteRentalGroup, addPayment 
} from '../services/rentalService';
import { getUserProfile } from '../services/authService'; 
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';

// KART BİLEŞENİ (AYNI)
const RentalCard = ({ item, canManage, isSelectionMode, isSelected, onPaymentPress, onDelete, onShowIban, onSelect }) => {
  const [ownerName, setOwnerName] = useState('Yükleniyor...');

  useEffect(() => {
    let isMounted = true;
    const targetOwnerId = item.isGroup ? item.firstRecord.ownerId : item.ownerId;

    if (!canManage && targetOwnerId) {
      getUserProfile(targetOwnerId).then(profile => {
        if (isMounted && profile) setOwnerName(profile.fullName);
      });
    }
    return () => { isMounted = false; };
  }, [item, canManage]);

  const formattedDate = item.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });

  const handlePress = () => {
    if (isSelectionMode) onSelect(item.id);
  };

  let statusText = 'BEKLİYOR';
  let statusColor = COLORS.danger;
  let remainingAmount = item.price - (item.paidAmount || 0);

  if (item.isPaid) {
    statusText = 'ÖDENDİ';
    statusColor = COLORS.success;
  } else if ((item.paidAmount || 0) > 0) {
    statusText = `KALAN: ${Math.round(remainingAmount).toLocaleString()} ₺`;
    statusColor = COLORS.warning;
  }

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
                          : `Tahta Sahibi: ${ownerName}`} 
                      </Text>
                      
                      {item.isGroup && <Text style={styles.dateRangeText}>{item.dateRange}</Text>}
                  </View>
                  
                  <View style={{alignItems:'flex-end'}}>
                    <Text style={styles.priceText}>{item.price.toLocaleString('tr-TR')} ₺</Text>
                    {(item.paidAmount || 0) > 0 && (
                        <Text style={styles.paidAmountText}>
                            (Ödenen: {Math.round(item.paidAmount).toLocaleString()} ₺)
                        </Text>
                    )}
                  </View>
                </View>
            </View>
        </View>

        {!isSelectionMode && (
            <View style={styles.cardFooter}>
            {canManage ? (
                <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: item.isPaid ? COLORS.success : COLORS.primary }]} // Ödendiyse yeşil kalabilir
                    onPress={() => onPaymentPress(item)}
                >
                    <Ionicons name={item.isPaid ? "create-outline" : "wallet-outline"} size={18} color="#fff" />
                    <Text style={[styles.actionText, { color: '#fff' }]}>
                        {item.isPaid ? 'Düzenle / İade' : 'Ödeme Al'}
                    </Text>
                </TouchableOpacity>
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

  // SEÇİM MODU
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); 

  // MODALLAR
  const [ibanModalVisible, setIbanModalVisible] = useState(false);
  const [currentOwnerIban, setCurrentOwnerIban] = useState('');
  const [currentOwnerName, setCurrentOwnerName] = useState('');

  // ÖDEME MODALI STATE
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedRentalForPayment, setSelectedRentalForPayment] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  
  // YENİ: İŞLEM TÜRÜ (Tahsilat / Düzeltme)
  const [paymentType, setPaymentType] = useState('COLLECT'); // 'COLLECT' or 'CORRECT'

  const canManage = userProfile?.role === 'OWNER' || userProfile?.role === 'ADMIN';

  // 1. Verileri Çek
  useEffect(() => {
    if (user && userProfile) {
      const unsubscribe = subscribeToRentalsByRole(user.uid, userProfile.role, (data) => {
        setRentals(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, userProfile]);

  // 2. Gruplama Mantığı
  useEffect(() => {
    if (rentals.length === 0) {
        setGroupedRentals([]);
        setFilteredRentals([]);
        return;
    }

    const groups = {};
    const singles = [];

    rentals.forEach(item => {
        if (item.groupId) {
            if (!groups[item.groupId]) {
                groups[item.groupId] = {
                    id: item.groupId, 
                    isGroup: true,
                    items: [],
                    firstRecord: item, 
                    isPaid: item.isPaid,
                    tenantName: item.tenantName,
                    price: 0,
                    paidAmount: 0,
                    dates: []
                };
            }
            groups[item.groupId].items.push(item);
            groups[item.groupId].price += (parseFloat(item.price) || 0);
            groups[item.groupId].paidAmount += (parseFloat(item.paidAmount) || 0);
            groups[item.groupId].dates.push(item.date);
            
            if (!item.isPaid) groups[item.groupId].isPaid = false; 
        } else {
            singles.push(item);
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

  }, [rentals]);

  // Arama
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
    
    // Varsayılan olarak kalan borcu göster
    const remaining = item.price - (item.paidAmount || 0);
    setPaymentAmountInput(remaining > 0 ? Math.round(remaining).toString() : '');
    
    setPaymentType('COLLECT'); // Varsayılan Tahsilat
    setSelectedRentalForPayment(item);
    setPaymentModalVisible(true);
  };

  const handleSavePayment = async () => {
    if (!selectedRentalForPayment || !paymentAmountInput) return;

    try {
        let amount = parseFloat(paymentAmountInput);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert("Hata", "Geçerli bir tutar giriniz.");
            return;
        }

        // Eğer 'Düzeltme' seçildiyse tutarı eksiye çevir
        if (paymentType === 'CORRECT') {
            amount = -amount;
        }

        // Limit Kontrolleri
        const currentPaid = selectedRentalForPayment.paidAmount || 0;
        const remaining = selectedRentalForPayment.price - currentPaid;

        if (paymentType === 'COLLECT' && amount > remaining + 1) {
             Alert.alert("Hata", `Kalan borçtan (${Math.round(remaining)} TL) fazla ödeme giremezsiniz.`);
             return;
        }
        
        if (paymentType === 'CORRECT' && Math.abs(amount) > currentPaid) {
             Alert.alert("Hata", `Daha önce ödenen tutardan (${Math.round(currentPaid)} TL) fazlasını silemezsiniz.`);
             return;
        }

        await addPayment(selectedRentalForPayment, amount);
        
        setPaymentModalVisible(false);
        setPaymentAmountInput('');
        setSelectedRentalForPayment(null);
        Alert.alert("Başarılı", paymentType === 'COLLECT' ? "Ödeme kaydedildi." : "Düzeltme yapıldı.");

    } catch (error) {
        Alert.alert("Hata", "İşlem kaydedilemedi.");
    }
  };

  const handleDelete = (item) => {
    if (!canManage) return; 
    const message = item.isGroup 
        ? `Bu toplu kiralamayı (${item.count} işlem) silmek istediğine emin misin?` 
        : 'Bu kaydı silmek istediğine emin misin?';

    Alert.alert('Sil', message, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => {
          if (item.isGroup) deleteRentalGroup(item.id);
          else deleteRental(item.id);
      }}
    ]);
  };

  const handleShowIban = async (ownerId) => { /* ... AYNI ... */
    try {
      const ownerData = await getUserProfile(ownerId);
      if (ownerData && ownerData.iban) {
        setCurrentOwnerName(ownerData.fullName);
        setCurrentOwnerIban(ownerData.iban);
        setIbanModalVisible(true);
      } else { Alert.alert("Bilgi", "Tahta sahibi henüz IBAN bilgisi girmemiş."); }
    } catch (error) { Alert.alert("Hata", "Bilgiler alınamadı."); }
  };

  const copyToClipboard = () => { /* ... AYNI ... */
    Clipboard.setString(currentOwnerIban);
    Alert.alert("Kopyalandı", "IBAN panoya kopyalandı.");
  };

  // --- TOPLU İŞLEMLER ---
  const toggleSelectionMode = () => {
    if (isSelectionMode) { setIsSelectionMode(false); setSelectedIds([]); } 
    else setIsSelectionMode(true);
  };

  const toggleSelectId = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(item => item !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handleBatchDelete = () => { /* ... AYNI ... */
    if (selectedIds.length === 0) return;
    const groupIds = [];
    const docIds = [];
    selectedIds.forEach(id => {
        if (id.toString().startsWith('GROUP_')) groupIds.push(id);
        else docIds.push(id);
    });
    Alert.alert("Toplu Silme", `${selectedIds.length} öğe silinecek.`, [
        { text: "İptal", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: async () => {
            try {
                if (docIds.length > 0) await deleteRentalsBatch(docIds);
                for (const gId of groupIds) await deleteRentalGroup(gId);
                setIsSelectionMode(false);
                setSelectedIds([]);
                Alert.alert("Başarılı", "Kayıtlar silindi.");
            } catch (error) { Alert.alert("Hata", "Silme işlemi başarısız."); }
        }}
    ]);
  };

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
        ListEmptyComponent={<Text style={styles.emptyText}>{rentals.length === 0 ? "Henüz işlem yok." : "Arama sonucu bulunamadı."}</Text>}
        renderItem={({ item }) => (
          <RentalCard 
            item={item}
            canManage={canManage}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.includes(item.id)}
            onSelect={toggleSelectId}
            onPaymentPress={handleOpenPaymentModal}
            onDelete={handleDelete}
            onShowIban={handleShowIban}
          />
        )}
      />

      {isSelectionMode && selectedIds.length > 0 && (
          <View style={styles.bottomBar}>
              <View style={styles.selectionCountContainer}>
                  <Text style={styles.selectionCountText}>{selectedIds.length} Seçildi</Text>
              </View>
              <View style={styles.bottomActions}>
                  <TouchableOpacity style={styles.bottomBtnDelete} onPress={handleBatchDelete}>
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                      <Text style={styles.bottomBtnText}>Sil</Text>
                  </TouchableOpacity>
              </View>
          </View>
      )}

      {/* GÜNCELLENEN ÖDEME MODALI */}
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

                {/* İŞLEM TÜRÜ SEÇİCİ */}
                <View style={styles.toggleContainer}>
                    <TouchableOpacity 
                        style={[styles.toggleBtn, paymentType === 'COLLECT' && styles.toggleBtnActive]} 
                        onPress={() => setPaymentType('COLLECT')}
                    >
                        <Text style={[styles.toggleText, paymentType === 'COLLECT' && styles.toggleTextActive]}>Tahsilat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.toggleBtn, paymentType === 'CORRECT' && styles.toggleBtnActiveRed]} 
                        onPress={() => setPaymentType('CORRECT')}
                    >
                        <Text style={[styles.toggleText, paymentType === 'CORRECT' && styles.toggleTextActive]}>Düzeltme / İade</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>
                    {paymentType === 'COLLECT' ? 'Tahsil Edilecek Tutar' : 'Silinecek / İade Edilecek Tutar'}
                </Text>
                
                <View style={{flexDirection:'row', alignItems:'center', width:'100%'}}>
                    <TextInput 
                        style={[
                            styles.input, 
                            {flex:1, textAlign:'center', fontSize:24, fontWeight:'bold'},
                            {color: paymentType === 'COLLECT' ? COLORS.success : COLORS.danger}
                        ]} 
                        value={paymentAmountInput}
                        onChangeText={setPaymentAmountInput}
                        keyboardType="numeric"
                        autoFocus={true}
                        placeholder="0"
                    />
                    <Text style={{fontSize:24, fontWeight:'bold', marginLeft:10, color:COLORS.textLight}}>₺</Text>
                </View>

                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setPaymentModalVisible(false)}>
                        <Text style={styles.cancelBtnText}>İptal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.saveBtn, paymentType === 'CORRECT' && {backgroundColor: COLORS.danger}]} 
                        onPress={handleSavePayment}
                    >
                        <Text style={styles.saveBtnText}>{paymentType === 'COLLECT' ? 'Kaydet' : 'Düzelt'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* IBAN MODAL (Aynı) */}
      <Modal visible={ibanModalVisible} animationType="fade" transparent={true}>
        {/* ... (Aynı) ... */}
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
  // ... (Mevcut stiller aynı) ...
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
  completedBox: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 10 },
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

  // YENİ TOGGLE BUTON STİLLERİ
  toggleContainer: { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 8, padding: 4, marginBottom: 20, width: '100%' },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  toggleBtnActiveRed: { backgroundColor: '#FFEBEE', borderWidth:1, borderColor: COLORS.danger },
  toggleText: { fontWeight: '600', color: COLORS.textLight },
  toggleTextActive: { color: COLORS.textDark }
});