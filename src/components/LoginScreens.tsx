import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenType } from '../types';
import { useSupabase } from '../lib/SupabaseContext';
import { supabase, resolveStorageUrl } from '../lib/supabase';
import { AuthErrorHelper } from './AuthErrorHelper';

interface AuthProps {
  onNavigate: (screen: ScreenType) => void;
  onLoginSuccess?: (name: string) => void;
}

export function LoginScreen({ onNavigate }: AuthProps) {
  const { user } = useSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    setGlowPos({ x, y });
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google login error detail:", err);
      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (isInIframe) {
        setError(
          "Google Sign-In is blocked because loading external scripts is restricted by this platform's iframe security constraints (CSP). " +
          "Please open this app in a NEW TAB (click the arrow icon at the top-right of your preview frame) and then perform a HARD REFRESH (Ctrl+F5 or Cmd+Shift+R) to allow Google Sign-In, or log in instantly using Email & Password below! " +
          "| 第三方谷歌登录由于平台 iframe 限制已被拦截。请点击预览窗口右上角的「新窗口打开」图标，并在新页面中进行【强制刷新】（Ctrl+F5 或 Cmd+Shift+R）即可登录。您也可以立即使用下方的邮箱与密码直接访问系统！"
        );
      } else {
        setError(err.message || "Failed to sign in with Google");
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;

      if (data.user && !data.user.email_confirmed_at) {
        // Fire-and-forget OTP dispatch
        fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.user.email }),
        }).catch(err => console.error("Failed to send OTP during login:", err));
      }
    } catch (err: any) {
      console.error("Full login error:", err);
      setError(err.message || "Failed to sign in");
    }
  };

  return (
    <div className="bg-white antialiased overflow-hidden selection:bg-yora-red/10 selection:text-yora-red relative" onMouseMove={handleMouseMove}>
      <main className="flex flex-col lg:flex-row min-h-screen w-full relative z-10">
        {/* Left Section: 55% Content & Identity */}
        <motion.section 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full lg:w-[55%] flex flex-col px-margin-mobile md:px-margin-desktop py-12 relative z-10 bg-white shadow-2xl"
        >
          {/* Branding Header */}
          <div className="mb-16">
            <motion.div 
              whileHover={{ scale: 1.02, x: 2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-4 w-fit"
            >
              <img 
                alt="YORA Logo" 
                className="h-11 w-auto object-contain" 
                src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")} 
              />
              <div className="flex flex-col justify-center text-left">
                <span className="font-display-lg text-xl sm:text-2xl font-bold text-charcoal leading-none">YORA | 永睿</span>
                <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
              </div>
            </motion.div>
          </div>

          {/* Value Proposition */}
          <div className="max-w-[520px] mb-12">
            <motion.h2 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="font-display-lg text-display-lg-mobile md:text-display-lg text-charcoal mb-4 leading-tight"
            >
              Negotiate <span className="text-yora-red italic">Smarter.</span><br />Win Every Deal.
            </motion.h2>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex flex-col gap-1"
            >
              <p className="font-sans text-[11px] font-bold text-soft-grey uppercase tracking-[0.2em]">Global Intelligence | 全球智慧</p>
              <p className="font-label-cn-rg text-[16px] text-secondary mt-1">Master complex high-stakes negotiations with AI-driven tactical analysis and real-time cultural coaching.</p>
            </motion.div>
          </div>

          {/* Login Form */}
          <div className="max-w-[400px] w-full">
            <form className="space-y-6" onSubmit={handleLoginSubmit}>
              <AuthErrorHelper error={error} />
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="font-sans text-[10px] font-bold text-soft-grey uppercase tracking-widest">Email Address</label>
                  <span className="font-label-cn-rg text-[11px] text-secondary">电子邮件</span>
                </div>
                <motion.input 
                  whileFocus={{ scale: 1.01, borderColor: "#b5000b", boxShadow: "0 0 10px rgba(181, 0, 11, 0.15)" }}
                  className="w-full px-4 py-3.5 border border-secondary/15 rounded-xl outline-none transition-all font-sans text-sm bg-surface-container-lowest" 
                  placeholder="name@company.com" 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="font-sans text-[10px] font-bold text-soft-grey uppercase tracking-widest">Password</label>
                  <span className="font-label-cn-rg text-[11px] text-secondary">密码</span>
                </div>
                <div className="relative">
                  <motion.input 
                    whileFocus={{ scale: 1.01, borderColor: "#b5000b", boxShadow: "0 0 10px rgba(181, 0, 11, 0.15)" }}
                    className="w-full px-4 py-3.5 border border-secondary/15 rounded-xl outline-none transition-all font-sans text-sm bg-surface-container-lowest" 
                    placeholder="••••••••" 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-soft-grey hover:text-charcoal transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="rounded border-secondary/20 text-yora-red focus:ring-yora-red w-4 h-4" />
                  <span className="font-sans text-[11px] text-soft-grey group-hover:text-charcoal transition-colors">Remember me | 记住我</span>
                </label>
                <button 
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="font-sans text-[11px] font-bold text-yora-red hover:underline underline-offset-4"
                >
                  Forgot Password?
                </button>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: "#c80d19" }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-yora-red text-white font-sans font-bold py-4 rounded-xl transition-all duration-150 flex justify-center items-center gap-2 shadow-lg shadow-yora-red/20 text-[14px] uppercase tracking-widest cursor-pointer" 
                type="submit"
              >
                Masuk | 登录
              </motion.button>

              <div className="pt-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-secondary/10"></div>
                <span className="font-sans text-[10px] font-bold text-soft-grey uppercase tracking-widest">Or login with</span>
                <div className="h-px flex-1 bg-secondary/10"></div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: "#f9f9fb" }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-white border border-secondary/20 text-charcoal font-sans font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2 text-[14px] uppercase tracking-widest cursor-pointer shadow-sm" 
                type="button"
                onClick={handleGoogleLogin}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                Sign in with Google
              </motion.button>

              {typeof window !== 'undefined' && window.self !== window.top && (
                <p className="font-sans text-[10px] text-amber-600 text-center italic mt-1.5 leading-normal">
                  Google Sign-In requires opening this website in a <strong>New Tab</strong> (using the arrow icon at the top-right of your preview frame) due to browser sandbox constraints inside iframes.
                </p>
              )}

              <div className="pt-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-secondary/10"></div>
                <span className="font-sans text-[10px] font-bold text-soft-grey uppercase tracking-widest">New to YORA?</span>
                <div className="h-px flex-1 bg-secondary/10"></div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: "#f9f9fb" }}
                whileTap={{ scale: 0.98 }}
                className="w-full border border-charcoal text-charcoal font-sans font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2 text-[12px] uppercase tracking-widest cursor-pointer" 
                type="button"
                onClick={() => onNavigate('register-step1')}
              >
                Request Access | 申请访问
              </motion.button>
            </form>
          </div>

          {/* Footer Meta */}
          <div className="mt-auto pt-12 flex gap-6">
            <p className="font-sans text-[11px] text-soft-grey uppercase tracking-widest">© 2026 YORA | 永睿</p>
            <button onClick={() => setLegalModal('privacy')} className="font-sans text-[11px] text-soft-grey hover:text-charcoal uppercase tracking-widest transition-colors font-bold cursor-pointer outline-none">Privacy | 隐私</button>
            <button onClick={() => setLegalModal('terms')} className="font-sans text-[11px] text-soft-grey hover:text-charcoal uppercase tracking-widest transition-colors font-bold cursor-pointer outline-none">Terms | 条款</button>
          </div>
        </motion.section>

        {/* Right Section: 45% Visual & Mascot */}
        <section className="hidden lg:flex w-[45%] bg-surface-faint relative items-center justify-center overflow-hidden">
          {/* Atmospheric Background */}
          <div 
            className="absolute inset-0 glow-cursor"
            style={{ 
              background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(227, 6, 19, 0.08) 0%, rgba(255, 255, 255, 0) 60%)` 
            }}
          ></div>
          
          {/* Animated Background Grid */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bento-grid-bg"></div>

          {/* Mascot Container */}
          <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
            <div className="relative group p-12">
              {/* Main Mascot */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative z-10 flex items-center justify-center"
              >
                <motion.img 
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
                  alt="Rui Mascot" 
                  className="w-[360px] h-auto drop-shadow-[0_20px_50px_rgba(227,6,19,0.1)] relative z-10 transition-all duration-700 group-hover:scale-105" 
                  src={resolveStorageUrl("https://i.ibb.co.com/j9gwPpqG/RUI-CONNECTED-TO-AI-DATA-BUSINESS.png")} 
                />
              </motion.div>

              {/* Floating Feature Cards */}
              <div className="feature-card floating-1 absolute -top-4 -left-12 bg-white/90 p-5 rounded-2xl border border-white/60 w-52 z-20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-yora-red text-xl">favorite</span>
                  <span className="font-sans text-[10px] font-bold text-soft-grey uppercase tracking-widest">Guanxi Meter | 关系</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-yora-red w-[82%] animate-[width_1.5s_ease-out]"></div>
                </div>
                <p className="mt-3 font-sans text-xs font-bold text-charcoal">High Trust established</p>
              </div>

              <div className="feature-card floating-2 absolute top-1/2 -right-16 bg-white/90 p-5 rounded-2xl border border-white/60 w-56 z-20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary text-xl">translate</span>
                  <span className="font-sans text-[10px] font-bold text-soft-grey uppercase tracking-widest">Contextual AI | 语境</span>
                </div>
                <p className="font-label-cn-rg text-[13px] italic text-secondary leading-relaxed">"They are emphasizing stability over speed."</p>
              </div>

              <div className="feature-card floating-3 absolute bottom-4 -left-8 bg-white/90 p-5 rounded-2xl border border-white/60 w-60 z-20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-tertiary text-xl">auto_awesome</span>
                  <span className="font-sans text-[10px] font-bold text-soft-grey uppercase tracking-widest">AI Script | AI 话术</span>
                </div>
                <p className="font-sans text-[13px] font-medium text-charcoal leading-relaxed">Suggesting 'Compromise A' to secure long-term value.</p>
              </div>
            </div>
          </div>

          {/* Small Bottom Right Logo */}
          <div className="absolute bottom-8 right-12 opacity-30 hover:opacity-60 transition-opacity duration-500">
            <img 
              alt="YORA Monogram watermark" 
              className="w-10 h-auto grayscale" 
              src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")} 
            />
          </div>
        </section>
      </main>

      {/* Legal Modals */}
      {legalModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm" onClick={() => setLegalModal(null)}></div>
          <div className="bg-white rounded-2xl p-10 max-w-2xl w-full relative z-[110] shadow-2xl border border-border-light max-h-[80vh] overflow-y-auto text-left">
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

                <p className="pt-8 text-subtitle-grey">For more information, please contact our legal team at {import.meta.env.VITE_ADMIN_EMAIL}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ForgotPasswordScreen({ onNavigate }: { onNavigate: (screen: ScreenType) => void }) {
  const [email, setEmail] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      setIsSuccess(true);
    } catch (err: any) {
      console.error("Reset error:", err);
      setError(err.message || "Failed to send reset link");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background text-on-surface min-h-screen flex items-center justify-center font-body-rg text-body-rg px-margin-mobile md:px-margin-desktop overflow-x-hidden">
      <main className="w-full max-w-[440px] flex flex-col items-center">
        <div className="mb-stack-lg text-center flex items-center justify-center gap-4 cursor-pointer" onClick={() => onNavigate('login')}>
          <img alt="YORA Logo" className="h-11 w-auto object-contain" src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")} />
          <div className="flex flex-col justify-center text-left">
            <span className="font-display-lg text-xl sm:text-2xl font-bold text-charcoal leading-none">YORA | 永睿</span>
            <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
          </div>
        </div>

        {/* Card Container */}
        <div className="w-full bg-surface-container-lowest border border-border-light rounded-xl p-stack-lg shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition-all duration-300 transform">
          {!isSuccess ? (
            /* Step 1: Initial State */
            <div className="flex flex-col gap-stack-md animate-fade-in-up">
              <div className="mb-stack-sm">
                <h2 className="font-headline-md text-headline-md text-on-background leading-tight">Reset Password</h2>
                <p className="text-secondary font-label-cn-rg text-label-cn-rg mt-1">Enter your email to receive a secure reset link.</p>
              </div>

              <form className="flex flex-col gap-stack-md border-b-0" onSubmit={handleResetSubmit}>
                <AuthErrorHelper error={error} />
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-end">
                    <label className="font-label-cn-bold text-label-cn-bold text-on-background" htmlFor="email-rec">Email Address | 电子邮箱</label>
                  </div>
                  <input
                    className="w-full h-12 px-4 rounded-lg border border-border-light bg-surface-muted focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all duration-200 text-sm"
                    id="email-rec"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    type="email"
                  />
                </div>
                <button
                  className="w-full h-12 bg-primary text-white font-bold rounded-lg hover:bg-primary-container transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => onNavigate('login')}
                  className="text-subtitle-grey hover:text-primary font-label-cn-bold text-[13px] transition-colors duration-200 cursor-pointer"
                >
                  Back to Login | 返回登录
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Success State */
            <div className="flex flex-col items-center text-center py-stack-sm animate-fade-in-up">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-stack-md">
                <span className="material-symbols-outlined text-green-600 text-4xl" style={{ fontVariationSettings: "'wght' 600" }}>check_circle</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-on-background leading-tight mb-2">Check Your Email</h2>
              <p className="text-secondary text-sm mb-stack-lg">
                We've sent a password reset link to <strong className="font-semibold text-on-background">{email}</strong>. Please follow the instructions to regain access to your account.
              </p>
              <div className="w-full pt-stack-md border-t border-border-light">
                <button
                  onClick={() => onNavigate('login')}
                  className="inline-flex items-center gap-2 text-primary font-label-cn-bold text-[13px] hover:underline transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Back to Login | 返回登录
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Contextual Support Info */}
        <p className="mt-stack-lg text-subtitle-grey font-label-cn-rg text-xs text-center opacity-60">
          Need more help? Contact <a href={`mailto:${import.meta.env.VITE_ADMIN_EMAIL}`} className="text-primary cursor-pointer hover:underline">{import.meta.env.VITE_ADMIN_EMAIL}</a>
        </p>
      </main>

      {/* Footer Identity Anchor removed */}
    </div>
  );
}
