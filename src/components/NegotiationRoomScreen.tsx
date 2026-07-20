import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenType, ChatMessage, Supplier } from '../types';
import { useSupabase } from '../lib/SupabaseContext';
import { supabase, resolveStorageUrl } from '../lib/supabase';
import { jsPDF } from 'jspdf';

interface NegotiationProps {
  onNavigate: (screen: ScreenType) => void;
  supplier: Supplier;
  onUpdateSupplier: (updated: Supplier) => void;
  userData: any;
}

interface Analysis {
  translation: string;
  realMeaning: string;
  guanxiTone: string;
  copyReadyReply: string;
  nextMove: string;
}

export function NegotiationRoomScreen({ onNavigate, supplier, onUpdateSupplier, userData }: NegotiationProps) {
  const { user } = useSupabase();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [inputText, setInputText] = useState('');
  const [simulatedReply, setSimulatedReply] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [scores, setScores] = useState(supplier.scores || { trust: 50, leverage: 50, urgency: 50 });
  const [analysis, setAnalysis] = useState<Analysis>(supplier.latestAnalysis || {
    translation: "N/A",
    realMeaning: "Awaiting new message...",
    guanxiTone: "Professional, neutral.",
    copyReadyReply: "N/A",
    nextMove: "Observe market trends.",
  });
  
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis' | 'meters'>('chat');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editableReply, setEditableReply] = useState(analysis.copyReadyReply || 'N/A');
  const prevSupIdRef = useRef(supplier?.id);

  const cleanMarkdown = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/\*/g, "") // Remove all asterisks
      .replace(/#/g, "")   // Remove all hashes
      .replace(/^\s*-\s+/gm, "• ") // Convert hyphen lists to bullet circles
      .replace(/\\n/g, "\n"); // Unescape line breaks
  };

  const sanitizeClientField = (val: any, maxLength = 200): string => {
    if (typeof val !== 'string') return '';
    // Strip control sequences, brackets, and templates to prevent injection attacks
    const cleaned = val.replace(/[<>{}[\]\\^`~#$]/g, '');
    return cleaned.substring(0, maxLength);
  };

  useEffect(() => {
    setEditableReply(cleaned => {
      // Clean copy-ready replies of any lingering Markdown characters automatically
      const raw = analysis.copyReadyReply || 'N/A';
      return cleanMarkdown(raw);
    });
  }, [analysis.copyReadyReply]);

  // Update local scores/analysis if the supplier prop changes
  useEffect(() => {
    if (supplier) {
      const idChanged = prevSupIdRef.current !== supplier.id;
      prevSupIdRef.current = supplier.id;

      if (idChanged) {
        setScores(supplier.scores || { trust: 50, leverage: 50, urgency: 50 });
        setAnalysis(supplier.latestAnalysis || {
          translation: "N/A",
          realMeaning: "Awaiting new message...",
          guanxiTone: "Professional, neutral.",
          copyReadyReply: "N/A",
          nextMove: "Observe market trends.",
        });
      } else {
        if (supplier.scores) setScores(supplier.scores);
        if (supplier.latestAnalysis) setAnalysis(supplier.latestAnalysis);
      }
    }
  }, [supplier.id, supplier.scores, supplier.latestAnalysis]);

  const handleSavePrice = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ current_price: tempPrice })
        .eq('id', supplier.id);
      if (error) throw error;
      setIsEditingPrice(false);
    } catch (error) {
      console.error("Failed to update current price:", error);
    }
  };

  // Sync messages with Supabase public.chat_messages
  useEffect(() => {
    if (!user || !supplier.id) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error loading chat messages:", error);
        return;
      }

      if (data) {
        const msgs = data.map(row => ({
          id: row.id,
          text: row.text,
          sender: row.sender as 'user' | 'supplier' | 'ai',
          senderName: row.sender_name || (row.sender === 'user' ? 'Me' : row.sender === 'ai' ? 'Rui' : supplier.englishName),
          createdAt: row.created_at,
          timeText: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          audioUrl: row.audio_url || undefined,
          translation: row.translation || undefined,
          isRedFlag: row.is_red_flag || false,
          isPriceMove: row.is_price_move || false,
          isContractual: row.is_contractual || false,
          isUrgent: row.is_urgent || false,
        }));
        setMessages(msgs);
      }
    };

    fetchMessages();

    const channel = supabase.channel(`chat-messages-${supplier.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `supplier_id=eq.${supplier.id}`
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supplier.id]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const parseAnalysis = (text: string): Analysis => {
    const sections: Analysis = {
      translation: "N/A",
      realMeaning: "Awaiting new message...",
      guanxiTone: "Neutral",
      copyReadyReply: "N/A",
      nextMove: "Continue conversation.",
    };

    if (!text) return sections;
    
    // Find markers and their positions
    const markers = [
      { key: 'translation', labels: ['A. TRANSLATION:', 'A. TRANSLATION', 'A. Translation:', 'A. Translation'] },
      { key: 'realMeaning', labels: ['B. REAL MEANING:', 'B. REAL MEANING', 'B. Real Meaning:', 'B. Real Meaning'] },
      { key: 'guanxiTone', labels: ['C. GUANXI & TONE:', 'C. GUANXI & TONE', 'C. Guanxi & Tone:', 'C. Guanxi & Tone'] },
      { key: 'copyReadyReply', labels: ['D. SUGGESTED REPLY:', 'D. SUGGESTED REPLY', 'D. Suggested Reply:', 'D. Suggested Reply'] },
      { key: 'nextMove', labels: ['E. NEXT MOVE:', 'E. NEXT MOVE', 'E. Next Move:', 'E. Next Move'] },
      { key: 'end', labels: ['[METRICS]', 'RELATIONSHIP_SCORES:'] }
    ];

    const findIndex = (labelGroup: string[]) => {
      for (const label of labelGroup) {
        const idx = text.indexOf(label);
        if (idx !== -1) return { index: idx, length: label.length };
      }
      return { index: -1, length: 0 };
    };

    const positions = markers.map(m => ({ ...m, ...findIndex(m.labels) }));
    
    for (let i = 0; i < positions.length - 1; i++) {
      const current = positions[i];
      if (current.index === -1) continue;

      const start = current.index + current.length;
      let end = text.length;

      // Find the next available marker index
      for (let j = i + 1; j < positions.length; j++) {
        if (positions[j].index !== -1) {
          end = positions[j].index;
          break;
        }
      }

      const content = text.substring(start, end).trim();
      if (content) {
        // Use cleanMarkdown instead of manual cleaning
        (sections as any)[current.key] = cleanMarkdown(content);
      }
    }
    
    return sections;
  };

  const parseConversationalResponse = (text: string): string => {
    if (!text) return "";
    // Look for the conversational block explicitly
    const match = text.match(/\[CONVERSATIONAL_RESPONSE\]\s*([\s\S]*?)(?=\[ANALYSIS\]|A\.\s*(?:TRANSLATION|Translation)|$)/i);
    if (match) return match[1].trim();

    // Fallback: If no markers are present at all, return the whole text
    if (!text.includes('[ANALYSIS]') && !text.includes('A. TRANSLATION') && !text.includes('A. Translation')) {
      return text.trim();
    }

    // Secondary Fallback: Strip everything from the first detection of analysis markers
    const markers = ['[ANALYSIS]', 'A. TRANSLATION', 'A. Translation', '### [ANALYSIS]', 'A.翻译'];
    let cleanest = text;
    for (const marker of markers) {
      const lowerMarker = marker.toLowerCase();
      const index = cleanest.toLowerCase().indexOf(lowerMarker);
      if (index !== -1) {
        cleanest = cleanest.substring(0, index);
      }
    }
    
    // Final cleanup of markers
    return cleanest.replace(/\[CONVERSATIONAL_RESPONSE\]/gi, '').trim();
  };

  const parseScores = (text: string) => {
    if (!text) return null;
    const match = text.match(/RELATIONSHIP_SCORES:\s*({[\s\S]*?})/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {}
    }
    return null;
  };

  const saveConversation = async (newScores?: any, updatedAnalysis?: Analysis) => {
    if (!user) return;
    const finalScores = newScores || scores;
    const finalAnalysis = updatedAnalysis || analysis;

    // Calculate new Guanxi Score
    const calculatedGuanxi = Math.round((finalScores.trust + finalScores.leverage + (100 - finalScores.urgency)) / 3);

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          scores: finalScores,
          latest_analysis: finalAnalysis,
          guanxi_score: calculatedGuanxi,
          guanxi_trend: calculatedGuanxi - (supplier.guanxiScore || 50),
          last_contact_text: messages[messages.length - 1]?.text || supplier.lastContactText
        })
        .eq('id', supplier.id);
      if (error) throw error;
    } catch (error) {
      console.error("Failed to save conversation state:", error);
    }
  };

  const handleExportHistory = async () => {
    if (!messages || messages.length === 0) {
      alert("No messages to export.");
      return;
    }

    const containsCJK = (str: string): boolean => {
      return /[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(str);
    };

    const getMessageBodyImg = (text: string, maxWidthMm: number, fontSizePt = 8.5, textColor = '#3a3a3a', bgColor = '#ffffff'): { dataUrl: string; widthMm: number; heightMm: number; lines: number } => {
      const dpr = 1.5;
      const mmToPx = (mm: number) => mm * 3.7795 * dpr; // px at given dpr for mm conversion
      const maxWidthPx = mmToPx(maxWidthMm);

      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d')!;
      const fontPx = fontSizePt * (96 / 72) * dpr;
      tempCtx.font = `${fontPx}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif`;

      const wrapTextLocal = (str: string, ctx: CanvasRenderingContext2D, maxW: number): string[] => {
        const linesArr: string[] = [];
        let currentLine = '';
        
        // Tokenize into CJK chars, continuous Latin word chunks, spaces, or individual other symbols
        const tokens = str.match(/[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]|[A-Za-z0-9'-]+|\s+|[^\s\u4E00-\u9FFF]/g) || [];

        for (const token of tokens) {
          if (token === '\n') {
            linesArr.push(currentLine);
            currentLine = '';
            continue;
          }
          const testLine = currentLine + token;
          const testWidth = ctx.measureText(testLine).width;
          if (testWidth > maxW) {
            if (currentLine === '') {
              linesArr.push(token);
            } else {
              linesArr.push(currentLine);
              currentLine = token;
            }
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          linesArr.push(currentLine);
        }
        return linesArr;
      };

      const lines = wrapTextLocal(text, tempCtx, maxWidthPx);

      const lineHeightPx = fontPx * 1.35; // 1.35x line height as requested
      const canvasWidthPx = Math.ceil(maxWidthPx);
      const canvasHeightPx = Math.ceil(lineHeightPx * lines.length);

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidthPx;
      canvas.height = canvasHeightPx;
      const ctx = canvas.getContext('2d')!;
      
      // Paint opaque background first to prevent transparent canvas from becoming black when exported as JPEG
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);

      ctx.font = `${fontPx}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'top';

      lines.forEach((line, i) => {
        ctx.fillText(line, 0, i * lineHeightPx);
      });

      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.85),
        widthMm: maxWidthMm,
        heightMm: (canvasHeightPx / dpr) / 3.7795,
        lines: lines.length
      };
    };

    const cleanStringForPDF = (str: string | undefined | null): string => {
      if (!str) return '';
      
      let cleaned = str;
      
      // Replace currency symbols
      cleaned = cleaned.replace(/[¥￥]/g, 'CNY ');
      
      // Replace curly quotes & various dashes
      cleaned = cleaned.replace(/[?”]/g, '"');
      cleaned = cleaned.replace(/[‘’]/g, "'");
      cleaned = cleaned.replace(/[—–]/g, '-');
      cleaned = cleaned.replace(/…/g, '...');
      
      // Replace CJK punctuation with friendly ASCII equivalents
      cleaned = cleaned.replace(/，/g, ', ');
      cleaned = cleaned.replace(/。/g, '. ');
      cleaned = cleaned.replace(/：/g, ': ');
      cleaned = cleaned.replace(/；/g, '; ');
      cleaned = cleaned.replace(/？/g, '? ');
      cleaned = cleaned.replace(/！/g, '! ');
      cleaned = cleaned.replace(/、/g, ', ');
      cleaned = cleaned.replace(/（/g, '(');
      cleaned = cleaned.replace(/）/g, ')');
      cleaned = cleaned.replace(/【/g, '[');
      cleaned = cleaned.replace(/】/g, ']');
      cleaned = cleaned.replace(/《/g, '<');
      cleaned = cleaned.replace(/》/g, '>');
      
      // Now, strip out ALL characters that are not in the standard printable ASCII range (32-126),
      // keeping newlines (\n, \r) and tabs (\t) securely.
      cleaned = cleaned.replace(/[^\t\n\r\x20-\x7E]/g, '');
      
      // Clean up common leftovers like double spaces, trailing pipes, empty parentheses
      cleaned = cleaned.replace(/\(\s*\)/g, '');
      cleaned = cleaned.replace(/\[\s*\]/g, '');
      cleaned = cleaned.replace(/\s*\|\s*/g, ' ');
      cleaned = cleaned.replace(/\s+/g, ' ');
      
      // Strip leading/trailing whitespaces and dangles
      cleaned = cleaned.trim();
      cleaned = cleaned.replace(/^[|/,-]+|[|/,-]+$/g, '');
      return cleaned.trim();
    };

    setIsExporting(true);

    let logoData = { dataUrl: '', aspect: 1.0 };
    let topRightMascotData = { dataUrl: '', aspect: 1.0 };
    let summaryMascotData = { dataUrl: '', aspect: 1.0 };

    try {
      const gLogoUrl = "https://i.ibb.co.com/k2c1SPn8/1.png";
      const gTopRightMascotUrl = "https://i.ibb.co.com/ZZ9rMnb/1.png";
      const gSummaryMascotUrl = resolveStorageUrl("https://i.ibb.co.com/Ndrz72Qf/RUI-EUREKA-MOMENT-BASICS.png");

      const logoUrl = `/api/proxy-image?url=${encodeURIComponent(gLogoUrl)}`;
      const topRightMascotUrl = `/api/proxy-image?url=${encodeURIComponent(gTopRightMascotUrl)}`;
      const summaryMascotUrl = `/api/proxy-image?url=${encodeURIComponent(gSummaryMascotUrl)}`;

      const getBase64ImageFromUrl = (url: string, useJpeg = true): Promise<{ dataUrl: string; aspect: number }> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.setAttribute('crossOrigin', 'anonymous');
          // Add dynamic cache-buster to completely bypass browser CORS-cache pollution
          const cleanUrl = url + (url.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
          img.src = cleanUrl;
          img.onload = () => {
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;

            // Cap dimensions to a max of 800px on the longest side to prevent massive uncompressed sizes
            const maxDim = 800;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              if (useJpeg) {
                // Draw white background before drawing image to avoid transparent areas turning black as JPEG
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
              }
              ctx.drawImage(img, 0, 0, w, h);
              try {
                const dataURL = useJpeg ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png');
                const aspect = w / h;
                resolve({ dataUrl: dataURL, aspect });
                return;
              } catch (e) {
                console.error("toDataURL error", e);
              }
            }
            resolve({ dataUrl: url, aspect: 1.0 });
          };
          img.onerror = () => {
            resolve({ dataUrl: url, aspect: 1.0 });
          };
        });
      };

      const [lData, trData, sData] = await Promise.all([
        getBase64ImageFromUrl(logoUrl, false), // keep PNG for logo for transparent consistency
        getBase64ImageFromUrl(topRightMascotUrl, false), // keep PNG for mascot for pristine transparency
        getBase64ImageFromUrl(summaryMascotUrl, true)  // JPEG is perfect for footer mascots
      ]);
      logoData = lData;
      topRightMascotData = trData;
      summaryMascotData = sData;
    } catch (err) {
      console.error("Error preloading images:", err);
    }

    try {
      const doc = new jsPDF({ compress: true });
      const docId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const formattedDate = new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Helper to generate crisp base64 images of Chinese text dynamically to bypass jsPDF's non-UTF8 limitations
      const getLogoTextImg = (textColor = '#000000') => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return { dataUrl: '', aspect: 1 };

        tempCtx.font = 'bold 28px "Poppins", "Helvetica Neue", "Arial", sans-serif';
        const wYora = tempCtx.measureText('YORA').width;

        tempCtx.font = '26px "Helvetica Neue", "Arial", sans-serif';
        const wDivider = tempCtx.measureText(' | ').width;

        tempCtx.font = 'bold 28px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif';
        const wYongRui = tempCtx.measureText('永睿').width;

        const totalWidth = Math.ceil(wYora + wDivider + wYongRui);
        const height = 36;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return { dataUrl: '', aspect: 1 };

        const dpr = 1.5; // Reduced from 3 to 1.5 as requested
        canvas.width = totalWidth * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, totalWidth, height);
        ctx.textBaseline = 'middle';

        // Draw "YORA"
        ctx.font = 'bold 28px "Poppins", "Helvetica Neue", "Arial", sans-serif';
        ctx.fillStyle = textColor;
        ctx.fillText('YORA', 0, height / 2);

        // Draw " | "
        ctx.font = '26px "Helvetica Neue", "Arial", sans-serif';
        ctx.fillStyle = textColor;
        ctx.fillText(' | ', wYora, height / 2);

        // Draw "永睿"
        ctx.font = 'bold 28px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif';
        ctx.fillStyle = textColor;
        ctx.fillText('永睿', wYora + wDivider, height / 2 - 2);

        return {
          dataUrl: canvas.toDataURL('image/png'),
          aspect: totalWidth / height
        };
      };

      // Helper to draw a precise 4-point polygon / quadrilateral (retained as vector robust fallback)
      const drawQuad = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => {
        doc.triangle(x1, y1, x2, y2, x3, y3, 'F');
        doc.triangle(x1, y1, x3, y3, x4, y4, 'F');
      };

      // Helper to draw the logo programmatically with absolute symmetry and precision
      const drawLogo = (x: number, y: number, size = 8.0) => {
        const s = size / 8.0; // scale factor
        doc.setFillColor(183, 28, 28); // Brand Crimson
        // Left wing
        drawQuad(x, y + 1.2 * s, x + 1.8 * s, y + 1.2 * s, x + 3.3 * s, y + 5.4 * s, x + 1.5 * s, y + 5.4 * s);
        // Right wing
        drawQuad(x + 6.2 * s, y + 1.2 * s, x + 8.0 * s, y + 1.2 * s, x + 6.5 * s, y + 5.4 * s, x + 4.7 * s, y + 5.4 * s);
        // Stem
        doc.rect(x + 3.35 * s, y + 2.0 * s, 1.3 * s, 5.5 * s, 'F');
      };

      const drawStarIcon = (cx: number, cy: number, r = 1.3) => {
        doc.setFillColor(255, 255, 255);
        const pts: number[][] = [];
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const radius = i % 2 === 0 ? r : r * 0.45;
          pts.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
        }
        for (let i = 1; i < 9; i++) {
          doc.triangle(pts[0][0], pts[0][1], pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1], 'F');
        }
      };

      const drawPersonIcon = (cx: number, cy: number, r = 2.8, filled = true) => {
        if (filled) {
          doc.setFillColor(183, 28, 28);
          doc.circle(cx, cy, r, 'F');
          doc.setFillColor(255, 255, 255);
        } else {
          doc.setFillColor(255, 255, 255);
          doc.circle(cx, cy, r, 'F');
          doc.setDrawColor(183, 28, 28);
          doc.setLineWidth(0.25);
          doc.circle(cx, cy, r, 'S');
          doc.setFillColor(183, 28, 28);
        }
        // Head: beautifully proportioned, centered at (cx, cy - 0.55) with radius 0.65
        doc.circle(cx, cy - 0.55, 0.65, 'F');
        
        // Neck: centered at (cx, cy - 0.1) to merge head and shoulders naturally
        doc.rect(cx - 0.175, cy - 0.1, 0.35, 0.4, 'F');
        
        // Shoulders: ellipse centered at (cx, cy + 0.9) with rx=1.3, ry=0.8
        doc.ellipse(cx, cy + 0.9, 1.3, 0.8, 'F');
      };

      const drawBusinessIcon = (cx: number, cy: number, r = 2.8, filled = true) => {
        if (filled) {
          doc.setFillColor(183, 28, 28);
          doc.circle(cx, cy, r, 'F');
          doc.setFillColor(255, 255, 255);
        } else {
          doc.setFillColor(255, 255, 255);
          doc.circle(cx, cy, r, 'F');
          doc.setDrawColor(183, 28, 28);
          doc.setLineWidth(0.25);
          doc.circle(cx, cy, r, 'S');
          doc.setFillColor(183, 28, 28);
        }
        // Perfectly symmetrical factory building with 3 continuous roof peaks and integrated chimney
        // Base structure
        doc.rect(cx - 1.2, cy - 0.1, 2.4, 1.2, 'F');
        
        // 3 continuous roof peaks spanning exactly from -1.2 to +1.2
        doc.triangle(cx - 1.2, cy - 0.1, cx - 0.4, cy - 0.1, cx - 1.2, cy - 0.7, 'F');
        doc.triangle(cx - 0.4, cy - 0.1, cx + 0.4, cy - 0.1, cx - 0.4, cy - 0.7, 'F');
        doc.triangle(cx + 0.4, cy - 0.1, cx + 1.2, cy - 0.1, cx + 0.4, cy - 0.7, 'F');
        
        // Elegant door/entrance centered at the bottom of the base
        doc.rect(cx - 0.3, cy + 0.5, 0.6, 0.6, 'F');
        
        // Professional, thin chimney on the right side emerging elegantly out of the sloping roof
        doc.rect(cx + 0.85, cy - 0.7, 0.22, 0.7, 'F');
      };

      // Helper to draw headers on any page
      const drawPageHeader = (pageNumber: number) => {
        const logoWidth = 11.5;
        const logoHeight = 11.5;
        const logoY = 8.75;

        // Draw actual YORA logo image if available, else fallback to vector
        if (logoData.dataUrl) {
          try {
            doc.addImage(logoData.dataUrl, 'PNG', 15, logoY, logoWidth, logoHeight);
          } catch (e) {
            console.error("Failed to draw logo image, falling back to vector", e);
            drawLogo(15, logoY, logoWidth);
          }
        } else {
          drawLogo(15, logoY, logoWidth);
        }

        const startXOfBranding = 15 + logoWidth + 2.5; // Starts at 29.0

        // Brand Title Text
        const logoTextImg = getLogoTextImg('#000000');
        if (logoTextImg && logoTextImg.dataUrl) {
          const textHeight = 4.8; 
          const textWidth = textHeight * logoTextImg.aspect;
          doc.addImage(logoTextImg.dataUrl, 'PNG', startXOfBranding, 10.5, textWidth, textHeight);
        }

        if (pageNumber > 1) {
          // CONTINUED marker on subsequent pages
          const logoTextImg = getLogoTextImg('#000000');
          const textHeight = 4.8;
          const textWidth = logoTextImg?.aspect ? (textHeight * logoTextImg.aspect) : 25;
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7.2);
          doc.setTextColor(140, 140, 140);
          doc.text("•  CONTINUED", startXOfBranding + textWidth + 3, 14.2);

          // Section header right-aligned
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(120, 120, 120);
          doc.text(`YORA-CHAT-${docId}   •   SECTION 02`, 195, 14.2, { align: "right" });
        } else {
          // Confidential report headers on page 1
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(183, 28, 28);
          doc.text("CONFIDENTIAL NEGOTIATION TRANSCRIPT", 179, 12.8, { align: "right" });

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(110, 110, 110);
          doc.text(`Reference ID: YORA-CHAT-${docId}`, 179, 16.3, { align: "right" });
          doc.text(`Generated: ${formattedDate}`, 179, 19.5, { align: "right" });

          // Waving Rui mascot beautifully displayed on top right of Page 1
          if (topRightMascotData.dataUrl) {
            const headerMascotHeight = 13.5;
            const headerMascotWidth = headerMascotHeight * (topRightMascotData.aspect || 1.0);
            try {
              doc.addImage(topRightMascotData.dataUrl, 'PNG', 195.0 - headerMascotWidth, 7.8, headerMascotWidth, headerMascotHeight);
            } catch (e) {
              console.error("Failed to add header mascot", e);
            }
          }
        }

        // Branch Subtitle Text below logo/title (neatly synchronized with logoTextImg text horizontal start)
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(120, 120, 120);
        doc.text("EVERLASTING INTELLIGENCE   •   CO-PILOT ECOSYSTEM", startXOfBranding, 18.5);

        // Crimson horizontal dividing line
        doc.setDrawColor(183, 28, 28);
        doc.setLineWidth(0.35);
        doc.line(15, 24.5, 195, 24.5);
      };

      // Helper to draw footers on any page
      const drawPageFooter = (pageNumber: number) => {
        // Footer thin boundary line
        doc.setDrawColor(220, 222, 226);
        doc.setLineWidth(0.2);
        doc.line(15, 278, 195, 278);

        // Left brand name as Canvas Image to display "YORA | 永睿" natively in bold black color matching other bottom foot texts
        const footerLogoText = getLogoTextImg('#1a1a1a');
        if (footerLogoText && footerLogoText.dataUrl) {
          const footerTextHeight = 2.4; 
          const footerTextWidth = footerTextHeight * footerLogoText.aspect;
          doc.addImage(footerLogoText.dataUrl, 'PNG', 15, 279.7, footerTextWidth, footerTextHeight);
        }

        // Center footnote text & mascot centered together perfectly without any enclosing outline box
        const footnoteText = "Insight by Rui   •   Your Co-Pilot Intelligence";
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(5.2);
        doc.setTextColor(110, 110, 110);

        const textWidthEst = doc.getStringUnitWidth(footnoteText) * (5.2 / doc.internal.scaleFactor);
        const footerMascotHeight = 4.5;
        const footerMascotWidth = footerMascotHeight * (summaryMascotData.aspect || 1.0);
        const gap = 1.5;
        const totalFooterGroupWidth = footerMascotWidth + gap + textWidthEst;
        const footerGroupStartX = 105 - (totalFooterGroupWidth / 2);

        // Draw proportional footer mascot
        let hasDrawnFooterMascot = false;
        if (summaryMascotData.dataUrl) {
          try {
            doc.addImage(summaryMascotData.dataUrl, 'JPEG', footerGroupStartX, 278.85, footerMascotWidth, footerMascotHeight);
            hasDrawnFooterMascot = true;
          } catch (e) {
            console.error("Failed to add footer mascot image", e);
          }
        }

        if (!hasDrawnFooterMascot) {
          // Fallback circle A
          doc.setFillColor(183, 28, 28);
          doc.circle(footerGroupStartX + 2, 281.0, 1.5, 'F');
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(3.8);
          doc.setTextColor(255, 255, 255);
          doc.text("A", footerGroupStartX + 2, 282.05, { align: "center" });
        }

        // Draw footnote text
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(5.2);
        doc.setTextColor(110, 110, 110);
        doc.text(footnoteText, footerGroupStartX + footerMascotWidth + gap, 281.9);

        // Right metadata & page count
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(6.2);
        doc.setTextColor(120, 120, 120);
        doc.text(`YORA-CHAT-${docId}   •   Page ${pageNumber}`, 195, 282, { align: "right" });
      };

      const drawProcessedBlock = (pb: any, currentSubY: number) => {
        if (pb.isSplit) {
          // 1. Draw main label
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(140, 140, 140);
          doc.text(pb.label, 35.0, currentSubY + 1.5);
          
          let curSubY = currentSubY + 1.8 + 1.2;
          
          // 2. Draw subblocks
          pb.subBlocks.forEach((sb: any, sbIdx: number) => {
            // Sub-label smaller/lighter/italic
            doc.setFont("Helvetica", "italic");
            doc.setFontSize(6.0); // 6pt
            doc.setTextColor(120, 120, 120); // gray
            doc.text(sb.subLabel, 35.0, curSubY + 1.2);
            
            const valY = curSubY + 1.4 + 0.6;
            if (sb.isCJK && sb.imgData) {
              doc.addImage(sb.imgData.dataUrl, 'JPEG', 35.0, valY, 156, sb.imgData.heightMm);
            } else {
              doc.setFont("Helvetica", "normal");
              doc.setFontSize(7.5);
              doc.setTextColor(30, 30, 30);
              sb.textLines.forEach((line: string, lineIdx: number) => {
                doc.text(line, 35.0, valY + (lineIdx * 3.5) + 2.2);
              });
            }
            
            curSubY += sb.height;
            if (sbIdx < pb.subBlocks.length - 1) {
              curSubY += 1.5; // Gap between sub blocks
            }
          });
        } else {
          // Unsplit: Standard behavior
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(140, 140, 140);
          doc.text(pb.label, 35.0, currentSubY + 1.5);

          const valY = currentSubY + 1.8 + 0.8;
          if (pb.isCJK && pb.imgData) {
            doc.addImage(pb.imgData.dataUrl, 'JPEG', 35.0, valY, 156, pb.imgData.heightMm);
          } else {
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(30, 30, 30);
            pb.textLines.forEach((line: string, lineIdx: number) => {
              doc.text(line, 35.0, valY + (lineIdx * 3.5) + 2.2);
            });
          }
        }
      };

      let currentPage = 1;
      drawPageHeader(currentPage);
      drawPageFooter(currentPage);

      let yPos = 32;

      // SECTION 1: NEGOTIATION SUMMARY
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(183, 28, 28);
      doc.text("01", 15, yPos);

      doc.setTextColor(30, 30, 30);
      doc.text("NEGOTIATION SUMMARY", 21, yPos);

      const titleWidth1 = doc.getTextWidth("NEGOTIATION SUMMARY");
      doc.setDrawColor(220, 222, 226);
      doc.setLineWidth(0.2);
      doc.line(21 + titleWidth1 + 4, yPos - 1.0, 195, yPos - 1.0);

      yPos += 5.5;

      // Outer card board
      const summaryCardHeight = 40.0;
      doc.setDrawColor(220, 222, 226);
      doc.setLineWidth(0.25);
      doc.roundedRect(15, yPos, 180, summaryCardHeight, 1.2, 1.2, 'S');

      // Left crimson border indicator (just inside the card)
      doc.setFillColor(183, 28, 28);
      doc.rect(15.2, yPos + 0.2, 0.8, summaryCardHeight - 0.4, 'F');

      // Guanxi Badge box layout on the right of Section 01 card
      const scoreVal = supplier.guanxiScore || 50;
      let statusLabel = "BUILDING GROUND";
      let scoreColor = [197, 117, 0]; // Dark Amber/Orange for 45-59

      if (scoreVal >= 80) {
        statusLabel = "TRUSTED ALLY";
        scoreColor = [22, 101, 52]; // Green
      } else if (scoreVal >= 60) {
        statusLabel = "HEALTHY PIPELINE";
        scoreColor = [21, 101, 192]; // Blue
      } else if (scoreVal >= 45) {
        statusLabel = "BUILDING GROUND";
        scoreColor = [197, 117, 0]; // Dark Amber/Orange
      } else {
        statusLabel = "COLD CONTACT";
        scoreColor = [183, 28, 28]; // Crimson Red
      }

      const sBoxW = 26.5; // reduced by 15% from 31
      const sBoxH = 18.5; // reduced by 15% from 21.5
      const sBoxX = 165.0; // shifted for beautiful alignment ending at 191.5
      const sBoxY = yPos + 4.5;

      doc.setDrawColor(220, 222, 226);
      doc.setLineWidth(0.18);
      doc.roundedRect(sBoxX, sBoxY, sBoxW, sBoxH, 0.8, 0.8, 'S');

      // Inside Index Box labels
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(4.5);
      doc.setTextColor(120, 120, 120);
      doc.text("DEAL SCORE", sBoxX + 2.5, sBoxY + 4.5);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.text(`${scoreVal}`, sBoxX + 2.5, sBoxY + 11.5);
      const scoreW = doc.getTextWidth(`${scoreVal}`);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text("/ 100", sBoxX + scoreW + 3.8, sBoxY + 11.5 - 1.0);

      // Status outlined pill
      const xPill = sBoxX + 2.5;
      const yPill = sBoxY + 13.2;
      const wPill = 21.5;
      const hPill = 3.8;

      doc.setDrawColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.setLineWidth(0.18);
      doc.roundedRect(xPill, yPill, wPill, hPill, 0.5, 0.5, 'S');

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(4.5);
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.text(statusLabel, xPill + wPill / 2, yPill + 2.7, { align: "center" });

      // Draw beautiful red circular business icon on the left
      drawBusinessIcon(24.5, yPos + 10.5, 4.5, true);

      // Left column details (properly shifted to x = 32.0 to clear the icon, perfectly aligned on grid)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5.2);
      doc.setTextColor(140, 140, 140);
      doc.text("PARTY A — MANUFACTURER", 32.0, yPos + 6);

      const engName = cleanStringForPDF(supplier.englishName || 'Unknown');
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(engName.toUpperCase(), 32.0, yPos + 10.5);

      // Row 2: WeChat ID & Website
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5.2);
      doc.setTextColor(140, 140, 140);
      doc.text("WECHAT ID", 32.0, yPos + 17);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(50, 50, 50);
      doc.text(cleanStringForPDF(supplier.wechatId || 'N/A'), 32.0, yPos + 21);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5.2);
      doc.setTextColor(140, 140, 140);
      doc.text("SUPPLIER WEBSITE", 77.0, yPos + 17);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(21, 101, 192);
      const webUrl = supplier.url || 'N/A';
      doc.text(webUrl.length > 40 ? webUrl.substring(0, 38) + '...' : webUrl, 77.0, yPos + 21);

      // Row 3: Current Price, Target Price, Walk-Away Price, MOQ
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5.2);
      doc.setTextColor(140, 140, 140);
      doc.text("CURRENT PRICE", 32.0, yPos + 27);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 30, 30);
      doc.text(`CNY ${cleanStringForPDF(supplier.currentPrice || 'N/A')}`, 32.0, yPos + 31);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5.2);
      doc.setTextColor(140, 140, 140);
      doc.text("TARGET PRICE", 62.0, yPos + 27);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 30, 30);
      doc.text(`CNY ${cleanStringForPDF(supplier.targetPrice || 'N/A')}`, 62.0, yPos + 31);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5.2);
      doc.setTextColor(140, 140, 140);
      doc.text("WALK-AWAY PRICE", 92.0, yPos + 27);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(183, 28, 28); // red walkaway
      doc.text(`CNY ${cleanStringForPDF(supplier.walkAwayPrice || 'N/A')}`, 92.0, yPos + 31);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5.2);
      doc.setTextColor(140, 140, 140);
      doc.text("MINIMUM ORDER QUANTITY (MOQ)", 125.0, yPos + 27);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 30, 30);
      doc.text(cleanStringForPDF(supplier.moq || 'N/A'), 125.0, yPos + 31);

      // Offset below summary card
      yPos += summaryCardHeight + 8;

      // SECTION 2: TRANSCRIPT
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(183, 28, 28);
      doc.text("02", 15, yPos);

      doc.setTextColor(30, 30, 30);
      doc.text("NEGOTIATION TRANSCRIPT CHAT LOG", 21, yPos);

      const titleWidth2 = doc.getTextWidth("NEGOTIATION TRANSCRIPT CHAT LOG");
      doc.setDrawColor(220, 222, 226);
      doc.setLineWidth(0.2);
      doc.line(21 + titleWidth2 + 4, yPos - 1.0, 195, yPos - 1.0);

      yPos += 5.5;

      // Render Messages
      let lastAvatarY: number | null = null;
      let lastAvatarPage: number = 1;

      const drawTimelineNode = (cx: number, cy: number, type: 'ai' | 'supplier' | 'star') => {
        // 1. Draw connecting line segment if we have a previous node on the same page
        if (lastAvatarY !== null && currentPage === lastAvatarPage) {
          doc.setDrawColor(183, 28, 28);
          doc.setLineWidth(0.35); // 0.35mm looks beautiful and crisp
          doc.line(cx, lastAvatarY, cx, cy);
        }
        
        // Update tracking
        lastAvatarY = cy;
        lastAvatarPage = currentPage;
        
        // 2. Draw actual avatar circle and icon on top of the line
        if (type === 'ai') {
          // Draw a beautifully proportioned person icon for the buyer
          drawPersonIcon(cx, cy, 2.8, false);
        } else if (type === 'supplier') {
          // Draw a beautiful supplier business icon
          drawBusinessIcon(cx, cy, 2.8, false);
        } else if (type === 'star') {
          // Draw a beautiful custom RUI icon with a white circle background, red border, and the YORA/RUI logo inside
          doc.setFillColor(255, 255, 255);
          doc.circle(cx, cy, 2.8, 'F');
          doc.setDrawColor(183, 28, 28);
          doc.setLineWidth(0.25);
          doc.circle(cx, cy, 2.8, 'S');
          // Center the YORA logo inside the circle (diameter 5.6mm, logo size 4.2mm)
          drawLogo(cx - 2.1, cy - 2.1, 4.2);
        }
      };

      messages.forEach((m) => {
        // Timeline core logic execution
        {
          const senderLabel = m.sender === 'ai' ? 'Rui (AI Strategist)' : m.sender === 'user' ? 'You' : m.sender === 'supplier' ? `${supplier.englishName} (Supplier)` : 'System';
          
          let timestamp = m.timeText || '';
          if (m.createdAt) {
            try {
              const d = typeof m.createdAt.toDate === 'function'
                ? m.createdAt.toDate()
                : new Date(m.createdAt.seconds ? m.createdAt.seconds * 1000 : m.createdAt);
              timestamp = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
              // fallback stays
            }
          } else {
            const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            timestamp = todayStr + ', ' + (m.timeText || '');
          }

          // Determine backgrounds and colors (useful for tags and headers)
          let titleColorRGB = [110, 110, 110];
          let bodyBgColorHex = '#ffffff';

          if (m.sender === 'ai') {
            titleColorRGB = [183, 28, 28]; // Brand Crimson for Rui
          } else if (m.sender === 'supplier') {
            titleColorRGB = [60, 60, 60];
          }

          // 1. Process message body (CJK aware, wrapping width is 164.0mm)
          const rawText = m.text || "";
          const isBodyCJK = containsCJK(rawText);
          let bodyHeight = 0;
          let bodyImgData: any = null;
          let bodyTextLines: string[] = [];

          if (isBodyCJK) {
            bodyImgData = getMessageBodyImg(rawText, 164, 8.5, '#3a3a3a', bodyBgColorHex);
            bodyHeight = bodyImgData.heightMm;
          } else {
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(8.5);
            bodyTextLines = doc.splitTextToSize(cleanStringForPDF(rawText), 164); // Wrapping at 164mm
            bodyHeight = bodyTextLines.length * 4.0; // Line height for 8.5pt text is 4.0mm
          }

          // 2. Process high-fidelity analysis Strategy Box if applicable
          let showAnalysis = false;
          let strategyHeight = 0;
          let processedBlocks: any[] = [];

          if (m.sender === 'ai' && m.analysis) {
            try {
              const parsed = parseAnalysis(m.analysis);
              showAnalysis = true;

              let translationText = parsed.translation || 'N/A';
              translationText = translationText.replace(/["'”]+\s*$/g, '').trim();

              const splitSuggestedReply = (text: string): { chinese: string; indonesian: string | null } => {
                const regex = /(\(|\[)\s*(Terjemahan|Indonesian|Translation|Terjemahkan)/i;
                const match = text.match(regex);
                if (match && match.index !== undefined) {
                  const rawChinese = text.substring(0, match.index).trim();
                  let rawIndonesian = text.substring(match.index).trim();
                  const labelCleanRegex = /^[\(\[\s]*(Terjemahan|Indonesian(?:\s+Translation)?|Translation|Terjemahkan)[:：\s]*/i;
                  rawIndonesian = rawIndonesian.replace(labelCleanRegex, '');
                  rawIndonesian = rawIndonesian.replace(/[)\]\s]*$/, '');
                  return {
                    chinese: rawChinese,
                    indonesian: rawIndonesian.trim() || null
                  };
                }
                return { chinese: text, indonesian: null };
              };

              const infoBlocks = [
                { label: "SOURCED TRANSLATION", value: translationText },
                { label: "REAL HIDDEN MEANING", value: parsed.realMeaning || 'N/A' },
                { label: "SUGGESTED ACTION/REPLY", value: parsed.copyReadyReply || 'N/A', isSuggestedAction: true }
              ];

              let runningHeight = 2.5; // Top padding inside strategy box
              
              // Header height ("RUI STRATEGY BREAKDOWN" label)
              runningHeight += 1.8; // Label height
              runningHeight += 2.0; // Gap below header

              processedBlocks = infoBlocks.map(block => {
                const labelText = block.label;
                
                if (block.isSuggestedAction) {
                  const replySplit = splitSuggestedReply(block.value);
                  if (replySplit.indonesian) {
                    const sub1Val = replySplit.chinese;
                    const sub2Val = replySplit.indonesian;
                    
                    const is1CJK = containsCJK(sub1Val);
                    const is2CJK = containsCJK(sub2Val);
                    
                    let blockVal1Height = 0;
                    let imgData1: any = null;
                    let textLines1: string[] = [];
                    
                    let blockVal2Height = 0;
                    let imgData2: any = null;
                    let textLines2: string[] = [];
                    
                    if (is1CJK) {
                      imgData1 = getMessageBodyImg(sub1Val, 156, 7.5, '#1e1e1e', '#FFF5F5');
                      blockVal1Height = imgData1.heightMm;
                    } else {
                      doc.setFont("Helvetica", "normal");
                      doc.setFontSize(7.5);
                      textLines1 = doc.splitTextToSize(cleanStringForPDF(sub1Val), 156);
                      blockVal1Height = textLines1.length * 3.5;
                    }
                    
                    if (is2CJK) {
                      imgData2 = getMessageBodyImg(sub2Val, 156, 7.5, '#1e1e1e', '#FFF5F5');
                      blockVal2Height = imgData2.heightMm;
                    } else {
                      doc.setFont("Helvetica", "normal");
                      doc.setFontSize(7.5);
                      textLines2 = doc.splitTextToSize(cleanStringForPDF(sub2Val), 156);
                      blockVal2Height = textLines2.length * 3.5;
                    }
                    
                    const sub1Height = 1.4 + 0.6 + blockVal1Height;
                    const sub2Height = 1.4 + 0.6 + blockVal2Height;
                    
                    const totalHeight = 1.8 + 1.2 + sub1Height + 1.5 + sub2Height;
                    
                    return {
                      label: labelText,
                      isSplit: true,
                      height: totalHeight,
                      subBlocks: [
                        {
                          subLabel: "SUGGESTED REPLY (CHINESE / WECHAT)",
                          isCJK: is1CJK,
                          imgData: imgData1,
                          textLines: textLines1,
                          valText: sub1Val,
                          height: sub1Height
                        },
                        {
                          subLabel: "INDONESIAN TRANSLATION",
                          isCJK: is2CJK,
                          imgData: imgData2,
                          textLines: textLines2,
                          valText: sub2Val,
                          height: sub2Height
                        }
                      ]
                    };
                  }
                }

                const valText = block.value;
                const isValCJK = containsCJK(valText);
                
                let blockValHeight = 0;
                let imgData: any = null;
                let textLines: string[] = [];
                
                if (isValCJK) {
                  imgData = getMessageBodyImg(valText, 156, 7.5, '#1e1e1e', '#FFF5F5'); // solid pale red background inside strategy card
                  blockValHeight = imgData.heightMm;
                } else {
                  doc.setFont("Helvetica", "normal");
                  doc.setFontSize(7.5);
                  textLines = doc.splitTextToSize(cleanStringForPDF(valText), 156);
                  blockValHeight = textLines.length * 3.5; // Line height for 7.5pt text is 3.5mm
                }
                
                const totalBlockHeight = 1.8 + 0.8 + blockValHeight;
                
                return {
                  label: labelText,
                  isSplit: false,
                  isCJK: isValCJK,
                  imgData,
                  textLines,
                  height: totalBlockHeight,
                  valText,
                  subBlocks: []
                };
              });

              processedBlocks.forEach((pb, idx) => {
                runningHeight += pb.height;
                if (idx < processedBlocks.length - 1) {
                  runningHeight += 2.5; // 2.5mm gap between fields
                }
              });

              runningHeight += 2.5; // Bottom padding inside strategy box
              strategyHeight = runningHeight;

            } catch (e) {
              console.error("Failed to parse analysis inside PDF generator", e);
            }
          }

          // Layout heights for basic message
          const topPadding = 1.0;
          const headerHeight = 1.8;
          const gapToBody = 1.5;
          const bottomPadding = 3.5;
          
          const msgHeaderAndBodyHeight = topPadding + headerHeight + gapToBody + bodyHeight + bottomPadding;
          const maxContentY = 270;

          // Check if basic message (header & body) fits on current page
          if (yPos + msgHeaderAndBodyHeight > maxContentY) {
            doc.addPage();
            currentPage += 1;
            drawPageHeader(currentPage);
            drawPageFooter(currentPage);
            yPos = 32;
            lastAvatarY = null; // Reset timeline line across pages
          }

          // Render basic message (card-less timeline alignment)
          const renderMsgHeaderAndBody = (startY: number) => {
            const centerY = startY + topPadding + 0.8; // aligned with header text vertically
            
            // Draw timeline node for sender
            const nodeType = m.sender === 'ai' ? 'star' : m.sender === 'supplier' ? 'supplier' : 'ai';
            drawTimelineNode(24.0, centerY, nodeType);

            // Sender and Timestamp header text
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(6.8);
            doc.setTextColor(titleColorRGB[0], titleColorRGB[1], titleColorRGB[2]);
            
            const labelUpper = (m.sender === 'ai' ? 'RUI (AI STRATEGIST)' : m.sender === 'supplier' ? `${supplier.englishName} (SUPPLIER)` : 'YOU (BUYER)').toUpperCase();
            doc.text(`${labelUpper}  •  ${timestamp}`, 31.0, centerY + 0.9);

            // Message Body text
            const bodyY = startY + topPadding + headerHeight + gapToBody;
            if (isBodyCJK && bodyImgData) {
              doc.addImage(bodyImgData.dataUrl, 'JPEG', 31.0, bodyY, 164, bodyHeight);
            } else {
              doc.setFont("Helvetica", "normal");
              doc.setFontSize(8.5);
              doc.setTextColor(40, 40, 40);
              bodyTextLines.forEach((line, index) => {
                doc.text(line, 31.0, bodyY + (index * 4.0) + 2.8);
              });
            }
          };

          if (!showAnalysis || strategyHeight === 0) {
            // Normal message without a strategy breakdown
            renderMsgHeaderAndBody(yPos);
            yPos += msgHeaderAndBodyHeight + 3.0; // Spacing gap between consecutive transcript elements
          } else {
            // AI message WITH a strategy breakdown
            const strategyStartY = yPos + msgHeaderAndBodyHeight + 2.5;
            const totalFullHeight = msgHeaderAndBodyHeight + 2.5 + strategyHeight;

            if (yPos + totalFullHeight <= maxContentY) {
              // Fits entirely on current page!
              renderMsgHeaderAndBody(yPos);

              // Draw pale red Strategy Box inside
              doc.setFillColor(255, 245, 245);
              doc.setDrawColor(241, 191, 191);
              doc.setLineWidth(0.2);
              doc.roundedRect(31.0, strategyStartY, 164.0, strategyHeight, 1.0, 1.0, 'FD');

              // Strategy box left borderline (~1mm width)
              doc.setFillColor(183, 28, 28);
              doc.rect(31.1, strategyStartY + 0.1, 1.0, strategyHeight - 0.2, 'F');

              // Header Title inside Strategy box
              doc.setFont("Helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(183, 28, 28);
              doc.text("RUI STRATEGY BREAKDOWN", 35.0, strategyStartY + 2.5 + 1.5);

              // Draw timeline star node for Strategy breakdown aligned horizontally with the header title inside
              const cyStar = strategyStartY + 2.5 + 1.2;
              drawTimelineNode(24.0, cyStar, 'star');

              let subY = strategyStartY + 2.5 + 1.8 + 2.0;
              processedBlocks.forEach(pb => {
                drawProcessedBlock(pb, subY);
                subY += pb.height + 2.5; // Gap between processed blocks
              });

              yPos += totalFullHeight + 5.0; // spacing gap
            } else {
              // Splitting is required! Let's render the headers & body on current page first
              renderMsgHeaderAndBody(yPos);

              const remainingSpaceForStrategy = maxContentY - (yPos + msgHeaderAndBodyHeight + 2.5);
              const stratHeaderNeeded = 2.5 + 1.8 + 2.0; // 6.3

              // Minimum height to see the strategy header plus the first block on page 1
              const minSpaceForFirstBlock = stratHeaderNeeded + (processedBlocks[0]?.height || 10.0) + 2.5;

              if (remainingSpaceForStrategy >= minSpaceForFirstBlock) {
                // We can render some blocks on page 1!
                let allocatedOnCurrentPage = stratHeaderNeeded;
                const blocksOnCurrentPage: typeof processedBlocks = [];
                const blocksOnNextPage: typeof processedBlocks = [];

                processedBlocks.forEach((pb, idx) => {
                  const blockRequiredHeight = pb.height + (idx > 0 ? 2.5 : 0);
                  if (allocatedOnCurrentPage + blockRequiredHeight + 2.5 <= remainingSpaceForStrategy) {
                    allocatedOnCurrentPage += blockRequiredHeight;
                    blocksOnCurrentPage.push(pb);
                  } else {
                    blocksOnNextPage.push(pb);
                  }
                });

                const page1StratBoxHeight = allocatedOnCurrentPage + 2.5;
                const page1StratBoxY = yPos + msgHeaderAndBodyHeight + 2.5;

                // Draw pale red Strategy hybrid box
                doc.setFillColor(255, 245, 245);
                doc.setDrawColor(241, 191, 191);
                doc.setLineWidth(0.2);
                doc.roundedRect(31.0, page1StratBoxY, 164.0, page1StratBoxHeight, 1.0, 1.0, 'FD');

                // Left accent line (~1mm width)
                doc.setFillColor(183, 28, 28);
                doc.rect(31.1, page1StratBoxY + 0.1, 1.0, page1StratBoxHeight - 0.2, 'F');

                // Header Title
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(183, 28, 28);
                doc.text("RUI STRATEGY BREAKDOWN", 35.0, page1StratBoxY + 2.5 + 1.5);

                // Timeline Star Node
                const cyStar = page1StratBoxY + 2.5 + 1.2;
                drawTimelineNode(24.0, cyStar, 'star');

                let subY = page1StratBoxY + 2.5 + 1.8 + 2.0;
                blocksOnCurrentPage.forEach(pb => {
                  drawProcessedBlock(pb, subY);
                  subY += pb.height + 2.5;
                });

                // Advance to next page for remaining blocks
                doc.addPage();
                currentPage += 1;
                drawPageHeader(currentPage);
                drawPageFooter(currentPage);
                yPos = 32;
                lastAvatarY = null; // Reset timeline line across page boundaries

                if (blocksOnNextPage.length > 0) {
                  // Render continuation card on page 2
                  let nextStratHeaderNeeded = 2.5 + 1.8 + 2.0; // header inside strategy box
                  const nextActStratHeight = nextStratHeaderNeeded + blocksOnNextPage.reduce((acc, pb, idx) => acc + pb.height + (idx > 0 ? 2.5 : 0), 0) + 2.5;

                  // Draw timeline star node for continuation card
                  const cyStar2 = yPos + topPadding + 1.2;
                  drawTimelineNode(24.0, cyStar2, 'star');

                  // Draw pale red Strategy box on Page 2
                  doc.setFillColor(255, 245, 245);
                  doc.setDrawColor(241, 191, 191);
                  doc.setLineWidth(0.2);
                  doc.roundedRect(31.0, yPos + topPadding, 164.0, nextActStratHeight, 1.0, 1.0, 'FD');

                  doc.setFillColor(183, 28, 28);
                  doc.rect(31.1, yPos + topPadding + 0.1, 1.0, nextActStratHeight - 0.2, 'F');

                  doc.setFont("Helvetica", "bold");
                  doc.setFontSize(6.5);
                  doc.setTextColor(183, 28, 28);
                  doc.text("RUI STRATEGY BREAKDOWN (CONTINUED)", 35.0, yPos + topPadding + 2.5 + 1.5);

                  let contSubY = yPos + topPadding + 2.5 + 1.8 + 2.0;
                  blocksOnNextPage.forEach(pb => {
                    drawProcessedBlock(pb, contSubY);
                    contSubY += pb.height + 2.5;
                  });

                  yPos += nextActStratHeight + topPadding + 5.0;
                }
              } else {
                // Not even the first block fits on current page. We render the entire strategy box on Page 2!
                doc.addPage();
                currentPage += 1;
                drawPageHeader(currentPage);
                drawPageFooter(currentPage);
                yPos = 32;
                lastAvatarY = null; // Reset timeline line across page boundaries

                // Draw timeline star node on second page
                const cyStar = yPos + 2.5 + 1.2;
                drawTimelineNode(24.0, cyStar, 'star');

                // Draw beautiful full Strategy card on page 2
                doc.setFillColor(255, 245, 245);
                doc.setDrawColor(241, 191, 191);
                doc.setLineWidth(0.2);
                doc.roundedRect(31.0, yPos, 164.0, strategyHeight, 1.0, 1.0, 'FD');

                doc.setFillColor(183, 28, 28);
                doc.rect(31.1, yPos + 0.1, 1.0, strategyHeight - 0.2, 'F');

                doc.setFont("Helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(183, 28, 28);
                doc.text("RUI STRATEGY BREAKDOWN", 35.0, yPos + 2.5 + 1.5);

                let contSubY = yPos + 2.5 + 1.8 + 2.0;
                processedBlocks.forEach(pb => {
                  drawProcessedBlock(pb, contSubY);
                  contSubY += pb.height + 2.5;
                });

                yPos += strategyHeight + 5.0;
              }
            }
          }
        }
        return; // Fully bypass legacy loop body below to avoid whitespace mismatch issues!

        const senderLabel = m.sender === 'ai' ? 'Rui (AI Strategist)' : m.sender === 'user' ? 'You' : m.sender === 'supplier' ? `${supplier.englishName} (Supplier)` : 'System';
        const timestamp = m.timeText || '';

        // Determine backgrounds and colors
        let bgColorRGB = [247, 248, 250]; // Light gray default for User #F7F8FA

        let borderColorRGB = [220, 222, 226];
        let titleColorRGB = [110, 110, 110];
        let bodyBgColorHex = '#F7F8FA';

        if (m.sender === 'ai') {
          bgColorRGB = [255, 248, 248]; // Light red tint #FFF8F8 for Rui
          borderColorRGB = [251, 221, 221];
          titleColorRGB = [183, 28, 28]; // Brand Crimson for Rui
          bodyBgColorHex = '#FFF8F8';
        } else if (m.sender === 'supplier') {
          bgColorRGB = [250, 250, 252]; // Soft off-white for Supplier
          borderColorRGB = [230, 230, 235];
          titleColorRGB = [60, 60, 60];
          bodyBgColorHex = '#FAFAFC';
        }

        // 1. Process message body (CJK aware)
        const rawText = m.text || "";
        const isBodyCJK = containsCJK(rawText);
        let bodyHeight = 0;
        let bodyImgData: any = null;
        let bodyTextLines: string[] = [];

        if (isBodyCJK) {
          bodyImgData = getMessageBodyImg(rawText, 170, 8.5, '#3a3a3a', bodyBgColorHex);
          bodyHeight = bodyImgData.heightMm;
        } else {
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(8.5);
          bodyTextLines = doc.splitTextToSize(cleanStringForPDF(rawText), 170); // Full inner width 170
          bodyHeight = bodyTextLines.length * 4.0; // Line height for 8.5pt text is 4.0mm
        }

        // 2. Process high-fidelity analysis Strategy Box if applicable
        let showAnalysis = false;
        let strategyHeight = 0;
        let processedBlocks: any[] = [];

        if (m.sender === 'ai' && m.analysis) {
          try {
            const parsed = parseAnalysis(m.analysis);
            showAnalysis = true;

            let translationText = parsed.translation || 'N/A';
            translationText = translationText.replace(/[""]+\s*$/g, '').trim();

            const splitSuggestedReply = (text: string): { chinese: string; indonesian: string | null } => {
              const regex = /(\(|\[)\s*(Terjemahan|Indonesian|Translation|Terjemahkan)/i;
              const match = text.match(regex);
              if (match && match.index !== undefined) {
                const rawChinese = text.substring(0, match.index).trim();
                let rawIndonesian = text.substring(match.index).trim();
                const labelCleanRegex = /^[\(\[\s]*(Terjemahan|Indonesian(?:\s+Translation)?|Translation|Terjemahkan)[:：\s]*/i;
                rawIndonesian = rawIndonesian.replace(labelCleanRegex, '');
                rawIndonesian = rawIndonesian.replace(/[)\]\s]*$/, '');
                return {
                  chinese: rawChinese,
                  indonesian: rawIndonesian.trim() || null
                };
              }
              return { chinese: text, indonesian: null };
            };

            const infoBlocks = [
              { label: "SOURCED TRANSLATION", value: translationText },
              { label: "REAL HIDDEN MEANING", value: parsed.realMeaning || 'N/A' },
              { label: "SUGGESTED ACTION/REPLY", value: parsed.copyReadyReply || 'N/A', isSuggestedAction: true }
            ];

            let runningHeight = 2.5; // Top padding inside strategy box
            
            // Header height ("RUI STRATEGY BREAKDOWN" label)
            runningHeight += 1.8; // Label height
            runningHeight += 2.0; // Gap below header

            processedBlocks = infoBlocks.map(block => {
              const labelText = block.label;
              
              if (block.isSuggestedAction) {
                const replySplit = splitSuggestedReply(block.value);
                if (replySplit.indonesian) {
                  const sub1Val = replySplit.chinese;
                  const sub2Val = replySplit.indonesian;
                  
                  const is1CJK = containsCJK(sub1Val);
                  const is2CJK = containsCJK(sub2Val);
                  
                  let blockVal1Height = 0;
                  let imgData1: any = null;
                  let textLines1: string[] = [];
                  
                  let blockVal2Height = 0;
                  let imgData2: any = null;
                  let textLines2: string[] = [];
                  
                  if (is1CJK) {
                    imgData1 = getMessageBodyImg(sub1Val, 160, 7.5, '#1e1e1e', '#FFF5F5');
                    blockVal1Height = imgData1.heightMm;
                  } else {
                    doc.setFont("Helvetica", "normal");
                    doc.setFontSize(7.5);
                    textLines1 = doc.splitTextToSize(cleanStringForPDF(sub1Val), 160);
                    blockVal1Height = textLines1.length * 3.5;
                  }
                  
                  if (is2CJK) {
                    imgData2 = getMessageBodyImg(sub2Val, 160, 7.5, '#1e1e1e', '#FFF5F5');
                    blockVal2Height = imgData2.heightMm;
                  } else {
                    doc.setFont("Helvetica", "normal");
                    doc.setFontSize(7.5);
                    textLines2 = doc.splitTextToSize(cleanStringForPDF(sub2Val), 160);
                    blockVal2Height = textLines2.length * 3.5;
                  }
                  
                  // Heights:
                  // Main label: 1.8mm + tag gap: 1.2
                  // Sub-block 1: sub label (1.4) + gap (0.6) + blockVal1Height
                  // Gap between sub-blocks: 1.5
                  // Sub-block 2: sub label (1.4) + gap (0.6) + blockVal2Height
                  const sub1Height = 1.4 + 0.6 + blockVal1Height;
                  const sub2Height = 1.4 + 0.6 + blockVal2Height;
                  
                  const totalHeight = 1.8 + 1.2 + sub1Height + 1.5 + sub2Height;
                  
                  return {
                    label: labelText,
                    isSplit: true,
                    height: totalHeight,
                    subBlocks: [
                      {
                        subLabel: "SUGGESTED REPLY (CHINESE / WECHAT)",
                        isCJK: is1CJK,
                        imgData: imgData1,
                        textLines: textLines1,
                        valText: sub1Val,
                        height: sub1Height
                      },
                      {
                        subLabel: "INDONESIAN TRANSLATION",
                        isCJK: is2CJK,
                        imgData: imgData2,
                        textLines: textLines2,
                        valText: sub2Val,
                        height: sub2Height
                      }
                    ]
                  };
                }
              }

              const valText = block.value;
              const isValCJK = containsCJK(valText);
              
              let blockValHeight = 0;
              let imgData: any = null;
              let textLines: string[] = [];
              
              if (isValCJK) {
                imgData = getMessageBodyImg(valText, 160, 7.5, '#1e1e1e', '#FFF5F5'); // solid pale red background inside strategy card
                blockValHeight = imgData.heightMm;
              } else {
                doc.setFont("Helvetica", "normal");
                doc.setFontSize(7.5);
                textLines = doc.splitTextToSize(cleanStringForPDF(valText), 160);
                blockValHeight = textLines.length * 3.5; // Line height for 7.5pt text is 3.5mm
              }
              
              // Each info block has: label (1.8mm) + gap (0.8mm) + value block height
              const totalBlockHeight = 1.8 + 0.8 + blockValHeight;
              
              return {
                label: labelText,
                isSplit: false,
                isCJK: isValCJK,
                imgData,
                textLines,
                height: totalBlockHeight,
                valText,
                subBlocks: []
              };
            });

            processedBlocks.forEach((pb, idx) => {
              runningHeight += pb.height;
              if (idx < processedBlocks.length - 1) {
                runningHeight += 2.5; // FIX 3: Increased from 1.5 to 2.5mm gap between fields
              }
            });

            runningHeight += 2.5; // Bottom padding inside strategy box
            strategyHeight = runningHeight;

          } catch (e) {
            console.error("Failed to parse analysis inside PDF generator", e);
          }
        }

        const topPadding = 3.5;
        const senderLabelHeight = 1.8;
        const senderDividerGap = 1.5; // Reduced to 1.5mm gap as requested
        
        const msgHeaderAndBodyHeight = topPadding + senderLabelHeight + senderDividerGap + bodyHeight + 3.5;

        // Draw helper variables
        const maxContentY = 270;

        // Check if the primary chat card container header/body part fits on current page
        if (yPos + msgHeaderAndBodyHeight > maxContentY) {
          doc.addPage();
          currentPage += 1;
          drawPageHeader(currentPage);
          drawPageFooter(currentPage);
          yPos = 32;
        }

        // Draw basic message body card
        const renderMsgHeaderAndBody = (startY: number) => {
          doc.setFillColor(bgColorRGB[0], bgColorRGB[1], bgColorRGB[2]);
          doc.setDrawColor(borderColorRGB[0], borderColorRGB[1], borderColorRGB[2]);
          doc.setLineWidth(0.25);
          doc.roundedRect(15, startY, 180, msgHeaderAndBodyHeight, 1.2, 1.2, 'FD');

          if (m.sender === 'ai') {
            doc.setFillColor(183, 28, 28);
            doc.rect(15.2, startY + 0.2, 1.0, msgHeaderAndBodyHeight - 0.4, 'F');
          }

          // Sender and Timestamp header
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(titleColorRGB[0], titleColorRGB[1], titleColorRGB[2]);
          doc.text(`${senderLabel.toUpperCase()}  •  ${timestamp}`, 20, startY + topPadding + 1.5);

          // Render Message Body
          const bodyY = startY + topPadding + senderLabelHeight + senderDividerGap;
          if (isBodyCJK && bodyImgData) {
            // Note: bodyImgData has been pre-rendered as JPEG with bodyBgColorHex background
            doc.addImage(bodyImgData.dataUrl, 'JPEG', 20, bodyY, 170, bodyHeight);
          } else {
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(40, 40, 40);
            bodyTextLines.forEach((line, index) => {
              doc.text(line, 20, bodyY + (index * 4.0) + 2.8);
            });
          }
        };

        if (!showAnalysis || strategyHeight === 0) {
          // Normal message with no strategy breakdown
          renderMsgHeaderAndBody(yPos);
          yPos += msgHeaderAndBodyHeight + 3.0; // 3mm gap between consecutive cards
        } else {
          // AI message WITH a strategy breakdown
          const strategyStartY = yPos + msgHeaderAndBodyHeight + 2.5;
          const totalFullHeight = msgHeaderAndBodyHeight + 2.5 + strategyHeight;

          if (yPos + totalFullHeight <= maxContentY) {
            // Fits entirely on current page! Use original layout combined into a single beautiful outer card
            doc.setFillColor(bgColorRGB[0], bgColorRGB[1], bgColorRGB[2]);
            doc.setDrawColor(borderColorRGB[0], borderColorRGB[1], borderColorRGB[2]);
            doc.setLineWidth(0.25);
            doc.roundedRect(15, yPos, 180, totalFullHeight, 1.2, 1.2, 'FD');

            if (m.sender === 'ai') {
              doc.setFillColor(183, 28, 28);
              doc.rect(15.2, yPos + 0.2, 1.0, totalFullHeight - 0.4, 'F');
            }

            // Sender and Timestamp header
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(titleColorRGB[0], titleColorRGB[1], titleColorRGB[2]);
            doc.text(`${senderLabel.toUpperCase()}  •  ${timestamp}`, 20, yPos + topPadding + 1.5);

            // Render Message Body
            const bodyY = yPos + topPadding + senderLabelHeight + senderDividerGap;
            if (isBodyCJK && bodyImgData) {
              doc.addImage(bodyImgData.dataUrl, 'JPEG', 20, bodyY, 170, bodyHeight);
            } else {
              doc.setFont("Helvetica", "normal");
              doc.setFontSize(8.5);
              doc.setTextColor(40, 40, 40);
              bodyTextLines.forEach((line, index) => {
                doc.text(line, 20, bodyY + (index * 4.0) + 2.8);
              });
            }

            // Draw pale red Strategy Box inside
            doc.setFillColor(255, 245, 245);
            doc.setDrawColor(241, 191, 191);
            doc.setLineWidth(0.2);
            doc.roundedRect(18, strategyStartY, 174, strategyHeight, 1.0, 1.0, 'FD');

            // Strategy box left borderline (~1mm width)
            doc.setFillColor(183, 28, 28);
            doc.rect(18.1, strategyStartY + 0.1, 1.0, strategyHeight - 0.2, 'F');

            // Header Title
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(183, 28, 28);
            doc.text("RUI STRATEGY BREAKDOWN", 22.0, strategyStartY + 2.5 + 1.5);

            let subY = strategyStartY + 2.5 + 1.8 + 2.0;
            processedBlocks.forEach(pb => {
              drawProcessedBlock(pb, subY);
              subY += pb.height + 2.5; // FIX 3: 2.5mm gap
            });

            yPos += totalFullHeight + 3.0; // standard space
          } else {
            // Splitting is required! Let's render the header & body on current page first
            renderMsgHeaderAndBody(yPos);

            const remainingSpaceForStrategy = maxContentY - (yPos + msgHeaderAndBodyHeight + 2.5);
            const stratHeaderNeeded = 2.5 + 1.8 + 2.0; // 6.3

            // Minimum height to see the strategy header plus the first block on page 1
            const minSpaceForFirstBlock = stratHeaderNeeded + (processedBlocks[0]?.height || 10.0) + 2.5;

            if (remainingSpaceForStrategy >= minSpaceForFirstBlock) {
              // We can render some blocks on page 1!
              let allocatedOnCurrentPage = stratHeaderNeeded;
              const blocksOnCurrentPage: typeof processedBlocks = [];
              const blocksOnNextPage: typeof processedBlocks = [];

              processedBlocks.forEach((pb, idx) => {
                const blockRequiredHeight = pb.height + (idx > 0 ? 2.5 : 0);
                if (allocatedOnCurrentPage + blockRequiredHeight + 2.5 <= remainingSpaceForStrategy) {
                  allocatedOnCurrentPage += blockRequiredHeight;
                  blocksOnCurrentPage.push(pb);
                } else {
                  blocksOnNextPage.push(pb);
                }
              });

              // Complete current page's inner Strategy box of height: allocatedOnCurrentPage + 2.5 (bottom padding)
              const page1StratBoxHeight = allocatedOnCurrentPage + 2.5;
              const page1StratBoxY = yPos + msgHeaderAndBodyHeight + 2.5;

              // Draw pale red box
              doc.setFillColor(255, 245, 245);
              doc.setDrawColor(241, 191, 191);
              doc.setLineWidth(0.2);
              doc.roundedRect(18, page1StratBoxY, 174, page1StratBoxHeight, 1.0, 1.0, 'FD');

              // Left accent line (~1mm width)
              doc.setFillColor(183, 28, 28);
              doc.rect(18.1, page1StratBoxY + 0.1, 1.0, page1StratBoxHeight - 0.2, 'F');

              // Header Title
              doc.setFont("Helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(183, 28, 28);
              doc.text("RUI STRATEGY BREAKDOWN", 22.0, page1StratBoxY + 2.5 + 1.5);

              let subY = page1StratBoxY + 2.5 + 1.8 + 2.0;
              blocksOnCurrentPage.forEach(pb => {
                drawProcessedBlock(pb, subY);
                subY += pb.height + 2.5; // FIX 3: 2.5mm gap
              });

              // Advance to next page for remaining blocks
              doc.addPage();
              currentPage += 1;
              drawPageHeader(currentPage);
              drawPageFooter(currentPage);
              yPos = 32;

              if (blocksOnNextPage.length > 0) {
                // Render continuation card on page 2
                let nextStratHeaderNeeded = 2.5 + 1.8 + 2.0; // header inside strategy box
                const nextActStratHeight = nextStratHeaderNeeded + blocksOnNextPage.reduce((acc, pb, idx) => acc + pb.height + (idx > 0 ? 2.5 : 0), 0) + 2.5;

                const contCardHeight = topPadding + nextActStratHeight + 3.5;

                // Draw outer continuation card representational container
                doc.setFillColor(bgColorRGB[0], bgColorRGB[1], bgColorRGB[2]);
                doc.setDrawColor(borderColorRGB[0], borderColorRGB[1], borderColorRGB[2]);
                doc.setLineWidth(0.25);
                doc.roundedRect(15, yPos, 180, contCardHeight, 1.2, 1.2, 'FD');

                if (m.sender === 'ai') {
                  doc.setFillColor(183, 28, 28);
                  doc.rect(15.2, yPos + 0.2, 1.0, contCardHeight - 0.4, 'F');
                }

                // Header Continued Marker
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(titleColorRGB[0], titleColorRGB[1], titleColorRGB[2]);
                doc.text(`RUI STRATEGY BREAKDOWN  •  CONTINUED`, 20, yPos + topPadding + 1.5);

                // Draw pale red strategy box inside
                const contStratBoxY = yPos + topPadding + senderLabelHeight + senderDividerGap;
                doc.setFillColor(255, 245, 245);
                doc.setDrawColor(241, 191, 191);
                doc.setLineWidth(0.2);
                doc.roundedRect(18, contStratBoxY, 174, nextActStratHeight, 1.0, 1.0, 'FD');

                doc.setFillColor(183, 28, 28);
                doc.rect(18.1, contStratBoxY + 0.1, 1.0, nextActStratHeight - 0.2, 'F');

                doc.setFont("Helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(183, 28, 28);
                doc.text("RUI STRATEGY BREAKDOWN (CONTINUED)", 22.0, contStratBoxY + 2.5 + 1.5);

                let contSubY = contStratBoxY + 2.5 + 1.8 + 2.0;
                blocksOnNextPage.forEach(pb => {
                  drawProcessedBlock(pb, contSubY);
                  contSubY += pb.height + 2.5; // FIX 3: 2.5mm gap
                });

                yPos += contCardHeight + 3.0;
              }
            } else {
              // Not even the first block fits on current page. We render the entire strategy box on Page 2!
              doc.addPage();
              currentPage += 1;
              drawPageHeader(currentPage);
              drawPageFooter(currentPage);
              yPos = 32;

              const contCardHeight = topPadding + strategyHeight + 3.5;

              // Draw outer continuation card on page 2
              doc.setFillColor(bgColorRGB[0], bgColorRGB[1], bgColorRGB[2]);
              doc.setDrawColor(borderColorRGB[0], borderColorRGB[1], borderColorRGB[2]);
              doc.setLineWidth(0.25);
              doc.roundedRect(15, yPos, 180, contCardHeight, 1.2, 1.2, 'FD');

              if (m.sender === 'ai') {
                doc.setFillColor(183, 28, 28);
                doc.rect(15.2, yPos + 0.2, 1.0, contCardHeight - 0.4, 'F');
              }

              // Marker
              doc.setFont("Helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(titleColorRGB[0], titleColorRGB[1], titleColorRGB[2]);
              doc.text(`RUI STRATEGY BREAKDOWN  •  CONTINUED`, 20, yPos + topPadding + 1.5);

              // Pale red strategy card
              const contStratBoxY = yPos + topPadding + senderLabelHeight + senderDividerGap;
              doc.setFillColor(255, 245, 245);
              doc.setDrawColor(241, 191, 191);
              doc.setLineWidth(0.2);
              doc.roundedRect(18, contStratBoxY, 174, strategyHeight, 1.0, 1.0, 'FD');

              doc.setFillColor(183, 28, 28);
              doc.rect(18.1, contStratBoxY + 0.1, 1.0, strategyHeight - 0.2, 'F');

              doc.setFont("Helvetica", "bold");
              doc.setFontSize(6.5);
              doc.setTextColor(183, 28, 28);
              doc.text("RUI STRATEGY BREAKDOWN", 22.0, contStratBoxY + 2.5 + 1.5);

              let contSubY = contStratBoxY + 2.5 + 1.8 + 2.0;
              processedBlocks.forEach(pb => {
                drawProcessedBlock(pb, contSubY);
                contSubY += pb.height + 2.5; // FIX 3: 2.5mm gap
              });

              yPos += contCardHeight + 3.0;
            }
          }
        }
      });

      // Filename and save
      doc.save(`YORA_Negotiation_Transcript_${supplier.englishName || 'Supplier'}.pdf`);
    } catch (e: any) {
      console.error("Failed to compile or save PDF report:", e);
      alert("Error generating PDF: " + (e.message || "An error occurred."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    const text = inputText;
    setInputText('');

    try {
      const { data: userMsg, error: userMsgErr } = await supabase
        .from('chat_messages')
        .insert({
          supplier_id: supplier.id,
          sender: 'user',
          sender_name: 'Me',
          text: text,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      if (userMsgErr) throw userMsgErr;

      // Call AI for response
      setIsTyping(true);
      const sanit = (val: any, len = 200) => sanitizeClientField(val, len);

      const payloadMessages = messages
        .filter(m => m.sender !== 'system')
        .slice(-20)
        .map(m => {
          let role = 'user';
          let prefix = '';
          if (m.sender === 'ai' || m.role === 'assistant' || m.role === 'model') {
            role = 'assistant';
          } else if (m.sender === 'supplier') {
            role = 'user';
            prefix = `[Supplier ${supplier.englishName || 'Supplier'}]: `;
          } else if (m.sender === 'user') {
            role = 'user';
            prefix = `[Self/Buyer]: `;
          }
          return {
            role: role,
            content: `${prefix}${m.text || ""}`
          };
        });

      const { data: { session } } = await supabase.auth.getSession();
      const idToken = session?.access_token;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken || ''}`
        },
        body: JSON.stringify({
          messages: [...payloadMessages, { role: 'user', content: text }],
          aiTone: userData.aiTone,
          aiDepth: userData.aiDepth,
          aiLang: userData.aiLang,
          mode: 'chat',
          context: `Supplier Information:
- Chinese Name: ${sanit(supplier.chineseName, 100) || 'Not Specified'}
- English Name: ${sanit(supplier.englishName, 100) || 'Not Specified'}
- WeChat ID: ${sanit(supplier.wechatId, 100) || 'Not Specified'}
- Website URL: ${sanit(supplier.url, 150) || 'Not Specified'}
- Region: ${sanit(supplier.province, 100) || 'Unknown'}, ${sanit(supplier.city, 100) || 'Unknown'}
- Discovery Source: ${sanit(supplier.discoverySource, 100) || 'Not Specified'}
- Cooperation History: ${sanit(supplier.cooperationHistory, 150) || 'Not Specified'}
- Product Name: ${sanit(supplier.productName, 150) || 'Unspecified'}
- Product Chinese Name: ${sanit(supplier.productChineseName, 150) || 'Unspecified'}
- Product Category: ${sanit(supplier.category, 100) || 'Unspecified'}
- Product Specs: ${sanit(supplier.specs, 500) || 'None provided'}
- Initial Starting Offer Price (Now): ¥${sanit(supplier.currentPrice || supplier.walkAwayPrice, 50) || 'Not Specified'}
- Target Deal Price Goal: ¥${sanit(supplier.targetPrice, 50) || 'Not Specified'}
- Walk-away Exit Price Limit: ¥${sanit(supplier.walkAwayPrice, 50) || 'Not Specified'}
- Supplier Minimum Order Quantity (MOQ): ${sanit(supplier.moq, 50) || 'Not Specified'}
- Target Minimum Order Quantity (MOQ): ${sanit(supplier.targetMOQ, 50) || 'Not Specified'}
- Incoterms: ${sanit(supplier.incoterms, 50) || 'FOB'}
- Primary Negotiation Goal / Strategic Aim: ${sanit(supplier.negotiationGoal, 200) || 'Unspecified'}
- Target Payment Terms: ${sanit(supplier.paymentTarget, 200) || 'Unspecified'}
- Deal Urgency Level: ${sanit(supplier.urgencyLevel, 50) || 'Standard'}
- Additional Description & Negotiation Notes: ${sanit(supplier.notes, 500) || 'None provided'}
- Relationship Scores: ${JSON.stringify(scores || { trust: 50, leverage: 50, urgency: 50 })}`
        })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Server returned non-JSON response");
      }

      if (!response.ok) throw new Error(data.error || "Server Error");

      setIsTyping(false);
      const aiResponseText = parseConversationalResponse(data.text);
      const parsedAnalysis = parseAnalysis(data.text);
      const hasAnalysisText = data.text.toLowerCase().includes('translation') || data.text.toLowerCase().includes('real meaning') || data.text.toLowerCase().includes('suggested reply');
      const newScores = hasAnalysisText ? parseScores(data.text) : null;

      if (hasAnalysisText) {
        setAnalysis(parsedAnalysis);
        if (newScores) setScores(newScores);
      }

      const { error: aiMsgErr } = await supabase
        .from('chat_messages')
        .insert({
          supplier_id: supplier.id,
          sender: 'ai',
          sender_name: 'Rui',
          text: aiResponseText || data.text,
          created_at: new Date().toISOString(),
          translation: data.text
        });
      if (aiMsgErr) throw aiMsgErr;

      saveConversation(newScores, hasAnalysisText ? parsedAnalysis : undefined);
    } catch (err: any) {
      setIsTyping(false);
      console.error(err);
      alert("Error taking action: " + (err.message || "Failed to chat with AI strategist."));
    }
  };

  const handleSimulateReply = async () => {
    if (!simulatedReply.trim() || !user) return;

    const text = simulatedReply;
    setSimulatedReply('');

    try {
      const { error: supplierMsgErr } = await supabase
        .from('chat_messages')
        .insert({
          supplier_id: supplier.id,
          sender: 'supplier',
          sender_name: supplier.englishName,
          text: text,
          created_at: new Date().toISOString()
        });
      if (supplierMsgErr) throw supplierMsgErr;

      setIsSimulating(true);

      // Trigger AI analysis on simulated reply
      const sanit = (val: any, len = 200) => sanitizeClientField(val, len);

      const payloadMessages = messages
        .filter(m => m.sender !== 'system')
        .slice(-20)
        .map(m => {
          let role = 'user';
          let prefix = '';
          if (m.sender === 'ai' || m.role === 'assistant' || m.role === 'model') {
            role = 'assistant';
          } else if (m.sender === 'supplier') {
            role = 'user';
            prefix = `[Supplier ${supplier.englishName || 'Supplier'}]: `;
          } else if (m.sender === 'user') {
            role = 'user';
            prefix = `[Self/Buyer]: `;
          }
          return {
            role: role,
            content: `${prefix}${m.text || ""}`
          };
        });

      const { data: { session } } = await supabase.auth.getSession();
      const idToken = session?.access_token;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken || ''}`
        },
        body: JSON.stringify({
          messages: [
            ...payloadMessages,
            { role: 'user', content: `The supplier ${sanit(supplier.englishName, 100)} just sent this message: "${sanit(text, 2000)}". Please perform a full analysis.` }
          ],
          aiTone: userData.aiTone,
          aiDepth: userData.aiDepth,
          aiLang: userData.aiLang,
          mode: 'simulate',
          context: `Supplier Information:
- Chinese Name: ${sanit(supplier.chineseName, 100) || 'Not Specified'}
- English Name: ${sanit(supplier.englishName, 100) || 'Not Specified'}
- WeChat ID: ${sanit(supplier.wechatId, 100) || 'Not Specified'}
- Website URL: ${sanit(supplier.url, 150) || 'Not Specified'}
- Region: ${sanit(supplier.province, 100) || 'Unknown'}, ${sanit(supplier.city, 100) || 'Unknown'}
- Discovery Source: ${sanit(supplier.discoverySource, 100) || 'Not Specified'}
- Cooperation History: ${sanit(supplier.cooperationHistory, 150) || 'Not Specified'}
- Product Name: ${sanit(supplier.productName, 150) || 'Unspecified'}
- Product Chinese Name: ${sanit(supplier.productChineseName, 150) || 'Unspecified'}
- Product Category: ${sanit(supplier.category, 100) || 'Unspecified'}
- Product Specs: ${sanit(supplier.specs, 500) || 'None provided'}
- Initial Starting Offer Price (Now): ¥${sanit(supplier.currentPrice || supplier.walkAwayPrice, 50) || 'Not Specified'}
- Target Deal Price Goal: ¥${sanit(supplier.targetPrice, 50) || 'Not Specified'}
- Walk-away Exit Price Limit: ¥${sanit(supplier.walkAwayPrice, 50) || 'Not Specified'}
- Supplier Minimum Order Quantity (MOQ): ${sanit(supplier.moq, 50) || 'Not Specified'}
- Target Minimum Order Quantity (MOQ): ${sanit(supplier.targetMOQ, 50) || 'Not Specified'}
- Incoterms: ${sanit(supplier.incoterms, 50) || 'FOB'}
- Primary Negotiation Goal / Strategic Aim: ${sanit(supplier.negotiationGoal, 200) || 'Unspecified'}
- Target Payment Terms: ${sanit(supplier.paymentTarget, 200) || 'Unspecified'}
- Deal Urgency Level: ${sanit(supplier.urgencyLevel, 50) || 'Standard'}
- Additional Description & Negotiation Notes: ${sanit(supplier.notes, 500) || 'None provided'}
- Relationship Scores: ${JSON.stringify(scores || { trust: 50, leverage: 50, urgency: 50 })}`
        })
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error("Server returned non-JSON response");
      }

      if (!response.ok) throw new Error(data.error || "Server Error");

      setIsSimulating(false);
      const aiResponseText = parseConversationalResponse(data.text);
      const parsedAnalysis = parseAnalysis(data.text);
      const hasAnalysisText = data.text.toLowerCase().includes('translation') || data.text.toLowerCase().includes('real meaning') || data.text.toLowerCase().includes('suggested reply');
      const newScores = hasAnalysisText ? parseScores(data.text) : null;

      if (hasAnalysisText) {
        setAnalysis(parsedAnalysis);
        if (newScores) setScores(newScores);
      }

      const { error: aiMsgErr } = await supabase
        .from('chat_messages')
        .insert({
          supplier_id: supplier.id,
          sender: 'ai',
          sender_name: 'Rui',
          text: aiResponseText || "Analysis complete.",
          created_at: new Date().toISOString(),
          translation: data.text
        });
      if (aiMsgErr) throw aiMsgErr;

      saveConversation(newScores, hasAnalysisText ? parsedAnalysis : undefined);
    } catch (err: any) {
      setIsTyping(false);
      console.error(err);
      alert("Error taking action: " + (err.message || "Failed to chat with AI strategist."));
    }
  };

  return (
    <div className="flex-grow flex flex-col min-h-screen font-body-rg selection:bg-primary-fixed">
      {/* Top Navigation Bar */}
      <header className="bg-surface-container-lowest border-b border-border-light flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop sticky top-0 z-50">
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
          <h2 className="font-subhead-sm text-on-background text-[11px] md:text-sm font-bold hidden sm:block">
            Negotiation Room / <span className="font-bold text-subtitle-grey">谈判室</span>
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <button 
            className={`text-secondary hover:text-primary flex items-center gap-1.5 transition-colors cursor-pointer px-3 py-1.5 border border-border-light rounded-lg hover:border-primary text-xs font-semibold ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => { if (!isExporting) handleExportHistory(); }}
            disabled={isExporting}
            title="Export Negotiation History | 导出谈判记录"
          >
            {isExporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="hidden sm:inline">Compiling PDF...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">download</span>
                <span className="hidden sm:inline">Export History</span>
              </>
            )}
          </button>
          <button className="text-secondary hover:text-primary transition-colors cursor-pointer" onClick={() => onNavigate('cultural-guide')}>
            <span className="material-symbols-outlined text-sm">explore</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="w-full max-w-[1600px] mx-auto px-4 md:px-margin-desktop py-6 lg:py-8 flex flex-col gap-4 lg:gap-8 flex-grow">
        
        {/* Mobile/Tablet Tab Switcher */}
        <div className="lg:hidden flex border border-border-light bg-surface-muted/60 p-1.5 rounded-2xl gap-1 shadow-inner items-center shrink-0">
          {[
            { id: 'chat', label: 'Chat Room', icon: 'forum' },
            { id: 'analysis', label: 'Rui AI Analysis', icon: 'psychology' },
            { id: 'meters', label: 'Guanxi & Price', icon: 'analytics' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id 
                  ? 'bg-primary text-white shadow-md shadow-primary/10' 
                  : 'text-secondary hover:bg-white/60 active:bg-white'
              }`}
            >
              <span className="material-symbols-outlined !text-[16px] sm:!text-[18px]" style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1" : undefined }}>{tab.icon}</span>
              <span className="leading-none">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content columns layout */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 flex-grow w-full">
          
          {/* Left Sidebar */}
          <aside className={`w-full lg:w-[220px] flex-col gap-6 flex-shrink-0 ${activeTab === 'meters' || activeTab === 'analysis' ? 'flex' : 'hidden lg:flex'}`}>
            {/* Supplier Info */}
            <section className={`bg-white p-4 rounded-2xl border border-border-light shadow-sm ${activeTab === 'meters' ? 'block' : 'hidden lg:block'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-surface-muted rounded-xl flex items-center justify-center text-secondary font-bold text-base overflow-hidden border border-border-light">
                  {supplier.logoUrl ? (
                    <img src={supplier.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    supplier.englishName.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-subhead-sm text-xs font-bold text-on-surface truncate">{supplier.englishName}</p>
                  <p className="font-label-cn-rg text-subtitle-grey text-[9px]">{supplier.chineseName}</p>
                </div>
              </div>
              <div className="space-y-2 text-[10px] font-medium">
                <div className="flex justify-between">
                  <span className="text-subtitle-grey uppercase tracking-wider">Status</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${supplier.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-surface-muted'}`}>{supplier.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-subtitle-grey uppercase tracking-wider">Location</span>
                  <span className="font-bold">{supplier.city}, China</span>
                </div>
              </div>
            </section>

            {/* Price Tracker */}
            <section className={`bg-white p-4 rounded-2xl border border-border-light shadow-sm bg-surface-container-lowest animate-fade-in ${activeTab === 'meters' ? 'block' : 'hidden lg:block'}`}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">track_changes</span>
                Price Tracker
              </h3>
              
              {/* Target price display */}
              <div className="bg-surface-muted/50 p-3 rounded-xl text-center mb-2.5 border border-border-light/40">
                <p className="text-[9px] font-medium text-subtitle-grey mb-0.5 uppercase tracking-wide">Target Price Goal</p>
                <p className="text-xl font-bold text-primary">¥{supplier.targetPrice || "0.00"}</p>
              </div>

              {/* Current Price Now interactive block */}
              <div className="bg-primary/5 p-3 rounded-xl text-center mb-3 border border-primary/10 relative group">
                <p className="text-[9px] font-medium text-primary mb-0.5 uppercase tracking-wider font-semibold">Current Price (Now)</p>
                {isEditingPrice ? (
                  <div className="flex gap-1.5 justify-center items-center mt-1">
                    <span className="text-xs font-bold text-secondary">¥</span>
                    <input
                      type="text"
                      value={tempPrice}
                      onChange={(e) => setTempPrice(e.target.value)}
                      className="w-20 px-1 py-0.5 text-center text-xs border border-border-light rounded focus:ring-1 focus:ring-primary outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSavePrice(); }}
                      autoFocus
                    />
                    <button onClick={handleSavePrice} className="material-symbols-outlined text-[16px] text-green-600 hover:text-green-800 cursor-pointer font-bold">check</button>
                    <button onClick={() => setIsEditingPrice(false)} className="material-symbols-outlined text-[16px] text-error cursor-pointer font-bold">close</button>
                  </div>
                ) : (
                  <div className="flex justify-center items-center gap-1.5 mt-0.5">
                    <p className="text-lg font-bold text-secondary">¥{supplier.currentPrice || supplier.walkAwayPrice || "---"}</p>
                    <button onClick={() => { setTempPrice(supplier.currentPrice || supplier.walkAwayPrice || ''); setIsEditingPrice(true); }} className="material-symbols-outlined text-[13px] text-subtitle-grey hover:text-primary cursor-pointer opacity-50 hover:opacity-100 transition-opacity">edit</button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {(() => {
                  const minPrice = parseFloat(supplier.targetPrice || '0');
                  const maxPrice = parseFloat(supplier.walkAwayPrice || '0');
                  const currentPriceVal = parseFloat(supplier.currentPrice || supplier.walkAwayPrice || '0');
                  let pricePercentage = 50;
                  if (!isNaN(minPrice) && !isNaN(maxPrice) && !isNaN(currentPriceVal) && maxPrice > minPrice) {
                    const capped = Math.min(Math.max(currentPriceVal, minPrice), maxPrice);
                    pricePercentage = Math.round(((maxPrice - capped) / (maxPrice - minPrice)) * 100);
                  } else {
                    pricePercentage = 50;
                  }
                  return (
                    <>
                      <div className="relative h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
                        <div className="absolute h-full bg-secondary rounded-full" style={{ width: `${pricePercentage}%` }}></div>
                      </div>
                      <div className="flex justify-between text-[9px] font-medium text-subtitle-grey uppercase">
                        <span>¥{supplier.currentPrice || supplier.walkAwayPrice || '---'} Now</span>
                        <span>¥{supplier.targetPrice || '---'} Goal</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </section>

            {/* Simulate Input Area */}
            <section className={`bg-white p-4 rounded-2xl border border-dashed border-primary/30 shadow-sm relative overflow-hidden group ${activeTab === 'analysis' ? 'block' : 'hidden lg:block'}`}>
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-3xl">factory</span>
              </div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Simulate Supplier Reply</h3>
              <textarea 
                className="w-full bg-surface-muted/30 border border-border-light rounded-xl p-2.5 text-[11px] font-normal focus:ring-1 focus:ring-primary outline-none min-h-[80px] resize-none"
                placeholder="Paste a WeChat message..."
                value={simulatedReply}
                onChange={(e) => setSimulatedReply(e.target.value)}
              />
              <button 
                onClick={handleSimulateReply}
                disabled={isSimulating}
                className="w-full mt-2.5 bg-white border border-primary text-primary font-bold py-2 rounded-xl text-[10px] uppercase tracking-wide hover:bg-primary/5 transition-all disabled:opacity-50"
              >
                {isSimulating ? "Analyzing..." : "Process Message"}
              </button>
            </section>
          </aside>

        {/* Center Panel - Chat Area */}
        <div className={`flex-grow flex-col gap-6 min-w-0 ${activeTab === 'chat' || activeTab === 'analysis' ? 'flex' : 'hidden lg:flex'}`}>
          
          {/* Analysis Card */}
          <section className={`bg-white border border-border-light rounded-[24px] shadow-sm overflow-hidden animate-fade-in shrink-0 flex flex-col relative ${activeTab === 'analysis' ? 'flex' : 'hidden lg:flex'}`}>
            {(isTyping || isSimulating) && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-3 animate-fade-in">
                <div className="flex gap-1.5 items-center">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] animate-pulse">Rui is Updating Analysis...</p>
              </div>
            )}
            <div className="bg-surface-muted/20 px-5 py-2.5 border-b border-border-light flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <img src="https://i.ibb.co.com/ZZ9rMnb/1.png" className="w-14 h-14 object-contain p-1.5 bg-white rounded-full border border-primary/20 shadow-md transition-transform hover:scale-105" />
                <span className="font-semibold text-[11px] text-primary uppercase tracking-widest leading-none">Rui Smart Analysis</span>
              </div>
              <span className="text-[10px] font-normal bg-white border border-border-light px-3 py-0.5 rounded-full text-subtitle-grey">Confidence: 94%</span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Column 1: The Input (Supplier's side) */}
              <div className="md:col-span-4 space-y-5">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-subtitle-grey mb-2 opacity-60 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">translate</span>
                    A. Translation
                  </p>
                  <div className="p-3.5 bg-surface-muted rounded-2xl text-[12px] font-normal text-secondary leading-relaxed border border-border-light/40 italic min-h-[80px] max-h-[140px] overflow-y-auto scrollbar-thin">
                    "{analysis.translation}"
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-subtitle-grey mb-2 opacity-60 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">psychology</span>
                    B. Real Meaning
                  </p>
                  <div className="p-3.5 bg-primary/5 rounded-2xl text-[12px] font-medium text-on-surface leading-relaxed border border-primary/10 min-h-[80px] max-h-[140px] overflow-y-auto scrollbar-thin">
                    {cleanMarkdown(analysis.realMeaning)}
                  </div>
                </div>
              </div>

              {/* Column 2: The Context (Relationship) */}
              <div className="md:col-span-4 space-y-5">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-subtitle-grey mb-2 opacity-60 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">handshake</span>
                    C. Guanxi & Tone
                  </p>
                  <div className="flex items-start gap-3 text-[12px] font-normal text-secondary bg-white p-3.5 rounded-2xl border border-border-light/60 min-h-[80px] max-h-[140px] overflow-y-auto scrollbar-thin shadow-sm">
                    <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">sentiment_satisfied</span>
                    <span className="leading-relaxed">{analysis.guanxiTone}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-tertiary mb-2 opacity-60 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span>
                    E. Next Move
                  </p>
                  <div className="p-3.5 bg-tertiary/5 rounded-2xl border border-tertiary/10 min-h-[80px] max-h-[140px] overflow-y-auto scrollbar-thin">
                    <p className="text-[12px] font-normal leading-relaxed text-tertiary italic">
                      {cleanMarkdown(analysis.nextMove || "Strategic patience recommended.")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Column 3: The Output (Your Reply) */}
              <div className="md:col-span-4 flex flex-col">
                <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-2 opacity-80">
                  D. Suggested Reply
                </p>
                <div className="flex-grow flex flex-col gap-3">
                  <div className="flex-grow p-4 bg-primary/5 border border-primary/20 rounded-2xl relative group overflow-hidden min-h-[120px] flex flex-col">
                    <div className="flex-grow flex flex-col mb-3">
                      <textarea
                        value={editableReply}
                        onChange={(e) => setEditableReply(e.target.value)}
                        className="w-full h-full min-h-[120px] bg-transparent border-none focus:ring-0 text-[13px] font-medium leading-relaxed text-secondary resize-none outline-none focus:outline-none scrollbar-thin"
                        placeholder="Type or modify the suggested reply here..."
                      />
                    </div>
                    <div className="mt-auto flex justify-start pt-2 border-t border-primary/10">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(editableReply);
                        }}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-primary text-white rounded-full text-[10px] font-bold uppercase tracking-wider shadow hover:bg-primary-container transition-all active:scale-[0.98] cursor-pointer max-w-max self-start"
                      >
                        <span className="material-symbols-outlined text-[12px]">content_copy</span>
                        Copy Text
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Chat Messages */}
          <div className={`flex-grow h-[540px] min-h-[420px] flex flex-col bg-white border border-border-light rounded-[24px] shadow-sm relative overflow-hidden ${activeTab === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scroll-smooth" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                  <span className="material-symbols-outlined text-5xl mb-4">forum</span>
                  <p className="text-sm font-bold">Start a negotiation with {supplier.englishName}</p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    className={`flex ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-4`}
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border overflow-hidden ${
                      msg.sender === 'user' ? 'bg-secondary text-white' : 
                      msg.sender === 'ai' ? 'bg-white border-primary/20' : 'bg-surface-muted text-slate-700'
                    }`}>
                      {msg.sender === 'ai' ? (
                        <img src="https://i.ibb.co.com/ZZ9rMnb/1.png" className="w-12 h-12 object-contain p-0.5" />
                      ) : msg.sender === 'supplier' && supplier.logoUrl ? (
                        <img src={supplier.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="font-semibold text-sm">{msg.sender === 'user' ? 'ME' : 'F'}</span>
                      )}
                    </div>
                    <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                      msg.sender === 'user' ? 'bg-surface-container border border-border-light rounded-tr-none' : 
                      msg.sender === 'ai' ? 'bg-primary/5 border border-primary/10 rounded-tl-none' : 'bg-surface-muted/50 border border-border-light rounded-tl-none'
                    }`}>
                      <p className={`text-[10px] font-normal mb-1 opacity-50 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                        {msg.senderName} • {(() => {
                          if (msg.createdAt) {
                            try {
                              const d = typeof msg.createdAt.toDate === 'function' ? msg.createdAt.toDate() : new Date(msg.createdAt);
                              return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                            } catch (e) {
                              return msg.timeText || '';
                            }
                          }
                          return msg.timeText || '';
                        })()}
                      </p>
                      <p className="text-sm font-normal leading-relaxed whitespace-pre-wrap">{cleanMarkdown(msg.text)}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {(isTyping || isSimulating) && (
                <div className="flex items-start gap-4 animate-fade-in">
                  <div className="w-14 h-14 rounded-full bg-white border border-primary/20 flex items-center justify-center animate-pulse flex-shrink-0">
                    <img src="https://i.ibb.co.com/ZZ9rMnb/1.png" className="w-12 h-12 object-contain p-0.5" />
                  </div>
                  <div className="bg-primary/5 p-3.5 rounded-2xl rounded-tl-none border border-primary/10 flex flex-col gap-1 shadow-sm max-w-[80%]">
                    <p className="text-[10px] font-bold text-primary tracking-wide uppercase mb-1 animate-pulse">
                      {isSimulating ? "Rui is performing Smart Analysis..." : "Rui is preparing guidance..."}
                    </p>
                    <div className="flex gap-1 items-center py-0.5">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-6 pt-0">
              <form onSubmit={handleSendMessage} className="bg-surface-muted/50 border border-border-light rounded-2xl p-2 flex items-center gap-2 group transition-all focus-within:bg-white focus-within:shadow-lg focus-within:border-primary/30">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask Rui for strategic advice or guidance..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-normal outline-none text-secondary pl-4"
                />
                <button 
                  type="submit"
                  disabled={isTyping}
                  className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-container transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span className="hidden md:inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className={`w-full lg:w-[220px] flex-col gap-5 flex-shrink-0 animate-fade-in ${activeTab === 'meters' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Guanxi Gauge */}
          <section className="bg-white p-3.5 rounded-2xl border border-border-light shadow-sm text-center">
            <h3 className="text-[9px] font-bold uppercase tracking-widest mb-3 opacity-60">Guanxi Meter</h3>
            <div className="relative w-24 h-24 mx-auto mb-4">
              <svg className="w-full h-full -rotate-90">
                <circle cx="48" cy="48" r="44" fill="transparent" stroke="#F5F5F7" strokeWidth="6" />
                <circle 
                  cx="48" cy="48" r="44" fill="transparent" 
                  stroke="#b5000b" strokeWidth="6" strokeDasharray="276.5"
                  strokeDashoffset={276.5 - (276.5 * (supplier.guanxiScore || 0)) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-primary">{supplier.guanxiScore}</span>
              </div>
            </div>
            
            <div className="space-y-2.5 text-left">
              {[
                { label: 'Trust', val: scores.trust },
                { label: 'Leverage', val: scores.leverage },
                { label: 'Urgency', val: scores.urgency, isNegative: true }
              ].map(m => (
                <div key={m.label} className="space-y-1">
                  <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider">
                    <span>{m.label}</span>
                    <span className="text-secondary">{m.val}%</span>
                  </div>
                  <div className="h-1 w-full bg-surface-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${m.isNegative ? (m.val > 60 ? 'bg-error' : 'bg-secondary') : 'bg-primary'}`} 
                      style={{ width: `${m.val}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Stats */}
          <section className="bg-surface-muted/20 p-3.5 rounded-2xl border border-border-light shadow-sm">
            <h3 className="text-[9px] font-bold uppercase tracking-widest mb-2.5 opacity-60">Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-subtitle-grey font-normal">First Contract Date</span>
                <span className="font-bold text-secondary whitespace-nowrap">
                  {(() => {
                    const d = supplier.createdAt ? new Date(supplier.createdAt) : new Date();
                    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-subtitle-grey font-normal">Pace</span>
                <span className="font-bold text-green-600">Fast</span>
              </div>
            </div>
          </section>
        </aside>
        </div>
      </main>
    </div>
  );
}
