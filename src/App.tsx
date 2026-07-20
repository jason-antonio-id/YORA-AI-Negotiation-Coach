import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenType, Supplier } from './types';
import { LoginScreen, ForgotPasswordScreen } from './components/LoginScreens';
import { RegisterStep1, RegisterStep2, RegisterStep3, OnboardingCompleted } from './components/OnboardingScreens';
import { OtpVerificationScreen } from './components/OtpVerificationScreen';
import { GoogleOnboardingStep1, GoogleOnboardingStep2 } from './components/GoogleOnboarding';
import { DashboardActive } from './components/DashboardActive';
import { DashboardEmpty } from './components/DashboardEmpty';
import { SupplierListScreen } from './components/SupplierListScreen';
import { WizardStep1, WizardStep2, WizardStep3, SupplierAddedScreen } from './components/WizardScreens';
import { NegotiationRoomScreen } from './components/NegotiationRoomScreen';
import { GuanxiMeterScreen } from './components/GuanxiMeterScreen';
import { MessageHistoryScreen } from './components/MessageHistoryScreen';
import { PhraseLibraryScreen } from './components/PhraseLibraryScreen';
import { CulturalGuideScreen } from './components/CulturalGuideScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { SupplierProfileScreen } from './components/SupplierProfileScreen';
import { AdminUsersScreen } from './components/AdminUsersScreen';
import { Toast, ToastType } from './components/Toast';
import { useSupabase } from './lib/SupabaseContext';
import { supabase, resolveStorageUrl } from './lib/supabase';

const DEFAULT_USER_DATA = {
  fullName: '',
  email: '',
  businessName: '',
  businessType: '',
  province: '',
  originCity: '',
  aiLang: 'Bahasa Indonesia',
  aiStyle: 'balanced',
  aiTone: 'formal',
  aiDepth: 'cultural',
  isLoggedIn: false,
};

export default function App() {
  const { user, loading: authLoading, userProfile, refreshProfile, reloadUser } = useSupabase();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => {
    const saved = localStorage.getItem('yora_current_screen');
    return (saved as ScreenType) || 'login';
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(() => {
    return localStorage.getItem('yora_selected_supplier_id');
  });

  // Persist navigation and active supplier state to localStorage
  useEffect(() => {
    localStorage.setItem('yora_current_screen', currentScreen);
  }, [currentScreen]);

  useEffect(() => {
    if (selectedSupplierId) {
      localStorage.setItem('yora_selected_supplier_id', selectedSupplierId);
    } else {
      localStorage.removeItem('yora_selected_supplier_id');
    }
  }, [selectedSupplierId]);

  const [addedSupplier, setAddedSupplier] = useState<Supplier | null>(() => {
    const draft = localStorage.getItem('yora_wizard_draft');
    if (draft) {
      try {
        return JSON.parse(draft);
      } catch (e) {
        console.warn("Parsing wizard draft failed:", e);
      }
    }
    return null;
  });
  const [userData, setUserData] = useState(DEFAULT_USER_DATA);
  const [onboardingFinishedLocally, setOnboardingFinishedLocally] = useState(() => {
    // If we have a completed profile in the state already, consider it finished
    return localStorage.getItem('yora_onboarding_finished') === 'true';
  });

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
  const isAdmin = user?.email === adminEmail;

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, isVisible: true });
  };

  // Centralized catch listener for general Firestore errors to show a Toast notification (Issue 3)
  useEffect(() => {
    const handleGlobalFirestoreError = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      const opName = detail?.operationType || 'write / read';
      showToast(
        `Database exception during ${opName}. Please verify authentication or network connection.`, 
        'error'
      );
    };
    window.addEventListener('firestore-error', handleGlobalFirestoreError);
    return () => window.removeEventListener('firestore-error', handleGlobalFirestoreError);
  }, []);

  // Sync suppliers with Supabase
  useEffect(() => {
    if (!user) {
      setSuppliers([]);
      return;
    }

    const fetchSuppliers = async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('owner_id', user.id);
      
      if (error) {
        console.error('Error fetching suppliers:', error);
        return;
      }

      if (data) {
        const sups = data.map(row => ({
          id: row.id,
          chineseName: row.chinese_name,
          englishName: row.english_name,
          wechatId: row.wechat_id || undefined,
          url: row.url || undefined,
          province: row.province || undefined,
          city: row.city || undefined,
          discoverySource: row.discovery_source || undefined,
          cooperationHistory: row.cooperation_history || undefined,
          logoUrl: row.logo_url || undefined,
          status: row.status || undefined,
          coreProducts: Array.isArray(row.core_products) ? row.core_products : [],
          guanxiScore: row.guanxi_score ?? 50,
          guanxiTrend: row.guanxi_trend ?? 0,
          lastContactText: row.last_contact_text || undefined,
          targetPrice: row.target_price || undefined,
          walkAwayPrice: row.walk_away_price || undefined,
          moq: row.moq || undefined,
          productName: row.product_name || undefined,
          productChineseName: row.product_chinese_name || undefined,
          ownerId: row.owner_id
        } as Supplier));
        setSuppliers(sups);
      }
    };

    fetchSuppliers();

    const channel = supabase
      .channel(`suppliers-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'suppliers',
          filter: `owner_id=eq.${user.id}`,
        },
        () => {
          fetchSuppliers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Sync user profile
  useEffect(() => {
    const onboardingScreens = [
      'register-step1',
      'verify-email',
      'register-step2',
      'register-step3',
      'google-onboarding-step1',
      'google-onboarding-step2',
      'onboarding-completed'
    ];

    if (authLoading) return;

    // 1. NOT LOGGED IN
    if (!user) {
      const publicScreens = ['login', 'forgot-password', 'register-step1'];
      if (!publicScreens.includes(currentScreen)) {
        setCurrentScreen('login');
      }
      if (userData.isLoggedIn) {
        setUserData(DEFAULT_USER_DATA);
        setOnboardingFinishedLocally(false);
        localStorage.removeItem('yora_onboarding_finished');
      }
      return;
    }

    // 2. LOGGED IN BUT NOT VERIFIED (Visitor account or Admin bypasses verification)
    const isVerified = !!user.email_confirmed_at || userProfile?.emailVerified === true || user.email === 'visitor@yora.com' || isAdmin;
    if (!isVerified) {
      if (currentScreen !== 'verify-email' && currentScreen !== 'login') {
        setCurrentScreen('verify-email');
      }
      return;
    }

    // 3. LOGGED IN AND VERIFIED - Handle Profile and Navigation
    if (userProfile) {
      // Sync verification to profiles table if needed
      if (userProfile.emailVerified !== true && user.email !== 'visitor@yora.com' && !isAdmin) {
        supabase.from('profiles').update({ email_verified: true }).eq('id', user.id).then(({ error }) => {
          if (error) console.warn(error);
        });
      }

      // Check onboarding state (Admin always bypasses)
      const hasStep2Data = !!userProfile.businessName && userProfile.businessName.length >= 2;
      const hasStep3Data = !!userProfile.aiLang && !!userProfile.aiStyle;
      const hasFinishedOnboarding = userProfile.onboardingStatus === 'completed' || (hasStep2Data && hasStep3Data) || isAdmin;

      // Global userData sync (only when not actively editing profile in onboarding screens to avoid field fighting)
      const isActivelyOnboarding = onboardingScreens.includes(currentScreen);
      if (!isActivelyOnboarding || !userData.fullName) {
        setUserData(prev => ({ ...prev, ...userProfile, isLoggedIn: true }));
      }

      // NAVIGATION GUARD
      if (hasFinishedOnboarding) {
        // If the user is on a wizard-step / supplier-added screen, do nothing
        const wizardScreens = ['wizard-step1', 'wizard-step2', 'wizard-step3', 'supplier-added'];
        if (wizardScreens.includes(currentScreen)) {
          // Do nothing - allow them to stay on these wizard/add screens
        } else {
          // If finished but lingering on auth screens or early onboarding, push to dashboard
          // Note: we exclude 'onboarding-completed' so they can see the success screen
          const screensToExit = ['login', 'verify-email', 'register-step1', 'register-step2', 'register-step3', 'google-onboarding-step1', 'google-onboarding-step2'];
          if (screensToExit.includes(currentScreen)) {
            setCurrentScreen('dashboard-active');
          }
        }
      } else {
        // NOT FINISHED - Force strict sequence
        const isGoogleUser = user.app_metadata?.provider === 'google' || user.app_metadata?.providers?.includes('google');

        // Illegal screens for incomplete users (Wizard screens are not in internalScreens,
        // but we block them if they don't even have Step 2 data yet)
        const internalScreens = [
          'dashboard-active', 'dashboard-empty', 'supplier-list', 'negotiation-room', 
          'guanxi-meter', 'settings', 'message-history', 'phrase-library', 
          'cultural-guide', 'supplier-profile', 'admin-users'
        ];
        
        const wizardScreens = ['wizard-step1', 'wizard-step2', 'wizard-step3', 'supplier-added'];
        const isTryingToBypass = internalScreens.includes(currentScreen) || 
          currentScreen === 'login' || 
          currentScreen === 'verify-email' ||
          (!hasStep2Data && wizardScreens.includes(currentScreen));

        if (isTryingToBypass) {
          if (isGoogleUser) {
            // Google specific strict sequence
            if (!hasStep2Data) {
              setCurrentScreen('google-onboarding-step1');
            } else if (!hasStep3Data) {
              setCurrentScreen('google-onboarding-step2');
            } else {
              setCurrentScreen('google-onboarding-step2');
            }
          } else {
            // Email/Password specific strict sequence
            if (!hasStep2Data) {
              setCurrentScreen('register-step2');
            } else {
              setCurrentScreen('register-step3');
            }
          }
        }
      }
    } else {
      // Profile doc missing
      if (onboardingScreens.includes(currentScreen)) return;
      
      const isGoogleUser = user.app_metadata?.provider === 'google' || user.app_metadata?.providers?.includes('google');
      if (isGoogleUser) {
        setCurrentScreen('google-onboarding-step1');
      } else if (currentScreen !== 'register-step1' && currentScreen !== 'verify-email' && currentScreen !== 'login') {
        setCurrentScreen('register-step2');
      }
    }
  }, [userProfile, user, authLoading, onboardingFinishedLocally, isAdmin]);

  const handleNavigate = (screen: ScreenType, params?: { supplierId?: string }) => {
    if (params?.supplierId) {
      setSelectedSupplierId(params.supplierId);
    }
    if (['dashboard-active', 'dashboard-empty', 'supplier-list', 'guanxi-meter', 'settings', 'message-history', 'phrase-library', 'cultural-guide', 'negotiation-room', 'supplier-profile'].includes(screen)) {
      setAddedSupplier(null);
      localStorage.removeItem('yora_wizard_draft');
    }
    
    // Auto-persist onboarding finish if we hit the final success screen
    if (screen === 'onboarding-completed') {
      setOnboardingFinishedLocally(true);
      localStorage.setItem('yora_onboarding_finished', 'true');
    }

    setCurrentScreen(screen);
    window.scrollTo(0, 0);
  };

  const handleAddSupplier = async (newSupplier: Supplier) => {
    if (!user) {
      throw new Error('User not authenticated. Please sign in and try again.');
    }
    const supplierData = {
      id: newSupplier.id,
      owner_id: user.id,
      chinese_name: newSupplier.chineseName,
      english_name: newSupplier.englishName,
      wechat_id: newSupplier.wechatId || null,
      url: newSupplier.url || null,
      province: newSupplier.province || null,
      city: newSupplier.city || null,
      discovery_source: newSupplier.discoverySource || null,
      cooperation_history: newSupplier.cooperationHistory || null,
      logo_url: newSupplier.logoUrl || null,
      status: newSupplier.status || null,
      core_products: newSupplier.coreProducts || [],
      guanxi_score: newSupplier.guanxiScore ?? 50,
      guanxi_trend: newSupplier.guanxiTrend ?? 0,
      last_contact_text: newSupplier.lastContactText || null,
      target_price: newSupplier.targetPrice || null,
      walk_away_price: newSupplier.walkAwayPrice || null,
      moq: newSupplier.moq || null,
      product_name: newSupplier.productName || null,
      product_chinese_name: newSupplier.productChineseName || null,
    };

    const { error } = await supabase.from('suppliers').upsert(supplierData);
    if (error) {
      console.error("Supabase sync failed for supplier:", error);
      showToast('Supplier save failed. Please verify connection.', 'error');
      throw error;
    }

    // Fire-and-forget call to log supplier to Google Sheets
    fetch('/api/log-supplier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: user.email, ...supplierData }),
    }).catch(e => console.warn('Failed to log supplier to Sheets:', e));

    // Write welcome message to chat_messages table
    if (newSupplier.messages && newSupplier.messages.length > 0) {
      const welcomeMsg = newSupplier.messages[0];
      const { error: msgErr } = await supabase.from('chat_messages').insert({
        supplier_id: newSupplier.id,
        sender: welcomeMsg.sender,
        role: welcomeMsg.role || null,
        sender_name: welcomeMsg.senderName,
        text: welcomeMsg.text,
        time_text: welcomeMsg.timeText,
        translation: welcomeMsg.translation || null,
        analysis: welcomeMsg.analysis || null,
      });
      if (msgErr) {
        console.warn('Welcome message insert failed:', msgErr);
        showToast('Supplier added, but chat setup had an issue.', 'info');
      }
    }

    localStorage.removeItem('yora_wizard_draft');
    showToast(`Supplier ${newSupplier.englishName} added`, 'success');
  };

  const handleUpdateSupplier = async (updated: Supplier) => {
    if (!user) throw new Error('User not authenticated. Please sign in and try again.');
    try {
      const supplierData = {
        chinese_name: updated.chineseName,
        english_name: updated.englishName,
        wechat_id: updated.wechatId || null,
        url: updated.url || null,
        province: updated.province || null,
        city: updated.city || null,
        discovery_source: updated.discoverySource || null,
        cooperation_history: updated.cooperationHistory || null,
        logo_url: updated.logoUrl || null,
        status: updated.status || null,
        core_products: updated.coreProducts || [],
        guanxi_score: updated.guanxiScore ?? 50,
        guanxi_trend: updated.guanxiTrend ?? 0,
        last_contact_text: updated.lastContactText || null,
        target_price: updated.targetPrice || null,
        walk_away_price: updated.walkAwayPrice || null,
        moq: updated.moq || null,
        product_name: updated.productName || null,
        product_chinese_name: updated.productChineseName || null,
      };
      
      const { error } = await supabase.from('suppliers').update(supplierData).eq('id', updated.id);
      if (error) throw error;

      // Sync updated supplier to Google Sheets in background
      fetch('/api/log-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: user.email, ...supplierData, id: updated.id }),
      }).catch(e => console.warn('Failed to sync updated supplier to Sheets:', e));
    } catch (error) {
      console.error('Error updating supplier in Supabase:', error);
      showToast('Failed to update supplier.', 'error');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!user) return;
    const supplierToDelete = suppliers.find(s => s.id === id);
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      showToast(`Supplier ${supplierToDelete?.englishName || ''} deleted`, 'info');
    } catch (error) {
      console.error('Error deleting supplier:', error);
      showToast('Failed to delete supplier.', 'error');
    }
  };

  // Switch Navigator for clone fidelity
  const renderScreen = () => {
    const notificationsEnabled = !!userProfile?.notificationsEnabled;
    if (authLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
        </div>
      );
    }

    const isUserSuspended = !!userProfile?.isSuspended && !isAdmin;

    if (isUserSuspended) {
      return (
        <div className="flex-grow flex items-center justify-center p-8 bg-surface-container-lowest min-h-screen w-full">
          <div className="bg-white border border-border-light p-10 rounded-[24px] text-center max-w-md w-full shadow-lg">
            <span className="material-symbols-outlined !text-6xl text-primary mb-4">block</span>
            <h2 className="font-headline-md font-bold text-on-surface mb-2">Account Suspended</h2>
            <span className="block text-xs text-secondary font-semibold uppercase tracking-wider mb-4">账号已停用</span>
            <p className="text-sm text-secondary mb-6 leading-relaxed">
              Your account has been suspended by the workspace administrator. If you believe this is a mistake or need resolution, contact support at <strong>{adminEmail}</strong>.
            </p>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setCurrentScreen('login');
              }}
              className="w-full py-3 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-surface-tint active:scale-95 transition-all text-xs uppercase cursor-pointer"
            >
              Sign Out / 退出登录
            </button>
          </div>
        </div>
      );
    }

    const publicScreens: ScreenType[] = [
      'login', 
      'forgot-password', 
      'verify-email', 
      'register-step1', 
      'register-step2', 
      'register-step3', 
      'google-onboarding-step1', 
      'google-onboarding-step2'
    ];
    if (!user && !publicScreens.includes(currentScreen)) {
       return <LoginScreen onNavigate={handleNavigate} />;
    }

    switch (currentScreen) {
      // Auth Flow
      case 'login':
        return (
          <LoginScreen 
            onNavigate={handleNavigate} 
          />
        );
      case 'forgot-password':
        return <ForgotPasswordScreen onNavigate={handleNavigate} />;
      case 'verify-email':
        return (
          <OtpVerificationScreen
            email={user?.email || userData.email}
            onVerified={async (sessionToken) => {
              try {
                // Reload local Auth state to sync verified flag instantly
                await reloadUser();
              } catch (e) {
                console.warn("Failed to reload user after verification:", e);
              }
            }}
            onBack={async () => {
              try {
                await supabase.auth.signOut();
              } catch (e) {
                console.warn("Sign out on back failed:", e);
              }
              handleNavigate('login');
            }}
          />
        );

      // Onboarding Wizards
      case 'register-step1':
        return <RegisterStep1 onNavigate={handleNavigate} userData={userData} setUserData={setUserData} />;
      case 'register-step2':
        return <RegisterStep2 onNavigate={handleNavigate} userData={userData} setUserData={setUserData} />;
      case 'register-step3':
        return (
          <RegisterStep3 
            onNavigate={handleNavigate} 
            userData={userData} 
            setUserData={setUserData} 
          />
        );
      case 'google-onboarding-step1':
        return (
          <GoogleOnboardingStep1 
            onNavigate={handleNavigate} 
            userData={userData} 
            setUserData={setUserData} 
          />
        );
      case 'google-onboarding-step2':
        return (
          <GoogleOnboardingStep2 
            onNavigate={handleNavigate} 
            userData={userData} 
            setUserData={setUserData} 
          />
        );
      case 'onboarding-completed':
        return <OnboardingCompleted onNavigate={handleNavigate} userData={userData} setUserData={setUserData} />;

      // Main App Portals
      case 'dashboard-active':
        if (suppliers.length === 0) {
          return <DashboardEmpty onNavigate={handleNavigate} userData={userData} />;
        }
        return (
          <DashboardActive
            onNavigate={handleNavigate}
            suppliers={suppliers}
            setAddedSupplier={setAddedSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            userData={userData}
            notificationsEnabled={notificationsEnabled}
          />
        );
      case 'dashboard-empty':
        return <DashboardEmpty onNavigate={handleNavigate} userData={userData} />;
      case 'supplier-list':
        return <SupplierListScreen onNavigate={handleNavigate} suppliers={suppliers} onDeleteSupplier={handleDeleteSupplier} />;

      // Add Supplier Steps
      case 'wizard-step1':
        return (
          <WizardStep1
            onNavigate={handleNavigate}
            onAddSupplier={handleAddSupplier}
            addedSupplier={addedSupplier}
            setAddedSupplier={setAddedSupplier}
          />
        );
      case 'wizard-step2':
        return (
          <WizardStep2
            onNavigate={handleNavigate}
            onAddSupplier={handleAddSupplier}
            addedSupplier={addedSupplier}
            setAddedSupplier={setAddedSupplier}
          />
        );
      case 'wizard-step3':
        return (
          <WizardStep3
            onNavigate={handleNavigate}
            onAddSupplier={handleAddSupplier}
            addedSupplier={addedSupplier}
            setAddedSupplier={setAddedSupplier}
          />
        );
      case 'supplier-added':
        return (
          <SupplierAddedScreen
            onNavigate={handleNavigate}
            onAddSupplier={handleAddSupplier}
            addedSupplier={addedSupplier}
            setAddedSupplier={setAddedSupplier}
          />
        );

      // Deep Interaction Rooms
      case 'negotiation-room': {
        if (suppliers.length === 0) {
          return (
            <div className="flex-grow flex flex-col min-h-screen bg-background">
              {/* Header */}
              <header className="flex justify-between items-center h-16 w-full px-6 md:px-margin-desktop bg-surface-container-lowest border-b border-border-light sticky top-0 shrink-0 z-40">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4 cursor-pointer shrink-0 min-w-[200px]" onClick={() => handleNavigate('dashboard-active')}>
                    <img
                      alt="YORA Logo"
                      className="h-11 w-auto object-contain"
                      src="https://i.ibb.co.com/k2c1SPn8/1.png"
                    />
                    <div className="flex flex-col justify-center">
                      <span className="font-display-lg text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
                      <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
                    </div>
                  </div>
                  <div className="h-6 w-[1px] bg-border-light mx-4 hidden md:block"></div>
                  <span className="font-label-cn-bold text-label-cn-bold text-secondary text-sm">Negotiation Room | 谈判室</span>
                </div>
                <div className="flex items-center gap-margin-mobile md:gap-gutter">
                  <button className="text-secondary hover:text-primary transition-colors cursor-pointer" onClick={() => handleNavigate('cultural-guide')}>
                    <span className="material-symbols-outlined text-[20px]">explore</span>
                  </button>
                  <button className="text-secondary hover:text-primary transition-colors cursor-pointer" onClick={() => handleNavigate('settings')}>
                    <span className="material-symbols-outlined text-[20px]">settings</span>
                  </button>
                </div>
              </header>

              {/* Main Content Area */}
              <div className="flex-grow flex items-center justify-center p-6 bg-surface-container-low">
                <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center shadow-xl border border-border-light/60 animate-fade-in-up">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="w-48 h-48 mx-auto mb-6 flex items-center justify-center relative"
                  >
                    <div className="absolute -inset-4 bg-[radial-gradient(circle,rgba(227,6,19,0.15)_0%,transparent_70%)] rounded-full blur-2xl z-0 pointer-events-none animate-pulse-slow"></div>
                    <motion.img 
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                      src="https://i.ibb.co.com/ZZ9rMnb/1.png" 
                      alt="Negotiation Room Locked" 
                      className="w-full h-full object-contain relative z-10"
                    />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-charcoal mb-3">Negotiation Room Locked</h3>
                  <h4 className="text-sm font-semibold text-subtitle-grey mb-6">谈判室尚未开启</h4>
                  <p className="text-xs text-secondary leading-relaxed mb-4">
                    Every dynamic strategy, Guanxi response, and language formulation generated by Rui is customized to a specific manufacturer's target price and MOQ boundaries.
                  </p>
                  <p className="text-xs text-secondary leading-relaxed mb-6 font-medium">
                    To unlock this room, you must first define your targets inside the Supplier Wizard.
                  </p>
                  <p className="text-xs text-subtitle-grey leading-relaxed mb-8 italic">
                    要开启谈判室，您需要先添加一位供应商，并设置对应的目标价格和起订量目标。
                  </p>
                  
                  <button
                    onClick={() => handleNavigate('wizard-step1')}
                    className="w-full bg-primary text-white font-sans font-bold py-4 rounded-xl hover:opacity-95 transition-all shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer font-bold"
                  >
                    <span className="material-symbols-outlined text-base">person_add</span>
                    Create Your First Supplier | 添加供应商
                  </button>
                </div>
              </div>
            </div>
          );
        }

        const supplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];
        return (
          <NegotiationRoomScreen
            onNavigate={handleNavigate}
            supplier={supplier}
            onUpdateSupplier={handleUpdateSupplier}
            userData={userData}
          />
        );
      }
      case 'guanxi-meter':
        return <GuanxiMeterScreen onNavigate={handleNavigate} suppliers={suppliers} />;
      case 'message-history':
        return (
          <MessageHistoryScreen 
            onNavigate={handleNavigate} 
            suppliers={suppliers} 
            selectedSupplierId={selectedSupplierId} 
            notificationsEnabled={notificationsEnabled}
          />
        );
      case 'phrase-library':
        return <PhraseLibraryScreen onNavigate={handleNavigate} notificationsEnabled={notificationsEnabled} />;
      case 'cultural-guide':
        return <CulturalGuideScreen onNavigate={handleNavigate} notificationsEnabled={notificationsEnabled} />;
      case 'supplier-profile': {
        if (suppliers.length === 0) {
          return <DashboardEmpty onNavigate={handleNavigate} userData={userData} />;
        }
        const supplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];
        return <SupplierProfileScreen 
          onNavigate={handleNavigate} 
          supplier={supplier} 
          notificationsEnabled={notificationsEnabled}
          aiLang={userData.aiLang}
          onEditSupplier={(sup) => {
            setAddedSupplier(sup);
            handleNavigate('wizard-step1');
          }}
        />;
      }
      case 'settings':
        return (
          <SettingsScreen 
            onNavigate={handleNavigate} 
            userData={userData} 
            setUserData={setUserData} 
            suppliers={suppliers}
          />
        );

      case 'admin-users':
        return <AdminUsersScreen onNavigate={handleNavigate} />;

      default:
        return <LoginScreen onNavigate={handleNavigate} />;
    }
  };

  const hasStep2Data = !!userProfile?.businessName && userProfile.businessName.length >= 2;
  const hasStep3Data = !!userProfile?.aiLang && !!userProfile?.aiStyle;
  const hasFinishedOnboarding = onboardingFinishedLocally || 
    userProfile?.onboardingStatus === 'completed' || 
    (hasStep2Data && hasStep3Data) || 
    isAdmin;
  const isUserSuspended = !!userProfile?.isSuspended && !isAdmin;

  // Responsive Sidebar Wrapper for after-login states
  // STRICT RULE: Sidebars ONLY show if user is fully onboarded AND on a non-onboarding screen
  const showSidebar = !isUserSuspended && hasFinishedOnboarding && ![
    'login',
    'forgot-password',
    'verify-email',
    'register-step1',
    'register-step2',
    'register-step3',
    'onboarding-completed',
    'supplier-added',
    'wizard-step1',
    'wizard-step2',
    'wizard-step3'
  ].includes(currentScreen);

  return (
    <div className="flex min-h-screen bg-background text-on-surface font-body-rg selection:bg-primary-fixed bento-grid-bg">
      {showSidebar && (
        <aside className="hidden md:flex flex-col h-screen py-6 bg-white border-r border-border-light w-[260px] sticky top-0 shrink-0 z-50 shadow-sm">
          <motion.div 
            whileHover={{ scale: 1.02, x: 2 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 mb-10 flex items-center gap-4 cursor-pointer min-w-[200px]" 
            onClick={() => handleNavigate('dashboard-active')}
          >
            <img
              alt="YORA Logo"
              className="h-11 w-auto object-contain"
              src="https://i.ibb.co.com/k2c1SPn8/1.png"
            />
            <div className="flex flex-col justify-center">
              <span className="font-display-lg text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
              <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
            </div>
          </motion.div>
          <nav className="flex-1 space-y-1">
            <div
              onClick={() => handleNavigate('dashboard-active')}
              className={`flex items-center px-6 py-3 transition-all duration-200 cursor-pointer font-label-cn-bold text-label-cn-bold ${
                currentScreen === 'dashboard-active'
                  ? 'bg-on-primary-container text-primary border-l-4 border-primary'
                  : 'text-secondary hover:bg-surface-muted'
              }`}
            >
              <span className="material-symbols-outlined mr-3">dashboard</span>
              <span>Dashboard | 仪表板</span>
            </div>
            <div
              onClick={() => handleNavigate('supplier-list')}
              className={`flex items-center px-6 py-3 transition-all duration-200 cursor-pointer font-label-cn-bold text-label-cn-bold ${
                currentScreen === 'supplier-list'
                  ? 'bg-on-primary-container text-primary border-l-4 border-primary'
                  : 'text-secondary hover:bg-surface-muted'
              }`}
            >
              <span className="material-symbols-outlined mr-3">inventory_2</span>
              <span>My Suppliers | 我的供应商</span>
            </div>
            <div
              onClick={() => handleNavigate('negotiation-room')}
              className={`flex items-center px-6 py-3 transition-all duration-200 cursor-pointer font-label-cn-bold text-label-cn-bold ${
                currentScreen === 'negotiation-room'
                  ? 'bg-on-primary-container text-primary border-l-4 border-primary'
                  : 'text-secondary hover:bg-surface-muted'
              }`}
            >
              <span className="material-symbols-outlined mr-3">handshake</span>
              <span>Negotiation Room | 谈判室</span>
            </div>
            <div
              onClick={() => handleNavigate('guanxi-meter')}
              className={`flex items-center px-6 py-3 transition-all duration-200 cursor-pointer font-label-cn-bold text-label-cn-bold ${
                currentScreen === 'guanxi-meter'
                  ? 'bg-on-primary-container text-primary border-l-4 border-primary'
                  : 'text-secondary hover:bg-surface-muted'
              }`}
            >
              <span className="material-symbols-outlined mr-3">analytics</span>
              <span>Guanxi Meter | 关系表</span>
            </div>
            <div
              onClick={() => handleNavigate('message-history')}
              className={`flex items-center px-6 py-3 transition-all duration-200 cursor-pointer font-label-cn-bold text-label-cn-bold ${
                currentScreen === 'message-history'
                  ? 'bg-on-primary-container text-primary border-l-4 border-primary'
                  : 'text-secondary hover:bg-surface-muted'
              }`}
            >
              <span className="material-symbols-outlined mr-3">history</span>
              <span>Message History | 消息历史</span>
            </div>
            <div
              onClick={() => handleNavigate('phrase-library')}
              className={`flex items-center px-6 py-3 transition-all duration-200 cursor-pointer font-label-cn-bold text-label-cn-bold ${
                currentScreen === 'phrase-library'
                  ? 'bg-on-primary-container text-primary border-l-4 border-primary'
                  : 'text-secondary hover:bg-surface-muted'
              }`}
            >
              <span className="material-symbols-outlined mr-3">library_books</span>
              <span>Phrase Library | 短语库</span>
            </div>
            <div
              onClick={() => handleNavigate('cultural-guide')}
              className={`flex items-center px-6 py-3 transition-all duration-200 cursor-pointer font-label-cn-bold text-label-cn-bold ${
                currentScreen === 'cultural-guide'
                  ? 'bg-on-primary-container text-primary border-l-4 border-primary'
                  : 'text-secondary hover:bg-surface-muted'
              }`}
            >
              <span className="material-symbols-outlined mr-3">explore</span>
              <span>Cultural Guide | 文化指南</span>
            </div>
            <div
              onClick={() => handleNavigate('settings')}
              className={`flex items-center px-6 py-3 transition-all duration-200 cursor-pointer font-label-cn-bold text-label-cn-bold ${
                currentScreen === 'settings'
                  ? 'bg-on-primary-container text-primary border-l-4 border-primary'
                  : 'text-secondary hover:bg-surface-muted'
              }`}
            >
              <span className="material-symbols-outlined mr-3">settings</span>
              <span>Settings | 设置</span>
            </div>
            {isAdmin && (
              <div
                onClick={() => handleNavigate('admin-users')}
                className={`flex items-center px-6 py-3 transition-all duration-200 cursor-pointer font-label-cn-bold text-label-cn-bold ${
                  currentScreen === 'admin-users'
                    ? 'bg-on-primary-container text-primary border-l-4 border-primary'
                    : 'text-secondary hover:bg-surface-muted'
                }`}
                id="sidebar-admin-link"
              >
                <span className="material-symbols-outlined mr-3">admin_panel_settings</span>
                <span>Admin Console | 安全后台</span>
              </div>
            )}
          </nav>

          <div className="mt-auto px-6">
            <div className="p-4 bg-surface-muted rounded-[20px] flex items-center gap-3 border border-border-light/40 shadow-sm transition-all hover:bg-white hover:shadow-md cursor-pointer group" onClick={() => handleNavigate('settings')}>
              <div className="w-14 h-14 rounded-xl bg-white shadow-inner flex items-center justify-center overflow-hidden border border-border-light/50 group-hover:scale-105 transition-transform shrink-0">
                <img src="https://i.ibb.co.com/ZZ9rMnb/1.png" alt="Rui Mascot" className="w-12 h-12 object-contain p-0.5" />
              </div>
              <div className="flex flex-col">
                <p className="font-label-cn-bold text-label-cn-bold text-[12px] text-on-surface">Rui Advisor</p>
                <p className="text-[10px] text-subtitle-grey font-bold uppercase tracking-tight">AI Active</p>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Primary Workstation */}
      <div className={`flex-grow flex flex-col min-w-0 ${showSidebar ? 'pb-20 md:pb-0' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex-grow flex flex-col"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>

      {showSidebar && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border-light h-20 flex items-center justify-around z-50 md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.04)] px-2 pb-safe">
          {[
            { id: 'dashboard-active', label: 'Dashboard', cn: '仪表', icon: 'dashboard' },
            { id: 'supplier-list', label: 'Suppliers', cn: '供应商', icon: 'inventory_2' },
            { id: 'negotiation-room', label: 'Negotiate', cn: '谈判室', icon: 'handshake' },
            { id: 'guanxi-meter', label: 'Guanxi', cn: '关系', icon: 'analytics' },
            ...(isAdmin ? [{ id: 'admin-users', label: 'Admin', cn: '后台', icon: 'admin_panel_settings' }] : []),
            { id: 'settings', label: 'Settings', cn: '设置', icon: 'settings' }
          ].map((item) => {
            const isActive = currentScreen === item.id || 
              (item.id === 'negotiation-room' && currentScreen === 'negotiation-room');
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id as ScreenType)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1.5 text-center transition-all ${
                  isActive ? 'text-primary' : 'text-secondary/80'
                }`}
                id={`btn-bottom-nav-${item.id}`}
              >
                <span className="material-symbols-outlined !text-[22px] mb-0.5" style={{ fontVariationSettings: isActive ? "'FILL' 1" : undefined }}>
                  {item.icon}
                </span>
                <span className="text-[9px] font-bold tracking-tight leading-none mb-0.5">{item.label}</span>
                <span className="text-[7.5px] opacity-70 font-label-cn-rg leading-none">{item.cn}</span>
              </button>
            );
          })}
        </nav>
      )}

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />
    </div>
  );
}
