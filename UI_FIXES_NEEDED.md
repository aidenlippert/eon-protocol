# UI Fixes Needed - EON Protocol

## 🐛 Critical Issues

### 1. Dashboard Shows Wrong Score (30 vs 494)
**Problem**: Dashboard uses OLD on-chain scoring (5-factor), Profile uses NEW API scoring (7-factor)

**Current**:
- Dashboard: `useReadContract` → ScoreOraclePhase3B → Returns 30
- Profile: `/api/score` → 7-factor model → Returns 494

**Fix**: Update Dashboard to use `/api/score` endpoint like Profile does

**File**: `/frontend/components/dashboard/CreditScoreCard.tsx`
```tsx
// REPLACE: useReadContract with fetch('/api/score/[address]')
const [scoreData, setScoreData] = useState(null);

useEffect(() => {
  if (address) {
    fetch(`/api/score/${address}`)
      .then(res => res.json())
      .then(data => setScoreData(data));
  }
}, [address]);
```

### 2. Profile Borrow Button Doesn't Work
**Problem**: BorrowModal on Profile page fails with API 500 errors

**Current Status**:
- Latest fix pushed (commit `39b9206`)
- Changed `NEXT_PUBLIC_VERCEL_URL` → `VERCEL_URL`
- Waiting for Vercel deployment

**Test After Deployment**:
1. Hard refresh page (Ctrl+Shift+R)
2. Click "Borrow $100" on Profile
3. Should show tier bands and work

---

## 🎨 Design Improvements Needed

### 3. /borrow Page Redesign
**Current**: Basic form, looks incomplete
**Needed**: Professional DeFi lending interface

**Requirements**:
- Clean, modern design matching Profile/Dashboard
- Visual tier comparison (Bronze/Silver/Gold/Platinum)
- Real-time collateral calculator
- Clear CTAs and status indicators
- Loading states and error handling

### 4. Dashboard UI Polish
**Issues**:
- Inconsistent spacing
- Score card too small
- Missing visual hierarchy
- Tabs look basic

**Improvements**:
- Larger score display (like Profile)
- Better visual separation
- Gradient backgrounds
- Animated progress bars
- Tier badge with icon

### 5. Home Page Redesign
**Current**: Basic landing page
**Needed**: Engaging hero section

**Requirements**:
- Eye-catching hero with gradient
- Clear value proposition
- Live stats (TVL, users, loans)
- "Connect Wallet" CTA
- Feature highlights
- Social proof/testimonials

---

## 🛠️ Implementation Priority

### High Priority (Fix Now)
1. ✅ Fix Dashboard score (use API not contract)
2. ⏳ Verify Profile borrow works (after deployment)
3. ✅ Remove confetti from TransactionStepper
4. ✅ Add tier bands to BorrowModal

### Medium Priority (Polish)
5. Redesign /borrow page
6. Improve Dashboard visual design
7. Polish Home page hero

### Low Priority (Nice to Have)
8. Add animations to score cards
9. Add tooltips for factors
10. Dark/light mode toggle

---

## 📝 Quick Fixes

### Fix 1: Update Dashboard to Use API

```tsx
// File: /frontend/components/dashboard/CreditScoreCard.tsx

"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

export function CreditScoreCard() {
  const { address } = useAccount();
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;

    setLoading(true);
    fetch(`/api/score/${address}`)
      .then(res => res.json())
      .then(data => {
        setScoreData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Score fetch error:', err);
        setLoading(false);
      });
  }, [address]);

  if (loading) return <div>Loading score...</div>;
  if (!scoreData) return <div>Connect wallet to see score</div>;

  const { score, tier } = scoreData;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Credit Score</CardTitle>
        <CardDescription>Complete 7-factor on-chain credit assessment</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-6">
          <div className="text-6xl font-bold text-violet-400 mb-2">{score}</div>
          <Badge>{tier}</Badge>
          <div className="text-sm text-neutral-400 mt-2">out of 1000</div>
        </div>
        {/* Rest of component... */}
      </CardContent>
    </Card>
  );
}
```

### Fix 2: Simplify Borrow Page

```tsx
// File: /frontend/app/borrow/page.tsx

'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { BorrowModal } from '@/components/modals/BorrowModal';
import { SmartButton } from '@/components/ui/SmartButton';

export default function BorrowPage() {
  const { isConnected } = useAccount();
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState(100);

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <h1 className="text-4xl font-bold mb-4">Borrow</h1>
        <p className="text-neutral-400">Connect wallet to borrow</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Borrow Stablecoins</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <QuickBorrowCard amount={100} onClick={() => { setAmount(100); setShowModal(true); }} />
          <QuickBorrowCard amount={250} onClick={() => { setAmount(250); setShowModal(true); }} />
          <QuickBorrowCard amount={500} onClick={() => { setAmount(500); setShowModal(true); }} />
        </div>

        <BorrowModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          initialAmount={amount}
        />
      </div>
    </div>
  );
}
```

---

## ✅ Already Fixed

- ✅ Removed confetti animation
- ✅ Added tier collateral bands to BorrowModal
- ✅ Debounced input (no reset on keystroke)
- ✅ Scrollable modal (no overflow)
- ✅ Fixed API URL for borrow estimate
- ✅ Added Covalent API key to Vercel

---

## 🔄 Status

**Deployment**: Waiting for Vercel (commit `39b9206`)
**Testing**: Need to verify borrow works after deployment
**Next**: Fix Dashboard score, then polish UI
