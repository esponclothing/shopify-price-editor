import axios from 'axios';
import https from 'https';
import pg from 'pg';
const { Client } = pg;

async function fetchNFUData() {
  const urls = [
    process.env.SUPABASE_NFU_DB_URL || 'postgres://postgres:11fit@202612@db.nfubnpgfwgrlpfhcbjlg.supabase.co:6543/postgres',
    'postgres://postgres:11fit@202612@db.nfubnpgfwgrlpfhcbjlg.supabase.co:5432/postgres'
  ];
  let otpLogs = [];
  let networkUsers = [];
  let errorMsg = null;

  for (const url of urls) {
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 7000
    });
    try {
      await client.connect();
      const [resOtp, resUsers] = await Promise.all([
        client.query('SELECT * FROM otp_logs ORDER BY created_at DESC LIMIT 1000'),
        client.query('SELECT * FROM network_users ORDER BY created_at DESC LIMIT 1000')
      ]);
      otpLogs = resOtp.rows || [];
      networkUsers = resUsers.rows || [];
      errorMsg = null;
      await client.end();
      break; // Connected and fetched successfully!
    } catch (err) {
      errorMsg = err.message;
      console.warn(`Failed to connect to ${url}: ${err.message}`);
      try { await client.end(); } catch (_) {}
    }
  }

  return { otpLogs, networkUsers, errorMsg };
}

const get10Digit = (ph) => {
  const s = String(ph || '').replace(/\D/g, '');
  return s.length >= 10 ? s.slice(-10) : s;
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-client-store-url, x-client-access-token'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Resolve Shopify credentials
  const clientStore = req.headers['x-client-store-url'] || process.env.VITE_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL || '';
  const clientToken = req.headers['x-client-access-token'] || process.env.VITE_SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN || '';

  let cleanStore = clientStore.trim();
  if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
  if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

  try {
    // -------------------------------------------------------------
    // A. FETCH OTP LOGS & NETWORK USERS FROM 11FIT POSTGRES DB (NFU)
    // -------------------------------------------------------------
    const { otpLogs, networkUsers, errorMsg } = await fetchNFUData();

    // -------------------------------------------------------------
    // B. FETCH ABANDONED CHECKOUTS FROM SHOPIFY
    // -------------------------------------------------------------
    let checkouts = [];
    try {
      const shopifyUrl = `https://${cleanStore}/admin/api/2024-04/checkouts.json?limit=150`;
      const shopifyRes = await axios.get(shopifyUrl, {
        headers: {
          'X-Shopify-Access-Token': clientToken.trim(),
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({ family: 4, keepAlive: true })
      });
      checkouts = shopifyRes.data?.checkouts || [];
    } catch (err) {
      console.warn('Error fetching Shopify checkouts:', err.message);
    }

    // -------------------------------------------------------------
    // C. PROCESS & MAP 10-DIGIT PHONES FOR OTP VERIFICATION
    // -------------------------------------------------------------
    const otpStatusMap = {};
    const verifiedPhonesSet = new Set();
    const allPhonesSet = new Set();
    let totalOtpSent = 0;

    if (Array.isArray(otpLogs)) {
      otpLogs.forEach(log => {
        totalOtpSent++;
        if (log.phone) {
          const phone10 = get10Digit(log.phone);
          if (phone10) {
            allPhonesSet.add(phone10);
            const status = String(log.status || '').toLowerCase();
            if (status === 'verified' || status === 'success') {
              otpStatusMap[phone10] = 'Verified';
              verifiedPhonesSet.add(phone10);
            } else if (!otpStatusMap[phone10]) {
              otpStatusMap[phone10] = 'Guest / OTP Pending';
            }
          }
        }
      });
    }

    const userMap = {};
    if (Array.isArray(networkUsers)) {
      networkUsers.forEach(u => {
        if (u.phone) {
          const phone10 = get10Digit(u.phone);
          if (phone10) {
            userMap[phone10] = u;
            otpStatusMap[phone10] = 'Verified';
            verifiedPhonesSet.add(phone10);
            allPhonesSet.add(phone10);
          }
        }
      });
    }

    // -------------------------------------------------------------
    // D. FILTER & ENRICH ABANDONED CHECKOUTS
    // -------------------------------------------------------------
    const abandonedCarts = [];
    if (Array.isArray(checkouts)) {
      checkouts.forEach(c => {
        let rawPhone =
          c.phone ||
          c.shipping_address?.phone ||
          c.billing_address?.phone ||
          c.customer?.phone ||
          c.customer?.default_address?.phone ||
          '';

        if (!rawPhone && c.email) {
          const possibleDigits = c.email.split('@')[0].replace(/[^0-9]/g, '');
          if (possibleDigits.length >= 10) {
            rawPhone = '+' + possibleDigits;
          }
        }

        if (!rawPhone && !c.email) return;

        const phone10 = get10Digit(rawPhone);
        const normalizedPhone = rawPhone
          ? (String(rawPhone).startsWith('+') ? String(rawPhone) : `+${rawPhone}`)
          : 'N/A';

        const is11fitUser = Boolean(phone10 && userMap[phone10]);
        const isVerified = Boolean(phone10 && verifiedPhonesSet.has(phone10));
        const otpStatus = isVerified
          ? 'Verified'
          : (phone10 && otpStatusMap[phone10] ? otpStatusMap[phone10] : 'Guest / OTP Pending');

        abandonedCarts.push({
          id: c.id || Math.random().toString(36).slice(2),
          token: c.token,
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || c.created_at || new Date().toISOString(),
          phone: normalizedPhone,
          email: c.email || '',
          total_price: c.total_price || '0.00',
          currency: c.currency || 'INR',
          abandoned_checkout_url: c.abandoned_checkout_url || '',
          line_items: Array.isArray(c.line_items) ? c.line_items : [],
          shipping_address: c.shipping_address || null,
          otp_status: otpStatus,
          is_11fit_user: is11fitUser
        });
      });
    }

    abandonedCarts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // -------------------------------------------------------------
    // E. CALCULATE METRICS & FORMAT LOGS FOR FRONTEND
    // -------------------------------------------------------------
    const totalOtpVerified = verifiedPhonesSet.size;
    const totalOtpFailed = Math.max(0, totalOtpSent - totalOtpVerified);
    const verificationRate = allPhonesSet.size > 0
      ? Math.min(100, Math.round((verifiedPhonesSet.size / allPhonesSet.size) * 100))
      : 100;

    const formattedOtpLogs = (Array.isArray(otpLogs) ? otpLogs : []).map(log => {
      const status = String(log.status || '').toLowerCase();
      return {
        ...log,
        event_type: status === 'verified' || status === 'success'
          ? 'OTP_VERIFIED'
          : status === 'sent'
          ? 'OTP_SENT'
          : status === 'failed'
          ? 'OTP_FAILED'
          : 'OTP_' + status.toUpperCase()
      };
    });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      analytics: {
        totalOtpSent,
        totalOtpVerified,
        totalOtpFailed,
        verificationRate: Number(verificationRate),
        totalMobileUsers: Array.isArray(networkUsers) ? networkUsers.length : 0,
        activeAbandonedCarts: abandonedCarts.length
      },
      abandonedCarts,
      otpLogs: formattedOtpLogs,
      networkUsers: Array.isArray(networkUsers) ? networkUsers : [],
      _debug_error: errorMsg || null
    });
  } catch (error) {
    console.error('11FIT Analytics API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
