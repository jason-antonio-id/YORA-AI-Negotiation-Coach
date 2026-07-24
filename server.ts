import express from "express";
import path from "path";
// NOTE: "vite" is intentionally NOT imported here at the top level.
// It's a dev-only tool (used below only when NODE_ENV !== "production"),
// and statically importing it here would drag it (and its rollup native
// binary dependency) into the production/Vercel serverless bundle, which
// crashes at runtime with a missing @rollup/rollup-linux-x64-gnu error.
// It's dynamically imported instead, only on the dev code path below.
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import crypto from "crypto";
import { appendSignup, appendSupplier, appendFeedback, updateSignupInSheets } from "./src/lib/sheets.js";

// Initialize Supabase client for server-side auth/db operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('[YORA Server] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Reusable Supabase Authentication check middleware
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Please sign in to use YORA. 未登录或会话过期。' });
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session. Please sign in again. 无效口令。' });
    }

    // Check if user is suspended in profiles table
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('is_suspended')
      .eq('id', user.id)
      .single();

    if (!profileErr && profile && profile.is_suspended === true) {
      return res.status(403).json({ error: 'Forbidden: Your account has been suspended. 您的账号已被停用。' });
    }

    (req as any).user = user;
    next();
  } catch (e: any) {
    return res.status(401).json({ error: 'Unauthorized: Invalid session. Please sign in again. 无效口令。' });
  }
}

// Helper to sanitize supplier input for the prompt generator to prevent prompt injection (Issue 12)
function sanitizeSupplierInput(str: any, maxLength = 100): string {
  if (typeof str !== 'string') return '';
  // Strip control sequences, html tags, and braces to prevent injection attacks (preserving '#' as valid in codes, and '[]' for range parameters)
  let cleaned = str.replace(/[<>{}\\^`~$]/g, '');
  return cleaned.substring(0, maxLength);
}

// --- Shared AI response parsing helpers (mirrors src/components/NegotiationRoomScreen.tsx) ---
// Kept in sync manually with the client-side copies used for local rendering.
function cleanMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*/g, "")
    .replace(/#/g, "")
    .replace(/^\s*-\s+/gm, "• ")
    .replace(/\\n/g, "\n");
}

function parseConversationalResponse(text: string): string {
  if (!text) return "";
  const match = text.match(/\[CONVERSATIONAL_RESPONSE\]\s*([\s\S]*?)(?=\[ANALYSIS\]|A\.\s*(?:TRANSLATION|Translation)|$)/i);
  if (match) return match[1].trim();

  if (!text.includes('[ANALYSIS]') && !text.includes('A. TRANSLATION') && !text.includes('A. Translation')) {
    return text.trim();
  }

  const markers = ['[ANALYSIS]', 'A. TRANSLATION', 'A. Translation', '### [ANALYSIS]', 'A.翻译'];
  let cleanest = text;
  for (const marker of markers) {
    const lowerMarker = marker.toLowerCase();
    const index = cleanest.toLowerCase().indexOf(lowerMarker);
    if (index !== -1) {
      cleanest = cleanest.substring(0, index);
    }
  }
  return cleanest.replace(/\[CONVERSATIONAL_RESPONSE\]/gi, '').trim();
}

interface ParsedAnalysis {
  translation: string;
  realMeaning: string;
  guanxiTone: string;
  copyReadyReply: string;
  nextMove: string;
}

function parseAnalysis(text: string): ParsedAnalysis {
  const sections: ParsedAnalysis = {
    translation: "N/A",
    realMeaning: "Awaiting new message...",
    guanxiTone: "Neutral",
    copyReadyReply: "N/A",
    nextMove: "Continue conversation.",
  };
  if (!text) return sections;

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
    for (let j = i + 1; j < positions.length; j++) {
      if (positions[j].index !== -1) {
        end = positions[j].index;
        break;
      }
    }
    const content = text.substring(start, end).trim();
    if (content) {
      (sections as any)[current.key] = cleanMarkdown(content);
    }
  }
  return sections;
}

function parseScoresFromText(text: string): { trust: number; leverage: number; urgency: number } | null {
  if (!text) return null;
  const match = text.match(/RELATIONSHIP_SCORES:\s*({[\s\S]*?})/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {}
  }
  return null;
}
// --- End shared AI response parsing helpers ---

// Extracted helper for Gemini API with retries to resolve duplication (Issue 4) with fully reachable loop structure (Issue 14)
async function callGeminiWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  // Kept at 2 attempts (was 3) to reduce worst-case total request duration and
  // lower the risk of hitting the hosting platform's serverless function timeout
  // (e.g. Vercel Hobby defaults to a short timeout unless maxDuration is raised).
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      // Identify typical transient / retryable client-side or server-side API errors
      const isRateLimit = err?.status === 429 || (err?.message && err.message.includes('429'));
      const isTransientError = err?.status === 503 || (err?.message && err.message.includes('503')) || err?.status === 504 || (err?.message && err.message.includes('504'));
      const isRetryable = isRateLimit || isTransientError;

      if (attempt < maxAttempts && isRetryable) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[${label}] Transient error encountered, retrying (${attempt}/${maxAttempts})...`);
        }
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`[${label}] Failed after ${maxAttempts} attempts`);
}

export async function buildApp() {
  const app = express();
  // Support dynamic process port config for deployment runtime containers (Issue 5)
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json({ limit: '200kb' }));

  // Global browser security hardening headers
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  // Simple in-memory rate limiter to prevent abuse of the Gemini API
  const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
  const LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute

  // Sweep job for rate limit map to prevent unbounded memory leak (Issue 6)
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap.entries()) {
      if (now - val.lastReset > LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }, LIMIT_WINDOW_MS);

  const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let ip = "unknown";
    const xff = req.headers["x-forwarded-for"];
    if (xff) {
      const xffStr = Array.isArray(xff) ? xff[xff.length - 1] : xff;
      const parts = xffStr.split(",").map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        // Use first IP = actual client, not the last proxy hop
        ip = parts[0];
      }
    } else {
      ip = req.socket.remoteAddress || "unknown";
    }

    const now = Date.now();
    const rateData = rateLimitMap.get(ip);

    if (!rateData || now - rateData.lastReset > LIMIT_WINDOW_MS) {
      rateLimitMap.set(ip, { count: 1, lastReset: now });
      return next();
    }

    if (rateData.count >= MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({
        error: "Too many requests. Please wait a moment before sending more messages. 休息一下，请稍后再试。"
      });
    }

    rateData.count += 1;
    next();
  };

  // Origin & Referrer protection to ensure endpoints are only accessed by our own frontends (Issue 3 & 7 & 9)
  const originSecurity = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = req.headers.origin;
    const host = req.headers.host;

    if (!origin) {
      return next();
    }

    // Set proper CORS headers for valid origins (Issue 7)
    const allowedHosts = ["localhost", "127.0.0.1", ".run.app"];
    
    let isAllowed = false;
    try {
      const originUrl = new URL(origin);
      isAllowed = allowedHosts.some(h => {
        if (h.startsWith(".")) {
          return originUrl.hostname.endsWith(h);
        }
        return originUrl.hostname === h || originUrl.host === h;
      });
      if (!isAllowed && host) {
        isAllowed = originUrl.host === host || originUrl.hostname === host;
      }
    } catch (e) {
      // In case origin is malformed or invalid URL
      isAllowed = false;
    }

    if (!isAllowed) {
      // Avoid leaking full or detailed backend information in logs unnecessarily (Issue 11)
      console.warn(`[Security Block]: Unauthorized access attempt.`);
      return res.status(403).json({ error: "Access denied. Unauthorized origin. 禁止访问。" });
    }

    // Explicitly set CORS headers for permitted origins to allow safe preflight requests (Issue 7)
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  };

  // Apply security middlewares globally to api routes
  app.options("/api/*", originSecurity); // Handle preflight before rate limiter
  app.use("/api/", rateLimiter, originSecurity);

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const RUI_SYSTEM_PROMPT = `You are Rui (睿), a world-class strategic negotiator, expert trade consultant, and cultural intelligence AI advising INDONESIAN IMPORTERS who are sourcing goods from Chinese manufacturers. 

Your goal is to fiercely protect the buyer's financial interests, margins, and supply safety, while seamlessly navigating the psychological and cultural nuances of Chinese business (Guanxi, Mianzi).

CRITICAL ROLE CLARITY: 
- You are HELPING THE BUYER (the user), acting as their secret chief strategist.
- Provide clever, high-leverage negotiation tactics instead of passive or generic responses.
- The user will paste messages they received from Chinese suppliers.
- You must ANALYZE those supplier messages and SUGGEST a highly strategic reply for the BUYER to send back to the supplier.

THE BUYER & TRADE SETUP:
The buyer operates in Indonesia, pays in IDR (Indonesian Rupiah), and transfers payment to China via TT (Telegraphic Transfer) in CNY or USD depending on the supplier.

CURRENCY RULE:
Chinese suppliers quote in CNY (¥). Always remind the buyer of the IDR equivalent when discussing prices, so they can make informed decisions. Use approximately 2,100–2,400 IDR per CNY as a rough estimate. Always remind the buyer to verify the live exchange rate on Google or their bank before committing to any price. Flag total landed cost implications including: CNY/IDR exchange rate, shipping (FOB/CIF), Indonesian import duty (Bea Cukai), PPh 22 (2.5% import tax), and PPN (11% VAT).

WALK-AWAY RULE:
If the supplier's price exceeds the buyer's walk-away exit price limit, you must explicitly flag this as a critical RED LINE, advising caution, and suggest an elegant, polite exit strategy or hard stand rather than making arbitrary concessions.

DEAL PARAMETERS TO ALWAYS REFERENCE:
- MOQ: If the supplier's MOQ exceeds the buyer's targetMOQ, deploy the "Trial Order" strategy immediately.
- Incoterms: Factor in shipping responsibility (FOB, CIF, EXW) when analyzing total landed costs or risk parameters.
- Payment Target: Always guide negotiations toward the buyer's preferred payment target or deposit structure.

METRICS DEFINITIONS:
- trust (0-100): How reliable and relationship-invested is this supplier? 0 = total stranger/hostile, 100 = deep Guanxi ally.
- leverage (0-100): How much bargaining power does the buyer currently hold? 0 = supplier holds all cards, 100 = buyer in full control.
- urgency (0-100): How time-pressured is this deal? 0 = no deadline, 100 = must close today.
* Note: Metrics scores under [METRICS] must change and evolve dynamically across messages based on dialogue milestones and concessions.

ADVANCED NEGOTIATION STRATEGIES YOU MUST EMPLOY:
1. **The "Trial Order" Strategy**: When suppliers demand a high MOQ (e.g. 5,000) for a target price, NEVER accept it outright. Instead, tell the supplier to accept a smaller trial quantity (e.g. 2,500) as a "technical evaluation" or "market-entry test" to justify future larger orders.
2. **The "Mianzi / Secret Favor" Reply**: If the sales rep offers a "secret discount" or a special price "just for you" and says "don't tell outsiders," welcome it enthusiastically to build deep Guanxi ("Thank you for your trust... I will keep this strictly confidential"). Use this goodwill as leverage to reduce the MOQ.
3. **The "Internal Target Alignment" Excuse (Indonesian Specific)**: When crafting internal justification tactics, use real Indonesian business/regulatory references to blame external factors beyond your control rather than presenting arbitrary negative refusals:
   - "Bea Cukai (Indonesian Customs) requires a pre-shipment inspection certificate for this product category if we do a high-volume import straight away, so we must start with a small test shipment."
   - "Our company's NPWP tax registration audit requires verified payment and itemized receipt documentation before we can release large deposits."
   - "Bank Indonesia's foreign payment remittance and cross-border transfer policies require we split the payment or limit the initial wire amount."
   - "Our local Indonesian distributor's contract dictates a strict landed cost ceiling, so we cannot exceed the target rate without losing our contract."
4. **The "Future Scale Bait"**: Promise progressive scaling ("Once the trial batch passes inspection/customs, our secondary orders will comfortably reach your 5,000 unit MOQ standard").
5. **Aesthetic Tone Integration**: Combine utmost polite business-etiquette (showing respect/Mianzi) with rock-hard demands on delivery parameters, price thresholds, and walk-away rules.

STRICT OUT-OF-TOPIC GUARDRAIL:
- You are strictly limited to discussing professional procurement, business negotiations, China-Indonesia cross-border trade, negotiation tactics, Chinese business culture (Guanxi, Mianzi), product sourcing, shipping, logistics, customs (Bea Cukai), currency exchange (CNY/IDR), and supplier interactions.
- If the user's latest query is off-topic (e.g. asking you to write software code, solve general math/science/academic problems, discuss unrelated movies, recipes, general travel, sports, gaming, or any other topic completely unrelated to business negotiations and sourcing with Chinese manufacturers), you MUST politely refuse to answer.
- Your refusal must be polite and friendly but firm, written in the buyer's requested language. For example: "I am sorry, but that topic is outside our business negotiation context. As your strategic sourcing advisor, I can only assist you with topics related to negotiations, supplier communication, sourcing strategy, and China-Indonesia cross-border trade. Let's get back to working on your deal with the supplier!" (or equivalent).

OUTPUT FORMAT (MANDATORY):
EVERY response MUST contain these parts if you are analyzing a message. Each section MUST be clearly labeled as shown below.

[CONVERSATIONAL_RESPONSE]
(Provide an extremely clever, supportive 1-2 sentence response directly to the user as their loyal strategist. Highlight the key tactic you are about to play. Speak like a mentor who understands the stress of cross-border trade. Sign off as Rui 睿.)

[ANALYSIS]
A. TRANSLATION: (Provide a COMPLETE and FULL translation of the supplier's message into the buyer's chosen response language. Do not summarize; translate word-for-word if possible.)
B. REAL MEANING: (Identify hidden agendas, traps, or psychological tactics in the supplier's message — e.g., the MOQ bait, fake scarcity, artificial urgency, or personal appeal to obligation.)
C. GUANXI & TONE: (Assessment of the relationship state and the supplier's demeanor.)
D. SUGGESTED REPLY: (A brilliantly crafted reply for the BUYER to send to THE SUPPLIER. In SIMPLIFIED CHINESE first, then translated into the buyer's response language as specified in your instructions. The Simplified Chinese reply must be natural WeChat style — short, friendly but firm messaging rather than a stiff formal postal letter).
E. NEXT MOVE: (Clear, actionable strategy on what to do if they reject, wait, or propose counter-terms.)

[METRICS]
RELATIONSHIP_SCORES: {"trust": 0-100, "leverage": 0-100, "urgency": 0-100}

IMPORTANT: Do not use excessive markdown (like bolding or headers) within the analysis sections, as it will be cleaned. Focus on the raw strategic content. Keep responses highly actionable, sharp, and brilliantly calculated. ALWAYS PROVIDE FULL DRAFTS.`;

  // API Routes
  // Admin management routes
  app.get("/api/admin/users", async (req, res) => {
    // Verify the caller is an authenticated admin
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }

      const adminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '';
      if (!adminEmail) {
        console.error('[Admin API] ADMIN_EMAIL is not set in environment variables. Admin access will be denied.');
        return res.status(500).json({ error: 'Server misconfiguration: admin email not configured.' });
      }
      if (user.email !== adminEmail) {
        return res.status(403).json({ error: 'Forbidden: Not an admin account' });
      }

      // Fetch all profiles from Supabase profiles table
      const { data: profilesDb } = await supabase
        .from('profiles')
        .select('*');

      // Fetch all suppliers from Supabase suppliers table
      const { data: suppliersDb } = await supabase
        .from('suppliers')
        .select('*');

      // Fetch all auth users via service-role admin listing
      let authUsers: any[] = [];
      try {
        const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
        if (!listErr && listData) {
          authUsers = listData.users || [];
        }
      } catch (e) {
        console.warn("[Admin API] Failed to fetch auth users list via Supabase Admin API. Falling back.", e);
      }

      const users = authUsers.map((u: any) => ({
        uid: u.id,
        email: u.email,
        displayName: u.user_metadata?.full_name || u.user_metadata?.name || '',
        emailVerified: !!u.email_confirmed_at,
        disabled: !!u.banned_until,
        metadata: {
          creationTime: u.created_at,
          lastSignInTime: u.last_sign_in_at
        },
        providerData: u.app_metadata?.provider ? [{ providerId: u.app_metadata.provider === 'google' ? 'google.com' : 'password' }] : []
      }));

      const profiles = (profilesDb || []).map((p: any) => ({
        uid: p.id,
        fullName: p.full_name,
        email: p.email,
        businessName: p.business_name,
        businessType: p.business_type,
        province: p.province,
        originCity: p.origin_city,
        aiLang: p.ai_lang,
        aiStyle: p.ai_style,
        aiTone: p.ai_tone,
        aiDepth: p.ai_depth,
        notificationsEnabled: p.notifications_enabled,
        emailDigestEnabled: p.email_digest_enabled,
        emailVerified: p.email_verified,
        isSuspended: p.is_suspended,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      const suppliers = (suppliersDb || []).map((s: any) => ({
        id: s.id,
        userId: s.owner_id,
        chineseName: s.chinese_name,
        englishName: s.english_name,
        wechatId: s.wechat_id,
        url: s.url,
        province: s.province,
        city: s.city,
        discoverySource: s.discovery_source,
        cooperationHistory: s.cooperation_history,
        status: s.status,
        productName: s.product_name,
        productChineseName: s.product_chinese_name,
        category: s.category,
        specs: s.specs,
        targetPrice: s.target_price,
        currentPrice: s.current_price,
        walkAwayPrice: s.walk_away_price,
        moq: s.moq,
        targetMOQ: s.target_moq,
        incoterms: s.incoterms,
        negotiationGoal: s.negotiation_goal,
        paymentTarget: s.payment_target,
        urgencyLevel: s.urgency_level,
        notes: s.notes,
      }));

      res.json({
        users,
        profiles,
        suppliers
      });
    } catch (err: any) {
      console.error("[Admin API] Unexpected error listing users:", err);
      res.status(500).json({ error: "Failed to list users" });
    }
  });


  // API Route: Log completed onboarding profile to Google Sheets.
  // Called once, at the end of RegisterStep3 (handleFinalize), after the
  // full profile (name, business info, AI preferences) has been collected
  // and written to Firestore — not at OTP time, since most fields aren't
  // filled in yet at that point.
  app.post("/api/log-signup", async (req, res) => {
    const {
      email, fullName, businessName, businessType,
      originCity, province, instagram, aiLang, aiStyle, aiTone, aiDepth
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    try {
      await appendSignup({
        email: String(email).trim().toLowerCase(),
        fullName: fullName || '',
        businessName: businessName || '',
        businessType: businessType || '',
        originCity: originCity || '',
        province: province || '',
        instagram: instagram || '',
        aiLang: aiLang || '',
        aiStyle: aiStyle || '',
        aiTone: aiTone || '',
        aiDepth: aiDepth || '',
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("Failed inside /api/log-signup route:", err);
      return res.status(500).json({ error: "Failed to log signup." });
    }
  });

  app.post("/api/update-profile-sheets", async (req, res) => {
    const { email, fullName, instagram } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    try {
      const cleanEmail = String(email).trim().toLowerCase();
      const name = String(fullName || '').trim();
      const insta = String(instagram || '').trim();

      // Check if updating in Google Sheets is successful
      const updated = await updateSignupInSheets(cleanEmail, name, insta);

      // If they were NOT found in the sheets, let's create a full row for them by pulling their latest data from Supabase!
      if (!updated) {
        console.log(`User ${cleanEmail} not in Google Sheets. Querying Supabase profiles to write a complete row...`);
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (!profileErr && profile) {
          await appendSignup({
            email: cleanEmail,
            fullName: name || profile.full_name || '',
            businessName: profile.business_name || '',
            businessType: profile.business_type || '',
            originCity: profile.origin_city || '',
            province: profile.province || '',
            instagram: insta || profile.instagram || '',
            aiLang: profile.ai_lang || '',
            aiStyle: profile.ai_style || '',
            aiTone: profile.ai_tone || '',
            aiDepth: profile.ai_depth || '',
          });
        } else {
          // Fallback if no profile exists yet
          await appendSignup({
            email: cleanEmail,
            fullName: name,
            businessName: '',
            businessType: '',
            originCity: '',
            province: '',
            instagram: insta,
            aiLang: '',
            aiStyle: '',
            aiTone: '',
            aiDepth: '',
          });
        }
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("Failed inside /api/update-profile-sheets route:", err);
      return res.status(500).json({ error: "Failed to update profile in Google Sheets." });
    }
  });

  app.post("/api/log-supplier", async (req, res) => {
    const { userEmail, ...supplierFields } = req.body;
    if (!userEmail) {
      return res.status(400).json({ error: "userEmail is required." });
    }

    try {
      const s = supplierFields || {};
      await appendSupplier({
        userEmail: String(userEmail).trim().toLowerCase(),
        id: s.id || '',
        chineseName: s.chineseName || '',
        englishName: s.englishName || '',
        wechatId: s.wechatId || '',
        url: s.url || '',
        province: s.province || '',
        city: s.city || '',
        discoverySource: s.discoverySource || '',
        cooperationHistory: s.cooperationHistory || '',
        status: s.status || '',
        productName: s.productName || '',
        productChineseName: s.productChineseName || '',
        category: s.category || '',
        specs: s.specs || '',
        targetPrice: s.targetPrice || '',
        currentPrice: s.currentPrice || '',
        walkAwayPrice: s.walkAwayPrice || '',
        moq: s.moq || '',
        targetMOQ: s.targetMOQ || '',
        incoterms: s.incoterms || '',
        negotiationGoal: s.negotiationGoal || '',
        paymentTarget: s.paymentTarget || '',
        urgencyLevel: s.urgencyLevel || '',
        notes: s.notes || '',
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("Failed inside /api/log-supplier route:", err);
      return res.status(500).json({ error: "Failed to log supplier." });
    }
  });

  app.post("/api/feedback", async (req, res) => {
    try {
      const { email, rating, comment } = req.body;

      const ratingNum = Number(rating);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: "Rating must be a number between 1 and 5." });
      }

      // FIRE-AND-FORGET: never let a Sheets write hang the response.
      appendFeedback(email || "", ratingNum, comment || "")
        .catch((e: any) => console.error("Failed to append feedback to Sheets:", e));

      return res.json({ success: true });
    } catch (error) {
      console.error("Feedback handling error:", error);
      return res.json({ success: true }); // Always respond gracefully — feedback is non-critical
    }
  });


  app.post("/api/chat", requireAuth, async (req, res) => {
    try {
      const { messages, context, aiTone, aiDepth, aiLang, mode, supplierId } = req.body;

      // supplierId is required so the server can persist the AI reply and updated
      // scores itself, independent of whether the client is still on this screen
      // by the time Gemini responds (fixes "analysis disappears when I switch tabs").
      if (!supplierId || typeof supplierId !== 'string') {
        return res.status(400).json({ error: "Missing supplierId." });
      }
      
      // Strict payload validation (Issue 2)
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Invalid messages payload." });
      }
      
      if (context && typeof context === 'string' && context.length > 2000) {
        return res.status(400).json({ error: "Context input length is too long." });
      }

      // 'chat' is the default mode when no mode is supplied (e.g. general conversational questions) (Issue 15)
      const cleanMode = typeof mode === 'string' ? mode : 'chat';
      if (cleanMode !== 'simulate' && cleanMode !== 'chat') {
        return res.status(400).json({ error: "Invalid mode parameter. Only 'chat' and 'simulate' are supported. 模式无效。" });
      }

      const sanitizedContext = context ? sanitizeSupplierInput(context, 1900) : 'None';
      const cleanAiTone = typeof aiTone === 'string' ? aiTone.substring(0, 50).replace(/[^\w\s-]/g, '') : 'formal';
      const cleanAiDepth = typeof aiDepth === 'string' ? aiDepth.substring(0, 50).replace(/[^\w\s-]/g, '') : 'cultural';
      const cleanAiLang = typeof aiLang === 'string' ? aiLang.substring(0, 50).replace(/[^\w\s-]/g, ' ') : 'Bahasa Indonesia';

      if (process.env.NODE_ENV !== "production") {
        console.log("[API CHAT] Incoming request messages count:", messages.length, "mode:", cleanMode, "lang:", cleanAiLang);
      }
      
      // Trim messages list to prevent unbounded growth / tokens bloat in chat
      const MAX_HISTORY = 20;
      const trimmedMessages = messages.slice(-MAX_HISTORY);

      const contents: any[] = [];
      for (const m of trimmedMessages) {
        if (!m || typeof m !== "object" || !m.content) continue;
        // Filter out system messages so they are never classified/passed as assistant turns to Gemini (Issue 4/Types)
        if (m.sender === 'system' || m.role === 'system') continue;

        const role = (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user';
        
        // Sanitize chat messages slightly to prevent raw payload issues
        const cleanContent = typeof m.content === "string" ? m.content.substring(0, 4000) : "";
        
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += "\n" + cleanContent;
        } else {
          contents.push({
            role: role,
            parts: [{ text: cleanContent }]
          });
        }
      }

      if (contents.length === 0) {
        return res.status(400).json({ error: "No valid message contents found." });
      }

      const preferenceHint = `ADAPT YOUR STRATEGY:
- Tone of Voice: Use a ${cleanAiTone} style.
- Cultural Depth: Provide ${cleanAiDepth} insights.
- Response Language: Respond to the buyer in ${cleanAiLang}.
  D. SUGGESTED REPLY must always be Simplified Chinese first, then translated into ${cleanAiLang}.`;

      let modeInstruction = "";
      if (cleanMode === 'simulate') {
        modeInstruction = `
CRITICAL CORE INSTRUCTION: You are analyzing a newly received message from the supplier. You MUST format your response with the following structured segments:

[CONVERSATIONAL_RESPONSE]
(1-2 supportive strategic mentor sentences directly talking to the buyer. Sign off as Rui 睿.)

[ANALYSIS]
A. TRANSLATION: (Provide the full, detailed translation of the supplier's message into the buyer's chosen response language.)
B. REAL MEANING: (Identify hidden implications, cultural background, real intentions.)
C. GUANXI & TONE: (Evaluate trust and relationship health.)
D. SUGGESTED REPLY: (Professionally crafted reply in Simplified Chinese first, then translated into ${cleanAiLang}.)
E. NEXT MOVE: (Actionable advice / strategy.)

[METRICS]
RELATIONSHIP_SCORES: {"trust": X, "leverage": Y, "urgency": Z}
`;
      } else {
        modeInstruction = `
CRITICAL CORE INSTRUCTION: The user is talking directly to you (Rui, their personal expert advisor/mentor) in the chat section. They are asking strategic follow-ups, general advice, clarifications, or general supplier relationship relationship questions like "what should I do now?" or "how should I ask for payment discount?".
Because of this, there is no raw supplier message to parse right now.
- Do NOT output any structured [ANALYSIS] or [METRICS] blocks.
- Do NOT output RELATIONSHIP_SCORES under any circumstances.
- Do NOT use raw Markdown markers like asterisks (**) or hashes (###) in your response, they represent ugliness in our design. Always structure your responses as clean, plain sentences and conversational paragraphs.
- Respond in a highly informative, warm, mentor-like conversational prose. Write like an expert teacher guiding a junior negotiator. Give clear, direct advice on what general steps they can take (for example, saying "right now you can copy and paste their latest WeChat reply in the Simulate panel on the left so I can run a deep analysis...").
`;
      }

      const systemInstruction = `${RUI_SYSTEM_PROMPT}\n\n${modeInstruction}\n\n${preferenceHint}\n\nContext for this specific supplier: ${sanitizedContext}`;

      // Call the helper function with valid model "gemini-2.0-flash" (Issue 1, Issue 4, and official model guidelines)
      const response = await callGeminiWithRetry(
        () => ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
          },
        }),
        "API CHAT"
      );

      const responseText = response.text || "";

      // Persist the AI reply (and, if present, updated relationship scores/analysis)
      // server-side, right here, BEFORE responding. This guarantees it's saved as long
      // as this request completes, regardless of whether the user has since navigated
      // away from the Negotiation Room tab. The existing Supabase Realtime subscription
      // in NegotiationRoomScreen.tsx (on public.chat_messages) picks up this insert
      // automatically whenever that screen is mounted, and a fresh mount re-fetches
      // full history on load either way.
      try {
        // Ownership check: confirm this supplier actually belongs to the authenticated
        // user before writing anything (service role client bypasses RLS, so this must
        // be enforced manually here).
        const { data: ownedSupplier, error: ownerCheckErr } = await supabase
          .from('suppliers')
          .select('id, guanxi_score')
          .eq('id', supplierId)
          .eq('owner_id', (req as any).user.id)
          .single();

        if (ownerCheckErr || !ownedSupplier) {
          console.error("[API CHAT] Persist skipped: supplier not found or not owned by user.", ownerCheckErr?.message);
        } else {
          const aiConversationalText = parseConversationalResponse(responseText);
          const hasAnalysisText = responseText.toLowerCase().includes('translation') ||
            responseText.toLowerCase().includes('real meaning') ||
            responseText.toLowerCase().includes('suggested reply');
          const parsedAnalysis = hasAnalysisText ? parseAnalysis(responseText) : null;
          const parsedScores = hasAnalysisText ? parseScoresFromText(responseText) : null;

          const { error: insertErr } = await supabase
            .from('chat_messages')
            .insert({
              supplier_id: supplierId,
              sender: 'ai',
              sender_name: 'Rui',
              text: aiConversationalText || responseText,
              created_at: new Date().toISOString(),
              translation: responseText
            });
          if (insertErr) {
            console.error("[API CHAT] Failed to persist AI message:", insertErr.message);
          }

          if (parsedScores) {
            const calculatedGuanxi = Math.round(
              (parsedScores.trust + parsedScores.leverage + (100 - parsedScores.urgency)) / 3
            );
            const { error: updateErr } = await supabase
              .from('suppliers')
              .update({
                scores: parsedScores,
                latest_analysis: parsedAnalysis,
                guanxi_score: calculatedGuanxi,
                guanxi_trend: calculatedGuanxi - (ownedSupplier.guanxi_score || 50),
                last_contact_text: aiConversationalText || responseText
              })
              .eq('id', supplierId);
            if (updateErr) {
              console.error("[API CHAT] Failed to update supplier scores:", updateErr.message);
            }
          }
        }
      } catch (persistErr: any) {
        // Never fail the whole request just because persistence had an issue -
        // still return the AI text so the client can show/save it as a fallback.
        console.error("[API CHAT] Unexpected persistence error:", persistErr?.message);
      }

      res.json({ text: responseText });
    }
    catch (error: any) {
      // Clean, non-leaking logs in production (Issue 11)
      if (process.env.NODE_ENV !== "production") {
        console.error("[API CHAT] Error encountered:", error?.message, error?.stack);
      } else {
        console.error("[API CHAT] Error encountered:", error?.message || "Internal Service Error");
      }
      
      // Handle Quota/Rate limits specifically
      if (error?.status === 429 || (error?.message && error.message.includes('429'))) {
        return res.status(429).json({ 
          error: "I've hit my message limit for a moment. Please wait about 30-60 seconds and then try sending your message again. 休息一下，请稍后再试。" 
        });
      }
      
      const errorMsg = process.env.NODE_ENV === "production"
        ? "I'm having trouble connecting to AI. Please try again in a few moments. | 无法连接到AI服务。"
        : `I'm having trouble connecting to AI (Error: ${error?.message || 'Unknown'}). Please try again. | 无法连接到AI service。`;
      res.status(500).json({ error: errorMsg });
    }
  });

  app.post("/api/generate-memo", requireAuth, async (req, res) => {
    try {
      const { supplier, aiLang } = req.body;
      if (!supplier || typeof supplier !== "object") {
        return res.status(400).json({ error: "Missing or invalid supplier object. 没有有效的供应商参数。" });
      }

      // Sanitize fields carefully to prevent prompt injection and issues (Issue 12)
      const cleanEnglishName = sanitizeSupplierInput(supplier.englishName, 80) || "Unnamed Supplier";
      const cleanChineseName = sanitizeSupplierInput(supplier.chineseName, 80) || "未命名";
      const cleanCity = sanitizeSupplierInput(supplier.city, 80) || "unknown";
      const cleanProvince = sanitizeSupplierInput(supplier.province, 80) || "China";
      const cleanCoopHistory = sanitizeSupplierInput(supplier.cooperationHistory, 100) || "None";
      const cleanGoal = sanitizeSupplierInput(supplier.negotiationGoal, 100) || "Not set";
      const cleanUrgency = sanitizeSupplierInput(supplier.urgencyLevel, 50) || "Standard";
      const cleanCurrentPrice = sanitizeSupplierInput(supplier.currentPrice, 30) || "N/A";
      const cleanTargetPrice = sanitizeSupplierInput(supplier.targetPrice, 30) || "N/A";
      const cleanWalkAwayPrice = sanitizeSupplierInput(supplier.walkAwayPrice, 30) || "N/A";
      const cleanAiLang = typeof aiLang === 'string' ? aiLang.substring(0, 50).replace(/[^\w\s-]/g, ' ') : 'Bahasa Indonesia';

      // Array sanitization
      let cleanCoreProducts = "Various";
      if (Array.isArray(supplier.coreProducts)) {
        cleanCoreProducts = supplier.coreProducts
          .map((p: any) => sanitizeSupplierInput(p, 50))
          .filter(Boolean)
          .join(', ') || "Various";
      }

      // Number validation and clamp
      const rawGuanxi = parseInt(supplier.guanxiScore, 10);
      const cleanGuanxiScore = (!isNaN(rawGuanxi) && rawGuanxi >= 0 && rawGuanxi <= 100) ? rawGuanxi : 50;

      if (process.env.NODE_ENV !== "production") {
        console.log(`[API MEMO] Generating real-time memo for supplier: ${cleanEnglishName} in ${cleanAiLang}`);
      }

      const prompt = `You are Rui, a highly-skilled Chinese trade and cultural strategist. Generate an extremely polished, customized 3-4 sentence "Strategic Relationship Memo" for the following supplier:
English Name: ${cleanEnglishName}
Chinese Name: ${cleanChineseName}
Location: ${cleanCity}, ${cleanProvince}
Cooperation History: ${cleanCoopHistory}
Core Products: ${cleanCoreProducts}
Current Guanxi Score: ${cleanGuanxiScore}/100
Negotiation Goal: ${cleanGoal}
Urgency Level: ${cleanUrgency}
Current Price: ${cleanCurrentPrice}
Target Price: ${cleanTargetPrice}
Walk-Away Price Limit: ${cleanWalkAwayPrice}

Write the memo in ${cleanAiLang}.

Provide strategic, razor-sharp advice on:
1. Interpersonal rapport based on their score.
2. Pricing leverage based on current vs target prices.
3. Culturally smart tactics for WeChat messaging.
4. Walk-Away Price Alert: If the current price (${cleanCurrentPrice}) is close to or exceeds the Walk-Away limit (${cleanWalkAwayPrice}), advise extreme caution and outline a strategic fallback or walking boundary.

Do NOT include headings or labels. Write it as a single, beautifully cohesive and polished conversational paragraph directly advising the buyer. Speak with high professionalism and authority from Rui. Ensure the analysis is specific to this supplier profile.`;

      // Helper function call guarantees response returns a non-undefined result (Issue 8) and uses safe "gemini-2.0-flash" (Issue 1)
      const response = await callGeminiWithRetry(
        () => ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
        }),
        "API MEMO"
      );

      const text = response.text || "";
      res.json({ memo: text.trim().replace(/^["']|["']$/g, "") });
    } catch (error: any) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[API MEMO] Error:", error?.message, error?.stack);
      } else {
        console.error("[API MEMO] Error:", error?.message || "Internal error generated");
      }
      const errorMsg = process.env.NODE_ENV === "production"
        ? "AI Relationship Memo Generation failed. Please try again in a few moments."
        : `AI Relationship Memo Generation failed: ${error?.message || 'Unknown'}`;
      res.status(500).json({ error: errorMsg });
    }
  });

  // Image proxy route to bypass client-side CORS limitations during PDF generation
  app.get("/api/proxy-image", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("Missing url parameter");
    }
    try {
      // Derive Supabase Storage URL dynamically
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const projectRef = supabaseUrl.split('.supabase.co')[0].split('https://')[1] || '';
      const supabaseStorageUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/`;

      const isAllowedDomain = targetUrl.startsWith(supabaseStorageUrl) ||
                              targetUrl.startsWith("https://i.ibb.co.com/") ||
                              targetUrl.startsWith("https://i.ibb.co/");
      if (!isAllowedDomain) {
        return res.status(400).send("Invalid url domain");
      }
      // Fetch dynamic content without browser CORS restriction
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch remote image: ${response.statusText}`);
      }
      const contentType = response.headers.get("content-type") || "image/png";
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.send(buffer);
    } catch (err: any) {
      console.error("[Proxy Image Error]:", err?.name || "FetchError", err?.message);
      return res.status(500).send("Failed to proxy image");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return { app, PORT };
}

// Traditional persistent-server entry point (local dev, Render, Koyeb, etc).
// NOT used on Vercel - Vercel invokes the app directly per-request via
// api/index.ts, since serverless functions can't call app.listen().
async function startServer() {
  const { app, PORT } = await buildApp();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// process.env.VERCEL is set automatically by Vercel's build/runtime environment.
// Only self-start a listening server when we're NOT on Vercel.
if (!process.env.VERCEL) {
  startServer();
}
