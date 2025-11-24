import React, { useContext, useState } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Modal, TextInput 
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { logoutUser, updateUserProfile } from '../services/authService';
import { COLORS, SHADOWS } from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, userProfile, setUserProfile } = useContext(AuthContext);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [ibanInput, setIbanInput] = useState('');

  const handleLogout = () => {
    Alert.alert('Çıkış', 'Uygulamadan çıkmak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logoutUser() }
    ]);
  };

  const openIbanModal = () => {
    setIbanInput(userProfile?.iban || ''); // Varsa mevcudu getir
    setModalVisible(true);
  };

  const handleSaveIban = async () => {
    try {
      // 1. Veritabanını Güncelle
      await updateUserProfile(user.uid, { iban: ibanInput });
      
      // 2. Uygulama State'ini Güncelle (Anlık Yansıması için)
      setUserProfile({ ...userProfile, iban: ibanInput });
      
      setModalVisible(false);
      Alert.alert("Başarılı", "IBAN bilgisi güncellendi.");
    } catch (error) {
      Alert.alert("Hata", "Güncelleme yapılamadı.");
    }
  };

  const getRoleLabel = (role) => {
    switch(role) {
      case 'OWNER': return 'Tahta Sahibi';
      case 'TENANT': return 'Kiracı';
      case 'ADMIN': return 'Yönetici';
      default: return 'Kullanıcı';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {userProfile?.fullName?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{userProfile?.fullName}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{getRoleLabel(userProfile?.role)}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="mail" size={20} color={COLORS.textLight} />
          <Text style={styles.infoText}>{userProfile?.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call" size={20} color={COLORS.textLight} />
          <Text style={styles.infoText}>{userProfile?.phone || 'Telefon Girilmemiş'}</Text>
        </View>
        
        {/* SADECE TAHTA SAHİPLERİ İÇİN IBAN ALANI */}
        {userProfile?.role === 'OWNER' && (
          <View style={styles.infoRow}>
            <Ionicons name="card" size={20} color={COLORS.textLight} />
            <View style={{flex: 1, marginLeft: 12}}>
                {userProfile?.iban ? (
                    <View>
                        <Text style={styles.label}>IBAN</Text>
                        <Text style={styles.infoValue}>{userProfile.iban}</Text>
                    </View>
                ) : (
                    <Text style={{color: COLORS.textLight}}>IBAN bilgisi eklenmemiş</Text>
                )}
            </View>
            
            <TouchableOpacity onPress={openIbanModal} style={styles.editBtn}>
                <Text style={styles.editBtnText}>{userProfile?.iban ? 'Düzenle' : '+ Ekle'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      {/* IBAN DÜZENLEME MODALI */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>IBAN Bilgisi</Text>
                <TextInput 
                    style={styles.input}
                    placeholder="TR..."
                    value={ibanInput}
                    onChangeText={setIbanInput}
                />
                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                        <Text style={styles.cancelBtnText}>İptal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveIban}>
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
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  avatarContainer: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16, ...SHADOWS.medium
  },
  avatarText: { fontSize: 40, color: '#fff', fontWeight: 'bold' },
  name: { fontSize: 24, fontWeight: 'bold', color: COLORS.textDark },
  roleBadge: { backgroundColor: '#E5E5EA', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  roleText: { fontSize: 14, color: COLORS.textLight, fontWeight: '600' },
  
  infoSection: { backgroundColor: '#fff', borderRadius: 16, padding: 20, ...SHADOWS.light, marginBottom: 30 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoText: { marginLeft: 12, fontSize: 16, color: COLORS.textDark },
  
  label: { fontSize: 10, color: COLORS.textLight, marginBottom: 2 },
  infoValue: { fontSize: 16, color: COLORS.textDark, fontWeight: '500' },

  editBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#F2F2F7', borderRadius: 8 },
  editBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: 'bold' },

  logoutBtn: { backgroundColor: '#FF3B30', padding: 16, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Modal Stilleri
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { backgroundColor: '#F2F2F7', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', marginRight: 10 },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { color: COLORS.danger, fontWeight: 'bold' },
  saveBtnText: { color: '#fff', fontWeight: 'bold' }
});