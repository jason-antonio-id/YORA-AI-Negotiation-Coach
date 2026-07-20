import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ScreenType, Supplier } from '../types';
import { resolveStorageUrl } from '../lib/supabase';

interface DashboardProps {
  onNavigate: (screen: ScreenType, params?: any) => void;
  suppliers: Supplier[];
  setAddedSupplier: (supplier: Supplier | null) => void;
  onDeleteSupplier: (id: string) => void;
  userData: any;
  notificationsEnabled?: boolean;
}

export function DashboardActive({ onNavigate, suppliers, onDeleteSupplier, userData, notificationsEnabled }: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('en-US', { 
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
  });
  const formattedTime = currentTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
  });

  // Calculations for KPIs
  const avgGuanxiScore = Math.round(
    suppliers.reduce((acc, s) => acc + s.guanxiScore, 0) / suppliers.length
  ) || 0;
  
  const totalSuppliers = suppliers.length;
  const activeRooms = suppliers.length;
  // Cultural Alerts represent suppliers that are "At Risk" or "High Priority"
  const culturalAlerts = suppliers.filter(s => s.status === 'At Risk' || s.status === 'High Priority').length;

  const filteredSuppliers = suppliers.filter(s => {
    const q = searchTerm.toLowerCase();
    return s.chineseName.toLowerCase().includes(q) ||
           s.englishName.toLowerCase().includes(q) ||
           (s.productName && s.productName.toLowerCase().includes(q));
  });

  return (
    <div className="flex-grow flex flex-col min-h-screen text-on-surface font-body-rg selection:bg-primary-fixed">
      {/* TopAppBar */}
      <header className="flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop bg-surface-container-lowest border-b border-border-light sticky top-0 shrink-0 z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer shrink-0 min-w-[130px] sm:min-w-[180px]" onClick={() => onNavigate('dashboard-active')}>
            <img
              alt="YORA Logo"
              className="h-10 sm:h-11 w-auto object-contain"
              src="https://i.ibb.co.com/k2c1SPn8/1.png"
            />
            <div className="flex flex-col justify-center">
              <span className="font-display-lg text-base sm:text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
              <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
            </div>
          </div>
          <div className="h-6 w-[1px] bg-border-light mx-2 hidden sm:block"></div>
          <div className="flex flex-col hidden sm:flex">
            <h2 className="font-subhead-sm text-on-background text-[11px] md:text-sm flex items-center gap-2 font-bold leading-tight">
              Dashboard / <span className="font-bold text-subtitle-grey">仪表板</span>
            </h2>
            <p className="text-[10px] text-subtitle-grey font-normal leading-tight">
              Welcome back, {userData.fullName.split(' ')[0]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <motion.button 
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate('wizard-step1')}
            className="bg-primary text-white px-4 md:px-6 py-2 md:py-2.5 rounded-lg flex items-center gap-2 font-subhead-sm text-[13px] md:text-[14px] hover:bg-primary-container transition-all shadow-lg shadow-primary/10 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">add</span>
            <span className="hidden sm:inline">Add Supplier | <span className="font-label-cn-bold text-[11px] font-normal">添加供应商</span></span>
            <span className="sm:hidden font-label-cn-bold">Add</span>
          </motion.button>

          <motion.div 
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="w-9 h-9 rounded-full bg-surface-container-highest overflow-hidden border border-border-light shadow-sm cursor-pointer flex items-center justify-center animate-fade-in" 
            onClick={() => onNavigate('settings')}
          >
            <span className="material-symbols-outlined text-subtitle-grey text-xl">person</span>
          </motion.div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="p-6 md:p-margin-desktop max-w-container-max mx-auto w-full space-y-gutter flex-grow relative z-0">
        
        {/* KPI Row: 4 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter animate-fade-in">
          {/* Avg Guanxi Score (THE ONE RED ELEMENT RULE applied to first critical KPI) */}
          <motion.div 
            whileHover={{ y: -6, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.04), 0 8px 10px -6px rgba(0,0,0,0.04)" }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="bg-white p-6 rounded-[20px] shadow-sm border border-border-light relative overflow-hidden group hover:shadow-md transition-all duration-300"
          >
            <div className="flex flex-col h-full justify-between relative z-10">
              <div className="flex flex-col gap-1">
                <span className="text-secondary text-[11px] font-medium uppercase tracking-[0.1em]">Avg Guanxi Score</span>
                <span className="font-label-cn-rg text-[11px] text-subtitle-grey font-normal">平均关系评分</span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display-lg text-primary text-5xl leading-none font-semibold">{avgGuanxiScore}</span>
                <span className="text-primary font-normal text-lg opacity-60">/100</span>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 text-primary group-hover:scale-110 transition-transform duration-500">
              <span className="material-symbols-outlined !text-[100px]" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
            </div>
          </motion.div>

          {/* Supplier Count */}
          <motion.div 
            whileHover={{ y: -6, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.04), 0 8px 10px -6px rgba(0,0,0,0.04)" }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="bg-white p-6 rounded-[20px] shadow-sm border border-border-light relative overflow-hidden group hover:shadow-md transition-all duration-300"
          >
            <div className="flex flex-col h-full justify-between relative z-10">
              <div className="flex flex-col gap-1">
                <span className="text-secondary text-[11px] font-medium uppercase tracking-[0.1em]">Total Suppliers</span>
                <span className="font-label-cn-rg text-[11px] text-subtitle-grey font-normal">总供应商</span>
              </div>
              <div className="mt-4">
                <span className="font-display-lg text-on-surface text-5xl leading-none font-semibold">{totalSuppliers}</span>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 text-on-surface scale-90">
              <span className="material-symbols-outlined !text-[100px]" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
            </div>
          </motion.div>

          {/* Open Negotiations */}
          <motion.div 
            whileHover={{ y: -6, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.04), 0 8px 10px -6px rgba(0,0,0,0.04)" }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="bg-white p-6 rounded-[20px] shadow-sm border border-border-light relative overflow-hidden group hover:shadow-md transition-all duration-300"
          >
            <div className="flex flex-col h-full justify-between relative z-10">
              <div className="flex flex-col gap-1">
                <span className="text-secondary text-[11px] font-medium uppercase tracking-[0.1em]">Active Rooms</span>
                <span className="font-label-cn-rg text-[11px] text-subtitle-grey font-normal">正在进行的谈判</span>
              </div>
              <div className="mt-4">
                <span className="font-display-lg text-on-surface text-5xl leading-none font-semibold">{activeRooms < 10 ? `0${activeRooms}` : activeRooms}</span>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 text-on-surface scale-90">
              <span className="material-symbols-outlined !text-[100px]" style={{ fontVariationSettings: "'FILL' 1" }}>handshake</span>
            </div>
          </motion.div>

          {/* Cultural Alerts */}
          <motion.div 
            whileHover={{ y: -6, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.04), 0 8px 10px -6px rgba(0,0,0,0.04)" }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="bg-white p-6 rounded-[20px] shadow-sm border border-border-light relative overflow-hidden group hover:shadow-md transition-all duration-300"
          >
            <div className="flex flex-col h-full justify-between relative z-10">
              <div className="flex flex-col gap-1">
                <span className="text-secondary text-[11px] font-medium uppercase tracking-[0.1em]">Cultural Alerts</span>
                <span className="font-label-cn-rg text-[11px] text-subtitle-grey font-normal">文化提醒</span>
              </div>
              <div className="mt-4">
                <span className="font-display-lg text-on-surface text-5xl leading-none font-bold">{culturalAlerts < 10 ? `0${culturalAlerts}` : culturalAlerts}</span>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 text-on-surface scale-90">
              <span className="material-symbols-outlined !text-[100px]" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
            </div>
          </motion.div>
        </div>

        {/* Main Grid: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter pb-24">
          
          {/* Left: Supplier Table (65%) */}
          <section className="lg:col-span-8 flex flex-col gap-gutter animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="bg-white rounded-[24px] shadow-sm border border-border-light overflow-hidden">
              <div className="px-6 py-5 border-b border-border-light flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex flex-col gap-1 mr-auto">
                  <h3 className="font-subhead-sm text-lg font-medium">Strategic Suppliers</h3>
                  <p className="text-[12px] text-subtitle-grey font-label-cn-rg font-normal">战略供应商列表 — Track Guanxi and deal progress.</p>
                </div>
                <div className="relative w-full sm:w-[240px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtitle-grey text-base">search</span>
                  <input
                    type="text"
                    placeholder="Search suppliers..."
                    className="w-full bg-surface-muted border-none pl-9 pr-3 py-2 rounded-xl text-xs font-normal focus:ring-1 focus:ring-primary outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button onClick={() => onNavigate('supplier-list')} className="text-primary text-[13px] font-medium hover:underline hidden sm:block">View All</button>
              </div>

              {/* Mobile Card List View (Visible on < md) */}
              <div className="md:hidden divide-y divide-border-light">
                {filteredSuppliers.map((sup) => (
                  <div
                    key={sup.id}
                    onClick={() => onNavigate('negotiation-room', { supplierId: sup.id })}
                    className="p-5 hover:bg-surface-muted/20 active:bg-surface-muted/50 transition-colors flex flex-col gap-4 cursor-pointer"
                    id={`mobile-supplier-card-${sup.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center font-bold text-secondary text-xs shrink-0">
                          {sup.englishName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-on-surface text-sm truncate">{sup.englishName}</span>
                          <span className="text-[10px] text-subtitle-grey font-label-cn-rg font-normal">{sup.chineseName}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 leading-none whitespace-nowrap ${
                        sup.status === 'Active' 
                          ? 'bg-on-tertiary-container text-tertiary shadow-sm' 
                          : (sup.status === 'High Priority' || sup.status === 'At Risk')
                            ? 'bg-error-container text-error shadow-sm'
                            : 'bg-surface-container-high text-secondary'
                      }`}>
                        {sup.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 text-xs font-medium text-subtitle-grey">
                      <div className="flex flex-col gap-1 w-full max-w-[160px]">
                        <span className="text-[9px] uppercase tracking-wider text-subtitle-grey opacity-75">Guanxi Meter</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 ${
                                sup.guanxiScore > 70 ? 'bg-primary' : sup.guanxiScore > 40 ? 'bg-primary/70' : 'bg-primary/40'
                              }`}
                              style={{ width: `${sup.guanxiScore}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-semibold text-charcoal">{sup.guanxiScore}/100</span>
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('negotiation-room', { supplierId: sup.id });
                          }}
                          className="p-2 text-primary hover:bg-primary/5 active:bg-primary/10 rounded-xl"
                          title="Open Room"
                        >
                          <span className="material-symbols-outlined text-[18px]">handshake</span>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('supplier-profile', { supplierId: sup.id });
                          }}
                          className="p-2 text-secondary hover:bg-secondary/5 rounded-xl"
                          title="Profile"
                        >
                          <span className="material-symbols-outlined text-[18px]">person</span>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(sup.id);
                          }} 
                          className="p-2 text-secondary hover:text-[#E53E3E] hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                          title="Delete Supplier"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredSuppliers.length === 0 && (
                  <div className="p-8 text-center text-subtitle-grey text-xs italic">
                    No suppliers found. Try adding your first vendor to start.
                  </div>
                )}
              </div>

              {/* Desktop Table View (Visible on >= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-muted/50 text-subtitle-grey font-label-cn-rg text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold uppercase">Supplier | 供应商</th>
                      <th className="px-6 py-4 font-semibold uppercase">Status | 状态</th>
                      <th className="px-6 py-4 font-semibold uppercase">Guanxi Meter | 关系表</th>
                      <th className="px-6 py-4 text-right font-semibold uppercase">Actions | 操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {filteredSuppliers.map((sup, idx) => (
                      <tr 
                        key={sup.id} 
                        className="hover:bg-surface-muted/30 transition-colors group cursor-pointer"
                        onClick={() => onNavigate('negotiation-room', { supplierId: sup.id })}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-surface-container-high flex items-center justify-center font-bold text-secondary group-hover:bg-primary/5 group-hover:text-primary transition-colors text-xs">
                              {sup.englishName.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-on-surface text-sm sm:text-base">{sup.englishName}</span>
                              <span className="text-[11px] text-subtitle-grey font-label-cn-rg font-normal">{sup.chineseName}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
                            sup.status === 'Active' 
                              ? 'bg-on-tertiary-container text-tertiary shadow-sm' 
                              : (sup.status === 'High Priority' || sup.status === 'At Risk')
                                ? 'bg-error-container text-error shadow-sm'
                                : 'bg-surface-container-high text-secondary'
                          }`}>
                            {sup.status} | {sup.status === 'Active' ? '活跃' : sup.status === 'Pending' ? '待处理' : sup.status === 'High Priority' ? '高优先级' : '有风险'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-2">
                            <div className="w-24 sm:w-32 bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${
                                  sup.guanxiScore > 70 ? 'bg-primary' : sup.guanxiScore > 40 ? 'bg-primary/70' : 'bg-primary/40'
                                }`}
                                style={{ width: `${sup.guanxiScore}%` }}
                              ></div>
                            </div>
                            <span className="text-[11px] font-medium text-subtitle-grey">
                              {sup.guanxiScore}/100 <span className="font-normal opacity-70">({sup.guanxiScore > 70 ? 'Optimal' : sup.guanxiScore > 40 ? 'Stable' : 'Risk'})</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-1 sm:gap-2">
                            <button className="p-2 text-secondary hover:text-primary hover:bg-primary/5 rounded-full transition-all cursor-pointer">
                              <span className="material-symbols-outlined text-[20px]">handshake</span>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(sup.id);
                              }} 
                              className="p-2 text-secondary hover:text-[#E53E3E] hover:bg-red-50 rounded-full transition-all cursor-pointer"
                              title="Delete Supplier"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); onNavigate('supplier-profile', { supplierId: sup.id }); }} 
                              className="p-2 text-secondary hover:text-primary hover:bg-primary/5 rounded-full transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[20px]">person</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center text-subtitle-grey font-italic">
                          No suppliers found. Try adding your first vendor to start.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Right Stack (35%) */}
          <aside className="lg:col-span-4 flex flex-col gap-gutter animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            
            {/* Guanxi Overview Breakdown */}
            <div className="bg-white p-7 rounded-[24px] shadow-sm border border-border-light hover:shadow-md transition-shadow">
              <div className="flex flex-col gap-1 mb-7">
                <h3 className="font-subhead-sm text-lg font-medium">Guanxi Breakdown</h3>
                <p className="text-[12px] text-subtitle-grey font-label-cn-rg font-normal">Aggregate relationship health metrics.</p>
              </div>
              <div className="space-y-6">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                      Trust | 信任
                    </span>
                    <span className="text-secondary font-bold">78%</span>
                  </div>
                  <div className="w-full bg-surface-muted h-2.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[78%] rounded-full shadow-[0_0_8px_rgba(181,0,11,0.2)]"></div>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                      Reciprocity | 互惠性
                    </span>
                    <span className="text-secondary font-bold">64%</span>
                  </div>
                  <div className="w-full bg-surface-muted h-2.5 rounded-full overflow-hidden">
                    <div className="bg-tertiary h-full w-[64%] rounded-full"></div>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                      Shared History | 共同历史
                    </span>
                    <span className="text-secondary font-bold">42%</span>
                  </div>
                  <div className="w-full bg-surface-muted h-2.5 rounded-full overflow-hidden">
                    <div className="bg-secondary h-full w-[42%] rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

          </aside>
        </div>
      </main>

      {deleteConfirmId && (
        (() => {
          const supplierToDelete = suppliers.find(s => s.id === deleteConfirmId);
          if (!supplierToDelete) return null;
          return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" 
                onClick={() => setDeleteConfirmId(null)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 24 }}
                className="bg-white rounded-2xl p-8 max-w-sm w-full relative z-10 shadow-xl border border-border-light text-center"
              >
                 <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-[#E53E3E] text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>delete_forever</span>
                 </div>
                 <h3 className="text-xl font-bold text-charcoal mb-2">Delete Supplier?</h3>
                 <p className="text-sm text-subtitle-grey mb-8 leading-relaxed font-medium">
                   Are you sure you want to delete <span className="font-bold text-charcoal">{supplierToDelete.englishName}</span>? This will permanently remove their negotiation history and Guanxi metrics.
                 </p>
                 <div className="flex gap-3">
                    <motion.button 
                      whileHover={{ scale: 1.02, backgroundColor: "#C53030" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSupplier(supplierToDelete.id);
                        setDeleteConfirmId(null);
                      }}
                      className="flex-1 py-3 bg-[#E53E3E] text-white rounded-xl text-sm font-bold shadow-md cursor-pointer"
                    >
                      Yes, Delete
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02, backgroundColor: "#E4E4E7" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(null);
                      }}
                      className="flex-1 py-3 bg-surface-muted text-secondary rounded-xl text-sm font-bold cursor-pointer border border-border-light"
                    >
                      Wait, Cancel
                    </motion.button>
                 </div>
              </motion.div>
            </div>
          );
        })()
      )}
    </div>
  );
}
export default DashboardActive;
