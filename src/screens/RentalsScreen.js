import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, 
  TouchableOpacity, Alert, Modal, Clipboard, TextInput 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { 
  subscribeToRentalsByRole, toggleRentalPaymentStatus, deleteRental,
  deleteRentalsBatch, markRentalsPaidBatch // YENİ İMPORTLAR
} from '../services/rentalService';
import { getUserProfile } from '../services/authService'; 
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';

// KART BİLEŞENİ (GÜNCELLENDİ)
const RentalCard = ({ item, canManage, isSelectionMode, isSelected, onTogglePayment, onDelete, onShowIban, onSelect }) => {
  const [ownerName, setOwnerName] = useState('Yükleniyor...');

  useEffect(() => {
    let isMounted = true;
    if (!canManage && item.ownerId) {
      getUserProfile(item.ownerId).then(profile => {
        if (isMounted && profile) {
          setOwnerName(profile.fullName);
        }
      });
    }
    return () => { isMounted = false; };
  }, [item.ownerId, canManage]);

  const formattedDate = item.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });

  // Seçim Modundayken Tıklama Davranışı: Seç/Bırak
  // Normal Modda Tıklama Davranışı: Yok (veya detay)
  const handlePress = () => {
    if (isSelectionMode) {
      onSelect(item.id);
    }
  };

  return (
    <TouchableOpacity 
        style={[
          styles.card, 
          item.isPaid ? styles.cardPaid : styles.cardUnpaid,
          isSelectionMode && isSelected && styles.cardSelected // Seçili ise mavi çerçeve
        ]}
        activeOpacity={0.8}
        onPress={handlePress}
        onLongPress={!isSelectionMode ? () => onDelete(item) : null} // Seçim modunda uzun basmayı kapat
      >
        <View style={styles.cardContentWrapper}>
            {/* SEÇİM İKONU (Sadece mod aktifse görünür) */}
            {isSelectionMode && (
                <View style={styles.selectionIcon}>
                    <Ionicons 
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                        size={24} 
                        color={isSelected ? COLORS.primary : COLORS.textLight} 
                    />
                </View>
            )}

            <View style={{flex: 1}}>
                <View style={styles.cardHeader}>
                <Text style={styles.dateText}>{formattedDate}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.isPaid ? COLORS.success : COLORS.danger }]}>
                    <Text style={styles.statusText}>{item.isPaid ? 'ÖDENDİ' : 'BEKLİYOR'}</Text>
                </View>
                </View>

                <View style={styles.cardBody}>
                <View>
                    <Text style={styles.stallText}>{item.stallNumber}</Text>
                    <Text style={styles.subText}>
                        {canManage 
                        ? `Kiracı: ${item.tenantName}` 
                        : `Tahta Sahibi: ${ownerName}`} 
                    </Text>
                </View>
                <Text style={styles.priceText}>{item.price} ₺</Text>
                </View>
            </View>
        </View>

        {/* AKSİYON BUTONLARI (Seçim modunda GİZLENİR) */}
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
                    onPress={() => onShowIban(item.ownerId)}
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
  const [filteredRentals, setFilteredRentals] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);

  // ÇOKLU SEÇİM STATE'LERİ
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [ibanModalVisible, setIbanModalVisible] = useState(false);
  const [currentOwnerIban, setCurrentOwnerIban] = useState('');
  const [currentOwnerName, setCurrentOwnerName] = useState('');

  const canManage = userProfile?.role === 'OWNER' || userProfile?.role === 'ADMIN';

  useEffect(() => {
    if (user && userProfile) {
      const unsubscribe = subscribeToRentalsByRole(user.uid, userProfile.role, (data) => {
        setRentals(data);
        setFilteredRentals(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, userProfile]);

  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredRentals(rentals);
    } else {
      const lowerText = searchText.toLowerCase();
      const filtered = rentals.filter(item => {
        const matchStall = item.stallNumber && item.stallNumber.toLowerCase().includes(lowerText);
        const matchTenant = item.tenantName && item.tenantName.toLowerCase().includes(lowerText);
        return matchStall || matchTenant;
      });
      setFilteredRentals(filtered);
    }
  }, [searchText, rentals]);

  // --- İŞLEMLER ---

  const handlePaymentToggle = (item) => {
    if (!canManage) return;
    toggleRentalPaymentStatus(item.id, item.isPaid);
  };

  const handleDelete = (item) => {
    if (!canManage) return; 
    Alert.alert('Sil', 'Bu kaydı silmek istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteRental(item.id) }
    ]);
  };

  const handleShowIban = async (ownerId) => {
    try {
      const ownerData = await getUserProfile(ownerId);
      if (ownerData && ownerData.iban) {
        setCurrentOwnerName(ownerData.fullName);
        setCurrentOwnerIban(ownerData.iban);
        setIbanModalVisible(true);
      } else {
        Alert.alert("Bilgi", "Tahta sahibi henüz IBAN bilgisi girmemiş.");
      }
    } catch (error) { Alert.alert("Hata", "Bilgiler alınamadı."); }
  };

  const copyToClipboard = () => {
    Clipboard.setString(currentOwnerIban);
    Alert.alert("Kopyalandı", "IBAN panoya kopyalandı.");
  };

  // --- TOPLU İŞLEMLER ---

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
        setIsSelectionMode(false);
        setSelectedIds([]);
    } else {
        setIsSelectionMode(true);
    }
  };

  const toggleSelectId = (id) => {
    if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
        setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
        "Toplu Silme", 
        `${selectedIds.length} adet kaydı silmek istediğinize emin misiniz?`,
        [
            { text: "İptal", style: "cancel" },
            { text: "Evet, Sil", style: "destructive", onPress: async () => {
                try {
                    await deleteRentalsBatch(selectedIds);
                    setIsSelectionMode(false);
                    setSelectedIds([]);
                    Alert.alert("Başarılı", "Kayıtlar silindi.");
                } catch (error) { Alert.alert("Hata", "Silme işlemi başarısız."); }
            }}
        ]
    );
  };

  const handleBatchMarkPaid = () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
        "Toplu Güncelleme", 
        `${selectedIds.length} adet kaydı 'Ödendi' olarak işaretlemek istiyor musunuz?`,
        [
            { text: "İptal", style: "cancel" },
            { text: "Evet", onPress: async () => {
                try {
                    await markRentalsPaidBatch(selectedIds, true);
                    setIsSelectionMode(false);
                    setSelectedIds([]);
                    Alert.alert("Başarılı", "Kayıtlar güncellendi.");
                } catch (error) { Alert.alert("Hata", "İşlem başarısız."); }
            }}
        ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Hareketler</Text>
            {/* SEÇ BUTONU (Sadece Yöneticiye) */}
            {canManage && (
                <TouchableOpacity 
                    style={[styles.selectButton, isSelectionMode && {backgroundColor: COLORS.textDark}]}
                    onPress={toggleSelectionMode}
                >
                    <Text style={[styles.selectButtonText, isSelectionMode && {color: '#fff'}]}>
                        {isSelectionMode ? 'Vazgeç' : 'Seç'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textLight} style={{marginRight: 8}} />
          <TextInput 
            style={styles.searchInput}
            placeholder={canManage ? "Tahta veya Kiracı ara..." : "Tahta ara..."}
            placeholderTextColor={COLORS.textLight}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
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

      {/* BOTTOM ACTION BAR (Toplu İşlem Çubuğu) */}
      {isSelectionMode && selectedIds.length > 0 && (
          <View style={styles.bottomBar}>
              <View style={styles.selectionCountContainer}>
                  <Text style={styles.selectionCountText}>{selectedIds.length} Seçildi</Text>
              </View>
              
              <View style={styles.bottomActions}>
                  {/* SİLME BUTONU */}
                  <TouchableOpacity style={styles.bottomBtnDelete} onPress={handleBatchDelete}>
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                      <Text style={styles.bottomBtnText}>Sil</Text>
                  </TouchableOpacity>

                  {/* ÖDENDİ YAP BUTONU */}
                  <TouchableOpacity style={styles.bottomBtnPay} onPress={handleBatchMarkPaid}>
                      <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
                      <Text style={styles.bottomBtnText}>Ödendi Yap</Text>
                  </TouchableOpacity>
              </View>
          </View>
      )}

      {/* IBAN MODAL */}
      <Modal visible={ibanModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Ödeme Bilgileri</Text>
                <Text style={styles.modalSubTitle}>{currentOwnerName}</Text>
                <View style={styles.ibanBox}><Text style={styles.ibanText}>{currentOwnerIban}</Text></View>
                <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                    <Ionicons name="copy-outline" size={20} color="#fff" />
                    <Text style={{color:'#fff', fontWeight:'bold', marginLeft: 8}}>Kopyala</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={() => setIbanModalVisible(false)}>
                    <Text style={{color: COLORS.textLight}}>Kapat</Text>
                </TouchableOpacity>
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
  cardSelected: { backgroundColor: '#E3F2FD', borderColor: COLORS.primary, borderWidth: 1 }, // Seçiliyken stil

  cardContentWrapper: { flexDirection: 'row', alignItems: 'center' },
  selectionIcon: { marginRight: 12 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dateText: { fontSize: 14, color: COLORS.textLight, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stallText: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  subText: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  priceText: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  
  cardFooter: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  actionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 8 },
  actionText: { fontWeight: '600', fontSize: 14, marginLeft: 6 },

  // BOTTOM BAR STİLLERİ
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16, paddingBottom: 30,
    borderTopWidth: 1, borderTopColor: '#ddd', ...SHADOWS.medium,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  selectionCountText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textDark },
  bottomActions: { flexDirection: 'row' },
  bottomBtnDelete: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger, 
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginRight: 10 
  },
  bottomBtnPay: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success, 
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 
  },
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