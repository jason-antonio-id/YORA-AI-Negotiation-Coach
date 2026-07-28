import React, { useState, useEffect } from 'react';
import { ScreenType, Supplier } from '../types';
import { useSupabase } from '../lib/SupabaseContext';
import { supabase, resolveStorageUrl } from '../lib/supabase';

interface ProfileProps {
  onNavigate: (screen: ScreenType, params?: { supplierId?: string }) => void;
  supplier: Supplier;
  notificationsEnabled?: boolean;
  onEditSupplier?: (supplier: Supplier) => void;
  aiLang?: string;
}

function getRuisMemo(supplier: Supplier): string {
  const parts: string[] = [];

  // 1. Relationship/Guanxi Level
  if (supplier.guanxiScore >= 75) {
    parts.push(`Excellent Guanxi score of ${supplier.guanxiScore}/100 with ${supplier.englishName}. They value our collaboration, meaning we can confidently request better credit terms or customized product specs.`);
  } else if (supplier.guanxiScore >= 50) {
    parts.push(`Moderate Guanxi score of ${supplier.guanxiScore}/100. The commercial foundation is healthy but relationship-specific trust needs regular cultivation via personal touches.`);
  } else {
    parts.push(`Guanxi score is critically low (${supplier.guanxiScore}/100). Focus entirely on building interpersonal rapport first. Frame requests politely, respect protocols, and avoid high-pressure price negotiations.`);
  }

  // 2. Pricing margin/threshold
  if (supplier.targetPrice) {
    const target = parseFloat(supplier.targetPrice);
    const startPrice = parseFloat(supplier.currentPrice || supplier.walkAwayPrice || '0');
    if (startPrice > 0 && target > 0) {
      const margin = ((startPrice - target) / startPrice) * 100;
      if (margin > 15) {
        parts.push(`There is a significant pricing gap of ${margin.toFixed(0)}% between their asking price (¥${startPrice}) and our goal (¥${target}). Suggest starting with a bundle strategy or offering a higher deposit as a compromise.`);
      } else {
        parts.push(`The gap between their starting offer (¥${startPrice}) and our target (¥${target}) is relatively small. We should be able to resolve this through direct, collaborative discussion.`);
      }
    }
  }

  // 3. Strategic goal / urgency
  if (supplier.urgencyLevel === 'High' || supplier.urgencyLevel === 'Critical') {
    parts.push(`With ${supplier.urgencyLevel} deal urgency, avoid protracted stalemates. Keep communication pathways highly active via WeChat.`);
  } else {
    parts.push(`Due to standard/low urgency levels, time is on our side. Patience in Chinese negotiations often signals absolute maturity and strongest alternative leverage.`);
  }

  // 4. Goal matching
  if (supplier.negotiationGoal === 'Lowest Price / 最低价格') {
    parts.push(`Our primary goal is price containment. Highlight our commitment to their domestic business network if they help us hit key cost metrics.`);
  } else if (supplier.negotiationGoal) {
    parts.push(`Aligning closely with our goal: "${supplier.negotiationGoal}". Let's prioritize quality assurance and clear logistics thresholds to lock in a sustainable agreement.`);
  }

  return parts.join(' ');
}

export function SupplierProfileScreen({ onNavigate, supplier, notificationsEnabled, onEditSupplier, aiLang = 'Bahasa Indonesia' }: ProfileProps) {
  const { user } = useSupabase();
  const [aiMemo, setAiMemo] = useState<string>('');
  const [loadingMemo, setLoadingMemo] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExportHistory = async () => {
    if (!user) {
      alert("Please sign in to export negotiation history.");
      return;
    }
    setIsExporting(true);
    try {
      const { data: messagesList, error: fetchErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: true });
      if (fetchErr) throw fetchErr;
      
      if (!messagesList || messagesList.length === 0) {
        alert("No negotiation history exists yet for this supplier.");
        setIsExporting(false);
        return;
      }

      let markdown = `# YORA Negotiation Log: ${supplier.englishName || 'Supplier'} (${supplier.chineseName || ''})\n`;
      markdown += `Generated on: ${new Date().toLocaleString()}\n`;
      markdown += `---\n\n`;
      markdown += `## Supplier Demographics & Parameters\n`;
      markdown += `- **WeChat ID**: ${supplier.wechatId || 'N/A'}\n`;
      markdown += `- **Category/Product**: ${supplier.category || ''} - ${supplier.productName || ''}\n`;
      markdown += `- **Current Negotiation Price**: ¥${supplier.currentPrice || 'N/A'}\n`;
      markdown += `- **Target Price**: ¥${supplier.targetPrice || 'N/A'}\n`;
      markdown += `- **Walk-away Price Limit**: ¥${supplier.walkAwayPrice || 'N/A'}\n`;
      markdown += `- **Minimum Order Quantity (MOQ)**: ${supplier.moq || 'N/A'}\n`;
      markdown += `- **Guanxi (Relationship) Score**: ${supplier.guanxiScore || 50}/100\n\n`;
      markdown += `## Chat Log Transcript & Strategic Guidance\n\n`;

      const parseAnalysis = (aiAnalysis: string) => {
        const segments: Record<string, string> = {
          translation: '',
          realMeaning: '',
          guanxiTone: '',
          copyReadyReply: '',
          nextMove: ''
        };
        const cleanStr = aiAnalysis.replace(/```markdown\n|```/g, '');
        const transIdx = cleanStr.indexOf('A. TRANSLATION:');
        const meaningIdx = cleanStr.indexOf('B. REAL MEANING:');
        const guanxiIdx = cleanStr.indexOf('C. GUANXI & TONE:');
        const replyIdx = cleanStr.indexOf('D. SUGGESTED REPLY:');
        const moveIdx = cleanStr.indexOf('E. NEXT MOVE:');

        if (transIdx !== -1) {
          segments.translation = cleanStr.substring(transIdx + 15, meaningIdx !== -1 ? meaningIdx : undefined).trim();
        }
        if (meaningIdx !== -1) {
          segments.realMeaning = cleanStr.substring(meaningIdx + 16, guanxiIdx !== -1 ? guanxiIdx : undefined).trim();
        }
        if (guanxiIdx !== -1) {
          segments.guanxiTone = cleanStr.substring(guanxiIdx + 17, replyIdx !== -1 ? replyIdx : undefined).trim();
        }
        if (replyIdx !== -1) {
          segments.copyReadyReply = cleanStr.substring(replyIdx + 19, moveIdx !== -1 ? moveIdx : undefined).trim();
        }
        if (moveIdx !== -1) {
          segments.nextMove = cleanStr.substring(moveIdx + 13).trim();
        }
        return segments;
      };

      messagesList.forEach((m, idx) => {
        const senderLabel = m.sender === 'ai' ? 'Rui (AI Strategist)' : m.sender === 'user' ? 'You' : m.sender === 'supplier' ? `${supplier.englishName} (Supplier)` : 'System';
        const timestamp = m.timeText || (m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString() : '');
        
        markdown += `### [${idx + 1}] ${senderLabel} [${timestamp}]\n`;
        markdown += `${m.text}\n\n`;

        if (m.sender === 'ai' && m.analysis) {
          try {
            const parsed = parseAnalysis(m.analysis);
            markdown += `> **Rui Strategy Breakdown:**\n`;
            markdown += `> - *Sourced Translation:* ${parsed.translation || 'N/A'}\n`;
            markdown += `> - *Real Hidden Meaning:* ${parsed.realMeaning || 'N/A'}\n`;
            markdown += `> - *Guanxi Relationship Tone:* ${parsed.guanxiTone || 'N/A'}\n`;
            markdown += `> - *Suggested Action/Reply:* ${parsed.copyReadyReply || 'N/A'}\n`;
            markdown += `> - *Next Tactical Move:* ${parsed.nextMove || 'N/A'}\n\n`;
          } catch (e) {}
        }
        markdown += `---\n\n`;
      });

      markdown += `\n*End of Negotiation Record. Generated securely within YORA Workspace © 2026.*\n`;

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `YORA_Negotiation_Log_${supplier.englishName || 'Supplier'}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failure:", err);
      alert("Failed to export due to database query error.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchMemo = async () => {
      setLoadingMemo(true);
      try {
        const idToken = await user?.getIdToken();
        const res = await fetch('/api/generate-memo', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken || ''}`
          },
          body: JSON.stringify({ supplier, aiLang })
        });
        if (res.ok) {
          const data = await res.json();
          if (active && data.memo) {
            setAiMemo(data.memo);
          }
        }
      } catch (err) {
        console.error("Failed to generate real-time memo", err);
      } finally {
        if (active) setLoadingMemo(false);
      }
    };

    fetchMemo();
    return () => {
      active = false;
    };
  }, [supplier.id, aiLang, user]);

  const handleRegenerateMemo = async () => {
    setLoadingMemo(true);
    try {
      const idToken = await user?.getIdToken();
      const res = await fetch('/api/generate-memo', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken || ''}`
        },
        body: JSON.stringify({ supplier, aiLang })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.memo) {
          setAiMemo(data.memo);
        }
      }
    } catch (err) {
      console.error("Failed to regenerate memo", err);
    } finally {
      setLoadingMemo(false);
    }
  };

  return (
    <div className="flex-grow flex flex-col min-h-screen bg-background font-body-rg text-on-surface">
      <header className="flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop bg-surface-container-lowest border-b border-border-light z-50 sticky top-0 shrink-0">
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
          <div className="flex items-center gap-2 cursor-pointer shrink-0 hidden sm:flex" onClick={() => onNavigate('dashboard-active')}>
            <span className="material-symbols-outlined text-secondary text-sm font-bold">arrow_back</span>
            <span className="font-subhead-sm text-on-background text-[11px] md:text-sm font-bold">
              Profile / <span className="font-bold text-subtitle-grey">供应商详情</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
        </div>
      </header>

      <main className="px-4 sm:px-6 md:px-margin-desktop max-w-4xl mx-auto w-full pt-6 pb-24 md:py-12 animate-fade-in-up">
        <div className="bg-white rounded-3xl border border-border-light shadow-xl overflow-hidden">
          {/* Cover / Header Section */}
          <div className="h-48 bg-gradient-to-r from-primary/10 to-primary/5 relative">
            <div className="absolute -bottom-12 left-10 p-2 bg-white rounded-2xl border border-border-light shadow-lg">
              <div className="w-24 h-24 bg-surface-muted rounded-xl flex items-center justify-center font-bold text-secondary text-2xl">
                 {supplier.logoUrl ? <img src={supplier.logoUrl} className="w-full h-full object-contain p-1" /> : supplier.englishName.substring(0, 2).toUpperCase()}
              </div>
            </div>
          </div>

          <div className="pt-16 pb-10 px-10">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div>
                <h1 className="text-3xl font-bold text-on-surface">{supplier.englishName}</h1>
                <p className="text-lg font-medium text-subtitle-grey font-label-cn-rg">{supplier.chineseName}</p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-200">
                    {supplier.status}
                  </span>
                  <span className="px-3 py-1 bg-primary/5 text-primary rounded-full text-xs font-bold border border-primary/10">
                    Score: {supplier.guanxiScore}/100
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleExportHistory}
                  disabled={isExporting}
                  className="px-5 py-3 bg-white text-secondary font-bold rounded-xl border border-border-light shadow hover:bg-surface-muted transition-all cursor-pointer flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {isExporting ? 'Exporting...' : 'Export History'}
                </button>
                <button 
                  onClick={() => onNavigate('negotiation-room', { supplierId: supplier.id })}
                  className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-container transition-all cursor-pointer"
                >
                  Enter Room
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-12 pt-10 border-t border-border-light/50">
              <div className="space-y-8">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtitle-grey mb-4 font-bold">Contact Details | 联系方式</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-surface-muted rounded-xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-secondary text-[20px]">chat</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-subtitle-grey uppercase">WeChat ID</p>
                        <p className="text-sm font-medium">{supplier.wechatId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-surface-muted rounded-xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-secondary text-[20px]">language</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-subtitle-grey uppercase">Website</p>
                        <a 
                          href={supplier.url ? (supplier.url.startsWith('http') ? supplier.url : `https://${supplier.url}`) : '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="text-sm font-medium text-primary hover:underline break-all block"
                        >
                          {supplier.url || "No website specified"}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-surface-muted rounded-xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-secondary text-[20px]">location_on</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-subtitle-grey uppercase">Location</p>
                        <p className="text-sm font-medium">{supplier.city}, {supplier.province}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtitle-grey mb-4">Strategy Summary | 战略摘要</h3>
                  <p className="text-sm font-normal leading-relaxed text-secondary italic border-l-4 border-primary/20 pl-4 py-2">
                    {supplier.latestAnalysis?.nextMove || "Initial engagement. Focus on building trust and establishing target quality standards before deep price negotiation."}
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-subtitle-grey mb-4">Product Match | 产品匹配</h3>
                  <div className="p-6 bg-surface-muted/30 rounded-2xl border border-border-light">
                    <p className="text-[10px] font-bold text-subtitle-grey uppercase mb-1">Primary Product</p>
                    <p className="text-lg font-bold text-secondary mb-4">{supplier.productName || "Various Components"}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded-xl border border-border-light">
                        <p className="text-[9px] font-bold text-subtitle-grey uppercase">Target Price</p>
                        <p className="text-sm font-bold text-primary">¥{supplier.targetPrice || "0.00"}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-border-light">
                        <p className="text-[9px] font-bold text-subtitle-grey uppercase">MOQ</p>
                        <p className="text-sm font-bold text-secondary">{supplier.moq || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 relative">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest">Rui's Memo</h4>
                    <button 
                      onClick={handleRegenerateMemo}
                      disabled={loadingMemo}
                      className="text-[10px] uppercase font-bold text-primary flex items-center gap-1 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${loadingMemo ? 'animate-spin' : ''}`}>refresh</span>
                      {loadingMemo ? 'Analyzing...' : 'Regenerate'}
                    </button>
                  </div>
                  <p className="text-[13px] leading-relaxed font-normal text-on-surface">
                    {loadingMemo && !aiMemo ? (
                      <span className="opacity-50 italic">Rui is analyzing supplier details in real time...</span>
                    ) : (
                      `"${aiMemo || getRuisMemo(supplier)}"`
                    )}
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
