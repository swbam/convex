# 📊 Impact Radius Testing - Without Purchases

## 🎯 **Testing Affiliate Tracking (Free)**

You can verify everything works WITHOUT buying tickets!

---

## 🔍 **Quick Tests You Can Do NOW**

### **Test 1: URL Parameter Check** (30 seconds)

```bash
1. npm run dev
2. Go to any show page
3. Right-click "Get Tickets" → Copy Link Address
4. Paste in notepad
5. Look for: impradid=6463123

If present: ✅ WORKING!
```

### **Test 2: Click Through** (1 minute)

```bash
1. Click "Get Tickets" button
2. Ticketmaster opens
3. Look at URL in address bar
4. Verify parameters are present
5. Close tab (don't buy anything!)

If params visible: ✅ WORKING!
```

### **Test 3: Browser Console** (2 minutes)

```javascript
// In browser console on show page:
const ticketUrl = document.querySelector('[class*="Get Tickets"]');
console.log('Button:', ticketUrl);

// Click button and check new tab URL
// Should see all affiliate params
```

---

## 📈 **What Impact Radius Tracks**

### **Without Purchase**:
```
✅ Clicks (tracked immediately)
✅ Click timestamp
✅ Unique click ID
✅ Source (your site)
✅ Campaign (6463123)
```

### **With Purchase** (Future):
```
✅ All of the above +
✅ Conversion event
✅ Order value
✅ Commission amount
✅ Payout details
```

**You can verify clicks WITHOUT sales!**

---

## 🧪 **Safe Testing Process**

### **Process**:
```
1. Deploy your app
   ↓
2. Click "Get Tickets" on show page
   ↓
3. Ticketmaster opens with YOUR affiliate params
   ↓
4. Browse event page (click tracked!)
   ↓
5. Add tickets to cart (optional)
   ↓
6. View checkout (optional)
   ↓
7. Close tab (DON'T complete purchase)
   ↓
8. Check Impact Radius dashboard
   ↓
✅ Click appears in reports!
```

**No purchase needed to see clicks!**

---

## 📊 **Impact Radius Dashboard Guide**

### **Where to Check**:

1. **Login**: https://app.impact.com
2. **Navigate to**: Reports → Performance → Clicks
3. **Filter by**: 
   - Date: Today or Last 7 days
   - Campaign: Ticketmaster (if you have multiple)

### **What You'll See**:
```
Click Report:
┌────────────┬──────────────────┬─────────────┬────────┐
│ Date       │ Click ID         │ Campaign    │ Status │
├────────────┼──────────────────┼─────────────┼────────┤
│ 9/29/2025  │ UCkVKfRd9xyc... │ 6463123     │ Valid  │
│ 9/29/2025  │ XYz123AbC456... │ 6463123     │ Valid  │
└────────────┴──────────────────┴─────────────┴────────┘
```

**Even with 0 sales, you'll see clicks!**

---

## 🎓 **Understanding the Tracking**

### **Impact Radius Cookie Lifecycle**:

```
User clicks your link
  ↓
Browser redirected to Ticketmaster with:
  ?irgwc=1&clickid=ABC123...&impradid=6463123
  ↓
Ticketmaster sets Impact Radius cookie
  ↓
Cookie stored for 30 days (typical)
  ↓
If user buys within 30 days:
  ↓
Sale attributed to your affiliate ID
  ↓
✅ You earn commission!
```

**The tracking happens on click, not on purchase!**

---

## 🧪 **Test Scenarios**

### **Scenario 1: Direct Click** (Recommended)
```
1. Click "Get Tickets"
2. Ticketmaster opens
3. Check URL has params
4. Close tab
✅ Impact Radius tracked the click
```

### **Scenario 2: Copy/Paste Link**
```
1. Copy "Get Tickets" link
2. Paste in new tab
3. Verify params present
4. Press Enter
✅ Click tracked
```

### **Scenario 3: Share Link**
```
1. Copy affiliate link
2. Share with friend
3. Friend clicks
4. Check Impact Radius dashboard
✅ Their click tracked under your ID
```

---

## 🔍 **Debugging**

### **If No Clicks Show in Dashboard**:

1. **Check Parameter Format**:
   ```
   ✅ impradid=6463123 (not imprad_id or other)
   ✅ No extra spaces in URL
   ✅ Properly URL-encoded
   ```

2. **Verify Impact Radius Account**:
   ```
   ✅ Logged in to correct account
   ✅ Campaign 6463123 active
   ✅ Ticketmaster partnership approved
   ```

3. **Check Cookie Settings**:
   ```
   ✅ Browser allows third-party cookies
   ✅ Not in incognito mode
   ✅ No ad blockers interfering
   ```

---

## 🎯 **Production Testing Workflow**

### **Week 1: Verify Clicks**
```
✅ Deploy app
✅ Test yourself (click through 3-5 times)
✅ Check Impact Radius dashboard
✅ Verify clicks appearing
```

### **Week 2: Share with Friends**
```
✅ Share show links
✅ Ask friends to click "Get Tickets"
✅ They don't have to buy
✅ Check dashboard for click increases
```

### **Week 3: Monitor Conversions**
```
✅ Continue driving traffic
✅ Some users will purchase
✅ Check Impact Radius for sales
✅ Verify commission attribution
```

---

## 💰 **Commission Verification**

When someone DOES buy:

```
Impact Radius Dashboard shows:
- Click: 9/29/2025 10:30 AM
- Conversion: 9/29/2025 10:35 AM
- Order Value: $150.00
- Commission: $7.50 (5% example)
- Status: Pending → Approved → Paid
```

**But you can verify tracking works BEFORE any sales!**

---

## ✅ **Bottom Line**

**To Test (NO PURCHASE NEEDED)**:

1. ✅ Check URL has `impradid=6463123`
2. ✅ Verify unique clickid generated
3. ✅ Click button → Check URL in new tab
4. ✅ Login to Impact Radius → See clicks

**To Earn Commission (Later)**:
1. ✅ Drive traffic to show pages
2. ✅ Users click "Get Tickets"
3. ✅ Some users buy tickets
4. ✅ You earn commission (tracked via Impact Radius)

**Your affiliate tracking is ready to test!** 🎉

Run `npm run all` to deploy and start testing! 🚀
