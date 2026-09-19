// Ported from index.html's AR/EN admin dictionaries.
export const AR = {
  tPanel: 'لوحة التحكم', tVersion: 'الإصدار',
  tEditAcc: 'تعديل الحساب', tFullName: 'الاسم الكامل', tPhone: 'رقم الهاتف', tEmail: 'البريد الإلكتروني', tUsername: 'اسم المستخدم',
  tPlate: 'رقم اللوحة', tCarType: 'نوع السيارة', tStatusC: 'الحالة:', tSaveEdits: 'حفظ التعديلات', tForceLogout: 'إيقاف الحساب فوراً',
  tSaveAcc: 'حفظ الحساب', tEdit: 'تعديل', tMsg: 'رسالة', tDelete: 'حذف',
  tAccepted: 'وافق', tRejected: 'رفض', tRate: 'القبول',
  tAvailNow: 'متاح الآن:', tNoAvail: 'لا يوجد سائق متصل حالياً.', tDisconnect: 'فصل الاتصال',
  tAddPlace: 'إضافة مكان أو شارع', tSavePlace: 'حفظ المكان',
  tSendMsg: 'إرسال رسالة', tSend: 'إرسال', tMsgLog: 'سجل الرسائل',
  tCreateAd: 'إنشاء إعلان', tPublishAd: 'نشر الإعلان', tAds: 'الإعلانات',
  tAdminAcc: 'حساب الأدمن', tNewPass: 'كلمة المرور الجديدة', tSaveChanges: 'حفظ التغييرات',
  navUsers: 'المستخدمون', navDrivers: 'السائقون', navAvailable: 'المتاحون الآن', navSales: 'المبيعات', navRatings: 'التقييمات',
  navPlaces: 'الأماكن والشوارع', navPricing: 'التسعيرة', navMessages: 'الرسائل', navAds: 'الإعلانات', navSettings: 'الإعدادات',
  ttlUsers: 'إدارة المستخدمين', ttlDrivers: 'إدارة السائقين', ttlAvailable: 'السائقون المتاحون الآن', ttlSales: 'المبيعات والأرباح', ttlRatings: 'تقييمات الركاب',
  ttlPlaces: 'الأماكن والشوارع', ttlPricing: 'التسعيرة والعملة', ttlMessages: 'الرسائل والإشعارات', ttlAds: 'إنشاء إعلان', ttlSettings: 'الإعدادات',
  addUser: '+ إضافة مستخدم', addDriver: '+ إضافة سائق', close: '× إغلاق',
  stActive: 'نشط', stSuspended: 'موقوف', stPending: 'قيد المراجعة', stOnline: 'متصل', stApprove: 'قبول', stApproved: 'مقبول',
  stSuspend: 'إيقاف', stResume: 'استئناف',
  audAll: 'الجميع', audUsers: 'كل المستخدمين', audDrivers: 'كل السائقين', audOne: 'شخص محدد',
  langLabel: 'العربية', search: 'بحث بالاسم أو الهاتف', save: 'حفظ', cancel: 'إلغاء', logout: 'تسجيل الخروج'
};

export const EN = {
  tPanel: 'Dashboard', tVersion: 'Version',
  tEditAcc: 'Edit account', tFullName: 'Full name', tPhone: 'Phone number', tEmail: 'Email', tUsername: 'Username',
  tPlate: 'Plate number', tCarType: 'Car type', tStatusC: 'Status:', tSaveEdits: 'Save changes', tForceLogout: 'Force offline now',
  tSaveAcc: 'Save account', tEdit: 'Edit', tMsg: 'Message', tDelete: 'Delete',
  tAccepted: 'Accepted', tRejected: 'Declined', tRate: 'Rate',
  tAvailNow: 'Available now:', tNoAvail: 'No driver is online right now.', tDisconnect: 'Force offline',
  tAddPlace: 'Add a place or street', tSavePlace: 'Save place',
  tSendMsg: 'Send a message', tSend: 'Send', tMsgLog: 'Message log',
  tCreateAd: 'Create announcement', tPublishAd: 'Publish', tAds: 'Announcements',
  tAdminAcc: 'Admin account', tNewPass: 'New password', tSaveChanges: 'Save changes',
  navUsers: 'Riders', navDrivers: 'Drivers', navAvailable: 'Available now', navSales: 'Sales', navRatings: 'Ratings',
  navPlaces: 'Places & streets', navPricing: 'Pricing', navMessages: 'Messages', navAds: 'Announcements', navSettings: 'Settings',
  ttlUsers: 'Rider management', ttlDrivers: 'Driver management', ttlAvailable: 'Drivers available now', ttlSales: 'Sales & earnings', ttlRatings: 'Rider ratings',
  ttlPlaces: 'Places & streets', ttlPricing: 'Fare & currency', ttlMessages: 'Messages & notifications', ttlAds: 'Create announcement', ttlSettings: 'Settings',
  addUser: '+ Add rider', addDriver: '+ Add driver', close: '× Close',
  stActive: 'Active', stSuspended: 'Suspended', stPending: 'Pending', stOnline: 'Online', stApprove: 'Approve', stApproved: 'Approved',
  stSuspend: 'Suspend', stResume: 'Resume',
  audAll: 'Everyone', audUsers: 'All riders', audDrivers: 'All drivers', audOne: 'Specific person',
  langLabel: 'English', search: 'Search by name or phone', save: 'Save', cancel: 'Cancel', logout: 'Sign out'
};

export type Lang = 'ar' | 'en';
export type Strings = typeof AR;
