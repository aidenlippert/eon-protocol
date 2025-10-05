# 🎨 EON PROTOCOL - PROFILE PAGE UI/UX WIREFRAME

**Modern Credit Dashboard - Component Architecture & Interaction Design**

---

## 🎯 DESIGN PHILOSOPHY

**Core Principles:**
- **Fintech-Grade** - Feels like a Bloomberg terminal meets DeFi
- **Data-Rich** - Show ALL evidence, make it verifiable
- **Interactive** - Every element responds to user actions
- **Animated** - Smooth, purposeful motion (not gratuitous)
- **Mobile-First** - Responsive from 320px to 4K

**Visual Language:**
- **Dark Theme** - Deep space aesthetic (`#0A0A0B` base)
- **Neon Accents** - Cyberpunk gradients (purple → blue)
- **Glassmorphism** - Frosted glass cards with backdrop blur
- **Micro-Interactions** - Hover states, click feedback, success animations

---

## 📐 LAYOUT STRUCTURE

```
┌────────────────────────────────────────────────────────────────────┐
│  HEADER (Navbar)                                                   │
│  Logo | Dashboard | Borrow | Profile | Analytics | [0.005 ETH]    │
└────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────┐
│  HERO SECTION                                                      │
│  "Credit Profile" + subtitle                                       │
│  [Refresh Button] [Export Report]                                  │
└────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────┬─────────────────────────────────────┐
│                              │                                     │
│  LEFT COLUMN (60%)           │  RIGHT SIDEBAR (40%)                │
│                              │                                     │
│  ┌──────────────────────┐    │  ┌───────────────────────────────┐ │
│  │  CreditScoreCard     │    │  │  ImprovementActions           │ │
│  │  (Main Gauge)        │    │  │  • High Priority (3 cards)    │ │
│  │  655 / 1000          │    │  │  • Medium Priority (2 cards)  │ │
│  │  Silver Tier         │    │  │  • Low Priority (1 card)      │ │
│  └──────────────────────┘    │  └───────────────────────────────┘ │
│                              │                                     │
│  ┌──────────────────────┐    │  ┌───────────────────────────────┐ │
│  │  TierProgressBar     │    │  │  QuickStats                   │ │
│  │  655 → 750 (Gold)    │    │  │  • Wallet Age: 180 days       │ │
│  └──────────────────────┘    │  │  • Active Loans: 0            │ │
│                              │  │  • Total Borrowed: $0         │ │
│  ┌──────────────────────┐    │  └───────────────────────────────┘ │
│  │  TabNavigation       │    │                                     │
│  │  Overview | Breakdown│    │  ┌───────────────────────────────┐ │
│  │  History | Security  │    │  │  AIInsightsSidebar (Phase 6)  │ │
│  └──────────────────────┘    │  │  "Coming Soon"                │ │
│                              │  └───────────────────────────────┘ │
│  ┌──────────────────────┐    │                                     │
│  │  TAB CONTENT         │    │                                     │
│  │                      │    │                                     │
│  │  (Overview Tab)      │    │                                     │
│  │  • ScoreBreakdown    │    │                                     │
│  │  • CreditTimeline    │    │                                     │
│  │  • FactorCards       │    │                                     │
│  │                      │    │                                     │
│  │  (Breakdown Tab)     │    │                                     │
│  │  • RadarChart        │    │                                     │
│  │  • FactorDetails     │    │                                     │
│  │  • EvidenceLinks     │    │                                     │
│  │                      │    │                                     │
│  │  (History Tab)       │    │                                     │
│  │  • TimelineGraph     │    │                                     │
│  │  • ScoreHistory      │    │                                     │
│  │  • EventLog          │    │                                     │
│  │                      │    │                                     │
│  │  (Security Tab)      │    │                                     │
│  │  • Attestations      │    │                                     │
│  │  • VerificationProof │    │                                     │
│  │  • ExportData        │    │                                     │
│  └──────────────────────┘    │                                     │
│                              │                                     │
└──────────────────────────────┴─────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────┐
│  FOOTER                                                            │
│  © 2025 EON Protocol | Docs | GitHub | Discord                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 COMPONENT HIERARCHY

```
ProfilePage
├─ Navbar
│  ├─ Logo
│  ├─ NavLinks (Dashboard, Borrow, Profile, Analytics)
│  └─ WalletButton (0.005 ETH, 0x1A...4FE3)
│
├─ HeroSection
│  ├─ PageTitle ("Credit Profile")
│  ├─ Subtitle ("Decentralized credit scoring...")
│  └─ ActionButtons
│     ├─ RefreshButton
│     └─ ExportReportButton
│
├─ MainContainer (2-column layout)
│  │
│  ├─ LeftColumn
│  │  │
│  │  ├─ CreditScoreCard
│  │  │  ├─ ScoreGauge (animated circular progress)
│  │  │  ├─ ScoreNumber (655)
│  │  │  ├─ ScoreLabel ("out of 1000")
│  │  │  ├─ TierBadge (Silver, glowing)
│  │  │  └─ LastUpdated ("Updated: 10/4/2025")
│  │  │
│  │  ├─ TierProgressBar
│  │  │  ├─ ProgressLine (gradient fill)
│  │  │  ├─ CurrentPosition (655 marker)
│  │  │  ├─ NextTierTarget (750 Gold marker)
│  │  │  └─ PointsRemaining ("-95 points to Gold")
│  │  │
│  │  ├─ TabNavigation
│  │  │  ├─ Tab (Overview) [active]
│  │  │  ├─ Tab (Breakdown)
│  │  │  ├─ Tab (History)
│  │  │  └─ Tab (Security)
│  │  │
│  │  └─ TabContent
│  │     │
│  │     ├─ OverviewTab
│  │     │  ├─ ScoreBreakdownSection
│  │     │  │  ├─ RadarChart (S1-S5 factors)
│  │     │  │  └─ FactorLegend
│  │     │  │
│  │     │  ├─ FactorCardsGrid (5 cards)
│  │     │  │  ├─ FactorCard (Payment History)
│  │     │  │  │  ├─ Icon (📊)
│  │     │  │  │  ├─ Title ("Payment History")
│  │     │  │  │  ├─ Score (50/100)
│  │     │  │  │  ├─ Weight (35%)
│  │     │  │  │  ├─ Details ("No loan history")
│  │     │  │  │  └─ ExpandButton
│  │     │  │  ├─ FactorCard (Utilization)
│  │     │  │  ├─ FactorCard (Account Age)
│  │     │  │  ├─ FactorCard (DeFi Mix)
│  │     │  │  └─ FactorCard (New Credit)
│  │     │  │
│  │     │  └─ CreditTimeline
│  │     │     ├─ Milestone (Account Created)
│  │     │     ├─ Milestone (First Transaction)
│  │     │     └─ Milestone (Current)
│  │     │
│  │     ├─ BreakdownTab
│  │     │  ├─ InteractiveRadarChart
│  │     │  ├─ FactorDetailsTable
│  │     │  └─ EvidenceSection
│  │     │     ├─ BlockchainProofLink
│  │     │     └─ RawDataViewer
│  │     │
│  │     ├─ HistoryTab
│  │     │  ├─ ScoreTimelineGraph (line chart)
│  │     │  ├─ ScoreHistoryTable
│  │     │  └─ EventLogList
│  │     │     ├─ EventItem (Score Updated)
│  │     │     ├─ EventItem (Tier Changed)
│  │     │     └─ EventItem (Factor Improved)
│  │     │
│  │     └─ SecurityTab
│  │        ├─ AttestationCard (EAS proof)
│  │        ├─ VerificationProofCard (zkProof)
│  │        ├─ DataProvenanceTable
│  │        └─ ExportDataButton
│  │
│  └─ RightSidebar
│     │
│     ├─ ImprovementActionsCard
│     │  ├─ Header
│     │  │  ├─ Title ("Improve Your Score")
│     │  │  ├─ PotentialIncrease ("+53 points")
│     │  │  └─ NextTier ("Next Tier: Gold")
│     │  │
│     │  └─ ActionsList
│     │     ├─ ActionCard (HIGH priority)
│     │     │  ├─ PriorityBadge ("high")
│     │     │  ├─ PointsImpact ("+25 pts")
│     │     │  ├─ Icon (🎯)
│     │     │  ├─ Title ("Complete KYC Verification")
│     │     │  ├─ Description ("Provides +150 sybil bonus...")
│     │     │  ├─ Metadata ("2-3 min, easy")
│     │     │  └─ SmartButton ("Verify Identity (Free)")
│     │     │     ├─ onClick → openActionModal('kyc')
│     │     │     ├─ States: idle | loading | success
│     │     │     └─ Animations: pulse, glow, confetti
│     │     │
│     │     ├─ ActionCard (HIGH)
│     │     │  └─ SmartButton ("Borrow $100 with Collateral")
│     │     │
│     │     ├─ ActionCard (MEDIUM)
│     │     │  └─ SmartButton ("Explore Other Protocols")
│     │     │
│     │     ├─ ActionCard (MEDIUM)
│     │     └─ ActionCard (LOW)
│     │
│     ├─ QuickStatsCard
│     │  ├─ Stat (Wallet Age: 180 days)
│     │  ├─ Stat (Active Loans: 0)
│     │  ├─ Stat (Total Borrowed: $0)
│     │  ├─ Stat (Collateral: 0 ETH)
│     │  └─ Stat (Health Factor: N/A)
│     │
│     └─ AIInsightsSidebar (Phase 6 - greyed out)
│        ├─ ComingSoonBadge
│        ├─ Preview ("AI Score Coach")
│        └─ FeatureDescription
│
└─ ActionModal (Global overlay)
   ├─ ModalOverlay (backdrop blur)
   └─ ModalContent
      ├─ CloseButton
      ├─ ModalHeader
      │  ├─ Icon
      │  ├─ Title
      │  └─ Subtitle
      ├─ ModalBody
      │  ├─ Description
      │  ├─ RewardInfo ("+25 points")
      │  ├─ InstructionSteps
      │  └─ InputFields (if needed)
      └─ ModalFooter
         ├─ CancelButton
         └─ ConfirmButton (SmartButton)
            └─ onClick → executeAction()
```

---

## 🎨 DESIGN SYSTEM TOKENS

### **Colors**

```typescript
// Design System: colors.ts
export const colors = {
  // Backgrounds
  bg: {
    primary: '#0A0A0B',      // Deep matte black
    secondary: '#141416',    // Card background
    tertiary: '#1C1C1F',     // Elevated surface
    glass: 'rgba(20, 20, 22, 0.7)',  // Glassmorphism
  },

  // Accents
  accent: {
    primary: '#B95CFF',      // Neon purple
    secondary: '#5AA9FF',    // Neon blue
    gradient: 'linear-gradient(135deg, #B95CFF 0%, #5AA9FF 100%)',
  },

  // Tier Colors
  tier: {
    bronze: {
      primary: '#fb923c',
      bg: 'rgba(251, 146, 60, 0.1)',
      border: '#fb923c',
    },
    silver: {
      primary: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.1)',
      border: '#94a3b8',
    },
    gold: {
      primary: '#facc15',
      bg: 'rgba(250, 204, 21, 0.1)',
      border: '#facc15',
    },
    platinum: {
      primary: '#a78bfa',
      bg: 'rgba(167, 139, 250, 0.1)',
      border: '#a78bfa',
    },
  },

  // Text
  text: {
    primary: '#FFFFFF',      // White
    secondary: '#A1A1AA',    // Gray 400
    tertiary: '#71717A',     // Gray 500
    muted: '#52525B',        // Gray 600
  },

  // Status
  status: {
    success: '#22C55E',
    warning: '#EAB308',
    error: '#EF4444',
    info: '#3B82F6',
  },

  // Factor Colors (S1-S5)
  factors: {
    payment: '#22C55E',      // Green
    utilization: '#3B82F6',  // Blue
    age: '#F59E0B',          // Amber
    mix: '#8B5CF6',          // Purple
    newCredit: '#EC4899',    // Pink
  },
};
```

### **Typography**

```typescript
// fonts.ts
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    display: ['Satoshi', 'Inter', 'sans-serif'],
    mono: ['Space Grotesk', 'monospace'],
  },

  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '8xl': '6rem',     // 96px (score display)
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};
```

### **Spacing**

```typescript
// spacing.ts
export const spacing = {
  px: '1px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  2: '0.5rem',      // 8px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  24: '6rem',       // 96px
};
```

### **Shadows & Glows**

```typescript
// shadows.ts
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1)',

  // Neon glows
  glow: {
    purple: '0 0 30px rgba(185, 92, 255, 0.3)',
    blue: '0 0 30px rgba(90, 169, 255, 0.3)',
    green: '0 0 30px rgba(34, 197, 94, 0.3)',
    gold: '0 0 30px rgba(250, 204, 21, 0.3)',
  },
};
```

### **Animations**

```typescript
// animations.ts (Framer Motion)
export const animations = {
  // Fade in from bottom
  fadeUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },

  // Scale in
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Slide in from right
  slideRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },

  // Stagger children
  stagger: {
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  },

  // Score counter
  counter: (target: number) => ({
    from: 0,
    to: target,
    duration: 2,
    ease: 'easeOut',
  }),

  // Confetti burst
  confetti: {
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  },
};
```

---

## 🔄 INTERACTION FLOW DIAGRAMS

### **Flow 1: Page Load**

```
1. User navigates to /profile
   ↓
2. useUserScore() hook executes
   ├─ Check localStorage cache
   │  ├─ CACHE HIT → Display cached score instantly
   │  └─ CACHE MISS → Show skeleton loader
   ↓
3. Fetch /api/score/[address]
   ├─ API checks Redis (5min TTL)
   │  ├─ HIT → Return cached (~5ms)
   │  └─ MISS → Execute scoring (~2-5s)
   ↓
4. Receive score data
   ├─ Store in localStorage
   ├─ Store in React state
   └─ Trigger animations
   ↓
5. Animate components sequentially
   ├─ ScoreGauge: 0 → 655 (2s counter)
   ├─ TierBadge: fade in + glow
   ├─ ProgressBar: fill animation
   ├─ FactorCards: stagger fade-up
   └─ ActionCards: stagger slide-right
```

### **Flow 2: Complete KYC Action**

```
1. User clicks "Verify Identity (Free)" SmartButton
   ↓
2. ActionModal opens (backdrop blur + scale-in)
   ├─ Title: "Complete KYC Verification"
   ├─ Description: "Didit provides +150 sybil bonus..."
   ├─ Reward: "+25 points"
   └─ ConfirmButton: "Start Verification"
   ↓
3. User clicks ConfirmButton
   ↓
4. SmartButton state → loading
   ├─ Button text: "Verifying..."
   ├─ Spinner animation
   └─ Disable other interactions
   ↓
5. Execute blockchain transaction
   ├─ await contract.verifyKYC()
   ├─ Wait for confirmation (1-3 blocks)
   └─ Listen for VerificationComplete event
   ↓
6. On success
   ├─ SmartButton state → success
   ├─ Button text: "Verified! ✅"
   ├─ Confetti animation bursts
   ├─ Score updates: 655 → 680 (animated)
   ├─ Tier badge glows brighter
   ├─ ActionCard marks complete ✅
   └─ Close modal after 2s
   ↓
7. Update cache
   ├─ Invalidate /api/score/[address]
   ├─ Refresh localStorage
   └─ Update UI state
```

### **Flow 3: View Factor Breakdown**

```
1. User clicks "Factor Breakdown" tab
   ↓
2. Tab content switches (fade transition)
   ↓
3. RadarChart renders
   ├─ Animate from center outward
   ├─ Draw axes with labels (S1-S5)
   ├─ Fill sectors with gradient
   └─ Add hover tooltips
   ↓
4. User hovers over "Payment History" sector
   ↓
5. Tooltip appears
   ├─ Factor name: "Payment History"
   ├─ Score: "50/100"
   ├─ Weight: "35%"
   ├─ Details: "No loan history available"
   └─ Evidence link: "View blockchain proof →"
   ↓
6. User clicks evidence link
   ↓
7. Evidence modal opens
   ├─ Raw data JSON viewer
   ├─ Blockchain transaction links
   ├─ Timestamp metadata
   └─ Export button
```

### **Flow 4: Take First Loan**

```
1. User clicks "Borrow $100 with Collateral"
   ↓
2. BorrowModal opens
   ├─ Input: Loan amount ($100 default)
   ├─ Input: Collateral amount (auto-calculate LTV)
   ├─ Preview: New score estimate (+20 pts)
   └─ ConfirmButton: "Borrow Now"
   ↓
3. User adjusts amounts
   ├─ Real-time LTV calculation
   ├─ Health factor preview
   └─ Score impact simulation
   ↓
4. User clicks "Borrow Now"
   ↓
5. SmartButton → loading
   ├─ Approve collateral token (if needed)
   ├─ Execute CreditVault.borrow()
   └─ Wait for confirmation
   ↓
6. On success
   ├─ Confetti animation
   ├─ Score: 655 → 675 (+20)
   ├─ Timeline adds "First Loan" milestone
   ├─ QuickStats updates (Active Loans: 1)
   └─ Close modal
```

---

## 📱 RESPONSIVE BREAKPOINTS

```typescript
// breakpoints.ts
export const breakpoints = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1440px',
  ultrawide: '1920px',
};

// Layout behavior
// Mobile (320-767px): Single column, stacked cards
// Tablet (768-1023px): Single column, wider cards
// Desktop (1024-1439px): 2-column layout (60/40 split)
// Wide (1440px+): 2-column layout with max-width container
```

### **Mobile Layout Adjustments**

```
Mobile (< 768px):
├─ Navbar → Hamburger menu
├─ CreditScoreCard → Full width
├─ TierProgressBar → Vertical orientation
├─ TabNavigation → Horizontal scroll
├─ LeftColumn → 100% width
├─ RightSidebar → Stacked below left column
└─ ActionCards → Full width, vertical stack
```

---

## 🎭 COMPONENT STATE MANAGEMENT

### **Global State (React Context)**

```typescript
// CreditScoreContext.tsx
interface CreditScoreState {
  score: number;
  tier: string;
  breakdown: FactorBreakdown;
  history: ScoreHistory[];
  loading: boolean;
  error: Error | null;
}

const CreditScoreContext = createContext<CreditScoreState>();

export function useCreditScore() {
  return useContext(CreditScoreContext);
}
```

### **Local Component State**

```typescript
// ActionCard.tsx
const [isExpanded, setIsExpanded] = useState(false);
const [isCompleted, setIsCompleted] = useState(false);
const [isLoading, setIsLoading] = useState(false);

// FactorCard.tsx
const [showEvidence, setShowEvidence] = useState(false);

// ActionModal.tsx
const [isOpen, setIsOpen] = useState(false);
const [activeAction, setActiveAction] = useState<ActionType | null>(null);
```

---

## 🔌 DATA FETCHING STRATEGY

### **SWR Configuration**

```typescript
// hooks/useUserScore.ts
import useSWR from 'swr';

export function useUserScore(address: string) {
  const { data, error, mutate } = useSWR(
    address ? `/api/score/${address}` : null,
    fetcher,
    {
      refreshInterval: 30000,        // Auto-refresh every 30s
      revalidateOnFocus: true,       // Refresh on tab focus
      revalidateOnReconnect: true,   // Refresh on network recovery
      dedupingInterval: 5000,        // Dedupe requests within 5s
      fallbackData: getCachedScore(address), // Instant from localStorage
    }
  );

  return {
    score: data?.score ?? 0,
    tier: data?.tier ?? 'Bronze',
    breakdown: data?.breakdown ?? {},
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  };
}
```

---

## 🎬 ANIMATION TIMELINE

### **Page Load Animation Sequence**

```
Timeline (staggered):
0ms:   Navbar fade-in
100ms: Hero section fade-in
200ms: CreditScoreCard scale-in
400ms: Score counter 0→655 (2000ms duration)
600ms: TierBadge glow-in
800ms: TierProgressBar fill animation
1000ms: TabNavigation slide-right
1200ms: FactorCards[0] fade-up
1300ms: FactorCards[1] fade-up
1400ms: FactorCards[2] fade-up
1500ms: FactorCards[3] fade-up
1600ms: FactorCards[4] fade-up
1800ms: ActionCards stagger fade-right
```

### **Action Success Animation**

```
Timeline (on KYC verification):
0ms:   Confetti burst from button center
100ms: Score number pulse + scale (1.0 → 1.2 → 1.0)
200ms: Score counter 655 → 680 (1000ms duration)
500ms: TierBadge glow pulse (3 times)
800ms: ProgressBar extend animation
1000ms: ActionCard checkmark ✅ appear
1200ms: Success toast notification
2000ms: Modal fade-out + close
```

---

## 🧪 ACCESSIBILITY (A11Y)

```typescript
// Keyboard Navigation
- Tab: Navigate through interactive elements
- Enter/Space: Activate buttons
- Escape: Close modals
- Arrow Keys: Navigate tabs

// Screen Reader Labels
<button aria-label="Verify your identity with Didit KYC">
  Verify Identity (Free)
</button>

<div role="progressbar" aria-valuenow={655} aria-valuemin={0} aria-valuemax={1000}>
  Credit Score: 655 out of 1000
</div>

// Focus Management
- Trap focus in modals
- Return focus to trigger button on close
- Visible focus indicators (outline ring)

// Color Contrast
- All text meets WCAG AA (4.5:1 minimum)
- Interactive elements have sufficient contrast
- Don't rely on color alone for meaning
```

---

## 🚀 PERFORMANCE OPTIMIZATIONS

```typescript
// Code Splitting
const ActionModal = lazy(() => import('@/components/ActionModal'));
const RadarChart = lazy(() => import('@/components/RadarChart'));
const CreditTimeline = lazy(() => import('@/components/CreditTimeline'));

// Image Optimization
import Image from 'next/image';
<Image src="/icon.png" width={24} height={24} alt="Icon" />

// Memoization
const MemoizedFactorCard = memo(FactorCard);
const MemoizedActionCard = memo(ActionCard);

// Virtual Scrolling (for long lists)
import { FixedSizeList } from 'react-window';

// Debouncing
const debouncedSearch = useDebounce(searchTerm, 300);
```

---

**This wireframe is your complete blueprint for building a production-grade credit dashboard. Every component, interaction, and animation is mapped out.** 🎨

**Ready to start building? Which component should we tackle first?**
- SmartButton (most reused)
- CreditScoreCard (visual centerpiece)
- ActionModal (core interaction)