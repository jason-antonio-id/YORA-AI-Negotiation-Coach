import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenType } from '../types';
import { supabase, resolveStorageUrl } from '../lib/supabase';
import { useSupabase } from '../lib/SupabaseContext';
import { AuthErrorHelper } from './AuthErrorHelper';
import { OtpVerificationScreen } from './OtpVerificationScreen';

interface OnboardingProps {
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
  notificationsEnabled?: boolean;
  setNotificationsEnabled?: (val: boolean) => void;
  emailDigestEnabled?: boolean;
  setEmailDigestEnabled?: (val: boolean) => void;
}

export function RegisterStep1({ onNavigate, userData, setUserData }: OnboardingProps) {
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [showOtp, setShowOtp] = useState(false);
  const [registeredUid, setRegisteredUid] = useState<string | undefined>(undefined);

  // Dynamic Password strength meter
  const getPasswordStrength = () => {
    let score = 0;
    if (password.length > 0) score += 25;
    if (password.length >= 8) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    return score;
  };

  const strength = getPasswordStrength();
  const meterWidthClass = `${strength}%`;

  let strengthColor = 'bg-error';
  let strengthLabel = 'Weak';
  if (strength > 25 && strength <= 75) {
    strengthColor = 'bg-orange-400';
    strengthLabel = 'Moderate';
  } else if (strength > 75) {
    strengthColor = 'bg-green-500';
    strengthLabel = 'Strong';
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      let userCredential;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: password,
        options: {
          data: {
            full_name: userData.fullName || ''
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered') || signUpError.message.includes('already in use')) {
          const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
            email: userData.email,
            password: password,
          });
          if (signInError) throw signInError;
          userCredential = { user: signInData.user };
        } else {
          throw signUpError;
        }
      } else {
        userCredential = { user: data.user };
      }
      
      const user = userCredential.user;
      if (!user) throw new Error("Authentication failed");
      
      // Immediately write/update profile skeleton
      try {
        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: userData.fullName || '',
            email: userData.email,
            onboarding_status: 'incomplete',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (profileErr) throw profileErr;
      } catch (dbErr: any) {
        console.warn("Skeleton profile write failed:", dbErr);
        // Non-fatal — user can still proceed with onboarding
      }

      // Send OTP to user's email immediately on successful registration
      try {
        await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userData.email }),
        });
      } catch (otpErr) {
        console.warn("Could not send initial OTP:", otpErr);
      }

      {/* Success: Clear state and show OTP screen */}
      setPassword('');
      setConfirmPassword('');
      setRegisteredUid(user.uid);
      setShowOtp(true);
    } catch (err: any) {
      console.error("Registration/Sign-in flow error:", err);
      if (err.code === 'auth/wrong-password') {
        setError("This account is already registered. Please use the correct password or log in via the Login page.");
      } else if (err.code === 'auth/weak-password') {
        setError("Your password is too weak. Please use at least 8 characters.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else {
        setError(err.message || "An error occurred during registration. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const { user } = useSupabase();

  if (showOtp) {
    return (
      <OtpVerificationScreen
        email={userData.email}
        onVerified={async () => {
          try {
            await supabase.auth.refreshSession();
          } catch (e) {
            console.warn("Failed to refresh session after OTP verification:", e);
          }
          setShowOtp(false);
          onNavigate('register-step2');
        }}
        onBack={() => {
          setShowOtp(false);
        }}
      />
    );
  }

  return (
    <div className="font-body-rg text-on-surface antialiased bg-background min-h-screen">
      <nav className="bg-surface-container-lowest flex justify-center items-center h-16 w-full px-margin-mobile md:px-margin-desktop sticky top-0 z-50 border-b border-border-light gap-4">
        <img alt="YORA Logo" className="h-11 w-auto object-contain" src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")} />
        <div className="flex flex-col justify-center text-left flex-grow">
          <span className="font-display-lg text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
          <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
        </div>
        
        {user && (
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              await supabase.auth.signOut();
              onNavigate('login');
            }}
            className="text-[10px] font-bold text-subtitle-grey hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-widest bg-white px-3 py-1.5 rounded-full border border-border-light cursor-pointer shadow-sm ml-auto"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Sign Out / 退出登录
          </button>
        )}
      </nav>

      <motion.main 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="min-h-[calc(100vh-64px)] flex flex-col items-center py-stack-lg px-margin-mobile"
      >
        <div className="w-full max-w-[520px]">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between mb-10 w-full px-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-sm">1</div>
              <span className="font-label-cn-bold text-label-cn-bold text-primary">Account / 账户</span>
            </div>
            <div className="flex-grow h-[2px] bg-surface-container mx-4 mb-6"></div>
            <div className="flex flex-col items-center gap-2 opacity-40">
              <div className="w-10 h-10 rounded-full bg-surface-container text-secondary flex items-center justify-center font-bold">2</div>
              <span className="font-label-cn-bold text-label-cn-bold text-secondary">Business / 业务</span>
            </div>
            <div className="flex-grow h-[2px] bg-surface-container mx-4 mb-6"></div>
            <div className="flex flex-col items-center gap-2 opacity-40">
              <div className="w-10 h-10 rounded-full bg-surface-container text-secondary flex items-center justify-center font-bold">3</div>
              <span className="font-label-cn-bold text-label-cn-bold text-secondary">Verify / 验证</span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center mb-stack-lg">
            <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Buat Akun Anda</h1>
            <h2 className="font-label-cn-bold text-[20px] text-secondary">创建您的账户</h2>
          </div>

          {/* Sign Up Form Card */}
          <motion.div 
            whileHover={{ y: -4, boxShadow: "0 12px 30px -10px rgba(0,0,0,0.06)" }}
            transition={{ duration: 0.3 }}
            className="bg-white p-8 rounded-xl border border-border-light shadow-[0_2px_16px_rgba(0,0,0,0.06)]"
          >
            <form className="flex flex-col gap-6" onSubmit={handleRegister}>
              <AuthErrorHelper error={error} />
              {/* Full Name */}
              <div className="flex flex-col gap-2">
                <label className="flex items-baseline gap-2">
                  <span className="font-bold text-on-surface text-[14px]">Full Name</span>
                  <span className="font-label-cn-rg text-subtitle-grey">全名</span>
                </label>
                <input
                  className="w-full h-12 px-4 rounded-lg border border-border-light focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="e.g. Budi Santoso"
                  value={userData.fullName}
                  onChange={(e) => setUserData(prev => ({ ...prev, fullName: e.target.value }))}
                  required
                  type="text"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-2">
                <label className="flex items-baseline gap-2">
                  <span className="font-bold text-on-surface text-[14px]">Email Address</span>
                  <span className="font-label-cn-rg text-subtitle-grey">电子邮箱</span>
                </label>
                <input
                  className="w-full h-12 px-4 rounded-lg border border-border-light focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="name@company.com"
                  value={userData.email}
                  onChange={(e) => setUserData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  type="email"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <label className="flex items-baseline gap-2">
                  <span className="font-bold text-on-surface text-[14px]">Password</span>
                  <span className="font-label-cn-rg text-subtitle-grey">密码</span>
                </label>
                <div className="relative">
                  <input
                    className="w-full h-12 px-4 rounded-lg border border-border-light focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all pr-12"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>

                {/* Strength Bar */}
                <div className="w-full bg-surface-muted h-1 rounded-full mt-1 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strengthColor}`}
                    style={{ width: meterWidthClass }}
                  ></div>
                </div>
                <p className="text-[12px] text-subtitle-grey flex justify-between">
                  <span>Minimum 8 characters with numbers.</span>
                  {strength > 0 && <span className="font-bold">Strength: {strengthLabel}</span>}
                </p>
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-2">
                <label className="flex items-baseline gap-2">
                  <span className="font-bold text-on-surface text-[14px]">Confirm Password</span>
                  <span className="font-label-cn-rg text-subtitle-grey">确认密码</span>
                </label>
                <input
                  className="w-full h-12 px-4 rounded-lg border border-border-light focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  type="password"
                />
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 mt-2">
                <input
                  className="mt-1 w-4 h-4 text-primary border-border-light rounded focus:ring-primary cursor-pointer"
                  id="terms"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  required
                  type="checkbox"
                />
                <label className="text-[13px] text-secondary leading-snug" htmlFor="terms">
                  I agree to the <button type="button" onClick={() => setLegalModal('terms')} className="text-primary font-semibold hover:underline cursor-pointer">Terms of Service</button> and <button type="button" onClick={() => setLegalModal('privacy')} className="text-primary font-semibold hover:underline cursor-pointer">Privacy Policy</button>.
                  <br />
                  <span className="font-label-cn-rg">我同意服务条款和隐私政策。</span>
                </label>
              </div>

      {/* CTA Button */}
              <div className="flex flex-col gap-2 mt-4">
                <button
                  className="w-full h-14 bg-primary hover:bg-primary-container text-white font-bold rounded-xl transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  type="submit"
                  disabled={isSubmitting || !agree}
                >
                  {isSubmitting ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  ) : (
                    <>
                      <span>Daftar Sekarang / 立即注册</span>
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-center mt-4">
                <p className="text-[14px] text-secondary">
                  Already have an account? <button type="button" className="text-primary font-bold hover:underline cursor-pointer" onClick={() => onNavigate('login')}>Log In / 登录</button>
                </p>
              </div>
            </form>
          </motion.div>
        </div>
      </motion.main>
      {/* Footer Identity Removed */}
      {legalModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm" onClick={() => setLegalModal(null)}></div>
          <div className="bg-white rounded-2xl p-5 sm:p-10 max-w-2xl w-full relative z-10 shadow-2xl border border-border-light max-h-[80vh] overflow-y-auto text-left">
             <div className="flex justify-between items-center mb-8 border-b border-border-light pb-4">
                <h3 className="text-2xl font-bold capitalize">{legalModal}</h3>
                <button onClick={() => setLegalModal(null)} className="material-symbols-outlined text-subtitle-grey hover:text-charcoal transition-colors cursor-pointer">close</button>
             </div>
             <div className="text-sm leading-relaxed text-charcoal space-y-4 font-body-rg">
                <p className="font-bold">Last Updated: May 2026</p>
                
                {legalModal === 'privacy' && (
                  <>
                    <p>Your privacy is paramount. YORA synchronizes your <strong>Supplier Directory</strong> inputs, including pricing thresholds, target MOQs, and negotiation goals, to provide tailored AI advice through Rui.</p>
                    <h4 className="font-bold text-lg pt-4">Data Synchronization</h4>
                    <p>Every input you provide in the Supplier Wizard is stored securely and used to calibrate Rui's strategic suggestions. This ensures that your negotiation leverage and target price (CNY) are always in sync with the advice you receive.</p>
                    <h4 className="font-bold text-lg pt-4">AI Processing</h4>
                    <p>Negotiation transcripts are processed to calculate Guanxi Scores. We do not use your proprietary pricing data to train models for other users.</p>
                  </>
                )}

                {legalModal === 'terms' && (
                  <>
                    <p>By using YORA, you agree to provide accurate information in your Supplier Directory. The effectiveness of Rui's advice depends on the accuracy of your target prices and walk-away points.</p>
                    <h4 className="font-bold text-lg pt-4">Professional Use</h4>
                    <p>YORA is a tool for professional negotiators. While Rui provides world-class cultural and strategic advice, final business decisions remain the responsibility of the user.</p>
                  </>
                )}

                <p className="pt-8 text-subtitle-grey">For more information, please contact our legal team at {adminEmail}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RegisterStep2({ onNavigate, userData, setUserData }: OnboardingProps) {
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
  const [error, setError] = useState<string | null>(null);

  const { user } = useSupabase();

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData.businessName) {
      setError("Please enter your business name / 请输入您的企业名称");
      return;
    }

    // Save progress to Supabase so refresh doesn't kick user back to step 1
    if (user) {
      supabase
        .from('profiles')
        .update({
          business_name: userData.businessName,
          business_type: userData.businessType,
          origin_city: userData.originCity,
          province: userData.province || '',
          onboarding_status: 'partial',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .then(({ error: saveErr }) => {
          if (saveErr) console.warn("Background save Step 2 progress failed:", saveErr);
        });
    }

    onNavigate('register-step3');
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
        <div className="flex items-center gap-4 min-w-[200px]">
          <img alt="YORA Logo" className="h-11 w-auto object-contain" src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")} />
          <div className="flex flex-col justify-center text-left">
            <span className="font-display-lg text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
            <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
        </div>
      </nav>

      <motion.main 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="min-h-screen flex flex-col items-center pt-stack-lg pb-24 px-margin-mobile"
      >
        {/* Progress Indicator */}
        <div className="w-full max-w-[640px] mb-stack-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col items-center cursor-pointer" onClick={() => onNavigate('register-step1')}>
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm mb-1">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
              </div>
              <p className="text-[10px] font-bold text-primary uppercase">Personal</p>
            </div>
            <div className="flex-1 h-[2px] mx-4 bg-primary"></div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full border-2 border-primary bg-on-primary-container text-primary flex items-center justify-center font-bold text-sm mb-1">2</div>
              <p className="text-[10px] font-bold text-primary uppercase">Business</p>
            </div>
            <div className="flex-1 h-[2px] mx-4 bg-border-light"></div>
            <div className="flex flex-col items-center opacity-40">
              <div className="w-8 h-8 rounded-full border-2 border-border-light bg-white text-secondary flex items-center justify-center font-bold text-sm mb-1">3</div>
              <p className="text-[10px] font-bold text-secondary uppercase">Review</p>
            </div>
          </div>
        </div>

        {/* Header */}
        <header className="text-center mb-stack-lg">
          <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Tentang Bisnis Anda</h1>
          <h2 className="font-label-cn-bold text-headline-md text-subtitle-grey">关于您的业务</h2>
        </header>

        {/* Form Card */}
        <motion.div 
          whileHover={{ y: -4, boxShadow: "0 12px 30px -10px rgba(0,0,0,0.06)" }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[640px] bg-surface-container-lowest border border-border-light rounded-xl p-5 sm:p-8 shadow-[0_2px_16px_rgba(0,0,0,0.06)]"
        >
          <form className="space-y-stack-lg" onSubmit={handleNext}>
            {error && (
              <AuthErrorHelper error={error} />
            )}
            {/* Business Name */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-2 col-span-3">
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
            <div className="flex flex-col gap-2 mt-4">
              <button
                className="w-full bg-primary hover:bg-primary-container text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group"
                type="submit"
              >
                <span>Lanjut / 继续</span>
                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('register-step1')}
                className="py-2 text-subtitle-grey hover:text-primary font-bold text-xs uppercase tracking-widest transition-all"
              >
                Kembali / 返回
              </button>
            </div>
          </form>
        </motion.div>

        <div className="mt-8 text-center text-subtitle-grey text-sm">
          <p>Butuh bantuan? <a className="text-primary font-bold hover:underline" href={`mailto:${adminEmail}`}>Hubungi Tim Support Kami</a></p>
        </div>
      </motion.main>

      {/* Background Decoration */}
      <div className="fixed top-0 right-0 -z-10 w-1/3 h-full bg-gradient-to-l from-surface-muted to-transparent pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 -z-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
    </div>
  );
}

export function RegisterStep3({ onNavigate, userData, setUserData }: OnboardingProps) {
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
  const { user, refreshProfile } = useSupabase();
  const [isFinalizing, setIsFinalizing] = useState(false);

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsFinalizing(true);
    try {
      const keyMap: { [key: string]: string } = {
        fullName: 'full_name',
        businessName: 'business_name',
        businessType: 'business_type',
        province: 'province',
        originCity: 'origin_city',
        aiLang: 'ai_lang',
        aiStyle: 'ai_style',
        aiTone: 'ai_tone',
        aiDepth: 'ai_depth',
        instagram: 'instagram',
      };
      
      const cleanUserData: any = {};
      Object.keys(userData).forEach(key => {
        if (userData[key] !== undefined && keyMap[key]) {
          cleanUserData[keyMap[key]] = userData[key];
        }
      });
      
      const { error: err } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...cleanUserData,
          email: user.email || userData.email,
          onboarding_status: 'completed',
          email_verified: true,
          updated_at: new Date().toISOString()
        });

      if (err) throw err;

      setIsFinalizing(false);
      onNavigate('onboarding-completed'); // navigate immediately for instant UX

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
        console.error("Failed to post to /api/log-signup:", err);
      });

      refreshProfile();
    } catch (error) {
      console.error("Firestore progress failed:", error);
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
      {/* TopNavBar Section */}
      <header className="bg-surface-container-lowest border-b border-border-light h-16 w-full px-margin-mobile md:px-margin-desktop flex justify-between items-center z-50 sticky top-0">
        <div className="flex items-center gap-4 min-w-[200px]">
            <img alt="YORA Logo" className="h-11 w-auto object-contain" src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")} />
            <div className="flex flex-col justify-center text-left">
              <span className="font-display-lg text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
              <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
            </div>
        </div>
        <div className="flex items-center gap-stack-sm">
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
            <span className="text-primary font-bold text-sm">Step 3 of 3</span>
            <span className="text-secondary text-sm">AI Configuration</span>
          </div>
          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary w-[100%] transition-all duration-500"></div>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-12">
          <h1 className="font-headline-md text-headline-md text-on-surface">Atur AI Anda</h1>
          <h2 className="font-label-cn-bold text-headline-md text-secondary opacity-50 mt-1">设置您的AI偏好</h2>
        </div>

        {/* Form Card Container */}
        <motion.div 
          whileHover={{ y: -4, boxShadow: "0 12px 30px -10px rgba(0,0,0,0.06)" }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[800px] bg-surface-container-lowest border border-border-light rounded-xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-5 sm:p-10"
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

            {/* Section 3: AI Tone & Depth */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
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



            {/* Action Button */}
            <div className="pt-8 flex flex-col items-center gap-2">
              <button
                className="w-full max-w-[400px] bg-primary text-white font-bold py-4 rounded-xl hover:bg-opacity-90 transition-all flex flex-col items-center justify-center shadow-lg disabled:opacity-50"
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
                onClick={() => onNavigate('register-step2')}
                className="py-2 text-subtitle-grey hover:text-primary font-bold text-xs uppercase tracking-widest transition-all"
              >
                Kembali / 返回
              </button>
              <p className="mt-4 text-xs text-secondary italic">Step 3 of 3: final configuration before dashboard access.</p>
            </div>
          </form>
        </motion.div>

        {/* Decorative Illustration */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mt-10 w-full max-w-[285px] opacity-80"
        >
          <motion.img
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: [0, -6, 0] }}
            transition={{ 
              opacity: { duration: 0.4 },
              y: { repeat: Infinity, duration: 3, ease: "easeInOut", delay: 0.4 }
            }}
            alt="Rui Mascot Decorative"
            referrerPolicy="no-referrer"
            className="w-full object-contain animate-pulse-slow"
            src={resolveStorageUrl("https://i.ibb.co.com/ZZ9rMnb/1.png")}
          />
        </motion.div>
      </motion.main>

    </div>
  );
}

export function OnboardingCompleted({ onNavigate, userData }: OnboardingProps) {
  return (
    <div className="bg-surface-container-lowest text-on-surface font-body-rg selection:bg-primary-fixed selection:text-on-primary-fixed overflow-x-hidden min-h-screen">
      {/* Success Confetti/Particle Layer (Visual Aura) */}
      <div className="fixed inset-0 pointer-events-none opacity-20 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-tertiary/5 blur-[120px]"></div>
      </div>

      <motion.main 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-margin-mobile md:px-margin-desktop py-stack-lg max-w-container-max mx-auto text-center"
      >
        {/* Mascot Section */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-stack-lg"
        >
            <div className="w-[310px] h-[310px] mx-auto flex items-center justify-center bg-primary/10 rounded-full border-4 border-white shadow-xl overflow-hidden p-6 relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(227,6,19,0.12)_0%,transparent_70%)] rounded-full blur-xl pointer-events-none"></div>
                <motion.img 
                  initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    rotate: 0,
                    y: [0, -10, 0]
                  }}
                  transition={{ 
                    opacity: { duration: 0.5, ease: "easeOut" },
                    scale: { duration: 0.6, ease: "easeOut" },
                    rotate: { duration: 0.6, ease: "easeOut" },
                    y: { repeat: Infinity, duration: 3.5, ease: "easeInOut", delay: 0.6 }
                  }}
                  src={resolveStorageUrl("https://i.ibb.co.com/SXbG0Hd9/RUI-APPROVE-BUSINESS.png")} 
                  alt="Success Mascot" 
                  className="w-[260px] h-[260px] object-contain relative z-10" 
                />
            </div>
        </motion.div>

        {/* Headline */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-stack-lg"
        >
          <h1 className="font-display-lg text-display-lg text-on-surface mb-2">
            You're all set, <span className="text-primary">{userData.fullName.split(' ')[0] || "Anton"}</span>!
          </h1>
          <p className="font-subhead-sm text-subhead-sm text-secondary">
            您已准备就绪！您的全球供应链管理之旅正式开启。
          </p>
        </motion.div>

        {/* What's Next Bento-Style Card */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          whileHover={{ y: -4, boxShadow: "0 12px 30px -10px rgba(0,0,0,0.06)" }}
          className="w-full max-w-2xl bg-white border border-border-light rounded-xl p-8 shadow-sm mb-stack-lg text-left"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="text-left">
              <h2 className="font-headline-md text-headline-md leading-none mb-1">What's Next</h2>
              <p className="font-label-cn-rg text-label-cn-rg text-subtitle-grey">接下来的步骤</p>
            </div>
            <span className="material-symbols-outlined text-primary text-4xl">rocket_launch</span>
          </div>

          <div className="space-y-6 text-left">
            {/* Step 1 */}
            <div className="flex items-start gap-4 group">
              <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg bg-gradient-to-r from-primary to-primary-container group-hover:scale-110 transition-transform">1</div>
              <div className="pt-1">
                <p className="font-body-rg text-on-surface font-semibold">Import your first supplier profile</p>
                <p className="font-label-cn-rg text-secondary">导入您的第一个供应商档案</p>
              </div>
            </div>
            {/* Step 2 */}
            <div className="flex items-start gap-4 group">
              <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg bg-gradient-to-r from-primary to-primary-container group-hover:scale-110 transition-transform">2</div>
              <div className="pt-1">
                <p className="font-body-rg text-on-surface font-semibold">Set up your Guanxi (Relationship) goals</p>
                <p className="font-label-cn-rg text-secondary">设定您的关系管理目标</p>
              </div>
            </div>
            {/* Step 3 */}
            <div className="flex items-start gap-4 group">
              <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg bg-gradient-to-r from-primary to-primary-container group-hover:scale-110 transition-transform">3</div>
              <div className="pt-1">
                <p className="font-body-rg text-on-surface font-semibold">Start a simulated negotiation session</p>
                <p className="font-label-cn-rg text-secondary">开始一次模拟谈判课程</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* CTA Action */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05, y: -2, boxShadow: "0 20px 40px -10px rgba(181, 0, 11, 0.3)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate('wizard-step1')}
            className="bg-primary text-white font-body-rg font-bold px-12 py-5 rounded-full shadow-xl transition-all duration-300 flex items-center gap-3 cursor-pointer"
          >
            <span className="material-symbols-outlined text-white">add_circle</span>
            <span className="text-white">Add First Supplier | 添加供应商</span>
          </motion.button>
          <button
            onClick={() => onNavigate('dashboard-empty')}
            className="text-secondary hover:text-primary font-body-rg flex items-center gap-2 transition-colors py-2 group cursor-pointer"
          >
            <span>Go to Dashboard | 前往仪表板</span>
            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        </motion.div>
      </motion.main>

      {/* Footer removed */}
    </div>
  );
}
