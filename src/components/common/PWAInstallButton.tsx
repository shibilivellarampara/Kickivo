import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Share2, PlusSquare, X, Smartphone, Check } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'compact' | 'menu' | 'nav';
  className?: string;
  onSelect?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header', className = '', onSelect }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // If already running in standalone PWA mode, don't show unless it's in a menu showing installed status
  if (isInstalled && variant !== 'menu' && variant !== 'nav') {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) return;
    }
    // If not direct installable (e.g. iOS Safari or browser without prompt event fired yet)
    setShowModal(true);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <>
      {variant === 'header' && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border shadow-sm ${
            isIOS
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
              : 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 active:scale-95'
          } ${className}`}
          title="Install Kickivo to Home Screen"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isIOS ? 'Add to Home' : 'Install App'}</span>
        </button>
      )}

      {variant === 'compact' && (
        <button
          onClick={handleInstallClick}
          className={`p-2 rounded-xl text-slate-500 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${className}`}
          title="Download App"
        >
          <Smartphone className="w-4 h-4" />
        </button>
      )}

      {variant === 'menu' && (
        <button
          type="button"
          onClick={() => {
            onSelect?.();
            handleInstallClick();
          }}
          className={`w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl transition-all text-left ${className}`}
        >
          <div className="flex items-center gap-3">
            <Smartphone className="w-4 h-4 text-emerald-500" />
            <span>{isInstalled ? 'App Installed' : 'Add to Home Screen'}</span>
          </div>
          <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            {isInstalled ? 'Active' : isIOS ? 'iOS' : 'Install'}
          </span>
        </button>
      )}

      {variant === 'nav' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] rounded-2xl transition-all text-slate-400 hover:text-emerald-500 ${className}`}
        >
          <Smartphone className="w-5 h-5 relative z-10 text-emerald-500" />
          <span className="text-[9px] font-bold uppercase tracking-wider relative z-10 text-emerald-600 dark:text-emerald-400">Install</span>
        </button>
      )}

      {/* Install Instruction Modal for iOS & Android */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-left overflow-hidden">
            {/* Background glowing accent */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* App Icon & Title */}
            <div className="flex items-center gap-3.5 mb-5">
              <img
                src="/ios-180.png"
                alt="Kickivo Logo"
                className="w-14 h-14 rounded-2xl shadow-md border border-slate-100 dark:border-slate-800 shrink-0"
              />
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Install Kickivo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isIOS ? 'For iPhone & iPad' : 'For Android & Mobile Devices'}
                </p>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            {isIOS ? (
              <div className="space-y-3.5 mb-6 text-xs text-slate-600 dark:text-slate-300">
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Quick 3-step setup in Safari:
                </p>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    1
                  </div>
                  <div className="flex-1 leading-relaxed">
                    Tap the <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1 mx-1 font-bold">
                      Share <Share2 className="w-3.5 h-3.5 text-blue-500 inline" />
                    </strong> button in the bottom Safari bar.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    2
                  </div>
                  <div className="flex-1 leading-relaxed">
                    Scroll down and tap <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1 mx-1 font-bold">
                      Add to Home Screen <PlusSquare className="w-3.5 h-3.5 text-emerald-500 inline" />
                    </strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    3
                  </div>
                  <div className="flex-1 leading-relaxed">
                    Tap <strong className="text-slate-900 dark:text-white font-bold">Add</strong> at the top right. Kickivo will launch as a full native app without browser bars!
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 mb-6 text-xs text-slate-600 dark:text-slate-300">
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Install in Chrome or mobile browser:
                </p>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    1
                  </div>
                  <div className="flex-1 leading-relaxed">
                    Tap the browser menu <strong className="text-slate-900 dark:text-white font-bold">(⋮ / More options)</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    2
                  </div>
                  <div className="flex-1 leading-relaxed">
                    Select <strong className="text-slate-900 dark:text-white font-bold">"Install App"</strong> or <strong className="text-slate-900 dark:text-white font-bold">"Add to Home Screen"</strong>.
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button
                onClick={copyUrl}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy App Link'}</span>
              </button>

              <button
                onClick={() => setShowModal(false)}
                className="py-2.5 px-5 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
