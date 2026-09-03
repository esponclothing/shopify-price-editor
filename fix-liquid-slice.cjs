const fs = require('fs');

let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\snippets\\whatsapp-otp-modal.liquid', 'utf8');

// Normalize newlines to LF for matching
code = code.replace(/\r\n/g, '\n');

// Find the target block using a very simple match
const targetStart = `<button type="button" class="wa-btn-primary" id="wa-cod-btn" onclick="waPayNow()" style="background:#0f172a; padding:18px; margin-bottom:12px; display:flex; flex-direction:column; align-items:center; gap:2px;">`;
const targetEnd = `Your security is our priority. We never share your details.\n          </div>`;

const startIndex = code.indexOf(targetStart);
const endIndex = code.indexOf(targetEnd, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const replaceStr = `          <div id="wa-btn-safe-zone">
            <button type="button" class="wa-btn-primary" id="wa-cod-btn" onclick="waPayNow()" style="background:#0f172a; padding:18px; margin-bottom:12px; display:flex; flex-direction:column; align-items:center; gap:2px; border-radius:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span id="wa-pay-btn-text" style="font-size:16px;">Pay Securely Now →</span>
              </div>
              <span id="wa-pay-btn-subtext" style="font-size:11px; font-weight:500; color:rgba(255,255,255,0.8);">Complete your order and save ₹45</span>
            </button>
          </div>

          <div style="text-align:center; margin-bottom:16px;">
            <a href="#" onclick="waBackToAddress(); return false;" style="color:#64748b; font-size:13px; font-weight:600; text-decoration:none;">← Back to Address</a>
          </div>

          <!-- Trust Badges Footer -->
          <div class="wa-hide-on-mobile" style="display:flex; justify-content:space-between; align-items:flex-start; padding:16px 0; border-top:1px dashed #e2e8f0; margin-bottom:12px;">
            <div style="text-align:center; flex:1;">
              <div style="display:flex; justify-content:center; margin-bottom:6px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
              <div style="font-size:11px; font-weight:700; color:#0f172a; margin-bottom:2px;">Best Price</div>
              <div style="font-size:10px; color:#64748b;">You're getting the best deal!</div>
            </div>
            <div style="text-align:center; flex:1; border-left:1px solid #f1f5f9; border-right:1px solid #f1f5f9;">
              <div style="display:flex; justify-content:center; margin-bottom:6px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></div>
              <div style="font-size:11px; font-weight:700; color:#0f172a; margin-bottom:2px;">Easy Returns</div>
              <div style="font-size:10px; color:#64748b;">7-day easy return policy</div>
            </div>
            <div style="text-align:center; flex:1;">
              <div style="display:flex; justify-content:center; margin-bottom:6px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg></div>
              <div style="font-size:11px; font-weight:700; color:#0f172a; margin-bottom:2px;">24/7 Support</div>
              <div style="font-size:10px; color:#64748b;">We're here to help you anytime</div>
            </div>
          </div>

          <div style="text-align:center; padding-top: 12px; margin-bottom:12px;">
             <div style="font-size: 10px; font-weight: 700; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">100% Secure & Encrypted Payments</div>
             <div style="display:flex; justify-content:center; gap: 6px; flex-wrap: wrap; align-items:center;">
               {{ 'upi' | payment_type_svg_tag: class: 'wa-pay-icon' }}
               {{ 'visa' | payment_type_svg_tag: class: 'wa-pay-icon' }}
               {{ 'master' | payment_type_svg_tag: class: 'wa-pay-icon' }}
               {{ 'rupay' | payment_type_svg_tag: class: 'wa-pay-icon' }}
             </div>
          </div>
          <style>
             .wa-pay-icon { height: 24px; width: auto; border-radius: 4px; border: 1px solid #e2e8f0; }
          </style>

          <div style="text-align:center; font-size:11px; color:#64748b; margin-bottom:12px; display:flex; justify-content:center; align-items:center; gap:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Your security is our priority. We never share your details.
          </div>`;

  const newCode = code.substring(0, startIndex) + replaceStr.trimStart() + code.substring(endIndex + targetEnd.length);
  fs.writeFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\snippets\\whatsapp-otp-modal.liquid', newCode);
  console.log('Successfully patched whatsapp-otp-modal.liquid using manual slice!');
} else {
  console.log('Could not find start or end index! Start:', startIndex, 'End:', endIndex);
}
