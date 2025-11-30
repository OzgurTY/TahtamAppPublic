import React, { useState, useCallback, useContext } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, RefreshControl, 
  SafeAreaView, StatusBar, Dimensions, ActivityIndicator, TouchableOpacity, Modal 
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats } from '../services/dashboardService';
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';

const screenWidth = Dimensions.get('window').width;

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export default function DashboardScreen() {
  const { user, userProfile } = useContext(AuthContext);
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Seçili Tarih
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Modal ve Yıl Seçimi State'leri
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  const isAdmin = userProfile?.role === 'ADMIN';
  const isOwner = userProfile?.role === 'OWNER';

  const fetchStats = async () => {
    if (!user || !userProfile) return;
    try {
      const data = await getDashboardStats(user.uid, userProfile.role, selectedDate);
      setStats(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [user, userProfile, selectedDate])
  );

  const onRefresh = () => {
    setRefreshing(true);
    const now = new Date();
    setSelectedDate(now);
    setPickerYear(now.getFullYear());
    fetchStats();
  };

  const openMonthPicker = () => {
    setPickerYear(selectedDate.getFullYear()); // Seçili yıl ile başlat
    setCalendarVisible(true);
  };

  const handleMonthSelect = (monthIndex) => {
    // Ayın 1'ini seç (Saat farkı sorunu olmaması için 12:00)
    const newDate = new Date(pickerYear, monthIndex, 1, 12, 0, 0);
    setSelectedDate(newDate);
    setCalendarVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // --- ETİKETLER ---
  const monthName = selectedDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  
  const mainCardTitle = isOwner 
    ? `${monthName} Gelir` 
    : (isAdmin ? `${monthName} Ciro` : `${monthName} Harcama`);
    
  const mainCardIcon = isOwner || isAdmin ? "wallet" : "card";
  const secondaryCardTitle = isOwner ? "Potansiyel Ciro" : "İşlem Sayısı";
  
  const secondaryValue = isOwner 
    ? `${stats?.totalPotentialIncome?.toLocaleString('tr-TR') || 0} ₺`
    : `${stats?.thisMonthCount || 0} Adet`;

  const diff = (stats?.thisMonthCount || 0) - (stats?.lastMonthCount || 0);
  let trendMessage = "Geçen ayla aynı seviyede.";
  let trendIcon = "remove-circle";
  let trendColor = COLORS.primary;

  if (diff > 0) {
    trendMessage = `Geçen aya göre ${diff} adet artış! 🚀`;
    trendIcon = "trending-up";
    trendColor = COLORS.success;
  } else if (diff < 0) {
    trendMessage = `Geçen aya göre ${Math.abs(diff)} adet düşüş.`;
    trendIcon = "trending-down";
    trendColor = COLORS.warning;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER (GÜNCELLENDİ: Alt alta yapı) */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
            <View>
                <Text style={styles.headerTitle}>Merhaba, {userProfile?.fullName}</Text>
                <Text style={styles.headerSubtitle}>Durum Özeti</Text>
            </View>
            {/* Profil Fotosu veya İkon buraya gelebilir, şimdilik boş */}
        </View>
        
        {/* TARİH SEÇİCİ - ARTIK ALT SATIRDA VE GENİŞ */}
        <TouchableOpacity style={styles.dateButtonBlock} onPress={openMonthPicker}>
            <Ionicons name="calendar" size={18} color={COLORS.primary} />
            <Text style={styles.dateButtonText}>{monthName}</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textLight} style={{marginLeft:'auto'}} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* ADMIN ÖZETİ */}
        {isAdmin && stats?.totalUsers !== undefined && (
          <View style={styles.adminGrid}>
            <View style={styles.adminCard}>
                <Text style={styles.adminCardLabel}>Kullanıcılar</Text>
                <Text style={styles.adminCardValue}>{stats.totalUsers}</Text>
                <Ionicons name="people" size={16} color={COLORS.primary} style={styles.adminIcon} />
            </View>
            <View style={styles.adminCard}>
                <Text style={styles.adminCardLabel}>Pazarlar</Text>
                <Text style={styles.adminCardValue}>{stats.totalMarketplaces}</Text>
                <Ionicons name="storefront" size={16} color={COLORS.secondary} style={styles.adminIcon} />
            </View>
            <View style={styles.adminCard}>
                <Text style={styles.adminCardLabel}>Tahtalar</Text>
                <Text style={styles.adminCardValue}>{stats.totalStalls}</Text>
                <Ionicons name="grid" size={16} color={COLORS.warning} style={styles.adminIcon} />
            </View>
            <View style={styles.adminCard}>
                <Text style={styles.adminCardLabel}>Genel Ciro</Text>
                <Text style={[styles.adminCardValue, {fontSize: 14}]}>{stats.totalPlatformRevenue?.toLocaleString('tr-TR')} ₺</Text>
                <Ionicons name="cash" size={16} color={COLORS.success} style={styles.adminIcon} />
            </View>
          </View>
        )}

        {/* İSTATİSTİK KARTLARI */}
        <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: COLORS.primary }]}>
                <View style={styles.iconCircleLight}>
                    <Ionicons name={mainCardIcon} size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.statLabelLight}>{mainCardTitle}</Text>
                <Text style={styles.statValueLight}>{stats?.currentMonthTotal?.toLocaleString('tr-TR')} ₺</Text>
                
                {isOwner && stats?.totalPotentialIncome > 0 && (
                    <Text style={{color:'rgba(255,255,255,0.7)', fontSize:11, marginTop:4}}>
                    %{Math.round((stats.currentMonthTotal / stats.totalPotentialIncome) * 100)} Doluluk
                    </Text>
                )}
            </View>

            <View style={[styles.statCard, { backgroundColor: '#fff' }]}>
                <View style={[styles.iconCircle, { backgroundColor: isOwner ? '#F3E5F5' : '#FFF3E0' }]}> 
                <Ionicons name={isOwner ? "bar-chart" : "receipt"} size={24} color={isOwner ? COLORS.secondary : COLORS.warning} />
                </View>
                <Text style={styles.statLabel}>{secondaryCardTitle}</Text>
                <Text style={[styles.statValue, { color: isOwner ? COLORS.secondary : COLORS.warning }]}>
                {secondaryValue}
                </Text>
                <Text style={{color:COLORS.textLight, fontSize:11, marginTop:4}}>
                Hedef Gelir
                </Text>
            </View>
        </View>

        <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>
            {isAdmin ? 'Platform Aktivitesi' : (isOwner ? 'Son 6 Ay Trendi' : 'Harcama Geçmişi')}
            </Text>
            {stats?.chartData && (
                <LineChart
                data={stats.chartData}
                width={screenWidth - 48}
                height={220}
                yAxisSuffix="₺"
                yAxisInterval={1}
                chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: "6", strokeWidth: "2", stroke: "#fff" }
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
                />
            )}
        </View>

        <View style={[styles.infoCard, { borderLeftColor: trendColor, backgroundColor: diff > 0 ? '#E8F5E9' : (diff < 0 ? '#FFF3E0' : '#E3F2FD') }]}>
            <Ionicons name={trendIcon} size={32} color={trendColor} style={{ marginRight: 12 }} />
            <View style={{flex:1}}>
            <Text style={styles.infoTitle}>Hareketlilik</Text>
            <Text style={styles.infoText}>{trendMessage}</Text>
            </View>
        </View>

      </ScrollView>

      {/* --- AY SEÇİCİ MODALI (YENİ) --- */}
      <Modal visible={calendarVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.monthPickerContainer}>
            
            {/* Yıl Seçimi */}
            <View style={styles.yearRow}>
                <TouchableOpacity onPress={() => setPickerYear(pickerYear - 1)} style={styles.yearBtn}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.yearText}>{pickerYear}</Text>
                <TouchableOpacity onPress={() => setPickerYear(pickerYear + 1)} style={styles.yearBtn}>
                    <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            {/* Ay Izgarası */}
            <View style={styles.monthGrid}>
                {MONTH_NAMES.map((month, index) => {
                    const isSelected = selectedDate.getMonth() === index && selectedDate.getFullYear() === pickerYear;
                    return (
                        <TouchableOpacity 
                            key={index} 
                            style={[styles.monthBtn, isSelected && styles.monthBtnActive]}
                            onPress={() => handleMonthSelect(index)}
                        >
                            <Text style={[styles.monthBtnText, isSelected && styles.monthBtnTextActive]}>
                                {month}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setCalendarVisible(false)}>
              <Text style={styles.closePickerText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // HEADER (YENİ TASARIM)
  header: { 
    padding: LAYOUT.padding, 
    paddingBottom: 15, 
    backgroundColor: COLORS.background 
  },
  headerTopRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 15
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textDark },
  headerSubtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },

  // TARİH BUTONU (BLOK ŞEKLİNDE)
  dateButtonBlock: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff',
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    ...SHADOWS.light
  },
  dateButtonText: { 
    color: COLORS.textDark, 
    fontWeight: '600', 
    fontSize: 15, 
    marginLeft: 10 
  },

  scrollContent: { padding: LAYOUT.padding, paddingTop: 5 },

  // ADMIN
  adminGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  adminCard: { 
    width: '48%', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 10,
    ...SHADOWS.light, position: 'relative'
  },
  adminCardLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  adminCardValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.textDark },
  adminIcon: { position: 'absolute', top: 12, right: 12, opacity: 0.8 },

  // KARTLAR
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: {
    width: '48%', padding: 16, borderRadius: 16,
    ...SHADOWS.medium, justifyContent: 'space-between', height: 150
  },
  iconCircleLight: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8
  },
  statLabelLight: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500' },
  statValueLight: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 2 },

  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8
  },
  statLabel: { color: COLORS.textLight, fontSize: 14, fontWeight: '500' },
  statValue: { color: COLORS.textDark, fontSize: 20, fontWeight: '700', marginTop: 2 },

  chartCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 20, ...SHADOWS.light
  },
  chartTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textDark, marginBottom: 10 },

  infoCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9',
    padding: 16, borderRadius: 12, borderLeftWidth: 6
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  infoText: { fontSize: 15, color: COLORS.textDark, marginTop: 4, fontWeight: '500' },

  // AY SEÇİCİ MODAL STİLLERİ
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20, alignItems: 'center' },
  monthPickerContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '90%', alignItems: 'center' },
  
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
  yearText: { fontSize: 22, fontWeight: 'bold', color: COLORS.textDark },
  yearBtn: { padding: 10 },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  monthBtn: { 
    width: '30%', paddingVertical: 12, marginVertical: 6, borderRadius: 8, 
    backgroundColor: '#F8F9FA', alignItems: 'center' 
  },
  monthBtnActive: { backgroundColor: COLORS.primary },
  monthBtnText: { fontSize: 14, color: COLORS.textDark, fontWeight: '500' },
  monthBtnTextActive: { color: '#fff', fontWeight: 'bold' },

  closePickerBtn: { marginTop: 20, padding: 10 },
  closePickerText: { color: COLORS.textLight, fontWeight: '600' }
});