import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Modal, 
  TextInput, StyleSheet, Alert, SafeAreaView, StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToTenants, addTenant, updateTenant, deleteTenant } from '../services/tenantService';
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';

export default function TenantsScreen() {
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [searchText, setSearchText] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToTenants((data) => {
      setTenants(data);
      setFilteredTenants(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredTenants(tenants);
    } else {
      const lowerText = searchText.toLowerCase();
      const filtered = tenants.filter(t => 
        t.fullName.toLowerCase().includes(lowerText) || 
        (t.phone && t.phone.includes(lowerText)) ||
        (t.note && t.note.toLowerCase().includes(lowerText))
      );
      setFilteredTenants(filtered);
    }
  }, [searchText, tenants]);

  const handleSave = async () => {
    if (!fullName) {
      Alert.alert('Eksik Bilgi', 'İsim soyisim girilmelidir.');
      return;
    }
    const payload = { fullName, phone, note };
    try {
      if (isEditing) await updateTenant(editId, payload);
      else await addTenant(payload);
      closeModal();
    } catch (error) {
      Alert.alert('Hata', 'İşlem başarısız.');
    }
  };

  const handleDelete = (item) => {
    Alert.alert('Sil', `${item.fullName} silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteTenant(item.id) }
    ]);
  };

  const openEdit = (item) => {
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

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.nameText}>{item.fullName}</Text>
        {item.phone ? (
          <View style={styles.rowInfo}>
            <Ionicons name="call-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.phoneText}> {item.phone}</Text>
          </View>
        ) : null}
        {item.note ? <Text style={styles.noteText} numberOfLines={2}>{item.note}</Text> : null}
      </View>
      <View style={styles.balanceContainer}>
        <Text style={[styles.balanceText, item.balance < 0 ? styles.debt : (item.balance > 0 ? styles.credit : styles.neutral)]}>
          {item.balance ? `${item.balance} ₺` : '0 ₺'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Kiracılar</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.addButtonText}>+ Ekle</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textLight} style={{marginRight: 8}} />
          <TextInput 
            placeholder="İsim, numara veya not ara..." 
            placeholderTextColor={COLORS.textLight}
            style={styles.searchInput}
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
        ListEmptyComponent={<Text style={styles.emptyText}>Kayıtlı kiracı yok.</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{isEditing ? 'Düzenle' : 'Yeni Kiracı'}</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="İsim Soyisim (Örn: Ahmet Yılmaz)" 
              placeholderTextColor={COLORS.textLight}
              value={fullName} 
              onChangeText={setFullName} 
            />
            
            <TextInput 
              style={styles.input} 
              placeholder="Numara (Örn: 0555 123 45 67)" 
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
          </View>
        </View>
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
  avatarContainer: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  infoContainer: { flex: 1 },
  nameText: { fontSize: 16, fontWeight: '600', color: COLORS.textDark },
  rowInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  phoneText: { fontSize: 13, color: COLORS.textLight },
  noteText: { fontSize: 12, color: '#8E8E93', marginTop: 4, fontStyle: 'italic' },
  balanceContainer: { justifyContent: 'center', paddingLeft: 8 },
  balanceText: { fontSize: 14, fontWeight: '700' },
  debt: { color: COLORS.danger },
  credit: { color: COLORS.success },
  neutral: { color: COLORS.textLight },
  emptyText: { textAlign: 'center', marginTop: 40, color: COLORS.textLight },
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