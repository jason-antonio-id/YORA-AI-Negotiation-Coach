import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { resolveStorageUrl } from '../lib/supabase';

interface OtpVerificationScreenProps {
  email: string;
  onVerified: (sessionToken: string) => void;
  onBack?: () => void;
}

export function OtpVerificationScreen({ email, onVerified, onBack }: OtpVerificationScreenProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent'>('idle');
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(null);
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
    if (next.every(d => d !== '') && index === 5) {
      handleVerify(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const parts = pastedData.split('');
      setDigits(parts);
      inputsRef.current[5]?.focus();
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (code: string) => {
    setIsVerifying(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });
      
      if (verifyError || !data.session) {
        setError(verifyError?.message || 'Kode verifikasi salah. / Incorrect code.');
        setDigits(['', '', '', '', '', '']);
        inputsRef.current[0]?.focus();
        return;
      }
      onVerified(data.session.access_token);
    } catch (err) {
      setError('Gagal memverifikasi kode. Coba lagi. / Failed to verify. Try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsResending(true);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.signInWithOtp({
        email,
      });
      if (resendError) {
        setError(resendError.message || 'Gagal mengirim ulang kode.');
        return;
      }
      setResendStatus('sent');
      setResendCooldown(60); // 1 minute cooldown
      setTimeout(() => setResendStatus('idle'), 5000);
    } catch {
      setError('Gagal mengirim ulang kode. / Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="bg-background text-on-surface min-h-screen flex items-center justify-center font-body-rg text-body-rg px-margin-mobile md:px-margin-desktop overflow-x-hidden">
      <main className="w-full max-w-[500px] flex flex-col items-center">
        <div className="mb-stack-lg text-center flex items-center justify-center gap-4">
          <img alt="YORA Logo" className="h-6 w-auto object-contain" src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")} />
          <div className="flex flex-col justify-center text-left">
            <span className="font-display-lg text-xl sm:text-2xl font-bold text-charcoal leading-none">YORA</span>
            <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
          </div>
        </div>

        <div className="w-full bg-white border border-border-light rounded-2xl p-10 shadow-[0_4px_24px_rgba(0,0,0,0.06)] animate-fade-in-up">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-8">
              <span className="material-symbols-outlined text-primary text-5xl">mark_email_read</span>
            </div>

            <h2 className="font-display-lg text-display-md font-bold text-charcoal mb-4">Enter Verification Code</h2>
            <p className="font-label-cn-rg text-secondary text-[15px] leading-relaxed mb-8">
              We've sent a 6-digit code to:<br />
              <strong className="text-charcoal font-bold">{email}</strong>
            </p>

            <div className="flex gap-3 mb-6">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  disabled={isVerifying}
                  className="w-12 h-14 text-center text-2xl font-bold text-charcoal bg-surface-muted border border-border-light rounded-xl focus:border-primary focus:outline-none transition-colors"
                />
              ))}
            </div>

            {error && (
              <div className="w-full p-3 bg-primary/5 border border-primary/20 rounded-xl mb-6">
                <p className="text-xs text-primary">{error}</p>
              </div>
            )}

            <div className="p-5 bg-surface-muted rounded-xl border border-border-light/60 text-left mb-8 w-full">
              <p className="text-xs text-subtitle-grey flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0">info</span>
                <span>Code expires in 10 minutes. Check your spam folder if you don't see it within a minute.</span>
              </p>
            </div>

            <div className="flex flex-col gap-4 w-full">
              <button
                onClick={() => handleVerify(digits.join(''))}
                disabled={isVerifying || digits.some(d => !d)}
                className={`w-full h-14 bg-primary text-white font-bold rounded-xl hover:bg-opacity-90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm ${(isVerifying || digits.some(d => !d)) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isVerifying ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    Verify
                  </>
                )}
              </button>

              <button
                onClick={handleResend}
                disabled={isResending || resendCooldown > 0}
                className={`w-full h-14 bg-white border-2 border-secondary/10 text-charcoal font-bold rounded-xl hover:bg-surface-muted transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[12px] ${(isResending || resendCooldown > 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isResending ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    {resendCooldown > 0 
                      ? `Resend in ${resendCooldown}s` 
                      : (resendStatus === 'sent' ? 'Code Sent!' : 'Resend Code')}
                  </>
                )}
              </button>

              {onBack && (
                <button onClick={onBack} className="text-xs text-subtitle-grey hover:text-charcoal transition-colors mt-2">
                  Use a different email
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
