import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Modal, 
  TextInput, StyleSheet, Alert, SafeAreaView, StatusBar 
} from 'react-native';
import { subscribeToMarketplaces, addMarketplace, deleteMarketplace, updateMarketplace } from '../services/marketplaceService';
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';
import { AuthContext } from '../context/AuthContext'; // Context eklendi

const DAYS = [
  { id: 'MONDAY', label: 'Pzt' },
  { id: 'TUESDAY', label: 'Sal' },
  { id: 'WEDNESDAY', label: 'Çrş' },
  { id: 'THURSDAY', label: 'Prş' },
  { id: 'FRIDAY', label: 'Cum' },
  { id: 'SATURDAY', label: 'Cmt' },
  { id: 'SUNDAY', label: 'Paz' },
];

export default function MarketplacesScreen({ navigation }) {
  const { userProfile } = useContext(AuthContext); // Kullanıcı rolünü al
  const isAdmin = userProfile?.role === 'ADMIN'; // Sadece Admin yetkili

  const [marketplaces, setMarketplaces] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToMarketplaces(setMarketplaces);
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!name || !address || selectedDays.length === 0) {
      Alert.alert('Eksik Bilgi', 'Lütfen tüm alanları doldurun ve gün seçin.');
      return;
    }
    const payload = { name, address, openDays: selectedDays };
    try {
      if (isEditing) await updateMarketplace(editId, payload);
      else await addMarketplace(payload);
      closeModal();
    } catch (error) {
      Alert.alert('Hata', 'İşlem başarısız.');
    }
  };

  const handleDelete = (item) => {
    // Sadece Admin silebilir
    if (!isAdmin) return;

    Alert.alert('Sil', `"${item.name}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteMarketplace(item.id) }
    ]);
  };

  const openEdit = (item) => {
    // Sadece Admin düzenleyebilir
    if (!isAdmin) return;

    setName(item.name);
    setAddress(item.address);
    setSelectedDays(item.openDays || []);
    setEditId(item.id);
    setIsEditing(true);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setName('');
    setAddress('');
    setSelectedDays([]);
    setIsEditing(false);
    setEditId(null);
  };

  const toggleDay = (dayId) => {
    if (selectedDays.includes(dayId)) setSelectedDays(selectedDays.filter(d => d !== dayId));
    else setSelectedDays([...selectedDays, dayId]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      // Admin: Uzun basınca siler, tıklayınca düzenler.
      // Diğerleri (Owner/Tenant): Tıklayınca o pazarın tahtalarına gider.
      onLongPress={isAdmin ? () => handleDelete(item) : null} 
      onPress={() => {
        if (isAdmin) {
          openEdit(item);
        } else {
          // Pazarın ID'sini parametre olarak gönderiyoruz
          navigation.navigate('Stalls', { marketId: item.id });
        }
      }}
      activeOpacity={0.7}
    >
      {/* ... (Kart içeriği aynı) ... */}
      <View>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardAddress}>{item.address}</Text>
      </View>
      <View style={styles.daysContainer}>
        {DAYS.map(day => (
          <View key={day.id} style={[styles.dayBadge, item.openDays?.includes(day.id) ? styles.dayBadgeActive : styles.dayBadgeInactive]}>
            <Text style={[styles.dayText, item.openDays?.includes(day.id) ? styles.dayTextActive : styles.dayTextInactive]}>{day.label}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pazaryerleri</Text>
        
        {/* KURAL 1: Sadece Admin EKLE butonunu görür */}
        {isAdmin && (
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.addButtonText}>+ Ekle</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={marketplaces}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Henüz pazaryeri eklenmemiş.</Text>}
      />

      {/* Modal sadece Admin erişiminde anlamlıdır, state zaten butonla kontrol ediliyor */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{isEditing ? 'Düzenle' : 'Yeni Pazaryeri'}</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="Pazar Adı (Örn: Ulus Pazarı)" 
              placeholderTextColor={COLORS.textLight}
              value={name} 
              onChangeText={setName} 
            />
            
            <TextInput 
              style={styles.input} 
              placeholder="Adres (Örn: İsmetpaşa Mah.)" 
              placeholderTextColor={COLORS.textLight}
              value={address} 
              onChangeText={setAddress} 
            />

            <Text style={styles.label}>Açık Günler:</Text>
            <View style={styles.daySelectContainer}>
              {DAYS.map(day => (
                <TouchableOpacity 
                  key={day.id} 
                  style={[styles.daySelectBtn, selectedDays.includes(day.id) && styles.daySelectBtnActive]}
                  onPress={() => toggleDay(day.id)}
                >
                  <Text style={[styles.daySelectText, selectedDays.includes(day.id) && styles.daySelectTextActive]}>{day.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{isEditing ? 'Güncelle' : 'Kaydet'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: LAYOUT.padding, backgroundColor: COLORS.cardBg, ...SHADOWS.light },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textDark },
  addButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  listContent: { padding: LAYOUT.padding },
  card: { backgroundColor: COLORS.cardBg, borderRadius: LAYOUT.borderRadius, padding: LAYOUT.padding, marginBottom: 12, ...SHADOWS.light },
  cardTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textDark },
  cardAddress: { fontSize: 14, color: COLORS.textLight, marginBottom: 12 },
  daysContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  dayBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginHorizontal: 2 },
  dayBadgeActive: { backgroundColor: COLORS.primary },
  dayBadgeInactive: { backgroundColor: '#F2F2F7' },
  dayText: { fontSize: 10, fontWeight: '600' },
  dayTextActive: { color: '#fff' },
  dayTextInactive: { color: '#C6C6C8' },
  emptyText: { textAlign: 'center', marginTop: 40, color: COLORS.textLight },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: '#F2F2F7', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 16, color: COLORS.textDark },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: COLORS.textLight },
  daySelectContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  daySelectBtn: { width: '13%', aspectRatio: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7', marginBottom: 8 },
  daySelectBtnActive: { backgroundColor: COLORS.secondary },
  daySelectText: { fontSize: 12, color: COLORS.textDark },
  daySelectTextActive: { color: '#fff', fontWeight: '700' },
  modalActions: { flexDirection: 'row' },
  cancelBtn: { padding: 14, flex: 1, marginRight: 8, alignItems: 'center' },
  saveBtn: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, flex: 1, marginLeft: 8, alignItems: 'center' },
  cancelBtnText: { color: COLORS.danger, fontWeight: '600' },
  saveBtnText: { color: '#fff', fontWeight: '600' }
});