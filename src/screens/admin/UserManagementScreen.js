import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, 
  Alert, SafeAreaView, StatusBar, TextInput, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllUsers, updateUserRole } from '../../services/authService';
import { subscribeToMarketplaces } from '../../services/marketplaceService';
import { COLORS, SHADOWS, LAYOUT } from '../../styles/theme';

const ROLES = [
  { label: 'Kiracı', value: 'TENANT' },
  { label: 'Tahta Sahibi', value: 'OWNER' },
  { label: 'Pazar Yöneticisi', value: 'MARKET_MANAGER' },
  { label: 'Admin', value: 'ADMIN' },
];

export default function UserManagementScreen() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [marketplaces, setMarketplaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formRole, setFormRole] = useState('TENANT');
  const [formMarketId, setFormMarketId] = useState('');
  const [formCommission, setFormCommission] = useState('10');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const allUsers = await getAllUsers();
    setUsers(allUsers);
    setFilteredUsers(allUsers);
    
    // Marketleri çek (Dropdown için)
    const unsub = subscribeToMarketplaces((data) => {
      setMarketplaces(data);
    });
    
    setLoading(false);
    return () => unsub();
  };

  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredUsers(users);
    } else {
      const lower = searchText.toLowerCase();
      setFilteredUsers(users.filter(u => 
        u.email.toLowerCase().includes(lower) || 
        (u.fullName && u.fullName.toLowerCase().includes(lower))
      ));
    }
  }, [searchText, users]);

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormRole(user.role || 'TENANT');
    setFormMarketId(user.managedMarketId || '');
    setFormCommission(user.commissionRate ? user.commissionRate.toString() : '10');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    const updates = { role: formRole };

    if (formRole === 'MARKET_MANAGER') {
      if (!formMarketId) return Alert.alert("Hata", "Pazar seçmelisiniz.");
      updates.managedMarketId = formMarketId;
      updates.commissionRate = parseFloat(formCommission) || 10;
    } else {
      // Diğer rollerde bu alanları temizle
      updates.managedMarketId = null;
      updates.commissionRate = null;
    }

    try {
      await updateUserRole(selectedUser.id, updates);
      Alert.alert("Başarılı", "Kullanıcı güncellendi.");
      setModalVisible(false);
      loadData(); // Listeyi yenile
    } catch (error) {
      Alert.alert("Hata", "Güncelleme yapılamadı.");
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEditModal(item)}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Text style={styles.avatarText}>{item.fullName ? item.fullName[0].toUpperCase() : 'U'}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={styles.name}>{item.fullName || 'İsimsiz'}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
        <View style={[styles.badge, {backgroundColor: getRoleColor(item.role)}]}>
          <Text style={styles.badgeText}>{getRoleLabel(item.role)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getRoleLabel = (role) => {
    const r = ROLES.find(r => r.value === role);
    return r ? r.label : role;
  };

  const getRoleColor = (role) => {
    if (role === 'ADMIN') return COLORS.danger;
    if (role === 'MARKET_MANAGER') return COLORS.warning;
    if (role === 'OWNER') return COLORS.secondary;
    return COLORS.success; // Tenant
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Kullanıcı Yönetimi</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={COLORS.textLight} />
        <TextInput 
          style={styles.searchInput} 
          placeholder="Kullanıcı ara..." 
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop:20}} />
      ) : (
        <FlatList 
          data={filteredUsers} 
          renderItem={renderItem} 
          keyExtractor={item => item.id} 
          contentContainerStyle={styles.list}
        />
      )}

      {/* DÜZENLEME MODALI */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Rol Düzenle</Text>
            <Text style={styles.subTitle}>{selectedUser?.email}</Text>

            <Text style={styles.label}>Kullanıcı Rolü:</Text>
            <View style={styles.roleGrid}>
              {ROLES.map((r) => (
                <TouchableOpacity 
                  key={r.value} 
                  style={[styles.roleBtn, formRole === r.value && styles.roleBtnActive]}
                  onPress={() => setFormRole(r.value)}
                >
                  <Text style={[styles.roleBtnText, formRole === r.value && {color:'#fff'}]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {formRole === 'MARKET_MANAGER' && (
              <View style={styles.managerOptions}>
                <Text style={styles.label}>Sorumlu Olduğu Pazar:</Text>
                <View style={styles.marketList}>
                  {marketplaces.map(m => (
                    <TouchableOpacity 
                      key={m.id}
                      style={[styles.marketBtn, formMarketId === m.id && styles.marketBtnActive]}
                      onPress={() => setFormMarketId(m.id)}
                    >
                      <Text style={[styles.marketBtnText, formMarketId === m.id && {color:'#fff'}]}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Komisyon Oranı (%):</Text>
                <TextInput 
                  style={styles.input} 
                  value={formCommission} 
                  onChangeText={setFormCommission} 
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={{color:COLORS.textDark}}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={{color:'#fff', fontWeight:'bold'}}>Kaydet</Text>
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
  header: { padding: LAYOUT.padding, backgroundColor: '#fff', borderBottomWidth:1, borderColor:'#eee' },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.textDark },
  searchBar: { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', margin:15, padding:10, borderRadius:8, borderWidth:1, borderColor:'#eee' },
  searchInput: { marginLeft:10, flex:1 },
  list: { padding:15 },
  card: { backgroundColor:'#fff', padding:15, borderRadius:12, marginBottom:10, ...SHADOWS.light },
  row: { flexDirection:'row', alignItems:'center' },
  iconBox: { width:40, height:40, borderRadius:20, backgroundColor:COLORS.primary, alignItems:'center', justifyContent:'center', marginRight:12 },
  avatarText: { color:'#fff', fontWeight:'bold', fontSize:18 },
  name: { fontWeight:'bold', fontSize:16 },
  email: { color:COLORS.textLight, fontSize:12 },
  badge: { paddingHorizontal:10, paddingVertical:4, borderRadius:12 },
  badgeText: { color:'#fff', fontSize:10, fontWeight:'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign:'center' },
  subTitle: { textAlign:'center', color:COLORS.textLight, marginBottom:20 },
  label: { fontWeight:'bold', marginTop:10, marginBottom:5, color:COLORS.textDark },
  
  roleGrid: { flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between' },
  roleBtn: { width:'48%', padding:10, borderRadius:8, borderWidth:1, borderColor:COLORS.border, marginBottom:8, alignItems:'center' },
  roleBtnActive: { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  roleBtnText: { fontSize:12 },
  
  managerOptions: { marginTop: 10, padding:10, backgroundColor:'#f9f9f9', borderRadius:8 },
  marketList: { flexDirection:'row', flexWrap:'wrap', marginBottom:10 },
  marketBtn: { padding:8, borderRadius:6, borderWidth:1, borderColor:'#ddd', marginRight:5, marginBottom:5 },
  marketBtnActive: { backgroundColor:COLORS.secondary, borderColor:COLORS.secondary },
  marketBtnText: { fontSize:12 },
  input: { backgroundColor:'#fff', borderWidth:1, borderColor:'#ddd', padding:8, borderRadius:6 },
  
  actions: { flexDirection:'row', marginTop:20 },
  cancelBtn: { flex:1, padding:12, alignItems:'center', backgroundColor:'#eee', borderRadius:8, marginRight:10 },
  saveBtn: { flex:1, padding:12, alignItems:'center', backgroundColor:COLORS.primary, borderRadius:8 }
});