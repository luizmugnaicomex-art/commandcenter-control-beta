export type Language = 'en' | 'zh';

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav & Header
    dashboard: 'Dashboard & Analytics',
    kanban: 'Yard Management (Kanban)',
    loading: 'Loading Panel (Table & KPIs)',
    masterPlan: 'Master Plan & Schedule',
    report: 'Audit Report (Finished)',
    switchToCarrier: 'Switch to Carrier View',
    switchToCoordinator: 'Switch to Coordinator View',
    carrierMenu: 'Carrier Menu',
    bookAndBookings: 'Book & My Bookings',
    logOut: 'Log Out',
    liveProduction: 'Live Production',
    enterpriseYms: 'Enterprise YMS',
    carrierPortalTitle: 'Carrier Booking Portal',
    
    // Statuses & Columns
    queue: 'Awaiting / Queue',
    inTransitCol: 'In Transit',
    physicalLineCol: 'Physical Line',
    activeYardCol: 'Active Yard',
    finishedCol: 'Finished',
    awaitingCall: 'Awaiting Call',
    inTransit: 'Called / In Transit',
    physicalLine: 'Physical Line',
    inYard: 'Active Yard',
    operated: 'Finished',
    noShow: 'No Show',
    
    // Actions & Buttons
    callTruck: 'Call Truck',
    gateIn: 'Gate-In',
    gateOut: 'Gate-Out',
    finishOperation: 'Finish Operation',
    returnToYard: 'Return to Active Yard',
    noShowBtn: 'No Show',
    specialWindow: 'Create Special Window',
    revert: 'Revert',
    driverOnTheWay: 'Driver is On the Way',
    reschedule: 'Reschedule',
    edit: 'Edit',
    bookSlot: 'Book Time Slot',
    searchContainer: 'Search Container ID...',
    today: 'Today',
    prevDay: 'Prev Day',
    nextDay: 'Next Day',
    languageToggle: '中文 (简体)',
  },
  zh: {
    // Nav & Header
    dashboard: '仪表盘与分析',
    kanban: '堆场管理 (看板)',
    loading: '装货面板 (表格与指标)',
    masterPlan: '总计划与排程',
    report: '审计报告 (已完成)',
    switchToCarrier: '切换至承运商视图',
    switchToCoordinator: '切换至调度员视图',
    carrierMenu: '承运商菜单',
    bookAndBookings: '预约与我的预约',
    logOut: '退出登录',
    liveProduction: '实时生产',
    enterpriseYms: '企业级堆场管理系统',
    carrierPortalTitle: '承运商预约门户',
    
    // Statuses & Columns
    queue: '等待 / 队列',
    inTransitCol: '在途中',
    physicalLineCol: '物理排队',
    activeYardCol: '活跃堆场',
    finishedCol: '已完成',
    awaitingCall: '等待呼叫',
    inTransit: '已呼叫/在途中',
    physicalLine: '物理排队',
    inYard: '作业堆场',
    operated: '已完成',
    noShow: '未到场 (No Show)',
    
    // Actions & Buttons
    callTruck: '呼叫卡车',
    gateIn: '入闸 (Gate-In)',
    gateOut: '出闸 (Gate-Out)',
    finishOperation: '完成作业',
    returnToYard: '返回活跃堆场',
    noShowBtn: '未到场',
    specialWindow: '创建特殊窗口',
    revert: '撤销',
    driverOnTheWay: '司机在途中',
    reschedule: '重新预约',
    edit: '编辑',
    bookSlot: '预约时间段',
    searchContainer: '搜索集装箱编号...',
    today: '今天',
    prevDay: '前一天',
    nextDay: '后一天',
    languageToggle: 'English',
  }
};

export function t(key: string, lang: Language): string {
  return translations[lang]?.[key] || translations['en'][key] || key;
}
