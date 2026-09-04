import { dbFetch } from './dbFetch.js';
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

  const { phone, otp, signature, device_id, email } = req.body;

  if (!phone || !otp || !signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Extract IP address from request
  const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const cleanIp = typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : ipAddress;

  // Helper function to log to Supabase
  const logToSupabase = (status) => {
            if (supabaseUrl && supabaseKey) {
      let formattedPhone = phone;
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone;
      }
      dbFetch(`/rest/v1/otp_logs`, {
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
          status: status,
          device_id: cleanIp
        })
      }).catch(err => console.error('Supabase logging error:', err));
    }
  };

  try {
    const [hash, expires] = signature.split('.');
    
    // Check expiration
    if (Date.now() > parseInt(expires)) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Recalculate hash
    const data = `${phone}.${otp}.${expires}`;
    const calculatedHash = crypto.createHmac('sha256', OTP_SECRET).update(data).digest('hex');

    if (calculatedHash !== hash) {
      logToSupabase('failed');
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // =========================================================================
    // OTP IS VALID! Now attach phone to the Shopify Customer Profile
    // =========================================================================
    const clientStore = process.env.VITE_SHOPIFY_STORE_URL;
    const clientToken = process.env.VITE_SHOPIFY_ACCESS_TOKEN;

    if (!clientStore || !clientToken) {
      throw new Error('Missing Shopify API credentials');
    }

    // Usually 11fit.in but let's make sure it handles .myshopify.com
    let cleanStore = clientStore.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanStore.includes('.myshopify.com') && !cleanStore.includes('11fit.in')) {
      cleanStore = '11fit.in'; // Default if missing
    }

    const graphqlUrl = `https://${cleanStore}/admin/api/2024-07/graphql.json`;
    const headers = {
      'X-Shopify-Access-Token': clientToken.trim(),
      'Content-Type': 'application/json'
    };

    // Format phone to E.164 if necessary
    let formattedPhone = phone;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+91' + formattedPhone; // Defaulting to India
    }

    let customerId = null;

    // We will use native fetch for node instead of axios to reduce dependencies
    // 1. Search by EMAIL first if available
    if (email) {
      const emailQuery = `
        query getCustomer($query: String!) {
          customers(first: 1, query: $query) {
            edges { node { id phone } }
          }
        }
      `;
      const emailRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: emailQuery, variables: { query: `email:${email}` } })
      });
      const emailData = await emailRes.json();
      const emailNode = emailData.data?.customers?.edges[0]?.node;
      
      if (emailNode) {
        customerId = emailNode.id;
        // If they don't have a phone number, update it!
        if (!emailNode.phone || emailNode.phone !== formattedPhone) {
          console.log(`[VERIFY OTP] Updating customer ${customerId} with phone ${formattedPhone}`);
          const updateMutation = `
            mutation customerUpdate($input: CustomerInput!) {
              customerUpdate(input: $input) {
                userErrors { message }
              }
            }
          `;
          await fetch(graphqlUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: updateMutation, variables: { input: { id: customerId, phone: formattedPhone } } })
          });
        }
      }
    }

    // 2. If not found by email, search by PHONE
    if (!customerId) {
      const phoneQuery = `
        query getCustomer($query: String!) {
          customers(first: 1, query: $query) {
            edges { node { id } }
          }
        }
      `;
      const phoneRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: phoneQuery, variables: { query: `phone:${formattedPhone}` } })
      });
      const phoneData = await phoneRes.json();
      customerId = phoneData.data?.customers?.edges[0]?.node?.id;
    }

    // 3. If still not found, CREATE them
    if (!customerId) {
      console.log(`[VERIFY OTP] Customer not found. Creating new customer...`);
      const createCustomerMutation = `
        mutation customerCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer { id phone }
            userErrors { field message }
          }
        }
      `;
      const createRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: createCustomerMutation,
          variables: {
            input: {
              phone: formattedPhone,
              firstName: "Valued",
              lastName: "Customer",
              tags: ["whatsapp_verified"]
            }
          }
        })
      });
      const createData = await createRes.json();

      const errors = createData.data?.customerCreate?.userErrors || [];
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Failed to create customer: ' + errors[0].message });
      }

      customerId = createData.data?.customerCreate?.customer?.id;
    } else {
      console.log(`[VERIFY OTP] Customer found. ID: ${customerId}`);
    }

    // Convert global GraphQL ID to REST numeric ID
    const numericId = customerId.split('/').pop();

    logToSupabase('verified');

    // ==========================================
    // IDENTITY NETWORK LINKING
    // ==========================================
            if (supabaseUrl && supabaseKey) {
      let formattedPhone = phone;
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone;
      }
      // Upsert into network_users (so phone exists)
      dbFetch(`/rest/v1/network_users`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ phone: formattedPhone })
      }).then(() => {
        // Upsert into network_devices if device_id is provided
        if (device_id || cleanIp !== 'unknown') {
          const did = device_id || crypto.randomUUID();
          dbFetch(`/rest/v1/network_devices`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              device_id: did,
              phone: formattedPhone,
              ip_address: cleanIp,
              user_agent: req.headers['user-agent'] || 'unknown'
            })
          }).catch(e => console.error(e));
        }
      }).catch(err => console.error('Identity Network error:', err));
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Phone verified successfully',
      customer_id: numericId
    });

  } catch (error) {
    console.error('Verify OTP error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
