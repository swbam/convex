# 🔧 MCP Server Configuration & Connection Guide

## Current MCP Setup Status

### ✅ Working MCPs
1. **Context7** - Documentation lookup (enabled)
2. **Chrome DevTools** - Browser automation (enabled)
3. **Magic UI Design** - UI components (enabled)

### ⚠️ Authentication Issues
1. **Convex Production** - Requires `npx convex dev` login
2. **Clerk** - Returns "Unauthorized" (need to verify API key)

### 🚫 Disabled MCPs (Not Needed for This App)
1. Supabase servers (multiple) - App uses Convex, not Supabase
2. Playwright - Alternative to Chrome DevTools
3. Browser MCP - Duplicate of Chrome DevTools
4. MCP Router - Not currently used
5. GTM - Google Tag Manager (not needed)

---

## How to Fix Convex MCP Connection

### Issue
```
Tool: status, Result: {"error":"Not Authorized: Run `npx convex dev` to login to your Convex project."}
```

### Solution Options

#### Option 1: Login to Convex (Recommended)
```bash
cd /Users/seth/convex-app
npx convex dev
```

This will:
1. Authenticate with Convex
2. Create `.convex/` directory with auth tokens
3. Enable MCP access to production database

#### Option 2: Use CONVEX_ADMIN_KEY (Already Configured)
The MCP config already has `CONVEX_ADMIN_KEY` set:
```json
"env": {
  "CONVEX_DEPLOY_KEY": "prod:exuberant-weasel-22|...",
  "CONVEX_URL": "https://exuberant-weasel-22.convex.cloud",
  "CONVEX_ADMIN_KEY": "prod:exuberant-weasel-22|..."
}
```

If still not working, verify the key is valid in Convex dashboard.

#### Option 3: Manual Review (Current Approach)
Since MCPs are having auth issues, I'll use:
- Direct file reading (schema.ts, functions)
- Terminal commands (npx convex run queries)
- Context7 for documentation review

---

## How to Fix Clerk MCP Connection

### Issue
```
Tool: getUserCount, Result: Unauthorized
```

### Diagnosis
The Clerk secret key in config:
```
--secret-key==sk_live_eqgsuvILjNLqFPG3QfJIwff4DUfQ9SoImbEBvSZwJp
```

Notice the **double equals** (`==`) - should be single `=`.

### Solution
Update `/Users/seth/.cursor/mcp.json`:

**Current (Line 99)**:
```json
"--secret-key==sk_live_eqgsuvILjNLqFPG3QfJIwff4DUfQ9SoImbEBvSZwJp"
```

**Fixed**:
```json
"--secret-key=sk_live_eqgsuvILjNLqFPG3QfJIwff4DUfQ9SoImbEBvSZwJp"
```

### Manual Fix Steps
1. Open `/Users/seth/.cursor/mcp.json`
2. Find line 99 (clerk server config)
3. Change `--secret-key==` to `--secret-key=` (remove extra `=`)
4. Save and restart Cursor

---

## Recommended MCP Configuration

### Keep Enabled (Core Tools)
```json
{
  "clerk": {
    "disabled": false,  // ← Fix auth issue first
    "command": "npx",
    "args": ["-y", "@clerk/agent-toolkit", "-p=local-mcp", "--tools=users", "--secret-key=sk_live_..."]
  },
  "convex-production": {
    "disabled": false,  // ← Run npx convex dev to fix auth
    "env": {
      "CONVEX_DEPLOY_KEY": "prod:...",
      "CONVEX_URL": "https://exuberant-weasel-22.convex.cloud",
      "CONVEX_ADMIN_KEY": "prod:..."
    }
  },
  "context7": {
    "disabled": false  // ✅ Already working
  },
  "chrome-devtools": {
    "disabled": false  // ✅ Already working
  },
  "@magicuidesign/mcp": {
    "disabled": false  // ✅ Already working
  }
}
```

### Disable (Not Needed)
```json
{
  "supabase": { "disabled": true },
  "supabase-set2": { "disabled": true },
  "supabase-mysetlist": { "disabled": true },
  "supabase-2025": { "disabled": true },
  "supabase-project-2025": { "disabled": true },
  "playwright-mcp-server": { "disabled": true },
  "browsermcp": { "disabled": true },
  "gtm-mcp-server": { "disabled": true },
  "mcp-router": { "disabled": true }
}
```

### Development vs Production
- **convex-production**: Use for production reviews
- **convex-development**: Enable only when testing dev deployment

---

## Manual Testing Commands (While MCPs are Down)

### Convex Production Database

#### List All Tables
```bash
npx convex run --prod internal.tables:list
```

#### Query Shows Without Setlists
```bash
npx convex run --prod diagnostics:findShowsWithoutSetlists '{"limit": 50}'
```

#### Check Admin Stats
```bash
npx convex run --prod admin:getAdminStatsInternal
```

#### Run Backfill
```bash
npx convex run --prod admin:testBackfillMissingSetlists '{"limit": 500}'
```

### Clerk User Management

#### Get User Count (via Clerk Dashboard)
Visit: https://dashboard.clerk.com/

Or use Clerk Backend API directly:
```bash
curl -X GET https://api.clerk.com/v1/users/count \
  -H "Authorization: Bearer sk_live_eqgsuvILjNLqFPG3QfJIwff4DUfQ9SoImbEBvSZwJp"
```

---

## Context7 Working Examples

### Get Convex Docs
```typescript
mcp_context7_get-library-docs({
  context7CompatibleLibraryID: "/llmstxt/convex_dev_llms-full_txt",
  topic: "cron jobs and scheduling",
  tokens: 3000
})
```

### Get Clerk Docs
```typescript
mcp_context7_get-library-docs({
  context7CompatibleLibraryID: "/llmstxt/clerk_com-docs-llms-full.txt",
  topic: "webhooks and user sync",
  tokens: 3000
})
```

---

## Alternative Review Approach (Without MCPs)

Since MCPs have auth issues, here's how to do comprehensive review:

### 1. Database Schema Review
```bash
# Read schema directly
cat convex/schema.ts

# Check generated types
cat convex/_generated/dataModel.d.ts
```

### 2. Function Specs Review
```bash
# List all functions
ls -R convex/*.ts

# Check validators
grep -r "returns:" convex/
grep -r "args:" convex/
```

### 3. Production Data Review
```bash
# Query via Convex CLI
npx convex run --prod shows:getAll '{"limit": 10}'
npx convex run --prod artists:getAll '{"limit": 10}'
npx convex run --prod setlists:getByShow '{"showId": "..."}'
```

### 4. Logs Review
```bash
# Check Convex dashboard:
https://dashboard.convex.dev/

# Or via CLI:
npx convex logs --prod
```

### 5. Cron Jobs Review
```bash
# Check crons.ts
cat convex/crons.ts

# Verify in Convex dashboard → Crons tab
```

---

## MCP Connection Checklist

### Convex MCP
- [ ] Run `npx convex dev` to authenticate
- [ ] Verify `.convex/` directory created
- [ ] Test with `mcp_convex-production_status`
- [ ] If works: Query tables with `mcp_convex-production_tables`

### Clerk MCP  
- [ ] Fix double equals in mcp.json (line 99)
- [ ] Restart Cursor
- [ ] Test with `mcp_clerk_getUserCount`
- [ ] If works: Query users with `mcp_clerk_getUser`

### Context7 MCP
- [x] Already working ✅
- [x] Can fetch Convex docs
- [x] Can fetch Clerk docs

---

## What Each MCP Provides

### Convex MCP (When Working)
- **status**: Get deployment info
- **tables**: List all DB tables with schemas
- **data**: Read table data (paginated)
- **functionSpec**: List all functions with validators
- **run**: Execute functions remotely
- **logs**: Read deployment logs
- **envList/Get/Set**: Manage environment variables

### Clerk MCP (When Working)
- **getUserCount**: Total user count
- **getUser**: Get user details by ID
- **updateUser**: Update user profile
- **updateUserPublicMetadata**: Update public metadata
- **updateUserUnsafeMetadata**: Update unsafe metadata

### Context7 MCP (Working Now)
- **resolve-library-id**: Find library documentation
- **get-library-docs**: Fetch docs for Convex, Clerk, etc.

---

## Immediate Fix Steps

1. **Fix Clerk MCP**:
   ```bash
   # Edit mcp.json
   nano /Users/seth/.cursor/mcp.json
   # Change line 99: --secret-key== to --secret-key=
   # Save and restart Cursor
   ```

2. **Fix Convex MCP**:
   ```bash
   cd /Users/seth/convex-app
   npx convex dev
   # Follow prompts to authenticate
   # Once authenticated, MCP should work
   ```

3. **Test Connections**:
   ```bash
   # After fixes, test each MCP in Cursor
   ```

---

## Why MCPs Matter for Review

### Without MCPs (Current)
- ✅ Can read code files
- ✅ Can run CLI commands
- ✅ Can review schema/functions
- ❌ Can't query live production data
- ❌ Can't check Clerk user stats
- ❌ Can't read deployment logs

### With MCPs (After Fix)
- ✅ Everything above PLUS:
- ✅ Query production database tables
- ✅ Check live user counts
- ✅ Read deployment logs
- ✅ Verify environment variables
- ✅ Test functions remotely
- ✅ Compare docs vs implementation

---

## Summary

**Context7**: ✅ Working - Used for doc lookup  
**Convex MCP**: ⚠️ Needs auth - Run `npx convex dev`  
**Clerk MCP**: ⚠️ Config error - Fix double equals  
**Chrome DevTools**: ✅ Available (not needed for backend review)  
**Magic UI**: ✅ Available (already used in app)  

**Current Approach**: Manual review via file reading + CLI commands  
**After MCPs Fixed**: Can query live data and verify production state  

Let me proceed with manual comprehensive review now.

