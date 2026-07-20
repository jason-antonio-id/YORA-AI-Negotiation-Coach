import { Supplier, Phrase, ChatMessage } from './types';

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: '1',
    chineseName: '凉州科技有限责任公司',
    englishName: 'Liangzhou Tech',
    wechatId: 'Liangzhou_WeChat',
    url: 'https://www.liangzhou-tech.cn',
    province: 'Guangdong 广东',
    city: 'Shenzhen 深圳',
    discoverySource: 'Alibaba 阿里巴巴',
    cooperationHistory: 'Existing Supplier | 长期供应商',
    status: 'Active',
    coreProducts: ['Strategic Components', 'Microchips'],
    guanxiScore: 85,
    lastContactText: 'Yesterday via WeChat - Negotiating Q3 volume discounts.',
    logoUrl: 'https://i.ibb.co.com/ZZ9rMnb/1.png',
    productName: 'High-Precision Sensors V2',
    productChineseName: '高精度传感器 V2',
    targetPrice: '2.80',
    walkAwayPrice: '3.50'
  },
  {
    id: '2',
    chineseName: '华悦物流有限公司',
    englishName: 'Huayue Logistics',
    wechatId: 'HY_Logistics_CN',
    url: 'https://www.huayue-logistics.com',
    province: 'Zhejiang 浙江',
    city: 'Ningbo 宁波',
    discoverySource: 'Referral 推荐',
    cooperationHistory: 'Potential New Supplier | 潜在新供应商',
    status: 'Pending',
    coreProducts: ['Freight Forwarding', 'Cold Chain'],
    guanxiScore: 42,
    lastContactText: '2 weeks ago - Initial inquiry sent for cold chain route.',
    logoUrl: 'https://i.ibb.co.com/ZZ9rMnb/1.png',
    productName: 'Cold Chain Shipping',
    productChineseName: '冷链物流服务'
  },
  {
    id: '3',
    chineseName: '大盛硅业有限公司',
    englishName: 'Dashing Silicon',
    wechatId: 'Dashing_Silicon',
    url: 'https://www.dashing-silicon.cn',
    province: 'Jiangsu 江苏',
    city: 'Suzhou 苏州',
    discoverySource: 'Trade Show 展会',
    cooperationHistory: 'Existing Supplier | 长期供应商',
    status: 'At Risk',
    coreProducts: ['Silicon Wafers', 'Raw Materials'],
    guanxiScore: 29,
    lastContactText: 'Today - Supplier warned of potential cost increase due to energy costs.',
    logoUrl: 'https://i.ibb.co.com/ZZ9rMnb/1.png',
    productName: 'Raw Silicon Material',
    productChineseName: '硅原材料'
  }
];

export const INITIAL_PHRASES: Phrase[] = [
  {
    id: 'p1',
    chinese: '能否再优惠一点？',
    pinyin: 'Néngfǒu zài yōuhuì yīdiǎn?',
    english: 'Can you offer a better price?',
    bahasa: 'Bisakah Anda memberikan harga yang lebih baik?',
    category: 'Price Negotiation',
    effectiveness: 4
  },
  {
    id: 'p2',
    chinese: '久仰大名，很高兴见到您。',
    pinyin: 'Jiǔyǎng dàmíng, hěn gāoxìng jiàn dào nín.',
    english: "I have heard so much about you, it's a pleasure to meet you.",
    bahasa: 'Saya sudah lama mendengar nama besar Anda, senang bertemu dengan Anda.',
    category: 'Opening Remarks',
    effectiveness: 5
  },
  {
    id: 'p3',
    chinese: '质量是我们最关心的问题。',
    pinyin: 'Zhìliàng shì wǒmen zuì guānxīn de wèntí.',
    english: 'Quality is our primary concern.',
    bahasa: 'Kualitas adalah perhatian utama kami.',
    category: 'Quality Control',
    effectiveness: 3
  },
  {
    id: 'p4',
    chinese: '请问什么时候可以交货？',
    pinyin: 'Qǐngwèn shénme shíhou kěyǐ jiāohuò?',
    english: 'May I ask when the delivery can be made?',
    bahasa: 'Boleh saya tahu kapan pengiriman bisa dilakukan?',
    category: 'Shipping & Logistics',
    effectiveness: 4
  },
  {
    id: 'p5',
    chinese: '期待与您的长期合作。',
    pinyin: 'Qīdài yǔ nín de chángqī hézuò.',
    english: 'Looking forward to a long-term cooperation with you.',
    bahasa: 'Menantikan kerja sama jangka panjang dengan Anda.',
    category: 'Formal Closing',
    effectiveness: 5
  },
  {
    id: 'p6',
    chinese: '这是我们的采购预测计划。',
    pinyin: 'Zhè shì wǒmen de cǎigòu yùcè jìhuà.',
    english: 'This is our purchasing forecast plan.',
    bahasa: 'Ini adalah rencana perkiraan pembelian kami.',
    category: 'Price Negotiation',
    effectiveness: 4
  },
  {
    id: 'p7',
    chinese: '希望双方能各让一步。',
    pinyin: 'Xīwàng shuāngfāng néng gè ràng yī bù.',
    english: 'I hope both sides can make a mutual concession.',
    bahasa: 'Saya harap kedua belah pihak dapat saling memberi kelonggaran.',
    category: 'Price Negotiation',
    effectiveness: 5
  },
  {
    id: 'p8',
    chinese: '我们需要确保供应链的稳定性。',
    pinyin: 'Wǒmen xūyào quèbǎo gōngyìngliàn de wěndìngxìng.',
    english: 'We need to ensure the stability of our supply chain.',
    bahasa: 'Kami perlu memastikan stabilitas rantai pasokan kami.',
    category: 'Shipping & Logistics',
    effectiveness: 4
  },
  {
    id: 'p9',
    chinese: '这个价格超出了我们的预算。',
    pinyin: 'Zhège jiàgé chāochūle wǒmen de yùsuàn.',
    english: 'This price exceeds our budget.',
    bahasa: 'Harga ini melebihi anggaran kami.',
    category: 'Price Negotiation',
    effectiveness: 5
  },
  {
    id: 'p10',
    chinese: '我们希望能够得到更快的反馈。',
    pinyin: 'Wǒmen xīwàng nénggòu dédào gèng kuài de fǎnkuì.',
    english: 'We hope to receive faster feedback.',
    bahasa: 'Kami harap bisa mendapatkan umpan balik yang lebih cepat.',
    category: 'Opening Remarks',
    effectiveness: 3
  },
  {
    id: 'p11',
    chinese: '如果订单量大，还有打折吗？',
    pinyin: 'Rúguǒ dìngdān liàng dà, hái yǒu dǎzhé ma?',
    english: 'If the order volume is large, is there a further discount?',
    bahasa: 'Jika volume pesanan besar, apakah ada diskon lebih lanjut?',
    category: 'Price Negotiation',
    effectiveness: 5
  },
  {
    id: 'p12',
    chinese: '我们需要分批出货。',
    pinyin: 'Wǒmen xūyào fēnpī chūhuò.',
    english: 'We need partial shipments.',
    bahasa: 'Kami membutuhkan pengiriman secara bertahap.',
    category: 'Shipping & Logistics',
    effectiveness: 4
  }
];

export const INITIAL_CHAT: ChatMessage[] = [
  {
    id: 'chat-sys-1',
    sender: 'system',
    senderName: 'System',
    text: 'Today, 14:22',
    timeText: 'System'
  },
  {
    id: 'chat-ai-1',
    sender: 'ai',
    senderName: 'Rui AI Assistant',
    text: "I've analyzed the last three messages. The supplier is showing signs of flexibility on the MOQ if we adjust the payment terms. Would you like me to draft a counter-offer? 📝",
    timeText: '14:25'
  },
  {
    id: 'chat-user-1',
    sender: 'user',
    senderName: 'Me',
    text: "Yes, please focus on the ¥2.00 target price. I'm willing to go up to 60% upfront payment if needed.",
    timeText: '14:45'
  },
  {
    id: 'chat-sup-1',
    sender: 'supplier',
    senderName: 'Shenzhen Tech Ltd.',
    text: '价格方面，由于近期原材料成本上涨，我们下周看看核算后的结果再给您回复。',
    timeText: '15:01',
    translation: 'Regarding the cost adjustment, due to raw material increases, we will look into the calculated results next week and then reply to you.'
  }
];
