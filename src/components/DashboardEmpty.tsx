import React from 'react';
import { motion } from 'motion/react';
import { ScreenType } from '../types';
import { resolveStorageUrl } from '../lib/supabase';

interface DashboardEmptyProps {
  onNavigate: (screen: ScreenType) => void;
  userData: any;
}

export function DashboardEmpty({ onNavigate }: DashboardEmptyProps) {
  return (
    <div className="flex-grow flex flex-col min-h-screen bg-background text-on-surface font-body-rg">
      {/* Top App Bar */}
      <header className="flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop bg-surface-container-lowest border-b border-border-light sticky top-0 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <motion.div 
            whileHover={{ scale: 1.02, x: 2 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2.5 cursor-pointer shrink-0 min-w-[130px] sm:min-w-[180px]" 
            onClick={() => onNavigate('dashboard-active')}
          >
            <img
              alt="YORA Logo"
              className="h-10 sm:h-11 w-auto object-contain"
              src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")}
            />
            <div className="flex flex-col justify-center">
              <span className="font-display-lg text-base sm:text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
              <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
            </div>
          </motion.div>
          <div className="h-6 w-[1px] bg-border-light mx-2 hidden sm:block"></div>
          <h2 className="font-subhead-sm text-on-background text-[11px] md:text-sm font-bold hidden sm:block">
            Dashboard / <span className="font-bold text-subtitle-grey">仪表板</span>
          </h2>
        </div>
        <div className="flex items-center gap-margin-mobile md:gap-gutter">
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            className="text-secondary hover:text-primary transition-colors cursor-pointer" 
            onClick={() => onNavigate('cultural-guide')}
          >
            <span className="material-symbols-outlined text-[20px]">explore</span>
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.1, rotate: -5 }}
            whileTap={{ scale: 0.9 }}
            className="text-secondary hover:text-primary transition-colors cursor-pointer" 
            onClick={() => onNavigate('settings')}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </motion.button>
        </div>
      </header>

      {/* Canvas Area */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="container mx-auto h-full flex items-center justify-center px-6">
          {/* Empty State Content */}
          <div className="max-w-2xl w-full text-center flex flex-col items-center py-20">
            {/* Rui Mascot Container */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative w-[290px] h-[290px] mb-8 flex items-center justify-center isolate"
            >
              <div className="absolute -inset-12 bg-[radial-gradient(circle,rgba(227,6,19,0.22)_0%,transparent_70%)] rounded-full blur-2xl z-0 floating-1"></div>
              <motion.img
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                alt="Rui Mascot Avatar"
                className="w-[290px] h-[290px] object-contain drop-shadow-2xl z-10"
                src={resolveStorageUrl("https://i.ibb.co.com/ZZ9rMnb/1.png")}
              />
              {/* Orbital Accents */}
              <motion.div 
                animate={{ y: [0, 6, 0], rotate: [12, 16, 12] }}
                transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                className="absolute -top-4 -right-4 w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center border border-border-light z-10"
              >
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>handshake</span>
              </motion.div>
              <motion.div 
                animate={{ y: [0, -6, 0], rotate: [-6, -10, -6] }}
                transition={{ repeat: Infinity, duration: 3.8, ease: "easeInOut" }}
                className="absolute -bottom-2 -left-6 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border border-border-light z-10"
              >
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
              </motion.div>
            </motion.div>

            {/* Typography Content */}
            <div className="space-y-4 mb-10">
              <motion.h1 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="font-display-lg text-display-lg text-on-surface tracking-tight text-4xl md:text-5xl font-bold"
              >
                Welcome to YORA 永睿
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="font-body-rg text-body-rg text-secondary max-w-md mx-auto leading-relaxed font-medium"
              >
                Start your journey towards professional Chinese business relations. Add your first supplier to begin AI-powered negotiations and cultural bridging.
              </motion.p>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="font-label-cn-rg text-label-cn-rg text-subtitle-grey"
              >
                开始您的专业中国商务关系之旅。添加您的第一位供应商，开始人工智能驱动的谈判和文化桥接。
              </motion.p>
            </div>

            {/* Singular Red CTA */}
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              whileHover={{ scale: 1.05, y: -2, boxShadow: "0 20px 40px -10px rgba(181, 0, 11, 0.3)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('wizard-step1')}
              className="group relative inline-flex items-center gap-3 px-10 py-5 bg-primary text-white rounded-full font-bold shadow-xl shadow-primary/20 cursor-pointer overflow-hidden"
            >
              <span className="material-symbols-outlined text-[24px]">add</span>
              <div className="text-left">
                <p className="font-body-rg leading-none font-bold">+ Add First Supplier</p>
                <p className="font-label-cn-bold text-[12px] opacity-90">添加第一位供应商</p>
              </div>
              {/* Golden sweep shines effect on hover */}
              <div className="absolute inset-0 w-[50%] h-full bg-white/20 transform skew-x-12 -translate-x-40 group-hover:animate-shimmer z-0"></div>
            </motion.button>

            {/* Background Decor */}
            <div className="absolute bottom-10 left-10 opacity-5 pointer-events-none hidden xl:block animate-pulse">
              <h3 className="font-display-lg text-[120px] font-bold text-on-surface select-none">YORA</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
