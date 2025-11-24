import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, FlatList, StyleSheet, SafeAreaView, StatusBar, 
  TouchableOpacity, Alert, Modal, Clipboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { subscribeToRentalsByRole, toggleRentalPaymentStatus, deleteRental } from '../services/rentalService';
import { getUserProfile } from '../services/authService'; // IBAN sorgusu için
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';

export default function RentalsScreen() {
  const { user, userProfile } = useContext(AuthContext);
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);

  // IBAN Modal State (Kiracı için)
  const [ibanModalVisible, setIbanModalVisible] = useState(false);
  const [currentOwnerIban, setCurrentOwnerIban] = useState('');
  const [currentOwnerName, setCurrentOwnerName] = useState('');

  const isOwner = userProfile?.role === 'OWNER';

  useEffect(() => {
    if (user && userProfile) {
      const unsubscribe = subscribeToRentalsByRole(user.uid, userProfile.role, (data) => {
        setRentals(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user, userProfile]);

  // --- İŞLEMLER ---

  const handlePaymentToggle = (item) => {
    // Sadece Owner ödeme durumunu değiştirebilir
    if (!isOwner) return;
    toggleRentalPaymentStatus(item.id, item.isPaid);
  };

  const handleDelete = (item) => {
    // Sadece Owner silebilir (veya Tenant sadece ödenmemişleri silebilir mantığı kurulabilir)
    if (!isOwner) return; 
    
    Alert.alert('Sil', 'Bu kaydı silmek istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteRental(item.id) }
    ]);
  };

  const handleShowIban = async (ownerId) => {
    try {
      // Sahibin profilini çek
      const ownerData = await getUserProfile(ownerId);
      if (ownerData && ownerData.iban) {
        setCurrentOwnerName(ownerData.fullName);
        setCurrentOwnerIban(ownerData.iban);
        setIbanModalVisible(true);
      } else {
        Alert.alert("Bilgi", "Tahta sahibi henüz IBAN bilgisi girmemiş.");
      }
    } catch (error) {
      Alert.alert("Hata", "Bilgiler alınamadı.");
    }
  };

  const copyToClipboard = () => {
    Clipboard.setString(currentOwnerIban);
    Alert.alert("Kopyalandı", "IBAN panoya kopyalandı.");
  };

  // --- RENDER ---

  const renderItem = ({ item }) => {
    const formattedDate = item.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });
    
    return (
      <TouchableOpacity 
        style={[styles.card, item.isPaid ? styles.cardPaid : styles.cardUnpaid]}
        activeOpacity={isOwner ? 0.8 : 1}
        onLongPress={() => handleDelete(item)}
      >
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
                {isOwner ? `Kiracı: ${item.tenantName}` : `Tahta Sahibi ID: ...${item.ownerId?.slice(-4)}`}
            </Text>
          </View>
          <Text style={styles.priceText}>{item.price} ₺</Text>
        </View>

        {/* AKSİYON BUTONLARI */}
        <View style={styles.cardFooter}>
          {isOwner ? (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: item.isPaid ? '#E5E5EA' : COLORS.primary }]}
              onPress={() => handlePaymentToggle(item)}
            >
              <Ionicons name={item.isPaid ? "undo" : "checkmark-circle"} size={18} color={item.isPaid ? COLORS.textDark : '#fff'} />
              <Text style={[styles.actionText, { color: item.isPaid ? COLORS.textDark : '#fff' }]}>
                {item.isPaid ? 'Ödenmedi Olarak İşaretle' : 'Ödeme Alındı'}
              </Text>
            </TouchableOpacity>
          ) : (
            // KİRACI İÇİN IBAN GÖSTER BUTONU (Eğer ödenmemişse)
            !item.isPaid && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: COLORS.secondary }]}
                onPress={() => handleShowIban(item.ownerId)}
              >
                <Ionicons name="card" size={18} color="#fff" />
                <Text style={[styles.actionText, { color: '#fff' }]}>Ödeme Yap (IBAN Göster)</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hareketler</Text>
        <Text style={styles.headerSubtitle}>
            {isOwner ? 'Tahsilat ve kiralama geçmişi' : 'Ödemelerim ve kiralamalarım'}
        </Text>
      </View>

      <FlatList
        data={rentals}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Henüz işlem yok.</Text>}
      />

      {/* IBAN MODALI (KİRACI İÇİN) */}
      <Modal visible={ibanModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Ödeme Bilgileri</Text>
                <Text style={styles.modalSubTitle}>{currentOwnerName}</Text>
                
                <View style={styles.ibanBox}>
                    <Text style={styles.ibanText}>{currentOwnerIban}</Text>
                </View>

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
  header: { padding: LAYOUT.padding, paddingBottom: 10, backgroundColor: COLORS.cardBg, ...SHADOWS.light },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textDark },
  headerSubtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
  
  listContent: { padding: LAYOUT.padding },
  
  card: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOWS.light, borderLeftWidth: 5 },
  cardPaid: { borderLeftColor: COLORS.success },
  cardUnpaid: { borderLeftColor: COLORS.danger },
  
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

  emptyText: { textAlign: 'center', marginTop: 40, color: COLORS.textLight },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  modalSubTitle: { fontSize: 14, color: COLORS.textLight, marginBottom: 20 },
  ibanBox: { backgroundColor: '#F2F2F7', padding: 16, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 16 },
  ibanText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textDark, textAlign: 'center' },
  copyButton: { flexDirection: 'row', backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, width: '100%', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  closeButton: { padding: 10 },
});