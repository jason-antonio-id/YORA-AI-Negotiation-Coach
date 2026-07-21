import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ScreenType, Supplier } from '../types';
import { resolveStorageUrl } from '../lib/supabase';

interface WizardProps {
  onNavigate: (screen: ScreenType, params?: { supplierId?: string }) => void;
  onAddSupplier: (supplier: Supplier) => Promise<void> | void;
  addedSupplier: Supplier | null;
  setAddedSupplier: (supplier: Supplier | null) => void;
}

export function WizardStep1({ onNavigate, onAddSupplier, addedSupplier, setAddedSupplier }: WizardProps) {
  const [chineseName, setChineseName] = useState(addedSupplier?.chineseName || '杭州永睿贸易有限公司');
  const [englishName, setEnglishName] = useState(addedSupplier?.englishName || 'YORA Hangzhou Ltd.');
  const [wechatId, setWechatId] = useState(addedSupplier?.wechatId || 'wxid_hangzhou_yora');
  const [url, setUrl] = useState(addedSupplier?.url || 'https://www.hangzhou-precision.cn');
  const [province, setProvince] = useState(addedSupplier?.province || 'Zhejiang 浙江');
  const [city, setCity] = useState(addedSupplier?.city || 'Hangzhou 杭州');
  const [discoverySource, setDiscoverySource] = useState(addedSupplier?.discoverySource || 'Referral 推荐');
  const [cooperationHistory, setCooperationHistory] = useState(addedSupplier?.cooperationHistory || 'Potential New Supplier | 潜在新供应商');
  const [logoUploaded, setLogoUploaded] = useState(!!addedSupplier?.logoUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!chineseName.trim()) newErrors.chineseName = "Chinese Company Name is required";
    if (!wechatId.trim()) newErrors.wechatId = "WeChat ID is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    // Save temporary state in the addedSupplier object to carry on to next step
    const tempSupplier: Partial<Supplier> = {
      ...addedSupplier,
      id: addedSupplier?.id || crypto.randomUUID(),
      createdAt: addedSupplier?.createdAt || new Date().toISOString(),
      chineseName,
      englishName,
      wechatId,
      url,
      province,
      city,
      discoverySource,
      cooperationHistory,
      status: addedSupplier?.status || 'Pending',
      guanxiScore: addedSupplier?.guanxiScore || 50,
      coreProducts: addedSupplier?.coreProducts || ['Industrial Sensors V2'],
      lastContactText: addedSupplier?.lastContactText || 'Added today - Initial setup',
      logoUrl: logoUploaded ? (addedSupplier?.logoUrl || resolveStorageUrl('https://i.ibb.co.com/p6TtrMcF/Yora-logo.png')) : undefined
    };

    setAddedSupplier(tempSupplier as Supplier);
    localStorage.setItem('yora_wizard_draft', JSON.stringify(tempSupplier));
    onNavigate('wizard-step2');
  };

  const discoverySources = [
    "Alibaba 阿里巴巴",
    "Trade Show 展会",
    "Referral 推荐",
    "Global Sources 环球资源",
  ];

  const handleLogoClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      if (e.target.files && e.target.files[0]) {
        setLogoUploaded(true);
      }
    };
    input.click();
  };

  const handleDiscoveryClick = (src: string) => {
    setDiscoverySource(src);
  };

  const isOtherDiscovery = !discoverySources.includes(discoverySource) || discoverySource === 'Others';

  const PROVINCES = [
    "Zhejiang 浙江", "Guangdong 广东", "Jiangsu 江苏", "Fujian 福建", "Shandong 山东", 
    "Hebei 河北", "Henan 河南", "Hubei 湖北", "Hunan 湖南", "Sichuan 四川", 
    "Anhui 安徽", "Liaoning 辽宁", "Jiangxi 江西", "Shaanxi 陕西", "Chongqing 重庆", 
    "Shanghai 上海", "Beijing 北京", "Tianjin 天津"
  ];

  const CITIES_BY_PROVINCE: Record<string, string[]> = {
    "Zhejiang 浙江": ["Hangzhou 杭州", "Ningbo 宁波", "Wenzhou 温州", "Shaoxing 绍兴", "Jiaxing 嘉兴"],
    "Guangdong 广东": ["Guangzhou 广州", "Shenzhen 深圳", "Dongguan 东莞", "Foshan 佛山", "Zhongshan 中山"],
    "Jiangsu 江苏": ["Nanjing 南京", "Suzhou 苏州", "Wuxi 无锡", "Changzhou 常州", "Nantong 南通"],
    "Shanghai 上海": ["Pudong 浦东", "Xuhui 徐汇", "Jing'an 静安", "Huangpu 黄浦"],
    "Beijing 北京": ["Chaoyang 朝阳", "Haidian 海淀", "Dongcheng 东城", "Xicheng 西城"],
    "Fujian 福建": ["Fuzhou 福州", "Xiamen 厦门", "Quanzhou 泉州", "Zhangzhou 漳州", "Putian 莆田"],
    "Shandong 山东": ["Jinan 济南", "Qingdao 青岛", "Yantai 烟台", "Weifang 潍坊", "Zibo 淄博"],
    "Hebei 河北": ["Shijiazhuang 石家庄", "Tangshan 唐山", "Baoding 保定", "Handan 邯郸"],
    "Henan 河南": ["Zhengzhou 郑州", "Luoyang 洛阳", "Kaifeng 开封", "Anyang 安阳"],
    "Hubei 湖北": ["Wuhan 武汉", "Xiangyang 襄阳", "Yichang 宜昌"],
    "Hunan 湖南": ["Changsha 长沙", "Zhuzhou 株洲", "Xiangtan 湘潭"],
    "Sichuan 四川": ["Chengdu 成都", "Mianyang 绵阳", "Nanchong 南充"],
    "Anhui 安徽": ["Hefei 合肥", "Wuhu 芜湖", "Bengbu 蚌埠"],
    "Liaoning 辽宁": ["Shenyang 沈阳", "Dalian 大连", "Anshan 鞍山"],
    "Jiangxi 江西": ["Nanchang 南昌", "Jiujiang 九江", "Ganzhou 赣州"],
    "Shaanxi 陕西": ["Xi'an 西安", "Baoji 宝鸡", "Xianyang 咸阳"],
    "Chongqing 重庆": ["Yuzhong 渝中", "Jiangbei 江北", "Nan'an 南岸"],
    "Tianjin 天津": ["Binhai 滨海", "Heping 和平", "Nankai 南开"],
  };

  const handleProvinceChange = (val: string) => {
    setProvince(val);
    const cities = CITIES_BY_PROVINCE[val] || [];
    if (cities.length > 0) setCity(cities[0]);
  };

  return (
    <div className="flex min-h-screen text-on-surface">
      {/* SideNavBar layout */}
      <aside className="hidden md:flex flex-col h-screen py-stack-lg bg-surface-container-lowest border-r border-border-light w-[240px] sticky top-0 shrink-0">
                  <div className="px-6 mb-10 min-w-[200px]" onClick={() => onNavigate('dashboard-active')}>
                    <div className="flex items-center gap-4 cursor-pointer">
                      <img
                        alt="YORA Logo"
                        className="h-11 w-auto object-contain"
                        src={resolveStorageUrl("https://i.ibb.co.com/p6TtrMcF/Yora-logo.png")}
                      />
                      <div className="flex flex-col justify-center text-left">
                        <span className="font-display-lg text-lg font-bold text-charcoal leading-none">YORA | 永睿</span>
                        <span className="font-sans font-semibold text-[#6B7280] text-[11px] tracking-tight mt-0.5 leading-none">AI Negotiation Coach</span>
                      </div>
                    </div>
                  </div>
        <nav className="flex-1 space-y-1">
          <div className="flex items-center px-6 py-3 text-secondary transition-all duration-200 hover:bg-surface-muted cursor-pointer font-label-cn-bold text-label-cn-bold" onClick={() => onNavigate('dashboard-active')}>
            <span className="material-symbols-outlined mr-3">dashboard</span>
            <span>Dashboard | 仪表板</span>
          </div>
          <div className="flex items-center px-6 py-3 bg-on-primary-container text-primary border-l-4 border-primary transition-all duration-200 font-label-cn-bold text-label-cn-bold" onClick={() => onNavigate('supplier-list')}>
            <span className="material-symbols-outlined mr-3">inventory_2</span>
            <span>My Suppliers | 我的供应商</span>
          </div>
          <div className="flex items-center px-6 py-3 text-secondary transition-all duration-200 hover:bg-surface-muted cursor-pointer font-label-cn-bold text-label-cn-bold" onClick={() => onNavigate('negotiation-room')}>
            <span className="material-symbols-outlined mr-3">handshake</span>
            <span>Negotiation Room | 谈判室</span>
          </div>
          <div className="flex items-center px-6 py-3 text-secondary transition-all duration-200 hover:bg-surface-muted cursor-pointer font-label-cn-bold text-label-cn-bold" onClick={() => onNavigate('guanxi-meter')}>
            <span className="material-symbols-outlined mr-3">analytics</span>
            <span>Guanxi Meter | 关系表</span>
          </div>
          <div className="flex items-center px-6 py-3 text-secondary transition-all duration-200 hover:bg-surface-muted cursor-pointer font-label-cn-bold text-label-cn-bold" onClick={() => onNavigate('message-history')}>
            <span className="material-symbols-outlined mr-3">history</span>
            <span>Message History | 消息历史</span>
          </div>
          <div className="flex items-center px-6 py-3 text-secondary transition-all duration-200 hover:bg-surface-muted cursor-pointer font-label-cn-bold text-label-cn-bold" onClick={() => onNavigate('phrase-library')}>
            <span className="material-symbols-outlined mr-3">library_books</span>
            <span>Phrase Library | 短语库</span>
          </div>
          <div className="flex items-center px-6 py-3 text-secondary transition-all duration-200 hover:bg-surface-muted cursor-pointer font-label-cn-bold text-label-cn-bold" onClick={() => onNavigate('cultural-guide')}>
            <span className="material-symbols-outlined mr-3">explore</span>
            <span>Cultural Guide | 文化指南</span>
          </div>
          <div className="flex items-center px-6 py-3 text-secondary transition-all duration-200 hover:bg-surface-muted cursor-pointer font-label-cn-bold text-label-cn-bold" onClick={() => onNavigate('settings')}>
            <span className="material-symbols-outlined mr-3">settings</span>
            <span>Settings | 设置</span>
          </div>
        </nav>

        <div className="mt-auto px-6">
          <div className="p-4 bg-surface-muted rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                <img src={resolveStorageUrl("https://i.ibb.co.com/ZZ9rMnb/1.png")} alt="Rui Mascot" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <p className="font-label-cn-bold text-label-cn-bold text-xs text-on-surface">Rui Advisor</p>
              <p className="text-[10px] text-subtitle-grey font-bold uppercase tracking-tight">AI Active</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* TopAppBar */}
        <header className="flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop bg-surface-container-lowest border-b border-border-light sticky top-0 z-40">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5 cursor-pointer mr-2 shrink-0 min-w-[130px] sm:min-w-[180px]" onClick={() => onNavigate('dashboard-active')}>
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
            <div className="h-6 w-[1px] bg-border-light mx-2 hidden md:block"></div>
            <nav className="flex items-center font-body-rg text-[11px] md:text-sm font-bold text-subtitle-grey hidden md:flex">
              <span className="cursor-pointer hover:text-primary transition-colors font-bold text-subtitle-grey" onClick={() => onNavigate('supplier-list')}>My Suppliers / <span className="font-bold">我的供应商</span></span>
              <span className="material-symbols-outlined text-[14px] mx-1 font-bold">chevron_right</span>
              <span className="text-on-background font-bold">Add New Supplier / <span className="text-on-background font-bold">添加新供应商</span></span>
            </nav>
          </div>
          <div className="flex items-center gap-6">
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 flex flex-col items-center pt-[48px] pb-32 px-margin-mobile md:px-0">
          <div className="w-full max-w-[640px]">
            {/* Progress Stepper */}
            <div className="flex items-start mb-12">
              <div className="flex flex-col items-center flex-1">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold border-2 border-primary">1</div>
                <span className="mt-2 font-label-cn-bold text-label-cn-bold text-primary text-xs">Info / 基本信息</span>
              </div>
              <div className="step-line mt-5"></div>
              <div className="flex flex-col items-center flex-1">
                <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-secondary text-sm font-bold border-2 border-transparent">2</div>
                <span className="mt-2 font-label-cn-rg text-label-cn-rg text-secondary text-xs">Products / 产品信息</span>
              </div>
              <div className="step-line mt-5"></div>
              <div className="flex flex-col items-center flex-1">
                <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-secondary text-sm font-bold border-2 border-transparent">3</div>
                <span className="mt-2 font-label-cn-rg text-label-cn-rg text-secondary text-xs">Terms / 条款</span>
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-surface-container-lowest border border-border-light rounded-xl p-8 custom-shadow animate-fade-in-up">
              <h2 className="font-subhead-sm text-subhead-sm mb-6">Supplier Information <span className="text-subtitle-grey font-normal ml-2">供应商信息</span></h2>
              <form className="space-y-6" onSubmit={handleNext}>
                {/* Company Names */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
                  <div>
                    <label className="block mb-2 font-label-cn-bold text-label-cn-bold text-sm">Chinese Company Name* <span className="text-subtitle-grey font-normal">中文名称</span></label>
                    <input
                      className={`w-full h-11 px-4 border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all text-sm ${errors.chineseName ? 'border-red-600 bg-red-50' : 'border-border-light'}`}
                      placeholder="例如: 杭州永睿贸易有限公司"
                      value={chineseName}
                      onChange={(e) => {
                        setChineseName(e.target.value);
                        if (errors.chineseName) setErrors(prev => ({ ...prev, chineseName: '' }));
                      }}
                      type="text"
                    />
                    {errors.chineseName && <p className="text-red-600 text-[10px] mt-1 font-bold italic">{errors.chineseName}</p>}
                  </div>
                  <div>
                    <label className="block mb-2 font-label-cn-bold text-label-cn-bold text-sm">English Name <span className="text-subtitle-grey font-normal">英文名称</span></label>
                    <input
                      className="w-full h-11 px-4 border border-border-light rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                      placeholder="e.g. YORA Hangzhou Ltd."
                      value={englishName}
                      onChange={(e) => setEnglishName(e.target.value)}
                      type="text"
                    />
                  </div>
                </div>

                {/* WeChat & URL */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
                  <div>
                    <label className="block mb-2 font-label-cn-bold text-label-cn-bold text-sm">WeChat ID* <span className="text-subtitle-grey font-normal">微信 ID</span></label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm">chat</span>
                      <input
                        className={`w-full h-11 pl-10 pr-4 border rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all text-sm ${errors.wechatId ? 'border-red-600 bg-red-50' : 'border-border-light'}`}
                        placeholder="wxid_..."
                        value={wechatId}
                        onChange={(e) => {
                          setWechatId(e.target.value);
                          if (errors.wechatId) setErrors(prev => ({ ...prev, wechatId: '' }));
                        }}
                        type="text"
                      />
                    </div>
                    {errors.wechatId && <p className="text-red-600 text-[10px] mt-1 font-bold italic">{errors.wechatId}</p>}
                  </div>
                  <div>
                    <label className="block mb-2 font-label-cn-bold text-label-cn-bold text-sm">Supplier URL <span className="text-subtitle-grey font-normal">网址</span></label>
                    <input
                      className="w-full h-11 px-4 border border-border-light rounded-xl focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                      placeholder="https://..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      type="text"
                    />
                  </div>
                </div>

                {/* Location Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
                  <div>
                    <label className="block mb-2 font-label-cn-bold text-label-cn-bold text-sm">Province <span className="text-subtitle-grey font-normal">省份</span></label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-sm overflow-hidden pointer-events-none text-base">
                        🇨🇳
                      </div>
                    <select
                        className="w-full h-11 pl-10 pr-4 border border-border-light rounded-xl appearance-none focus:ring-1 focus:ring-primary outline-none text-sm"
                        value={province}
                        onChange={(e) => handleProvinceChange(e.target.value)}
                      >
                        {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary">expand_more</span>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 font-label-cn-bold text-label-cn-bold text-sm">City <span className="text-subtitle-grey font-normal">城市</span></label>
                    <div className="relative">
                      <select
                        className="w-full h-11 px-4 border border-border-light rounded-xl appearance-none focus:ring-1 focus:ring-primary outline-none text-sm"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      >
                        {(CITIES_BY_PROVINCE[province] || [city]).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary">expand_more</span>
                    </div>
                  </div>
                </div>

                {/* Pill Grid: Discovery */}
                <div>
                  <label className="block mb-3 font-label-cn-bold text-label-cn-bold text-sm">How did you find this supplier? <span className="text-subtitle-grey font-normal">您是如何找到该供应商的？</span></label>
                  <div className="flex flex-wrap gap-2">
                    {discoverySources.map(src => {
                      const isActive = discoverySource === src;
                      return (
                        <button
                          key={src}
                          type="button"
                          className={`px-4 py-2 rounded-full border text-xs font-bold transition-colors ${
                            isActive
                              ? 'bg-primary border-primary text-white'
                              : 'bg-surface-muted text-on-surface border-border-light hover:border-primary'
                          }`}
                          onClick={() => handleDiscoveryClick(src)}
                        >
                          {src}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-full border text-xs font-bold transition-colors ${
                        isOtherDiscovery
                          ? 'bg-primary border-primary text-white'
                          : 'bg-surface-muted text-on-surface border-border-light hover:border-primary'
                      }`}
                      onClick={() => setDiscoverySource('Others')}
                    >
                      Others
                    </button>
                  </div>
                  {isOtherDiscovery && (
                    <div className="mt-3 animate-fade-in">
                      <input 
                        type="text"
                        className="w-full h-11 px-4 border border-primary rounded-xl focus:ring-1 focus:ring-primary outline-none text-sm"
                        placeholder="Specify source... / 指定来源..."
                        value={discoverySources.includes(discoverySource) ? '' : discoverySource}
                        onChange={(e) => setDiscoverySource(e.target.value)}
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* Dropdown: Cooperation History */}
                <div>
                  <label className="block mb-2 font-label-cn-bold text-label-cn-bold text-sm">Cooperation History <span className="text-subtitle-grey font-normal">合作历史</span></label>
                  <div className="relative">
                    <select
                      className="w-full h-11 px-4 border border-border-light rounded-xl appearance-none focus:ring-1 focus:ring-primary outline-none text-sm font-semibold"
                      value={cooperationHistory}
                      onChange={(e) => setCooperationHistory(e.target.value)}
                    >
                      <option value="Potential New Supplier | 潜在新供应商">Potential New Supplier | 潜在新供应商</option>
                      <option value="Sample Phase | 样品阶段">Sample Phase | 样品阶段</option>
                      <option value="Existing Supplier | 长期供应商">Existing Supplier | 长期供应商</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary">expand_more</span>
                  </div>
                </div>

                {/* Wizard actions inside form */}
                <div className="mt-8 flex justify-between items-center bg-transparent border-t-0 p-0">
                  <button
                    type="button"
                    onClick={() => onNavigate('supplier-list')}
                    className="px-6 py-3 text-secondary font-label-cn-bold text-label-cn-bold hover:bg-surface-muted rounded-xl transition-all cursor-pointer text-sm"
                  >
                    Cancel | 取消
                  </button>
                  <button
                    type="submit"
                    className="px-10 py-3 bg-primary text-white font-label-cn-bold text-label-cn-bold rounded-xl custom-shadow hover:bg-primary-container transition-all cursor-pointer text-sm"
                  >
                    Save & Continue | 保存并继续
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function WizardStep2({ onNavigate, addedSupplier, setAddedSupplier }: WizardProps) {
  const [productName, setProductName] = useState(addedSupplier?.productName || 'Industrial Sensors V2');
  const [productChineseName, setProductChineseName] = useState(addedSupplier?.productChineseName || '高精度工业传感器 V2');
  const [category, setCategory] = useState(addedSupplier?.category || 'Electronics');
  const [specs, setSpecs] = useState(addedSupplier?.specs || 'Industrial temperature sensor, range -40 to 125C, stainless housing, RS-485 interface.');
  const [askingPrice, setAskingPrice] = useState(addedSupplier?.currentPrice || '18.00');
  const [targetPrice, setTargetPrice] = useState(addedSupplier?.targetPrice || '14.50');
  const [walkawayVal, setWalkawayVal] = useState(addedSupplier?.walkAwayPrice || '20.00');
  const [supplierMOQ, setSupplierMOQ] = useState(addedSupplier?.moq || '5000');
  const [targetMOQ, setTargetMOQ] = useState(addedSupplier?.targetMOQ || '2500');
  const [sampleRequired, setSampleRequired] = useState(true);
  const [incoterms, setIncoterms] = useState(addedSupplier?.incoterms || 'FOB');

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !targetPrice) {
      alert("Please provide the Product Name and Target Price threshold");
      return;
    }

    if (addedSupplier) {
      const updatedSupplier: Supplier = {
        ...addedSupplier,
        productName,
        productChineseName,
        coreProducts: [productName],
        targetPrice,
        walkAwayPrice: walkawayVal,
        currentPrice: askingPrice,
        moq: supplierMOQ,
        specs,
        category,
        targetMOQ,
        incoterms
      };
      setAddedSupplier(updatedSupplier);
      localStorage.setItem('yora_wizard_draft', JSON.stringify(updatedSupplier));
    }
    onNavigate('wizard-step3');
  };

  const categories = ["Furniture", "Electronics", "Textiles", "Machinery"];
  const isOtherCategory = !categories.includes(category) || category === 'Others';

  return (
    <div className="font-body-rg text-on-surface min-h-screen">
      <nav className="bg-surface-container-lowest border-b border-border-light flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop sticky top-0 z-50">
        <div className="flex items-center gap-2 sm:gap-4 cursor-pointer shrink-0 min-w-[130px] sm:min-w-[180px]" onClick={() => onNavigate('dashboard-active')}>
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
        <div className="flex items-center gap-2 hidden sm:flex shrink-0">
          <div className="h-6 w-[1px] bg-border-light mx-2"></div>
          <span className="font-subhead-sm text-[11px] md:text-sm font-semibold text-secondary">New Supplier | 新供应商</span>
        </div>
      </nav>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-margin-desktop py-6 md:py-12 flex gap-6 lg:gap-12">
        {/* Left Stepper */}
        <aside className="w-[240px] flex-shrink-0 hidden lg:block">
          <div className="sticky top-24 space-y-8">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 group cursor-pointer" onClick={() => onNavigate('wizard-step1')}>
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center border-2 border-primary">
                  <span className="material-symbols-outlined text-body-rg">check</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-cn-bold text-label-cn-bold text-secondary text-xs">Step 1 / 步骤一</span>
                  <span className="font-body-rg text-[13px] font-bold text-on-surface">Info / 基本信息</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-primary bg-on-primary-container text-primary flex items-center justify-center font-bold">2</div>
                <div className="flex flex-col">
                  <span className="font-label-cn-bold text-label-cn-bold text-primary text-xs">Step 2 / 步骤二</span>
                  <span className="font-body-rg text-[13px] font-bold text-primary">Products / 产品信息</span>
                </div>
              </div>
              <div className="flex items-center gap-4 opacity-40">
                <div className="w-10 h-10 rounded-full border-2 border-border-light bg-white text-secondary flex items-center justify-center font-bold">3</div>
                <div className="flex flex-col">
                  <span className="font-label-cn-bold text-label-cn-bold text-secondary text-xs">Step 3 / 步骤三</span>
                  <span className="font-body-rg text-[13px] font-bold text-secondary">Terms / 条款</span>
                </div>
              </div>
            </div>
            <div className="bg-surface-muted p-6 rounded-xl space-y-4 shadow-sm border border-border-light">
              <span className="material-symbols-outlined text-primary">analytics</span>
              <p className="font-label-cn-rg text-xs leading-normal text-secondary">Rui is preparing to analyze market rates for your category based on your target thresholds.</p>
            </div>
          </div>
        </aside>

        {/* Form panel */}
        <section className="flex-grow max-w-[800px]">
          <header className="mb-stack-lg">
            <h1 className="font-headline-md text-headline-md text-on-surface">Products &amp; Pricing / 产品和价格</h1>
            <p className="text-subtitle-grey font-body-rg mt-2">Define the product specifications and your financial thresholds for negotiation.</p>
          </header>

          <form onSubmit={handleNext} className="bg-surface-container-lowest border border-border-light rounded-xl p-stack-lg shadow-[0_2px_16px_rgba(0,0,0,0.04)] space-y-stack-lg">
            {/* Product Identity */}
            <div className="space-y-stack-md">
              <h3 className="font-subhead-sm text-subhead-sm text-on-surface">Product Identity / 产品标识</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
                <div className="space-y-2">
                  <label className="flex items-baseline gap-2">
                    <span className="font-body-rg font-bold text-sm">Product Name</span>
                    <span className="font-label-cn-rg text-subtitle-grey text-xs">产品名称</span>
                  </label>
                  <input
                    className="w-full h-12 border border-border-light rounded-xl px-4 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                    placeholder="e.g. Ergonomic Office Chair"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    required
                    type="text"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-baseline gap-2">
                    <span className="font-body-rg font-bold text-sm">Chinese Name</span>
                    <span className="font-label-cn-rg text-subtitle-grey text-xs">中文名称</span>
                  </label>
                  <input
                    className="w-full h-12 border border-border-light rounded-xl px-4 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
                    placeholder="例如：人体工学办公椅"
                    value={productChineseName}
                    onChange={(e) => setProductChineseName(e.target.value)}
                    type="text"
                  />
                </div>
              </div>

              {/* Category Picker */}
              <div className="space-y-2 pt-2">
                <label className="font-body-rg font-bold block text-sm">Category / 类别</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => {
                    const isActive = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`px-4 py-2 rounded-full border text-xs font-bold transition-all ${
                          isActive
                            ? 'border-primary bg-primary-fixed text-primary'
                            : 'border-border-light bg-surface-muted text-secondary hover:border-primary'
                        }`}
                        onClick={() => setCategory(cat)}
                      >
                        {cat}
                      </button>
                    );
                  })}
                    <button
                      type="button"
                      onClick={() => {
                        setCategory('Others');
                      }}
                      className={`px-4 py-2 rounded-full border border-border-light border-dashed text-xs flex items-center gap-1 transition-all cursor-pointer ${
                        isOtherCategory
                          ? 'border-primary bg-primary-fixed text-primary' 
                          : 'text-secondary hover:border-primary hover:text-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span> Others
                    </button>
                </div>
                {isOtherCategory && (
                  <div className="mt-3 animate-fade-in">
                    <input 
                      type="text"
                      className="w-full h-11 px-4 border border-primary rounded-xl focus:ring-1 focus:ring-primary outline-none text-sm"
                      placeholder="Specify category... / 指定类别..."
                      value={categories.includes(category) ? '' : category}
                      onChange={(e) => setCategory(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-baseline gap-2">
                  <span className="font-body-rg font-bold text-sm">Specifications</span>
                  <span className="font-label-cn-rg text-subtitle-grey text-xs">规格说明</span>
                </label>
                <textarea
                  className="w-full border border-border-light rounded-xl p-4 focus:ring-primary focus:border-primary outline-none transition-all text-sm resize-y"
                  placeholder="Detailed technical specs, materials, dimensions..."
                  value={specs}
                  onChange={(e) => setSpecs(e.target.value)}
                  rows={4}
                ></textarea>
              </div>
            </div>

            <hr className="border-border-light" />

            {/* Pricing Thresholds */}
            <div className="space-y-stack-md">
              <h3 className="font-subhead-sm text-subhead-sm text-on-surface">Pricing Thresholds / 价格阈值</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-border-light p-5 rounded-xl space-y-3 bg-surface-muted">
                  <span className="text-[12px] font-bold text-secondary uppercase tracking-wider block">Supplier Asking</span>
                  <div className="flex items-center">
                    <span className="text-subtitle-grey mr-2">¥</span>
                    <input
                      className="bg-transparent border-none p-0 text-xl font-bold w-full focus:ring-0 outline-none"
                      placeholder="0.00"
                      value={askingPrice}
                      onChange={(e) => setAskingPrice(e.target.value)}
                      type="number"
                    />
                  </div>
                  <p className="text-[11px] text-subtitle-grey">Original quote from supplier (CNY)</p>
                </div>

                <div className="border-2 border-primary-container p-5 rounded-xl space-y-3 bg-white shadow-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-1.5 bg-primary-container text-white">
                    <span className="material-symbols-outlined text-[14px]">star</span>
                  </div>
                  <span className="text-[12px] font-bold text-primary uppercase tracking-wider block">Target Price</span>
                  <div className="flex items-center">
                    <span className="text-primary font-bold mr-2">¥</span>
                    <input
                      className="bg-transparent border-none p-0 text-xl text-primary font-bold w-full focus:ring-0 outline-none"
                      placeholder="0.00"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      type="number"
                    />
                  </div>
                  <p className="text-[11px] text-primary-container font-medium">Your ideal purchase price (CNY)</p>
                </div>

                <div className="border border-border-light p-5 rounded-xl space-y-3 bg-surface-muted opacity-80">
                  <div className="flex justify-between items-start">
                    <span className="text-[12px] font-bold text-secondary uppercase tracking-wider block">Walk-Away</span>
                    <span className="material-symbols-outlined text-secondary text-[18px]">lock</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-subtitle-grey mr-2">¥</span>
                    <input
                      className="bg-transparent border-none p-0 text-xl font-bold w-full focus:ring-0 outline-none"
                      placeholder="0.00"
                      value={walkawayVal}
                      onChange={(e) => setWalkawayVal(e.target.value)}
                      type="number"
                    />
                  </div>
                  <p className="text-[11px] text-subtitle-grey">Do not exceed this limit</p>
                </div>
              </div>
            </div>

            {/* MOQs & Samples */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-lg pt-4">
              <div className="space-y-4">
                <h3 className="font-subhead-sm text-subhead-sm text-on-surface text-sm font-bold">MOQ / 起订量</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-border-light rounded-lg">
                    <span className="text-xs font-semibold">Supplier Quote</span>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-20 text-right border-none p-0 font-bold focus:ring-0 outline-none"
                        type="text"
                        value={supplierMOQ}
                        onChange={(e) => setSupplierMOQ(e.target.value)}
                      />
                      <span className="text-subtitle-grey text-xs">units</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-border-light rounded-lg">
                    <span className="text-xs font-bold text-primary">Your Target</span>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-20 text-right border-none p-0 font-bold text-primary focus:ring-0 outline-none"
                        placeholder="200"
                        type="text"
                        value={targetMOQ}
                        onChange={(e) => setTargetMOQ(e.target.value)}
                      />
                      <span className="text-primary text-xs">units</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-subhead-sm text-subhead-sm text-on-surface text-sm font-bold">Sample Required?</h3>
                <div className="flex items-center justify-between h-12 bg-surface-muted px-4 rounded-xl border border-border-light">
                  <span className="text-xs font-bold font-label-cn-bold">Request Physical Sample</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      className="sr-only peer"
                      type="checkbox"
                      checked={sampleRequired}
                      onChange={(e) => setSampleRequired(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-secondary-fixed peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <p className="text-[11px] text-subtitle-grey px-2">Selecting "Yes" adds sample shipment tracking to the dashboard automatically.</p>
              </div>
            </div>

            {/* Logistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-lg pt-4">
              <div className="space-y-4">
                <h3 className="font-subhead-sm text-subhead-sm text-on-surface font-bold">Incoterms / 贸易术语</h3>
                <div className="flex flex-wrap gap-2">
                  {['FOB', 'EXW', 'CIF', 'DDP'].map(term => {
                    const isSelected = incoterms === term;
                    return (
                      <button
                        key={term}
                        type="button"
                        className={`px-3 py-1.5 rounded-lg border text-[12px] font-bold cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary-fixed text-primary'
                            : 'border-border-light bg-white text-secondary hover:border-primary hover:text-primary'
                        }`}
                        onClick={() => setIncoterms(term)}
                      >
                        {term}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setIncoterms('Others')}
                    className={`px-3 py-1.5 rounded-lg border border-dashed text-[12px] font-bold cursor-pointer transition-all ${
                      !['FOB', 'EXW', 'CIF', 'DDP'].includes(incoterms) || incoterms === 'Others'
                        ? 'border-primary bg-primary-fixed text-primary'
                        : 'border-border-light bg-white text-secondary hover:border-primary hover:text-primary'
                    }`}
                  >
                    + Others
                  </button>
                </div>
                {(!['FOB', 'EXW', 'CIF', 'DDP'].includes(incoterms) || incoterms === 'Others') && (
                  <div className="mt-3 animate-fade-in">
                    <input
                      type="text"
                      className="w-full h-11 px-4 border border-primary rounded-xl focus:ring-1 focus:ring-primary outline-none text-sm"
                      placeholder="Specify Incoterms... / 指定贸易术语... (e.g. DDU)"
                      value={['FOB', 'EXW', 'CIF', 'DDP', 'Others'].includes(incoterms) ? '' : incoterms}
                      onChange={(e) => setIncoterms(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-subhead-sm text-subhead-sm text-on-surface">Target Goal</h3>
                <p className="text-[11px] text-subtitle-grey leading-relaxed">Specific logistics requirements will be handled by Rui in the negotiation room.</p>
              </div>
            </div>

            {/* Step navigation and controls */}
            <footer className="mt-stack-lg flex justify-between items-center py-stack-md bg-transparent border-t-0 p-0">
              <button
                type="button"
                onClick={() => onNavigate('wizard-step1')}
                className="flex items-center gap-2 text-secondary font-bold hover:text-on-surface transition-colors cursor-pointer text-sm"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back / 返回
              </button>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-10 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary-container transition-all cursor-pointer text-sm"
                >
                  Save &amp; Continue
                </button>
              </div>
            </footer>
          </form>
        </section>
      </main>

      {/* Footer Identity Removed */}
    </div>
  );
}

export function WizardStep3({ onNavigate, onAddSupplier, addedSupplier, setAddedSupplier }: WizardProps) {
  const [goal, setGoal] = useState(addedSupplier?.negotiationGoal || 'Lowest Price / 最低价格');
  const [paymentTarget, setPaymentTarget] = useState(addedSupplier?.paymentTarget || '100% Net 30');
  const [urgency, setUrgency] = useState(addedSupplier?.urgencyLevel ? (['Very Low', 'Low', 'Standard', 'High', 'Critical'].indexOf(addedSupplier.urgencyLevel) !== -1 ? ['Very Low', 'Low', 'Standard', 'High', 'Critical'].indexOf(addedSupplier.urgencyLevel) + 1 : 3) : 3);
  const [notes, setNotes] = useState(addedSupplier?.notes || '');
  const [isFinishing, setIsFinishing] = useState(false);

  const urgencyLevels = ['Very Low', 'Low', 'Standard', 'High', 'Critical'];

  const goals = [
    { text: 'Lowest Price / 最低价格', icon: 'payments', desc: 'Prioritize cost reduction above all other factors.', recommended: true },
    { text: 'Quality + Price / 质量与价格', icon: 'verified', desc: 'Balanced approach to secure quality without overpaying.' },
    { text: 'Reduce MOQ / 减少起订量', icon: 'inventory_2', desc: 'Focus on smaller trial orders to test market response.' },
    { text: 'Lead Time / 交货期', icon: 'schedule', desc: 'Prioritize speed of production and shipping schedules.' },
    { text: 'Exclusivity / 独家权', icon: 'contract', desc: 'Secure territorial or product-specific exclusivity.' },
    { text: 'Other / 其他', icon: 'more_horiz', desc: 'Specify custom requirements in the notes below.' }
  ];

  const handleFinishWizard = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    
    try {
      const freshId = crypto.randomUUID();
      if (addedSupplier) {
        const finalSupplier: Supplier = {
          ...addedSupplier,
          id: addedSupplier.id || freshId,
          status: addedSupplier.status || (goal === 'Lowest Price / 最低价格' ? 'High Priority' : 'Active'),
          negotiationGoal: goal,
          paymentTarget: paymentTarget,
          urgencyLevel: urgencyLevels[urgency - 1],
          notes: notes,
          scores: addedSupplier.scores || { trust: 50, leverage: 40, urgency: urgency * 20 },
          messages: addedSupplier.messages && addedSupplier.messages.length > 0 ? addedSupplier.messages : [{
            id: 'welcome',
            sender: 'ai',
            senderName: 'Rui',
            text: `Welcome! I've pre-analyzed ${addedSupplier.englishName}. We should focus on ${goal}. I've noted that our payment target is ${paymentTarget} and urgency is ${urgencyLevels[urgency-1]}. Ready to start?`,
            timeText: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]
        };
        // For sync, we could add these to an 'aiContext' or similar if needed, 
        // but for now we'll put them in the welcome message and state
        onAddSupplier(finalSupplier);
        setAddedSupplier(finalSupplier);
        onNavigate('supplier-added');
      } else {
        // Create fallback Hangzhou supplier directly if none is saved
        const fallbackSupplier: Supplier = {
          id: freshId,
          chineseName: '杭州精工技术有限公司',
          englishName: 'Hangzhou Precision Tech',
          wechatId: 'wxid_hz_precision',
          url: 'https://www.hz-precision.cn',
          province: 'Zhejiang 浙江',
          city: 'Hangzhou 杭州',
          discoverySource: 'Referral 推荐',
          cooperationHistory: 'Potential New Supplier | 潜在新供应商',
          status: 'High Priority',
          coreProducts: ['Industrial Sensors V2'],
          guanxiScore: 50,
          lastContactText: 'Created today',
          productName: 'Industrial Sensors V2',
          productChineseName: '高精度工业传感器 V2',
          targetPrice: '14.50',
          scores: { trust: 50, leverage: 40, urgency: 30 },
          messages: [{
            id: 'welcome',
            sender: 'ai',
            senderName: 'Rui',
            text: "Welcome! I've pre-analyzed this supplier. We should focus on Price. Ready to start?",
            timeText: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]
        };
        onAddSupplier(fallbackSupplier);
        setAddedSupplier(fallbackSupplier);
        onNavigate('supplier-added');
      }
    } catch (e: any) {
      console.error("Failed to finish wizard and add supplier:", e);
      // Show user-friendly error
      const msg = e?.message || 'Failed to create supplier. Please check your connection and try again.';
      alert(msg);
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="font-body-rg text-on-surface min-h-screen">
      <header className="bg-surface-container-lowest border-b border-border-light flex justify-between items-center h-16 w-full px-4 sm:px-6 md:px-margin-desktop z-50 sticky top-0">
        <div className="flex items-center gap-2 sm:gap-4 cursor-pointer shrink-0 min-w-[130px] sm:min-w-[180px]" onClick={() => onNavigate('dashboard-active')}>
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
        <div className="flex items-center gap-6">
          <div className="flex gap-6 hidden md:flex text-xs">
            <div className="flex items-center gap-3 opacity-100 group cursor-pointer" onClick={() => onNavigate('wizard-step1')}>
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[18px]">check</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-cn-bold text-primary text-[10px] uppercase">Step 1</span>
                <span className="font-bold text-on-surface">Info / 资料</span>
              </div>
            </div>
            <div className="flex items-center gap-3 opacity-100 group cursor-pointer" onClick={() => onNavigate('wizard-step2')}>
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[18px]">check</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-cn-bold text-primary text-[10px] uppercase">Step 2</span>
                <span className="font-bold text-on-surface">Products / 产品</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary bg-on-primary-container text-primary flex items-center justify-center font-bold shadow-sm animate-pulse-slow">3</div>
              <div className="flex flex-col">
                <span className="font-label-cn-bold text-primary text-[10px] uppercase">Step 3</span>
                <span className="font-bold text-primary">Terms / 条款</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1000px] px-margin-mobile md:px-0 py-stack-lg flex flex-col gap-stack-lg mx-auto">
        <div className="flex flex-col gap-2">
          <h1 className="font-headline-md text-headline-md text-on-surface">Goals &amp; Strategy / <span className="text-primary font-black">目标和策略</span></h1>
          <p className="text-subtitle-grey">Define your negotiation objectives. Rui will use these to draft your first outreach.</p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-stack-lg">
          {/* Form left */}
          <div className="md:col-span-8 flex flex-col gap-stack-lg">
            {/* Goal grid */}
            <div className="flex flex-col gap-stack-sm">
              <label className="font-subhead-sm text-on-surface font-semibold text-sm mb-1">Primary Negotiation Goal / 主要谈判目标</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map(g => {
                  const isSelected = goal === g.text;
                  return (
                    <div
                      key={g.text}
                      className={`p-4 rounded-xl cursor-pointer transition-all hover:shadow-md border ${
                        isSelected
                          ? 'border-2 border-primary bg-[#FFF5F5]'
                          : 'border-border-light bg-white hover:border-primary/50'
                      }`}
                      onClick={() => setGoal(g.text)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`material-symbols-outlined ${isSelected ? 'text-primary' : 'text-secondary'}`} style={{ fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0" }}>
                          {g.icon}
                        </span>
                        {g.recommended && (
                          <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider scale-90">RECOMMENDED</span>
                        )}
                      </div>
                      <p className="font-bold text-on-surface text-sm">{g.text}</p>
                      <p className="text-[12px] text-secondary leading-tight mt-1">{g.desc}</p>
                    </div>
                  );
                })}
              </div>
              {goal === 'Other / 其他' && (
                <div className="mt-4 animate-fade-in">
                  <input 
                    type="text"
                    className="w-full h-11 px-4 border border-primary rounded-xl focus:ring-1 focus:ring-primary outline-none text-sm font-medium"
                    placeholder="Specify your custom goal... / 指定您的自定义目标..."
                    onChange={(e) => {
                       const val = e.target.value;
                       setGoal(`Other: ${val}`);
                    }}
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Payment terms */}
            <div className="flex flex-col gap-stack-sm pt-4">
              <label className="font-subhead-sm text-on-surface font-semibold text-sm mb-1">Payment Terms Target / 支付条款目标</label>
              <div className="flex flex-wrap gap-2">
                {["30/70 Standard", "100% Net 30", "LC (Letter of Credit)", "Pay on Arrival", "Others"].map(pay => {
                  const isSelected = paymentTarget === pay || (pay === 'Others' && !["30/70 Standard", "100% Net 30", "LC (Letter of Credit)", "Pay on Arrival"].includes(paymentTarget));
                  return (
                    <button
                      key={pay}
                      type="button"
                      className={`px-4 py-2 rounded-full border font-label-cn-rg text-xs font-bold transition-all ${
                        isSelected
                          ? 'border-2 border-primary bg-[#FFF5F5] text-primary'
                          : 'border-border-light bg-white text-secondary hover:border-primary hover:text-primary'
                      }`}
                      onClick={() => setPaymentTarget(pay === 'Others' ? '' : pay)}
                    >
                      {pay}
                    </button>
                  );
                })}
              </div>
              {!["30/70 Standard", "100% Net 30", "LC (Letter of Credit)", "Pay on Arrival"].includes(paymentTarget) && (
                 <div className="mt-3 animate-fade-in">
                    <input 
                      type="text"
                      className="w-full h-11 px-4 border border-primary rounded-xl focus:ring-1 focus:ring-primary outline-none text-sm font-medium"
                      placeholder="Specify your payment term... / 指定支付条款..."
                      value={paymentTarget}
                      onChange={(e) => setPaymentTarget(e.target.value)}
                      autoFocus
                    />
                 </div>
              )}
            </div>

            {/* Urgency */}
            <div className="flex flex-col gap-stack-sm pt-4">
              <div className="flex justify-between items-end">
                <label className="font-subhead-sm text-on-surface font-semibold text-sm mb-1">Urgency Level / 紧急程度</label>
                <span className="text-primary font-bold text-sm animate-pulse">{urgencyLevels[urgency - 1]}</span>
              </div>
              <input
                className="w-full h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
                type="range"
                max={5}
                min={1}
                value={urgency}
                onChange={(e) => setUrgency(Number(e.target.value))}
              />
              <div className="flex justify-between text-[11px] text-subtitle-grey px-1">
                <span>Low / Relaxed</span>
                <span>High / Urgent</span>
              </div>
            </div>

            {/* Additional notes */}
            <div className="flex flex-col gap-stack-sm pt-4">
              <label className="font-subhead-sm text-on-surface font-semibold text-sm mb-1">Additional Instructions / 附加说明</label>
              <textarea
                className="w-full h-32 p-stack-md rounded-xl border border-border-light focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none text-sm bg-white"
                placeholder="Mention any specific quality standards, previous issues, or personal Guanxi nuances..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              ></textarea>
            </div>
          </div>

          {/* Side Strategy Preview bar */}
          <div className="md:col-span-4 flex flex-col gap-stack-md">
            <div className="sticky top-24 p-stack-md rounded-2xl border border-border-light bg-white shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <img
                    alt="Rui Mascot"
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 object-contain"
                    src={resolveStorageUrl("https://i.ibb.co.com/ZZ9rMnb/1.png")}
                  />
                </div>
                <div>
                  <p className="font-bold text-on-surface leading-tight text-sm">Rui Strategy Preview</p>
                  <p className="text-xs text-subtitle-grey">AI Negotiator Assistant</p>
                </div>
              </div>

              <div className="p-3 bg-surface-muted rounded-xl border-l-4 border-l-primary italic text-[12px] text-on-secondary-container leading-relaxed">
                "Based on your '{goal.split(' / ')[0]}' goal and '{urgencyLevels[urgency-1]}' urgency, I will draft an inquiry that emphasizes high-volume potential while politely questioning their current MOQ baseline. I'll maintain a professional yet firm tone to establish your authority early."
              </div>

              <div className="border-t border-border-light pt-4">
                <p className="text-[11px] font-bold text-subtitle-grey mb-3 uppercase tracking-wider">Projected Outcomes</p>
                <ul className="flex flex-col gap-2">
                  <li className="flex items-center gap-2 text-xs text-on-surface">
                    <span className="material-symbols-outlined text-green-600 text-[16px]">trending_down</span>
                    8-12% expected price reduction
                  </li>
                  <li className="flex items-center gap-2 text-xs text-on-surface">
                    <span className="material-symbols-outlined text-blue-600 text-[16px]">airport_shuttle</span>
                    Lead time stays within 25 days
                  </li>
                  <li className={`flex items-center gap-2 text-xs ${goal === 'Lowest Price / 最低价格' ? 'text-on-surface/50 line-through' : 'text-on-surface'}`}>
                    <span className="material-symbols-outlined text-[16px] text-gray-500">verified</span>
                    Quality assurance certifications
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Actions */}
        <div className="flex justify-between items-center py-stack-lg border-t border-border-light mt-stack-lg">
          <button
            onClick={() => onNavigate('wizard-step2')}
            disabled={isFinishing}
            className={`text-secondary hover:text-on-surface font-bold flex items-center gap-2 transition-colors cursor-pointer text-sm ${isFinishing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back / 返回
          </button>
          <button
            onClick={handleFinishWizard}
            disabled={isFinishing}
            className={`bg-primary text-white px-8 py-4 rounded-full font-bold shadow-lg hover:bg-primary-container transition-all flex items-center gap-3 cursor-pointer text-sm ${
              isFinishing ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isFinishing ? (
              <>
                Creating Supplier...
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              </>
            ) : (
              <>
                Create Supplier &amp; Start Negotiating
                <span className="material-symbols-outlined">rocket_launch</span>
              </>
            )}
          </button>
        </div>
      </main>

      <footer className="fixed bottom-8 right-8 w-20 z-40 flex flex-col items-center pointer-events-none hidden lg:block">
        <span className="font-display-lg text-primary opacity-20 text-[24px] whitespace-nowrap font-black">YORA 永睿</span>
      </footer>
    </div>
  );
}

export function SupplierAddedScreen({ onNavigate, addedSupplier }: WizardProps) {
  const supplierName = addedSupplier?.englishName || "New Supplier";
  
  return (
    <div className="min-h-screen flex items-center justify-center p-6 antialiased selection:bg-yora-red/10 overflow-hidden relative">
      {/* Background Graphic elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-50"></div>
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px]"></div>
      </div>

      <div className="max-w-[540px] w-full text-center relative z-10">
        {/* Modern Animated Icon Stack */}
        <div className="relative mb-12 flex justify-center perspective-1000">
          <div className="absolute w-48 h-48 bg-primary/5 rounded-full scale-[1.5] blur-3xl animate-pulse"></div>
          
          <div className="relative z-10 flex items-center justify-center">
            {/* The Main Success Hexagon/Shield */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-56 h-56 flex items-center justify-center relative"
            >
               <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl"></div>
               <motion.img 
                 initial={{ opacity: 0, scale: 0.6, rotate: 10 }}
                 animate={{ 
                   opacity: 1, 
                   scale: 1, 
                   rotate: 0,
                   y: [0, -8, 0] 
                 }}
                 transition={{ 
                   opacity: { duration: 0.4, ease: "easeOut" },
                   scale: { duration: 0.5, ease: "backOut" },
                   rotate: { duration: 0.5, ease: "easeOut" },
                   y: { repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.5 }
                 }}
                 src={resolveStorageUrl("https://i.ibb.co.com/SXbG0Hd9/RUI-APPROVE-BUSINESS.png")} 
                 alt="Rui Mascot" 
                 className="w-48 h-48 object-contain relative z-10" 
               />
            </motion.div>
            
            {/* Secondary element representing Data/Sync */}
            <div className="absolute -bottom-2 -left-4 w-12 h-12 bg-surface-container-highest border border-white rounded-2xl flex items-center justify-center shadow-md rotate-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <span className="material-symbols-outlined text-secondary text-xl">database</span>
            </div>
            <div className="absolute -top-2 -right-2 w-10 h-10 bg-on-primary-container border border-white rounded-2xl flex items-center justify-center shadow-md -rotate-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <span className="material-symbols-outlined text-primary text-lg">bolt</span>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-[40px] md:text-[48px] font-black tracking-tight text-charcoal leading-[0.95]">
              Supplier <br />
              <span className="text-primary relative inline-block">
                Synchronized
                <svg className="absolute -bottom-2 left-0 w-full h-2 text-primary/20" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 25 0, 50 5 T 100 5" fill="none" stroke="currentColor" strokeWidth="4" />
                </svg>
              </span>
            </h2>
            <p className="text-secondary font-medium px-4 md:px-12 mt-6 text-sm md:text-base leading-relaxed">
              <span className="text-charcoal font-bold">{supplierName}</span> is now fully integrated into your negotiation portfolio. Rui has analyzed your targets and established the initial strategy.
            </p>
          </div>

          <div className="flex flex-col gap-4 pt-10 px-8">
            <button
              onClick={() => onNavigate('negotiation-room', { supplierId: addedSupplier?.id })}
              className="w-full bg-primary text-white font-sans font-bold py-5 rounded-2xl hover:opacity-90 transition-all active:scale-[0.98] shadow-2xl shadow-primary/25 flex items-center justify-center gap-3 group text-sm uppercase tracking-[0.2em]"
            >
              Enter Negotiation Room
              <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
            
            <button
              onClick={() => onNavigate('dashboard-active')}
              className="w-full bg-transparent border border-border-light text-secondary font-sans font-bold py-4 rounded-xl hover:bg-surface-muted transition-all flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest"
            >
              Back to Portfolio
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="mt-16 flex justify-center gap-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 border border-green-100 rounded-full">
             <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
             <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Sync Active</span>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/5 border border-primary/10 rounded-full">
             <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Target calibrated</span>
          </div>
        </div>

        <p className="mt-12 text-[10px] text-subtitle-grey font-medium italic opacity-50 max-w-xs mx-auto">
          "The negotiation engine is ready. Leverage confirmed against target CNY values."
        </p>
      </div>
    </div>
  );
}
