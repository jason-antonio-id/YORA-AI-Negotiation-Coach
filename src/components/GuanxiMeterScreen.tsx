import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ScreenType, Supplier } from '../types';
import { resolveStorageUrl } from '../lib/supabase';

const getDynamicRuiTip = (sup: Supplier): string => {
  const score = sup.guanxiScore || 50;
  const category = (sup.category || "General Procurement").trim();
  const targetPrice = sup.targetPrice ? `CNY ${sup.targetPrice}` : null;
  const currentPrice = sup.currentPrice ? `CNY ${sup.currentPrice}` : null;
  const targetMOQ = sup.targetMOQ || sup.moq;
  const incoterms = sup.incoterms || "FOB";

  // Score 1 - 40: Critical risk, low trust relationship
  if (score <= 40) {
    if (sup.category) {
      return `Critical risk in ${category}. Urgently source alternative factories. Do not commit funds without independent quality verification.`;
    }
    if (targetPrice) {
      return `Relationship cold. High price variance detected. Audit technical specifications thoroughly and hold on raw material deposits.`;
    }
    return `Critical status. Initiate immediate background check. Diversify sourcing to mitigate key supplier failure risk.`;
  }

  // Score 41 - 59: Building / fragile relationship
  if (score < 60) {
    if (targetPrice) {
      return `Building-phase trust. Gradually approach target rate of ${targetPrice} with mutual benefit arguments. Don't rush.`;
    }
    if (targetMOQ) {
      return `Incoterms as ${incoterms} is stable, but use target MOQ thresholds as gentle leverage. Focus on consistency.`;
    }
    return `Momentum is fragile. Establish clear benchmarks and schedule regular professional communications to build trust.`;
  }

  // Score 60 - 79: Healthy / stable relationship
  if (score < 80) {
    if (targetPrice && currentPrice) {
      return `Strong performance. Work on bridging the ${currentPrice} to ${targetPrice} gap via tiered volume schedules.`;
    }
    return `Healthy partnership. Suggest an informal status video call to strengthen personal rapport and review pipeline milestones.`;
  }

  // Score 80 - 100: Optimal / Trusted Ally relation
  if (targetPrice) {
    return `Trusted Ally! Leverage exceptional goodwill to secure customized specifications, priority shipping, or ${targetPrice} lock-in.`;
  }
  return `Highly strategic partner. Lock in production volumes early and propose extended payment term discussions.`;
};

interface GuanxiProps {
  onNavigate: (screen: ScreenType, params?: any) => void;
  suppliers: Supplier[];
}

export function GuanxiMeterScreen({ onNavigate, suppliers }: GuanxiProps) {
  const [activeTab, setActiveTab] = useState<'All' | 'High' | 'Risk'>('All');
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimateIn(true), 150);
    return () => clearTimeout(timer);
  }, []);

  // Calculate dynamic average Guanxi
  const averageGuanxi = Math.round(
    suppliers.reduce((acc, curr) => acc + curr.guanxiScore, 0) / suppliers.length
  ) || 73;

  // Visual offsets of the circle circle dash progress
  const strokeDashoffset = animateIn 
    ? Math.max(0, 552.92 - (552.92 * averageGuanxi) / 100) 
    : 552.92;

  const displayedSuppliers = suppliers.filter(sup => {
    if (activeTab === 'High') return sup.guanxiScore >= 75;
    if (activeTab === 'Risk') return sup.guanxiScore < 50;
    return true;
  });



  return (
    <div className="flex-grow flex flex-col min-h-screen">
      {/* TopNavBar */}
      <header className="flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop bg-surface-container-lowest border-b border-border-light sticky top-0 z-50 shrink-0">
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
            Guanxi Meter / <span className="font-bold text-subtitle-grey">关系雷达</span>
          </h2>
        </div>
      </header>

      <div className="p-4 sm:p-6 md:p-margin-desktop max-w-container-max mx-auto w-full space-y-8 flex-grow">
        {/* Overall Health Banner */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative overflow-hidden rounded-[24px] bg-surface-container-lowest border border-border-light p-8 md:p-10 shadow-sm"
        >
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-lg">
              <motion.h3 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="font-headline-md text-headline-md text-on-background mb-2 text-xl font-bold"
              >
                Overall Ecosystem Health
              </motion.h3>
              <motion.p 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-secondary font-label-cn-rg text-xs leading-relaxed mb-6 font-normal"
              >
                Your current average Guanxi across all verified Tier-1 suppliers is trending upwards. Cultural alignment is your strongest pillar this quarter.
              </motion.p>
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-1.5 rounded-full bg-primary-container text-white lg:text-xs text-[10px] font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                  High Performance
                </span>
                <span className="px-4 py-1.5 rounded-full bg-surface-container-high text-secondary lg:text-xs text-[10px] font-medium">Medium Risk</span>
                <span className="px-4 py-1.5 rounded-full bg-surface-container-high text-secondary lg:text-xs text-[10px] font-medium">Relationship Building</span>
              </div>
            </div>

            {/* Scale of Justice Mascot */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-52 h-52 flex-shrink-0 flex items-center justify-center relative"
            >
              <div className="absolute -inset-4 bg-[radial-gradient(circle,rgba(227,6,19,0.15)_0%,transparent_70%)] rounded-full blur-xl z-0 pointer-events-none"></div>
              <motion.img 
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                src={resolveStorageUrl("https://i.ibb.co.com/RG8Cq6Jc/RUI-HOLDING-SCALE-OF-JUSTICE-BUSINESS.png")} 
                alt="Rui with Scale of Justice" 
                className="w-full h-full object-contain relative z-10"
              />
            </motion.div>

            <div className="w-full md:w-auto flex flex-col items-center">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform rotate-180">
                  <circle className="text-surface-container-low" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeWidth="12"></circle>
                  <circle
                    className="text-primary"
                    cx="96"
                    cy="96"
                    fill="transparent"
                    r="88"
                    stroke="currentColor"
                    strokeDasharray="552.92"
                    strokeDashoffset={strokeDashoffset}
                    strokeWidth="12"
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s' }}
                  ></circle>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <motion.span 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="font-display-lg text-primary text-4xl block leading-none font-bold"
                  >
                    {averageGuanxi}
                  </motion.span>
                  <span className="font-label-cn-rg text-secondary uppercase tracking-widest text-[10px] mt-1 font-medium font-sans">Health Score</span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Categories togglers */}
        <div className="flex justify-between items-center bg-transparent pt-4">
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab('All')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'All' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-secondary border border-border-light hover:bg-surface-muted'
              }`}
            >
              All Suppliers
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab('High')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'High' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-secondary border border-border-light hover:bg-surface-muted'
              }`}
            >
              High Score Ensure
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab('Risk')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'Risk' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-secondary border border-border-light hover:bg-surface-muted'
              }`}
            >
              At Risk (Score &lt; 50)
            </motion.button>
          </div>
        </div>

        {/* Explainer Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Communication */}
          <motion.div 
            whileHover={{ y: -6, boxShadow: "0 15px 30px -10px rgba(0,0,0,0.08)" }}
            className="p-6 bg-surface-container-lowest border border-border-light rounded-xl shadow-sm cursor-default"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 text-tertiary rounded-lg">
                <span className="material-symbols-outlined font-normal text-sm">forum</span>
              </div>
              <h4 className="font-subhead-sm text-sm font-semibold">Communication / 沟通</h4>
            </div>
            <p className="font-label-cn-rg text-secondary text-xs leading-relaxed mb-4 font-normal">
              Frequency and quality of interactions. Current: High response rate, informal language adoption increasing.
            </p>
            <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '85%' }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="bg-tertiary h-full rounded-full"
              ></motion.div>
            </div>
          </motion.div>

          {/* Reliability */}
          <motion.div 
            whileHover={{ y: -6, boxShadow: "0 15px 30px -10px rgba(0,0,0,0.08)" }}
            className="p-6 bg-surface-container-lowest border border-border-light rounded-xl shadow-sm cursor-default"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-50 text-on-secondary-container rounded-lg">
                <span className="material-symbols-outlined font-normal text-sm">verified</span>
              </div>
              <h4 className="font-subhead-sm text-sm font-semibold">Reliability / 可靠性</h4>
            </div>
            <p className="font-label-cn-rg text-secondary text-xs leading-relaxed mb-4 font-normal">
              Consistency in delivery and commitment. Current: Stabilizing after minor disruption in lunar cycle.
            </p>
            <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '68%' }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
                className="bg-primary h-full rounded-full"
              ></motion.div>
            </div>
          </motion.div>

          {/* Cultural Alignment */}
          <motion.div 
            whileHover={{ y: -6, boxShadow: "0 15px 30px -10px rgba(0,0,0,0.08)" }}
            className="p-6 bg-surface-container-lowest border border-border-light rounded-xl shadow-sm cursor-default"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-600 text-white rounded-lg">
                <span className="material-symbols-outlined font-normal text-sm">diversity_3</span>
              </div>
              <h4 className="font-subhead-sm text-sm font-semibold">Cultural / 文化对接</h4>
            </div>
            <p className="font-label-cn-rg text-secondary text-xs leading-relaxed mb-4 font-normal">
              Understanding of nuance and social grace. Current: Exceptional. Festive greetings shared.
            </p>
            <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '92%' }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                className="bg-primary-container h-full rounded-full"
              ></motion.div>
            </div>
          </motion.div>
        </section>

        {/* Supplier Guanxi Table */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="bg-surface-container-lowest border border-border-light rounded-[24px] overflow-hidden shadow-sm"
        >
          <div className="px-8 py-6 border-b border-border-light flex justify-between items-center flex-wrap gap-4">
            <h3 className="font-headline-md text-[18px] font-medium">Supplier Portfolio Status / 供应商投资组合状态</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-muted text-subtitle-grey font-label-cn-bold text-xs uppercase">
                <tr>
                  <th className="px-8 py-4">Supplier / 供应商</th>
                  <th className="px-8 py-4">Score / 分数</th>
                  <th className="px-8 py-4">Trend / 趋势</th>
                  <th className="px-8 py-4">Status / 状态</th>
                  <th className="px-8 py-4 font-semibold">Last Message</th>
                  <th className="px-8 py-4 font-semibold text-center text-primary">Rui AI Tip / 提示</th>
                  <th className="px-8 py-4 text-right">Action / 操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light font-label-cn-rg text-[13px] text-secondary">
                {displayedSuppliers.map((sup, idx) => {
                  const trend = sup.guanxiTrend || 0;
                  const trendColor = trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-subtitle-grey';
                  const trendIcon = trend > 0 ? 'trending_up' : trend < 0 ? 'trending_down' : 'trending_flat';
                  const trendText = trend === 0 ? '--' : `${trend > 0 ? '+' : ''}${trend}%`;

                  return (
                    <motion.tr 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + idx * 0.05, duration: 0.5 }}
                      key={sup.id} 
                      className="hover:bg-surface-muted/40 transition-colors"
                    >
                      <td className="px-8 py-6 font-medium text-on-surface">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center font-medium text-primary overflow-hidden border border-border-light">
                            {sup.logoUrl ? (
                              <img src={sup.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              sup.englishName.charAt(0)
                            )}
                          </div>
                          <span>{sup.englishName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-primary w-6">{sup.guanxiScore}</span>
                          <div className="w-24 bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${sup.guanxiScore}%` }}
                              transition={{ duration: 1, ease: "easeOut", delay: 0.2 + idx * 0.05 }}
                              className="bg-primary h-full" 
                            ></motion.div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-8 py-6 ${trendColor} font-semibold`}>
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">{trendIcon}</span>
                          {trendText}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {sup.guanxiScore >= 80 ? (
                          <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-green-50 text-green-700 border border-green-200">Optimal</span>
                        ) : sup.guanxiScore >= 60 ? (
                          <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200">Healthy</span>
                        ) : sup.guanxiScore >= 40 ? (
                          <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-orange-50 text-orange-700 border border-orange-200">Building</span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-red-50 text-red-700 border border-red-200">Critical</span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-xs font-normal text-subtitle-grey max-w-[280px]">
                        <div className="max-h-[64px] overflow-y-auto scrollbar-thin pr-1 text-subtitle-grey leading-relaxed whitespace-normal break-words">
                          {(sup.lastContactText || "").split(' - ')[0]}
                        </div>
                      </td>
                      <td className="px-8 py-6 font-semibold text-primary italic text-center text-xs max-w-[280px]">
                        <div className="leading-relaxed whitespace-normal break-words">
                          "{getDynamicRuiTip(sup)}"
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right font-semibold text-primary">
                        <button onClick={() => onNavigate('negotiation-room', { supplierId: sup.id })} className="hover:underline cursor-pointer">Negotiate</button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
export default GuanxiMeterScreen;
