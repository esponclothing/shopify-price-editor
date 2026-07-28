export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { device_id } = req.body || {};
  const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const cleanIp = typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : ipAddress;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    let phone = null;

    // 1. Try to identify by exact Device ID
    if (device_id) {
      const deviceRes = await fetch(`${supabaseUrl}/rest/v1/network_devices?device_id=eq.${device_id}&select=phone`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      const devices = await deviceRes.json();
      if (devices && devices.length > 0) {
        phone = devices[0].phone;
      }
    }

    // 2. Try to identify by IP Address (Fallback, as requested by user)
    // Note: This is dangerous on mobile networks, but built to spec.
    if (!phone && cleanIp !== 'unknown') {
      const ipRes = await fetch(`${supabaseUrl}/rest/v1/network_devices?ip_address=eq.${cleanIp}&select=phone&order=created_at.desc&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      const ipDevices = await ipRes.json();
      if (ipDevices && ipDevices.length > 0) {
        phone = ipDevices[0].phone;
      }
    }

    if (!phone) {
      return res.status(200).json({ identified: false });
    }

    // 3. We found a phone number! Fetch their full profile.
    const userRes = await fetch(`${supabaseUrl}/rest/v1/network_users?phone=eq.${encodeURIComponent(phone)}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const users = await userRes.json();
    
    if (users && users.length > 0) {
      return res.status(200).json({
        identified: true,
        phone: users[0].phone,
        profile: users[0]
      });
    }

    return res.status(200).json({ identified: false });

  } catch (error) {
    console.error('Identify Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
