import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Bildirim Davranışı
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 1. İzin İste ve Token Al
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Bildirim izni verilmedi!');
      return;
    }

    // Token al
    try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
        
        // --- HATA DÜZELTMESİ ---
        // Eğer projectId yoksa (EAS kurulu değilse) işlemi durdur, hata verme.
        if (!projectId) {
            console.log("EAS Project ID bulunamadı. Bildirim token'ı alınamıyor (Normal durum).");
            return null;
        }
        // -----------------------

        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log("Push Token:", token);
    } catch (e) {
        console.error("Token hatası:", e);
    }
  } else {
    console.log('Simülatörde fiziksel bildirim çalışmaz.');
  }

  return token;
}

// 2. Bildirim Gönder
export async function sendPushNotification(expoPushToken, title, body) {
  if (!expoPushToken) return;

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: { someData: 'goes here' },
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error("Bildirim gönderme hatası:", error);
  }
}