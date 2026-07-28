import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { useSupabase } from '../lib/SupabaseContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface AdminUsersProps {
  onNavigate: (screen: string) => void;
}

export function AdminUsersScreen({ onNavigate }: AdminUsersProps) {
  const { userProfile, user, session } = useSupabase();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [onboardingFilter, setOnboardingFilter] = useState('All'); // 'All' | 'Completed' | 'Incomplete'
  const [verificationFilter, setVerificationFilter] = useState('All'); // 'All' | 'Verified' | 'Unverified'
  
  // Selected User Detail Sidebar State (UID tracked for real-time Firestore synchronization)
  const [selectedUserUid, setSelectedUserUid] = useState<string | null>(null);
  const selectedUser = usersList.find((u) => u.uid === selectedUserUid) || null;

  // Manual Delete User confirmation state
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  useEffect(() => {
    setShowConfirmDelete(false);
  }, [selectedUserUid]);

  // Selected User's Real Onboarded Suppliers
  const [selectedUserSuppliers, setSelectedUserSuppliers] = useState<any[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  // Pre-fetched fallback suppliers from the Admin API
  const [apiSuppliers, setApiSuppliers] = useState<any[]>([]);

  // Dynamic Real-time Supplier Fetcher for Selected User
  useEffect(() => {
    if (!selectedUserUid) {
      setSelectedUserSuppliers([]);
      return;
    }

    setSuppliersLoading(true);
    const fetchSuppliers = async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('owner_id', selectedUserUid);
      
      if (error) {
        console.error("Failed to fetch user suppliers:", error);
        const backupList = apiSuppliers.filter(s => s.userId === selectedUserUid || s.ownerId === selectedUserUid);
        setSelectedUserSuppliers(backupList);
        setSuppliersLoading(false);
        return;
      }

      if (data) {
        const list = data.map(row => ({
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
        }));
        setSelectedUserSuppliers(list);
      }
      setSuppliersLoading(false);
    };

    fetchSuppliers();

    const channel = supabase.channel(`suppliers-${selectedUserUid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'suppliers',
          filter: `owner_id=eq.${selectedUserUid}`
        },
        () => {
          fetchSuppliers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUserUid, apiSuppliers]);
  
  // Profile Inline Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    businessName: '',
    businessType: '',
    originCity: '',
    province: '',
    aiLang: 'Bahasa Indonesia',
    aiStyle: 'balanced',
    aiTone: 'professional',
    aiDepth: 'standard',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Authenticate Admin access
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
  const isAdminUser = userProfile?.email === adminEmail;
  
  const authUsersRef = useRef<any[]>([]);
  const apiProfilesRef = useRef<Map<string, any>>(new Map());
  const fsProfilesRef = useRef<Map<string, any>>(new Map());

  // Real-time Firestore Users Sync + Auth User list Refresh
  useEffect(() => {
    if (!isAdminUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorStatus(null);

    const refreshMergedList = () => {
      const authUsers = authUsersRef.current;
      const apiProfiles = apiProfilesRef.current;
      const fsProfiles = fsProfilesRef.current;

      const mergedMap = new Map<string, UserProfile>();
      const emailToUid = new Map<string, string>();
      const lastProfiles = new Map<string, any>([...apiProfiles.entries(), ...fsProfiles.entries()]);

      // Step A: Process all Firestore Profiles first (real interactive user data)
      lastProfiles.forEach((profile: any, uid: string) => {
        const isStep2Done = !!(profile.businessName && profile.businessName.length > 1);
        const isStep3Done = !!(profile.aiLang && profile.aiStyle);
        const derivedOnboardingStatus = profile.onboardingStatus === 'completed' || (isStep2Done && isStep3Done)
          ? 'completed' 
          : (isStep2Done ? 'partial' : 'incomplete');

        const userRec: UserProfile = {
          uid: uid,
          fullName: profile.fullName || 'Unknown User',
          email: profile.email || 'No Email Found',
          businessName: profile.businessName || '',
          businessType: profile.businessType || '',
          province: profile.province || '',
          originCity: profile.originCity || '',
          aiLang: profile.aiLang || 'Bahasa Indonesia',
          aiStyle: profile.aiStyle || '',
          aiTone: profile.aiTone || '',
          aiDepth: profile.aiDepth || '',
          notificationsEnabled: !!profile.notificationsEnabled,
          emailDigestEnabled: !!profile.emailDigestEnabled,
          createdAt: profile.createdAt || profile.updatedAt,
          updatedAt: profile.updatedAt || profile.createdAt,
          onboardingStatus: derivedOnboardingStatus,
          emailVerified: !!profile.emailVerified,
          isSuspended: !!profile.isSuspended,
        };

        mergedMap.set(uid, userRec);
        if (profile.email) {
          emailToUid.set(profile.email.toLowerCase().trim(), uid);
        }
      });

      // Step B: Merge auth users from API to enrich metadata or add non-onboarded signups
      authUsers.forEach((authU: any) => {
        const uid = authU.uid;
        const authEmail = (authU.email || '').toLowerCase().trim();
        const isGoogleUser = authU.providerData?.some((p: any) => p.providerId === 'google.com');
        const defaultName = isGoogleUser ? (authU.displayName || authU.email?.split('@')[0] || 'Google User') : 'New User';

        // 1. Primary Match: Match by UID representation
        let existing = mergedMap.get(uid);

        // 2. Secondary Match Fallback: Match by email if UID didn't match but email is present
        if (!existing && authEmail && emailToUid.has(authEmail)) {
          const matchedUid = emailToUid.get(authEmail)!;
          existing = mergedMap.get(matchedUid);
          if (existing) {
            // Unify keys to match Auth's actual UID
            mergedMap.delete(matchedUid);
            existing.uid = uid;
            mergedMap.set(uid, existing);
          }
        }

        if (existing) {
          // Enrich with missing attributes
          if ((existing.fullName === 'Unknown (FS Only)' || existing.fullName === 'Unknown User') && authU.displayName) {
            existing.fullName = authU.displayName;
          } else if ((existing.fullName === 'Unknown (FS Only)' || existing.fullName === 'Unknown User') && defaultName !== 'New User') {
            existing.fullName = defaultName;
          }
          if (existing.email === 'No Email Found' && authU.email) {
            existing.email = authU.email;
          }
          if (authU.metadata?.creationTime) {
            existing.createdAt = existing.createdAt || authU.metadata.creationTime;
          }
          if (authU.metadata?.lastSignInTime) {
            existing.updatedAt = existing.updatedAt || authU.metadata.lastSignInTime;
          }
          existing.emailVerified = existing.emailVerified || authU.emailVerified;
          existing.isSuspended = existing.isSuspended || authU.disabled;
        } else {
          // Auth user has no Firestore profile yet, add them as incomplete shell
          const userRec: UserProfile = {
            uid: uid,
            fullName: authU.displayName || defaultName,
            email: authU.email || 'No Registered Email / 无邮箱',
            businessName: '',
            businessType: '',
            province: '',
            originCity: '',
            aiLang: '',
            aiStyle: '',
            aiTone: '',
            aiDepth: '',
            notificationsEnabled: false,
            emailDigestEnabled: false,
            createdAt: authU.metadata?.creationTime,
            updatedAt: authU.metadata?.lastSignInTime,
            onboardingStatus: 'incomplete',
            emailVerified: authU.emailVerified,
            isSuspended: authU.disabled,
          };
          mergedMap.set(uid, userRec);
        }
      });

      const mergedList = Array.from(mergedMap.values());

      // Sort by creation time descending (newest first)
      mergedList.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setUsersList(mergedList);
      setLoading(false);
    };

    const fetchAuthUsers = async () => {
      try {
        const idToken = session?.access_token;
        const response = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        }).then(res => {
          if (!res.ok) throw new Error("API Failure: " + res.status);
          return res.json();
        });
        
        if (response.apiDisabled) {
          console.warn("Identity Toolkit API is disabled. Some auth metadata might be missing.");
        }
        
        authUsersRef.current = response.users || [];
        
        if (response.profiles && Array.isArray(response.profiles)) {
          const map = new Map<string, any>();
          response.profiles.forEach((p: any) => {
            if (p.uid) {
              map.set(p.uid, p);
            }
          });
          apiProfilesRef.current = map;
        }
        
        if (response.suppliers && Array.isArray(response.suppliers)) {
          setApiSuppliers(response.suppliers);
        }

        refreshMergedList();
      } catch (e: any) {
        console.error("Auth fetch failed:", e);
        setErrorStatus("Auth Fetch Error: " + e.message);
        setLoading(false);
      }
    };

    fetchAuthUsers();

    const fetchUsers = async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) {
        console.error("Error fetching profiles:", error);
        setErrorStatus("Sync exception: " + error.message);
        setLoading(false);
        return;
      }
      if (data) {
        fsProfilesRef.current = new Map(data.map(p => [p.id, {
          fullName: p.full_name,
          email: p.email,
          businessName: p.business_name,
          businessType: p.business_type,
          province: p.province,
          originCity: p.origin_city,
          aiLang: p.ai_lang,
          aiStyle: p.ai_style,
          aiTone: p.ai_tone,
          aiDepth: p.ai_depth,
          notificationsEnabled: p.notifications_enabled,
          emailDigestEnabled: p.email_digest_enabled,
          emailVerified: p.email_verified,
          isSuspended: p.is_suspended,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }]));
        refreshMergedList();
      }
    };

    fetchUsers();

    const channel = supabase.channel('profiles-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdminUser]);

  // Sync edit form state on selecting user
  useEffect(() => {
    if (selectedUser) {
      setEditForm({
        fullName: selectedUser.fullName || '',
        businessName: selectedUser.businessName || '',
        businessType: selectedUser.businessType || '',
        originCity: selectedUser.originCity || '',
        province: selectedUser.province || '',
        aiLang: selectedUser.aiLang || 'Bahasa Indonesia',
        aiStyle: selectedUser.aiStyle || 'balanced',
        aiTone: selectedUser.aiTone || 'professional',
        aiDepth: selectedUser.aiDepth || 'standard',
      });
      setIsEditing(false);
    }
  }, [selectedUser]);

  // Dynamic Metrics calculations
  const totalCount = usersList.length;

  const completedCount = usersList.filter(
    (u) => u.onboardingStatus === 'completed' || 
    (!!u.businessName && u.businessName.length > 1 && !!u.aiStyle)
  ).length;

  const incompleteCount = totalCount - completedCount;

  const verifiedCount = usersList.filter(
    (u) => u.emailVerified || u.email === 'visitor@yora.com'
  ).length;

  // Extract unique business types for filters
  const sectors = ['All', ...Array.from(new Set(usersList.map(u => u.businessType).filter(Boolean)))];

  // Filtering users array
  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.businessName && u.businessName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.originCity && u.originCity.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSector = sectorFilter === 'All' || u.businessType === sectorFilter;

    const isCompleted = u.onboardingStatus === 'completed';
    const isPartial = u.onboardingStatus === 'partial';

    const matchesOnboarding =
      onboardingFilter === 'All' ||
      (onboardingFilter === 'Completed' && isCompleted) ||
      (onboardingFilter === 'Incomplete' && (u.onboardingStatus === 'incomplete' || isPartial));

    const isVerified = u.emailVerified || u.email === 'visitor@yora.com';
    const matchesVerification =
      verificationFilter === 'All' ||
      (verificationFilter === 'Verified' && isVerified) ||
      (verificationFilter === 'Unverified' && !isVerified);

    return matchesSearch && matchesSector && matchesOnboarding && matchesVerification;
  });

  // Suspend Toggle Action
  const handleToggleSuspend = async (usr: UserProfile) => {
    try {
      const targetState = !usr.isSuspended;
      const { error } = await supabase.from('profiles').update({ is_suspended: targetState }).eq('id', usr.uid);
      if (error) throw error;
    } catch (e) {
      console.error("Failed to toggle suspension:", e);
    }
  };

  // Manual Verify Email Action
  const handleManualVerify = async (usr: UserProfile) => {
    try {
      const { error } = await supabase.from('profiles').update({ email_verified: true }).eq('id', usr.uid);
      if (error) throw error;
    } catch (e) {
      console.error("Failed to manually verify email:", e);
    }
  };

  // Delete User Action
  const handleDeleteUser = async (usr: UserProfile) => {
    if (usr.uid === userProfile?.uid) {
      alert("You cannot delete your own admin profile while logged in.");
      return;
    }
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', usr.uid);
      if (error) throw error;
      setSelectedUserUid(null);
      setShowConfirmDelete(false);
      setUserToDelete(null); // Fix: also clear userToDelete
      setIsEditing(false);
    } catch (e) {
      console.error("Failed to delete user document:", e);
    }
  };

  // Inline Editorial Form Save Action
  const handleSaveProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsSavingEdit(true);
    try {
      // Mark as completed if the admin manually writes business details
      const resolvedOnboardingStatus = 
        editForm.businessName && editForm.businessName.length > 1
          ? 'completed'
          : selectedUser.onboardingStatus;

      const updatePayload = {
        full_name: editForm.fullName,
        business_name: editForm.businessName,
        business_type: editForm.businessType,
        origin_city: editForm.originCity,
        province: editForm.province,
        ai_lang: editForm.aiLang,
        ai_style: editForm.aiStyle,
        ai_tone: editForm.aiTone,
        ai_depth: editForm.aiDepth,
        onboarding_status: resolvedOnboardingStatus,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('profiles').update(updatePayload).eq('id', selectedUser.uid);
      if (error) throw error;
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save profile edit:", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="font-body-rg text-on-surface bg-background flex flex-col min-h-screen relative overflow-x-hidden select-none">
      {/* Top Header Section */}
      <header className="sticky top-0 bg-white border-b border-border-light min-h-[4rem] py-3 w-full px-4 sm:px-6 md:px-8 z-40 flex flex-col md:flex-row justify-between items-center gap-3 shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-1/3">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search users... / 搜索用户..."
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-border-light rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end w-full md:w-auto gap-4">
          <button
            onClick={() => onNavigate('dashboard-active')}
            className="bg-primary text-white px-5 py-2 rounded-lg font-bold hover:bg-surface-tint hover:bg-opacity-95 active:scale-95 transition-all flex items-center gap-2 text-xs uppercase tracking-wider justify-center"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Return to App</span>
          </button>
        </div>
      </header>

      {/* Access Guard Area */}
      {!isAdminUser ? (
        <main className="flex-grow flex items-center justify-center p-8">
          <div className="bg-white border border-border-light p-10 rounded-[24px] text-center max-w-md w-full shadow-lg">
            <span className="material-symbols-outlined !text-6xl text-primary mb-4">gpp_bad</span>
            <h2 className="font-headline-md font-bold text-on-surface mb-2">Access Denied</h2>
            <p className="text-sm text-secondary mb-6 leading-relaxed">
              Your account (<strong>{userProfile?.email || 'Guest'}</strong>) is not authorized to access the system back-office directory logs.
            </p>
            <button
              onClick={() => onNavigate('dashboard-active')}
              className="w-full py-3 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-surface-tint active:scale-95 transition-all text-xs uppercase"
            >
              Return Home
            </button>
          </div>
        </main>
      ) : (
        <main className="flex-1 p-6 md:p-8 min-h-screen relative">
          <div
            className={`max-w-7xl mx-auto transition-all duration-500 ease-in-out ${
              selectedUser ? 'lg:pr-[470px]' : 'pr-0'
            }`}
          >
            {/* Page Header Title */}
            <div className="mb-8">
              <h1 className="text-headline-md font-headline-md text-on-surface flex items-center gap-2">
                User Directory 
                <span className="text-secondary font-normal text-sm font-label-cn-rg">/ 系统用户与问卷管理</span>
              </h1>
              <p className="text-secondary mt-1 text-sm">
                Analyze registered businesses, filter completed setups, and manage customer accounts directly of YORA workspace.
              </p>
            </div>

            {/* Metrics Row (Subtle & Numeric) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 border border-border-light rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-secondary text-xs uppercase font-semibold">Total Accounts</span>
                  <span className="material-symbols-outlined text-primary text-lg">person</span>
                </div>
                <div className="text-2xl font-bold font-mono text-on-surface">{totalCount}</div>
                <div className="text-[10px] text-secondary mt-1 flex items-center gap-1 font-mono">
                  <span>Logged in to system</span>
                </div>
              </div>

              <div className="bg-white p-6 border border-border-light rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-secondary text-xs uppercase font-semibold">Onboarded (Filled)</span>
                  <span className="material-symbols-outlined text-primary text-lg">business</span>
                </div>
                <div className="text-2xl font-bold font-mono text-on-surface">{completedCount}</div>
                <div className="text-[10px] text-green-600 mt-1 flex items-center gap-1 font-mono">
                  <span>Questions completed</span>
                </div>
              </div>

              <div className="bg-white p-6 border border-border-light rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-secondary text-xs uppercase font-semibold">Incomplete Profile</span>
                  <span className="material-symbols-outlined text-primary text-lg">cancel</span>
                </div>
                <div className="text-2xl font-bold font-mono text-charcoal">{incompleteCount}</div>
                <div className="text-[10px] text-orange-500 mt-1 flex items-center gap-1 font-mono">
                  <span>Haven't answered questions</span>
                </div>
              </div>

              <div className="bg-white p-6 border border-border-light rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-secondary text-xs uppercase font-semibold">Email Verified</span>
                  <span className="material-symbols-outlined text-primary text-lg">verified</span>
                </div>
                <div className="text-2xl font-bold font-mono text-on-surface">{verifiedCount}</div>
                <div className="text-[10px] text-secondary mt-1 flex items-center gap-1 font-mono">
                  <span>Verified Auth emails</span>
                </div>
              </div>
            </div>

            {/* Multi-Dimensional Filter Controller Bar */}
            <div className="bg-white border border-border-light rounded-xl p-5 shadow-sm mb-6 space-y-4">
              <div className="flex flex-wrap items-center gap-6 justify-between">
                {/* Sector Tabs */}
                <div className="flex gap-2 items-center overflow-x-auto pb-1 scrollbar-hide">
                  <span className="text-xs font-bold text-secondary uppercase tracking-wider mr-2">Sector:</span>
                  {['All', 'Importir / 进口商', 'Distributor / 分销商', 'Manufacturer / 制造', 'UMKM / 中小微企业', 'Others / 其他'].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setSectorFilter(sec)}
                      className={`px-4 py-1.5 border rounded-full text-[11px] font-bold cursor-pointer transition-all duration-200 ${
                        sectorFilter === sec 
                          ? 'bg-charcoal text-white border-charcoal shadow-md scale-[1.02]' 
                          : 'bg-white border-border-light text-secondary hover:text-primary hover:border-primary'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-secondary text-[20px]">filter_list</span>
                </div>
              </div>

              {/* Status specific filtering row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border-light/40">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-secondary uppercase tracking-wider">Onboarding:</span>
                  <div className="flex bg-surface-container-low border border-border-light rounded-lg p-0.5 w-full">
                    <button
                      onClick={() => setOnboardingFilter('All')}
                      className={`flex-1 text-center py-1 text-xs rounded-md transition-colors font-medium cursor-pointer ${onboardingFilter === 'All' ? 'bg-white shadow-sm text-on-surface' : 'text-secondary hover:text-charcoal'}`}
                    >
                      All / 全部
                    </button>
                    <button
                      onClick={() => setOnboardingFilter('Completed')}
                      className={`flex-1 text-center py-1 text-xs rounded-md transition-colors font-medium cursor-pointer ${onboardingFilter === 'Completed' ? 'bg-white shadow-sm text-green-700' : 'text-secondary hover:text-charcoal'}`}
                    >
                      Completed / 完整
                    </button>
                    <button
                      onClick={() => setOnboardingFilter('Incomplete')}
                      className={`flex-1 text-center py-1 text-xs rounded-md transition-colors font-medium cursor-pointer ${onboardingFilter === 'Incomplete' ? 'bg-white shadow-sm text-orange-700' : 'text-secondary hover:text-charcoal'}`}
                    >
                      Incomplete / 未填
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-secondary uppercase tracking-wider">Email Verified:</span>
                  <div className="flex bg-surface-container-low border border-border-light rounded-lg p-0.5 w-full">
                    <button
                      onClick={() => setVerificationFilter('All')}
                      className={`flex-1 text-center py-1 text-xs rounded-md transition-colors font-medium cursor-pointer ${verificationFilter === 'All' ? 'bg-white shadow-sm text-on-surface' : 'text-secondary hover:text-charcoal'}`}
                    >
                      All / 全部
                    </button>
                    <button
                      onClick={() => setVerificationFilter('Verified')}
                      className={`flex-1 text-center py-1 text-xs rounded-md transition-colors font-medium cursor-pointer ${verificationFilter === 'Verified' ? 'bg-white shadow-sm text-primary' : 'text-secondary hover:text-charcoal'}`}
                    >
                      Verified / 已验证
                    </button>
                    <button
                      onClick={() => setVerificationFilter('Unverified')}
                      className={`flex-1 text-center py-1 text-xs rounded-md transition-colors font-medium cursor-pointer ${verificationFilter === 'Unverified' ? 'bg-white shadow-sm text-secondary' : 'text-secondary hover:text-charcoal'}`}
                    >
                      Unverified / 未验证
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Interactive Table Grid Layout */}
            <div className="bg-white border border-border-light rounded-xl shadow-sm overflow-hidden min-h-[400px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-bold text-secondary uppercase tracking-widest animate-pulse">Syncing platform directories...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-20">
                  <span className="material-symbols-outlined !text-5xl text-secondary mb-4 opacity-50">search_off</span>
                  <h3 className="font-bold text-on-surface mb-1">No Matching Users found</h3>
                  <p className="text-xs text-secondary max-w-sm mx-auto">Try adjusting your keyword filter tabs, search terms, or onboarding filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-surface-container-low text-secondary border-b border-border-light text-xs font-semibold uppercase tracking-wider">
                        <th className="px-6 py-4 w-1/3">Full Name / 全名</th>
                        <th className="px-6 py-4">Account Status / 邮箱状态</th>
                        <th className="px-6 py-4">Business / 企业</th>
                        <th className="px-6 py-4">Origin / 城市</th>
                        <th className="px-6 py-4 text-center">Settings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light/60">
                      {filteredUsers.map((usr) => {
                        const isSetupCompleted = usr.onboardingStatus === 'completed' || 
  (!!usr.businessName && usr.businessName.length > 1 && !!usr.aiStyle);
                        const isUserVerified = usr.emailVerified || usr.email === 'visitor@yora.com';
                        
                        const displayName = usr.fullName || usr.businessName || usr.email.split('@')[0] || 'Unknown User';
                        
                        return (
                          <tr
                            key={usr.uid}
                            onClick={() => setSelectedUserUid(usr.uid)}
                            className={`group hover:bg-surface-muted transition-all duration-150 cursor-pointer text-sm ${
                              selectedUser?.uid === usr.uid ? 'bg-surface-muted' : ''
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                                  <span className="material-symbols-outlined text-slate-400 text-lg">person</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-on-surface flex items-center gap-1.5">
                                    {displayName}
                                    {usr.isSuspended && (
                                      <span className="bg-primary text-white text-[9px] px-1.5 py-0.5 rounded-sm font-bold scale-90 uppercase">
                                        Suspended
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs text-secondary tracking-tight font-medium">
                                    {usr.email}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1.5">
                                {/* Email Verification Link Status */}
                                <div className="flex items-center gap-1.5">
                                  {isUserVerified ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold border border-slate-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                      Email Verified
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                      No Verification Link
                                    </span>
                                  )}
                                </div>

                                {/* Onboarding questionnaire answers completion */}
                                <div className="flex items-center gap-1.5">
                                  {usr.onboardingStatus === 'completed' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 text-[10px] font-bold border border-stone-200">
                                      Setup Finished (100%)
                                    </span>
                                  ) : usr.onboardingStatus === 'partial' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200/55">
                                      Setup in Progress (Step 2 Done)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200/55">
                                      No Onboarding Answers / 未填写
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4 font-medium">
                              <div className="flex flex-col">
                                <span className={isSetupCompleted ? 'font-bold text-on-surface' : 'text-secondary italic'}>
                                  {isSetupCompleted ? usr.businessName : '— No Info —'}
                                </span>
                                {isSetupCompleted && usr.businessType && (
                                  <span className="text-xs text-secondary mt-0.5">
                                    {usr.businessType}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-6 py-4 text-xs font-semibold text-secondary">
                              {isSetupCompleted && usr.originCity ? (
                                <span>{usr.originCity} {usr.province && `, ${usr.province}`}</span>
                              ) : (
                                <span className="italic font-normal">— empty —</span>
                              )}
                            </td>

                            <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setUserToDelete(usr)}
                                className="text-stone-400 hover:text-red-600 transition-colors p-1.5 hover:bg-red-50 rounded-full"
                                title="Delete User Account / 删除用户账号"
                              >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="p-6 bg-white border-t border-border-light flex justify-between items-center text-xs text-secondary">
                    <span>
                      Showing {filteredUsers.length} of {totalCount} users / 显示 {filteredUsers.length} 名用户
                    </span>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 border border-border-light rounded hover:bg-surface-muted transition-colors">
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      <button className="px-3 py-1 border border-border-light rounded hover:bg-surface-muted transition-colors">
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details slide drawer (Pure white minimal markup matching HTML exactly) */}
          <AnimatePresence>
            {selectedUser && (
              <>
                {/* Responsive Backdrop overlay on mobile */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    setSelectedUserUid(null);
                    setIsEditing(false);
                  }}
                  className="fixed inset-0 bg-black z-20 sm:hidden"
                />
                
                <motion.aside
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 180 }}
                  className="fixed top-16 right-0 bottom-20 md:bottom-0 w-full sm:w-[450px] bg-white border-l border-border-light shadow-2xl z-30 overflow-y-auto flex flex-col"
                >
                {/* Drawer Header Sticky navigation */}
                <div className="sticky top-0 bg-white z-10 p-6 border-b border-border-light flex justify-between items-center">
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-on-surface">User Details Summary</h3>
                    <span className="text-xs text-secondary font-semibold uppercase tracking-wider">用户与问卷详情</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUserUid(null);
                      setIsEditing(false);
                    }}
                    className="p-1.5 hover:bg-surface-muted rounded-full transition-colors cursor-pointer text-secondary hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="p-6 md:p-8 flex-1 space-y-8 pb-32">
                  {/* Identity Header */}
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-3">
                        <div className="w-20 h-20 rounded-full bg-slate-50 border-2 border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                          <span className="material-symbols-outlined text-slate-400 text-3xl">person</span>
                        </div>
                        <span
                          className={`absolute bottom-0 right-1 w-4 h-4 border-2 border-white rounded-full ${
                            selectedUser.emailVerified || selectedUser.email === 'visitor@yora.com' ? 'bg-primary' : 'bg-slate-400'
                          }`}
                        ></span>
                      </div>

                      <h4 className="text-xl font-bold text-on-surface leading-tight">
                        {selectedUser.fullName || selectedUser.email.split('@')[0] || 'Unknown User'}
                      </h4>
                      <p className="text-sm text-secondary font-mono mt-0.5">{selectedUser.email}</p>

                      <div className="mt-4 flex gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${selectedUser.emailVerified || selectedUser.email === 'visitor@yora.com' ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                          {selectedUser.emailVerified || selectedUser.email === 'visitor@yora.com' ? 'SECURE VERIFIED' : 'UNVERIFIED EMAIL'}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${selectedUser.onboardingStatus === 'completed' || (selectedUser.businessName && selectedUser.businessName.length > 1 && !!selectedUser.aiStyle) ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                          {selectedUser.onboardingStatus === 'completed' || (selectedUser.businessName && selectedUser.businessName.length > 1 && !!selectedUser.aiStyle) ? 'ONBOARDED (FINISHED)' : 'INCOMPLETE PROFILE'}
                        </span>
                      </div>
                    </div>

                  {isEditing ? (
                    /* Inline Update Form edit mode */
                    <form onSubmit={handleSaveProfileEdit} className="space-y-4">
                      <h5 className="font-bold text-xs uppercase text-primary tracking-widest border-b border-border-light pb-1">Edit Operations</h5>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-secondary uppercase mb-1">Full Name</label>
                          <input
                            type="text"
                            required
                            className="w-full text-xs p-2.5 border border-border-light rounded bg-surface-bright focus:outline-none focus:ring-1 focus:ring-primary"
                            value={editForm.fullName}
                            onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-secondary uppercase mb-1">Business / Company Name</label>
                          <input
                            type="text"
                            className="w-full text-xs p-2.5 border border-border-light rounded bg-surface-bright focus:outline-none focus:ring-1 focus:ring-primary"
                            value={editForm.businessName}
                            onChange={(e) => setEditForm({...editForm, businessName: e.target.value})}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-secondary uppercase mb-1">Business Type / Sector</label>
                          <select
                            className="w-full text-xs p-2.5 border border-border-light rounded bg-surface-bright focus:outline-none focus:ring-1 focus:ring-primary"
                            value={editForm.businessType}
                            onChange={(e) => setEditForm({...editForm, businessType: e.target.value})}
                          >
                            <option value="">Choose Sector...</option>
                            <option value="Importir / 进口商">Importir / 进口商</option>
                            <option value="Distributor / 分销商">Distributor / 分销商</option>
                            <option value="Manufacturer / 制造">Manufacturer / 制造</option>
                            <option value="UMKM / 中小微企业">UMKM / 中小微企业</option>
                            <option value="Others / 其他">Others / 其他</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-secondary uppercase mb-1">City</label>
                            <input
                              type="text"
                              className="w-full text-xs p-2.5 border border-border-light rounded bg-surface-bright focus:outline-none focus:ring-1 focus:ring-primary"
                              value={editForm.originCity}
                              onChange={(e) => setEditForm({...editForm, originCity: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-secondary uppercase mb-1">Province</label>
                            <input
                              type="text"
                              className="w-full text-xs p-2.5 border border-border-light rounded bg-surface-bright focus:outline-none focus:ring-1 focus:ring-primary"
                              value={editForm.province}
                              onChange={(e) => setEditForm({...editForm, province: e.target.value})}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-secondary uppercase mb-1">Primary Language</label>
                          <select
                            className="w-full text-xs p-2.5 border border-border-light rounded bg-surface-bright focus:outline-none focus:ring-1 focus:ring-primary"
                            value={editForm.aiLang}
                            onChange={(e) => setEditForm({...editForm, aiLang: e.target.value})}
                          >
                            <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                            <option value="English">English</option>
                            <option value="中文 (简体)">中文 (简体)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="flex-1 py-2.5 border border-border-light rounded font-bold text-xs hover:bg-surface-muted transition-colors uppercase cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingEdit}
                          className="flex-1 py-2.5 bg-primary text-white rounded font-bold text-xs hover:bg-opacity-90 transition-colors uppercase flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {isSavingEdit ? 'Saving...' : 'Save Updates'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Display read-only stats & metadata fields from HTML exactly */
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-y-4 gap-x-3 text-xs border-b border-border-light/40 pb-6">
                        <div>
                          <span className="block text-[10px] font-bold text-primary uppercase mb-1">Business Name / 企业</span>
                          <span className={`font-bold text-sm break-words ${selectedUser.businessName ? 'text-on-surface' : 'text-stone-400 italic'}`}>
                            {selectedUser.businessName || 'Step 2 Unanswered'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-primary uppercase mb-1">Business Type / 类型</span>
                          <span className={`font-bold text-sm ${selectedUser.businessType ? 'text-on-surface' : 'text-stone-400 italic'}`}>
                            {selectedUser.businessType || 'Step 2 Unanswered'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-primary uppercase mb-1">Origin City / 城市</span>
                          <span className={`font-bold text-sm ${selectedUser.originCity ? 'text-on-surface' : 'text-stone-400 italic'}`}>
                            {selectedUser.originCity || 'Step 2 Unanswered'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-primary uppercase mb-1">Response Style / 策略</span>
                          <span className={`font-bold text-sm capitalize ${selectedUser.aiStyle ? 'text-on-surface' : 'text-stone-400 italic'}`}>
                            {selectedUser.aiStyle || 'Step 3 Unanswered'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-4 gap-x-3 text-xs border-b border-border-light/40 pb-6">
                        <div>
                          <span className="block text-[10px] font-bold text-secondary uppercase mb-1">AI Language / 语言</span>
                          <span className={`font-bold text-on-surface ${selectedUser.aiLang ? '' : 'text-stone-400 italic'}`}>
                            {selectedUser.aiLang || 'Not Selected'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-secondary uppercase mb-1">Strategy Depth / 深度</span>
                          <span className={`font-bold text-on-surface capitalize ${selectedUser.aiDepth ? '' : 'text-stone-400 italic'}`}>
                            {selectedUser.aiDepth || 'Not Selected'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-secondary uppercase mb-1">Comm. Tone / 语气</span>
                          <span className={`font-bold text-on-surface capitalize ${selectedUser.aiTone ? '' : 'text-stone-400 italic'}`}>
                            {selectedUser.aiTone || 'Not Selected'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold text-secondary uppercase mb-1">Onboarding Status</span>
                          <div className="mt-1">
                            {selectedUser.onboardingStatus === 'completed' ? (
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">COMPLETED</span>
                            ) : selectedUser.onboardingStatus === 'partial' ? (
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">STEP 2 DONE</span>
                            ) : (
                              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">INCOMPLETE</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Display Location Detail */}
                      <div className="grid grid-cols-1 gap-y-4 text-xs border-b border-border-light/40 pb-6">
                        <div>
                          <span className="block text-[10px] font-bold text-primary uppercase mb-1">Full Logistics Location / 地区</span>
                          <span className="font-semibold text-on-surface text-sm">
                            {selectedUser.originCity && selectedUser.province ? `${selectedUser.originCity}, ${selectedUser.province}` : (selectedUser.originCity || selectedUser.province || '— Not Set —')}
                          </span>
                        </div>
                      </div>

                      {/* Onboarding Calibrations inside minimalist container */}
                      <div className="p-4 bg-surface-muted rounded-lg border border-border-light relative overflow-hidden text-xs">
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-primary"></div>
                        <span className="block text-[10px] font-bold text-primary uppercase mb-2">Strategic Preferences / 战略设定</span>
                        <div className="space-y-2 mt-2">
                          <div className="flex justify-between">
                            <span className="text-secondary font-medium">Negotiation Style:</span>
                            <span className={`font-bold text-on-surface capitalize ${selectedUser.aiStyle ? '' : 'text-stone-400 italic'}`}>{selectedUser.aiStyle || 'Not Selected'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-secondary font-medium">Assistant Tone:</span>
                            <span className={`font-bold text-on-surface capitalize ${selectedUser.aiTone ? '' : 'text-stone-400 italic'}`}>{selectedUser.aiTone || 'Not Selected'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-secondary font-medium">Strategic Depth:</span>
                            <span className={`font-bold text-on-surface capitalize ${selectedUser.aiDepth ? '' : 'text-stone-400 italic'}`}>{selectedUser.aiDepth || 'Not Selected'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Manual Action Tools for the Owner (Saves huge help overhead) */}
                      <div className="pt-4 border-t border-border-light/50 space-y-3">
                        <span className="block text-[10px] font-bold text-secondary uppercase tracking-wider">Verification Controls</span>
                        <div className="flex flex-wrap gap-2">
                          {!(selectedUser.emailVerified || selectedUser.email === 'visitor@yora.com') && (
                            <button
                              onClick={() => handleManualVerify(selectedUser)}
                              className="px-3 py-1.5 bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 rounded text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Manually Verify Email
                            </button>
                          )}
                          <button
                            onClick={() => setIsEditing(true)}
                            className="px-3 py-1.5 bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 rounded text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Update Profil / 填表修正
                          </button>
                        </div>
                      </div>

                      {/* Real-time Subcollection Onboarded Suppliers */}
                      <div className="pt-6 border-t border-border-light/50 space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-secondary uppercase tracking-wider">Onboarded Suppliers / 供应商</label>
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-mono font-bold rounded-full">
                            {selectedUserSuppliers.length} Total
                          </span>
                        </div>

                        {suppliersLoading ? (
                          <div className="flex justify-center items-center py-4">
                            <div className="w-5 h-5 border border-primary border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : selectedUserSuppliers.length === 0 ? (
                          <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                            <span className="material-symbols-outlined text-slate-300 text-2xl mb-1">inventory_2</span>
                            <p className="text-[11px] text-slate-400 font-medium">No suppliers registered yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                            {selectedUserSuppliers.map((sup) => (
                              <div
                                key={sup.id}
                                className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg hover:border-slate-300 transition-colors"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="font-bold text-xs text-slate-800 truncate">
                                    {sup.chineseName || sup.englishName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-medium font-mono mt-0.5">
                                    Guanxi: <span className="font-bold text-primary">{sup.guanxiScore ?? 0}</span>
                                  </div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 text-[9px] font-bold rounded-full border uppercase shrink-0 ${
                                    sup.status === 'completed' || sup.status === 'Active'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : sup.status === 'Negotiating'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-stone-50 text-stone-600 border-stone-200'
                                  }`}
                                >
                                  {sup.status || 'Active'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Operational Suspend Drawer Actions */}
                  {!isEditing && (
                    <div className="pt-6 border-t border-border-light/40 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => handleToggleSuspend(selectedUser)}
                          className={`py-3 border rounded-lg font-bold text-xs cursor-pointer hover:bg-surface-muted transition-colors flex items-center justify-center gap-1.5 uppercase ${
                            selectedUser.isSuspended ? 'bg-primary text-white border-primary' : 'border-border-light text-on-surface'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {selectedUser.isSuspended ? 'check_circle' : 'block'}
                          </span>
                          {selectedUser.isSuspended ? 'Reactivate' : 'Suspend'}
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUserUid(null);
                            setIsEditing(false);
                          }}
                          className="py-3 bg-primary text-white hover:bg-opacity-95 active:scale-95 transition-all text-xs font-bold rounded-lg uppercase flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">done</span>
                          Close Panel
                        </button>
                      </div>

                      {/* Destructive Delete Area */}
                      {!showConfirmDelete ? (
                        <button
                          onClick={() => setShowConfirmDelete(true)}
                          className="w-full py-3 bg-[#b5000b] text-white hover:bg-[#900008] active:scale-[0.98] transition-all text-xs font-bold rounded-lg uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                          Delete User: {selectedUser.fullName || 'No Name'}
                        </button>
                      ) : (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3 text-left">
                          <div className="text-xs text-red-800 font-bold uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            Confirm Permanent Deletion
                          </div>
                          <div className="text-xs text-slate-700 leading-relaxed">
                            Are you sure you want to delete user <strong className="text-slate-900">{selectedUser.fullName || 'No Name'}</strong> with email <strong className="text-slate-900">{selectedUser.email}</strong>? All their data will be removed.
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setShowConfirmDelete(false)}
                              className="py-2 border border-slate-300 text-slate-700 font-semibold text-[11px] rounded bg-white hover:bg-slate-50 transition-colors uppercase cursor-pointer text-center"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(selectedUser)}
                              className="py-2 bg-[#b5000b] text-white font-bold text-[11px] rounded hover:bg-[#900008] transition-all uppercase cursor-pointer text-center"
                            >
                              Yes, Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* Global User Deletion Modal Confirmation */}
          <AnimatePresence>
            {userToDelete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                onClick={() => setUserToDelete(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 15 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="bg-white border border-border-light rounded-[24px] max-w-md w-full p-6 md:p-8 shadow-2xl relative overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#b5000b]" />
                  
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
                      <span className="material-symbols-outlined text-red-600">gpp_maybe</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-on-surface">Delete Account Permanently</h3>
                      <p className="text-xs text-secondary font-semibold uppercase tracking-wider">永久删除账户</p>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                    <p>
                      Are you sure you want to delete this user profile? All registered data, questionnaires, and conversation history will be permanently destroyed.
                    </p>
                    <div className="border-t border-slate-200/60 pt-3 space-y-2">
                      <div>
                        <span className="block text-[10px] font-bold text-[#b5000b] uppercase tracking-wider">Full Name / 全名</span>
                        <span className="font-bold text-slate-900 text-sm">{userToDelete.fullName}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#b5000b] uppercase tracking-wider">Email Address / 邮箱地址</span>
                        <span className="font-mono font-medium text-slate-800 text-sm break-all">{userToDelete.email}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wide">ID / 用户识别码</span>
                        <span className="font-mono font-medium text-slate-500">{userToDelete.uid}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setUserToDelete(null)}
                      className="w-full py-3 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-50 transition-colors uppercase cursor-pointer text-center"
                    >
                      Cancel / 取消
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleDeleteUser(userToDelete);
                        setUserToDelete(null);
                      }}
                      className="w-full py-3 bg-[#b5000b] text-white font-bold text-xs rounded-lg hover:bg-[#900008] active:scale-95 transition-all uppercase cursor-pointer text-center shadow-md shadow-red-900/10"
                    >
                      Confirm Delete / 确认删除
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      )}
    </div>
  );
}
