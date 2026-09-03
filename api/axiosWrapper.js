import originalAxios from 'axios';
import { supabaseFetch } from './supabaseFetch.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nfubnpgfwgrlpfhcbjlg.supabase.co';
const SUPABASE_URL_2 = 'https://xkiukbebnntjzfilyfmh.supabase.co';

async function interceptSupabase(method, url, data = null, config = {}) {
  let isSupabase = false;
  if (typeof url === 'string') {
    if (url.includes(SUPABASE_URL) || url.includes(SUPABASE_URL_2) || url.includes('.supabase.co')) {
      isSupabase = true;
    }
  }

  if (isSupabase) {
    let cleanUrl = url;
    if (cleanUrl.includes(SUPABASE_URL)) cleanUrl = cleanUrl.replace(SUPABASE_URL, '');
    if (cleanUrl.includes(SUPABASE_URL_2)) cleanUrl = cleanUrl.replace(SUPABASE_URL_2, '');
    cleanUrl = cleanUrl.replace(/^https:\/\/[^\/]+/, ''); // remove any other supabase domain
    
    const options = {
      method,
      headers: config.headers || {},
      body: data ? JSON.stringify(data) : undefined
    };

    const res = await supabaseFetch(cleanUrl, options);
    
    if (!res.ok) {
      const err = new Error('Supabase Shim Error: ' + res.status);
      err.response = { status: res.status, data: await res.json() };
      throw err;
    }
    
    return { data: await res.json(), status: res.status, headers: {} };
  } else {
    // Pass through to real axios
    const axiosConfig = { ...config, url, method, data };
    return originalAxios(axiosConfig);
  }
}

const axiosProxy = {
  get: (url, config) => interceptSupabase('GET', url, null, config),
  post: (url, data, config) => interceptSupabase('POST', url, data, config),
  patch: (url, data, config) => interceptSupabase('PATCH', url, data, config),
  delete: (url, config) => interceptSupabase('DELETE', url, null, config),
  put: (url, data, config) => interceptSupabase('PUT', url, data, config),
  request: (config) => interceptSupabase(config.method || 'GET', config.url, config.data, config)
};

export default axiosProxy;
