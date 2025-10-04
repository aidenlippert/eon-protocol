# Didit KYC Setup Guide

## Current Status

The KYC integration is **partially configured** but requires a Didit workflow to be created.

## Error You're Seeing

```
Didit API error: 400
You need to create a workflow in Didit dashboard and set DIDIT_WORKFLOW_ID environment variable
```

## Setup Steps

### 1. Create Didit Account & Workflow

1. Go to https://dashboard.didit.me
2. Sign up or log in with your account
3. Navigate to **Workflows** section
4. Click **Create New Workflow**
5. Configure your KYC workflow:
   - **Name**: "Eon Protocol KYC"
   - **Type**: Identity Verification
   - **Level**: Basic (ID only) or Full (ID + Liveness)
   - **Required Documents**: Government ID (passport, driver's license, etc.)
6. Save the workflow and **copy the Workflow ID** (looks like `wf_abc123xyz`)

### 2. Get Your API Credentials

From the Didit dashboard:

- **API Key**: Already have `qcc188jy3-0t_MLRAQ1lfc8QXlBQeVWWEGGnJfosp0A`
- **App ID**: Already have `ad40f592-f0c7-4ee9-829d-4c0882a8640b`
- **Workflow ID**: You need to create this (step 1 above)
- **Webhook Secret**: `VB2Kbry-qKa1_BJ_woS5cb5xu2nl5O7TvYuJa0LlBB8`

### 3. Configure Vercel Environment Variables

Go to your Vercel project settings:

1. Navigate to **Settings** → **Environment Variables**
2. Add the following variables:

```env
DIDIT_API_KEY=qcc188jy3-0t_MLRAQ1lfc8QXlBQeVWWEGGnJfosp0A
DIDIT_APP_ID=ad40f592-f0c7-4ee9-829d-4c0882a8640b
DIDIT_WORKFLOW_ID=<YOUR_WORKFLOW_ID_FROM_STEP_1>
DIDIT_WEBHOOK_SECRET=VB2Kbry-qKa1_BJ_woS5cb5xu2nl5O7TvYuJa0LlBB8
```

3. Click **Save**
4. Redeploy your application

### 4. Configure Webhook in Didit

1. In Didit dashboard, go to **Webhooks**
2. Add webhook URL: `https://your-app.vercel.app/api/didit-webhook`
3. Enable webhook events:
   - Session completed
   - Verification approved
   - Verification rejected
4. Save webhook configuration

## Testing

Once configured:

1. Go to `/profile` page on your app
2. Click "Verify Identity (FREE)" button
3. Didit popup should open with verification flow
4. Complete ID verification
5. Popup closes and score updates automatically

## Troubleshooting

### Still getting 400 error?

**Check:**
- Workflow ID is correct (no typos)
- Environment variable is set in Vercel (not just `.env.local`)
- Application has been redeployed after adding env vars
- API key is still valid in Didit dashboard

### Webhook not receiving events?

**Check:**
- Webhook URL is publicly accessible (not localhost)
- Webhook secret matches in both Didit dashboard and env vars
- SSL certificate is valid on your domain

### How to test locally?

1. Use ngrok to expose localhost: `ngrok http 3000`
2. Update webhook URL in Didit to ngrok URL
3. Add env vars to `.env.local`:
   ```env
   DIDIT_API_KEY=qcc188jy3-0t_MLRAQ1lfc8QXlBQeVWWEGGnJfosp0A
   DIDIT_WORKFLOW_ID=<YOUR_WORKFLOW_ID>
   ```
4. Restart dev server: `npm run dev`

## API Endpoints

### POST /api/kyc-initiate
Creates a Didit verification session for a wallet address.

**Request:**
```json
{
  "walletAddress": "0x1234..."
}
```

**Response (Success):**
```json
{
  "verificationUrl": "https://verify.didit.me/session/abc123",
  "sessionId": "abc123"
}
```

**Response (Error):**
```json
{
  "error": "Didit API error: 400",
  "details": "...",
  "message": "You need to create a workflow..."
}
```

### GET /api/kyc-status?wallet=0x1234...
Checks verification status for a wallet address.

**Response:**
```json
{
  "verified": true|false,
  "verificationId": "abc123",
  "verificationDate": "2025-01-01T00:00:00Z",
  "verificationLevel": "basic"|"full",
  "walletAddress": "0x1234...",
  "userId": "user123"
}
```

### POST /api/didit-webhook
Receives webhook events from Didit when verification completes.

## Architecture

```
User clicks "Verify Identity"
  ↓
Frontend calls /api/kyc-initiate
  ↓
Server calls Didit API with workflow_id
  ↓
Didit returns verification URL
  ↓
User completes KYC in popup
  ↓
Didit sends webhook to /api/didit-webhook
  ↓
Webhook stores verification result
  ↓
Frontend polls /api/kyc-status
  ↓
Score recalculates with KYC bonus
```

## Cost

Didit KYC is **FREE** for users but may have limits on the free tier:
- Check Didit dashboard for your current plan
- Upgrade if you need higher verification volumes
- Current API key may be on free/test tier

## Security Notes

1. **Never expose API key in frontend** - only in server-side env vars
2. **Verify webhook signatures** - prevents fake verification events
3. **Don't store PII** - only store verified status, not user details
4. **Use HTTPS** - required for webhooks and API calls
5. **Rate limit** - prevent spam verification attempts

## Support

- **Didit Docs**: https://docs.didit.me
- **Didit Dashboard**: https://dashboard.didit.me
- **API Reference**: https://docs.didit.me/reference/api-full-flow
- **Support**: support@didit.me

## Next Steps

1. ✅ Create workflow in Didit dashboard
2. ✅ Add DIDIT_WORKFLOW_ID to Vercel env vars
3. ✅ Redeploy application
4. ✅ Test KYC flow
5. ✅ Configure webhook for production
6. ⏳ Monitor verification success rate
7. ⏳ Update smart contracts to use KYC status on-chain
