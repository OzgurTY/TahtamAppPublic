import React, { useContext, useState } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Modal, TextInput, StatusBar, ScrollView,
  KeyboardAvoidingView, Platform 
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { logoutUser, updateUserProfile, deleteUserAccount } from '../services/authService'; // deleteUserAccount eklendi
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, userProfile, setUserProfile } = useContext(AuthContext);
  
  // Modal State
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [formPhone, setFormPhone] = useState('');
  const [formIban, setFormIban] = useState('');

  const isOwner = userProfile?.role === 'OWNER';

  const handleLogout = () => {
    Alert.alert('Çıkış', 'Uygulamadan çıkmak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logoutUser() }
    ]);
  };

  // HESAP SİLME FONKSİYONU
  const handleDeleteAccount = () => {
    Alert.alert(
      "Hesabı Sil",
      "Hesabınızı ve tüm verilerinizi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        { 
          text: "Sil", 
          style: "destructive", // Kırmızı gösterir
          onPress: async () => {
            try {
              await deleteUserAccount();
              // AuthContext durumu otomatik algılayıp Login ekranına atacaktır.
            } catch (error) {
              // Firebase güvenlik kuralı gereği, uzun süre önce giriş yapılmışsa tekrar giriş ister
              Alert.alert(
                "Hata", 
                "Güvenlik gereği hesabınızı silmek için lütfen çıkış yapıp tekrar giriş yapın, ardından tekrar deneyin."
              );
            }
          } 
        }
      ]
    );
  };

  const openSettings = () => {
    setFormPhone(userProfile?.phone || '');
    setFormIban(userProfile?.iban || '');
    setSettingsVisible(true);
  };

  const handleSaveSettings = async () => {
    try {
      const updates = {
        phone: formPhone
      };
      if (isOwner) {
        updates.iban = formIban;
      }

      await updateUserProfile(user.uid, updates);
      setUserProfile({ ...userProfile, ...updates });
      
      setSettingsVisible(false);
      Alert.alert("Başarılı", "Bilgileriniz güncellendi.");
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
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profilim</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={openSettings}>
          <Ionicons name="settings-outline" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {userProfile?.fullName?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.nameText}>{userProfile?.fullName}</Text>
          <View style={[styles.roleBadge, { backgroundColor: isOwner ? '#E3F2FD' : '#F3E5F5' }]}>
            <Text style={[styles.roleText, { color: isOwner ? COLORS.primary : COLORS.secondary }]}>
              {getRoleLabel(userProfile?.role)}
            </Text>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconBox}>
                <Ionicons name="mail" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>E-posta</Text>
                <Text style={styles.infoValue}>{userProfile?.email}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.iconBox}>
                <Ionicons name="call" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Telefon</Text>
                <Text style={styles.infoValue}>{userProfile?.phone || 'Belirtilmemiş'}</Text>
              </View>
            </View>

            {isOwner && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.iconBox}>
                    <Ionicons name="card" size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>IBAN</Text>
                    <Text style={styles.infoValue}>{userProfile?.iban || 'Belirtilmemiş'}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ff0000ff" style={{marginRight: 8}} />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* AYARLAR MODALI */}
      <Modal visible={settingsVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Bilgileri Düzenle</Text>
                    <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                      <Ionicons name="close" size={24} color={COLORS.textLight} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView contentContainerStyle={{paddingBottom: 20}} showsVerticalScrollIndicator={false}>
                    <Text style={styles.inputLabel}>Telefon Numarası</Text>
                    <TextInput 
                        style={styles.input}
                        placeholder="0555..."
                        value={formPhone}
                        onChangeText={setFormPhone}
                        keyboardType="phone-pad"
                    />

                    {isOwner && (
                      <>
                        <Text style={styles.inputLabel}>IBAN Bilgisi</Text>
                        <TextInput 
                            style={styles.input}
                            placeholder="TR..."
                            value={formIban}
                            onChangeText={setFormIban}
                        />
                        <Text style={styles.helperText}>
                          Kiracılarınız ödeme yaparken bu IBAN'ı görecektir.
                        </Text>
                      </>
                    )}

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettingsVisible(false)}>
                            <Text style={styles.cancelBtnText}>İptal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
                            <Text style={styles.saveBtnText}>Kaydet</Text>
                        </TouchableOpacity>
                    </View>

                    {/* HESAP SİLME BUTONU */}
                    <View style={styles.deleteAccountContainer}>
                        <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
                            <Text style={styles.deleteAccountText}>Hesabımı Kalıcı Olarak Sil</Text>
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
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0'
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textDark },
  settingsButton: { padding: 8, backgroundColor: '#F5F5F5', borderRadius: 50 },

  scrollContent: { padding: 20 },

  profileHeader: { alignItems: 'center', marginBottom: 30 },
  avatarContainer: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 15, elevation: 10
  },
  avatarText: { fontSize: 40, color: '#fff', fontWeight: 'bold' },
  nameText: { fontSize: 24, fontWeight: '800', color: COLORS.textDark, marginBottom: 6 },
  roleBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  sectionContainer: { marginBottom: 25 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textLight, marginBottom: 12, marginLeft: 4 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, ...SHADOWS.light },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  iconBox: { 
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F8FF', 
    justifyContent: 'center', alignItems: 'center', marginRight: 16 
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  infoValue: { fontSize: 16, color: COLORS.textDark, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 12 },

  logoutBtn: { 
    flexDirection: 'row', backgroundColor: '#FFEBEE', padding: 16, 
    borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 
  },
  logoutText: { color: COLORS.danger, fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { 
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, 
    padding: 24, minHeight: '50%', ...SHADOWS.medium 
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textDark },
  
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textDark, marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#E9ECEF' },
  helperText: { fontSize: 12, color: COLORS.textLight, marginTop: 6, fontStyle: 'italic' },

  modalActions: { flexDirection: 'row', marginTop: 30 },
  cancelBtn: { flex: 1, padding: 16, alignItems: 'center', marginRight: 12, backgroundColor: '#F5F5F5', borderRadius: 12 },
  saveBtn: { flex: 2, backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textLight, fontWeight: '700' },
  saveBtnText: { color: '#fff', fontWeight: '700' },

  // HESAP SİLME BUTON STİLLERİ
  deleteAccountContainer: { marginTop: 40, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 20 },
  deleteAccountBtn: { alignItems: 'center', padding: 10 },
  deleteAccountText: { color: COLORS.danger, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }
});