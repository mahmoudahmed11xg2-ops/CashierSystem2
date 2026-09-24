// ============================================================
//  Shift Report & Telegram Excel Integration Service
//  توليد تقرير إقفال الوردية بصيغة Excel وإرساله لبوت التيليجرام
// ============================================================

import * as XLSX from 'xlsx';
import DataService from './dataService.js';

export const ShiftReportService = {
  // تجميع كافة بيانات الوردية بدقة شاملة
  compileShiftData: (activeShift, actualDrawer, closedAtDate = new Date()) => {
    const orders = DataService.get('orders') || JSON.parse(localStorage.getItem('cs_orders') || '[]');
    const expenses = DataService.get('expenses') || JSON.parse(localStorage.getItem('cs_expenses') || '[]');
    const guardLogs = DataService.get('guardLogs') || JSON.parse(localStorage.getItem('cs_guard_logs') || '[]');
    const recipes = DataService.get('recipes') || JSON.parse(localStorage.getItem('cs_recipes') || '[]');
    const stock = DataService.get('stock') || JSON.parse(localStorage.getItem('cs_stock') || '[]');
    const categories = DataService.get('categories') || JSON.parse(localStorage.getItem('cs_cats') || '[]');

    const startTime = activeShift?.openedAtRaw ? new Date(activeShift.openedAtRaw) : new Date(Date.now() - 8 * 3600 * 1000);
    const endTime = closedAtDate;

    // حساب مدة الوردية
    const durationMs = Math.max(0, endTime.getTime() - startTime.getTime());
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const durationStr = `${durationHours} ساعة و ${durationMinutes} دقيقة`;

    // تصفية الفواتير والمصروفات التابعة للوردية الحالية
    const shiftOrders = orders.filter(o => {
      const t = new Date(o.createdAt || o.date || 0);
      return t >= startTime && t <= endTime;
    });

    const shiftExpenses = expenses.filter(e => {
      const t = new Date(e.createdAt || e.date || 0);
      return t >= startTime && t <= endTime;
    });

    // تسجيلات الدخول وأنشطة المستخدمين أثناء الوردية
    const shiftLogs = guardLogs.filter(l => {
      const t = new Date(l.timestamp || 0);
      return t >= startTime && t <= endTime;
    });

    const logins = shiftLogs.filter(l => (l.action || '').includes('دخول') || (l.details || '').includes('دخول') || l.action === 'LOGIN');
    const uniqueUsersLoggedIn = Array.from(new Set(shiftLogs.map(l => l.user || 'مستخدم'))).filter(Boolean);

    // الحسابات المالية للدرج
    const openingBalance = parseFloat(activeShift?.openingBalance) || 0;
    const cashSales = shiftOrders.filter(o => o.payMethod === 'cash').reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const nonCashSales = shiftOrders.filter(o => o.payMethod !== 'cash').reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const totalSales = cashSales + nonCashSales;
    const totalExpenses = shiftExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const expectedDrawer = openingBalance + cashSales - totalExpenses;
    const diff = (parseFloat(actualDrawer) || 0) - expectedDrawer;

    // استهلاك المواد الخام من المخزون
    const consumedStockMap = {};
    shiftOrders.forEach(o => {
      (o.items || []).forEach(it => {
        const itemQty = parseFloat(it.qty) || 1;
        const rec = recipes.find(r => r.menuId == (it.itemId || it.id));
        if (rec && rec.ingredients) {
          rec.ingredients.forEach(ing => {
            const sId = ing.stockId;
            const raw = stock.find(s => s.id == sId);
            const rawName = raw ? raw.name : ing.name;
            const rawUnit = raw ? raw.unit : ing.unit;
            const rawCost = raw ? (parseFloat(raw.cost) || 0) : 0;
            const consumed = (parseFloat(ing.qty) || 0) * itemQty;

            if (!consumedStockMap[sId]) {
              consumedStockMap[sId] = {
                name: rawName,
                unit: rawUnit,
                qty: 0,
                unitCost: rawCost,
                totalCost: 0
              };
            }
            consumedStockMap[sId].qty += consumed;
            consumedStockMap[sId].totalCost += consumed * rawCost;
          });
        }
      });
    });

    const consumedStockList = Object.values(consumedStockMap);

    // مبيعات الأصناف (الكميات المباعة)
    const itemsSoldMap = {};
    shiftOrders.forEach(o => {
      (o.items || []).forEach(it => {
        const key = it.name;
        if (!itemsSoldMap[key]) {
          itemsSoldMap[key] = {
            name: it.name,
            qty: 0,
            price: parseFloat(it.price) || 0,
            total: 0
          };
        }
        const q = parseFloat(it.qty) || 1;
        itemsSoldMap[key].qty += q;
        itemsSoldMap[key].total += q * (parseFloat(it.price) || 0);
      });
    });

    const itemsSoldList = Object.values(itemsSoldMap).sort((a, b) => b.qty - a.qty);

    return {
      activeShift,
      cashierName: activeShift?.cashierName || 'كاشير المناوبة',
      openedAt: activeShift?.openedAt || startTime.toLocaleString('ar-EG'),
      closedAt: endTime.toLocaleString('ar-EG'),
      durationStr,
      openingBalance,
      cashSales,
      nonCashSales,
      totalSales,
      totalExpenses,
      expectedDrawer,
      actualDrawer: parseFloat(actualDrawer) || 0,
      diff,
      ordersCount: shiftOrders.length,
      shiftOrders,
      shiftExpenses,
      consumedStockList,
      itemsSoldList,
      shiftLogs,
      loginsCount: logins.length || 1,
      uniqueUsersLoggedIn
    };
  },

  // إنشاء مصنف Excel شامل من البيانات
  generateExcelWorkbook: (report) => {
    const wb = XLSX.utils.book_new();

    // 1. ورقة العمل الأولى: الملخص العام والدرج
    const diffStatus = report.diff === 0 ? 'مطابق تماماً' : (report.diff > 0 ? `زيادة (+${report.diff.toLocaleString('ar-EG')} ج)` : `عجز (${report.diff.toLocaleString('ar-EG')} ج)`);

    const summaryRows = [
      ['تقرير إقفال الوردية المالية الشامل', ''],
      ['تاريخ وتوقيت التقرير', new Date().toLocaleString('ar-EG')],
      ['', ''],
      ['المسؤول عن الوردية (الكاشير)', report.cashierName],
      ['وقت فتح الوردية', report.openedAt],
      ['وقت إغلاق الوردية', report.closedAt],
      ['مدة بقاء الكاشير والعمل (الوردية)', report.durationStr],
      ['عدد المستخدمين المسجلين بالنظام', `${report.uniqueUsersLoggedIn.length} مستخدمين (${report.uniqueUsersLoggedIn.join(' - ')})`],
      ['عدد عمليات تسجيل الدخول المسجلة', report.loginsCount],
      ['', ''],
      ['--- ملخص الخزينة والدرج ---', ''],
      ['رصيد افتتاح الدرج (الفكة)', report.openingBalance],
      ['مبيعات النقدية (الكاش)', report.cashSales],
      ['مبيعات الفيزا والتحويلات', report.nonCashSales],
      ['إجمالي مبيعات الوردية الكلي', report.totalSales],
      ['المصروفات المنصرفة من الدرج', report.totalExpenses],
      ['النقدية المحسوبة والمتوقعة بالدرج', report.expectedDrawer],
      ['النقدية الفعلية بعد الجرد باليد', report.actualDrawer],
      ['الفارق الحسابي (عجز / زيادة)', report.diff],
      ['حالة الدرج النهائية', diffStatus],
      ['إجمالي عدد الفواتير المنجزة', report.ordersCount]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 38 }, { wch: 42 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'الملخص والدرج');

    // 2. ورقة العمل الثانية: تفاصيل المصروفات وسندات الصرف
    const expenseRows = [
      ['كود السند', 'تاريخ ووقت الصرف', 'بند المصروف', 'المبلغ (جنيه)', 'المدفوع له', 'المسؤول / الكاشير', 'ملاحظات وبيان الصرف']
    ];
    report.shiftExpenses.forEach(exp => {
      expenseRows.push([
        exp.id || '—',
        exp.date || exp.time || '—',
        exp.category || 'مصروف عام',
        parseFloat(exp.amount) || 0,
        exp.recipient || exp.supplierName || '—',
        exp.user || report.cashierName,
        exp.note || exp.details || '—'
      ]);
    });
    const wsExpenses = XLSX.utils.aoa_to_sheet(expenseRows);
    wsExpenses['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 22 }, { wch: 15 }, { wch: 22 }, { wch: 20 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'المصروفات');

    // 3. ورقة العمل الثالثة: استهلاك المواد الخام من المخزون
    const stockRows = [
      ['اسم المادة الخام', 'الوحدة', 'الكمية المستهلكة بالوردية', 'تكلفة الوحدة (ج)', 'إجمالي تكلفة الاستهلاك (ج)']
    ];
    let totalStockConsumptionCost = 0;
    report.consumedStockList.forEach(raw => {
      totalStockConsumptionCost += raw.totalCost;
      stockRows.push([
        raw.name,
        raw.unit,
        Number(raw.qty.toFixed(3)),
        raw.unitCost,
        Number(raw.totalCost.toFixed(2))
      ]);
    });
    stockRows.push(['الإجمالي', '', '', '', Number(totalStockConsumptionCost.toFixed(2))]);

    const wsStock = XLSX.utils.aoa_to_sheet(stockRows);
    wsStock['!cols'] = [{ wch: 32 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsStock, 'استهلاك المواد الخام');

    // 4. ورقة العمل الرابعة: مبيعات الأصناف والوجبات
    const itemsRows = [
      ['اسم الصنف / الوجبة', 'الكمية المباعة', 'سعر البيع (ج)', 'إجمالي القيمة (ج)']
    ];
    report.itemsSoldList.forEach(it => {
      itemsRows.push([
        it.name,
        it.qty,
        it.price,
        it.total
      ]);
    });
    const wsItems = XLSX.utils.aoa_to_sheet(itemsRows);
    wsItems['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsItems, 'مبيعات الأصناف');

    // 5. ورقة العمل الخامسة: سجل الفواتير بالتفصيل
    const ordersRows = [
      ['رقم الفاتورة', 'الوقت', 'النوع', 'الطاولة / العميل', 'المجموع الفرعي', 'الخصم', 'الإجمالي', 'طريقة السداد', 'الكاشير']
    ];
    report.shiftOrders.forEach(o => {
      ordersRows.push([
        o.id,
        o.time || '—',
        o.type || 'صالة',
        o.tableLabel || o.customer || '—',
        o.subtotal || 0,
        o.discount || 0,
        o.total || 0,
        o.payMethod || 'كاش',
        o.cashier || report.cashierName
      ]);
    });
    const wsOrders = XLSX.utils.aoa_to_sheet(ordersRows);
    wsOrders['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsOrders, 'سجل الفواتير');

    // 6. ورقة العمل السادسة: سجل نشاط المستخدمين وعمليات الدخول
    const logsRows = [
      ['التوقيت', 'اسم المستخدم', 'الدور / الصلاحية', 'نوع النشاط والعملية', 'تفاصيل إضافية']
    ];
    (report.shiftLogs || []).forEach(l => {
      logsRows.push([
        l.timestamp ? new Date(l.timestamp).toLocaleString('ar-EG') : '—',
        l.user || '—',
        l.role || '—',
        l.action || '—',
        l.details || '—'
      ]);
    });
    const wsLogs = XLSX.utils.aoa_to_sheet(logsRows);
    wsLogs['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 25 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsLogs, 'سجل الدخول والرقابة');

    return wb;
  },

  // مواءمة واستدعاء سريع لبناء بيانات الوردية
  buildShiftData: (params) => {
    const activeShift = params?.activeShift || DataService.get('activeShift') || JSON.parse(localStorage.getItem('cs_active_shift') || 'null');
    const actualDrawer = params?.closedRecord?.actualDrawer || params?.actualDrawer || 0;
    return ShiftReportService.compileShiftData(activeShift, actualDrawer);
  },

  // تنزيل ملف Excel في جهاز المستخدم فوراً (يقبل إما كائن التقرير أو كائن المصنف)
  downloadExcelLocally: (workbookOrReport, filename) => {
    try {
      let wb = workbookOrReport;
      if (workbookOrReport && !workbookOrReport.Sheets) {
        wb = ShiftReportService.generateExcelWorkbook(workbookOrReport);
      }
      const fname = filename || `Shift_Report_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fname);
      return true;
    } catch (e) {
      console.error('Local Excel download failed:', e);
      return false;
    }
  },

  // دالة مساعدة لاستخراج وتنقية قائمة معرفات التيليجرام
  parseChatIds: (input) => {
    if (!input) return [];
    let list = [];
    if (Array.isArray(input)) {
      list = input.map(x => String(x).trim()).filter(Boolean);
    } else if (typeof input === 'string') {
      list = input.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
    }
    return [...new Set(list)];
  },

  // جلب كافة معرفات التيليجرام المحفوظة بالإعدادات
  getConfiguredChatIds: (customIds) => {
    if (customIds) {
      const parsed = ShiftReportService.parseChatIds(customIds);
      if (parsed.length > 0) return parsed;
    }
    const config = DataService.get('storeConfig') || JSON.parse(localStorage.getItem('cs_configs') || '{}');
    const fromConfig = config.telegramChatIds || config.telegramChatId || '1724117996';
    const res = ShiftReportService.parseChatIds(fromConfig);
    return res.length > 0 ? res : ['1724117996'];
  },

  // إرسال التقرير وملف Excel إلى بوت تيليجرام (يدعم عدة أشخاص ومجموعات)
  sendToTelegramBot: async (report, workbook) => {
    const config = DataService.get('storeConfig') || JSON.parse(localStorage.getItem('cs_configs') || '{}');
    const botToken = config.telegramBotToken || '8864429923:AAFUW-7EV7xkxR0jFIizs9Oc4hPUnG8HeEs';
    const chatIds = ShiftReportService.getConfiguredChatIds();

    const wb = workbook || ShiftReportService.generateExcelWorkbook(report);

    // إعداد نص الرسالة المنسق لتلخيص الوردية في تيليجرام
    const diffEmoji = report.diff === 0 ? '✅' : (report.diff > 0 ? '🟢' : '🔴');
    const diffText = report.diff === 0 ? 'الدرج متطابق تماماً بدون عجز' : (report.diff > 0 ? `زيادة قدرها +${report.diff} جنيه` : `عجز قدره ${report.diff} جنيه`);

    const caption = `
📊 *تقرير إقفال الوردية اليومية (شامل ملف Excel)*
━━━━━━━━━━━━━━━━━━
👤 *الكاشير المسؤول:* ${report.cashierName}
⏱️ *وقت الفتح:* ${report.openedAt}
⏱️ *وقت الإغلاق:* ${report.closedAt}
⏳ *مدة عمل الوردية:* ${report.durationStr}
👥 *المستخدمين بالسيستم:* ${report.uniqueUsersLoggedIn.join(', ')} (عدد الدخول: ${report.loginsCount})

💰 *البيانات المالية للدرج والخزينة:*
• رصيد بداية الدرج (الفكة): *${report.openingBalance.toLocaleString('ar-EG')} ج*
• مبيعات الكاش (النقدي): *${report.cashSales.toLocaleString('ar-EG')} ج*
• مبيعات الفيزا والتحويلات: *${report.nonCashSales.toLocaleString('ar-EG')} ج*
• إجمالي المبيعات الكلي: *${report.totalSales.toLocaleString('ar-EG')} ج*
• المصروفات المسحوبة من الدرج: *${report.totalExpenses.toLocaleString('ar-EG')} ج*
• عدد الفواتير المنجزة: *${report.ordersCount} فاتورة*

💵 *المطابقة والجرد النهائي للدرج:*
• النقدية المتوقعة حسابياً: *${report.expectedDrawer.toLocaleString('ar-EG')} ج*
• النقدية الفعلية بعد الجرد باليد: *${report.actualDrawer.toLocaleString('ar-EG')} ج*
• الفارق (عجز / زيادة): ${diffEmoji} *${diffText}*
━━━━━━━━━━━━━━━━━━
📎 *مرفق ملف Excel تفصيلي بكامل المصروفات، واستهلاك المواد الخام بالمخزن، وحركة الفواتير.*
    `.trim();

    // توليد ملف Excel كـ Base64 لنقله للسيرفر أو رفعه لتيليجرام
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const fileName = `Shift_Report_${report.cashierName || 'Cashier'}_${new Date().toISOString().split('T')[0]}.xlsx`;

    try {
      // إرسال الطلب إلى السيرفر ليقوم بالتواصل مع Telegram Bot API لكافة المعرفات
      const res = await fetch('/api/telegram/send-shift-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: botToken,
          chatIds: chatIds,
          chatId: chatIds[0] || '',
          caption: caption,
          fileName: fileName,
          fileBase64: wbout,
          reportSummary: {
            cashier: report.cashierName,
            totalSales: report.totalSales,
            expectedDrawer: report.expectedDrawer,
            actualDrawer: report.actualDrawer,
            diff: report.diff
          }
        })
      });

      const data = await res.json();
      return {
        success: !!data.ok,
        sentCount: data.sentCount || (data.ok ? chatIds.length : 0),
        totalCount: chatIds.length,
        ...data
      };
    } catch (err) {
      console.warn('Backend Telegram relay error, trying direct fetch fallback:', err);
      // Fallback: If client can directly reach Telegram and token exists
      if (botToken && chatIds.length > 0) {
        const results = [];
        for (const targetId of chatIds) {
          try {
            const directRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: targetId,
                text: caption,
                parse_mode: 'Markdown'
              })
            });
            const dData = await directRes.json();
            results.push({ chatId: targetId, ok: !!dData.ok, data: dData });
          } catch (e) {
            results.push({ chatId: targetId, ok: false, error: e.message });
          }
        }
        const sentCount = results.filter(r => r.ok).length;
        return {
          success: sentCount > 0,
          ok: sentCount > 0,
          sentCount,
          totalCount: chatIds.length,
          results
        };
      }
      return { success: false, ok: false, error: err.message };
    }
  },

  // دالة مواءمة مختصرة لإرسال تقرير الوردية للتيليجرام
  sendShiftReportToTelegram: async (report) => {
    const wb = ShiftReportService.generateExcelWorkbook(report);
    return await ShiftReportService.sendToTelegramBot(report, wb);
  },

  // اختبار الاتصال بالبوت وإرسال رسالة تجريبية لكافة المعرفات المدخلة
  testTelegramBot: async (token, rawChatIds) => {
    const t = token || '8864429923:AAFUW-7EV7xkxR0jFIizs9Oc4hPUnG8HeEs';
    const ids = ShiftReportService.getConfiguredChatIds(rawChatIds);

    const testMsg = `🔔 *رسالة اختبار اتصال بوت التيليجرام من نظام الكاشير*\n\nتم التحقق من صحة التوكن ومعرفات المحادثة (${ids.length} مستلم) بنجاح ✅\nجاهز لاستقبال ملفات إكسيل تقارير إقفال الورديات اليومية والمصروفات وجرد الدرج!`;

    const res = await fetch('/api/telegram/send-shift-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: t,
        chatIds: ids,
        caption: testMsg
      })
    });
    return await res.json();
  }
};

export default ShiftReportService;
