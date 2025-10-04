# 🔧 Didit Integration Fix - Action Required

## 🚨 CRITICAL ISSUE IDENTIFIED

Your Didit KYC integration is failing because **workflow_id is in wrong format**.

### Current Status
- ✅ API Key: `qcc188jy3-0t_MLRAQ1lfc8QXlBQeVWWEGGnJfosp0A` (valid)
- ✅ App ID: `ad40f592-f0c7-4ee9-829d-4c0882a8640b` (valid UUID)
- ❌ Workflow ID: `54740218` (INVALID - wrong format)
- ✅ Webhook Secret: `VB2Kbry-qKa1_BJ_woS5cb5xu2nl5O7TvYuJa0LlBB8` (valid)

### The Problem

**Error from Didit API:**
```json
{
  "workflow_id": ["Must be a valid UUID."]
}
```

**Current workflow_id:** `54740218` (numeric)
**Required format:** `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (UUID)

**Example:** `ad40f592-f0c7-4ee9-829d-4c0882a8640b`

---

## ✅ SOLUTION: Get the Correct Workflow UUID

### Step 1: Access Didit Console

1. Go to **https://business.didit.me** (or **https://console.didit.me**)
2. Login with your account credentials
3. Navigate to **"Workflows"** section in the sidebar

### Step 2: Find Your Workflow UUID

The workflow `54740218` appears to be a workflow **number** or **internal ID**, not the **UUID** that the API requires.

In the Didit Console, you should see:
```
Workflow Name: Eon Protocol KYC (or similar)
Workflow ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  ← THIS is what you need!
Workflow Number: #54740218  ← This is what you currently have (wrong!)
```

### Step 3: Update Your Code

Once you have the **correct UUID**, update the following file:

**File:** `/frontend/components/kyc/DiditWidget.tsx`

**Change line 12 from:**
```typescript
const DIDIT_WORKFLOW_ID = "54740218";
```

**To:**
```typescript
const DIDIT_WORKFLOW_ID = "your-actual-uuid-here"; // e.g., "ad40f592-f0c7-4ee9-829d-4c0882a8640b"
```

### Step 4: (Optional) Set as Environment Variable

For better security and flexibility, set the workflow ID as an environment variable:

**Add to Vercel environment variables:**
```env
NEXT_PUBLIC_DIDIT_WORKFLOW_ID=your-actual-uuid-here
```

**Then update the code:**
```typescript
const DIDIT_WORKFLOW_ID = process.env.NEXT_PUBLIC_DIDIT_WORKFLOW_ID || "your-actual-uuid-here";
```

---

## 🧪 Testing After Fix

### 1. Test API Call Manually

```bash
curl -X POST https://verification.didit.me/v2/session/ \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: qcc188jy3-0t_MLRAQ1lfc8QXlBQeVWWEGGnJfosp0A" \
  -d '{
    "workflow_id": "YOUR_ACTUAL_UUID_HERE",
    "vendor_data": "test_wallet_0x123"
  }'
```

**Expected Success Response:**
```json
{
  "session_id": "abc123...",
  "session_token": "xyz...",
  "status": "pending",
  "url": "https://verify.didit.me/session/abc123..."
}
```

### 2. Test in Your App

1. Go to your deployed app: **https://eon-protocol.vercel.app/profile**
2. Connect your wallet
3. Click **"Start KYC Verification"** button
4. Popup should open with Didit verification flow (not error)

---

## 📋 Common Issues & Solutions

### Issue: "Can't find workflow UUID in Didit Console"

**Solution:**
- Check if you're logged into the correct account
- Verify you have the workflow created (if not, create one!)
- Look for "Workflow ID", "UUID", or "API ID" field (not "Workflow Number")

### Issue: "Workflow doesn't exist yet"

**Create a new workflow:**
1. In Didit Console, go to **Workflows → Create New Workflow**
2. Set name: `Eon Protocol KYC`
3. Select verification type: **Identity Verification**
4. Choose level: **Full** (ID + Liveness for maximum security)
5. Save and **copy the UUID** (not the number!)

### Issue: "Still getting 400 error after updating UUID"

**Checklist:**
- ✅ UUID is in correct format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
- ✅ UUID matches exactly from Didit Console (no typos)
- ✅ Workflow is active/published in Didit Console
- ✅ API key is still valid (test with curl command above)
- ✅ Redeployed app after code change (Vercel)

---

## 🔍 Debugging Logs

Your API route already has good logging. After the fix, you should see:

**Console logs:**
```
=== KYC Session Creation ===
API Key present: true
Workflow ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Vendor data: 0x1234...
Calling Didit API...
Didit API status: 201
✅ Session created: abc123...
Session URL: https://verify.didit.me/session/abc123...
```

**Instead of:**
```
Didit API status: 400
❌ Didit API error: {"workflow_id":["Must be a valid UUID."]}
```

---

## 🎯 Next Steps After Fix

1. ✅ **Fix workflow_id** → Get UUID from Didit Console
2. ✅ **Update code** → Change line 12 in DiditWidget.tsx
3. ✅ **Redeploy** → Push to GitHub or redeploy on Vercel
4. ✅ **Test** → Try KYC flow on live site
5. ✅ **Configure webhook** → Point to `/api/didit-webhook` endpoint
6. ✅ **Monitor** → Check logs for successful verifications

---

## 📞 Need Help?

### Didit Support
- **Docs:** https://docs.didit.me
- **Console:** https://business.didit.me
- **Support:** support@didit.me

### Your Integration Status
- ✅ API credentials: Valid
- ✅ API routes: Implemented correctly
- ✅ Widget component: Properly integrated
- ✅ Webhook handler: Ready
- ❌ **Workflow UUID: NEEDS FIX** ← You are here

Once you update the workflow_id to the correct UUID format, everything should work perfectly! 🚀

---

## Summary

**What's wrong:** Workflow ID `54740218` is a number, but Didit API requires UUID format.

**How to fix:**
1. Login to Didit Console at https://business.didit.me
2. Find your workflow's **UUID** (not the number)
3. Update `DIDIT_WORKFLOW_ID` in `DiditWidget.tsx`
4. Redeploy and test

**Expected result:** KYC verification popup opens successfully, users can complete verification, +150 score bonus applied! 🎉
