import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ScreenType } from '../types';
import { resolveStorageUrl } from '../lib/supabase';

interface CulturalGuideProps {
  onNavigate: (screen: ScreenType) => void;
  notificationsEnabled?: boolean;
}

export function CulturalGuideScreen({ onNavigate }: CulturalGuideProps) {
  const [selectedGuide, setSelectedGuide] = useState<null | {title: string, content: string}>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'guanxi' | 'mianzi' | 'etiquette' | 'negotiation'>('all');

  const guidesData: Record<string, {title: string, content: string}> = {
    gift: {
      title: "The Gift-Giving Protocol | 礼品规程",
      content: "In Chinese business culture, gift-giving is a sophisticated way to build Guanxi. Never give sharp objects (severing relations), clocks (funerary symbolism), or green hats. Always present and receive gifts with both hands. It's common for recipients to politely refuse 2-3 times before accepting; persistence shows sincerity."
    },
    dinner: {
      title: "Dinner Etiquette 101 | 餐饮礼仪",
      content: "The seating arrangement is crucial: the most senior person sits facing the door. Toasting order follows seniority. When clinking glasses, keep your rim lower than the superior's to show respect. Ganbei (lit. 'dry cup') means you are expected to finish the drink. Always leave a small amount of food on your plate if you are full to show the host's generosity was sufficient."
    },
    face: {
      title: "Face Management | 面子管理",
      content: "Giving face (Gei Mianzi) involves praising your partner in front of others, or smoothing over their mistakes. Losing face (Diu Mianzi) happens when someone is publicly criticized or contradicted. In negotiations, never corner your opponent; always leave them a 'bridge' to retreat gracefully while maintaining their dignity."
    },
    time: {
      title: "The Concept of Time | 时间观念",
      content: "While punctuality is expected for meetings, the overall business timeline is often polychronic—meaning multiple paths are explored simultaneously and decisions take longer. Rushing a deal is seen as a sign of weakness or poor Guanxi. Patience is a strategic virtue in the Chinese market."
    },
    nonverbal: {
      title: "Non-Verbal Cues | 非语言暗示",
      content: "Silence in a meeting isn't necessarily a sign of disagreement; it often indicates deep reflection. Prolonged direct eye contact can be seen as aggressive. Pay attention to nodding: it usually means 'I hear you' rather than 'I agree'. Physical space is typically smaller than in Western cultures, but avoid touching during initial meetings."
    }
  };

  return (
    <div className="flex-grow flex flex-col min-h-screen font-body-rg text-body-rg">
      {/* Top AppBar */}
      <header className="flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop bg-surface-container-lowest border-b border-border-light sticky top-0 shrink-0 z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer shrink-0 min-w-[130px] sm:min-w-[180px]" onClick={() => onNavigate('dashboard-active')}>
            <img
              alt="YORA Logo"
              className="h-10 sm:h-11 w-auto object-contain"
              src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")}
            />
            <div className="flex flex-col justify-center">
              <span className="font-display-lg text-base sm:text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
              <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
            </div>
          </div>
          <div className="h-6 w-[1px] bg-border-light mx-2 hidden sm:block"></div>
          <h2 className="font-subhead-sm text-on-background text-[11px] md:text-sm font-bold hidden sm:block">
            Cultural Intelligence / <span className="font-bold text-subtitle-grey">文化智慧</span>
          </h2>
        </div>
        <div className="flex items-center gap-6">
        </div>
      </header>

      {/* Guide Detail Modal */}
      {selectedGuide && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 transition-all animate-fade-in" onClick={() => setSelectedGuide(null)}>
          <div className="bg-white w-full max-w-[600px] rounded-[32px] overflow-hidden shadow-2xl flex flex-col p-10 relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedGuide(null)}
              className="absolute top-8 right-8 w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center hover:bg-surface-container-high transition-all cursor-pointer text-secondary"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            
            <div className="mb-8">
              <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full mb-3">Cultural Handbook</span>
              <h3 className="text-2xl font-bold text-charcoal">{selectedGuide.title}</h3>
            </div>
            
            <div className="prose prose-sm max-w-none text-secondary leading-relaxed">
              <p className="text-sm font-medium whitespace-pre-wrap">{selectedGuide.content}</p>
            </div>
            
            <div className="mt-10 pt-8 border-t border-border-light flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <img src={resolveStorageUrl("https://i.ibb.co.com/k2xwwPxC/RUI-TEACHING-BUSINESS.png")} className="w-10 h-10 object-contain" />
                  <p className="text-[11px] text-subtitle-grey italic">Recommended by Rui Assistant</p>
               </div>
               <button 
                onClick={() => setSelectedGuide(null)}
                className="bg-charcoal text-white px-8 py-3 rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
               >
                Got it
               </button>
            </div>
          </div>
        </div>
      )}



      {/* Main Content Canvas */}
      <main className="p-6 md:p-margin-desktop max-w-[1440px] mx-auto w-full flex-grow">
        {/* Category Pills */}
        <div className="w-full max-w-full flex gap-3 mb-10 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setActiveFilter('all')} 
            className={`px-6 py-2.5 rounded-full font-label-cn-bold text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              activeFilter === 'all' 
                ? 'bg-primary text-white shadow-lg shadow-primary/10' 
                : 'bg-surface-muted text-secondary hover:bg-surface-container-high border border-border-light'
            }`}
          >
            All Topics | 全部
          </button>
          <button 
            onClick={() => setActiveFilter('guanxi')} 
            className={`px-6 py-2.5 rounded-full font-label-cn-bold text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              activeFilter === 'guanxi' 
                ? 'bg-primary text-white shadow-lg shadow-primary/10' 
                : 'bg-surface-muted text-secondary hover:bg-surface-container-high border border-border-light'
            }`}
          >
            Guanxi | 关系
          </button>
          <button 
            onClick={() => setActiveFilter('mianzi')} 
            className={`px-6 py-2.5 rounded-full font-label-cn-bold text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              activeFilter === 'mianzi' 
                ? 'bg-primary text-white shadow-lg shadow-primary/10' 
                : 'bg-surface-muted text-secondary hover:bg-surface-container-high border border-border-light'
            }`}
          >
            Mianzi | 面子
          </button>
          <button 
            onClick={() => setActiveFilter('etiquette')} 
            className={`px-6 py-2.5 rounded-full font-label-cn-bold text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              activeFilter === 'etiquette' 
                ? 'bg-primary text-white shadow-lg shadow-primary/10' 
                : 'bg-surface-muted text-secondary hover:bg-surface-container-high border border-border-light'
            }`}
          >
            Etiquette | 礼仪
          </button>
          <button 
            onClick={() => setActiveFilter('negotiation')} 
            className={`px-6 py-2.5 rounded-full font-label-cn-bold text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              activeFilter === 'negotiation' 
                ? 'bg-primary text-white shadow-lg shadow-primary/10' 
                : 'bg-surface-muted text-secondary hover:bg-surface-container-high border border-border-light'
            }`}
          >
            Negotiation | 谈判
          </button>
        </div>

        {/* Hero Table Card */}
        <section className="mb-gutter animate-fade-in-up">
          <div className="glass-card rounded-2xl overflow-hidden bg-white shadow-sm border border-border-light">
            <div className="p-5 sm:p-6 md:p-8 border-b border-border-light flex justify-between items-end">
              <div>
                <h3 className="font-headline-md text-headline-md font-semibold tracking-tight leading-tight text-lg sm:text-xl">
                  What They Say vs <br />
                  <span className="text-primary">What They REALLY Mean</span>
                </h3>
                <p className="text-secondary mt-2 font-label-cn-rg text-xs">Decoding subtle cues in Chinese corporate communication.</p>
              </div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="hidden md:block relative w-40 h-40"
              >
                <div className="absolute -inset-2 bg-[radial-gradient(circle,rgba(227,6,19,0.12)_0%,transparent_70%)] rounded-full blur-lg z-0 pointer-events-none"></div>
                <motion.img
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  alt="Rui mascot tip"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain relative z-10"
                  src={resolveStorageUrl("https://i.ibb.co.com/k2xwwPxC/RUI-TEACHING-BUSINESS.png")}
                />
              </motion.div>
            </div>

            <div className="divide-y divide-border-light divide-solid">
              {/* Table Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 group hover:bg-surface-container-low transition-colors">
                <div className="p-5 sm:p-6 md:p-8 border-r-0 md:border-r border-border-light">
                  <span className="text-subtitle-grey text-[10px] uppercase tracking-widest font-semibold block mb-2 font-normal">They Say / 表面意思</span>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-secondary text-base">chat_bubble</span>
                    <span className="font-subhead-sm text-sm font-medium">"我考虑一下"</span>
                  </div>
                  <p className="text-subtitle-grey mt-1 italic text-xs font-normal">"I will think about it."</p>
                </div>
                <div className="p-5 sm:p-6 md:p-8">
                  <span className="text-primary text-[10px] uppercase tracking-widest font-bold block mb-2 font-medium">Meaning / 真实含义</span>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-base">warning</span>
                    <span className="font-subhead-sm text-sm font-semibold text-primary">Probably No / 委婉拒绝</span>
                  </div>
                  <p className="text-subtitle-grey mt-1 text-xs leading-normal font-normal">A polite way to decline without causing loss of face. Re-evaluate your pricing, quantities, or terms.</p>
                </div>
              </div>

              {/* Table Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 group hover:bg-surface-container-low transition-colors">
                <div className="p-5 sm:p-6 md:p-8 border-r-0 md:border-r border-border-light">
                  <span className="text-subtitle-grey text-[10px] uppercase tracking-widest font-bold block mb-2">They Say / 表面意思</span>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-secondary text-base">chat_bubble</span>
                    <span className="font-subhead-sm text-sm font-semibold">"差不多可以"</span>
                  </div>
                  <p className="text-subtitle-grey mt-1 italic text-xs">"It is more or less okay."</p>
                </div>
                <div className="p-5 sm:p-6 md:p-8">
                  <span className="text-secondary text-[10px] uppercase tracking-widest font-bold block mb-2">Meaning / 真实含义</span>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-green-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="font-subhead-sm text-sm font-semibold text-green-700">YES / 已经基本达成</span>
                  </div>
                  <p className="text-subtitle-grey mt-1 text-xs leading-normal">Agreement has been reached. Proceed to write down mutual specifications and invoice documentation immediately.</p>
                </div>
              </div>

              {/* Table Row 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 group hover:bg-surface-container-low transition-colors">
                <div className="p-5 sm:p-6 md:p-8 border-r-0 md:border-r border-border-light">
                  <span className="text-subtitle-grey text-[10px] uppercase tracking-widest font-bold block mb-2">They Say / 表面意思</span>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-secondary text-base">chat_bubble</span>
                    <span className="font-subhead-sm text-sm font-semibold">"原则上不可以"</span>
                  </div>
                  <p className="text-subtitle-grey mt-1 italic text-xs">"In principle, it's not allowed."</p>
                </div>
                <div className="p-5 sm:p-6 md:p-8">
                  <span className="text-primary text-[10px] uppercase tracking-widest font-bold block mb-2">Meaning / 真实含义</span>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-base">key</span>
                    <span className="font-subhead-sm text-sm font-semibold text-on-surface">MAYBE / 并非绝对</span>
                  </div>
                  <p className="text-subtitle-grey mt-1 text-xs leading-normal">This actually hints that there is a way, but it requires exception or 'Guanxi' leverage. It's often an invitation for you to show your sincerity or value.</p>
                </div>
              </div>

              {/* Table Row 4 - New */}
              <div className="grid grid-cols-1 md:grid-cols-2 group hover:bg-surface-container-low transition-colors">
                <div className="p-5 sm:p-6 md:p-8 border-r-0 md:border-r border-border-light">
                  <span className="text-subtitle-grey text-[10px] uppercase tracking-widest font-bold block mb-2">They Say / 表面意思</span>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-secondary text-base">chat_bubble</span>
                    <span className="font-subhead-sm text-sm font-semibold">"我们是老朋友了"</span>
                  </div>
                  <p className="text-subtitle-grey mt-1 italic text-xs">"We are old friends now."</p>
                </div>
                <div className="p-5 sm:p-6 md:p-8">
                  <span className="text-green-600 text-[10px] uppercase tracking-widest font-bold block mb-2">Meaning / 真实含义</span>
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-green-600 text-base">handshake</span>
                    <span className="font-subhead-sm text-sm font-semibold text-on-surface">LEVERAGE GRANTED / 关系红利</span>
                  </div>
                  <p className="text-subtitle-grey mt-1 text-xs leading-normal">The 'Guanxi' threshold has been crossed. You can now ask for deeper favors or long-term loyalty, but you must reciprocate with similar commitment.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Grid */}
        <motion.div layout className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {/* Card 1 */}
          {(activeFilter === 'all' || activeFilter === 'guanxi' || activeFilter === 'etiquette') && (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ y: -6, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.04)" }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="glass-card bg-white border border-border-light rounded-2xl p-5 sm:p-6 md:p-8 flex flex-col h-full shadow-sm"
            >
              <div className="mb-6 flex justify-between items-start">
                <div className="p-3 bg-on-tertiary-container rounded-xl text-tertiary">
                  <span className="material-symbols-outlined text-sm">groups</span>
                </div>
              </div>
              <h4 className="font-subhead-sm text-sm font-bold text-on-surface mb-2">The Gift-Giving Protocol</h4>
              <p className="text-subtitle-grey font-label-cn-rg text-xs leading-relaxed mb-6 flex-1">Understand the hierarchy and symbolic value of corporate gifts in first meetings.</p>
              <button onClick={() => setSelectedGuide(guidesData.gift)} className="text-primary font-label-cn-bold text-xs font-bold flex items-center gap-2 group cursor-pointer text-left">
                Read Guide <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </motion.div>
          )}

          {/* Card 2 */}
          {(activeFilter === 'all' || activeFilter === 'etiquette') && (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ y: -6, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.04)" }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="glass-card bg-white border border-border-light rounded-2xl p-5 sm:p-6 md:p-8 flex flex-col h-full shadow-sm"
            >
              <div className="mb-6 flex justify-between items-start">
                <div className="p-3 bg-on-tertiary-container rounded-xl text-tertiary">
                  <span className="material-symbols-outlined text-sm">restaurant</span>
                </div>
              </div>
              <h4 className="font-subhead-sm text-sm font-bold text-on-surface mb-2">Dinner Etiquette 101</h4>
              <p className="text-subtitle-grey font-label-cn-rg text-xs leading-relaxed mb-6 flex-1">Seating arrangements, toasting order, and navigating the 'Ganbei' culture.</p>
              <button onClick={() => setSelectedGuide(guidesData.dinner)} className="text-primary font-label-cn-bold text-xs font-bold flex items-center gap-2 group cursor-pointer text-left">
                Read Guide <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </motion.div>
          )}

          {/* Card 3 */}
          {(activeFilter === 'all' || activeFilter === 'mianzi' || activeFilter === 'guanxi') && (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ y: -6, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.04)" }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="glass-card bg-white border border-border-light rounded-2xl p-5 sm:p-6 md:p-8 flex flex-col h-full shadow-sm"
            >
              <div className="mb-6 flex justify-between items-start">
                <div className="p-3 bg-on-tertiary-container rounded-xl text-tertiary">
                  <span className="material-symbols-outlined text-sm">psychology</span>
                </div>
              </div>
              <h4 className="font-subhead-sm text-sm font-bold text-on-surface mb-2">Face Management</h4>
              <p className="text-subtitle-grey font-label-cn-rg text-xs leading-relaxed mb-6 flex-1">How to give face (Gei Mianzi) to your partners to build long-term trust.</p>
              <button onClick={() => setSelectedGuide(guidesData.face)} className="text-primary font-label-cn-bold text-xs font-bold flex items-center gap-2 group cursor-pointer text-left">
                Read Guide <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </motion.div>
          )}

          {/* Card 4 - New */}
          {(activeFilter === 'all' || activeFilter === 'negotiation') && (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ y: -6, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.04)" }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="glass-card bg-white border border-border-light rounded-2xl p-5 sm:p-6 md:p-8 flex flex-col h-full shadow-sm"
            >
              <div className="mb-6 flex justify-between items-start">
                <div className="p-3 bg-on-tertiary-container rounded-xl text-tertiary">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                </div>
              </div>
              <h4 className="font-subhead-sm text-sm font-bold text-on-surface mb-2">The Concept of Time</h4>
              <p className="text-subtitle-grey font-label-cn-rg text-xs leading-relaxed mb-6 flex-1">Understanding polychronic time vs. monochronic time in Chinese business.</p>
              <button onClick={() => setSelectedGuide(guidesData.time)} className="text-primary font-label-cn-bold text-xs font-bold flex items-center gap-2 group cursor-pointer text-left">
                Read Guide <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </motion.div>
          )}

          {/* Card 5 - New */}
          {(activeFilter === 'all' || activeFilter === 'negotiation') && (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ y: -6, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.04)" }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="glass-card bg-white border border-border-light rounded-2xl p-5 sm:p-6 md:p-8 flex flex-col h-full shadow-sm"
            >
              <div className="mb-6 flex justify-between items-start">
                <div className="p-3 bg-on-tertiary-container rounded-xl text-tertiary">
                  <span className="material-symbols-outlined text-sm">handshake</span>
                </div>
              </div>
              <h4 className="font-subhead-sm text-sm font-bold text-on-surface mb-2">Non-Verbal Cues</h4>
              <p className="text-subtitle-grey font-label-cn-rg text-xs leading-relaxed mb-6 flex-1">Deciphering silence, eye contact, and posture during high-stakes meetings.</p>
              <button onClick={() => setSelectedGuide(guidesData.nonverbal)} className="text-primary font-label-cn-bold text-xs font-bold flex items-center gap-2 group cursor-pointer text-left">
                Read Guide <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Footer Identity Removed */}
    </div>
  );
}
