import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  SafeAreaView, Image 
} from 'react-native';
import { loginUser } from '../../services/authService';
import { COLORS, SHADOWS } from '../../styles/theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await loginUser(email, password);
    } catch (error) {
      Alert.alert('Hata', 'Giriş yapılamadı. Bilgilerinizi kontrol edin.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logoText}>Tahtam</Text>
          <Text style={styles.subtitle}>Tekrar Hoşgeldiniz!</Text>
        </View>

        <TextInput 
          style={styles.input} 
          placeholder="E-posta Adresi" 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none" 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Şifre" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin}>
          <Text style={styles.btnText}>Giriş Yap</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{marginTop: 20}}>
          <Text style={styles.linkText}>Hesabın yok mu? Kayıt Ol</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, padding: 30, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 50 },
  logoText: { fontSize: 40, fontWeight: 'bold', color: COLORS.primary },
  subtitle: { fontSize: 18, color: COLORS.textLight, marginTop: 10 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 16, ...SHADOWS.light },
  btn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, ...SHADOWS.medium },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkText: { textAlign: 'center', color: COLORS.secondary, fontWeight: '600' }
});