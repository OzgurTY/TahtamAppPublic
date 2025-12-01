import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfile, updateUserProfile } from '../services/authService'; // updateUserProfile eklendi
import { registerForPushNotificationsAsync } from '../services/notificationService'; // YENİ

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);

        // --- YENİ: BİLDİRİM TOKEN'I AL VE KAYDET ---
        registerForPushNotificationsAsync().then(token => {
            if (token) {
                // Token değişmişse veya yoksa güncelle
                if (profile?.pushToken !== token) {
                    updateUserProfile(currentUser.uid, { pushToken: token });
                    // State'i de güncelle ki anlık kullanabilelim
                    setUserProfile(prev => ({...prev, pushToken: token}));
                }
            }
        });
        // -------------------------------------------

      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, setUserProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};