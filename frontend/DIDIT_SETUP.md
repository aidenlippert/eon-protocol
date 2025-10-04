# Didit KYC Integration - Setup Guide

## Required Environment Variables

Add these to your Vercel project:

1. **DIDIT_API_KEY** - Get from https://console.didit.me/api-webhooks
   - Click "API & Webhooks" in left sidebar
   - Copy your API Key

2. **DIDIT_WEBHOOK_SECRET** - Get from same page
   - Copy your Webhook Secret Key

3. **NEXT_PUBLIC_APP_URL** - Your deployed Vercel URL
   - Example: `https://eon-protocol-abc123.vercel.app`

## How to Add in Vercel

1. Go to https://vercel.com/aidens-projects-00fa67bc/eon-protocol/settings/environment-variables

2. Add these variables:
   ```
   DIDIT_API_KEY=<your-api-key>
   DIDIT_WEBHOOK_SECRET=<your-webhook-secret>
   NEXT_PUBLIC_APP_URL=https://your-deployment-url.vercel.app
   ```

3. Click "Save"

4. Redeploy your project

## Testing

After adding the API key:

1. Visit your deployed site
2. Connect wallet
3. Click "Start KYC Verification"
4. **Should see**: Modal with embedded Didit verification (NOT redirect to website)
5. Complete ID verification
6. Modal closes on success

## Troubleshooting

**If it redirects to didit.me instead of showing modal:**
- Check that DIDIT_API_KEY is set in Vercel
- Check browser console for errors
- Verify the API created a session (check Network tab)

**If iframe doesn't load:**
- Check browser console for CORS errors
- Verify the session URL is correct
- Make sure iframe has `allow="camera; microphone"`

## Current Status

✅ Code is ready
❌ Waiting for DIDIT_API_KEY environment variable
