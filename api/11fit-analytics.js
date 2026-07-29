import axios from 'axios';
import https from 'https';

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

  // 1. Resolve Supabase credentials
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  // 2. Resolve Shopify credentials
  const clientStore = req.headers['x-client-store-url'] || process.env.VITE_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL || '';
  const clientToken = req.headers['x-client-access-token'] || process.env.VITE_SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN || '';

  let cleanStore = clientStore.trim();
  if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
  if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

  try {
    // -------------------------------------------------------------
    // A. FETCH OTP ANALYTICS LOGS FROM SUPABASE
    // -------------------------------------------------------------
    let otpLogs = [];
    try {
      const otpRes = await fetch(`${supabaseUrl}/rest/v1/otp_analytics?order=created_at.desc&limit=150`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      if (otpRes.ok) {
        otpLogs = await otpRes.json();
      }
    } catch (err) {
      console.warn('Error fetching otp_analytics:', err.message);
    }

    // -------------------------------------------------------------
    // B. FETCH NETWORK USERS (11FIT PHONE LOGIN USERS) FROM SUPABASE
    // -------------------------------------------------------------
    let networkUsers = [];
    try {
      const usersRes = await fetch(`${supabaseUrl}/rest/v1/network_users?order=created_at.desc&limit=150`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      if (usersRes.ok) {
        networkUsers = await usersRes.json();
      }
    } catch (err) {
      console.warn('Error fetching network_users:', err.message);
    }

    // -------------------------------------------------------------
    // C. FETCH ABANDONED CHECKOUTS FROM SHOPIFY
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
    // D. PROCESS & FILTER FOR MOBILE NUMBERS ONLY ABANDONED CARTS
    // -------------------------------------------------------------
    // Map phone numbers from otpLogs for quick lookup
    const otpStatusMap = {};
    if (Array.isArray(otpLogs)) {
      otpLogs.forEach(log => {
        if (log.phone) {
          const cleanPhone = String(log.phone).replace(/[^0-9]/g, '');
          if (!otpStatusMap[cleanPhone]) {
            otpStatusMap[cleanPhone] = log.status || 'sent';
          }
        }
      });
    }

    // Map network users by phone
    const userMap = {};
    if (Array.isArray(networkUsers)) {
      networkUsers.forEach(u => {
        if (u.phone) {
          const cleanPhone = String(u.phone).replace(/[^0-9]/g, '');
          userMap[cleanPhone] = u;
        }
      });
    }

    // Filter checkouts to include carts with mobile numbers
    const abandonedCarts = [];
    if (Array.isArray(checkouts)) {
      checkouts.forEach(c => {
        // Try to extract mobile number from any possible field
        let rawPhone =
          c.phone ||
          c.shipping_address?.phone ||
          c.billing_address?.phone ||
          c.customer?.phone ||
          c.customer?.default_address?.phone ||
          '';

        // Check if email happens to be formatted as phone@store
        if (!rawPhone && c.email) {
          const possibleDigits = c.email.split('@')[0].replace(/[^0-9]/g, '');
          if (possibleDigits.length >= 10) {
            rawPhone = '+' + possibleDigits;
          }
        }

        // We only want abandoned carts where we have a mobile number!
        if (!rawPhone && !c.email) return; // Skip completely empty

        const cleanPhone = String(rawPhone || '').replace(/[^0-9]/g, '');
        const normalizedPhone = rawPhone
          ? (rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`)
          : 'N/A';

        // Check if this mobile number has an OTP log or is an 11FIT user
        const otpStatus = cleanPhone ? (otpStatusMap[cleanPhone] || 'Verified') : 'Unverified';
        const is11fitUser = Boolean(cleanPhone && userMap[cleanPhone]);

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

    // Sort abandoned carts by created_at newest first
    abandonedCarts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // -------------------------------------------------------------
    // E. CALCULATE OTP ANALYTICS METRICS
    // -------------------------------------------------------------
    const totalOtpSent = Array.isArray(otpLogs) ? otpLogs.length : 0;
    const totalOtpVerified = Array.isArray(otpLogs)
      ? otpLogs.filter(l => (l.status || '').toLowerCase() === 'verified' || (l.status || '').toLowerCase() === 'success').length
      : 0;
    const totalOtpFailed = totalOtpSent - totalOtpVerified;
    const verificationRate = totalOtpSent > 0
      ? ((totalOtpVerified / totalOtpSent) * 100).toFixed(1)
      : '100.0';

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
      otpLogs: Array.isArray(otpLogs) ? otpLogs : [],
      networkUsers: Array.isArray(networkUsers) ? networkUsers : []
    });
  } catch (error) {
    console.error('11FIT Analytics API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
