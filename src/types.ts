export type ScreenType =
  | 'login'
  | 'register-step1'
  | 'register-step2'
  | 'register-step3'
  | 'google-onboarding-step1'
  | 'google-onboarding-step2'
  | 'onboarding-completed'
  | 'forgot-password'
  | 'verify-email'
  | 'dashboard-empty'
  | 'dashboard-active'
  | 'supplier-list'
  | 'wizard-step1'
  | 'wizard-step2'
  | 'wizard-step3'
  | 'supplier-added'
  | 'negotiation-room'
  | 'guanxi-meter'
  | 'message-history'
  | 'phrase-library'
  | 'cultural-guide'
  | 'supplier-profile'
  | 'settings'
  | 'admin-users'
  | 'not-found';

export interface Analysis {
  translation: string;
  realMeaning: string;
  guanxiTone: string;
  copyReadyReply: string;
  nextMove: string;
}

export interface Supplier {
  id: string;
  createdAt?: string;
  chineseName: string;
  englishName: string;
  wechatId: string;
  url: string;
  province: string;
  city: string;
  discoverySource: string;
  cooperationHistory: string;
  logoUrl?: string;
  status: 'Active' | 'Pending' | 'High Priority' | 'At Risk';
  coreProducts: string[];
  guanxiScore: number;
  guanxiTrend?: number; // Percent change trend tracked dynamically in metric reports
  lastContactText: string;
  targetPrice?: string;
  walkAwayPrice?: string;
  currentPrice?: string;
  moq?: string;
  productName?: string;
  productChineseName?: string;
  specs?: string;
  category?: string;
  targetMOQ?: string;
  incoterms?: string;
  negotiationGoal?: string;
  paymentTarget?: string;
  urgencyLevel?: string;
  notes?: string;
  /**
   * Client-side only representation of messages subcollection for local initialization & routing.
   * WARNING: Do not sync / write back this nested array block directly to the parent Supplier field in Firestore!
   * Message logs must always be persisted as a subcollection under "/users/{userId}/suppliers/{supId}/messages".
   */
  messages?: ChatMessage[];
  latestAnalysis?: Analysis;
  dealsCount?: number;
  scores?: {
    trust: number;
    leverage: number;
    urgency: number;
  };
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  businessName?: string;
  businessType?: string;
  province?: string;
  originCity?: string;
  aiLang?: string;
  aiStyle?: string;
  aiTone?: string;
  aiDepth?: string;
  notificationsEnabled?: boolean;
  emailDigestEnabled?: boolean;
  isLoggedIn?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastSettingsUpdate?: string;
  onboardingStatus?: 'incomplete' | 'completed' | 'partial';
  emailVerified?: boolean;
  isSuspended?: boolean;
  instagram?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user' | 'supplier' | 'system';
  role?: 'assistant' | 'user'; // For API
  senderName?: string;
  text: string;
  timeText: string;
  translation?: string;
  analysis?: string; // Rui's structured analysis
  createdAt?: any;
  audioUrl?: string;
  isRedFlag?: boolean;
  isPriceMove?: boolean;
  isContractual?: boolean;
  isUrgent?: boolean;
}

export interface Phrase {
  id: string;
  chinese: string;
  pinyin: string;
  english: string;
  bahasa: string;
  category: 'Price Negotiation' | 'Opening Remarks' | 'Quality Control' | 'Shipping & Logistics' | 'Formal Closing';
  effectiveness: number; // 0 to 5
  isFavorite?: boolean;
}
