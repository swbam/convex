# 📸 Clerk Dashboard Setup - Visual Guide

## 🎯 Exactly What to Configure

---

## FIX #1: Disable CAPTCHA (2 minutes)

### Navigation Path:
```
Clerk Dashboard
  └─ Your Application
      └─ User & Authentication
          └─ Attack Protection
```

### What You'll See:

```
┌────────────────────────────────────────────────────┐
│ Attack Protection                                  │
├────────────────────────────────────────────────────┤
│                                                    │
│ Bot Sign-up Protection                            │
│                                                    │
│ ○ OFF                                             │ ← Select this!
│ ○ ON                                              │
│                                                    │
│ [Save]                                            │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Action**: Click the OFF radio button, then click Save

---

## FIX #2: JWT Template (3 minutes)

### Navigation Path:
```
Clerk Dashboard
  └─ Your Application
      └─ Configure
          └─ JWT Templates
              └─ + New template (or edit existing "convex")
```

### What You'll See:

```
┌─────────────────────────────────────────────────────────┐
│ Create JWT Template                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Name *                                                  │
│ ┌─────────────────────────────────────────────────┐    │
│ │ convex                                          │    │ ← Type this
│ └─────────────────────────────────────────────────┘    │
│                                                         │
│ Lifetime (seconds) *                                   │
│ ┌─────────────────────────────────────────────────┐    │
│ │ 3600                                            │    │ ← Type this
│ └─────────────────────────────────────────────────┘    │
│                                                         │
│ Claims (JSON)                                          │
│ ┌─────────────────────────────────────────────────┐    │
│ │ {                                               │    │
│ │   "role": "{{user.public_metadata.role}}",     │    │ ← Paste
│ │   "username": "{{user.username}}",             │    │   this
│ │   "email": "{{user.primary_email_address}}",   │    │   JSON
│ │   "plan": "{{user.public_metadata.subscription_│    │
│ │            plan}}"                              │    │
│ │ }                                               │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
│ Audience                                               │
│ ┌─────────────────────────────────────────────────┐    │
│ │                                                 │    │ ← Leave blank
│ └─────────────────────────────────────────────────┘    │ or type: convex
│                                                         │
│ [Apply Changes]                                        │ ← Click this!
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ WRONG - Adding Reserved Claims:
```json
{
  "sub": "{{user.id}}",              ← DON'T ADD THIS!
  "aud": "convex",                    ← DON'T ADD THIS!
  "role": "{{user.public_metadata.role}}"
}
```

### ❌ WRONG - Adding Template Config in Claims:
```json
{
  "name": "convex",                   ← DON'T ADD THIS!
  "lifetime": 3600,                   ← DON'T ADD THIS!
  "role": "{{user.public_metadata.role}}"
}
```

### ✅ CORRECT - Only Custom Claims:
```json
{
  "role": "{{user.public_metadata.role}}",
  "username": "{{user.username}}",
  "email": "{{user.primary_email_address}}",
  "plan": "{{user.public_metadata.subscription_plan}}"
}
```

---

## 🔍 What Each Field Does

### Form Fields (Separate from Claims JSON):

| Field | Value | Purpose |
|-------|-------|---------|
| **Name** | `convex` | Template identifier (must match your code) |
| **Lifetime** | `3600` | Token expiration in seconds (1 hour) |
| **Audience** | blank or `convex` | Sets the `aud` claim automatically |

### Claims Field (JSON object):

| Claim | Template Variable | Result |
|-------|-------------------|--------|
| `role` | `{{user.public_metadata.role}}` | User's role (e.g., "user", "admin") |
| `username` | `{{user.username}}` | Clerk username |
| `email` | `{{user.primary_email_address}}` | User's email |
| `plan` | `{{user.public_metadata.subscription_plan}}` | Subscription tier (if used) |

---

## 📋 Copy-Paste Ready Configuration

### Claims JSON (copy this exactly):
```json
{
  "role": "{{user.public_metadata.role}}",
  "username": "{{user.username}}",
  "email": "{{user.primary_email_address}}",
  "plan": "{{user.public_metadata.subscription_plan}}"
}
```

---

## ✅ Verification

After saving, test your template:

### Browser Console Test:
```javascript
window.Clerk.session.getToken({template: 'convex'})
  .then(token => {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('JWT Payload:', payload);
  });
```

### Expected Output:
```json
{
  "sub": "user_2a1b3c4d5e6f",
  "iat": 1699564800,
  "exp": 1699568400,
  "iss": "https://your-app.clerk.accounts.dev",
  "role": "user",           ← Your custom claim
  "username": "john_doe",   ← Your custom claim
  "email": "john@...",      ← Your custom claim
  "plan": "pro"             ← Your custom claim (if set)
}
```

---

## 🎯 Quick Checklist

Before clicking "Apply Changes":

- [ ] Template name is exactly: `convex`
- [ ] Lifetime is: `3600`
- [ ] Claims JSON has 4 custom claims (role, username, email, plan)
- [ ] Claims JSON does NOT have: sub, iat, exp, iss, aud
- [ ] Audience is blank or `convex`
- [ ] No typos in the template variables (double braces)

Click "Apply Changes" → Done! ✅

---

**Next**: Go to `AUTHENTICATION_COMPLETE_GUIDE.md` for complete testing instructions!
