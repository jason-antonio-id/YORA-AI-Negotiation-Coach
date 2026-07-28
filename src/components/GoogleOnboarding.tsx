import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ScreenType } from '../types';
import { useSupabase } from '../lib/SupabaseContext';
import { supabase, resolveStorageUrl } from '../lib/supabase';

interface GoogleOnboardingProps {
  onNavigate: (screen: ScreenType) => void;
  userData: {
    fullName: string;
    email: string;
    businessName: string;
    businessType: string;
    province: string;
    originCity: string;
    aiLang: string;
    aiStyle: string;
    aiTone: string;
    aiDepth: string;
    isLoggedIn?: boolean;
    instagram?: string;
  };
  setUserData: React.Dispatch<React.SetStateAction<any>>;
}

export function GoogleOnboardingStep1({ onNavigate, userData, setUserData }: GoogleOnboardingProps) {
  const { user } = useSupabase();
  const [error, setError] = useState<string | null>(null);
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData.businessName) {
      setError("Please fill in your Business Name / 请输入您的企业名称");
      return;
    }

    // Save progress incrementally
    if (user) {
      supabase.from('profiles').upsert({
        id: user.id,
        full_name: userData.fullName,
        business_name: userData.businessName,
        business_type: userData.businessType,
        origin_city: userData.originCity,
        province: userData.province || '',
        onboarding_status: 'partial',
        updated_at: new Date().toISOString()
      }).then(({ error: err }) => {
        if (err) console.warn("Background save Google progress failed:", err);
      });
    }

    onNavigate('google-onboarding-step2');
  };

  const businessTypes = [
    "Importir / 进口商",
    "Distributor / 分销商",
    "UMKM / 中小微企业",
    "Jastip / 代购服务",
    "Manufacturer / 制造",
    "Others / 其他"
  ];

  return (
    <div className="font-body-rg text-on-surface bg-background min-h-screen">
      <nav className="bg-surface-container-lowest flex justify-between items-center h-16 w-full px-margin-mobile md:px-margin-desktop z-50 sticky top-0 border-b border-border-light">
        <div className="flex items-center gap-4 cursor-pointer min-w-[200px]" onClick={() => onNavigate('dashboard-active')}>
          <img alt="YORA Logo" className="h-11 w-auto object-contain" src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")} />
          <div className="flex flex-col justify-center text-left">
            <span className="font-display-lg text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
            <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
          </div>
        </div>
      </nav>

      <motion.main 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="min-h-screen flex flex-col items-center pt-stack-lg pb-24 px-margin-mobile"
      >
        {/* Progress Indicator */}
        <div className="w-full max-w-[640px] mb-stack-lg animate-fade-in-up">
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full border-2 border-primary bg-on-primary-container text-primary flex items-center justify-center font-bold text-sm mb-1">1</div>
              <p className="text-[10px] font-bold text-primary uppercase">Business / 业务</p>
            </div>
            <div className="flex-1 h-[2px] mx-4 bg-border-light"></div>
            <div className="flex flex-col items-center opacity-40">
              <div className="w-8 h-8 rounded-full border-2 border-border-light bg-white text-secondary flex items-center justify-center font-bold text-sm mb-1">2</div>
              <p className="text-[10px] font-bold text-secondary uppercase">AI Profile / 智能偏好</p>
            </div>
          </div>
        </div>

        {/* Header */}
        <header className="text-center mb-stack-lg">
          <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Lengkapi Profil Google Anda</h1>
          <h2 className="font-label-cn-bold text-headline-md text-subtitle-grey">完美您的 Google 账户配置</h2>
        </header>

        {/* Form Card */}
        <motion.div 
          whileHover={{ y: -4, boxShadow: "0 12px 30px -10px rgba(0,0,0,0.06)" }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[640px] bg-surface-container-lowest border border-border-light rounded-xl p-5 sm:p-8 shadow-[0_2px_16px_rgba(0,0,0,0.06)] animate-fade-in"
        >
          {/* User Email Info Indicator */}
          <div className="mb-6 p-4 bg-primary/5 rounded-xl border border-primary/15 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[24px]">contact_mail</span>
            <div>
              <p className="text-xs text-subtitle-grey">Linked Google Account / 已关联的谷歌账户</p>
              <p className="text-sm font-bold text-charcoal">{user?.email || userData.email || adminEmail}</p>
            </div>
          </div>

          <form className="space-y-stack-lg" onSubmit={handleNext}>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-600 mb-6">
                <span className="material-symbols-outlined">error</span>
                <p className="text-xs font-bold">{error}</p>
              </div>
            )}
            {/* Full Name */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <label className="font-bold text-on-surface">Nama Lengkap</label>
                <span className="font-label-cn-rg text-subtitle-grey">全名</span>
              </div>
              <input
                className="w-full px-4 py-3 border border-border-light rounded-xl focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none bg-surface-bright"
                placeholder="Nama Anda"
                value={userData.fullName}
                onChange={(e) => setUserData(prev => ({ ...prev, fullName: e.target.value }))}
                required
                type="text"
              />
            </div>

            {/* Business Name */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <label className="font-bold text-on-surface">Nama Bisnis</label>
                <span className="font-label-cn-rg text-subtitle-grey">企业名称</span>
              </div>
              <input
                className="w-full px-4 py-3 border border-border-light rounded-xl focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none bg-surface-bright"
                placeholder="Masukkan nama legal bisnis Anda"
                value={userData.businessName}
                onChange={(e) => setUserData(prev => ({ ...prev, businessName: e.target.value }))}
                required
                type="text"
              />
            </div>

            {/* Business Type Pill Grid */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <label className="font-bold text-on-surface">Tipe Bisnis</label>
                <span className="font-label-cn-rg text-subtitle-grey">业务类型</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {businessTypes.map((type) => {
                  const isActive = userData.businessType === type || (type === "Others / 其他" && !businessTypes.includes(userData.businessType) && userData.businessType !== "");
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`py-2 px-4 rounded-full border text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-on-primary-container border-primary text-primary'
                          : 'border-border-light text-secondary hover:bg-surface-muted'
                      }`}
                      onClick={() => setUserData(prev => ({ ...prev, businessType: type === "Others / 其他" ? "" : type }))}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
              {!businessTypes.includes(userData.businessType) && (
                <div className="mt-3 animate-fade-in">
                   <input 
                      className="w-full px-4 py-3 border border-primary rounded-xl focus:ring-1 focus:ring-primary transition-all outline-none bg-white font-medium"
                      placeholder="Specify your business type... / 指定业务类型..."
                      value={userData.businessType}
                      onChange={(e) => setUserData(prev => ({ ...prev, businessType: e.target.value }))}
                      autoFocus
                   />
                </div>
              )}
            </div>

            {/* Instagram */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <label className="font-bold text-on-surface">Instagram</label>
                <span className="font-label-cn-rg text-subtitle-grey">opsional</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtitle-grey font-bold select-none">@</span>
                <input
                  className="w-full pl-8 pr-4 py-3 border border-border-light rounded-xl focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none bg-surface-bright"
                  placeholder="yourusername"
                  type="text"
                  value={(userData.instagram || '').replace(/^@+/, '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) {
                      setUserData((prev: any) => ({ ...prev, instagram: '' }));
                      return;
                    }
                    const cleaned = value.replace(/^@+/, '');
                    setUserData((prev: any) => ({ ...prev, instagram: `@${cleaned}` }));
                  }}
                />
              </div>
            </div>

            {/* Origin City */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <label className="font-bold text-on-surface">Origin City (Indonesia)</label>
                <span className="font-label-cn-rg text-subtitle-grey">所在地(印度尼西亚)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Jakarta", "Batam", "Surabaya", "Medan", "Bandung", "Semarang", "Other"].map(city => (
                  <button 
                    key={city} 
                    type="button" 
                    onClick={() => setUserData((prev: any) => ({ ...prev, originCity: city }))}
                    className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all ${
                      userData.originCity === city 
                        ? 'bg-on-primary-container border-primary text-primary shadow-sm' 
                        : 'border-border-light text-secondary hover:border-primary'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
              {userData.originCity === "Other" && (
                <div className="mt-3 animate-fade-in">
                   <input 
                      className="w-full px-4 py-3 border border-primary rounded-xl focus:ring-1 focus:ring-primary transition-all outline-none bg-white font-medium"
                      placeholder="Type your city... / 输入您的城市..."
                      value={userData.originCity === "Other" ? "" : userData.originCity}
                      onChange={(e) => setUserData((prev: any) => ({ ...prev, originCity: e.target.value }))}
                      autoFocus
                   />
                </div>
              )}
            </div>

            {/* CTA Button */}
            <div className="flex flex-col gap-2 mt-6">
              <button
                className="w-full bg-primary hover:bg-primary-container text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group cursor-pointer"
                type="submit"
              >
                <span>Lanjut / 继续</span>
                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
              </button>
            </div>
          </form>
        </motion.div>
      </motion.main>
    </div>
  );
}

export function GoogleOnboardingStep2({ 
  onNavigate, 
  userData, 
  setUserData
}: GoogleOnboardingProps) {
  const { user, refreshProfile } = useSupabase();
  const [isFinalizing, setIsFinalizing] = useState(false);

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsFinalizing(true);
    try {
      const cleanUserData: any = {};
      const keyMap: Record<string, string> = {
        fullName: 'full_name',
        businessName: 'business_name',
        businessType: 'business_type',
        province: 'province',
        originCity: 'origin_city',
        instagram: 'instagram',
        aiLang: 'ai_lang',
        aiStyle: 'ai_style',
        aiTone: 'ai_tone',
        aiDepth: 'ai_depth',
      };
      
      Object.keys(userData).forEach(key => {
        if (userData[key] !== undefined && keyMap[key]) {
          cleanUserData[keyMap[key]] = userData[key];
        }
      });
      
      const updatePromise = supabase.from('profiles').upsert({
        id: user.id,
        ...cleanUserData,
        email: user.email || userData.email,
        onboarding_status: 'completed',
        email_verified: true, // Google user is verified
        updated_at: new Date().toISOString()
      });

      setIsFinalizing(false);
      onNavigate('onboarding-completed');

      (async () => {
        try {
          const { error: err } = await updatePromise;
          if (err) throw err;
          // Fire-and-forget call to log signup to Google Sheets
          const finalEmail = user.email || userData.email || '';
          fetch('/api/log-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: finalEmail,
              fullName: userData.fullName || '',
              businessName: userData.businessName || '',
              businessType: userData.businessType || '',
              originCity: userData.originCity || '',
              province: userData.province || '',
              instagram: userData.instagram || '',
              aiLang: userData.aiLang || '',
              aiStyle: userData.aiStyle || '',
              aiTone: userData.aiTone || '',
              aiDepth: userData.aiDepth || '',
            }),
          }).catch(err => {
            console.error("Failed to post Google signup to /api/log-signup:", err);
          });

          refreshProfile();
        } catch (e) {
          console.error("Firestore progress failed", e);
        }
      })();
    } catch (error) {
      console.error("Firestore progress failed", error);
    }
  };

  const languages = ["Bahasa Indonesia", "English", "中文 (简体)"];
  const styles = [
    { key: 'aggressive', title: 'Aggressive', cn: '激进型', desc: 'Prioritize speed and lowest cost at all costs.', icon: 'bolt' },
    { key: 'balanced', title: 'Balanced', cn: '平衡型', desc: 'Fair trade focused with sustainable margins.', icon: 'balance' },
    { key: 'collaborative', title: 'Collaborative', cn: '协作型', desc: 'Long-term "Guanxi" building and trust.', icon: 'handshake' }
  ];

  return (
    <div className="font-body-rg text-on-surface bg-background min-h-screen">
      <header className="bg-surface-container-lowest border-b border-border-light h-16 w-full px-margin-mobile md:px-margin-desktop flex justify-between items-center z-50 sticky top-0">
        <div className="flex items-center gap-4 cursor-pointer min-w-[200px]" onClick={() => onNavigate('dashboard-active')}>
            <img alt="YORA Logo" className="h-11 w-auto object-contain" src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")} />
            <div className="flex flex-col justify-center text-left">
              <span className="font-display-lg text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
              <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
            </div>
        </div>
      </header>

      <motion.main 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="max-w-[1440px] mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg flex flex-col items-center"
      >
        {/* Progress Indicator */}
        <div className="w-full max-w-[640px] mb-stack-lg animate-fade-in-up">
          <div className="flex justify-between items-center mb-2">
            <span className="text-primary font-bold text-sm">Step 2 of 2</span>
            <span className="text-secondary text-sm">AI Configuration</span>
          </div>
          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary w-[100%] transition-all duration-500"></div>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-12">
          <h1 className="font-headline-md text-headline-md text-on-surface">Atur AI Anda</h1>
          <h2 className="font-label-cn-bold text-headline-md text-subtitle-grey opacity-60 mt-1">设置您的AI偏好</h2>
        </div>

        {/* Form Card Container */}
        <motion.div 
          whileHover={{ y: -4, boxShadow: "0 12px 30px -10px rgba(0,0,0,0.06)" }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[800px] bg-surface-container-lowest border border-border-light rounded-xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-5 sm:p-10 animate-fade-in"
        >
          <form className="space-y-12" onSubmit={handleFinalize}>
            {/* Section 1: Response Language */}
            <section>
              <div className="mb-4">
                <label className="block font-bold text-on-surface">AI Response Language</label>
                <span className="block font-label-cn-rg text-secondary">AI 回复语言</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-surface-muted p-1 rounded-lg">
                {languages.map(lang => {
                  const isActive = userData.aiLang === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      className={`py-3 px-4 rounded-md text-center font-bold transition-all text-sm ${
                        isActive
                          ? 'bg-white border border-border-light text-primary shadow-sm'
                          : 'text-secondary hover:bg-white/50'
                      }`}
                      onClick={() => setUserData(prev => ({ ...prev, aiLang: lang }))}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Section 2: Negotiation Style */}
            <section>
              <div className="mb-6">
                <label className="block font-bold text-on-surface">Negotiation Style</label>
                <span className="block font-label-cn-rg text-secondary">谈判风格</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {styles.map(styleObj => {
                  const isChecked = userData.aiStyle === styleObj.key;
                  return (
                    <label key={styleObj.key} className="relative cursor-pointer group flex">
                      <input
                        className="peer sr-only"
                        name="style"
                        type="radio"
                        checked={isChecked}
                        onChange={() => setUserData(prev => ({ ...prev, aiStyle: styleObj.key }))}
                      />
                      <div className={`w-full h-full border p-6 rounded-xl transition-all group-hover:bg-surface-muted/30 ${
                        isChecked ? 'border-primary ring-1 ring-primary' : 'border-border-light'
                      }`}>
                        <span className="material-symbols-outlined text-primary mb-3">{styleObj.icon}</span>
                        <p className="font-bold text-on-surface">{styleObj.title}</p>
                        <p className="font-label-cn-rg text-secondary mb-2">{styleObj.cn}</p>
                        <p className="text-xs text-secondary leading-tight">{styleObj.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* AI Tone & Depth (Google Users) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border-light/40">
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-on-surface">Communication Tone</label>
                  <span className="block font-label-cn-rg text-secondary text-xs">沟通语气</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'formal', label: 'Formal / 正式' },
                    { key: 'professional', label: 'Pro / 专业' }
                  ].map(tone => (
                    <button
                      key={tone.key}
                      type="button"
                      onClick={() => setUserData(prev => ({ ...prev, aiTone: tone.key }))}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                        userData.aiTone === tone.key 
                          ? 'bg-primary text-white border-primary shadow-md' 
                          : 'border-border-light text-secondary hover:bg-surface-muted'
                      }`}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-on-surface">Strategy Depth</label>
                  <span className="block font-label-cn-rg text-secondary text-xs">策略深度</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'cultural', label: 'Cultural / 文化' },
                    { key: 'standard', label: 'Standard / 标准' }
                  ].map(depth => (
                    <button
                      key={depth.key}
                      type="button"
                      onClick={() => setUserData(prev => ({ ...prev, aiDepth: depth.key }))}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                        userData.aiDepth === depth.key 
                          ? 'bg-primary text-white border-primary shadow-md' 
                          : 'border-border-light text-secondary hover:bg-surface-muted'
                      }`}
                    >
                      {depth.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>



            {/* Action Buttons */}
            <div className="pt-8 flex flex-col items-center gap-2">
              <button
                className="w-full max-w-[400px] bg-primary text-white font-bold py-4 rounded-xl hover:bg-opacity-90 transition-all flex flex-col items-center justify-center shadow-lg disabled:opacity-50 cursor-pointer"
                type="submit"
                disabled={isFinalizing}
              >
                {isFinalizing ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  <>
                    <span className="text-body-rg font-black">Selesai & Mulai</span>
                    <span className="font-label-cn-bold text-[13px] opacity-80">完成并开始</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('google-onboarding-step1')}
                className="py-2 text-subtitle-grey hover:text-primary font-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
              >
                Kembali / 返回
              </button>
            </div>
          </form>
        </motion.div>
      </motion.main>
    </div>
  );
}
