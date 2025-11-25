import React, { useState, useCallback, useContext } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, RefreshControl, 
  SafeAreaView, StatusBar, Dimensions, ActivityIndicator 
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats } from '../services/dashboardService';
import { COLORS, SHADOWS, LAYOUT } from '../styles/theme';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const { user, userProfile } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = userProfile?.role === 'ADMIN';
  const isOwner = userProfile?.role === 'OWNER';

  const fetchStats = async () => {
    if (!user || !userProfile) return;
    try {
      const data = await getDashboardStats(user.uid, userProfile.role);
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
    }, [user, userProfile])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // --- ROL BAZLI ETİKETLER ---
  const mainCardTitle = isOwner ? "Bu Ay Gelir" : (isAdmin ? "Bu Ay Platform Cirosu" : "Bu Ay Harcama");
  const mainCardIcon = isOwner || isAdmin ? "wallet" : "card";
  
  const secondaryCardTitle = isOwner ? "Potansiyel Ciro" : "İşlem Sayısı";
  const secondaryValue = isOwner 
    ? `${stats?.totalPotentialIncome?.toLocaleString('tr-TR') || 0} ₺`
    : `${stats?.thisMonthCount || 0} Adet`;

  // Trend
  const diff = (stats?.thisMonthCount || 0) - (stats?.lastMonthCount || 0);
  let trendMessage = "Geçen ayla aynı seviyede.";
  let trendIcon = "remove-circle";
  let trendColor = COLORS.primary;

  if (diff > 0) {
    trendMessage = `Geçen aya göre ${diff} adet daha fazla işlem! 🚀`;
    trendIcon = "trending-up";
    trendColor = COLORS.success;
  } else if (diff < 0) {
    trendMessage = `Geçen aya göre ${Math.abs(diff)} adet düşüş var.`;
    trendIcon = "trending-down";
    trendColor = COLORS.warning;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Merhaba, {userProfile?.fullName}</Text>
        <Text style={styles.headerSubtitle}>
            {isAdmin ? 'Yönetici Paneli & Sistem Özeti' : (isOwner ? 'İşlerinin genel durumu' : 'Kiralama özetin')}
        </Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* --- ADMIN ÖZEL İSTATİSTİK PANELİ --- */}
        {isAdmin && (
          <View style={styles.adminGrid}>
            <View style={styles.adminCard}>
                <Text style={styles.adminCardLabel}>Kullanıcılar</Text>
                <Text style={styles.adminCardValue}>{stats?.totalUsers}</Text>
                <Ionicons name="people" size={16} color={COLORS.primary} style={styles.adminIcon} />
            </View>
            <View style={styles.adminCard}>
                <Text style={styles.adminCardLabel}>Pazaryerleri</Text>
                <Text style={styles.adminCardValue}>{stats?.totalMarketplaces}</Text>
                <Ionicons name="storefront" size={16} color={COLORS.secondary} style={styles.adminIcon} />
            </View>
            <View style={styles.adminCard}>
                <Text style={styles.adminCardLabel}>Tahtalar</Text>
                <Text style={styles.adminCardValue}>{stats?.totalStalls}</Text>
                <Ionicons name="grid" size={16} color={COLORS.warning} style={styles.adminIcon} />
            </View>
            <View style={styles.adminCard}>
                <Text style={styles.adminCardLabel}>Toplam Ciro</Text>
                <Text style={[styles.adminCardValue, {fontSize: 14}]}>{stats?.totalPlatformRevenue?.toLocaleString('tr-TR')} ₺</Text>
                <Ionicons name="cash" size={16} color={COLORS.success} style={styles.adminIcon} />
            </View>
          </View>
        )}

        {/* --- GENEL ÖZET KARTLARI (Herkes İçin) --- */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: COLORS.primary }]}>
            <View style={styles.iconCircleLight}>
              <Ionicons name={mainCardIcon} size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.statLabelLight}>{mainCardTitle}</Text>
            <Text style={styles.statValueLight}>{stats?.currentMonthTotal?.toLocaleString('tr-TR')} ₺</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#fff' }]}>
             <View style={[styles.iconCircle, { backgroundColor: isOwner ? '#F3E5F5' : '#FFF3E0' }]}> 
              <Ionicons name={isOwner ? "bar-chart" : "receipt"} size={24} color={isOwner ? COLORS.secondary : COLORS.warning} />
            </View>
            <Text style={styles.statLabel}>{secondaryCardTitle}</Text>
            <Text style={[styles.statValue, { color: isOwner ? COLORS.secondary : COLORS.warning }]}>
              {secondaryValue}
            </Text>
          </View>
        </View>

        {/* --- GRAFİK --- */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            {isAdmin ? 'Platform Aktivitesi (Son 6 Ay)' : (isOwner ? 'Gelir Trendi' : 'Harcama Geçmişi')}
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

        {/* --- TREND KARTI --- */}
        <View style={[styles.infoCard, { borderLeftColor: trendColor, backgroundColor: diff > 0 ? '#E8F5E9' : (diff < 0 ? '#FFF3E0' : '#E3F2FD') }]}>
          <Ionicons name={trendIcon} size={32} color={trendColor} style={{ marginRight: 12 }} />
          <View style={{flex:1}}>
            <Text style={styles.infoTitle}>Hareketlilik</Text>
            <Text style={styles.infoText}>{trendMessage}</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { padding: LAYOUT.padding, paddingBottom: 10, backgroundColor: COLORS.background },
  headerTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textDark },
  headerSubtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },

  scrollContent: { padding: LAYOUT.padding },

  // ADMIN GRID
  adminGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  adminCard: { 
    width: '48%', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 10,
    ...SHADOWS.light, position: 'relative'
  },
  adminCardLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  adminCardValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.textDark },
  adminIcon: { position: 'absolute', top: 12, right: 12, opacity: 0.8 },

  // STANDART KARTLAR
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
  infoText: { fontSize: 15, color: COLORS.textDark, marginTop: 4, fontWeight: '500' }
});