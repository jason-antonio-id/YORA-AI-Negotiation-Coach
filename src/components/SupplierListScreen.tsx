import React, { useState } from 'react';
import { ScreenType, Supplier } from '../types';
import { LastContact } from './LastContact';
import { resolveStorageUrl } from '../lib/supabase';

interface SupplierListProps {
  onNavigate: (screen: ScreenType, params?: { supplierId: string }) => void;
  suppliers: Supplier[];
  onDeleteSupplier: (id: string) => void;
}

export function SupplierListScreen({ onNavigate, suppliers, onDeleteSupplier }: SupplierListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'All' | 'Active' | 'High Guanxi' | 'Low Guanxi' | 'New'>('All');
  const [sortBy, setSortBy] = useState<'recent' | 'guanxi' | 'name'>('recent');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const processedSuppliers = suppliers
    .filter(s => {
      const matchesSearch = s.chineseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           s.englishName.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filter === 'All') return matchesSearch;
      if (filter === 'Active') return matchesSearch && (s.status === 'Active' || s.status === 'High Priority' || s.status === 'At Risk');
      if (filter === 'High Guanxi') return matchesSearch && s.guanxiScore >= 70;
      if (filter === 'Low Guanxi') return matchesSearch && s.guanxiScore <= 50;
      if (filter === 'New') return matchesSearch && (s.status === 'Pending' || (s.cooperationHistory && s.cooperationHistory.toLowerCase().includes('potential')));
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'guanxi') return b.guanxiScore - a.guanxiScore;
      if (sortBy === 'name') return a.englishName.localeCompare(b.englishName);
      return 0; // Recent is default array order
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
              <span className="font-display-lg text-base sm:text-lg font-bold text-charcoal leading-none animate-fade-in">YORA | 永睿</span>
              <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
            </div>
          </div>
          <div className="h-6 w-[1px] bg-border-light mx-2 hidden sm:block"></div>
          <h2 className="font-subhead-sm text-on-background text-[11px] md:text-sm font-bold hidden sm:block">
            Suppliers / <span className="font-bold text-subtitle-grey">供应商</span>
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border border-border-light cursor-pointer bg-surface-container-highest" onClick={() => onNavigate('settings')}>
            <span className="material-symbols-outlined text-subtitle-grey text-lg">person</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 sm:p-6 md:p-margin-desktop max-w-container-max mx-auto w-full space-y-gutter flex-grow animate-fade-in relative z-0">
        
        {/* Big Title Section */}
        <div className="w-full flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="flex flex-col gap-2">
            <h1 className="font-display-lg text-2xl sm:text-[40px] font-bold text-on-surface leading-tight tracking-tight">My Suppliers</h1>
            <p className="font-body-rg text-subtitle-grey text-xs sm:text-base md:text-lg font-normal">Manage your strategic partnerships and cross-border negotiations.</p>
          </div>
          <button 
            onClick={() => onNavigate('wizard-step1')}
            className="w-full sm:w-auto bg-primary text-white flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold shadow-xl shadow-primary/20 hover:bg-primary-container transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            Add Supplier
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="w-full flex flex-col lg:flex-row items-center gap-4 sm:gap-6 mb-12">
          {/* Search Box */}
          <div className="relative w-full lg:w-[320px]">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-border-light rounded-[18px] focus:ring-2 focus:ring-primary/5 focus:border-primary outline-none transition-all font-medium text-sm shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Pills */}
          <div className="w-full flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
            {(['All', 'Active', 'High Guanxi', 'Low Guanxi', 'New'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  filter === f
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                    : 'bg-white text-secondary border-border-light hover:border-primary/40'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="relative w-full lg:w-fit lg:ml-auto shrink-0">
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full lg:w-56 appearance-none bg-white border border-border-light px-5 py-3.5 rounded-[18px] font-medium text-on-surface text-sm focus:border-primary outline-none cursor-pointer shadow-sm pr-10"
            >
              <option value="recent">Sort: Recent Activity</option>
              <option value="guanxi">Sort: Guanxi Score</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">expand_more</span>
          </div>
        </div>

        {/* Supplier Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
          {processedSuppliers.map((sup) => (
            <div 
              key={sup.id} 
              className="bg-white border border-border-light rounded-[24px] shadow-sm p-6 group hover:border-primary/20 transition-all duration-300 cursor-pointer"
              onClick={() => onNavigate('negotiation-room', { supplierId: sup.id })}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-xl bg-surface-muted overflow-hidden border border-border-light bg-white flex items-center justify-center">
                    {sup.logoUrl ? (
                      <img alt={sup.englishName} className="w-full h-full object-contain p-1" src={sup.logoUrl} />
                    ) : (
                      <span className="font-medium text-secondary text-xl">{sup.englishName.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-subhead-sm text-lg font-medium text-on-surface mb-1 group-hover:text-primary transition-colors">{sup.englishName}</h3>
                    <div className="flex items-center gap-2 text-subtitle-grey text-sm font-normal">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      <span>{sup.city}, China</span>
                    </div>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  sup.status === 'Active' ? 'bg-green-50 text-green-700' : 
                  sup.status === 'High Priority' ? 'bg-green-50 text-green-700' :
                  sup.status === 'At Risk' ? 'bg-red-50 text-red-700' : 'bg-surface-muted text-secondary'
                }`}>
                  {sup.status}
                </span>
              </div>

              <div className="mb-6">
                <p className="text-secondary text-[11px] font-medium uppercase tracking-widest mb-3 opacity-60">Core Products</p>
                <div className="flex flex-wrap gap-2">
                  {sup.coreProducts.slice(0, 2).map((p, i) => (
                    <span key={i} className="px-3 py-1.5 bg-surface-muted text-on-surface text-[12px] font-medium rounded-lg border border-border-light/40">
                      {p}
                    </span>
                  ))}
                  {sup.coreProducts.length > 2 && (
                    <span className="px-3 py-1.5 bg-surface-muted text-on-surface text-[12px] font-medium rounded-lg border border-border-light/40">
                      +{sup.coreProducts.length - 2} more
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-surface-muted/50 rounded-2xl p-5 mb-6 border border-border-light/30">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-label-cn-bold text-[12px] font-medium text-secondary uppercase tracking-wider">Guanxi Meter | 关系表</span>
                  <span className={`font-bold text-sm ${sup.guanxiScore > 70 ? 'text-primary' : 'text-secondary'}`}>Score: {sup.guanxiScore}</span>
                </div>
                <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 rounded-full ${sup.guanxiScore > 70 ? 'bg-primary shadow-[0_0_8px_rgba(181,0,11,0.3)]' : 'bg-secondary'}`}
                    style={{ width: `${sup.guanxiScore}%` }}
                  ></div>
                </div>
                <LastContact text={sup.lastContactText} />
              </div>

              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); onNavigate('negotiation-room', { supplierId: sup.id }); }}
                  className="flex-grow bg-primary text-white py-3 text-xs sm:text-sm rounded-xl font-bold shadow-lg shadow-primary/10 hover:bg-primary-container transition-all active:scale-95 cursor-pointer px-2 sm:px-4 text-center whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  <span className="hidden sm:inline">Open Negotiation Room</span>
                  <span className="sm:hidden">Open Room</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(sup.id);
                  }}
                  className="p-3 sm:px-5 sm:py-3.5 border border-error/30 text-error rounded-xl hover:bg-red-50 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  title="Delete Supplier"
                >
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">delete</span>
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate('supplier-profile', { supplierId: sup.id });
                  }}
                  className="p-3 sm:px-5 sm:py-3.5 border border-border-light text-on-surface rounded-xl hover:bg-surface-muted transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">visibility</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {deleteConfirmId && (
        (() => {
          const supplierToDelete = suppliers.find(s => s.id === deleteConfirmId);
          if (!supplierToDelete) return null;
          return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)}></div>
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full relative z-10 shadow-xl border border-border-light text-center animate-fade-in-up">
                 <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-[#E53E3E] text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>delete_forever</span>
                 </div>
                 <h3 className="text-xl font-bold text-charcoal mb-2">Delete Supplier?</h3>
                 <p className="text-sm text-subtitle-grey mb-8 leading-relaxed font-medium">
                   Are you sure you want to delete <span className="font-bold text-charcoal">{supplierToDelete.englishName}</span>? This will permanently remove their negotiation history and Guanxi metrics.
                 </p>
                 <div className="flex gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSupplier(supplierToDelete.id);
                        setDeleteConfirmId(null);
                      }}
                      className="flex-1 py-3 bg-[#E53E3E] hover:bg-[#C53030] text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      Yes, Delete
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(null);
                      }}
                      className="flex-1 py-3 bg-surface-muted text-secondary rounded-xl text-sm font-bold hover:bg-surface-variant transition-all active:scale-95 cursor-pointer border border-border-light"
                    >
                      Wait, Cancel
                    </button>
                 </div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
