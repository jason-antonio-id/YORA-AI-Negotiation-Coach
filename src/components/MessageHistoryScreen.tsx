import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenType, Supplier, ChatMessage } from '../types';
import { useSupabase } from '../lib/SupabaseContext';
import { supabase, resolveStorageUrl } from '../lib/supabase';

interface MessageHistoryProps {
  onNavigate: (screen: ScreenType, params?: { supplierId?: string }) => void;
  suppliers: Supplier[];
  selectedSupplierId?: string | null;
  notificationsEnabled?: boolean;
}

export function MessageHistoryScreen({ onNavigate, suppliers, selectedSupplierId }: MessageHistoryProps) {
  const { user } = useSupabase();
  const [term, setTerm] = useState('');
  const [supplierIdFilter, setSupplierIdFilter] = useState<string>(selectedSupplierId || 'all');
  const [filterType, setFilterType] = useState<'All' | 'Red Flag' | 'Price Move' | 'Contractual' | 'Urgent'>('All');
  const [manualEmpty, setManualEmpty] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});

  useEffect(() => {
    if (!user || suppliers.length === 0) return;

    const fetchAllMessages = async () => {
      const supplierIds = suppliers.map(s => s.id);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .in('supplier_id', supplierIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error loading history messages:", error);
        return;
      }

      if (data) {
        const grouped: Record<string, ChatMessage[]> = {};
        supplierIds.forEach(id => { grouped[id] = []; });

        data.forEach(row => {
          grouped[row.supplier_id] = grouped[row.supplier_id] || [];
          grouped[row.supplier_id].push({
            id: row.id,
            text: row.text,
            sender: row.sender as 'user' | 'supplier' | 'ai',
            createdAt: row.created_at,
            timeText: new Date(row.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            audioUrl: row.audio_url || undefined,
            translation: row.translation || undefined,
            isRedFlag: row.is_red_flag || false,
            isPriceMove: row.is_price_move || false,
            isContractual: row.is_contractual || false,
            isUrgent: row.is_urgent || false,
          });
        });
        setMessagesMap(grouped);
      }
    };

    fetchAllMessages();

    const channel = supabase.channel('chat-messages-history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages'
        },
        () => {
          fetchAllMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, suppliers]);

  // Flatten all messages from all suppliers into a log list
  const historyLogs = suppliers.flatMap(sup => {
    const sMessages = messagesMap[sup.id] || [];
    
    return sMessages
      .filter(m => m.sender === 'supplier' || m.sender === 'ai')
      .map(m => {
        let dateStr = m.timeText;
        let tsValue = new Date().getTime();
        
        if (m.createdAt) {
          try {
            const d = new Date(m.createdAt as string);
            tsValue = d.getTime();
            dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            // fallback stays
          }
        }
        
        return {
          id: m.id,
          supplierId: sup.id,
          timestamp: tsValue, 
          date: dateStr,
          supplier: sup.englishName,
          supplierLogo: sup.logoUrl,
          preview: m.text.length > 60 ? m.text.substring(0, 57) + '...' : m.text,
          outcome: m.sender === 'ai' ? 'Analysis' : 'Supplier Message',
          statusColor: m.sender === 'ai' 
            ? 'bg-error-container text-error border-error-container/40' 
            : 'bg-secondary/15 text-secondary border-secondary/20',
          guanxiChange: (sup.guanxiTrend || 0) >= 0 ? `+${sup.guanxiTrend || 0}` : (sup.guanxiTrend || 0).toString(),
          arrowIcon: (sup.guanxiTrend || 0) >= 0 ? 'trending_up' : 'trending_down',
          arrowColor: (sup.guanxiTrend || 0) >= 0 ? 'text-green-600' : 'text-error'
        };
      });
  }).sort((a, b) => b.timestamp - a.timestamp); // Newer messages (higher timestamp) at top

  const filteredLogs = historyLogs.filter(log => {
    const matchesTerm = log.supplier.toLowerCase().includes(term.toLowerCase()) || log.preview.toLowerCase().includes(term.toLowerCase());
    const matchesSupplier = supplierIdFilter === 'all' || log.supplierId === supplierIdFilter;
    return matchesTerm && matchesSupplier;
  });

  const isEmpty = manualEmpty || filteredLogs.length === 0;

  return (
    <div className="flex-grow flex flex-col min-h-screen font-body-rg text-on-surface antialiased">
      {/* Top App Bar */}
      <header className="flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop bg-surface-container-lowest border-b border-border-light z-50 sticky top-0 shrink-0">
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
            Message History / <span className="font-bold text-subtitle-grey">消息历史</span>
          </h2>
        </div>
      </header>

      <div className="flex-grow overflow-y-auto px-margin-desktop py-stack-lg flex flex-col justify-between">
        <div className="space-y-10">
          {/* Filter Section */}
          <motion.section 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-white rounded-xl border border-border-light p-6 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtitle-grey text-base">search</span>
                <input
                  className="w-full pl-10 pr-4 py-2 bg-surface-muted border-none rounded-lg focus:ring-1 focus:ring-primary outline-none text-xs text-secondary font-semibold"
                  placeholder="Search messages or suppliers... / 搜索消息或供应商..."
                  value={term}
                  onChange={(e) => {
                    setTerm(e.target.value);
                    if (manualEmpty) setManualEmpty(false);
                  }}
                  type="text"
                />
              </div>
                <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtitle-grey text-base font-medium">factory</span>
                <select 
                  value={supplierIdFilter}
                  onChange={(e) => setSupplierIdFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-surface-muted border-none rounded-lg focus:ring-1 focus:ring-primary text-xs font-medium text-secondary appearance-none cursor-pointer"
                >
                  <option value="all">All Suppliers / 所有供应商</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.englishName}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary text-sm">expand_more</span>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-subtitle-grey text-base font-semibold">calendar_today</span>
                <input 
                  className="w-full pl-10 pr-4 py-2 bg-surface-muted border-none rounded-lg focus:ring-1 focus:ring-primary text-xs text-subtitle-grey cursor-pointer" 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-label-cn-bold text-subtitle-grey mr-2 text-xs font-bold">Quick Filters:</span>
              {[
                { key: 'All', label: 'All / 全部' },
                { key: 'Red Flag', label: 'Red Flag / 红旗警示' },
                { key: 'Price Move', label: 'Price Move / 价格变动' },
                { key: 'Contractual', label: 'Contractual / 合同相关' },
                { key: 'Urgent', label: 'Urgent / 紧急' }
              ].map(item => {
                const isActive = filterType === item.key;
                return (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    key={item.key}
                    onClick={() => {
                      setFilterType(item.key as any);
                      if (manualEmpty) setManualEmpty(false);
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary text-white shadow-md shadow-primary/10'
                        : 'bg-surface-muted text-secondary border border-border-light hover:bg-surface-variant'
                    }`}
                  >
                    {item.label}
                  </motion.button>
                );
              })}
            </div>
          </motion.section>

          {/* Content: Table or Empty State */}
          <section className="min-h-[400px]">
            <AnimatePresence mode="wait">
              {!isEmpty ? (
                <motion.div 
                  key="table-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.5 }}
                  id="messages-container"
                >
                  <div className="bg-white rounded-xl border border-border-light overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-muted border-b border-border-light font-label-cn-bold text-subtitle-grey text-xs uppercase font-medium">
                          <th className="px-6 py-4">Date / 日期</th>
                          <th className="px-6 py-4 font-medium">Supplier / 供应商</th>
                          <th className="px-6 py-4 font-medium">Preview / 预览</th>
                          <th className="px-6 py-4 font-medium">AI Outcome / AI 结论</th>
                          <th className="px-6 py-4 text-center font-medium">Guanxi / 关系</th>
                          <th className="px-6 py-4 text-right font-medium">Action / 操作</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm text-secondary divide-y divide-border-light font-normal">
                        {filteredLogs.map((log, idx) => {
                          return (
                            <motion.tr 
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.04, duration: 0.5 }}
                              key={log.id || idx} 
                              className="hover:bg-surface-bright transition-colors"
                            >
                              <td className="px-6 py-4 text-subtitle-grey text-xs">{log.date}</td>
                              <td className="px-6 py-4 font-medium text-on-surface">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center font-medium text-primary overflow-hidden border border-border-light">
                                    {log.supplierLogo ? (
                                      <img src={log.supplierLogo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      log.supplier.charAt(0)
                                    )}
                                  </div>
                                  <span>{log.supplier}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 max-w-xs truncate">{log.preview}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap leading-none ${log.statusColor}`}>
                                  {log.outcome}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className={`flex justify-center items-center gap-1 ${log.arrowColor}`}>
                                  <span className="material-symbols-outlined text-[16px] font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {log.arrowIcon}
                                  </span>
                                  <span className="font-medium">{log.guanxiChange}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right font-semibold">
                                <button onClick={() => onNavigate('negotiation-room', { supplierId: log.supplierId })} className="text-primary hover:underline cursor-pointer">View Analysis</button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty-view"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-border-light border-dashed" 
                  id="empty-state"
                >
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
                    transition={{ 
                      opacity: { duration: 0.35, ease: "easeOut" },
                      scale: { duration: 0.35, ease: "easeOut" },
                      y: { repeat: Infinity, duration: 4, ease: "easeInOut" }
                    }}
                    className="w-72 h-72 mb-8 bg-surface-muted rounded-full flex items-center justify-center overflow-hidden p-4 relative"
                  >
                    <div className="absolute -inset-4 bg-[radial-gradient(circle,rgba(227,6,19,0.15)_0%,transparent_70%)] rounded-full blur-xl z-0 pointer-events-none animate-pulse-slow"></div>
                    <img
                      alt="Empty State Mascot"
                      referrerPolicy="no-referrer"
                      className="w-60 h-60 opacity-100 object-contain relative z-10"
                      src="https://i.ibb.co.com/ZZ9rMnb/1.png"
                    />
                  </motion.div>
                  <h3 className="font-headline-md text-headline-md text-secondary mb-2 text-xl font-bold">No conversations found</h3>
                  <p className="text-subtitle-grey text-sm mb-8">No messages match your current filters. Start a new negotiation to see results.</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-3 bg-on-secondary-fixed text-white rounded-lg font-bold hover:bg-secondary-fixed-dim transition-all shadow-md cursor-pointer text-xs uppercase"
                    onClick={() => {
                      setTerm('');
                      setManualEmpty(false);
                      setFilterType('All');
                    }}
                  >
                    Clear Filters / 清除筛选
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>
    </div>
  );
}
