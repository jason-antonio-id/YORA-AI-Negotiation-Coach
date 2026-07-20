import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenType, Supplier } from '../types';
import { useSupabase } from '../lib/SupabaseContext';
import { FeedbackWidget } from './FeedbackWidget';
import { supabase, resolveStorageUrl } from '../lib/supabase';
import { jsPDF } from 'jspdf';

interface SettingsProps {
  onNavigate: (screen: ScreenType) => void;
  userData: any;
  setUserData: (data: any) => void;
  suppliers?: Supplier[];
}

export function SettingsScreen({ 
  onNavigate, 
  userData, 
  setUserData, 
  suppliers = []
}: SettingsProps) {
  const { user, refreshProfile } = useSupabase();
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
  const [profileName, setProfileName] = useState(userData.fullName);
  const [profileEmail, setProfileEmail] = useState(userData.email);
  const [profileInstagram, setProfileInstagram] = useState(userData.instagram || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [showAIConfirm, setShowAIConfirm] = useState<{style: string, lang: string} | null>(null);
  const [showNoSuppliersModal, setShowNoSuppliersModal] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState(userData.aiStyle || 'balanced');
  const [selectedLang, setSelectedLang] = useState(userData.aiLang || 'Bahasa Indonesia');
  
  const isGoogleUser = user?.app_metadata?.provider === 'google' || user?.identities?.some((id: any) => id.provider === 'google');

  // Sync state if userData changes
  useEffect(() => {
    setProfileName(userData.fullName);
    setProfileEmail(userData.email);
    setProfileInstagram(userData.instagram || '');
    setSelectedStyle(userData.aiStyle || 'balanced');
    setSelectedLang(userData.aiLang || 'Bahasa Indonesia');
  }, [userData]);

  // AI Prefs linked to state
  const lastUpdate = userData.lastSettingsUpdate ? new Date(userData.lastSettingsUpdate) : null;
  const now = new Date();
  const limitDays = 3 * 24 * 60 * 60 * 1000;
  const canUpdateAI = !lastUpdate || (now.getTime() - lastUpdate.getTime() >= limitDays);

  const handleSelectStyle = (value: string) => {
    if (!canUpdateAI) {
      const nextUpdate = new Date(lastUpdate!.getTime() + limitDays);
      alert(`Settings can only be changed once every 3 days. Next update available: ${nextUpdate.toLocaleDateString()}`);
      return;
    }
    setSelectedStyle(value);
  };

  const handleSelectLang = (value: string) => {
    if (!canUpdateAI) {
      const nextUpdate = new Date(lastUpdate!.getTime() + limitDays);
      alert(`Settings can only be changed once every 3 days. Next update available: ${nextUpdate.toLocaleDateString()}`);
      return;
    }
    setSelectedLang(value);
  };

  const hasAIPrefChanges = selectedStyle !== (userData.aiStyle || 'balanced') || selectedLang !== (userData.aiLang || 'Bahasa Indonesia');

  const confirmAIPrefUpdate = async () => {
    if (!showAIConfirm || !user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ai_style: showAIConfirm.style,
          ai_lang: showAIConfirm.lang,
          last_settings_update: now.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setShowAIConfirm(null);
    } catch (error) {
      console.error("Failed to update AI strategy preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Delete flow
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('');

  // Logout flow
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Legal flow
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | 'cookies' | null>(null);

  // Help center flow
  const [showHelpModal, setShowHelpModal] = useState(false);

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

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleExportPDF = async () => {
    if (!suppliers || suppliers.length === 0) {
      setShowNoSuppliersModal(true);
      return;
    }

    const cleanStringForPDF = (str: string | undefined | null): string => {
      if (!str) return '';
      // Remove all Chinese characters (any character in the CJK Unified Ideographs block)
      let cleaned = str.replace(/[\u4e00-\u9fa5]/g, '');
      // Clean up common leftovers like double spaces, trailing pipes, empty parentheses
      cleaned = cleaned.replace(/\(\s*\)/g, '');
      cleaned = cleaned.replace(/\[\s*\]/g, '');
      cleaned = cleaned.replace(/【\s*】/g, '');
      cleaned = cleaned.replace(/\s*\|\s*/g, ' ');
      cleaned = cleaned.replace(/\s+/g, ' ');
      // Strip leading/trailing whitespaces and dangling dividers
      cleaned = cleaned.trim();
      cleaned = cleaned.replace(/^[|/,-]+|[|/,-]+$/g, '');
      return cleaned.trim();
    };

    setIsGeneratingPDF(true);

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

      const [lData, trData, sData] = await Promise.all([
        getBase64ImageFromUrl(logoUrl, false), // keep PNG for logo transparency
        getBase64ImageFromUrl(topRightMascotUrl, false), // keep PNG for mascot transparency
        getBase64ImageFromUrl(summaryMascotUrl, true)  // compress to JPEG for great memory savings
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

        const dpr = 3;
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

      const getRuiTextImg = () => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return { dataUrl: '', aspect: 1 };

        tempCtx.font = 'bold 22px "Poppins", "Helvetica Neue", "Arial", sans-serif';
        const wRui = tempCtx.measureText('RUI').width;

        tempCtx.font = '22px "Helvetica Neue", "Arial", sans-serif';
        const wDivider = tempCtx.measureText(' | ').width;

        tempCtx.font = 'bold 22px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif';
        const wRuiZh = tempCtx.measureText('睿').width;

        const totalWidth = Math.ceil(wRui + wDivider + wRuiZh);
        const height = 32;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return { dataUrl: '', aspect: 1 };

        const dpr = 3;
        canvas.width = totalWidth * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, totalWidth, height);
        ctx.textBaseline = 'middle';

        // Draw "RUI"
        ctx.font = 'bold 22px "Poppins", "Helvetica Neue", "Arial", sans-serif';
        ctx.fillStyle = '#b71c1c'; // Brand Crimson
        ctx.fillText('RUI', 0, height / 2);

        // Draw " | "
        ctx.font = '22px "Helvetica Neue", "Arial", sans-serif';
        ctx.fillStyle = '#1e1e1e'; // Black divider
        ctx.fillText(' | ', wRui, height / 2);

        // Draw "睿"
        ctx.font = 'bold 22px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif';
        ctx.fillStyle = '#b71c1c'; // Brand Crimson
        ctx.fillText('睿', wRui + wDivider, height / 2 - 2);

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
          doc.text(`YORA-AUDIT-${docId}   •   SECTION 02`, 195, 14.2, { align: "right" });
        } else {
          // Confidential report headers on page 1
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(183, 28, 28);
          doc.text("CONFIDENTIAL INTELLIGENCE REPORT", 179, 12.8, { align: "right" });

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(110, 110, 110);
          doc.text(`Reference ID: YORA-${docId}`, 179, 16.3, { align: "right" });
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
            doc.addImage(summaryMascotData.dataUrl, 'PNG', footerGroupStartX, 278.85, footerMascotWidth, footerMascotHeight);
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
        doc.text(`YORA-AUDIT-${docId}   •   Page ${pageNumber}`, 195, 282, { align: "right" });
      };

      let currentPage = 1;
      drawPageHeader(currentPage);
    drawPageFooter(currentPage);

    let yPos = 32;

    // SECTION 1: EXECUTIVE AUDIT PORTFOLIO SUMMARY
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(183, 28, 28);
    doc.text("01", 15, yPos);

    doc.setTextColor(30, 30, 30);
    doc.text("EXECUTIVE AUDIT SUMMARY", 21, yPos);

    // Section line divider extending to right margin
    const titleWidth1 = doc.getTextWidth("EXECUTIVE AUDIT SUMMARY");
    doc.setDrawColor(220, 222, 226);
    doc.setLineWidth(0.2);
    doc.line(21 + titleWidth1 + 4, yPos - 1.0, 195, yPos - 1.0);

    yPos += 5.5;

    // Left indicator bar (Crimson vertical line)
    doc.setFillColor(183, 28, 28);
    doc.rect(15, yPos, 0.8, 38.0, 'F');

    const overallScore = Math.round(suppliers.reduce((acc, s) => acc + s.guanxiScore, 0) / suppliers.length);

    // Grid Column 1 (x = 19.5)
    // Row 1
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(5.2);
    doc.setTextColor(140, 140, 140);
    doc.text("AUDIT RECIPIENT", 19.5, yPos + 4);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(30, 30, 30);
    doc.text(userData.fullName || "Jason Antonio", 19.5, yPos + 8.2);

    // Row 2
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(5.2);
    doc.setTextColor(140, 140, 140);
    doc.text("ASSOCIATED ENTERBOARD", 19.5, yPos + 14.5);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(30, 30, 30);
    doc.text(userData.businessName || "China Connect", 19.5, yPos + 18.7);

    // Brief assessment paragraph
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(5.2);
    doc.setTextColor(140, 140, 140);
    doc.text("ASSESSMENT BRIEFING", 19.5, yPos + 25);

    const summaryText = `This secure intelligence brief provides a high-fidelity audit of active manufacturing channels, negotiation prices, and cooperative capital index values currently stored in your co-pilot ecosystem. Your corporate portfolio owns an average Guanxi relationship level of ${overallScore}/100. Continuous updates through Rui AI are advised to optimize supply-safety and transaction leverage.`;

    const splitSummary = doc.splitTextToSize(summaryText, 110);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 50);
    doc.text(splitSummary, 19.5, yPos + 28.5);

    // Grid Column 2 (x = 140)
    // Row 1
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(5.2);
    doc.setTextColor(140, 140, 140);
    doc.text("OVERALL GUANXI INDEX", 140, yPos + 4);

    // Large score rendering
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(183, 28, 28);
    doc.text(`${overallScore}`, 140, yPos + 12);
    const scoreWidth = doc.getTextWidth(`${overallScore}`);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("/ 100", 140 + scoreWidth + 1.5, yPos + 10.8);

    // Row 2
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(5.2);
    doc.setTextColor(140, 140, 140);
    doc.text("AUDIT SIGNING REFERENCE", 140, yPos + 18);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(30, 30, 30);
    doc.text(`YORA-AUDIT-${docId}`, 140, yPos + 22.2);

    // Offset below summary
    yPos += 38 + 8;

    // SECTION 2: SUPPLY DIRECTORY
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(183, 28, 28);
    doc.text("02", 15, yPos);

    doc.setTextColor(30, 30, 30);
    doc.text("ACTIVE PORTFOLIO NODE ALIGNMENT", 21, yPos);

    // Section line divider extending to right margin
    const titleWidth2 = doc.getTextWidth("ACTIVE PORTFOLIO NODE ALIGNMENT");
    doc.setDrawColor(220, 222, 226);
    doc.line(21 + titleWidth2 + 4, yPos - 1.0, 195, yPos - 1.0);

    yPos += 5.5;

    // Loop through each active manufacturer
    suppliers.forEach((s, idx) => {
      // Evaluate scores & labels
      const scoreVal = s.guanxiScore || 50;
      let statusLabel = "BUILDING GUANXI";
      let scoreColor = [197, 117, 0]; // Dark Amber/Orange for 45-59

      if (scoreVal >= 80) {
        statusLabel = "TRUSTED ALLY";
        scoreColor = [22, 101, 52]; // Green
      } else if (scoreVal >= 60) {
        statusLabel = "HEALTHY PIPELINE";
        scoreColor = [21, 101, 192]; // Blue
      } else if (scoreVal < 45) {
        statusLabel = "COLD CONTACT";
        scoreColor = [183, 28, 28]; // Crimson Red
      }

      // Specifications and dynamic height calculation
      const specsLine = cleanStringForPDF(s.specs || "No technical specifications entered.");
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.0);
      const splitSpecs = doc.splitTextToSize(specsLine, 85); // 85mm max width
      const specsHeight = splitSpecs.length * 3.1;

      // Vertical offset calculation
      const yMoveStart = 37.5;
      const specsBoxHeight = Math.max(12.2 + specsHeight + 8.5, 33.0);
      const yRecoLabel = yMoveStart + specsBoxHeight; // Comfort margin to clear either column

      const sourcingTip = scoreVal >= 80
        ? "Established high-integrity strategic alliance. Highly advised to leverage high goodwill to lock in volume pricing and consolidate quarterly production priorities."
        : scoreVal >= 60
          ? "Stable Guanxi corridor with proactive communication. Advance regular project milestones, execute on scheduled purchase commitments, and refine MOQ targets."
          : scoreVal >= 45
            ? "Emerging relationship with moderate trust. Build incremental goodwill, hold consistent professional correspondence, and establish clear product benchmark expectations before committing significant capital."
            : "Critical or underperforming relationship status. Exercise extreme vigilance. Diversify sourcing channels immediately and institute multi-vendor background auditing.";
      
      // Compute splitTip with actual drawing font/size set beforehand
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(7.0);
      const splitTip = doc.splitTextToSize(sourcingTip, 172);
      const tipLines = splitTip.length;
      const tipTextHeight = tipLines * 3.2; // 3.2mm spacing per line
      const cardHeight = yRecoLabel + 3.2 + tipTextHeight + 2.5;

      // Safeguard page break prior to card drawing
      if (yPos + cardHeight > 270) {
        doc.addPage();
        currentPage += 1;
        drawPageHeader(currentPage);
        drawPageFooter(currentPage);
        yPos = 32;
      }

      const yCard = yPos;

      // Draw light grey rounded subtle card frame
      doc.setDrawColor(220, 222, 226);
      doc.setLineWidth(0.2);
      doc.roundedRect(15, yCard, 180, cardHeight, 1.2, 1.2, 'S');

      // 1. Draw Index Box
      const sBoxX = 18.5;
      const sBoxY = yCard + 4.5;
      const sBoxW = 31;
      const sBoxH = 21.5;

      doc.setDrawColor(220, 222, 226);
      doc.setLineWidth(0.18);
      doc.roundedRect(sBoxX, sBoxY, sBoxW, sBoxH, 0.8, 0.8, 'S');

      // Inside Index Box labels
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5);
      doc.setTextColor(120, 120, 120);
      doc.text("GUANXI INDEX", sBoxX + 3.5, sBoxY + 5.5);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.text(`${scoreVal}`, sBoxX + 3.5, sBoxY + 13.5);
      const scoreW = doc.getTextWidth(`${scoreVal}`);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text("/ 100", sBoxX + scoreW + 4.8, yCard + 16.8);

      // Status outlined pill
      const xPill = sBoxX + 3.0;
      const yPill = sBoxY + 15.0;
      const wPill = 25.0;
      const hPill = 4.5;

      doc.setDrawColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.setLineWidth(0.18);
      doc.roundedRect(xPill, yPill, wPill, hPill, 0.5, 0.5, 'S');

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5);
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.text(statusLabel, xPill + wPill / 2, yPill + 3.2, { align: "center" });

      // 2. Vertical Divider inside card
      doc.setDrawColor(225, 228, 232);
      doc.setLineWidth(0.18);
      doc.line(53.5, yCard + 4.5, 53.5, yCard + 26.0);

      // 3. Grid details inside Card
      // Column A (x = 57.5)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5);
      doc.setTextColor(140, 140, 140);
      doc.text("PARTY A — MANUFACTURER", 57.5, yCard + 8.5);

      const cleanEnglishName = cleanStringForPDF(s.englishName);
      const fullNameStr = `${idx + 1}. ${cleanEnglishName.toUpperCase()}`;
      const labelLimitWidth = 72;
      const truncatedName = doc.getTextWidth(fullNameStr) > labelLimitWidth 
        ? `${idx + 1}. ` + cleanEnglishName.substring(0, 32).toUpperCase() + "..." 
        : fullNameStr;
 
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(truncatedName, 57.5, yCard + 12.5);
 
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5);
      doc.setTextColor(140, 140, 140);
      doc.text("TRANSACTION CRITERIAS", 57.5, yCard + 18.5);
 
      const cleanTargetPrice = cleanStringForPDF(s.targetPrice || s.currentPrice || '15.00');
      const cleanTargetMOQ = cleanStringForPDF(s.targetMOQ || s.moq || '2,500');
      const pricingText = `CNY ${cleanTargetPrice}  •  MOQ ${cleanTargetMOQ}`;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(pricingText, 57.5, yCard + 22.5);
 
      // Column B (x = 135)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5);
      doc.setTextColor(140, 140, 140);
      doc.text("WECHAT NODE", 135, yCard + 8.5);
 
      const cleanWechatId = cleanStringForPDF(s.wechatId || 'N/A');
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(cleanWechatId, 135, yCard + 12.5);
 
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5);
      doc.setTextColor(140, 140, 140);
      doc.text("COMPANY SUPPLIER WEBSITE", 135, yCard + 18.5);
 
      const websiteUrl = s.url || 'N/A';
      const maxUrlWidth = 52;
      const truncatedUrl = doc.getTextWidth(websiteUrl) > maxUrlWidth
        ? websiteUrl.substring(0, 30) + '...'
        : websiteUrl;
 
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(21, 101, 192);
      doc.text(truncatedUrl, 135, yCard + 22.5);
 
      // 4. Inner Divider Line inside Card
      doc.setDrawColor(240, 242, 245);
      doc.setLineWidth(0.18);
      doc.line(18.5, yCard + 28.5, 191.5, yCard + 28.5);
 
      // 5. Section: SUPPLIER PROFILE & DETAILED SPECIFICATIONS
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5.2);
      doc.setTextColor(183, 28, 28);
      doc.text("SUPPLIER PROFILE & DETAILED SPECIFICATIONS", 18.5, yCard + 32.2);
 
      // Draw Key-Values: Column A (x = 18.5)
      const colAY = yCard + 37.5;
      
      // Row A1: Category
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(4.8);
      doc.setTextColor(140, 140, 140);
      doc.text("PRODUCT CATEGORY", 18.5, colAY);
      
      const cleanCategory = cleanStringForPDF(s.category || 'N/A');
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(40, 40, 40);
      doc.text(cleanCategory, 18.5, colAY + 3.2);
 
      // Row A2: Specs
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(4.8);
      doc.setTextColor(140, 140, 140);
      doc.text("TECHNICAL SPECIFICATIONS", 18.5, colAY + 9.0);
 
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.0);
      doc.setTextColor(40, 40, 40);
      splitSpecs.forEach((line: string, index: number) => {
        doc.text(line, 18.5, colAY + 12.2 + index * 3.1);
      });
 
      // Row A3: Cooperation History
      const histY = colAY + 12.2 + specsHeight + 2.0;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(4.8);
      doc.setTextColor(140, 140, 140);
      doc.text("COOPERATION HISTORY", 18.5, histY);
 
      const cleanCoopHistory = cleanStringForPDF(s.cooperationHistory || 'New Sourcing Pipeline');
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.0);
      doc.setTextColor(40, 40, 40);
      doc.text(cleanCoopHistory, 18.5, histY + 3.2);
 
      // Draw Key-Values: Column B (x = 110.0)
      // Row B1: Incoterms
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(4.8);
      doc.setTextColor(140, 140, 140);
      doc.text("INCOTERMS (LOGISTICS DELIVERY)", 110.0, colAY);
 
      const cleanIncoterms = cleanStringForPDF(s.incoterms || 'FOB');
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(40, 40, 40);
      doc.text(cleanIncoterms, 110.0, colAY + 3.2);
 
      // Row B2: MOQ Options
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(4.8);
      doc.setTextColor(140, 140, 140);
      doc.text("MINIMUM ORDER QUANTITY (MOQ)", 110.0, colAY + 9.0);
 
      const cleanMoq = cleanStringForPDF(s.moq || 'N/A');
      const cleanTargetMOQValue = cleanStringForPDF(s.targetMOQ || 'N/A');
      const moqDetails = `Initial MOQ: ${cleanMoq} (Target Threshold: ${cleanTargetMOQValue})`;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.0);
      doc.setTextColor(40, 40, 40);
      doc.text(moqDetails, 110.0, colAY + 12.2);
 
      // Row B3: Strategy & Payment Target
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(4.8);
      doc.setTextColor(140, 140, 140);
      doc.text("NEGOTIATION STRATEGY & PAYMENT TARGET", 110.0, colAY + 17.5);
 
      const cleanGoal = cleanStringForPDF(s.negotiationGoal || 'Lowest Price Guarantee');
      const cleanPayment = cleanStringForPDF(s.paymentTarget || '100% Net 30');
      const strategyAndPayment = `Goal: ${cleanGoal} (Target Term: ${cleanPayment})`;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.0);
      doc.setTextColor(40, 40, 40);
      doc.text(strategyAndPayment, 110.0, colAY + 20.7);
 
      // Row B4: Origin Hub Location
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(4.8);
      doc.setTextColor(140, 140, 140);
      doc.text("ORIGIN HUB LOCATION", 110.0, colAY + 26.0);
 
      const cleanCity = cleanStringForPDF(s.city || 'Hangzhou');
      const cleanProvince = cleanStringForPDF(s.province || 'Zhejiang Province');
      const locDetails = `${cleanCity}, ${cleanProvince}, China`;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.0);
      doc.setTextColor(40, 40, 40);
      doc.text(locDetails, 110.0, colAY + 29.2);

      // 6. Section: STRATEGIC RECOMMENDATION
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5);
      doc.setTextColor(140, 140, 140);
      doc.text("STRATEGIC RECOMMENDATION", 18.5, yCard + yRecoLabel);

      doc.setFont("Helvetica", "italic");
      doc.setFontSize(7.0);
      doc.setTextColor(110, 110, 110);
      splitTip.forEach((line: string, index: number) => {
        doc.text(line, 18.5, yCard + yRecoLabel + 3.2 + index * 3.2);
      });

      yPos += cardHeight + 5; // spacing with next card (gap = 5mm)
    });

    // Page 2 or last page portfolio summary banner (Rui Summary Box)
    const activeNodesText = `${suppliers.length} active node${suppliers.length > 1 ? 's' : ''}`;
    const bannerText = `Your portfolio spans ${activeNodesText} with a composite Guanxi Index of ${overallScore} / 100. Rui identifies active anchor nodes, developing relationships, and high-risk contacts requiring monitoring. Prioritize strategic manufacturers to leverage premium deals. Next intelligence refresh is scheduled automatically.`;
    const splitBanner = doc.splitTextToSize(bannerText, 160);
    const bannerHeight = 14 + (splitBanner.length * 3.8) + 4;

    // Safeguard page break prior to summary box drawing
    if (yPos + bannerHeight > 270) {
      doc.addPage();
      currentPage += 1;
      drawPageHeader(currentPage);
      drawPageFooter(currentPage);
      yPos = 32;
    }

    const yBanner = yPos;

    // Draw the banner container background
    doc.setFillColor(255, 248, 248); // light pink-red fill
    doc.roundedRect(15, yBanner, 180, bannerHeight, 1.2, 1.2, 'F');

    // Container border outline
    doc.setDrawColor(245, 215, 215);
    doc.setLineWidth(0.2);
    doc.roundedRect(15, yBanner, 180, bannerHeight, 1.2, 1.2, 'S');

    // Left thick indicator vertical bar
    doc.setFillColor(183, 28, 28);
    doc.rect(15, yBanner, 1.5, bannerHeight, 'F');

    // Mascot inside portfolio summary banner instead of older Circle A
    let startXOfBannerHeading = 27.2; // default fallback if mascot is missing
    const bannerMascotHeight = 7.5;
    const bannerMascotWidth = bannerMascotHeight * (summaryMascotData.aspect || 1.0);

    if (summaryMascotData.dataUrl) {
      const mascotX = 18.0;
      try {
        doc.addImage(summaryMascotData.dataUrl, 'PNG', mascotX, yBanner + 2.6, bannerMascotWidth, bannerMascotHeight);
        startXOfBannerHeading = mascotX + bannerMascotWidth + 0.8;
      } catch (e) {
        console.error("Failed to add banner mascot image", e);
        // Fallback Circle A
        doc.setFillColor(183, 28, 28);
        doc.circle(21.5, yBanner + 6.2, 2.3, 'F');
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.text("A", 21.5, yBanner + 7.8, { align: "center" });
        startXOfBannerHeading = 21.5 + 2.3 + 1.5; 
      }
    } else {
      // Fallback Circle A
      doc.setFillColor(183, 28, 28);
      doc.circle(21.5, yBanner + 6.2, 2.3, 'F');
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(5.5);
      doc.setTextColor(255, 255, 255);
      doc.text("A", 21.5, yBanner + 7.8, { align: "center" });
      startXOfBannerHeading = 21.5 + 2.3 + 1.5; 
    }

    // Banner heading
    const ruiTextImg = getRuiTextImg();
    if (ruiTextImg && ruiTextImg.dataUrl) {
      const bannerRuiHeight = 3.5;
      const bannerRuiWidth = bannerRuiHeight * ruiTextImg.aspect;
      doc.addImage(ruiTextImg.dataUrl, 'PNG', startXOfBannerHeading, yBanner + 4.5, bannerRuiWidth, bannerRuiHeight);
      
      // Banner heading text (rest)
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(183, 28, 28);
      doc.text("•  PORTFOLIO INTELLIGENCE SUMMARY", startXOfBannerHeading + bannerRuiWidth + 1.2, yBanner + 7.2);
    } else {
      // Fallback
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(183, 28, 28);
      doc.text("RUI  •  PORTFOLIO INTELLIGENCE SUMMARY", startXOfBannerHeading, yBanner + 7.2);
    }

    // Banner body text
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(50, 50, 50);
    doc.text(splitBanner, 22, yBanner + 12.8);

    // Save final generated Document PDF
    doc.save(`yora_strategic_ecosystem_audit_${docId}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    setPasswordError('');
    
    // Optimistically update local state immediately so user sees instant confirmation
    const oldName = userData.fullName;
    const oldInstagram = userData.instagram || '';
    setUserData((prev: any) => ({ ...prev, fullName: profileName, instagram: profileInstagram }));
    setIsEditing(false);

    try {
      // Update Name and Instagram Update in profiles table
      if (profileName !== oldName || profileInstagram !== oldInstagram) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({
            full_name: profileName,
            instagram: profileInstagram,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        if (profileErr) throw profileErr;

        // Sync updated profile to Google Sheets
        const finalEmail = user.email || userData.email || '';
        fetch('/api/update-profile-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: finalEmail,
            fullName: profileName,
            instagram: profileInstagram
          })
        }).catch(err => {
          console.error("Failed to sync updated profile to Google Sheets:", err);
        });
      }

      await refreshProfile();
    } catch (error: any) {
      // Rollback optimistic state if there is a catastrophic failure
      setUserData((prev: any) => ({ ...prev, fullName: oldName, instagram: oldInstagram }));
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      onNavigate('login');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleFeedbackClick = () => {
    window.open("https://forms.gle/NRhSuqjefpLEYBDr7", "_blank");
  };

  const handleVerifyOldPassword = async () => {
    if (!user || !user.email) return;
    setIsSaving(true);
    setPasswordError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (error) throw error;
      setPasswordError('');
      setPasswordStep(2);
    } catch (err: any) {
      console.error("Re-auth error:", err);
      setPasswordError('Incorrect password | 密码不正确');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmNewPassword) {
      setPasswordError('Please fill all fields | 请填写所有字段');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match | 新密码不匹配');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters | 密码必须至少 6 个字符');
      return;
    }
    
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('Password changed successfully | 密码修改成功');
      setShowPasswordChange(false);
      setPasswordStep(1);
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordError('');
    } catch (err: any) {
      console.error("Password change error:", err);
      setPasswordError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-grow text-on-surface font-body-rg text-body-rg min-h-screen">
      {/* Notification Bell Badge in Header */}
      <header className="flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop bg-surface-container-lowest border-b border-border-light sticky top-0 z-50 shrink-0 mb-6">
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
            Settings / <span className="font-bold text-subtitle-grey">设置</span>
          </h2>
        </div>
      </header>

      <main className="p-4 sm:p-6 md:p-10 max-w-container-max mx-auto relative z-0">
        <motion.header 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-stack-lg"
        >
          <h1 className="font-headline-md text-headline-md text-on-surface text-2xl font-bold">Settings | 设置</h1>
          <p className="text-secondary text-sm">Manage your account preferences and system configurations</p>
        </motion.header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter items-start">
          {/* Left Column: Settings Sections */}
          <div className="col-span-12 lg:col-span-8 space-y-stack-md">
            {/* Profile Card */}
            <section className="bento-card p-stack-md rounded-xl bg-white shadow-sm border border-border-light">
              <div className="flex justify-between items-center mb-stack-md">
                <div>
                  <h3 className="font-subhead-sm text-sm font-semibold">Profile | 个人资料</h3>
                  <p className="text-xs text-subtitle-grey">Update your personal information and public identity</p>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-primary font-medium text-xs cursor-pointer hover:underline"
                >
                  {isEditing ? 'Cancel | 取消' : 'Edit | 编辑'}
                </button>
              </div>

              {isEditing ? (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-secondary">Full Name | 姓名</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full mt-1 border border-border-light rounded-lg p-2 text-sm bg-surface focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-secondary">Instagram (opsional)</label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtitle-grey font-bold select-none text-sm">@</span>
                        <input
                          type="text"
                          value={profileInstagram.replace(/^@+/, '')}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (!value) {
                              setProfileInstagram('');
                              return;
                            }
                            const cleaned = value.replace(/^@+/, '');
                            setProfileInstagram(`@${cleaned}`);
                          }}
                          className="w-full pl-8 pr-2 py-2 border border-border-light rounded-lg text-sm bg-surface focus:outline-none"
                          placeholder="yourusername"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-secondary">Email | 电子邮件 (Immutable)</label>
                      <input
                        type="email"
                        value={profileEmail}
                        disabled={true}
                        className="w-full mt-1 border border-border-light rounded-lg p-2 text-sm bg-surface-muted cursor-not-allowed opacity-60 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-4 py-2 bg-primary text-white font-medium text-xs rounded-lg shadow-sm hover:opacity-95 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center border border-border-light overflow-hidden shrink-0">
                    <span className="material-symbols-outlined text-subtitle-grey text-4xl">person</span>
                  </div>
                  <div className="flex-1 w-full text-center sm:text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-bold text-secondary">Full Name | 姓名</p>
                        <p className="text-sm font-semibold">{profileName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-secondary">Instagram</p>
                        <p className="text-sm font-semibold">{profileInstagram || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-secondary">Email | 电子邮件</p>
                        <p className="text-sm font-semibold break-all">{profileEmail}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* AI Preferences Card */}
            <section className="bento-card p-stack-md rounded-xl bg-white shadow-sm border border-border-light">
              <h3 className="font-subhead-sm text-sm font-semibold mb-stack-sm text-on-surface">AI Preferences | AI 偏好</h3>
              <p className="text-xs text-subtitle-grey mb-stack-md">Customize how Rui Assistant interacts with your suppliers. Changes allowed once every 3 days.</p>

              <div className="space-y-stack-md">
                <div>
                  <label className="text-xs font-bold text-secondary block mb-2 font-semibold text-subtitle-grey">Negotiation Style | 谈判风格</label>
                  <div className="bg-surface-muted p-1 rounded-lg flex gap-1">
                    {[
                      { key: 'aggressive', title: 'Aggressive / 激进型' },
                      { key: 'balanced', title: 'Balanced / 平衡型' },
                      { key: 'collaborative', title: 'Collaborative / 协作型' }
                    ].map(style => (
                      <button
                        key={style.key}
                        onClick={() => handleSelectStyle(style.key)}
                        className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          selectedStyle === style.key ? 'bg-white shadow-sm text-primary' : 'text-subtitle-grey hover:text-on-surface'
                        }`}
                      >
                        {style.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-secondary block mb-2 font-semibold text-subtitle-grey">Response Language | 回复语言</label>
                  <div className="bg-surface-muted p-1 rounded-lg flex gap-1 flex-wrap">
                    {["Bahasa Indonesia", "English", "中文 (简体)"].map(lang => (
                      <button
                        key={lang}
                        onClick={() => handleSelectLang(lang)}
                        className={`flex-1 py-2 px-2 text-[10px] font-bold rounded-md transition-all cursor-pointer whitespace-nowrap min-w-[80px] ${
                          selectedLang === lang ? 'bg-white shadow-sm text-primary' : 'text-subtitle-grey hover:text-on-surface'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                {hasAIPrefChanges && (
                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => setShowAIConfirm({ style: selectedStyle, lang: selectedLang })}
                      className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-lg shadow-md hover:bg-opacity-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">save</span>
                      Save Preferences | 保存偏好
                    </button>
                  </div>
                )}
              </div>
            </section>




            {/* Security Card */}
            <section className="bento-card p-stack-md rounded-xl bg-white shadow-sm border border-border-light">
              <h3 className="font-subhead-sm text-sm font-semibold mb-stack-sm text-on-surface">Security | 安全</h3>
              
              {isGoogleUser ? (
                <div className="p-4 bg-surface-muted rounded-lg border border-border-light flex items-center gap-3">
                   <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                   <p className="text-xs text-subtitle-grey">You are logged in with Google. Password management is handled by your Google Account.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-stack-sm">
                {!showPasswordChange ? (
                  <button
                    onClick={() => {
                      setShowPasswordChange(true);
                      setPasswordStep(1);
                    }}
                    className="flex items-center justify-between p-4 rounded-lg border border-border-light hover:bg-surface-muted transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-secondary group-hover:text-primary">lock_reset</span>
                      <span className="text-xs font-semibold">Change Password | 修改密码</span>
                    </div>
                    <span className="material-symbols-outlined text-subtitle-grey text-base">chevron_right</span>
                  </button>
                ) : (
                  <div className="p-4 bg-surface-muted rounded-xl border border-secondary/10 animate-fade-in space-y-3">
                    {/* Step Indicators */}
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${passwordStep === 1 ? 'bg-primary text-white' : 'bg-green-500 text-white'}`}>
                        {passwordStep === 1 ? '1' : <span className="material-symbols-outlined text-[12px]">check</span>}
                      </div>
                      <div className="h-px flex-1 bg-border-light"></div>
                      <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${passwordStep === 2 ? 'bg-primary text-white' : 'bg-surface-variant text-secondary'}`}>2</div>
                    </div>

                    {passwordStep === 1 ? (
                      <div className="space-y-2.5 animate-fade-in">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-subtitle-grey uppercase tracking-wider block">Old Password | 旧密码</label>
                          <input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="Enter old password"
                            className="w-full border border-border-light rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
                          />
                        </div>
                        {passwordError && <p className="text-[9px] text-error font-bold flex items-center gap-0.5"><span className="material-symbols-outlined text-[12px]">error</span> {passwordError}</p>}
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <button
                            onClick={handleVerifyOldPassword}
                            className="w-full sm:flex-1 py-1.5 px-3 bg-primary text-white rounded-lg text-[10px] font-bold hover:bg-opacity-95 transition-all shadow-sm flex items-center justify-center gap-1"
                          >
                            Verify Password | 验证
                          </button>
                          <button
                            onClick={() => {
                              setShowPasswordChange(false);
                              setOldPassword('');
                              setPasswordError('');
                            }}
                            className="w-full sm:px-3 py-1.5 bg-surface-variant text-secondary rounded-lg text-[10px] font-bold hover:bg-surface-muted transition-all"
                          >
                            Cancel | 取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5 animate-fade-in">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-subtitle-grey uppercase tracking-wider block">New Password | 新密码</label>
                          <input
                            type="password"
                            autoFocus
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="w-full border border-border-light rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-subtitle-grey uppercase tracking-wider block">Confirm New Password | 确认新密码</label>
                          <input
                            type="password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="w-full border border-border-light rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
                          />
                        </div>
                        {passwordError && <p className="text-[9px] text-error font-bold flex items-center gap-0.5"><span className="material-symbols-outlined text-[12px]">error</span> {passwordError}</p>}
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <button
                            onClick={handlePasswordChange}
                            className="w-full sm:flex-1 py-1.5 px-3 bg-primary text-white rounded-lg text-[10px] font-bold hover:bg-opacity-95 transition-all shadow-sm flex items-center justify-center gap-1"
                          >
                            Update Password | 更新密码
                          </button>
                          <button
                            onClick={() => {
                              setPasswordStep(1);
                              setNewPassword('');
                              setConfirmNewPassword('');
                              setPasswordError('');
                            }}
                            className="w-full sm:px-3 py-1.5 bg-surface-variant text-secondary rounded-lg text-[10px] font-bold hover:bg-surface-muted transition-all"
                          >
                            Back | 返回
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

            {/* Data Export Card */}
            <section className="bento-card p-6 md:p-8 rounded-2xl bg-white shadow-sm border border-border-light overflow-hidden transition-all hover:shadow-md">
              <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined">picture_as_pdf</span>
                    <span className="font-sans font-bold text-xs uppercase tracking-wider">Strategic Document Generator</span>
                  </div>
                  <h3 className="font-headline-md text-xl font-bold text-charcoal">Ecosystem Audit Export | 数据报告导出</h3>
                  <p className="text-xs text-subtitle-grey leading-relaxed max-w-md">
                    Generate and compile a comprehensive strategic intelligence report. This dynamic PDF includes verified manufacturer profile details, target MoQ & pricing parameters, overall Guanxi index performance statistics, and adaptive strategic sourcing recommendations.
                  </p>
                  
                  {/* Document Schema Quick List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <div className="flex items-center gap-2 text-[11px] text-secondary font-medium">
                      <span className="material-symbols-outlined text-xs text-primary">check_circle</span>
                      <span>Verified Manufacturer Profiles</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-secondary font-medium">
                      <span className="material-symbols-outlined text-xs text-primary">check_circle</span>
                      <span>Overall Guanxi Index Briefing</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-secondary font-medium">
                      <span className="material-symbols-outlined text-xs text-primary">check_circle</span>
                      <span>MoQ & Target Pricing Parameters</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-secondary font-medium">
                      <span className="material-symbols-outlined text-xs text-primary">check_circle</span>
                      <span>Adaptive Strategic Sourcing Tips</span>
                    </div>
                  </div>
                </div>

                {/* PDF Document Preview Mockup Component */}
                <div className="w-full md:w-auto flex flex-col items-center shrink-0 pr-2">
                  <motion.div 
                    whileHover={isGeneratingPDF ? {} : { scale: 1.03, rotate: 1 }}
                    className={`relative w-40 h-52 bg-surface-container-lowest border border-border-light rounded-xl shadow-lg p-4 flex flex-col justify-between overflow-hidden cursor-pointer group ${isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => { if (!isGeneratingPDF) handleExportPDF(); }}
                  >
                    {/* Tiny Paper header */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="w-10 h-2 bg-primary/20 rounded"></div>
                        <div className="w-6 h-1.5 bg-subtitle-grey/20 rounded"></div>
                      </div>
                      <div className="h-px bg-border-light/60 my-1"></div>
                      <div className="w-full h-3 bg-charcoal/10 rounded"></div>
                      <div className="w-2/3 h-2 bg-subtitle-grey/15 rounded"></div>
                    </div>
                    
                    {/* Simulated Body Lines */}
                    <div className="space-y-1 my-2 flex-grow">
                      <div className="w-full h-1 bg-subtitle-grey/10 rounded"></div>
                      <div className="w-full h-1 bg-subtitle-grey/10 rounded"></div>
                      <div className="w-4/5 h-1 bg-subtitle-grey/10 rounded"></div>
                      <div className="w-full h-4 bg-primary/5 rounded border-l-2 border-primary/40 pl-1 mt-2"></div>
                    </div>
                    
                    {/* Mock Tag/Footer */}
                    <div className="flex justify-between items-center mt-2 pt-1 border-t border-border-light/40">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse font-sans"></span>
                        <span className="text-[7px] text-subtitle-grey font-mono uppercase tracking-widest font-sans">YORA</span>
                      </div>
                      <span className="text-[7px] text-primary font-bold">PDF REPORT</span>
                    </div>
                    
                    {/* Hover Overlay Button */}
                    <div className="absolute inset-0 bg-charcoal/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="material-symbols-outlined text-white text-3xl">download</span>
                    </div>
                  </motion.div>
                </div>
              </div>

              <div className="h-px bg-border-light/60 my-6"></div>

              {/* Action Button */}
              <div className="flex justify-start">
                <motion.button
                  whileHover={isGeneratingPDF ? {} : { scale: 1.02, y: -1 }}
                  whileTap={isGeneratingPDF ? {} : { scale: 0.98 }}
                  onClick={handleExportPDF}
                  disabled={isGeneratingPDF}
                  className="bg-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 font-subhead-sm text-xs font-bold hover:bg-opacity-95 transition-all shadow-md shadow-primary/5 cursor-pointer uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isGeneratingPDF ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Compiling Report...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                      <span>Download Supplier Report</span>
                    </>
                  )}
                </motion.button>
              </div>
            </section>

            {/* Danger Zone Card */}
            <section className="bento-card p-stack-md rounded-xl border border-primary/20 bg-white shadow-sm">
              <h3 className="font-subhead-sm text-sm font-bold text-primary mb-stack-sm">Danger Zone | 危险区域</h3>
              <p className="text-xs text-subtitle-grey mb-stack-md leading-relaxed">Account deletion is permanent. Logout will end your session.</p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-6 py-2.5 bg-error/10 text-error rounded-xl text-xs font-bold hover:bg-error hover:text-white transition-all cursor-pointer border border-error/20 shadow-sm"
                >
                  Delete Account | 删除帐户
                </button>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="px-6 py-2.5 bg-charcoal text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-md"
                >
                  Logout | 登出
                </button>
              </div>
            </section>

            {/* Feedback Widget */}
            <FeedbackWidget />
          </div>

          {/* Right Column: Support & Legal */}
          <div className="col-span-12 lg:col-span-4 space-y-stack-md sticky top-24">
            {/* Help Card */}
            <div className="bento-card p-stack-md rounded-xl bg-gradient-to-br from-surface-container-lowest to-surface-muted overflow-hidden relative border border-border-light shadow-sm">
              <div className="relative z-10">
                <h3 className="font-subhead-sm text-sm font-semibold text-on-surface mb-2">Need help? | 需要帮忙吗?</h3>
                <p className="text-xs text-subtitle-grey mb-stack-md leading-relaxed">Our support team and Rui AI are here to assist with your negotiations.</p>
                <ul className="space-y-stack-sm mb-stack-md text-xs leading-loose">
                  <li>
                    <button onClick={() => setShowHelpModal(true)} className="text-primary flex items-center hover:underline cursor-pointer">
                      <span className="material-symbols-outlined text-[16px] mr-2">menu_book</span> Help Center | 帮助中心
                    </button>
                  </li>
                  <li>
                    <button onClick={handleFeedbackClick} className="text-primary flex items-center hover:underline cursor-pointer">
                      <span className="material-symbols-outlined text-[16px] mr-2">rate_review</span> Feedback | 反馈意见
                    </button>
                  </li>
                  <li>
                    <a href={`mailto:${adminEmail}`} className="text-primary flex items-center hover:underline cursor-pointer">
                      <span className="material-symbols-outlined text-[16px] mr-2">mail</span> Contact Support | 联系支持
                    </a>
                  </li>
                </ul>
              </div>
              <div className="absolute -bottom-4 -right-4 w-40 h-40 opacity-40 pointer-events-none">
                <img
                  alt="Rui Mascot"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain pointer-events-none animate-pulse-slow"
                  src={resolveStorageUrl("https://i.ibb.co.com/k6JG4qgm/RUI-ON-THE-PHONE-BUSINESS.png")}
                />
              </div>
            </div>

            {/* Instagram Social Card */}
            <div className="bento-card p-stack-md rounded-xl bg-surface-container-lowest border border-border-light shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="font-subhead-sm text-sm font-semibold text-on-surface mb-1.5 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[#E1306C]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                  Follow our Instagram | 关注我们
                </h3>
                <p className="text-[11px] text-subtitle-grey leading-relaxed">
                  Stay updated with live negotiation tactics, cultural masterclasses, and product development announcements!
                </p>
                <a 
                  href="https://www.instagram.com/yora.tech/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="mt-3 w-full py-2 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white text-center rounded-xl text-xs font-bold hover:opacity-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  @yora.tech on Instagram
                  <span className="material-symbols-outlined text-xs">launch</span>
                </a>
              </div>
            </div>

            {/* Legal Links */}
            <div className="px-2">
              <div className="flex gap-4 text-[11px] text-subtitle-grey">
                <button onClick={() => setLegalModal('privacy')} className="hover:text-primary transition-colors cursor-pointer outline-none">Privacy Policy</button>
                <button onClick={() => setLegalModal('terms')} className="hover:text-primary transition-colors cursor-pointer outline-none">Terms of Service</button>
                <button onClick={() => setLegalModal('cookies')} className="hover:text-primary transition-colors cursor-pointer outline-none">Cookie Policy</button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Overlays with AnimatePresence */}
      <AnimatePresence>
        {/* Logout Modal */}
        {showLogoutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" 
              onClick={() => setShowLogoutModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-white rounded-2xl p-8 max-w-sm w-full relative z-10 shadow-xl border border-border-light text-center"
            >
               <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-charcoal text-3xl">logout</span>
               </div>
               <h3 className="text-xl font-bold text-charcoal mb-2">Wait a second!</h3>
               <p className="text-sm text-subtitle-grey mb-8">Are you sure you want to log out of your YORA profile?</p>
               <div className="flex gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLogout}
                    className="flex-1 py-3 bg-charcoal text-white rounded-xl text-sm font-bold shadow-md hover:bg-on-surface transition-colors cursor-pointer"
                  >
                    Yes, Log Out
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 py-3 bg-surface-variant text-secondary rounded-xl text-sm font-bold hover:bg-surface-muted transition-colors cursor-pointer"
                  >
                    No, Stay
                  </motion.button>
               </div>
            </motion.div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-error/10 backdrop-blur-sm" 
              onClick={() => setShowDeleteModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-white rounded-2xl p-8 max-w-sm w-full relative z-10 shadow-xl border border-error/20 text-center"
            >
               <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-stack-md">
                  <span className="material-symbols-outlined text-error text-3xl">delete_forever</span>
               </div>
               <h3 className="text-xl font-bold text-error mb-2">Delete Account?</h3>
               <p className="text-xs text-subtitle-grey mb-stack-md">This action is irreversible. To confirm, please type your email address: <br/><span className="font-bold text-charcoal">{userData.email}</span></p>
               <input 
                 type="email" 
                 placeholder="Confirm email"
                 value={deleteEmailConfirm}
                 onChange={(e) => setDeleteEmailConfirm(e.target.value)}
                 className="w-full p-3 border border-border-light rounded-xl text-sm mb-6 focus:ring-1 focus:ring-error focus:border-error"
               />
               <div className="flex flex-col gap-3">
                  <motion.button 
                    whileHover={deleteEmailConfirm === userData.email ? { scale: 1.02 } : {}}
                    whileTap={deleteEmailConfirm === userData.email ? { scale: 0.98 } : {}}
                    disabled={deleteEmailConfirm !== userData.email}
                    onClick={() => onNavigate('login')}
                    className={`py-3 rounded-xl text-sm font-bold shadow-md transition-colors cursor-pointer ${deleteEmailConfirm === userData.email ? 'bg-error text-white' : 'bg-surface-variant text-subtitle-grey cursor-not-allowed'}`}
                  >
                    Permanently Delete
                  </motion.button>
                  <button 
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteEmailConfirm('');
                    }}
                    className="text-xs font-bold text-subtitle-grey hover:text-charcoal transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
               </div>
            </motion.div>
          </div>
        )}

        {/* Legal Modal */}
        {legalModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm" 
              onClick={() => setLegalModal(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl p-10 max-w-2xl w-full relative z-10 shadow-2xl border border-border-light max-h-[80vh] overflow-y-auto"
            >
               <div className="flex justify-between items-center mb-8 border-b border-border-light pb-4">
                  <h3 className="text-2xl font-bold capitalize">{legalModal.replace('_', ' ')}</h3>
                  <button onClick={() => setLegalModal(null)} className="material-symbols-outlined text-subtitle-grey hover:text-charcoal transition-colors cursor-pointer">close</button>
               </div>
               <div className="text-sm leading-relaxed text-charcoal space-y-4 font-body-rg">
                  <p className="font-bold">Last Updated: May 2026</p>
                  
                  {legalModal === 'privacy' && (
                    <>
                      <p>Your privacy is paramount. YORA synchronizes your <strong>Supplier Directory</strong> inputs, including pricing thresholds, target MOQs, and negotiation goals, to provide tailored AI advice through Rui.</p>
                      <h4 className="font-bold text-lg pt-4">Data Synchronization</h4>
                      <p>Every input you provide in the Supplier Wizard is stored securely and used to calibrate Rui's strategic suggestions. This ensures that your negotiation leverage and target price (CNY) are always in sync with the advice you receive.</p>
                      <h4 className="font-bold text-lg pt-4">AI Processing</h4>
                      <p>Negotiation transcripts are processed to calculate Guanxi Scores. We do not use your proprietary pricing data to train models for other users.</p>
                    </>
                  )}

                  {legalModal === 'terms' && (
                    <>
                      <p>By using YORA, you agree to provide accurate information in your Supplier Directory. The effectiveness of Rui's advice depends on the accuracy of your target prices and walk-away points.</p>
                      <h4 className="font-bold text-lg pt-4">Professional Use</h4>
                      <p>YORA is a tool for professional negotiators. While Rui provides world-class cultural and strategic advice, final business decisions remain the responsibility of the user.</p>
                    </>
                  )}

                  {legalModal === 'cookies' && (
                    <>
                      <p>We use cookies to maintain your session and ensure your <strong>AI Preferences</strong> (Tone, Depth, Language) are preserved across sessions.</p>
                      <h4 className="font-bold text-lg pt-4">Session Integrity</h4>
                      <p>Essential cookies allow us to keep your active negotiations and supplier profiles in sync as you navigate between the room and the dashboard.</p>
                    </>
                  )}

                  <p className="pt-8 text-subtitle-grey">For more information, please contact our legal team at {adminEmail}</p>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* AI Confirm Modal */}
        {showAIConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" 
              onClick={() => setShowAIConfirm(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-white rounded-2xl p-8 max-w-sm w-full relative z-10 shadow-xl border border-border-light text-center"
            >
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
                 transition={{ 
                   opacity: { duration: 0.35, ease: "easeOut" },
                   scale: { duration: 0.35, ease: "easeOut" },
                   y: { repeat: Infinity, duration: 4, ease: "easeInOut" }
                 }}
                 className="w-32 h-32 mx-auto mb-6 relative"
               >
                  <div className="absolute -inset-2 bg-[radial-gradient(circle,rgba(227,6,19,0.12)_0%,transparent_70%)] rounded-full blur-md z-0 pointer-events-none"></div>
                  <img
                    alt="Rui Mascot"
                    className="w-full h-full object-contain relative z-10"
                    src={resolveStorageUrl("https://i.ibb.co.com/NdDDxx89/RUI-ALERT-WARNING-BASICS.png")}
                  />
               </motion.div>
               <h3 className="text-xl font-bold text-charcoal mb-2">Change Preference?</h3>
               <p className="text-sm text-subtitle-grey mb-8 leading-relaxed">
                 You can only change your AI negotiation style and language <span className="text-primary font-bold">once every 3 days</span>. Are you sure you want to proceed with this update?
               </p>
               <div className="flex gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={confirmAIPrefUpdate}
                    className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-md hover:bg-opacity-95 transition-colors cursor-pointer"
                  >
                    Yes, Update
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAIConfirm(null)}
                    className="flex-1 py-3 bg-surface-variant text-secondary rounded-xl text-sm font-bold hover:bg-surface-muted transition-colors cursor-pointer"
                  >
                    Wait, Cancel
                  </motion.button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" 
              onClick={() => setShowHelpModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full relative z-10 shadow-2xl border border-border-light max-h-[85vh] flex flex-col font-body-rg"
            >
            <button 
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 text-subtitle-grey hover:text-charcoal transition-all p-1"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
            
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border-light">
              <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-xl">menu_book</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-charcoal">YORA Help Center | 帮助中心</h3>
                <p className="text-xs text-subtitle-grey">Guiding your supply chain negotiations & AI Copilot calibration</p>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1 scrollbar-thin">
              <div className="bg-surface p-4 rounded-xl border border-secondary/5">
                <h4 className="font-bold text-xs text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">rocket_launch</span>
                  Quick Start Guide / 快速入门指南
                </h4>
                <p className="text-xs text-secondary leading-relaxed mb-2">
                  YORA is designed to help you successfully bridge communication, pricing, and cultural gaps with Chinese manufacturers.
                </p>
                <ol className="list-decimal pl-4 text-xs text-subtitle-grey space-y-1">
                  <li>Define your target price and Maximum MOQ inside the <strong>Supplier Wizard</strong>.</li>
                  <li>Copy and paste your supplier's WeChat or Email responses into the <strong>Negotiation Room</strong>.</li>
                  <li>Rui will immediately analyze the message, update your <strong>Guanxi Score</strong>, and generate a strategic, culturally precise response drafted in perfect Chinese with bilingual translations.</li>
                </ol>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-xs text-charcoal uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">quiz</span>
                  Frequently Asked Questions (FAQ) / 常见问题解答
                </h4>
                
                <div className="space-y-2.5">
                  <details className="group border border-border-light rounded-xl bg-white p-3 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                      <span className="text-xs font-semibold text-charcoal pr-4">What is "Guanxi" and how do I improve my score? | 什么是“关系”，如何提升我的指数？</span>
                      <span className="material-symbols-outlined text-subtitle-grey group-open:rotate-180 transition-transform text-sm">expand_more</span>
                    </summary>
                    <div className="mt-2 text-xs text-subtitle-grey leading-relaxed border-t border-border-light pt-2">
                      <p className="mb-1"><strong>Guanxi (关系)</strong> refers to the deep interpersonal trust, reciprocity, and relationships driving Chinese business networks.</p>
                      <p>You can improve your score by maintaining professional respect, celebrating cooperative intent, inquiring thoughtfully about their logistics difficulties, and choosing Rui's "Balanced" or "Collaborative" tone settings.</p>
                    </div>
                  </details>

                  <details className="group border border-border-light rounded-xl bg-white p-3 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                      <span className="text-xs font-semibold text-charcoal pr-4">Why are target thresholds and MOQ walkaways crucial? | 为什么目标价格和起订量底线至关重要？</span>
                      <span className="material-symbols-outlined text-subtitle-grey group-open:rotate-180 transition-transform text-sm">expand_more</span>
                    </summary>
                    <div className="mt-2 text-xs text-subtitle-grey leading-relaxed border-t border-border-light pt-2">
                      <p>Rui dynamically calibrates every response snippet based on how closely the supplier's actual quotation aligns with your targets. Without these thresholds, strategic drafts will revert to generic templates instead of applying precise, high-leverage negotiation tactics.</p>
                    </div>
                  </details>

                  <details className="group border border-border-light rounded-xl bg-white p-3 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                      <span className="text-xs font-semibold text-charcoal pr-4">Can I change my AI Strategy Preferences? | 怎么修改我的 AI 谈判策略和语言？</span>
                      <span className="material-symbols-outlined text-subtitle-grey group-open:rotate-180 transition-transform text-sm">expand_more</span>
                    </summary>
                    <div className="mt-2 text-xs text-subtitle-grey leading-relaxed border-t border-border-light pt-2">
                      <p>Yes, you can configure your AI Tone (Competitive, Collaborative, Balanced) and interface language on this Settings screen. To maintain negotiation consistency, target changes are calibrated once every 3 days.</p>
                    </div>
                  </details>

                  <details className="group border border-border-light rounded-xl bg-white p-3 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between cursor-pointer focus:outline-none">
                      <span className="text-xs font-semibold text-charcoal pr-4">Is my proprietary data secure under YORA? | 我们的商业机密安全吗？</span>
                      <span className="material-symbols-outlined text-subtitle-grey group-open:rotate-180 transition-transform text-sm">expand_more</span>
                    </summary>
                    <div className="mt-2 text-xs text-subtitle-grey leading-relaxed border-t border-border-light pt-2">
                      <p>Absolutely. Your supplier directory thresholds, targeted MOQs, and copied conversation snippets are encrypted securely in your dedicated user context. We do not expose your target values to suppliers or other competitors.</p>
                    </div>
                  </details>
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl mt-0.5">contact_support</span>
                <div>
                  <h5 className="text-xs font-bold text-charcoal">Still stuck? Direct Assistance</h5>
                  <p className="text-[11px] text-subtitle-grey mb-2">Our global support and cultural translation specialists are ready to help.</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`mailto:${adminEmail}`}
                      className="px-3 py-1 bg-white border border-border-light rounded-md text-[10px] font-bold text-charcoal hover:bg-surface-muted transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">mail</span> Email Support
                    </a>
                    <button
                      onClick={() => {
                        setShowHelpModal(false);
                        handleFeedbackClick();
                      }}
                      className="px-3 py-1 bg-primary text-white rounded-md text-[10px] font-bold hover:bg-opacity-95 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">rate_review</span> Submit Feedback Form
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-border-light flex justify-end">
              <button 
                onClick={() => setShowHelpModal(false)}
                className="px-6 py-2 border border-border-light text-secondary rounded-xl text-xs font-bold hover:bg-surface-muted transition-all cursor-pointer shadow-sm"
              >
                Close Help Center | 关闭
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* No Suppliers Modal */}
      {showNoSuppliersModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" 
            onClick={() => setShowNoSuppliersModal(false)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl border border-border-light text-center"
          >
             <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-primary text-3xl">warning</span>
             </div>
             <h3 className="text-xl font-bold text-charcoal mb-2">Ecosystem Export Unavailable</h3>
             <h4 className="text-xs font-semibold text-subtitle-grey mb-6">数据导出不可用 — 尚未配置供应商</h4>
             
             <p className="text-xs text-secondary leading-relaxed mb-4">
               YORA's structured audit reports require matching manufacturer profile schemas and live negotiation transcripts. 
             </p>
             <p className="text-xs text-secondary leading-relaxed mb-8 font-medium">
               To generate a PDF report, you must first create and configure at least one active supplier in the system.
             </p>

             <div className="flex flex-col gap-3 flex-wrap">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowNoSuppliersModal(false);
                    onNavigate('wizard-step1');
                  }}
                  className="w-full bg-primary text-white font-sans font-bold py-4 rounded-xl hover:opacity-95 transition-all shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer font-bold"
                >
                  <span className="material-symbols-outlined text-base">person_add</span>
                  Configure Supplier Portfolio | 添加供应商
                </motion.button>
                <button 
                  onClick={() => setShowNoSuppliersModal(false)}
                  className="text-xs font-bold text-subtitle-grey hover:text-charcoal transition-colors cursor-pointer py-1"
                >
                  Dismiss | 忽略
                </button>
             </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    </div>
  );
}
export default SettingsScreen;
