# 🧪 Testing Ticketmaster Affiliate Links - No Purchase Required

## ✅ **How to Test Without Buying Tickets**

You can verify your affiliate tracking is working **without spending money**!

---

## 🔍 **Method 1: URL Parameter Verification** (Instant)

### **Step 1: Generate an Affiliate Link**

```bash
# Start your app
npm run dev

# Navigate to any show page
# Example: http://localhost:5173/shows/eagles-sphere-2025
```

### **Step 2: Inspect the "Get Tickets" Button**

**In Browser**:
```javascript
// Open browser console (Cmd+Option+J)
// Right-click "Get Tickets" button → Inspect Element
// Look at the href attribute

// Or run this in console:
const button = document.querySelector('a[href*="ticketmaster"]') || 
               document.querySelector('button');
console.log('Ticket URL:', button?.onclick || button?.href);
```

### **Step 3: Verify Parameters**

Your generated URL should contain ALL these parameters:
```
✅ irgwc=1
✅ clickid=<40-character-random-string>
✅ camefrom=CFC_BUYAT_6463123
✅ impradid=6463123                  ← YOUR AFFILIATE ID
✅ REFERRAL_ID=tmfeedbuyat6463123    ← YOUR REFERRAL ID
✅ wt.mc_id=aff_BUYAT_6463123
✅ utm_source=6463123-setlists.live
✅ impradname=setlists.live
✅ utm_medium=affiliate
✅ ircid=4272
```

**If ALL are present** → Affiliate tracking is configured correctly! ✅

---

## 🧪 **Method 2: Click Through Test** (Safe)

### **Step 1: Click "Get Tickets"**

```
1. Go to a show page with "Get Tickets" button
2. Click the button
3. Ticketmaster opens in new tab
```

### **Step 2: Check the URL in Browser**

```
Look at the address bar in the Ticketmaster tab
Should look like:

https://www.ticketmaster.com/event/XXXXX?
  irgwc=1&
  clickid=UCkVKfRd9xycR4LzAlwNlWiaUkp3wT2PISiJ280&
  camefrom=CFC_BUYAT_6463123&
  impradid=6463123&           ← YOUR ID HERE!
  ...rest of parameters...
```

**If you see your `impradid=6463123`** → Tracking is working! ✅

### **Step 3: Browse Ticketmaster (Don't Buy)**

```
✅ Browse the event page (tracking is recorded)
✅ Add tickets to cart (tracking still works)
✅ Go to checkout (tracking persists)
❌ DON'T complete purchase (not needed for testing!)
```

**Impact Radius will track the click even without purchase!**

---

## 📊 **Method 3: Impact Radius Dashboard** (Official)

### **Step 1: Login to Impact Radius**

```
URL: https://impact.com
Login with your affiliate account credentials
```

### **Step 2: Check Click Tracking**

```
Navigate to: Reports → Clicks
Filter by: Last 24 hours

You should see:
- Click timestamp
- clickid (your unique ID)
- impradid (6463123)
- Status (tracked)
```

**Even without sales, clicks are tracked!**

### **Step 3: Verify Attribution**

```
If you see your clicks in Impact Radius dashboard:
✅ Affiliate integration working perfectly!
✅ Commission will be attributed when sales happen
```

---

## 🛠️ **Method 4: Browser Developer Tools Test**

### **Step 1: Open Network Tab**

```
1. Open browser DevTools (F12)
2. Go to Network tab
3. Click "Get Tickets" button
4. Look for request to ticketmaster.com
```

### **Step 2: Inspect Request**

```
Click on the ticketmaster.com request
Go to "Headers" tab
Look at "Request URL"

Should contain all your affiliate parameters!
```

### **Step 3: Check Cookies**

```
Go to "Application" tab → Cookies → ticketmaster.com
Look for Impact Radius tracking cookies

Should see cookies like:
- IR_gbd (Impact Radius)
- IR_<your_campaign_id>
```

**If cookies are set** → Attribution working! ✅

---

## 🧪 **Method 5: Test with Console Log**

Add logging to verify the URL generation:

```typescript
// src/utils/ticketmaster.ts
export function buildTicketmasterAffiliateUrl(ticketUrl?: string): string {
  const finalUrl = /* ...your code... */;
  
  // TEMPORARY: Log for testing
  console.log('🎫 Generated Affiliate URL:', finalUrl);
  console.log('📊 Parameters:', {
    impradid: finalUrl.includes('impradid=6463123'),
    REFERRAL_ID: finalUrl.includes('REFERRAL_ID=tmfeedbuyat6463123'),
    clickid: finalUrl.match(/clickid=([^&]+)/)?.[1],
  });
  
  return finalUrl;
}
```

**Check console** → Verify all params present!

---

## 📋 **Verification Checklist**

Test these scenarios:

### **Scenario 1: Show with Ticket URL**
```
✅ Show has ticketUrl in database
✅ "Get Tickets" button appears
✅ Click button → Opens Ticketmaster
✅ URL contains all affiliate params
✅ Your impradid visible in URL
```

### **Scenario 2: Show without Ticket URL**
```
✅ Show has no ticketUrl (undefined)
✅ "Get Tickets" button still works
✅ Opens Ticketmaster homepage with affiliate params
✅ User can search for event manually
```

### **Scenario 3: Completed Show**
```
✅ Past show doesn't show "Get Tickets" button
✅ Only upcoming shows have the button
```

---

## 🎯 **What to Look For**

### **✅ Success Indicators**:

1. **URL Parameters Present**:
   ```
   ✅ impradid=6463123 (your ID)
   ✅ REFERRAL_ID=tmfeedbuyat6463123
   ✅ clickid=<unique 40 chars>
   ✅ irgwc=1
   ```

2. **Unique Click IDs**:
   ```
   ✅ Each click generates different clickid
   ✅ clickid is 40 characters
   ✅ Random alphanumeric
   ```

3. **Tracking Cookies**:
   ```
   ✅ Impact Radius cookies set
   ✅ Ticketmaster attribution cookies
   ```

### **❌ Failure Indicators**:

```
❌ Missing impradid parameter
❌ Missing REFERRAL_ID
❌ Same clickid for different clicks
❌ No parameters in URL at all
```

---

## 🧪 **Quick Test Script**

Run this in browser console to test the utility function:

```javascript
// Test the affiliate URL builder
const testUrl = "https://www.ticketmaster.com/event/12345";

// Call your function (if exposed globally)
const affiliateUrl = buildTicketmasterAffiliateUrl(testUrl);

console.log('Original:', testUrl);
console.log('Affiliate:', affiliateUrl);

// Check parameters
const url = new URL(affiliateUrl);
console.log('Parameters:', {
  impradid: url.searchParams.get('impradid'),
  REFERRAL_ID: url.searchParams.get('REFERRAL_ID'),
  clickid: url.searchParams.get('clickid'),
  irgwc: url.searchParams.get('irgwc'),
});

// Verify
console.log('✅ All params present:', 
  url.searchParams.has('impradid') &&
  url.searchParams.has('REFERRAL_ID') &&
  url.searchParams.has('clickid') &&
  url.searchParams.has('irgwc')
);
```

---

## 📊 **Impact Radius Reporting**

### **What You'll See in Dashboard**:

**Without Purchases**:
```
Clicks: 5
Impressions: 0
Sales: 0
Commission: $0.00
```

**After Purchases (from your links)**:
```
Clicks: 50
Conversions: 3
Sales: $450.00
Commission: $22.50 (example 5%)
```

**Clicks are tracked immediately - sales come later!**

---

## 🎯 **Real-World Testing Steps**

### **Day 1: Deploy and Share**
```
1. Deploy: npm run all
2. Share a show link with a friend
3. Ask them to click "Get Tickets"
4. They DON'T have to buy
5. Check Impact Radius → Click should be tracked!
```

### **Day 2: Check Dashboard**
```
Login to Impact Radius
Navigate to Reports
Should see your clicks tracked
Even without sales, you'll see:
- Click count
- Click IDs
- Attribution working
```

---

## 🔧 **Debug Mode** (For Development)

Add this to test locally:

```typescript
// src/components/ShowDetail.tsx
// Add before the Get Tickets button:

{process.env.NODE_ENV === 'development' && (
  <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
    <p className="text-xs font-mono text-yellow-400">
      DEBUG: Affiliate URL Test
    </p>
    <p className="text-xs text-gray-400 mt-2 break-all">
      {buildTicketmasterAffiliateUrl(show.ticketUrl)}
    </p>
  </div>
)}
```

**This shows the generated URL on the page in development!**

---

## ✅ **Summary**

**To Test WITHOUT Buying**:
1. ✅ Click "Get Tickets" → Check URL parameters
2. ✅ Verify `impradid=6463123` in URL
3. ✅ Check Impact Radius dashboard for clicks
4. ✅ Each click generates unique clickid
5. ✅ Browse Ticketmaster (don't checkout)

**You DON'T need to buy tickets to verify tracking works!**

**Clicks = Tracked**  
**Sales = Commission**

**Test the integration now**: `npm run all` 🚀

---

## 🎯 **Quick Test**

```bash
# 1. Deploy
npm run all

# 2. Visit show page
https://your-app.com/shows/any-show

# 3. Right-click "Get Tickets" → Copy Link

# 4. Paste in notepad

# 5. Look for: impradid=6463123

# If present: ✅ YOU'RE EARNING COMMISSION!
```

**Your affiliate integration is complete!** 💰
