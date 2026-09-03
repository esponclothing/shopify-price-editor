  const WA_API_BASE = 'https://checkout-app-one-lilac.vercel.app/api';
  const MERCHANT_KEY = 'sk_live_11fit_106b31bb8dd7a7';

  let waPhone = null;
  let waSignature = null;
  let waOtpSendCount = 0;
  let waResendInterval = null;
  let waEditingAddressId = null;
  let waSelectedAddress = null;
  let waAddresses = [];
  let waDraftOrderId = null;
  let waInvoiceUrl = null;
  let waEmail = '';
  let waAppliedDiscountCode = null;
  let waShopifyAddressesLoaded = false;
  let waMapSearchTimer = null;
  let waPaymentSettings = {};

  document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('fit11_device_id')) {
      if (localStorage.getItem('wa_device_id')) {
        localStorage.setItem('fit11_device_id', localStorage.getItem('wa_device_id'));
      } else {
        localStorage.setItem('fit11_device_id', 'dev_' + Math.random().toString(36).substr(2, 9));
      }
    }
    // Capture UTM parameters for Ad Tracking
    try {
      const params = new URLSearchParams(window.location.search);
      let utm_source = params.get('utm_source');
      let utm_medium = params.get('utm_medium');
      let utm_campaign = params.get('utm_campaign');
      const fbclid = params.get('fbclid');
      const gclid = params.get('gclid');
      const referrer = document.referrer;
      
      if (!utm_source) {
        if (fbclid) { utm_source = 'Meta Ads'; utm_medium = 'cpc'; }
        else if (gclid) { utm_source = 'Google Ads'; utm_medium = 'cpc'; }
        else if (referrer && (referrer.includes('facebook.com') || referrer.includes('instagram.com'))) { 
          utm_source = 'Meta Organic'; utm_medium = 'social'; 
        }
      }
      
      if (utm_source || referrer) {
        let utmData = JSON.parse(localStorage.getItem('wa_utm_data') || '{}');
        if (utm_source) {
          utmData.utm_source = utm_source;
          if (utm_medium) utmData.utm_medium = utm_medium;
          if (utm_campaign) utmData.utm_campaign = utm_campaign;
        }
        if (!utmData.referrer && referrer && !referrer.includes(window.location.hostname)) {
          utmData.referrer = referrer;
        }
        localStorage.setItem('wa_utm_data', JSON.stringify(utmData));
      }
    } catch(e) { console.error('UTM tracking error', e); }
  });

  // ── MAP / LOCATION SEARCH (OpenStreetMap Nominatim - FREE, no API key) ──
  function waSearchAddress(query) {
    clearTimeout(waMapSearchTimer);
    const sugBox = document.getElementById('wa-map-suggestions');
    if (!query || query.length < 3) { sugBox.style.display = 'none'; return; }
    waMapSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`, {
          headers: { 'Accept-Language': 'en' }
        });
        const results = await res.json();
        sugBox.innerHTML = '';
        if (!results.length) {
          sugBox.innerHTML = '<div style="padding:12px;font-size:13px;color:#94a3b8;">No results found</div>';
        } else {
          results.forEach(r => {
            const div = document.createElement('div');
            div.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #f1f5f9;color:#374151;';
            div.innerText = r.display_name;
            div.onmouseenter = () => div.style.background = '#f8fafc';
            div.onmouseleave = () => div.style.background = '';
            div.onclick = () => waFillFromNominatim(r);
            sugBox.appendChild(div);
          });
        }
        sugBox.style.display = 'block';
      } catch(e) { sugBox.style.display = 'none'; }
    }, 400);
  }

  function waFillFromNominatim(r) {
    const a = r.address || {};
    // Fill fields
    const city = a.city || a.town || a.village || a.suburb || a.neighbourhood || '';
    const district = a.county || a.state_district || '';
    const state = a.state || '';
    const postcode = a.postcode || '';
    const road = [a.house_number, a.road, a.suburb].filter(Boolean).join(', ');

    if (road) document.getElementById('wa-addr-street').value = road;
    if (city) { const c = document.getElementById('wa-addr-city-input') || document.getElementById('wa-addr-city'); if(c) c.value = city; }
    if (district) document.getElementById('wa-addr-district').value = district;
    if (postcode) document.getElementById('wa-addr-zip').value = postcode;

    // Set state dropdown
    if (state) {
      const sel = document.getElementById('wa-addr-state');
      for (let opt of sel.options) {
        if (opt.value.toLowerCase().includes(state.toLowerCase()) || state.toLowerCase().includes(opt.value.toLowerCase())) {
          opt.selected = true; break;
        }
      }
    }

    // Clear search
    document.getElementById('wa-map-search').value = city || state || '';
    document.getElementById('wa-map-suggestions').style.display = 'none';
  }

  function waUseMyLocation() {
    if (!navigator.geolocation) return alert('Geolocation not supported on this device.');
    const btn = event.target;
    btn.innerHTML = '⏳';
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`, {
          headers: { 'Accept-Language': 'en' }
        });
        const r = await res.json();
        waFillFromNominatim(r);
        document.getElementById('wa-map-search').value = '📍 Location detected';
      } catch(e) {
        alert('Could not detect location. Please search manually.');
      } finally { btn.innerHTML = '📍'; }
    }, () => { alert('Location access denied. Please search manually.'); btn.innerHTML = '📍'; });
  }

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('#wa-new-address-form')) {
      const sugBox = document.getElementById('wa-map-suggestions');
      if (sugBox) sugBox.style.display = 'none';
    }
  });

  
  function waApplyEmailSetting(ps) {
    const emailInput = document.getElementById('wa-email');
    const emailBadge = document.getElementById('wa-email-badge');
    const emailLabel = emailBadge ? emailBadge.closest('label') : null;
    
    const isRequired = ps && ps.email_required === true;
    
    if (emailInput) {
      emailInput.required = isRequired;
      emailInput.placeholder = isRequired ? 'your@email.com *' : 'your@email.com (Optional)';
    }
    if (emailBadge) {
      emailBadge.textContent = isRequired ? '(Required *)' : '(Optional)';
      emailBadge.style.color = isRequired ? '#ef4444' : '#94a3b8';
    }
  }
  
  function waSavePhoneGlobally(phone) {
    if (!phone) return;
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0'))) {
      digits = digits.slice(-10);
    }
    digits = digits.slice(0, 10);
    if (digits.length === 10) {
      try {
        localStorage.setItem('wa_saved_phone', digits);
        localStorage.setItem('wa_user_phone', digits);
        localStorage.setItem('espon_user_phone', digits);
        localStorage.setItem('fit11_user_phone', digits);
        localStorage.setItem('notify_phone_number', digits);
        localStorage.setItem('wa_verified_phone', digits);
        localStorage.setItem('fit11_verified_phone', digits);
        document.cookie = `wa_saved_phone=${digits}; path=/; max-age=2592000`; // 30 days
      } catch(e) {}
    }
  }

  function waGetSavedPhone() {
    let phone = '';

    // 1. Check window._shopifyCustomer
    const sc = window._shopifyCustomer;
    if (sc && sc.logged_in && sc.phone) {
      phone = sc.phone;
    }

    // 2. Check localStorage & sessionStorage keys
    if (!phone) {
      const keys = [
        'wa_saved_phone',
        'wa_user_phone',
        'espon_user_phone',
        'fit11_user_phone',
        'tinkal_user_phone',
        'notify_phone_number',
        'wa_verified_phone',
        'fit11_verified_phone',
        'espon_verified_phone'
      ];
      for (let k of keys) {
        try {
          let v = localStorage.getItem(k) || sessionStorage.getItem(k);
          if (v && v !== 'undefined' && v !== 'null') {
            let digits = String(v).replace(/\D/g, '');
            if (digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0'))) {
              digits = digits.slice(-10);
            }
            if (digits.length === 10) { 
              phone = digits; 
              break; 
            }
          }
        } catch(e) {}
      }
    }

    // 3. Check base64 notifyph if present
    if (!phone) {
      try {
        let nph = localStorage.getItem('notifyph');
        if (nph) {
          let decoded = atob(nph);
          if (decoded && decoded !== '0000000000') phone = decoded;
        }
      } catch(e) {}
    }

    // 4. Check Cookies
    if (!phone) {
      try {
        const cookies = document.cookie.split('; ');
        for (let c of cookies) {
          let [name, val] = c.split('=');
          if (name === 'wa_saved_phone' || name === 'notify_phone_number' || name === 'user_phone') {
            if (val && val !== 'undefined' && val !== 'null') { 
              let digits = String(decodeURIComponent(val)).replace(/\D/g, '');
              if (digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0'))) {
                digits = digits.slice(-10);
              }
              if (digits.length === 10) { 
                phone = digits; 
                break; 
              }
            }
          }
        }
      } catch(e) {}
    }

    // 5. Check DOM inputs on the page (autofilled or typed inputs)
    if (!phone) {
      const telInputs = document.querySelectorAll('input[type="tel"], input[name*="phone"], input[name*="mobile"]');
      for (let inp of telInputs) {
        if (inp && inp.value && inp.id !== 'wa-phone') {
          let digits = inp.value.replace(/\D/g, '');
          if (digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0'))) {
            digits = digits.slice(-10);
          }
          if (digits.length === 10) { phone = digits; break; }
        }
      }
    }

    if (phone) {
      let digits = String(phone).replace(/\D/g, '');
      if (digits.length > 10 && (digits.startsWith('91') || digits.startsWith('0'))) {
        digits = digits.slice(-10);
      }
      digits = digits.slice(0, 10);
      if (digits.length === 10) return digits;
    }
    return '';
  }

  function waSaveEmailGlobally(email) {
    if (!email || !email.trim()) return;
    let cleanEmail = email.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      try {
        localStorage.setItem('wa_saved_email', cleanEmail);
        localStorage.setItem('wa_user_email', cleanEmail);
        localStorage.setItem('espon_user_email', cleanEmail);
        localStorage.setItem('fit11_user_email', cleanEmail);
        localStorage.setItem('notify_email', cleanEmail);
        sessionStorage.setItem('fit11_verified_email', cleanEmail);
        sessionStorage.setItem('wa_verified_email', cleanEmail);
        document.cookie = `wa_saved_email=${encodeURIComponent(cleanEmail)}; path=/; max-age=2592000`; // 30 days
      } catch(e) {}
    }
  }

  function waGetSavedEmail() {
    let email = '';

    // 1. Check window._shopifyCustomer
    const sc = window._shopifyCustomer;
    if (sc && sc.logged_in && sc.email) {
      email = sc.email;
    }

    // 2. Check localStorage & sessionStorage
    if (!email) {
      const keys = [
        'wa_saved_email',
        'wa_user_email',
        'espon_user_email',
        'fit11_user_email',
        'fit11_verified_email',
        'wa_verified_email',
        'notify_email'
      ];
      for (let k of keys) {
        try {
          let v = localStorage.getItem(k) || sessionStorage.getItem(k);
          if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) {
            email = v.trim();
            break;
          }
        } catch(e) {}
      }
    }

    // 3. Check Cookies
    if (!email) {
      try {
        const cookies = document.cookie.split('; ');
        for (let c of cookies) {
          let [name, val] = c.split('=');
          if (name === 'wa_saved_email' || name === 'notify_email' || name === 'user_email') {
            if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decodeURIComponent(val).trim())) {
              email = decodeURIComponent(val).trim();
              break;
            }
          }
        }
      } catch(e) {}
    }

    // 4. Check DOM email inputs on page
    if (!email) {
      const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email"]');
      for (let inp of emailInputs) {
        if (inp && inp.value && inp.id !== 'wa-email') {
          let val = inp.value.trim();
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            email = val;
            break;
          }
        }
      }
    }

    return email;
  }

  function waCleanPhoneInput(el) {
    if (!el) return '';
    let val = el.value || '';
    let digits = val.replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length > 10 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);
    el.value = digits;
    if (digits.length === 10) {
      waSavePhoneGlobally(digits);
    }
    return digits;
  }

  async function openWaModal() {
    const overlay = document.getElementById('wa-otp-overlay');
    if (!overlay) return;
    if (overlay.parentNode !== document.body) {
      document.body.appendChild(overlay);
    }
    overlay.style.cssText = 'position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;z-index:2147483647!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;overflow-y:auto!important;padding:0!important;background:rgba(15,23,42,0.75)!important;';
    document.body.style.overflow = 'hidden';
    waResetModal();

    // Auto-fetch saved or cached phone & email from browser
    const phoneInput = document.getElementById('wa-phone');
    const emailInput = document.getElementById('wa-email');

    const cachedPhone = waGetSavedPhone();
    const cachedEmail = waGetSavedEmail();

    if (phoneInput && cachedPhone) {
      phoneInput.value = cachedPhone;
    }
    if (emailInput && cachedEmail) {
      emailInput.value = cachedEmail;
      waEmail = cachedEmail;
    }

    const sc = window._shopifyCustomer;
    if (sc && sc.logged_in) {
      if (sc.email && emailInput) {
        emailInput.value = sc.email;
        waEmail = sc.email;
        waSaveEmailGlobally(sc.email);
      }
      if (sc.addresses && sc.addresses.length > 0) {
        waAddresses = sc.addresses.map(a => ({
          id: 'shopify_' + a.id,
          first_name: a.first_name || '',
          last_name: a.last_name || '',
          address1: a.address1 || '',
          city: a.city || '',
          zip: a.zip || '',
          province: a.province || '',
          country: a.country || 'India'
        }));
        waShopifyAddressesLoaded = true;
      }
    }

    // Immediately jump to Step 3 if user is already logged in / cached
    if (cachedPhone) {
      waPhone = cachedPhone;
      waSavePhoneGlobally(cachedPhone);
      document.getElementById('wa-step-1').style.display = 'none';
      document.getElementById('wa-step-2').style.display = 'none';
      document.getElementById('wa-step-3').style.display = 'block';
      
      const activeEmail = cachedEmail || (emailInput ? emailInput.value : '');
      if (activeEmail && emailInput) {
        emailInput.value = activeEmail;
        waEmail = activeEmail;
      }
      waSetStep(3);
      loadAddresses();
      calculateCheckoutTotals();
      fetchWalletBalance();
    }

    // Run identify asynchronously in background so modal opens instantly
    (async () => {
      try {
        const device_id = localStorage.getItem('fit11_device_id') || ('dev_' + Math.random().toString(36).substr(2, 9));
        localStorage.setItem('fit11_device_id', device_id);
        const res = await fetch(`${WA_API_BASE}/identify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id, merchant_key: MERCHANT_KEY, include_settings: true })
        });
        const data = await res.json();
        if (data.payment_settings && Object.keys(data.payment_settings).length > 0) {
          waPaymentSettings = data.payment_settings;
          const _ps = data.payment_settings;
          waSelectedPayment = null;
          calculateCheckoutTotals();
          const _sv = (name, val, fb) => document.documentElement.style.setProperty(name, val || fb);
          _sv('--wa-theme',      _ps.theme_color,    '#0f172a');
          _sv('--wa-bg',         _ps.bg_main,        '#f1f5f9');
          _sv('--wa-card-bg',    _ps.bg_card,        '#ffffff');
          _sv('--wa-header-bg',  _ps.bg_header,      '#0f172a');
          _sv('--wa-heading',    _ps.text_heading,   '#0f172a');
          _sv('--wa-subheading', _ps.text_subheading,'#64748b');
          _sv('--wa-label',      _ps.text_label,     '#374151');
          _sv('--wa-success',    _ps.accent_success, '#16a34a');
          _sv('--wa-border',     _ps.accent_border,  '#e2e8f0');

          if (_ps.logo_url) {
            const logoImg = `<img src="${_ps.logo_url}" alt="Store Logo" style="max-height:40px;max-width:150px;object-fit:contain;display:block;" />`;
            const mobileBrand = document.getElementById('wa-brand-name-mobile');
            if (mobileBrand) mobileBrand.innerHTML = logoImg;
          }

          const _emailInput = document.getElementById('wa-email');
          const _emailBadge = document.getElementById('wa-email-badge');
          if (_ps.email_required === true) {
            if (_emailInput) { _emailInput.required = true; _emailInput.placeholder = 'you@example.com'; }
            if (_emailBadge) { _emailBadge.textContent = '(Required)'; _emailBadge.style.color = '#f59e0b'; }
          } else {
            if (_emailInput) { _emailInput.required = false; _emailInput.placeholder = 'you@example.com (Optional)'; }
            if (_emailBadge) { _emailBadge.textContent = '(Optional)'; _emailBadge.style.color = '#94a3b8'; }
          }
        }
        
        if (data.first_name) {
          waUpdateHeaderGreeting(data.first_name);
        }

        if (data.identified && data.masked_phone && !cachedPhone) {
          const title1 = document.getElementById('wa-title-1');
          const desc1 = document.getElementById('wa-desc-1');
          if (title1) title1.innerText = 'Welcome Back!';
          if (desc1) desc1.innerText = 'Continue as ' + data.masked_phone + '?';
          
          if (!title1 && !document.getElementById('wa-dynamic-welcome')) {
            const step1 = document.getElementById('wa-step-1');
            if (step1) {
               const welcomeHtml = `
                 <div id="wa-dynamic-welcome" style="margin-bottom:24px;">
                   <h2 style="font-size:26px; font-weight:800; margin-bottom:8px; color:#0f172a; letter-spacing:-0.5px;">Welcome Back!</h2>
                   <p style="font-size:15px; color:#475569;">Continue as <strong style="color:#0f172a;">${data.masked_phone}</strong>?</p>
                 </div>
               `;
               step1.insertAdjacentHTML('afterbegin', welcomeHtml);
            }
          }

          const pCont = document.getElementById('wa-phone-container'); if(pCont) pCont.style.display = 'none';
          const pSec = document.getElementById('wa-phone-input-section'); if(pSec) pSec.style.display = 'none';
          const midTb = document.getElementById('wa-mid-trust-badges'); if(midTb) midTb.style.display = 'none';
          const greenBox = document.getElementById('wa-green-otp-box'); if(greenBox) greenBox.style.display = 'none';
          const switchAcc = document.getElementById('wa-switch-account'); if(switchAcc) switchAcc.style.display = 'block';
          waPhone = 'MASKED';
          if (data.storeCreditBalance) {
            waWalletBalance = parseFloat(data.storeCreditBalance || 0);
          }
          if (data.email) {
            const em = document.getElementById('wa-email');
            if (em) em.value = data.email;
          }
        }
      } catch(e) { console.error('Identify error:', e); }
    })();
  }

  function waResetModal() {
    document.getElementById('wa-step-1').style.display = 'block';
    document.getElementById('wa-step-2').style.display = 'none';
    document.getElementById('wa-step-3').style.display = 'none';
    document.getElementById('wa-success-screen').style.display = 'none';
    document.getElementById('wa-steps-indicator').style.display = 'flex';
    
    const closeBtn = document.getElementById('wa-close-modal-btn');
    if (closeBtn) closeBtn.style.display = 'flex';
    
    const scBox = document.getElementById('wa-success-order-number');
    if (scBox) scBox.style.display = 'none';
    
    waSetStep(1);
  }

  
  function waSetStep(step) {
    let uiStep = step;
    if (step === 4) uiStep = 3;
    [1,2,3].forEach(i => {
      const dot = document.getElementById('wa-dot-' + i);
      if (dot) {
        if(i < uiStep) { 
          dot.innerHTML = i;
          dot.style.background = '#16a34a'; dot.style.color = '#fff'; dot.style.border = 'none'; 
        } else if(i === uiStep) { 
          dot.innerHTML = i;
          dot.style.background = '#0f172a'; dot.style.color = '#fff'; dot.style.border = 'none'; 
        } else { 
          dot.innerHTML = i;
          dot.style.background = '#fff'; dot.style.color = '#94a3b8'; dot.style.border = '1px solid #e2e8f0'; 
        }
      }
    });
    [1,2].forEach(i => {
      const line = document.getElementById('wa-line-' + i);
      if (line) line.style.background = i < uiStep ? '#16a34a' : '#e2e8f0';
    });
    const lbl = document.getElementById('wa-step-label');
    if (lbl) lbl.innerText = 'STEP ' + uiStep + ' OF 3';
  
    const indicator = document.getElementById('wa-steps-indicator');
    if (indicator) {
      indicator.style.display = 'flex';
    }
    const dotsContainer = document.getElementById('wa-dots-container');
    if (dotsContainer) {
      dotsContainer.style.display = 'none';
    }
    
    // Toggle Trust Badges & Change Number button based on step
    const trustBadges = document.getElementById('wa-top-trust-badges');
    const changeNumBtn = document.getElementById('wa-change-number-btn');
    if (trustBadges) trustBadges.style.display = uiStep >= 3 ? 'none' : 'flex';
    if (changeNumBtn) changeNumBtn.style.display = uiStep >= 3 ? 'block' : 'none';
  }

  function waGoToStep(step) {
    if (step === 4) {
      const emailEl = document.getElementById('wa-email');
      let errEl = document.getElementById('wa-email-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.id = 'wa-email-error';
        errEl.style.color = '#ef4444';
        errEl.style.fontSize = '12px';
        errEl.style.marginTop = '6px';
        errEl.style.fontWeight = '600';
        if (emailEl) emailEl.parentElement.parentElement.parentElement.appendChild(errEl);
      }
      
      if (emailEl && waPaymentSettings && waPaymentSettings.email_required === true && !emailEl.value.trim()) {
        errEl.innerText = 'Please enter your email address to continue.';
        errEl.style.display = 'block';
        emailEl.focus();
        return;
      }
      if (emailEl && emailEl.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
        errEl.innerText = 'Please enter a valid email address.';
        errEl.style.display = 'block';
        emailEl.focus();
        return;
      }
      if (errEl) errEl.style.display = 'none';
      if (emailEl) waEmail = emailEl.value.trim();
    }

    document.getElementById('wa-step-1').style.display = 'none';
    document.getElementById('wa-step-2').style.display = 'none';
    document.getElementById('wa-step-3').style.display = 'none';
    document.getElementById('wa-step-4').style.display = 'none';
    document.getElementById('wa-step-' + step).style.display = 'block';
    waSetStep(step);
    if (step === 4) {
      if (typeof renderPaymentMethods === 'function') {
        renderPaymentMethods();
      }
    }
  }

  function closeWaModal() {
    const overlay = document.getElementById('wa-otp-overlay');
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function waSwitchAccount(e) {
    if (e) e.preventDefault();
    const title1 = document.getElementById('wa-title-1');
    if (title1) title1.innerText = 'Swift Checkout';
    const desc1 = document.getElementById('wa-desc-1');
    if (desc1) desc1.innerText = 'Enter your WhatsApp number to receive an OTP and complete your order in seconds.';
    
    // Remove the dynamic welcome message if it exists
    const dynWelcome = document.getElementById('wa-dynamic-welcome');
    if (dynWelcome) dynWelcome.remove();
    
    const pCont = document.getElementById('wa-phone-container'); if(pCont) pCont.style.display = 'block';
    const pSec = document.getElementById('wa-phone-input-section'); if(pSec) pSec.style.display = 'block';
    const midTb = document.getElementById('wa-mid-trust-badges'); if(midTb) midTb.style.display = 'flex';
    const greenBox = document.getElementById('wa-green-otp-box'); if(greenBox) greenBox.style.display = 'flex';
    
    const switchAcct = document.getElementById('wa-switch-account'); if (switchAcct) switchAcct.style.display = 'none';
    waPhone = null;
    
    // Clear persisted sessions when switching accounts
    sessionStorage.removeItem('fit11_verified_phone');
    sessionStorage.removeItem('fit11_verified_email');
    localStorage.removeItem('fit11_verified_phone');
    localStorage.removeItem('fit11_verified_email');
    localStorage.removeItem('wa_saved_phone');
    localStorage.removeItem('wa_user_phone');
    localStorage.removeItem('fit11_user_phone');
    document.cookie = 'wa_saved_phone=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    
    const phoneInput = document.getElementById('wa-phone');
    if (phoneInput) {
      phoneInput.value = '';
      setTimeout(() => phoneInput.focus(), 100);
    }
    
    if (typeof waGoToStep !== 'undefined') {
      waGoToStep(1);
    }
  }

  // OTP box navigation
  function waOtpInput(el, idx) {
    el.value = el.value.replace(/\D/g, '');
    if (el.value.length === 1) {
      const boxes = document.querySelectorAll('.wa-otp-box');
      if (idx < 3) boxes[idx + 1].focus();
    }
    if (waGetOtp().length === 4) {
      verifyWaOtp();
    }
  }
  function waOtpKey(e, idx) {
    if (e.key === 'Backspace') {
      const boxes = document.querySelectorAll('.wa-otp-box');
      if (!boxes[idx].value && idx > 0) boxes[idx - 1].focus();
    }
  }
  function waGetOtp() {
    return [...document.querySelectorAll('.wa-otp-box')].map(b => b.value).join('');
  }

  async function sendWaOtp() {
    let phoneInputEl = document.getElementById('wa-phone');
    let phoneInput = phoneInputEl ? waCleanPhoneInput(phoneInputEl) : '';
    if (waPhone !== 'MASKED') {
      if (phoneInput.length < 10) return alert('Please enter a valid 10-digit mobile number');
      waPhone = phoneInput;
      localStorage.setItem('wa_saved_phone', waPhone);
      localStorage.setItem('fit11_user_phone', waPhone);
    }
    // Validation moved to final checkout / address save
    const btn = document.getElementById('wa-send-btn');
    const originalBtnHTML = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = 'Sending OTP...';
    try {
      const payload = { 
        merchant_key: MERCHANT_KEY,
        device_id: localStorage.getItem('fit11_device_id') || localStorage.getItem('wa_device_id')
      };
      if (waPhone !== 'MASKED') payload.phone = waPhone;
      const res = await fetch(`${WA_API_BASE}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      waOtpSendCount++;
      startResendTimer();
      
      waSignature = data.signature;
      if (data.real_phone) waPhone = data.real_phone;
      document.getElementById('wa-otp-desc').innerText = waPhone.startsWith('+') ? waPhone : '+91 ' + waPhone;
      document.getElementById('wa-step-1').style.display = 'none';
      document.getElementById('wa-step-2').style.display = 'block';
      waSetStep(2);
      setTimeout(() => document.querySelectorAll('.wa-otp-box')[0].focus(), 100);
    } catch (err) {
      const errMsg = err.message || 'Failed to send OTP. Please try again.';
      console.error('OTP Error:', errMsg);
      alert(errMsg);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalBtnHTML;
    }
  }

  function startResendTimer() {
    clearInterval(waResendInterval);
    let timeLeft = waOtpSendCount === 1 ? 60 : 300;
    const link = document.getElementById('wa-resend-link');
    const timerText = document.getElementById('wa-resend-timer');
    const timerWrap = document.getElementById('wa-resend-timer-wrap');
    
    link.style.display = 'none';
    if(timerWrap) timerWrap.style.display = 'flex';
    
    waResendInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(waResendInterval);
        link.style.display = 'inline-block';
        if(timerWrap) timerWrap.style.display = 'none';
      } else {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        timerText.innerText = `Resend OTP in ${m}:${s.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  async function verifyWaOtp() {
    const btn = document.getElementById('wa-verify-btn');
    if (btn.disabled) return; // Prevent double-submit
    const otp = waGetOtp();
    if (otp.length < 4) return;
    const errEl = document.getElementById('wa-otp-error');
    const originalBtnHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Verifying...';
    errEl.style.display = 'none';
    try {
      const res = await fetch(`${WA_API_BASE}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_key: MERCHANT_KEY,
          phone: waPhone,
          otp,
          signature: waSignature,
          device_id: localStorage.getItem('fit11_device_id'),
          email: typeof waEmail !== 'undefined' ? waEmail : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP');
      
      // Save to session so they don't have to re-verify if they navigate away and come back
      sessionStorage.setItem('fit11_verified_phone', waPhone);
      localStorage.setItem('fit11_verified_phone', waPhone);
      document.cookie = `wa_saved_phone=${waPhone}; path=/; max-age=2592000`; // 30 days
      
      if (data.profile && data.profile.email) {
        sessionStorage.setItem('fit11_verified_email', data.profile.email);
        localStorage.setItem('fit11_verified_email', data.profile.email);
        const emailInput = document.getElementById('wa-email');
        if (emailInput) emailInput.value = data.profile.email;
      }
      if (data.profile && data.profile.first_name) {
        waUpdateHeaderGreeting(data.profile.first_name);
      } else {
        waUpdateHeaderGreeting();
      }

      // Store wallet balance from verify response (avoids extra API call at payment step)
      if (data.storeCreditBalance !== undefined) {
        waWalletBalance = parseFloat(data.storeCreditBalance) || 0;
      }
      
      document.getElementById('wa-step-2').style.display = 'none';
      document.getElementById('wa-step-3').style.display = 'block';
      waSetStep(3);
      await loadAddresses();
      await calculateCheckoutTotals();
    } catch (err) {
      errEl.innerText = err.message || 'Invalid OTP. Please try again.';
      errEl.style.display = 'block';
      document.querySelectorAll('.wa-otp-box').forEach(b => b.value = '');
      document.querySelectorAll('.wa-otp-box')[0].focus();
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalBtnHTML;
    }
  }

  async function loadAddresses() {
    try {
      const cached = sessionStorage.getItem(`wa_addr_${waPhone}`);
        if (cached) {
          const networkAddrs = JSON.parse(cached);
          const combined = [...waAddresses, ...networkAddrs];
          const unique = [];
          const seen = new Set();
          combined.forEach(a => {
            const str = `${a.first_name} ${a.address1} ${a.city} ${a.zip}`.toLowerCase().trim();
            if(!seen.has(str)) { seen.add(str); unique.push(a); }
          });
          waAddresses = unique;
          renderAddresses();
          return;
        }
        const res = await fetch(`${WA_API_BASE}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_key: MERCHANT_KEY, phone: waPhone, action: 'FETCH' })
      });
      let data = {};
      try { data = await res.json(); } catch(e) {}
      const networkAddrs = data.addresses || [];
        sessionStorage.setItem(`wa_addr_${waPhone}`, JSON.stringify(networkAddrs));
      
      // Combine existing loaded ones (from Shopify Liquid) and fetched ones
      const combined = [...waAddresses, ...networkAddrs];
      
      // Strong Deduplication based on address string to prevent duplicates
      const unique = [];
      const seen = new Set();
      
      for (const a of combined) {
        // Create a normalized key (lowercase, no spaces)
        const normalize = (str) => (str || '').toLowerCase().replace(/\s/g, '');
        const key = normalize(a.address1) + normalize(a.zip);
        
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(a);
        } else if (String(a.id).startsWith('shopify_') && !unique.find(u => String(u.id).startsWith('shopify_') && normalize(u.address1)+normalize(u.zip) === key)) {
          // Prefer shopify address ID if we have a duplicate
          const existingIdx = unique.findIndex(u => normalize(u.address1)+normalize(u.zip) === key);
          if (existingIdx !== -1 && !String(unique[existingIdx].id).startsWith('shopify_')) {
              unique[existingIdx] = a; // Replace local with shopify equivalent
          }
        }
      }

      if (data.email) {
        waSaveEmailGlobally(data.email);
        const emailInput = document.getElementById('wa-email');
        if (emailInput && (!emailInput.value || !emailInput.value.trim())) {
          emailInput.value = data.email;
          waEmail = data.email;
        }
      }
      
      waAddresses = unique;
      renderAddresses();
    } catch (e) { renderAddresses(); }
  }

  function renderAddresses() {
    try {
    const list = document.getElementById('wa-address-list');
    if (list) list.innerHTML = '';
    if (!waAddresses || waAddresses.length === 0) {
      waShowAddressForm();
      const codBtn = document.getElementById('wa-cod-btn');
      if (codBtn) codBtn.disabled = true;
      return;
    }
    const addBtn = document.getElementById('wa-add-addr-btn');
    if (addBtn) addBtn.style.display = 'block';
    const dh = document.getElementById('wa-deliver-here-btn'); if(dh) dh.style.display = 'flex';
    const formEl = document.getElementById('wa-new-address-form');
    if (formEl) formEl.style.display = 'none';
    const alList = document.getElementById('wa-address-list'); if (alList) alList.style.display = 'block';

    if (!waSelectedAddress) waSelectedAddress = waAddresses[0].id;

    // Find the selected address, fallback to first if not found
    let primary = waAddresses.find(a => a.id == waSelectedAddress) || waAddresses[0];
    waSelectedAddress = primary.id;
    const otherAddresses = waAddresses.filter(a => a.id != primary.id);

    let html = `
        <div class="wa-address-card selected" style="padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="cursor:pointer; flex:1;" onclick="waSelectAddress('${primary.id}')">
              <div class="wa-addr-name">${primary.first_name} ${primary.last_name}</div>
              <div class="wa-addr-text">${primary.address1}<br/>${primary.city} - ${primary.zip}</div>
              ${primary.company ? `<div class="wa-addr-text" style="color:#94a3b8;">${primary.company}</div>` : ''}
              
              <div style="display:flex;gap:12px;margin-top:10px;position:relative;z-index:2;">
                <button onclick="(function(e){ e.stopPropagation(); waEditAddress('${primary.id}'); })(event)" style="background:none;border:none;color:#3b82f6;font-size:13px;font-weight:600;cursor:pointer;padding:4px 8px;margin-left:-8px;text-decoration:none;">Edit</button>
                <button onclick="(function(e){ e.stopPropagation(); waDeleteAddress('${primary.id}'); })(event)" style="background:none;border:none;color:#ef4444;font-size:13px;font-weight:600;cursor:pointer;padding:4px 8px;text-decoration:none;">Delete</button>
              </div>
            </div>
          </div>
        </div>
    `;

    // Render the rest in an accordion if there are more
    if (otherAddresses.length > 0) {
      html += `
        <button type="button" onclick="document.getElementById('wa-other-addresses').style.display = document.getElementById('wa-other-addresses').style.display === 'none' ? 'block' : 'none';" style="width:100%;text-align:center;background:none;border:none;color:#64748b;font-size:13px;font-weight:600;cursor:pointer;margin: 8px 0 16px;">
          View ${otherAddresses.length} Other Addresses ▼
        </button>
        <div id="wa-other-addresses" style="display:none; margin-bottom: 16px;">
      `;
      otherAddresses.forEach(a => {
        html += `
          <div class="wa-address-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div style="cursor:pointer; flex:1;" onclick="waSelectAddress('${a.id}')">
                <div class="wa-addr-name">${a.first_name} ${a.last_name}</div>
                <div class="wa-addr-text">${a.address1}<br/>${a.city} - ${a.zip}</div>
                ${a.company ? `<div class="wa-addr-text" style="color:#94a3b8;">${a.company}</div>` : ''}
                
                <div style="display:flex;gap:12px;margin-top:10px;position:relative;z-index:2;">
                  <button onclick="(function(e){ e.stopPropagation(); waEditAddress('${a.id}'); })(event)" style="background:none;border:none;color:#3b82f6;font-size:13px;font-weight:600;cursor:pointer;padding:4px 8px;margin-left:-8px;text-decoration:none;">Edit</button>
                  <button onclick="(function(e){ e.stopPropagation(); waDeleteAddress('${a.id}'); })(event)" style="background:none;border:none;color:#ef4444;font-size:13px;font-weight:600;cursor:pointer;padding:4px 8px;text-decoration:none;">Delete</button>
                </div>
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    if (list) list.innerHTML = html;
    const codBtnEl = document.getElementById('wa-cod-btn');
    if (codBtnEl) codBtnEl.disabled = false;
    } catch(e) { console.error('Error in renderAddresses:', e); }
  }

  function waShowAddressForm() {
    try {
    waEditingAddressId = null;
    const addBtn2 = document.getElementById('wa-add-addr-btn'); if(addBtn2) addBtn2.style.display = 'none';
    const dh = document.getElementById('wa-deliver-here-btn'); if(dh) dh.style.display = 'none';
    const formEl2 = document.getElementById('wa-new-address-form'); if(formEl2) formEl2.style.display = 'block';
    const al = document.getElementById('wa-address-list'); if (al) al.style.display = 'none';
    const cancelBtn = document.getElementById('wa-cancel-addr-btn');
    if (cancelBtn) {
      if (typeof waAddresses !== 'undefined' && waAddresses && waAddresses.length > 0) {
        cancelBtn.style.display = 'block';
      } else {
        cancelBtn.style.display = 'none';
      }
    }
    const saveBtn = document.getElementById('wa-save-addr-btn'); if(saveBtn) saveBtn.innerText = 'Save Address';
    
    // Clear fields correctly safely
    ['wa-first-name','wa-last-name','wa-address1','wa-address2','wa-city','wa-zip','wa-province','wa-addr-district'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    const citySelectWrap = document.getElementById('wa-city-select-wrapper');
    if (citySelectWrap) citySelectWrap.style.display = 'none';
    const addrCityInp = document.getElementById('wa-addr-city-input');
    if (addrCityInp) addrCityInp.style.display = 'block';
    
    const addrState = document.getElementById('wa-addr-state');
    if (addrState) { addrState.readOnly = false; addrState.style.cursor = 'text'; addrState.style.background = '#fff'; }
    
    const waProv = document.getElementById('wa-province');
    if (waProv) { waProv.readOnly = false; waProv.style.cursor = 'text'; waProv.style.background = '#fff'; }
    
    const dist = document.getElementById('wa-addr-district');
    if (dist) { dist.readOnly = false; dist.style.cursor = 'text'; dist.style.background = '#fff'; }
    
    const errEl = document.getElementById('wa-pin-error');
    if (errEl) errEl.style.display = 'none';
    const statEl = document.getElementById('wa-pin-status');
    if (statEl) statEl.innerText = '';
    } catch(e) { console.error('Error in waShowAddressForm:', e); }
  }

  function waEditAddress(id) {
    const addr = waAddresses.find(a => String(a.id) === String(id));
    if (!addr) return;
    waEditingAddressId = id;
    
    const addBtn = document.getElementById('wa-add-addr-btn');
    if(addBtn) addBtn.style.display = 'none';
    const dh = document.getElementById('wa-deliver-here-btn'); 
    if(dh) dh.style.display = 'none';
    
    const formEl = document.getElementById('wa-new-address-form');
    if(formEl) formEl.style.display = 'block';
    
    const saveBtn = document.getElementById('wa-save-addr-btn');
    if(saveBtn) saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Update Address';
    
    if(document.getElementById('wa-first-name')) document.getElementById('wa-first-name').value = addr.first_name || '';
    if(document.getElementById('wa-last-name')) document.getElementById('wa-last-name').value = addr.last_name || '';
    if(document.getElementById('wa-address1')) document.getElementById('wa-address1').value = addr.address1 || '';
    let extractedAddr2 = addr.address2 || '';
    let extractedDistrict = addr.company ? addr.company.replace('District: ', '') : '';
    
    if (extractedAddr2.includes('District: ')) {
        const parts = extractedAddr2.split(/\s*\|?\s*District:\s*/);
        if (parts.length > 1) {
            extractedAddr2 = parts[0].trim();
            extractedDistrict = parts[1].trim();
        }
    }
    
    if(document.getElementById('wa-address2')) document.getElementById('wa-address2').value = extractedAddr2;
    if(document.getElementById('wa-zip')) document.getElementById('wa-zip').value = addr.zip || '';
    
    // City
    const cityInput = document.getElementById('wa-city');
    const citySelect = document.getElementById('wa-addr-city-select');
    if (citySelect) citySelect.style.display = 'none';
    if (cityInput) { 
        cityInput.value = addr.city || ''; 
        cityInput.style.display = 'block';
        cityInput.readOnly = false;
        cityInput.style.cursor = 'text';
    }
    
    // State
    const stateInput = document.getElementById('wa-province');
    if(stateInput) stateInput.value = addr.province || '';
    const stateSelect = document.getElementById('wa-province-select');
    if(stateSelect) {
        stateSelect.value = addr.province || '';
        stateSelect.style.display = 'block';
    }
    
    // District
    const districtInput = document.getElementById('wa-addr-district');
    if(districtInput) {
        districtInput.value = extractedDistrict;
        districtInput.readOnly = false;
        districtInput.style.cursor = 'text';
        districtInput.style.background = '#fff';
    }
    
    const errEl = document.getElementById('wa-pin-error');
    if (errEl) errEl.style.display = 'none';
    const statusEl = document.getElementById('wa-pin-status');
    if (statusEl) statusEl.innerText = '';
  }

  async function waDeleteAddress(id) {
    if (!confirm('Are you sure you want to delete this address?')) return;
    
    // Optimistically hide it
    const list = document.getElementById('wa-address-list');
    list.style.opacity = '0.5';

    try {
      await fetch(`${WA_API_BASE}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          merchant_key: MERCHANT_KEY, 
          phone: waPhone, 
          action: 'DELETE', 
          address_data: { id: id } 
        })
      });
      // Remove from memory and re-render instantly without reloading from server
      waAddresses = waAddresses.filter(a => String(a.id) !== String(id));
      renderAddresses();
    } catch (e) {
      alert('Failed to delete address.');
    } finally {
      list.style.opacity = '1';
    }
  }

  function waSelectAddress(id) {
    waSelectedAddress = id;
    renderAddresses();
  }

  // ── PINCODE LOOKUP ──
  
  // Union Territories and city-states that need dropdown
  const WA_UT_STATES = {
    'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Central Delhi', 'North West Delhi', 'North East Delhi', 'South West Delhi', 'Shahdara'],
    'Chandigarh': ['Chandigarh'],
    'Puducherry': ['Puducherry', 'Karaikal', 'Mahé', 'Yanam'],
    'Lakshadweep': ['Kavaratti', 'Agatti', 'Amini', 'Andrott'],
    'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
    'Andaman and Nicobar Islands': ['Port Blair', 'Car Nicobar', 'Campbell Bay'],
    'Ladakh': ['Leh', 'Kargil'],
    'Jammu and Kashmir': ['Jammu', 'Srinagar', 'Anantnag', 'Baramulla']
  };

  function waResetPinFields() {
    const stateInput = document.getElementById('wa-province');
    const stateSelect = document.getElementById('wa-province-select');
    const districtEl = document.getElementById('wa-addr-district');
    const cityInput = document.getElementById('wa-city');
    const citySelect = document.getElementById('wa-addr-city-select');
    const errEl = document.getElementById('wa-pin-error');
    const statusEl = document.getElementById('wa-pin-status');

    // Unlock & show text inputs
    if (stateInput) { stateInput.value = ''; stateInput.readOnly = false; stateInput.style.display = 'block'; stateInput.style.background = ''; stateInput.style.cursor = ''; }
    if (stateSelect) stateSelect.style.display = 'none';
    if (districtEl) { districtEl.value = ''; districtEl.readOnly = false; districtEl.style.background = ''; districtEl.style.cursor = ''; }
    if (cityInput) { cityInput.value = ''; cityInput.style.display = 'block'; }
    if (citySelect) { citySelect.style.display = 'none'; citySelect.innerHTML = ''; }
    if (errEl) errEl.style.display = 'none';
    if (statusEl) statusEl.textContent = '';
  }

  async function waLookupPincode(pin) {
    if (!pin || pin.length !== 6) return;
    
    const spinner = document.getElementById('wa-pin-spinner');
    const statusEl = document.getElementById('wa-pin-status');
    const errEl = document.getElementById('wa-pin-error');
    const stateInput = document.getElementById('wa-province');
    const stateSelect = document.getElementById('wa-province-select');
    const districtEl = document.getElementById('wa-addr-district');
    const cityInput = document.getElementById('wa-city');
    const citySelect = document.getElementById('wa-addr-city-select');

    if (spinner) spinner.style.display = 'inline';
    if (statusEl) statusEl.textContent = 'Looking up...';
    if (errEl) errEl.style.display = 'none';

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();

      if (data && data[0] && data[0].Status === 'Success') {
        const postOffices = data[0].PostOffice;
        const firstPo = postOffices[0];
        const stateName = firstPo.State || '';
        const districtName = firstPo.District || '';

        // Auto-fill & lock District
        if (districtEl) {
          districtEl.value = districtName;
          districtEl.readOnly = true;
          districtEl.style.background = '#f8fafc';
          districtEl.style.cursor = 'not-allowed';
        }

        // Check if this is a UT/city-state that needs a dropdown
        const isUT = WA_UT_STATES.hasOwnProperty(stateName);

        if (isUT) {
          // Show state dropdown
          if (stateInput) stateInput.style.display = 'none';
          if (stateSelect) {
            stateSelect.innerHTML = '';
            const cities = WA_UT_STATES[stateName];
            cities.forEach(c => {
              const opt = document.createElement('option');
              opt.value = c; opt.textContent = c;
              stateSelect.appendChild(opt);
            });
            // Put the state name itself as a locked option 
            stateSelect.innerHTML = '<option value="' + stateName + '" selected>' + stateName + '</option>';
            stateSelect.disabled = true;
            stateSelect.style.display = 'block';
            stateSelect.style.background = '#f8fafc';
          }
        } else {
          // Normal state - auto-fill text input
          if (stateInput) {
            stateInput.value = stateName;
            stateInput.readOnly = true;
            stateInput.style.display = 'block';
            stateInput.style.background = '#f8fafc';
            stateInput.style.cursor = 'not-allowed';
          }
          if (stateSelect) stateSelect.style.display = 'none';
        }

        // Populate city/area dropdown from post offices
        const uniqueAreas = [...new Set(postOffices.map(po => po.Name))].sort();
        if (citySelect) {
          citySelect.innerHTML = '';
          uniqueAreas.forEach(area => {
            const opt = document.createElement('option');
            opt.value = area; opt.textContent = area;
            citySelect.appendChild(opt);
          });
          citySelect.style.display = 'block';
          citySelect.style.cursor = 'pointer';
          // Sync with city hidden input
          citySelect.onchange = () => { if (cityInput) cityInput.value = citySelect.value; };
        }
        if (cityInput) {
          cityInput.value = uniqueAreas[0] || '';
          cityInput.style.display = 'none';
        }

        if (statusEl) statusEl.innerHTML = '<span style="color:#16a34a; font-weight:700;">✓ Location found</span>';

      } else {
        throw new Error('PIN not found');
      }

    } catch(e) {
      // API failed - provide manual fallback with state dropdown
      if (statusEl) statusEl.innerHTML = '<span style="color:#f59e0b; font-weight:600;">⚠ Enter manually</span>';
      if (errEl) {
        errEl.textContent = 'Could not auto-fill. Please select/enter your location below.';
        errEl.style.display = 'block';
      }

      // Unlock district & show text input
      if (districtEl) { districtEl.readOnly = false; districtEl.style.background = ''; districtEl.style.cursor = ''; }

      // Show state dropdown with all Indian states + UTs
      const allStates = [
        'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
        'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
        'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
        'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
        'Uttarakhand','West Bengal',
        '-- Union Territories --',
        'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
        'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
      ];

      if (stateInput) stateInput.style.display = 'none';
      if (stateSelect) {
        stateSelect.innerHTML = '<option value="">-- Select State --</option>';
        allStates.forEach(s => {
          const opt = document.createElement('option');
          if (s.startsWith('--')) { opt.disabled = true; opt.textContent = s; }
          else { opt.value = s; opt.textContent = s; }
          stateSelect.appendChild(opt);
        });
        stateSelect.disabled = false;
        stateSelect.style.background = '';
        stateSelect.style.display = 'block';
        stateSelect.style.cursor = 'pointer';

        // When state is selected, show city dropdown or text based on UT
        stateSelect.onchange = () => {
          const sel = stateSelect.value;
          if (stateInput) stateInput.value = sel;
          
          if (WA_UT_STATES.hasOwnProperty(sel)) {
            // Show city dropdown for UT
            if (citySelect) {
              citySelect.innerHTML = '<option value="">-- Select City --</option>';
              WA_UT_STATES[sel].forEach(c => {
                const opt = document.createElement('option');
                opt.value = c; opt.textContent = c;
                citySelect.appendChild(opt);
              });
              citySelect.style.display = 'block';
              citySelect.onchange = () => { if (cityInput) cityInput.value = citySelect.value; };
            }
            if (cityInput) cityInput.style.display = 'none';
          } else {
            // Regular state - free text city
            if (citySelect) citySelect.style.display = 'none';
            if (cityInput) { cityInput.style.display = 'block'; cityInput.value = ''; cityInput.readOnly = false; }
          }
        };
      }

      // City - keep text input visible by default
      if (citySelect) citySelect.style.display = 'none';
      if (cityInput) { cityInput.style.display = 'block'; cityInput.readOnly = false; }

    } finally {
      if (spinner) spinner.style.display = 'none';
    }
  }

  async function waSaveNewAddress() {
    // Get city - prefer city text input (synced from select) or select value
    const cityInput = document.getElementById('wa-city');
    const citySelect = document.getElementById('wa-addr-city-select');
    const citySelectVisible = citySelect && citySelect.style.display !== 'none';
    const cityVal = citySelectVisible ? (citySelect.value || cityInput.value || '').trim() : (cityInput ? cityInput.value.trim() : '');

    // Get state - prefer text input, fallback to select
    const stateInput = document.getElementById('wa-province');
    const stateSelect = document.getElementById('wa-province-select');
    const stateSelectVisible = stateSelect && stateSelect.style.display !== 'none';
    const stateVal = stateSelectVisible ? (stateSelect.value || '').trim() : (stateInput ? stateInput.value.trim() : '');

    const fname = (document.getElementById('wa-first-name') || {}).value?.trim() || '';
    const lname = (document.getElementById('wa-last-name') || {}).value?.trim() || '';
    const email = (document.getElementById('wa-email') || {}).value?.trim() || '';
    const address1 = (document.getElementById('wa-address1') || {}).value?.trim() || '';
    const address2 = (document.getElementById('wa-address2') || {}).value?.trim() || '';
    const zip = (document.getElementById('wa-zip') || {}).value?.trim() || '';
    const district = (document.getElementById('wa-addr-district') || {}).value?.trim() || '';

    const errEl = document.getElementById('wa-pin-error');

    // Validation
    if (!fname) { if (errEl) { errEl.textContent = 'Please enter your First Name.'; errEl.style.display = 'block'; } document.getElementById('wa-first-name').focus(); return; }
    if (!address1) { if (errEl) { errEl.textContent = 'Please enter your Address.'; errEl.style.display = 'block'; } document.getElementById('wa-address1').focus(); return; }
    if (!zip || zip.length !== 6) { if (errEl) { errEl.textContent = 'Please enter a valid 6-digit PIN code.'; errEl.style.display = 'block'; } document.getElementById('wa-zip').focus(); return; }
    if (!stateVal) { if (errEl) { errEl.textContent = 'Please select or enter your State.'; errEl.style.display = 'block'; } return; }
    if (!cityVal) { if (errEl) { errEl.textContent = 'Please select or enter your City.'; errEl.style.display = 'block'; } return; }

    let finalAddress2 = address2;
    if (district) {
        finalAddress2 = finalAddress2 ? finalAddress2 + ' | District: ' + district : 'District: ' + district;
    }
    const addr = {
      first_name: fname,
      last_name: lname,
      email: email,
      address1: address1,
      address2: finalAddress2,
      city: cityVal,
      zip: zip,
      province: stateVal,
      country: 'India',
      company: district ? 'District: ' + district : '' // Keep it for immediate use in UI
    };

    const btn = document.getElementById('wa-save-addr-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      await fetch(WA_API_BASE + '/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          merchant_key: MERCHANT_KEY, 
          phone: waPhone, 
          action: waEditingAddressId ? 'EDIT' : 'ADD', 
          address_data: waEditingAddressId ? Object.assign({ id: waEditingAddressId }, addr) : addr 
        })
      });
      document.getElementById('wa-new-address-form').style.display = 'none';
      document.getElementById('wa-add-addr-btn').style.display = 'block';
      if (errEl) errEl.style.display = 'none';
      waEditingAddressId = null;
      await loadAddresses();
    } catch (e) { 
      alert('Failed to save address. Error: ' + e.message); console.error(e); 
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Save & Deliver to this Address'; }
    }
  }

  async function calculateCheckoutTotals(discountCode = null) {
    const subT = document.getElementById('wa-subtotal');
    const totT = document.getElementById('wa-total');
    try {
      const cartRes = await fetch('/cart.js');
      const cart = await cartRes.json();
      
      const initialTotal = (cart.total_price / 100).toFixed(2);
      if (subT && (subT.innerText === 'Calculating...' || !subT.innerText)) subT.innerText = `₹${initialTotal}`;
      if (totT && (totT.innerText === '...' || !totT.getAttribute('data-base-total'))) {
        totT.innerText = `₹${initialTotal}`;
        totT.setAttribute('data-base-total', initialTotal);
      }

      const items = cart.items.map(i => ({ variant_id: i.variant_id, quantity: i.quantity }));
      const res = await fetch(`${WA_API_BASE}/checkout/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          merchant_key: MERCHANT_KEY, 
          items, 
          discount_code: discountCode,
          cart_discount: cart.total_discount || 0,
          cart_subtotal: cart.original_total_price || 0,
          phone: waPhone || null,
          device_id: localStorage.getItem('fit11_device_id') || localStorage.getItem('wa_device_id') || null,
          raw_cart: cart,
          utm_data: JSON.parse(localStorage.getItem('wa_utm_data') || '{}')
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to calculate');

      waDraftOrderId = data.draft_order_id;
      waInvoiceUrl = data.invoice_url;
      waAppliedDiscountCode = discountCode;
      
      document.getElementById('wa-subtotal').innerText = `₹${parseFloat(data.subtotal).toFixed(2)}`;
      document.getElementById('wa-total').innerText = `₹${parseFloat(data.total_price).toFixed(2)}`;
      document.getElementById('wa-total').setAttribute('data-base-total', parseFloat(data.total_price).toFixed(2));

      document.getElementById('wa-subtotal').innerText = '₹' + parseFloat(data.subtotal).toFixed(2);
      document.getElementById('wa-total').innerText = '₹' + parseFloat(data.total_price).toFixed(2);
      document.getElementById('wa-total').setAttribute('data-base-total', parseFloat(data.total_price).toFixed(2));
      
      const discEl = document.getElementById('wa-discount-amt');
      const yayEl = document.getElementById('wa-yay-saving');
      const yayAmt = document.getElementById('wa-yay-amt');
      
      if (data.discount_amount && parseFloat(data.discount_amount) > 0) {
        if(discEl) discEl.innerText = '-₹' + parseFloat(data.discount_amount).toFixed(2);
        if(yayEl) yayEl.style.display = 'flex';
        if(yayAmt) {
          let discVal = parseFloat(data.discount_amount);
          yayAmt.innerText = '₹' + (Number.isInteger(discVal) ? discVal.toString() : discVal.toFixed(2));
        }
      } else {
        if(discEl) discEl.innerText = '-₹0.00';
        if(yayEl) yayEl.style.display = 'none';
      }
      
      waPaymentSettings = data.payment_settings || {};
      if (data.storeCreditBalance) {
        waWalletBalance = parseFloat(data.storeCreditBalance || 0);
      }

      // Apply Branding — inject all theme CSS variables from admin settings
      const _ps = waPaymentSettings;
      const _setVar = (name, val, fallback) => {
        document.documentElement.style.setProperty(name, val || fallback);
      };
      _setVar('--wa-theme',      _ps.theme_color,    '#0f172a');
      _setVar('--wa-bg',         _ps.bg_main,        '#f1f5f9');
      _setVar('--wa-card-bg',    _ps.bg_card,        '#ffffff');
      _setVar('--wa-header-bg',  _ps.bg_header,      '#0f172a');
      _setVar('--wa-heading',    _ps.text_heading,   '#0f172a');
      _setVar('--wa-subheading', _ps.text_subheading,'#64748b');
      _setVar('--wa-label',      _ps.text_label,     '#374151');
      _setVar('--wa-success',    _ps.accent_success, '#16a34a');
      _setVar('--wa-border',     _ps.accent_border,  '#e2e8f0');

      if (_ps.font_family && _ps.font_family !== 'Inter') {
        if (!document.getElementById('wa-custom-font')) {
          const link = document.createElement('link');
          link.id = 'wa-custom-font';
          link.href = `https://fonts.googleapis.com/css2?family=${_ps.font_family.replace(/ /g, '+')}:wght@400;500;600;700;800&display=swap`;
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        }
        _setVar('--wa-font-family', `'${_ps.font_family}', -apple-system, sans-serif`);
      } else {
        _setVar('--wa-font-family', `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`);
      }

      if (_ps.logo_url) {
        const _logoImg = `<img src="${_ps.logo_url}" alt="Store Logo" style="max-height:40px;max-width:150px;object-fit:contain;display:block;" />`;
        const _leftBrand = document.getElementById('wa-brand-name-left');
        if (_leftBrand) _leftBrand.outerHTML = `<div id="wa-brand-name-left">${_logoImg}</div>`;
        const _mobileBrand = document.getElementById('wa-brand-name-mobile');
        if (_mobileBrand) _mobileBrand.innerHTML = _logoImg;
      }

      // Apply email required/optional setting from admin
      const _emailInput = document.getElementById('wa-email');
      const _emailBadge = document.getElementById('wa-email-badge');
      if (_ps.email_required === true) {
        if (_emailInput) { _emailInput.required = true; _emailInput.placeholder = 'you@example.com'; }
        if (_emailBadge) { _emailBadge.textContent = '(Required)'; _emailBadge.style.color = '#f59e0b'; }
      } else {
        if (_emailInput) { _emailInput.required = false; _emailInput.placeholder = 'you@example.com (Optional)'; }
        if (_emailBadge) { _emailBadge.textContent = '(Optional)'; _emailBadge.style.color = '#94a3b8'; }
      }

      if (document.getElementById('wa-step-4').style.display === 'block') {
          renderPaymentMethods();
      }

    } catch (e) {
      if (discountCode && String(e.message) === 'invalid_discount') {
        alert('The discount code entered is invalid or expired.');
        waAppliedDiscountCode = null;
        calculateCheckoutTotals(); // Recalculate without code
      } else {
        // Fallback: read from cart
        try {
          const cartRes = await fetch('/cart.js');
          const cart = await cartRes.json();
          const total = (cart.total_price / 100).toFixed(0);
          const subT = document.getElementById('wa-subtotal'); if (subT) subT.innerText = `₹${total}`;
          const totT = document.getElementById('wa-total'); if (totT) totT.innerText = `₹${total}`;
          if (totT) totT.setAttribute('data-base-total', total);
        } catch(e2) {
          const subT = document.getElementById('wa-subtotal'); if (subT) subT.innerText = 'See cart';
          const totT = document.getElementById('wa-total'); if (totT) totT.innerText = 'See cart';
        }
        
        if (document.getElementById('wa-step-4').style.display === 'block') {
          if (typeof renderPaymentMethods === 'function') renderPaymentMethods();
        }
      }
    }
  }

  async function waApplyCoupon() {
    const code = document.getElementById('wa-coupon-code').value.trim().toUpperCase();
    if (!code) return;
    const btn = document.querySelector('[onclick="waApplyCoupon()"]');
    const msgDiv = document.getElementById('wa-coupon-msg');
    const couponDiscRow = document.getElementById('wa-coupon-discount-row');
    const couponDiscAmt = document.getElementById('wa-coupon-discount-amt');
    
    if (btn) { btn.textContent = 'Checking...'; btn.disabled = true; }
    
    try {
      await calculateCheckoutTotals(code);
      
      if (waAppliedDiscountCode === code) {
        // Get the current coupon discount from the API response
        if (btn) {
          btn.textContent = '✓ Applied';
          btn.style.backgroundColor = '#16a34a';
          btn.style.color = '#fff';
          btn.style.border = '1.5px solid #16a34a';
        }
        if (msgDiv) {
          msgDiv.style.display = 'block';
          msgDiv.style.background = '#f0fdf4';
          msgDiv.style.color = '#15803d';
          msgDiv.style.border = '1px solid #bbf7d0';
          msgDiv.innerHTML = '🎉 Coupon <strong>' + code + '</strong> applied successfully!';
        }
      } else {
        if (btn) { btn.textContent = 'Apply'; btn.disabled = false; }
        if (msgDiv) {
          msgDiv.style.display = 'block';
          msgDiv.style.background = '#fef2f2';
          msgDiv.style.color = '#dc2626';
          msgDiv.style.border = '1px solid #fecaca';
          msgDiv.textContent = '❌ Invalid or expired coupon code.';
        }
      }
    } catch(e) {
      if (btn) { btn.textContent = 'Apply'; btn.disabled = false; }
      if (msgDiv) {
        msgDiv.style.display = 'block';
        msgDiv.style.background = '#fef2f2';
        msgDiv.style.color = '#dc2626';
        msgDiv.style.border = '1px solid #fecaca';
        msgDiv.textContent = '❌ Could not apply coupon. Please try again.';
      }
    }
  }

  async function waRemoveCoupon() {
    waAppliedDiscountCode = null;
    document.getElementById('wa-coupon-code').value = '';
    const btn = document.querySelector('.wa-coupon-apply');
    btn.innerText = 'Apply';
    btn.style.backgroundColor = '#f1f5f9';
    btn.style.color = 'var(--wa-theme, #0f172a)';
    btn.style.borderColor = '#e2e8f0';
    await calculateCheckoutTotals();
  }

  async function waProceedToPayment() {
    if (!waSelectedAddress) {
      alert('Please select a delivery address first.');
      return;
    }
    
    document.getElementById('wa-step-3').style.display = 'none';
    document.getElementById('wa-step-4').style.display = 'block';

    // Reset wallet state when entering payment step
    waWalletApplied = false;
    waWalletAppliedAmt = 0;

    // Fetch customer wallet balance (async, non-blocking)
    await fetchWalletBalance();
    renderPaymentMethods();
    waRenderWalletSection();
  }
  
  function waBackToAddress() {
    document.getElementById('wa-step-4').style.display = 'none';
    document.getElementById('wa-step-3').style.display = 'block';
  }
  
  let waSelectedPayment = null;
  let cashfreeObj = null;

  
    function waUpdateBtnTotal(baseTotal) {
      let subtext = document.getElementById('wa-pay-btn-subtext');
      let btnText = document.getElementById('wa-pay-btn-text');
      if (!subtext) return;
      
      if (waSelectedPayment === 'prepaid') {
        let disc = 0;
        if (waPaymentSettings && waPaymentSettings.prepaid_offer_enabled) {
            disc = waPaymentSettings.prepaid_offer_type === 'percent' ? (baseTotal * waPaymentSettings.prepaid_offer_value) / 100 : waPaymentSettings.prepaid_offer_value;
            disc = Math.min(disc, baseTotal);
        }
        if (disc > 0) {
            subtext.innerHTML = `Complete your order and save ₹${Math.round(disc)}`;
        } else {
            subtext.innerHTML = `Complete your secure online payment`;
        }
        if (btnText) btnText.innerText = 'Pay Securely Now →';
      } else if (waSelectedPayment === 'partial_cod') {
        let advanceAmt = 0;
        if (waPaymentSettings && waPaymentSettings.partial_cod_enabled) {
            advanceAmt = waPaymentSettings.partial_cod_type === 'percent' ? (baseTotal * waPaymentSettings.partial_cod_value) / 100 : waPaymentSettings.partial_cod_value;
        }
        subtext.innerHTML = `Pay ₹${Math.round(advanceAmt)} now to confirm your order`;
        if (btnText) btnText.innerText = `Pay ₹${Math.round(advanceAmt)} Advance →`;
      } else {
        // COD selected
        let fee = waPaymentSettings ? (waPaymentSettings.cod_fee || 0) : 0;
        if (fee > 0) {
          subtext.innerHTML = `Includes ₹${fee} COD fee. Pay securely on delivery`;
        } else {
          subtext.innerHTML = `Pay securely when your order arrives`;
        }
        if (btnText) btnText.innerText = 'Place Order (COD) →';
      }
    }
  
  // ── WALLET / STORE CREDIT ─────────────────────────────────────────
  let waWalletBalance = 0;         // customer's actual balance
  let waWalletApplied = false;     // toggle state
  let waWalletAppliedAmt = 0;      // amount currently deducted from total

  async function fetchWalletBalance() {
    const devId = localStorage.getItem('fit11_device_id') || localStorage.getItem('wa_device_id');
    if (!waPhone && !devId) return;
    try {
      const cachedBal = sessionStorage.getItem(`wa_bal_${waPhone}`);
        if (cachedBal) {
          waWalletBalance = parseFloat(cachedBal);
          return;
        }
        const res = await fetch(`${WA_API_BASE}/wallet-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          merchant_key: MERCHANT_KEY, 
          phone: waPhone,
          device_id: devId
        })
      });
      const data = await res.json();
      waWalletBalance = parseFloat(data?.customer?.storeCreditBalance || data?.storeCreditBalance || 0);
        sessionStorage.setItem(`wa_bal_${waPhone}`, waWalletBalance);
    } catch(e) {
      waWalletBalance = 0;
    }
  }

  function computeWalletUsable() {
    if (waWalletBalance <= 0) return 0;
    const ps = waPaymentSettings || {};
    const baseTotal = parseFloat(document.getElementById('wa-total')?.getAttribute('data-base-total') || '0');
    
    let targetPayable = baseTotal;
    if (waSelectedPayment === 'partial_cod') {
      if (ps.partial_cod_type === 'percent') {
        targetPayable = (baseTotal * ps.partial_cod_value) / 100;
      } else if (ps.partial_cod_value > 0) {
        targetPayable = ps.partial_cod_value;
      }
    } else if (waSelectedPayment === 'prepaid' && ps.prepaid_offer_enabled) {
      let disc = ps.prepaid_offer_type === 'percent' ? (baseTotal * ps.prepaid_offer_value) / 100 : ps.prepaid_offer_value;
      targetPayable = Math.max(0, baseTotal - Math.min(disc, baseTotal));
    }

    let maxUsable = waWalletBalance;
    if (ps.store_credit_limit_type === 'percent' && ps.store_credit_limit_value > 0) {
      maxUsable = Math.min(waWalletBalance, (baseTotal * ps.store_credit_limit_value) / 100);
    } else if (ps.store_credit_limit_type === 'fixed' && ps.store_credit_limit_value > 0) {
      maxUsable = Math.min(waWalletBalance, ps.store_credit_limit_value);
    }
    return Math.min(maxUsable, targetPayable);
  }

  function waUpdateTotalDisplay() {
    const totalEl = document.getElementById('wa-total');
    if (!totalEl) return;
    let baseTotal = parseFloat(totalEl.getAttribute('data-base-total') || '0');
    let finalPayable = baseTotal;
    if (waWalletApplied && waWalletAppliedAmt > 0) {
      finalPayable = Math.max(0, baseTotal - waWalletAppliedAmt);
    }
    totalEl.innerText = '₹' + finalPayable.toFixed(2);
  }

  function waRenderWalletSection() {
    const section = document.getElementById('wa-wallet-section');
    const ps = waPaymentSettings || {};
    if (ps.store_credit_enabled === false || waWalletBalance <= 0) {
      if (section) section.style.display = 'none';
      return;
    }
    if (section) section.style.display = 'block';
    const usable = computeWalletUsable();
    const balDisplay = document.getElementById('wa-wallet-balance-display');
    if (balDisplay) balDisplay.innerText = `₹${waWalletBalance.toFixed(2)}`;
    const usableText = document.getElementById('wa-wallet-usable-text');
    if (usableText) {
      if (ps.store_credit_limit_type === 'unlimited' || !ps.store_credit_limit_type) {
        usableText.innerText = `Max usable: ₹${usable.toFixed(2)}`;
      } else if (ps.store_credit_limit_type === 'percent') {
        usableText.innerText = `Max ${ps.store_credit_limit_value}% of order = ₹${usable.toFixed(2)}`;
      } else {
        usableText.innerText = `Max ₹${ps.store_credit_limit_value} per order`;
      }
    }
    const card = document.getElementById('wa-wallet-card');
    const checkbox = document.getElementById('wa-wallet-checkbox');
    const checkIcon = document.getElementById('wa-wallet-check-icon');
    const appliedRow = document.getElementById('wa-wallet-applied-row');
    const appliedAmt = document.getElementById('wa-wallet-applied-amt');
    if (waWalletApplied) {
      waWalletAppliedAmt = Math.round(computeWalletUsable() * 100) / 100;
      if (card) { card.style.borderColor = 'var(--wa-primary, #0f172a)'; card.style.background = '#f0f9ff'; }
      if (checkbox) { checkbox.style.background = 'var(--wa-primary, #0f172a)'; checkbox.style.borderColor = 'transparent'; }
      if (checkIcon) { checkIcon.style.transform = 'translateX(14px)'; }
      if (appliedRow) { appliedRow.style.display = 'flex'; }
      if (appliedAmt) appliedAmt.innerText = `-₹${waWalletAppliedAmt.toFixed(2)}`;
    } else {
      if (card) { card.style.borderColor = '#e2e8f0'; card.style.background = '#f8fafc'; }
      if (checkbox) { checkbox.style.background = '#cbd5e1'; checkbox.style.borderColor = 'transparent'; }
      if (checkIcon) { checkIcon.style.transform = 'translateX(0)'; }
      if (appliedRow) appliedRow.style.display = 'none';
    }
  }

  function waToggleWalletCredit() {
    const totalEl = document.getElementById('wa-total');
    if (!totalEl) return;
    let baseTotal = parseFloat(totalEl.getAttribute('data-base-total') || '0');

    if (!waWalletApplied) {
      const usable = computeWalletUsable();
      if (usable <= 0) return;
      waWalletAppliedAmt = Math.round(usable * 100) / 100;
      waWalletApplied = true;
    } else {
      waWalletApplied = false;
      waWalletAppliedAmt = 0;
    }

    // Re-compute display total (respecting payment method fee/discount too)
    waUpdateTotalDisplay();
    waRenderWalletSection();
    renderPaymentMethods();
  }

function renderPaymentMethods() {
      const container = document.getElementById('wa-payment-methods-container');
      container.innerHTML = '';
      
      let baseTotalText = document.getElementById('wa-total').getAttribute('data-base-total');
      if (!baseTotalText) {
        baseTotalText = document.getElementById('wa-total').innerText.replace('₹', '');
        if (baseTotalText && baseTotalText !== '...') {
          document.getElementById('wa-total').setAttribute('data-base-total', baseTotalText);
        }
      }
      let baseTotal = parseFloat(baseTotalText) || 0;

      if (waWalletApplied) {
        waWalletAppliedAmt = Math.round(computeWalletUsable() * 100) / 100;
      }
      
      let methods = [];
      
      if (!waPaymentSettings || Object.keys(waPaymentSettings).length === 0) {
        methods.push({ id: 'cod', type: 'cod', baseTotal });
      } else {
        if (waPaymentSettings.prepaid_enabled) {
          methods.push({ id: 'prepaid', type: 'prepaid', baseTotal });
        }
        if (waPaymentSettings.partial_cod_enabled) {
          methods.push({ id: 'partial_cod', type: 'partial_cod', baseTotal });
        }
        if (waPaymentSettings.cod_enabled) {
          methods.push({ id: 'cod', type: 'cod', baseTotal });
        }
      }
      
      if (methods.length === 0) {
        container.innerHTML = '<p style="color:#ef4444;">No payment methods available.</p>';
        return;
      }
      
      if (!waSelectedPayment || !methods.find(m => m.id === waSelectedPayment)) {
        const prepaidMethod = methods.find(m => m.id === 'prepaid');
        waSelectedPayment = prepaidMethod ? 'prepaid' : methods[0].id;
      }
      
      const uniqueCss = `
        <style>
          .wa-pay-opt { border:1px solid #e2e8f0; border-radius:14px; padding:10px 14px; cursor:pointer; transition:0.2s; position:relative; overflow:hidden; }
          .wa-pay-opt.selected { border-color:#22c55e; background:#fff; }

          .wa-rec-badge { position:absolute; top:0; left:16px; background:#22c55e; color:#fff; font-size:9px; font-weight:800; padding:2px 8px; border-radius:0 0 6px 6px; letter-spacing:0.5px; }
          .wa-radio-btn { width:22px; height:22px; border:2px solid #cbd5e1; border-radius:50%; position:relative; flex-shrink:0; margin-top:2px; }
          .wa-pay-opt.selected .wa-radio-btn { border-color:#22c55e; }
          .wa-pay-opt.selected .wa-radio-btn::after { content:''; position:absolute; inset:4px; background:#22c55e; border-radius:50%; }
          .wa-icon-circ { width:32px; height:32px; background:#f8fafc; border-radius:50%; display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0; }
          .wa-shield-badge { position:absolute; bottom:0; right:0; background:#22c55e; color:#fff; width:14px; height:14px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #fff; }
          .wa-logos-row img { filter: grayscale(0%); opacity: 1; mix-blend-mode: multiply; }
        </style>
      `;
      
      container.innerHTML = uniqueCss;
      
      methods.forEach(m => {
        const opt = document.createElement('div');
        const isSelected = waSelectedPayment === m.id;
        let html = '';
        
        if (m.type === 'prepaid') {
          let disc = 0;
          if (waPaymentSettings.prepaid_offer_enabled) {
              disc = waPaymentSettings.prepaid_offer_type === 'percent' ? (baseTotal * waPaymentSettings.prepaid_offer_value) / 100 : waPaymentSettings.prepaid_offer_value;
              disc = Math.min(disc, baseTotal);
          }
          let payAmt = Math.max(0, (baseTotal - disc) - (waWalletApplied ? waWalletAppliedAmt : 0));
          
          opt.className = `wa-pay-opt recommended ${isSelected ? 'selected' : ''}`;
          html = `
            <div class="wa-rec-badge">RECOMMENDED</div>
            <div style="display:flex; width:100%; align-items:flex-start; gap:14px; margin-top:8px;">
               <div class="wa-radio-btn"></div>
               <div style="flex:1;">
                 <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                    <div style="display:flex; gap:12px;">
                       <div class="wa-icon-circ">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                         <div class="wa-shield-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg></div>
                       </div>
                       <div>
                         <div style="font-weight:700; color:#1e293b; font-size:14px; letter-spacing:-0.2px;">Pay Online (UPI, Card)</div>
                         <div style="font-size:12px; color:#64748b; margin-top:2px;">Fast, secure & hassle-free</div>
                         ${(disc > 0 || (waPaymentSettings.cashback_enabled && waPaymentSettings.cashback_value > 0)) ? `<div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                           ${disc > 0 ? `<span style="display:inline-flex; align-items:center; color:#059669; font-weight:800; font-size:9px; background: #ecfdf5; padding:2px 6px; border-radius:4px; border:1px dashed #10b981; letter-spacing:0.2px; text-transform:uppercase;">
                             <svg width="10" height="10" style="margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                             SAVE ₹${Math.round(disc)}
                           </span>` : ''}
                           ${(waPaymentSettings.cashback_enabled && waPaymentSettings.cashback_value > 0) ? (function(){
                             let cbAmt = waPaymentSettings.cashback_type === 'percent' ? Math.round(((baseTotal - disc) * waPaymentSettings.cashback_value) / 100) : Math.round(waPaymentSettings.cashback_value);
                             return `<span style="display:inline-flex; align-items:center; color:#4f46e5; font-weight:800; font-size:9px; background: #e0e7ff; padding:2px 6px; border-radius:4px; border:1px dashed #6366f1; letter-spacing:0.2px; text-transform:uppercase; white-space:nowrap;">
                             <svg width="10" height="10" style="margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg>
                             + ₹${cbAmt} Store Credit
                           </span>`;
                           })() : ''}
                         </div>` : ''}
                       </div>
                    </div>
                    <div style="text-align:right;">
                      <div style="font-size:16px; font-weight:800; color:#0f172a;">₹${payAmt.toFixed(2)}</div>
                      ${disc > 0 ? `<div style="font-size:13px; color:#94a3b8; text-decoration:line-through; margin-top:2px;">₹${baseTotal.toFixed(2)}</div>` : ''}
                    </div>
                 </div>
                 ${isSelected ? `
                 <div style="margin-top:10px; animation:waFadeIn 0.3s ease;">
                     <div style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:8px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between;">
                       <div style="display:flex; gap:10px; align-items:center;">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                          <div>
                             <div style="color:#059669; font-size:11px; font-weight:700;">100% Secure Payment</div>
                             <div style="color:#64748b; font-size:9px; margin-top:1px; line-height:1.2;">Your payment details are encrypted<br>and protected.</div>
                          </div>
                       </div>
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                     </div>
                     <div class="wa-logos-row" style="display:flex; align-items:center; justify-content:space-between; margin-top:12px; padding:0 4px;">
                       <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" style="height:12px;" />
                       <img src="https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg" style="height:12px;" />
                       <img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg" style="height:9px;" />
                       <img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" style="height:12px;" />
                       <img src="https://cdn.shopify.com/s/assets/payment_icons/visa-319d545c6fd255c9aad5eeaad21fd6f7f7b4fdbdb1a35ce83b89cca12a187f00.svg" style="height:10px;" />
                     </div>
                  </div>
                 ` : ''}
               </div>
            </div>
          `;
        } else if (m.type === 'partial_cod') {
          let advanceAmt = 0;
          if (waPaymentSettings.partial_cod_type === 'percent') {
            advanceAmt = (baseTotal * waPaymentSettings.partial_cod_value) / 100;
          } else {
            advanceAmt = waPaymentSettings.partial_cod_value;
          }
          let payAmt = Math.max(0, advanceAmt - (waWalletApplied ? waWalletAppliedAmt : 0));
          let remainingAmt = Math.max(0, baseTotal - advanceAmt);
          
          opt.className = `wa-pay-opt ${isSelected ? 'selected' : ''}`;
          
          html = `
            <div style="display:flex; width:100%; align-items:flex-start; gap:14px;">
               <div class="wa-radio-btn"></div>
               <div style="flex:1;">
                 <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                    <div style="display:flex; gap:12px; align-items:flex-start;">
                       <div class="wa-icon-circ">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                         <div class="wa-shield-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg></div>
                       </div>
                       <div>
                         <div style="font-weight:700; color:#1e293b; font-size:16px;">Partial COD (Advance)</div>
                         <div style="font-size:12px; color:#64748b; margin-top:2px;">Pay ₹${Math.round(payAmt)} now, rest on delivery</div>
                       </div>
                    </div>
                    <div style="text-align:right;">
                      <div style="font-size:16px; font-weight:800; color:#0f172a;">₹${payAmt.toFixed(2)}</div>
                      <div style="font-size:11px; color:#64748b; margin-top:2px;">Now</div>
                    </div>
                 </div>
                 ${isSelected ? `
                 <div style="margin-top:20px; animation:waFadeIn 0.3s ease;">
                    <div style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:8px; padding:12px; display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                      <div style="display:flex; gap:10px; align-items:center;">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                         <div>
                            <div style="color:#059669; font-size:12px; font-weight:700;">100% Secure Payment</div>
                            <div style="color:#64748b; font-size:10px; margin-top:2px; line-height:1.4;">Your payment details are encrypted<br>and protected.</div>
                         </div>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    
                    <div style="background:#fff; border:1.5px dashed #e2e8f0; border-radius:8px; padding:12px; font-size:12px; color:#475569; margin-bottom:16px;">
                      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span>Advance to pay now:</span>
                        <span style="font-weight:700; color:#0f172a;">₹${payAmt.toFixed(2)}</span>
                      </div>
                      <div style="display:flex; justify-content:space-between;">
                        <span>To pay on delivery:</span>
                        <span style="font-weight:700; color:#0f172a;">₹${remainingAmt.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div class="wa-logos-row" style="display:flex; align-items:center; justify-content:space-between; padding:0 4px;">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/UPI-Logo-vector.svg" style="height:14px;" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg" style="height:14px;" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg" style="height:10px;" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" style="height:14px;" />
                      <img src="https://cdn.shopify.com/s/assets/payment_icons/visa-319d545c6fd255c9aad5eeaad21fd6f7f7b4fdbdb1a35ce83b89cca12a187f00.svg" style="height:12px;" />
                    </div>
                 </div>
                 ` : ''}
               </div>
            </div>
          `;
        } else if (m.type === 'cod') {
          let fee = waPaymentSettings.cod_fee || 0;
          let payAmt = Math.max(0, (baseTotal + fee) - (waWalletApplied ? waWalletAppliedAmt : 0));
          
          opt.className = `wa-pay-opt ${isSelected ? 'selected' : ''}`;
          
          html = `
            <div style="display:flex; width:100%; align-items:flex-start; gap:14px;">
               <div class="wa-radio-btn"></div>
               <div style="flex:1;">
                 <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div style="display:flex; gap:12px; align-items:center;">
                       <div class="wa-icon-circ">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
                       </div>
                       <div>
                         <div style="font-weight:700; color:#1e293b; font-size:14px; letter-spacing:-0.2px;">Cash on Delivery</div>
                         <div style="font-size:12px; color:#64748b; margin-top:2px;">Pay when your order arrives</div>
                         ${fee > 0 ? `<div style="font-size:11px; color:#ef4444; margin-top:4px; font-weight:600;">+ ₹${fee} COD fee applies</div>` : ''}
                       </div>
                    </div>
                    <div style="text-align:right;">
                      <div style="font-size:16px; font-weight:800; color:#0f172a;">₹${payAmt.toFixed(2)}</div>
                    </div>
                 </div>
               </div>
            </div>
          `;
        }
        
        opt.innerHTML = html;
        opt.onclick = () => {
          if (waSelectedPayment === m.id) return;
          waSelectedPayment = m.id;
          renderPaymentMethods();
        };
        container.appendChild(opt);
      });
      
      waUpdateBtnTotal(baseTotal);
      
      // Attempt to load Cashfree if needed
      if ((waSelectedPayment === 'prepaid' || waSelectedPayment === 'partial_cod') && typeof Cashfree !== 'undefined') {
        try {
          cashfreeObj = Cashfree({ mode: waPaymentSettings.cashfree_env || 'sandbox' });
        } catch(e) { console.error('Cashfree init error', e); }
      }

      // Show wallet section if applicable
      waRenderWalletSection();
    }

  function updateVisualTotalForPaymentMethod() {
    let subtotalEl = document.getElementById('wa-subtotal');
    if (!subtotalEl || !waPaymentSettings) return;
    
    // Get the base total from the DOM (before payment fees are applied)
    let baseTotalText = document.getElementById('wa-total').getAttribute('data-base-total');
    if (!baseTotalText) {
      baseTotalText = document.getElementById('wa-total').innerText.replace('₹', '');
      document.getElementById('wa-total').setAttribute('data-base-total', baseTotalText);
    }
    
    let baseTotal = parseFloat(baseTotalText);
    if (isNaN(baseTotal)) return;

    let displayTotal = baseTotal;

    if (waSelectedPayment === 'cod' && waPaymentSettings.cod_enabled && waPaymentSettings.cod_fee > 0) {
      displayTotal += waPaymentSettings.cod_fee;
    } else if (waSelectedPayment === 'prepaid' && waPaymentSettings.prepaid_offer_enabled) {
      let discount = waPaymentSettings.prepaid_offer_type === 'percent' 
        ? (baseTotal * waPaymentSettings.prepaid_offer_value) / 100 
        : waPaymentSettings.prepaid_offer_value;
      discount = Math.min(discount, baseTotal);
      displayTotal -= discount;
    }

    // Apply wallet credit discount
    if (waWalletApplied && waWalletAppliedAmt > 0) {
      displayTotal = Math.max(0, displayTotal - waWalletAppliedAmt);
    }

    document.getElementById('wa-total').innerText = `₹${displayTotal.toFixed(2)}`;
  }

  // Alias used by waToggleWalletCredit
  const updateTotalDisplay = updateVisualTotalForPaymentMethod;

  async function waPayNow() {
      const btn = document.getElementById('wa-cod-btn');
      const errEl = document.getElementById('wa-payment-error');
      const btnText = document.getElementById('wa-pay-btn-text');
      const btnSubtext = document.getElementById('wa-pay-btn-subtext');
      const originalBtnHTML = btn.innerHTML;
      
      btn.disabled = true;
      btn.style.opacity = '0.8';
      
      if (btnText && btnSubtext) {
        btnText.innerHTML = '<svg class="wa-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg>Processing...';
        btnSubtext.innerText = 'Please do not close this window';
      } else {
        btn.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><svg class="wa-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg><span>Processing...</span></div>';
      }
      
      errEl.style.display = 'none';
      
      waEmail = document.getElementById('wa-email').value.trim();
      
      // Email validation
      if (waPaymentSettings?.email_required === true && !waEmail) {
        errEl.innerText = 'Please enter your email address to continue.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = originalBtnHTML;
        return;
      }
      if (waEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waEmail)) {
        errEl.innerText = 'Please enter a valid email address.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = originalBtnHTML;
        return;
      }
      let addr = waAddresses.find(a => 
        String(a.id) === String(waSelectedAddress) || 
        String(a.id).replace('shopify_', '') === String(waSelectedAddress).replace('shopify_', '')
      );
      if (!addr && waAddresses.length > 0) {
        addr = waAddresses[0];
      }
      if (!addr) {
        errEl.innerText = 'Please select or add a shipping address before proceeding.';
        errEl.style.display = 'block';
        errEl.scrollIntoView({ behavior: 'smooth' });
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = originalBtnHTML;
        return;
      }
      
      if (waSelectedPayment === 'cod') {
        // Direct complete
        await finishOrderBackend({ payment_method: 'cod', shipping_address: addr });
      } else if (waSelectedPayment === 'prepaid' && waPaymentSettings.use_shopify_checkout_prepaid) {
        try {
          const res = await fetch(`${WA_API_BASE}/checkout/update-draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              merchant_key: MERCHANT_KEY, 
              draft_order_id: waDraftOrderId,
              payment_method: (waSelectedPayment === 'prepaid' && sessionStorage.getItem('wa_prepaid_' + waDraftOrderId)) ? 'none' : waSelectedPayment,
              customer_email: waEmail,
              customer_phone: waPhone,
              device_id: localStorage.getItem('fit11_device_id') || localStorage.getItem('wa_device_id'),
              shipping_address: addr
            })
          });
          if (waSelectedPayment === 'prepaid') sessionStorage.setItem('wa_prepaid_' + waDraftOrderId, 'true');
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to update draft order');
          
          if (data.invoice_url) {
             window.location.href = data.invoice_url;
          } else {
             throw new Error('No checkout URL returned from Shopify.');
          }
        } catch(e) {
          errEl.innerText = 'Error: ' + e.message;
          errEl.style.display = 'block';
          errEl.scrollIntoView({ behavior: 'smooth' });
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.innerHTML = originalBtnHTML;
        }
        return;
      } else {
        // Cashfree flow (Partial COD or standard Prepaid)
        const walletDeduction = (waWalletApplied && waWalletAppliedAmt > 0) ? waWalletAppliedAmt : 0;
        let targetPay = parseFloat(document.getElementById('wa-total')?.getAttribute('data-base-total') || '0');
        if (waSelectedPayment === 'partial_cod') {
          targetPay = waPaymentSettings.partial_cod_type === 'percent' 
            ? (targetPay * waPaymentSettings.partial_cod_value) / 100 
            : waPaymentSettings.partial_cod_value;
        } else if (waSelectedPayment === 'prepaid' && waPaymentSettings.prepaid_offer_enabled) {
          const disc = waPaymentSettings.prepaid_offer_type === 'percent'
            ? (targetPay * waPaymentSettings.prepaid_offer_value) / 100
            : waPaymentSettings.prepaid_offer_value;
          targetPay = Math.max(0, targetPay - disc);
        }
        const netPayable = Math.max(0, targetPay - walletDeduction);

        if (netPayable <= 0) {
          // Store Credit covers 100% of online advance payable amount! Directly complete order!
          try {
            await finishOrderBackend({ payment_method: waSelectedPayment, shipping_address: addr });
          } catch (e) {
            console.error(e);
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalBtnHTML;
            errEl.innerText = err.message || 'Failed to complete order. Please contact support.';
          }
          return;
        }

        try {
          // STEP 1: Apply discount + link customer to Shopify draft BEFORE Cashfree payment.
          // This ensures: correct discounted price in Shopify order + correct customer details.
          try {
            const udRes = await fetch(`${WA_API_BASE}/checkout/update-draft`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                merchant_key: MERCHANT_KEY, 
                draft_order_id: waDraftOrderId,
              payment_method: (waSelectedPayment === 'prepaid' && sessionStorage.getItem('wa_prepaid_' + waDraftOrderId)) ? 'none' : waSelectedPayment,
              customer_email: waEmail,
                customer_phone: waPhone,
                shipping_address: addr
              })
            });
            if (waSelectedPayment === 'prepaid') sessionStorage.setItem('wa_prepaid_' + waDraftOrderId, 'true');
            if (!udRes.ok) {
              const udErr = await udRes.json().catch(() => ({}));
              console.warn('update-draft warning (non-fatal):', udErr);
            }
          } catch(udErr) {
            console.warn('update-draft network error (non-fatal):', udErr);
          }

          // STEP 2: Create Cashfree payment session (now using discounted draft total)
          const res = await fetch(`${WA_API_BASE}/checkout/create-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              merchant_key: MERCHANT_KEY, 
              draft_order_id: waDraftOrderId,
              payment_method: waSelectedPayment,
              customer_phone: waPhone,
              device_id: localStorage.getItem('fit11_device_id') || localStorage.getItem('wa_device_id'),
              customer_email: waEmail,
              customer_name: (addr?.first_name || '') + ' ' + (addr?.last_name || ''),
              wallet_credit_amount: walletDeduction,
              amount: netPayable,
              shipping_address: addr
            })
          });
          const data = await res.json();
          if (!res.ok || !data || !data.payment_session_id) {
            throw new Error(data.error || data.message || 'Payment server failed to generate Cashfree session.');
          }
          
          if (!cashfreeObj && typeof Cashfree !== 'undefined') {
            try {
              cashfreeObj = Cashfree({ mode: waPaymentSettings.cashfree_env || 'production' });
            } catch(cfInitErr) {
              console.error('Cashfree init error:', cfInitErr);
              throw new Error('Cashfree SDK init error: ' + (cfInitErr.message || cfInitErr));
            }
          }
          if (!cashfreeObj) throw new Error('Payment gateway SDK failed to load from sdk.cashfree.com/js/v3/cashfree.js. Please check network/ad-blocker settings.');

          // Open Cashfree Modal
          let checkoutOptions = {
            paymentSessionId: data.payment_session_id,
            redirectTarget: "_modal"
          };
          
          // CRITICAL FIX (matching 11fit): Hide our custom modal overlay so the Cashfree modal is visible!
          const overlay = document.getElementById('wa-otp-overlay');
          const originalDisplay = overlay ? overlay.style.display : 'flex';
          if (overlay) overlay.style.display = 'none';
          
          cashfreeObj.checkout(checkoutOptions).then(async (result) => {
            if (overlay) overlay.style.display = originalDisplay;
            
            if (result.error) {
              btn.disabled = false;
              btn.style.opacity = '1';
              btn.innerHTML = originalBtnHTML;
              errEl.innerText = result.error.message || 'Payment failed or cancelled.';
              errEl.style.display = 'block';
            } else if (result.paymentDetails && (result.paymentDetails.paymentStatus === 'SUCCESS' || result.paymentDetails.paymentMessage)) {
              await finishOrderBackend({ payment_method: waSelectedPayment, shipping_address: addr, cashfree_order_id: data.order_id });
            } else {
              btn.disabled = false;
              btn.style.opacity = '1';
              btn.innerHTML = originalBtnHTML;
              errEl.innerText = 'Payment was cancelled or not completed. Please try again.';
              errEl.style.display = 'block';
            }}).catch((cfErr) => {
            if (overlay) overlay.style.display = originalDisplay;
            const exactErr = (cfErr && cfErr.message) ? cfErr.message : (typeof cfErr === 'string' ? cfErr : JSON.stringify(cfErr));
            errEl.innerText = 'Payment Gateway Error: ' + exactErr;
            errEl.style.display = 'block';
            errEl.style.padding = '12px';
            errEl.style.background = '#fef2f2';
            errEl.style.border = '1px solid #f87171';
            errEl.style.borderRadius = '8px';
            errEl.style.color = '#dc2626';
            errEl.scrollIntoView({ behavior: 'smooth' });
            btn.disabled = false;
            btn.innerHTML = originalBtnHTML;
          });
  
        } catch(e) {
          const overlay = document.getElementById('wa-otp-overlay');
          if (overlay && overlay.style.display === 'none') overlay.style.display = 'flex';
          
          const exactErr = (e && e.message) ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
          errEl.innerText = 'Payment Error: ' + exactErr;
          errEl.style.display = 'block';
          errEl.style.padding = '12px';
          errEl.style.background = '#fef2f2';
          errEl.style.border = '1px solid #f87171';
          errEl.style.borderRadius = '8px';
          errEl.style.color = '#dc2626';
          errEl.scrollIntoView({ behavior: 'smooth' });
          btn.disabled = false;
          btn.innerHTML = originalBtnHTML;
        }
      }
    }

  async function finishOrderBackend(payload) {
    const btn = document.getElementById('wa-cod-btn');
    const errEl = document.getElementById('wa-payment-error');
    const originalBtnHTML = btn ? btn.innerHTML : '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      let addr = payload.shipping_address;
      if (!addr && waAddresses && waAddresses.length > 0) {
        addr = waAddresses.find(a => 
          String(a.id) === String(waSelectedAddress) || 
          String(a.id).replace('shopify_', '') === String(waSelectedAddress).replace('shopify_', '')
        ) || waAddresses[0];
      }
      if (!addr) {
        throw new Error('Shipping address is missing. Please select or add an address.');
      }

      const res = await fetch(`${WA_API_BASE}/checkout/complete`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          merchant_key: MERCHANT_KEY, 
          draft_order_id: waDraftOrderId, 
          shipping_address: addr, 
          email: waEmail, 
          phone: waPhone,
          device_id: localStorage.getItem('fit11_device_id') || localStorage.getItem('wa_device_id'),
          payment_method: payload.payment_method || waSelectedPayment,
          cashfree_order_id: payload.cashfree_order_id,
          wallet_credit_amount: (waWalletApplied && waWalletAppliedAmt > 0) ? waWalletAppliedAmt : 0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete order.');

      // Clear Shopify Cart
      try {
        await fetch('/cart/clear.js', { method: 'POST' });
        if (window.lxRefreshCartUI) window.lxRefreshCartUI();
      } catch(e) {}

      document.getElementById('wa-step-4').style.display = 'none';
      const stepsInd = document.getElementById('wa-steps-indicator');
      if (stepsInd) stepsInd.style.display = 'none';
      
      const closeBtn = document.getElementById('wa-close-modal-btn');
      if (closeBtn) closeBtn.style.display = 'none';
      
      const scVal = document.getElementById('wa-success-order-val');
      const scBox = document.getElementById('wa-success-order-number');
      if (scVal && scBox && data.order_id) {
        const oNum = String(data.order_id);
        scVal.innerText = oNum.startsWith('#') ? oNum : '#' + oNum;
        scBox.style.display = 'inline-block';
      }

      const scDesc = document.getElementById('wa-success-desc');
      if (scDesc) {
        const pm = payload.payment_method || waSelectedPayment;
        if (pm === 'cod') {
          scDesc.innerText = 'Your COD order has been successfully placed. You will receive a confirmation on WhatsApp shortly.';
        } else {
          scDesc.innerText = 'Your prepaid order has been successfully placed. You will receive a confirmation on WhatsApp shortly.';
        }
      }

      const sc = document.getElementById('wa-success-screen');
      if (sc) sc.style.display = 'flex';
      clearTimeout(timeoutId);

      // Fire Meta Pixel Purchase Event
      try {
        const totEl = document.getElementById('wa-total');
        const finalPrice = totEl ? (parseFloat(totEl.getAttribute('data-base-total') || totEl.innerText.replace(/[^0-9.]/g, '')) || 0) : 0;
        
        // Inject standard Meta Pixel to completely bypass Shopify Sandbox for BOTH pixels
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        
        // 100% Foolproof Tracking using Meta Image Pixels (Bypasses all Shopify Proxies & Sandboxes)
        const firePixel = (pixelId, val) => {
          const img = document.createElement('img');
          img.height = 1; img.width = 1; img.style.display = 'none';
          img.src = 'https://www.facebook.com/tr/?id=' + pixelId + '&ev=Purchase&cd[value]=' + val + '&cd[currency]=INR&noscript=1';
          document.body.appendChild(img);
        };
        
        firePixel('1389821399722687', finalPrice);
        firePixel('1065954715920985', finalPrice);
        fbq('trackSingle', '1065954715920985', 'Purchase', {
          value: finalPrice,
          currency: 'INR'
        });
        
        // Also attempt Shopify Web Pixels API for Google Analytics/others
        if (window.Shopify && window.Shopify.analytics && typeof window.Shopify.analytics.publish === 'function') {
           window.Shopify.analytics.publish("checkout_completed", {
             checkout: {
               currencyCode: "INR",
               totalPrice: { amount: finalPrice, currencyCode: "INR" }
             }
           });
        }
      } catch(e) {}

    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Order Complete Error:', err);
      if (errEl) {
        errEl.innerText = 'Error: ' + (err.message || 'Failed to complete order. Please try again.');
        errEl.style.display = 'block';
        errEl.scrollIntoView({ behavior: 'smooth' });
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnHTML;
      }
    }
  }

  function waRedirectToShopify(e) {
    if (e) e.preventDefault();
    closeWaModal();
    window.location = '/checkout';
  }

  window.triggerFullCheckout = function() { openWaModal(); };
  window.openWaModal = openWaModal;

  // Intercept cart form submit events outside modal and launch custom modal instead
  document.addEventListener('submit', function(e) {
    if (e.target.closest && e.target.closest('#wa-otp-overlay')) return;
    const action = (e.target.action || '').toLowerCase();
    if (action.includes('cashfree') || action.includes('razorpay') || action.includes('paytm')) return;
    if (action.includes('/cart/add')) return;
    const isShopifyCheckout = (action.includes('/cart') || action.includes('/checkout')) && !action.includes('cashfree');
    // Cart forms should only be intercepted if submitted by checkout button
    if (action.endsWith('/cart') || action.endsWith('/cart/')) {
      if (e.submitter && e.submitter.name !== 'checkout') return;
    }
    if (isShopifyCheckout || e.target.querySelector('button[name="checkout"], input[name="checkout"]')) {
      e.preventDefault();
      e.stopPropagation();
      openWaModal();
    }
  }, true);
  const _origSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function() {
    const action = (this.action || '').toLowerCase();
    if (action.includes('cashfree') || action.includes('razorpay') || action.includes('paytm')) {
      _origSubmit.apply(this, arguments);
      return;
    }
    if (action.includes('/cart/add')) {
      _origSubmit.apply(this, arguments);
      return;
    }
    const ov = document.getElementById('wa-otp-overlay');
    if (ov && window.getComputedStyle(ov).display !== 'none') return;
    _origSubmit.apply(this, arguments);
  };

  // Global interceptor for the checkout button ONLY (Handles iOS hover bugs via touchstart)
  ['click', 'touchstart'].forEach(function(evt) {
    document.addEventListener(evt, function(e) {
      if (!e.target || !e.target.closest) return;
      // CRITICAL: Never intercept clicks inside the modal itself
      if (e.target.closest('#wa-otp-overlay')) return;
      let target = e.target.closest('button[name="checkout"], a[href*="/checkout"], input[name="checkout"], #checkout, .cart__checkout-button, .checkout-btn, .cart-drawer__checkout, .cart__submit[name="checkout"], [data-checkout], form[action*="/checkout"] [type="submit"]');
      if (!target) {
        const btnEl = e.target.closest('button, a, input[type="submit"]');
        if (btnEl) {
          const txt = (btnEl.innerText || btnEl.value || '').toLowerCase();
          const href = (btnEl.getAttribute('href') || '').toLowerCase();
          if (btnEl.name === 'checkout' || href.includes('/checkout')) {
            target = btnEl;
          }
        }
      }
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        if (evt === 'touchstart') {
          if (!window._waModalOpening) {
            window._waModalOpening = true;
            openWaModal();
            setTimeout(() => window._waModalOpening = false, 500);
          }
        } else if (evt === 'click') {
          if (!window._waModalOpening) openWaModal();
        }
      }
    }, { capture: true, passive: false });
  });

  // Reset button state if user navigates back from Shopify Checkout (BFCache)
  window.addEventListener('pageshow', function(e) {
    const btn = document.getElementById('wa-cod-btn');
    if (btn && btn.disabled) {
      btn.disabled = false;
      btn.innerHTML = '<span id="wa-pay-btn-text">Pay Now</span>';
      if (window.waProcessingInterval) clearInterval(window.waProcessingInterval);
    }
  });

  function waUpdateHeaderGreeting(name) {
    try {
      if (name) {
        localStorage.setItem('fit11_first_name', name);
      } else {
        name = localStorage.getItem('fit11_first_name');
      }
      const phone = localStorage.getItem('fit11_verified_phone') || sessionStorage.getItem('fit11_verified_phone') || document.cookie.includes('wa_saved_phone=');
      if (phone) {
        var menuBtn = document.getElementById('tx-menu-login-btn');
        if (menuBtn) menuBtn.innerText = 'My Account';
        
        var greeting = document.getElementById('tx-drawer-greeting');
        if (greeting && name && name.trim() !== '' && name !== 'null') {
          greeting.innerText = 'Hey ' + name + '!';
        }
      }
    } catch(e) {}
  }

  window.addEventListener('DOMContentLoaded', function() {
    waUpdateHeaderGreeting();
  });

