import crypto from 'crypto';

const OTP_SECRET = process.env.OTP_SECRET || '11fit-secure-otp-secret-key';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, email, context } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // Extract IP address from request
  const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

  // --- ADMIN AUTHORIZATION CHECK ---
  if (context === 'admin') {
    const AUTHORIZED_NUMBERS = [
      '9306817689',
      '9812354321',
      '+919306817689',
      '+919812354321',
      '919306817689',
      '919812354321'
    ];
    const normalizedPhone = phone.replace(/\D/g, '');
    const isAuthorized = AUTHORIZED_NUMBERS.some(authorized => {
      const normAuth = authorized.replace(/\D/g, '');
      return normalizedPhone.endsWith(normAuth) || normAuth.endsWith(normalizedPhone);
    });

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not registered as admin' });
    }
  }

  try {
    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Create expiration timestamp (5 minutes from now)
    const expires = Date.now() + 5 * 60 * 1000;
    
    // Create payload to hash: phone + otp + expires
    const data = `${phone}.${otp}.${expires}`;
    
    // Create HMAC hash
    const hash = crypto.createHmac('sha256', OTP_SECRET).update(data).digest('hex');
    
    // The client needs the hash and expiration to verify later
    const signature = `${hash}.${expires}`;

    // =====================================================================
    // META WHATSAPP CLOUD API INTEGRATION
    // =====================================================================
    console.log(`[11FIT OTP] Sending OTP ${otp} to phone ${phone}`);
    
    const META_TOKEN = process.env.WHATSAPP_TOKEN || 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
    const PHONE_NUMBER_ID = '1189183190949431';
    
    // Ensure phone number starts with 91 (India) if no country code is present
    let formattedPhone = phone.replace(/^(\+?91|0)/, '');
    formattedPhone = '91' + formattedPhone;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: 'eleven_fit_otp',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [ { type: 'text', text: otp } ]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [ { type: 'text', text: otp } ]
          }
        ]
      }
    };

    // Make request to Meta Graph API using fetch
    const response = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API Error Response:', result);
      throw new Error(`Meta API error: ${result.error?.message || 'Unknown error'}`);
    }

    console.log('WhatsApp message sent successfully:', result.messages?.[0]?.id);
    
    // =====================================================================
    // SUPABASE ANALYTICS TRACKING (Background)
    // =====================================================================
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      fetch(`${supabaseUrl}/rest/v1/otp_logs`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          phone: formattedPhone,
          merchant_id: 'faadf814-2bb0-44df-a6b0-fed13d14961c',
          status: 'sent',
          device_id: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : ipAddress
        })
      }).catch(err => console.error('Supabase logging error:', err));
    }
    
    // Return the hash and expiration to the client
    return res.status(200).json({ signature });
    
  } catch (error) {
    console.error('Error in send-otp:', error.message);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
}
