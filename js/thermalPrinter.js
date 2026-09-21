// ============================================================
//  Thermal Printer Service — محرك طباعة الفواتير الحرارية
//  Optimized specifically for Rongta RP336 & 80mm ESC/POS Printers
// ============================================================

import AuthService from '../auth.js';

export const PRINTER_CONFIG_DEFAULT = {
  model: 'Rongta RP336 (80mm)',
  paperWidth: '80mm', // 80mm or 58mm
  autoPrint: 'enabled', // 'enabled' or 'manual'
  fontSize: 'medium', // small, medium, large
  storeName: 'مطعم وكافيه الشرق',
  storePhone: '01000000000 - 01200000000',
  storeAddress: 'شارع النصر الرئيسي - الفرع الأول',
  taxNumber: '123-456-789',
  receiptFooter: 'شكرًا لزيارتكم الكريمة ونسعد بخدمتكم دائمًا!',
  showBarcode: true,
  feedLines: 3
};

export function getPrinterConfig() {
  try {
    const raw = localStorage.getItem('cs_configs');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...PRINTER_CONFIG_DEFAULT, ...parsed };
    }
  } catch (e) {
    console.warn('Error reading printer config:', e);
  }
  return { ...PRINTER_CONFIG_DEFAULT };
}

export function savePrinterConfig(updates) {
  try {
    const current = getPrinterConfig();
    const merged = { ...current, ...updates };
    localStorage.setItem('cs_configs', JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.error('Error saving printer config:', e);
    return null;
  }
}

// إنشاء باركود مبسط عالي التباين لرقم الفاتورة (Code-128 SVG)
function generateBarcodeSVG(code) {
  const codeStr = String(code).padStart(6, '0');
  let bars = '';
  let x = 10;
  // نمط بصري خطي يحاكي الباركود الحراري
  for (let i = 0; i < codeStr.length; i++) {
    const digit = parseInt(codeStr[i], 10) || 1;
    const w1 = (digit % 3) + 1;
    const w2 = ((digit + 1) % 2) + 1;
    bars += `<rect x="${x}" y="0" width="${w1}" height="38" fill="#000" />`;
    x += w1 + 1;
    bars += `<rect x="${x}" y="0" width="${w2}" height="38" fill="#000" />`;
    x += w2 + 2;
  }
  return `
    <svg viewBox="0 0 ${Math.max(x + 10, 160)} 48" style="width:140px;height:40px;display:block;margin:0 auto;">
      ${bars}
      <text x="50%" y="46" text-anchor="middle" font-size="10" font-family="monospace" fill="#000">INV-${codeStr}</text>
    </svg>
  `;
}

// توليد كود HTML الكامل للفاتورة الحرارية المجهزة بدقة لمقاس 80 مم
export function generateReceiptHTML(invoice, options = {}) {
  const cfg = { ...getPrinterConfig(), ...options };
  const paperWidth = cfg.paperWidth === '58mm' ? '58mm' : '80mm';
  const printableWidth = paperWidth === '58mm' ? '48mm' : '72mm';

  const payLabels = {
    cash: 'كاش (نقدي)',
    card: 'فيزا / بطاقة بنكية',
    transfer: 'تحويل بنكي / محفظة',
    officer: 'أوفيسير (ضيافة إدارة)'
  };

  const typeLabels = {
    dine: 'صالة',
    take: 'تيك أواي (سفري)',
    delivery: 'ديليفري (توصيل منازل)'
  };

  const now = new Date();
  const dateStr = invoice.date || now.toLocaleDateString('ar-EG');
  const timeStr = invoice.time || now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const cashierName = invoice.cashier || (AuthService.getSession()?.fullName) || 'الكاشير';

  // معالجة بنود الأصناف
  const items = invoice.items || [];
  let itemsHtml = '';
  items.forEach(item => {
    const price = parseFloat(item.price) || 0;
    const qty = parseInt(item.qty, 10) || 1;
    const itemTotal = price * qty;
    itemsHtml += `
      <tr class="item-row">
        <td class="col-name">
          <div class="item-name">${item.name || 'صنف'}</div>
          ${item.note ? `<div class="item-note">↳ ${item.note}</div>` : ''}
        </td>
        <td class="col-qty">${qty}</td>
        <td class="col-price">${price.toLocaleString('ar-EG')}</td>
        <td class="col-total">${itemTotal.toLocaleString('ar-EG')}</td>
      </tr>
    `;
  });

  // في حال وجود جولات (Rounds) بطاولات الصالة
  let roundsHtml = '';
  if (invoice.rounds && invoice.rounds.length > 1) {
    roundsHtml = `
      <div class="receipt-section-title">ملخص جولات الطلب (${invoice.rounds.length} Rounds):</div>
      <div class="rounds-box">
        ${invoice.rounds.map(r => `
          <div class="round-line">
            <span>جولة #${r.roundNumber} (${r.time})</span>
            <span>${(r.subtotal || 0).toLocaleString('ar-EG')} ج</span>
          </div>
        `).join('')}
      </div>
      <div class="dashed-line"></div>
    `;
  }

  // حسابات الفاتورة
  const subtotal = parseFloat(invoice.subtotal) || (items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 1), 0));
  const discount = parseFloat(invoice.discount) || 0;
  const total = parseFloat(invoice.total) || Math.max(0, subtotal - discount);

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فاتورة #${invoice.id || 'فاتورة'}</title>
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: 0mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 3mm 4mm;
      width: ${paperWidth};
      max-width: ${paperWidth};
      background: #ffffff;
      color: #000000;
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 12.5px;
      line-height: 1.35;
      font-weight: 500;
      direction: rtl;
    }
    .receipt-container {
      width: 100%;
      margin: 0 auto;
    }
    .header-logo-text {
      text-align: center;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .header-subtitle {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .header-info {
      text-align: center;
      font-size: 11px;
      margin-bottom: 5px;
    }
    .dashed-line {
      border-top: 1.5px dashed #000000;
      margin: 6px 0;
      width: 100%;
    }
    .double-line {
      border-top: 2.5px double #000000;
      margin: 6px 0;
      width: 100%;
    }
    .meta-box {
      font-size: 11.5px;
      margin: 4px 0;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      padding: 1.5px 0;
    }
    .meta-row strong {
      font-weight: 800;
    }
    .order-type-badge {
      display: inline-block;
      border: 1.5px solid #000000;
      padding: 2px 8px;
      font-weight: 900;
      font-size: 13px;
      border-radius: 3px;
      margin: 3px 0;
      text-align: center;
      width: 100%;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 12px;
    }
    table.items-table th {
      border-bottom: 1.5px solid #000000;
      padding: 4px 1px;
      text-align: right;
      font-weight: 800;
      font-size: 11.5px;
    }
    table.items-table td {
      padding: 4px 1px;
      vertical-align: top;
    }
    .col-name { width: 48%; text-align: right; }
    .col-qty { width: 14%; text-align: center; font-weight: 700; }
    .col-price { width: 18%; text-align: left; }
    .col-total { width: 20%; text-align: left; font-weight: 800; }
    .item-name {
      font-weight: 800;
      font-size: 12.5px;
      word-break: break-word;
    }
    .item-note {
      font-size: 10px;
      font-style: italic;
      color: #333;
      margin-top: 1px;
    }
    .summary-box {
      margin: 6px 0;
      font-size: 12px;
    }
    .sum-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .sum-total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 4px;
      margin-top: 4px;
      border: 2px solid #000000;
      font-size: 16px;
      font-weight: 900;
      background: #f8f8f8;
    }
    .rounds-box {
      background: #fafafa;
      padding: 3px 5px;
      border: 1px dashed #666;
      margin: 3px 0;
      font-size: 10.5px;
    }
    .round-line {
      display: flex;
      justify-content: space-between;
      padding: 1px 0;
    }
    .receipt-section-title {
      font-size: 10.5px;
      font-weight: 800;
      margin-top: 3px;
    }
    .footer-box {
      text-align: center;
      margin-top: 8px;
      font-size: 11px;
    }
    .footer-note {
      font-weight: 700;
      margin-bottom: 6px;
    }
    .tear-guide {
      margin-top: 15px;
      padding-top: 8px;
      text-align: center;
      font-size: 9.5px;
      color: #666;
      border-top: 1px dashed #aaa;
    }
    @media screen {
      body {
        max-width: 380px;
        margin: 20px auto;
        border: 1px solid #ccc;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        padding: 15px;
      }
      .no-print-screen {
        display: block;
        margin-bottom: 12px;
        background: #1c69d4;
        color: white;
        text-align: center;
        padding: 10px;
        font-weight: bold;
        border-radius: 4px;
        cursor: pointer;
      }
    }
    @media print {
      .no-print-screen {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header-logo-text">${cfg.storeName}</div>
    <div class="header-subtitle">بون فواتير ومبيعات إلكترونية</div>
    ${cfg.storeAddress ? `<div class="header-info">📍 ${cfg.storeAddress}</div>` : ''}
    ${cfg.storePhone ? `<div class="header-info">📞 ${cfg.storePhone}</div>` : ''}
    ${cfg.taxNumber ? `<div class="header-info">الرقم الضريبي: ${cfg.taxNumber}</div>` : ''}

    <div class="double-line"></div>

    <div class="order-type-badge">
      ${typeLabels[invoice.type] || 'طلب مبيعات'} ${invoice.tableLabel ? `— ${invoice.tableLabel}` : ''}
    </div>

    <div class="meta-box">
      <div class="meta-row">
        <span>رقم الفاتورة:</span>
        <strong>#${invoice.id || '---'}</strong>
      </div>
      <div class="meta-row">
        <span>التاريخ والوقت:</span>
        <span>${dateStr} - ${timeStr}</span>
      </div>
      <div class="meta-row">
        <span>الكاشير:</span>
        <span>${cashierName}</span>
      </div>
      ${invoice.waiter && invoice.waiter !== '—' ? `
        <div class="meta-row">
          <span>الويتر المسؤول:</span>
          <strong>${invoice.waiter}</strong>
        </div>
      ` : ''}
      ${invoice.customer ? `
        <div class="meta-row">
          <span>اسم العميل:</span>
          <strong>${invoice.customer}</strong>
        </div>
      ` : ''}
      ${invoice.customerPhone ? `
        <div class="meta-row">
          <span>هاتف العميل:</span>
          <span>${invoice.customerPhone}</span>
        </div>
      ` : ''}
      ${invoice.dAddr ? `
        <div class="meta-row" style="flex-direction:column;align-items:flex-start;background:#f9f9f9;padding:3px;border-radius:2px;margin:2px 0;">
          <span style="font-weight:bold;">عنوان التوصيل:</span>
          <span>${invoice.dAddr}</span>
        </div>
      ` : ''}
      ${invoice.dCapName ? `
        <div class="meta-row">
          <span>الطيار المسؤول:</span>
          <strong>${invoice.dCapName}</strong>
        </div>
      ` : ''}
    </div>

    <div class="dashed-line"></div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="col-name">الصنف</th>
          <th class="col-qty">العدد</th>
          <th class="col-price">السعر</th>
          <th class="col-total">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="dashed-line"></div>

    ${roundsHtml}

    <div class="summary-box">
      <div class="sum-row">
        <span>المجموع الفرعي:</span>
        <span>${subtotal.toLocaleString('ar-EG')} ج</span>
      </div>
      ${discount > 0 ? `
        <div class="sum-row" style="font-weight:700;">
          <span>الخصم الممنوح:</span>
          <span>- ${discount.toLocaleString('ar-EG')} ج</span>
        </div>
      ` : ''}
      <div class="sum-total-row">
        <span>الإجمالي:</span>
        <span>${total.toLocaleString('ar-EG')} ج</span>
      </div>
      <div class="sum-row" style="margin-top:5px;font-size:11.5px;">
        <span>طريقة السداد:</span>
        <strong>${payLabels[invoice.payMethod] || invoice.payMethod || 'كاش'}</strong>
      </div>
      <div class="sum-row" style="font-size:11.5px;">
        <span>حالة الفاتورة:</span>
        <strong>${invoice.status === 'paid' ? 'مدفوعة بالكامل ✓' : 'معلقة'}</strong>
      </div>
    </div>

    <div class="double-line"></div>

    <div class="footer-box">
      <div class="footer-note">${cfg.receiptFooter}</div>
      ${cfg.showBarcode !== false ? generateBarcodeSVG(invoice.id || Date.now()) : ''}
      <div style="font-size:9.5px;color:#555;margin-top:4px;">نظام إدارة المطاعم والكاشير المتكامل</div>
    </div>

    <div class="tear-guide">
      ✂ - - - - - - - - قاطع الورق الآلي - - - - - - - - ✂
    </div>
  </div>
</body>
</html>
  `;
}

// تنفيذ الطباعة المباشرة عبر iframe خفي (حل موثوق 100% ضد حجب الـ popups)
export function printReceipt(invoice, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const htmlContent = generateReceiptHTML(invoice, options);

      // البحث عن iframe مخصص للطباعة أو إنشاؤه
      let printFrame = document.getElementById('cs_thermal_print_iframe');
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'cs_thermal_print_iframe';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '-9999px';
        printFrame.style.bottom = '-9999px';
        printFrame.style.width = '80mm';
        printFrame.style.height = '100px';
        printFrame.style.border = '0';
        printFrame.style.zIndex = '-1000';
        document.body.appendChild(printFrame);
      }

      const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
      if (!frameDoc) {
        throw new Error('تعذر الوصول إلى محرك الطباعة');
      }

      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      // إعطاء وقت قصير جداً لتجهيز الخطوط ثم استدعاء الطباعة
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
          resolve(true);
        } catch (err) {
          console.warn('Iframe print failed, fallback to window.open:', err);
          // خطة بديلة في حال قيود الـ Sandbox الشديدة
          fallbackPrintWindow(htmlContent);
          resolve(true);
        }
      }, 300);

    } catch (error) {
      console.error('Thermal print error:', error);
      reject(error);
    }
  });
}

// نافذة بديلة في حال تم تقييد الـ iframe
function fallbackPrintWindow(htmlContent) {
  const w = window.open('', '_blank', 'width=450,height=650');
  if (w) {
    w.document.open();
    w.document.write(htmlContent);
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 400);
  } else {
    // في حال حجب المتصفح لنافذة البوب آب تماماً، يتم عرض الفاتورة في نافذة حوارية داخلية مع زر طباعة مباشر
    showDirectPrintModal(htmlContent);
  }
}

// نافذة حوارية مدمجة للطوارئ مع دعم Ctrl+P المباشر
function showDirectPrintModal(htmlContent) {
  let modal = document.getElementById('cs_direct_print_modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cs_direct_print_modal';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;
      display:flex;align-items:center;justify-content:center;direction:rtl;
    `;
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:#fff;border-radius:8px;max-width:440px;width:95%;max-height:90vh;overflow-y:auto;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #eee;padding-bottom:8px;">
        <strong style="font-size:16px;">طباعة الفاتورة للطابعة الحرارية</strong>
        <button onclick="document.getElementById('cs_direct_print_modal').style.display='none'" style="background:none;border:none;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div id="cs_direct_print_body" style="background:#fff;border:1px dashed #999;padding:10px;margin-bottom:12px;"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:10px 20px;border-radius:4px;font-weight:bold;cursor:pointer;">🖨️ تأكيد إرسال الفاتورة للطابعة (Enter)</button>
        <button onclick="document.getElementById('cs_direct_print_modal').style.display='none'" style="background:#e2e8f0;border:none;padding:10px 16px;border-radius:4px;cursor:pointer;">إلغاء</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
  const bodyEl = document.getElementById('cs_direct_print_body');
  if (bodyEl) {
    bodyEl.innerHTML = htmlContent;
  }
}

// توليد كود HTML الكامل لبون تشغيل المطبخ (بدون أسعار، بخطوط عريضة وملاحظات مميزة)
export function generateKitchenTicketHTML(order, round = null) {
  const cfg = getPrinterConfig();
  const paperWidth = cfg.paperWidth === '58mm' ? '58mm' : '80mm';
  const printableWidth = paperWidth === '58mm' ? '48mm' : '72mm';

  const typeLabels = {
    dine: 'صالة',
    take: 'تيك أواي (سفري)',
    delivery: 'ديليفري (توصيل منازل)'
  };

  const orderType = typeLabels[order.type] || order.type || 'طلب جديد';
  const tableInfo = order.tableLabel ? `— ${order.tableLabel}` : (order.tableNumber ? `— طاولة ${order.tableNumber}` : '');
  const roundInfo = round ? `<div style="font-size:14px;font-weight:900;background:#000;color:#fff;padding:4px 8px;margin:6px 0;text-align:center;border-radius:4px;">طلب إضافي: راوند #${round}</div>` : '';
  const now = new Date();
  const timeStr = order.time || now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const items = order.items || [];
  let itemsRows = '';
  items.forEach(it => {
    const qty = it.qty || 1;
    const noteHtml = it.note ? `<div style="font-size:12px;font-weight:bold;margin-top:3px;background:#f0f0f0;border-right:3px solid #000;padding:2px 6px;">⚠️ ${it.note}</div>` : '';
    itemsRows += `
      <div style="border-bottom:1px dashed #000;padding:8px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:900;">
          <span style="display:inline-block;background:#000;color:#fff;padding:2px 8px;border-radius:4px;font-size:17px;min-width:32px;text-align:center;">× ${qty}</span>
          <span style="flex:1;margin-right:10px;text-align:right;">${it.name}</span>
        </div>
        ${noteHtml}
      </div>
    `;
  });

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>بون تشغيل المطبخ #${order.id}</title>
  <style>
    @page { size: ${paperWidth} auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: ${printableWidth};
      margin: 0 auto;
      padding: 6mm 2mm 10mm 2mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .k-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
    .k-title { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
    .k-meta { display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px; font-weight: 700; }
    .k-dest { font-size: 16px; font-weight: 900; margin: 6px 0; text-align: center; }
  </style>
</head>
<body>
  <div class="k-header">
    <div class="k-title">*** بون تشغيل المطبخ ***</div>
    <div style="font-size:24px;font-weight:900;margin:4px 0;">طلب رقم #${order.id}</div>
    <div class="k-dest">${orderType} ${tableInfo}</div>
    ${roundInfo}
    <div class="k-meta">
      <span>الوقت: ${timeStr}</span>
      <span>المسؤول: ${order.cashier || order.waiter || 'الكاشير'}</span>
    </div>
  </div>

  <div class="k-items">
    ${itemsRows}
  </div>

  <div style="text-align:center;font-size:11px;font-weight:700;margin-top:14px;border-top:1px solid #000;padding-top:6px;">
    إجمالي البنود: ${items.reduce((s, x) => s + (x.qty || 1), 0)} صنف — يُرجى سرعة التجهيز
  </div>
</body>
</html>
  `;
}

// طباعة بون المطبخ مباشرة عبر طابعة Rongta RP336
export async function printKitchenTicket(order, round = null) {
  const html = generateKitchenTicketHTML(order, round);

  let iframe = document.getElementById('thermal-kitchen-printer-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'thermal-kitchen-printer-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          resolve(true);
        } catch (printErr) {
          reject(printErr);
        }
      }, 350);
    } catch (e) {
      reject(e);
    }
  });
}

// طباعة إيصال تجريبي لطابعة Rongta RP336 للتحقق من الاتصال وعرض الورق 80 مم
export function printTestReceipt() {
  const testInvoice = {
    id: 9999,
    type: 'dine',
    tableLabel: 'طاولة تجريبية #01',
    customer: 'تجربة طابعة Rongta RP336',
    waiter: 'كاشير المحل',
    items: [
      { name: 'اختبار محاذاة العرض (80mm Width Test)', qty: 1, price: 100, note: 'Rongta RP336 Ready' },
      { name: 'وجبة كباب وكفتة مشوية ميكس', qty: 2, price: 140, note: 'أرز بسمتي + طحينة' },
      { name: 'مشروب غازي كانز مثلج', qty: 2, price: 20, note: 'بارد' },
      { name: 'حلو أم علي بالمكسرات والقشطة', qty: 1, price: 45, note: 'مخصوص' }
    ],
    subtotal: 465,
    discount: 15,
    total: 450,
    payMethod: 'cash',
    status: 'paid',
    date: new Date().toLocaleDateString('ar-EG'),
    time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  };

  return printReceipt(testInvoice, {
    receiptFooter: '✅ اختبار ناجح لطابعة Rongta RP336 (80mm) — الطابعة جاهزة للعمل بنجاح!'
  });
}

// دعم WebSerial للطباعة المباشرة عبر USB ESC/POS إذا كان المتصفح يدعمها
export async function printDirectESC_POS(invoice) {
  if (!('serial' in navigator)) {
    throw new Error('المتصفح الحالي لا يدعم منفذ WebSerial المباشر. استخدم الطباعة القياسية عبر تعريف الويندوز.');
  }

  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 }); // أو 115200 لطابعات Rongta الحديثة

  const writer = port.writable.getWriter();
  const encoder = new TextEncoder();

  // أوامر ESC/POS الأساسية
  const INIT = new Uint8Array([0x1B, 0x40]); // ESC @
  const ALIGN_CENTER = new Uint8Array([0x1B, 0x61, 0x01]);
  const ALIGN_RIGHT = new Uint8Array([0x1B, 0x61, 0x02]);
  const BOLD_ON = new Uint8Array([0x1B, 0x45, 0x01]);
  const BOLD_OFF = new Uint8Array([0x1B, 0x45, 0x00]);
  const CUT_PAPER = new Uint8Array([0x1D, 0x56, 0x42, 0x00]); // GS V B 0

  await writer.write(INIT);
  await writer.write(ALIGN_CENTER);
  await writer.write(BOLD_ON);
  await writer.write(encoder.encode(getPrinterConfig().storeName + "\n"));
  await writer.write(BOLD_OFF);
  await writer.write(encoder.encode("فاتورة رقم: " + invoice.id + "\n"));
  await writer.write(ALIGN_RIGHT);
  await writer.write(encoder.encode("الإجمالي: " + invoice.total + " ج\n\n\n"));
  await writer.write(CUT_PAPER);

  writer.releaseLock();
  await port.close();
}

export default {
  getPrinterConfig,
  savePrinterConfig,
  generateReceiptHTML,
  generateKitchenTicketHTML,
  printReceipt,
  printKitchenTicket,
  printTestReceipt,
  printDirectESC_POS
};
