import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, 
  TouchableOpacity, Alert, Modal, Clipboard, TextInput 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { 
  subscribeToRentalsByRole, toggleRentalPaymentStatus, deleteRental,
  deleteRentalsBatch, markRentalsPaidBatch,
  toggleRentalGroupPaymentStatus, deleteRentalGroup 
} from '../services/rentalService';
import { getUserProfile } from '../services/authService'; 
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';

// KART BİLEŞENİ
const RentalCard = ({ item, canManage, isSelectionMode, isSelected, onTogglePayment, onDelete, onShowIban, onSelect }) => {
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

  return (
    <TouchableOpacity 
        style={[
          styles.card, 
          item.isPaid ? styles.cardPaid : styles.cardUnpaid,
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
                  {/* BAŞLIK KISMI GÜNCELLENDİ: Özel Metin veya Normal Tarih */}
                  <Text style={styles.dateText}>
                      {item.isGroup ? item.customDateText : formattedDate}
                  </Text>
                  
                  <View style={[styles.statusBadge, { backgroundColor: item.isPaid ? COLORS.success : COLORS.danger }]}>
                      <Text style={styles.statusText}>{item.isPaid ? 'ÖDENDİ' : 'BEKLİYOR'}</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={{flex:1}}>
                      {/* TAHTA İSMİ GÜNCELLENDİ: Birleştirilmiş Liste */}
                      <Text style={styles.stallText} numberOfLines={2}>
                          {item.isGroup ? item.summaryText : item.stallNumber}
                      </Text>
                      
                      <Text style={styles.subText}>
                          {canManage 
                          ? `Kiracı: ${item.tenantName}` 
                          : `Tahta Sahibi: ${ownerName}`} 
                      </Text>
                      
                      {/* Tarih Aralığı (Örn: 21 Kas - 15 Ara) */}
                      {item.isGroup && (
                          <Text style={styles.dateRangeText}>
                              {item.dateRange}
                          </Text>
                      )}
                  </View>
                  <Text style={styles.priceText}>{item.price.toLocaleString('tr-TR')} ₺</Text>
                </View>
            </View>
        </View>

        {!isSelectionMode && (
            <View style={styles.cardFooter}>
            {canManage ? (
                <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: item.isPaid ? '#E5E5EA' : COLORS.primary }]}
                onPress={() => onTogglePayment(item)}
                >
                <Ionicons name={item.isPaid ? "arrow-undo" : "checkmark-circle"} size={18} color={item.isPaid ? COLORS.textDark : '#fff'} />
                <Text style={[styles.actionText, { color: item.isPaid ? COLORS.textDark : '#fff' }]}>
                    {item.isPaid ? 'Ödenmedi Olarak İşaretle' : 'Ödeme Alındı'}
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

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); 

  const [ibanModalVisible, setIbanModalVisible] = useState(false);
  const [currentOwnerIban, setCurrentOwnerIban] = useState('');
  const [currentOwnerName, setCurrentOwnerName] = useState('');

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

  // 2. Verileri Grupla ve METİNLERİ OLUŞTUR (GÜNCELLENDİ)
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
                    dates: []
                };
            }
            groups[item.groupId].items.push(item);
            groups[item.groupId].price += (parseFloat(item.price) || 0);
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
        
        // --- YENİ MANTIK BAŞLANGICI ---
        
        // 1. AY ve GÜN İSİMLERİ (Örn: Kasım Ayı Salı - Cmt)
        const monthName = firstDate.toLocaleDateString('tr-TR', { month: 'long' });
        
        // Gruptaki benzersiz günleri bul (0=Pazar, 1=Pzt...)
        const uniqueDayIndices = [...new Set(group.dates.map(d => d.getDay()))].sort();
        const dayNamesMap = ['Paz', 'Pzt', 'Sal', 'Çar', 'Prş', 'Cum', 'Cmt'];
        
        // İsimleri birleştir (Sal - Cmt)
        const dayNamesStr = uniqueDayIndices.map(d => dayNamesMap[d]).join(' & ');
        
        // Başlık Metni
        const customDateText = `${monthName} Ayı ${dayNamesStr}`;

        // 2. TAHTA LİSTESİ (Örn: 3B-140 / 3B-141)
        const uniqueStalls = [...new Set(group.items.map(i => i.stallNumber))].sort().join(' / ');

        // 3. Tarih Aralığı (Detay bilgi olarak kalsın)
        const dateRange = `${firstDate.toLocaleDateString('tr-TR', {day:'numeric', month:'short'})} - ${lastDate.toLocaleDateString('tr-TR', {day:'numeric', month:'short'})}`;
        
        // --- YENİ MANTIK BİTİŞİ ---

        return {
            ...group,
            date: firstDate,
            dateRange: dateRange,
            customDateText: customDateText, // Header Başlığı
            summaryText: uniqueStalls,      // Tahta İsimleri
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
        const stallNum = item.isGroup ? item.summaryText : item.stallNumber; // Artık birleşik ismi arıyor
        const tName = item.tenantName || '';
        return (stallNum.toLowerCase().includes(lowerText) || tName.toLowerCase().includes(lowerText));
      });
      setFilteredRentals(filtered);
    }
  }, [searchText, groupedRentals]);

  // --- İŞLEMLER ---

  const handlePaymentToggle = (item) => {
    if (!canManage) return;
    if (item.isGroup) toggleRentalGroupPaymentStatus(item.id, item.isPaid); 
    else toggleRentalPaymentStatus(item.id, item.isPaid);
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

  const handleShowIban = async (ownerId) => {
    try {
      const ownerData = await getUserProfile(ownerId);
      if (ownerData && ownerData.iban) {
        setCurrentOwnerName(ownerData.fullName);
        setCurrentOwnerIban(ownerData.iban);
        setIbanModalVisible(true);
      } else { Alert.alert("Bilgi", "Tahta sahibi henüz IBAN bilgisi girmemiş."); }
    } catch (error) { Alert.alert("Hata", "Bilgiler alınamadı."); }
  };

  const copyToClipboard = () => {
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

  const handleBatchDelete = () => {
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

  const handleBatchMarkPaid = () => {
    if (selectedIds.length === 0) return;
    const groupIds = [];
    const docIds = [];
    selectedIds.forEach(id => {
        if (id.toString().startsWith('GROUP_')) groupIds.push(id);
        else docIds.push(id);
    });

    Alert.alert("Toplu Güncelleme", `${selectedIds.length} öğe 'Ödendi' yapılacak.`, [
        { text: "İptal", style: "cancel" },
        { text: "Evet", onPress: async () => {
            try {
                if (docIds.length > 0) await markRentalsPaidBatch(docIds, true);
                for (const gId of groupIds) await toggleRentalGroupPaymentStatus(gId, false);
                setIsSelectionMode(false);
                setSelectedIds([]);
                Alert.alert("Başarılı", "Kayıtlar güncellendi.");
            } catch (error) { Alert.alert("Hata", "İşlem başarısız."); }
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
            onTogglePayment={handlePaymentToggle}
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
                  <TouchableOpacity style={styles.bottomBtnPay} onPress={handleBatchMarkPaid}>
                      <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                      <Text style={styles.bottomBtnText}>Ödendi Yap</Text>
                  </TouchableOpacity>
              </View>
          </View>
      )}

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
  dateText: { fontSize: 14, color: COLORS.textLight, fontWeight: '700' }, // FontWeight artırıldı
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stallText: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  subText: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  dateRangeText: { fontSize: 11, color: COLORS.primary, marginTop: 2, fontWeight: '600' },
  priceText: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  cardFooter: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  actionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 8 },
  actionText: { fontWeight: '600', fontSize: 14, marginLeft: 6 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, paddingBottom: 30, borderTopWidth: 1, borderTopColor: '#ddd', ...SHADOWS.medium, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectionCountText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textDark },
  bottomActions: { flexDirection: 'row' },
  bottomBtnDelete: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginRight: 10 },
  bottomBtnPay: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  bottomBtnText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  emptyText: { textAlign: 'center', marginTop: 40, color: COLORS.textLight },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  modalSubTitle: { fontSize: 14, color: COLORS.textLight, marginBottom: 20 },
  ibanBox: { backgroundColor: '#F2F2F7', padding: 16, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 16 },
  ibanText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textDark, textAlign: 'center' },
  copyButton: { flexDirection: 'row', backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, width: '100%', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  closeButton: { padding: 10 },
});