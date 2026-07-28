import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phrase, ScreenType } from '../types';
import { INITIAL_PHRASES } from '../data';
import { resolveStorageUrl } from '../lib/supabase';

interface PhraseLibraryProps {
  onNavigate: (screen: ScreenType, params?: { supplierId?: string }) => void;
  notificationsEnabled?: boolean;
}

export function PhraseLibraryScreen({ onNavigate }: PhraseLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<'All' | 'Price Negotiation' | 'Opening Remarks' | 'Quality Control' | 'Shipping & Logistics' | 'Formal Closing'>('All');
  const [copyFeedback, setCopyFeedback] = useState<Record<string, 'zh' | 'id' | null>>({});

  const categories: Array<'All' | 'Price Negotiation' | 'Opening Remarks' | 'Quality Control' | 'Shipping & Logistics' | 'Formal Closing'> = [
    'All',
    'Price Negotiation',
    'Opening Remarks',
    'Quality Control',
    'Shipping & Logistics',
    'Formal Closing'
  ];

  const handleSpeak = (text: string, lang: 'zh-CN' | 'en-US') => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      
      const voices = window.speechSynthesis.getVoices();
      if (lang === 'zh-CN') {
        const cnVoice = voices.find(v => v.lang.includes('zh-CN') || v.lang.includes('nan'));
        if (cnVoice) utterance.voice = cnVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCopyText = (text: string, phraseId: string, lang: 'zh' | 'id') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(prev => ({ ...prev, [phraseId]: lang }));
      setTimeout(() => {
        setCopyFeedback(prev => ({ ...prev, [phraseId]: null }));
      }, 2000);
    }).catch(() => {
      setCopyFeedback(prev => ({ ...prev, [phraseId]: lang }));
      setTimeout(() => {
        setCopyFeedback(prev => ({ ...prev, [phraseId]: null }));
      }, 2000);
    });
  };

  const filteredPhrases = INITIAL_PHRASES.filter(phrase => {
    const matchesCat = selectedCat === 'All' || phrase.category === selectedCat;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      phrase.chinese.toLowerCase().includes(query) ||
      phrase.english.toLowerCase().includes(query) ||
      phrase.bahasa.toLowerCase().includes(query) ||
      phrase.pinyin.toLowerCase().includes(query);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex-grow flex flex-col min-h-screen">
      {/* TopNavBar Component */}
      <header className="flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop bg-surface-container-lowest border-b border-border-light sticky top-0 shrink-0 z-50">
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
              src="https://i.ibb.co.com/k2c1SPn8/1.png"
            />
            <div className="flex flex-col justify-center">
              <span className="font-display-lg text-base sm:text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
              <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
            </div>
          </motion.div>
          <div className="h-6 w-[1px] bg-border-light mx-2 hidden sm:block"></div>
          <h2 className="font-subhead-sm text-on-background text-[11px] md:text-sm font-bold hidden sm:block">
            Phrase Library / <span className="font-bold text-subtitle-grey">常用语句</span>
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-[180px] sm:w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtitle-grey text-base">search</span>
            <input
              className="w-full bg-surface-muted border-none pl-9 pr-3 py-2 rounded-xl text-xs font-normal focus:ring-1 focus:ring-primary outline-none"
              placeholder="Search phrases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
            />
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border border-border-light cursor-pointer bg-surface-container-highest shrink-0" onClick={() => onNavigate('settings')}>
            <span className="material-symbols-outlined text-subtitle-grey text-lg">person</span>
          </div>
        </div>
      </header>

      {/* Content Canvas */}
      <div className="p-4 sm:p-6 md:p-10 max-w-container-max mx-auto w-full flex-grow">
        {/* Category Tabs */}
        <div className="w-full max-w-full flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => {
            const isActive = selectedCat === cat;
            return (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/10'
                    : 'bg-white text-secondary border border-border-light hover:bg-surface-muted'
                }`}
              >
                {cat}
              </motion.button>
            );
          })}
        </div>

        {/* Phrase Cards Grid */}
        <motion.div layout className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredPhrases.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-12 text-center text-subtitle-grey italic bg-white rounded-2xl border border-border-light shadow-sm"
              >
                No matching phrases found. Go explore other topics!
              </motion.div>
            ) : (
              filteredPhrases.map((phrase, idx) => {
                const feedback = copyFeedback[phrase.id];
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.4 }}
                    whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}
                    key={phrase.id} 
                    className="phrase-card bg-white border border-border-light p-5 sm:p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all duration-300"
                  >
                    <div className="flex-grow space-y-4 w-full">
                      <span className="inline-block px-3 py-1 bg-surface-muted text-subtitle-grey text-[10px] font-bold uppercase tracking-wider rounded-md">
                        {phrase.category}
                      </span>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="font-label-cn-bold text-xl sm:text-[24px] text-on-surface font-semibold">{phrase.chinese}</h2>
                          <motion.button 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleSpeak(phrase.chinese, 'zh-CN')}
                            className="p-1.5 text-primary hover:bg-primary/5 rounded-full transition-colors cursor-pointer"
                            title="Listen to pronunciation"
                          >
                            <span className="material-symbols-outlined text-[20px]">volume_up</span>
                          </motion.button>
                        </div>
                        <p className="text-subtitle-grey italic text-xs mb-2">{phrase.pinyin}</p>
                        <div className="flex flex-col gap-1 text-xs sm:text-sm text-secondary leading-normal">
                          <p className="text-on-surface font-body-rg"><span className="font-bold">EN:</span> {phrase.english}</p>
                          <p className="text-on-surface font-body-rg"><span className="font-bold">ID:</span> {phrase.bahasa}</p>
                        </div>
                      </div>
                      {/* Effectiveness indicator bar */}
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-[10px] text-subtitle-grey font-bold uppercase tracking-widest">Effectiveness:</span>
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, idx) => {
                            const isFilled = idx < phrase.effectiveness;
                            return (
                              <div
                                key={idx}
                                className={`w-2.5 h-2.5 rounded-full ${
                                  isFilled ? 'bg-primary animate-pulse' : 'bg-border-light'
                                }`}
                              ></div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col gap-2.5 w-full md:w-auto md:min-w-[160px] shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleCopyText(phrase.chinese, phrase.id, 'zh')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          feedback === 'zh'
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'bg-primary text-white hover:bg-primary-container'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {feedback === 'zh' ? 'check_circle' : 'content_copy'}
                        </span>
                        {feedback === 'zh' ? 'Copied ZH' : 'Copy ZH'}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleCopyText(phrase.bahasa, phrase.id, 'id')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          feedback === 'id'
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'bg-white text-on-secondary-fixed border-border-light hover:bg-surface-muted'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {feedback === 'id' ? 'check_circle' : 'translate'}
                        </span>
                        {feedback === 'id' ? 'Copied ID' : 'Copy ID'}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
