import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { registerUser } from '../../services/authService';
import { COLORS, LAYOUT, SHADOWS } from '../../styles/theme';

export default function RegisterScreen({ navigation }) {
  const [role, setRole] = useState('TENANT'); 
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // IBAN state'i kaldırıldı

  const handleRegister = async () => {
    if (!email || !password || !fullName) {
      return Alert.alert('Hata', 'Lütfen zorunlu alanları doldurun.');
    }

    try {
      const userData = {
        fullName,
        phone,
        role, 
        // IBAN artık burada gönderilmiyor
      };
      
      await registerUser(email, password, userData);
      Alert.alert('Başarılı', 'Hesap oluşturuldu!');
    } catch (error) {
      Alert.alert('Hata', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1}}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Aramıza Katıl</Text>
          <Text style={styles.subtitle}>Tahtam ile pazar yerini yönet.</Text>

          {/* ROL SEÇİMİ */}
          <View style={styles.roleContainer}>
            <TouchableOpacity 
              style={[styles.roleBtn, role === 'TENANT' && styles.roleBtnActive]}
              onPress={() => setRole('TENANT')}
            >
              <Text style={[styles.roleText, role === 'TENANT' && styles.roleTextActive]}>Kiracıyım</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.roleBtn, role === 'OWNER' && styles.roleBtnActive]}
              onPress={() => setRole('OWNER')}
            >
              <Text style={[styles.roleText, role === 'OWNER' && styles.roleTextActive]}>Tahta Sahibiyim</Text>
            </TouchableOpacity>
          </View>

          <TextInput style={styles.input} placeholder="Ad Soyad" value={fullName} onChangeText={setFullName} />
          <TextInput style={styles.input} placeholder="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          
          <TextInput style={styles.input} placeholder="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Şifre" value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={styles.btn} onPress={handleRegister}>
            <Text style={styles.btnText}>Kayıt Ol</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{marginTop: 20}}>
            <Text style={styles.linkText}>Zaten hesabın var mı? Giriş Yap</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 30, justifyContent: 'center', minHeight: '100%' },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.primary, marginBottom: 10 },
  subtitle: { fontSize: 16, color: COLORS.textLight, marginBottom: 30 },
  
  roleContainer: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#E5E5EA', borderRadius: 12, padding: 4 },
  roleBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 10 },
  roleBtnActive: { backgroundColor: '#fff', ...SHADOWS.light },
  roleText: { fontWeight: '600', color: COLORS.textLight },
  roleTextActive: { color: COLORS.primary },

  input: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 16, ...SHADOWS.light },
  btn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, ...SHADOWS.medium },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkText: { textAlign: 'center', color: COLORS.secondary, fontWeight: '600' }
});