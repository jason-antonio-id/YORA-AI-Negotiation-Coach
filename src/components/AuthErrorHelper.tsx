import React from 'react';

interface AuthErrorHelperProps {
  error: string | null;
}

export function AuthErrorHelper({ error }: AuthErrorHelperProps) {
  if (!error) return null;

  const errStr = error.toLowerCase();
  
  // Detect if the error indicates a configuration issue, internal error, or disabled provider
  const isInternal = errStr.includes('auth/internal-error') || errStr.includes('internal-error');
  const isOperationNotAllowed = errStr.includes('operation-not-allowed') || errStr.includes('auth/operation-not-allowed') || errStr.includes('not-allowed');
  const isUnauthorizedDomain = errStr.includes('unauthorized-domain') || errStr.includes('auth/unauthorized-domain') || errStr.includes('unauthorized domain');
  const isPopupClosed = errStr.includes('popup-closed-by-user') || errStr.includes('auth/popup-closed-by-user');

  // Detect if running inside an iframe (such as AI Studio preview or sandboxed frames)
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // If any of these are true, we render a highly polished troubleshooting box
  const shouldRenderTroubleshooter = isInternal || isOperationNotAllowed || isUnauthorizedDomain || isPopupClosed || errStr.includes('firebase');

  if (!shouldRenderTroubleshooter) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg animate-fade-in mb-4">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5 text-left text-xs text-amber-900 animate-fade-in space-y-3 mb-4 max-h-[380px] overflow-y-auto shadow-sm">
      <div className="flex items-center gap-2 text-amber-800 font-bold border-b border-amber-200/60 pb-2">
        <span className="material-symbols-outlined !text-lg text-amber-700">security_update_warning</span>
        <span className="uppercase tracking-wider">Troubleshooting Authentication</span>
      </div>

      <p className="font-semibold text-amber-800">
        Authentication Code: <span className="font-mono text-[11px] bg-amber-100/70 px-1 py-0.5 rounded text-amber-950 font-bold">{error}</span>
      </p>

      {isInIframe ? (
        <div className="bg-amber-100/60 border border-amber-300 rounded-lg p-3 space-y-1.5 text-amber-950 font-sans">
          <p className="font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-amber-800">open_in_new</span>
            Detected Sandbox Iframe Environment
          </p>
          <p className="text-[11px] leading-relaxed text-amber-900">
            You are viewing this app within the AI Studio or Cloud Run preview frame. Secure browsers apply strict Content Security Policy (CSP) rules on embedded frames that block external logins (like Google Popup).
          </p>
          <div className="pt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(window.location.href, '_blank');
                }
              }}
              className="px-2.5 py-1 bg-amber-600 text-white font-bold text-[10px] rounded hover:bg-amber-700 transition-colors shadow-sm"
            >
              Open in a New Tab ↗
            </button>
            <span className="text-[10px] text-amber-800 self-center">
              OR use the <strong>Request Access / Email and Password</strong> flow below!
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-100/60 border border-amber-300 rounded-lg p-3 space-y-1.5 text-amber-950 font-sans">
          <p className="font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-amber-800">cached</span>
            Browser Cache Clear / Hard Refresh Needed
          </p>
          <p className="text-[11px] leading-relaxed text-amber-900">
            If you opened this app in a standalone window but still see this error, your browser is aggressively enforcing cached security rules (CSP headers) from your previous iframe session.
          </p>
          <p className="text-[11px] leading-relaxed font-semibold text-amber-950">
            Please reload this page using a Hard Refresh to bypass the cache:
            <br />• Windows: <kbd className="bg-amber-200/80 px-1 py-0.5 rounded text-[10px] font-mono font-bold border border-amber-300">Ctrl + F5</kbd> or <kbd className="bg-amber-200/80 px-1 py-0.5 rounded text-[10px] font-mono font-bold border border-amber-300 md:inline-block mt-1 sm:mt-0">Ctrl + Shift + R</kbd>
            <br />• Mac (Safari/Chrome): <kbd className="bg-amber-200/80 px-1 py-0.5 rounded text-[10px] font-mono font-bold border border-amber-300">Cmd + Shift + R</kbd> (or hold <kbd className="bg-amber-200/80 px-1 py-0.5 rounded text-[10px] font-mono">Shift</kbd> and click the reload icon)
          </p>
        </div>
      )}
    </div>
  );
}
