import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Modal, 
  TextInput, StyleSheet, Alert, SafeAreaView, StatusBar,
  KeyboardAvoidingView, Platform, ScrollView // YENİ EKLENDİ
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToTenants, addTenant, updateTenant, deleteTenant } from '../services/tenantService';
import { subscribeToRentalsByRole } from '../services/rentalService';
import { AuthContext } from '../context/AuthContext';
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';

export default function TenantsScreen() {
  const { user, userProfile } = useContext(AuthContext);
  const isOwner = userProfile?.role === 'OWNER';
  const isAdmin = userProfile?.role === 'ADMIN';

  const [manualTenants, setManualTenants] = useState([]);
  const [historyTenants, setHistoryTenants] = useState([]);
  const [mergedTenants, setMergedTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  
  const [searchText, setSearchText] = useState('');
  
  // Modal & Form
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  const canViewHistory = isOwner || isAdmin;

  // 1. Elle Eklenen Kiracıları Çek
  useEffect(() => {
    const unsubscribe = subscribeToTenants((data) => {
      setManualTenants(data);
    });
    return () => unsubscribe();
  }, []);

  // 2. Owner ise: Kiralama Geçmişini Çek
  useEffect(() => {
    if (canViewHistory && user) {
      // Rolü servise gönder (ADMIN ise tümünü, OWNER ise kendisininkini çeker)
      const unsubscribe = subscribeToRentalsByRole(user.uid, userProfile.role, (rentalsData) => {
        const uniqueTenantsMap = {};
        
        rentalsData.forEach(rental => {
          if (!uniqueTenantsMap[rental.tenantId]) {
            uniqueTenantsMap[rental.tenantId] = {
              id: rental.tenantId,
              fullName: rental.tenantName,
              isSystemUser: true,
              phone: '', 
              note: 'Uygulama üzerinden kiralama yaptı.'
            };
          }
        });
        
        setHistoryTenants(Object.values(uniqueTenantsMap));
      });
      return () => unsubscribe();
    }
  }, [canViewHistory, user, userProfile.role]);

  // 3. Listeleri Birleştir
  useEffect(() => {
    // Admin veya Owner ise birleştir
    if (canViewHistory) {
      const manualIds = new Set(manualTenants.map(t => t.id));
      const newHistoryTenants = historyTenants.filter(t => !manualIds.has(t.id));
      
      const combined = [...manualTenants, ...newHistoryTenants].sort((a, b) => 
        a.fullName.localeCompare(b.fullName)
      );
      
      setMergedTenants(combined);
      setFilteredTenants(combined);
    } else {
      // Sadece manuel (Aslında bu ekran tenant'a kapalı ama güvenlik olsun)
      setMergedTenants(manualTenants);
      setFilteredTenants(manualTenants);
    }
  }, [manualTenants, historyTenants, canViewHistory]);

  // Arama Fonksiyonu
  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredTenants(mergedTenants);
    } else {
      const lowerText = searchText.toLowerCase();
      const filtered = mergedTenants.filter(t => 
        t.fullName.toLowerCase().includes(lowerText) || 
        (t.phone && t.phone.includes(lowerText)) ||
        (t.note && t.note.toLowerCase().includes(lowerText))
      );
      setFilteredTenants(filtered);
    }
  }, [searchText, mergedTenants]);

  // --- CRUD İŞLEMLERİ ---

  const handleSave = async () => {
    if (!fullName) return Alert.alert('Eksik Bilgi', 'İsim soyisim girilmelidir.');

    const payload = { fullName, phone, note };

    try {
      if (isEditing) {
        await updateTenant(editId, payload);
      } else {
        await addTenant(payload);
      }
      closeModal();
    } catch (error) {
      Alert.alert('Hata', 'İşlem başarısız.');
    }
  };

  const handleDelete = (item) => {
    if (item.isSystemUser) {
      Alert.alert("Bilgi", "Bu kişi sistem kullanıcısıdır, listeden manuel silinemez.");
      return;
    }

    Alert.alert('Sil', `${item.fullName} silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteTenant(item.id) }
    ]);
  };

  const openEdit = (item) => {
    if (item.isSystemUser) {
      Alert.alert("Bilgi", "Sistem kullanıcılarının bilgileri buradan düzenlenemez.");
      return;
    }

    setFullName(item.fullName);
    setPhone(item.phone || '');
    setNote(item.note || '');
    setEditId(item.id);
    setIsEditing(true);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setFullName('');
    setPhone('');
    setNote('');
    setIsEditing(false);
  };

  // Liste Elemanı
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => openEdit(item)}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatarContainer, item.isSystemUser && { backgroundColor: COLORS.secondary }]}>
        <Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
      </View>
      
      <View style={styles.infoContainer}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
            <Text style={styles.nameText}>{item.fullName}</Text>
            {item.isSystemUser && (
                <Ionicons name="checkmark-circle" size={14} color={COLORS.secondary} style={{marginLeft: 4}} />
            )}
        </View>
        
        {item.phone ? (
          <View style={styles.rowInfo}>
            <Ionicons name="call-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.phoneText}> {item.phone}</Text>
          </View>
        ) : null}
        
        {item.note ? (
          <Text style={styles.noteText} numberOfLines={2}>{item.note}</Text>
        ) : null}
      </View>

      <View style={styles.actionIcon}>
         {!item.isSystemUser && <Ionicons name="create-outline" size={20} color={COLORS.textLight} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Başlık */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Müşteriler</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => {
              setEditId(null); setIsEditing(false); setFullName(''); setPhone(''); setNote('');
              setModalVisible(true);
          }}>
            <Text style={styles.addButtonText}>+ Ekle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textLight} style={{marginRight: 8}} />
          <TextInput 
            style={styles.searchInput}
            placeholder="İsim, numara veya not ara..." 
            placeholderTextColor={COLORS.textLight}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      <FlatList
        data={filteredTenants}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Henüz müşteri kaydı yok.</Text>}
      />

      {/* GÜNCELLENMİŞ MODAL (Klavye Düzeltmesi) */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{isEditing ? 'Düzenle' : 'Yeni Müşteri Ekle'}</Text>
                
                <TextInput 
                  style={styles.input} 
                  placeholder="İsim Soyisim" 
                  placeholderTextColor={COLORS.textLight}
                  value={fullName} 
                  onChangeText={setFullName} 
                />
                
                <TextInput 
                  style={styles.input} 
                  placeholder="Numara (Örn: 0555...)" 
                  placeholderTextColor={COLORS.textLight}
                  value={phone} 
                  onChangeText={setPhone} 
                  keyboardType="phone-pad"
                />

                <TextInput 
                  style={[styles.input, styles.textArea]} 
                  placeholder="Not (Opsiyonel)" 
                  placeholderTextColor={COLORS.textLight}
                  value={note} 
                  onChangeText={setNote} 
                  multiline={true}
                  numberOfLines={3}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelBtnText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                    <Text style={styles.saveBtnText}>Kaydet</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  
  headerContainer: { backgroundColor: COLORS.cardBg, padding: LAYOUT.padding, paddingBottom: 12, ...SHADOWS.light, zIndex: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textDark },
  addButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 10, paddingHorizontal: 10, height: 40 },
  searchInput: { flex: 1, height: '100%', color: COLORS.textDark },

  listContent: { padding: LAYOUT.padding },
  
  card: { backgroundColor: COLORS.cardBg, borderRadius: LAYOUT.borderRadius, padding: 12, marginBottom: 10, ...SHADOWS.light, flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#A5D6A7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  
  infoContainer: { flex: 1 },
  nameText: { fontSize: 16, fontWeight: '600', color: COLORS.textDark },
  rowInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  phoneText: { fontSize: 13, color: COLORS.textLight },
  noteText: { fontSize: 12, color: '#8E8E93', marginTop: 4, fontStyle: 'italic' },
  
  actionIcon: { justifyContent: 'center', paddingLeft: 8 },

  emptyText: { textAlign: 'center', marginTop: 40, color: COLORS.textLight },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: '#F2F2F7', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 16, color: COLORS.textDark },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row' },
  cancelBtn: { padding: 14, flex: 1, alignItems: 'center' },
  saveBtn: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, flex: 1, alignItems: 'center' },
  cancelBtnText: { color: COLORS.danger, fontWeight: '600' },
  saveBtnText: { color: '#fff', fontWeight: '600' }
});