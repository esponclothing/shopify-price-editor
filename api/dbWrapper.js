import originalAxios from 'axios';
import { dbFetch } from './dbFetch.js';


async function interceptDatabase(method, url, data = null, config = {}) {
  let isDbFetch = false;
  let cleanUrl = url;
  
  if (typeof url === 'string') {
    if (url.includes('/rest/v1/')) {
      isDbFetch = true;
      const urlParts = url.split('/rest/v1/');
      cleanUrl = '/rest/v1/' + urlParts[urlParts.length - 1];
    }
  }

  if (isDbFetch) {
    
    const options = {
      method,
      headers: config.headers || {},
      body: data ? JSON.stringify(data) : undefined
    };

    const res = await dbFetch(cleanUrl, options);
    
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

const axiosProxy = function(config) {
  return interceptDatabase(config.method || 'GET', config.url, config.data, config);
};

axiosProxy.get = (url, config) => interceptDatabase('GET', url, null, config);
axiosProxy.post = (url, data, config) => interceptDatabase('POST', url, data, config);
axiosProxy.patch = (url, data, config) => interceptDatabase('PATCH', url, data, config);
axiosProxy.delete = (url, config) => interceptDatabase('DELETE', url, null, config);
axiosProxy.put = (url, data, config) => interceptDatabase('PUT', url, data, config);
axiosProxy.request = (config) => interceptDatabase(config.method || 'GET', config.url, config.data, config);

export default axiosProxy;
