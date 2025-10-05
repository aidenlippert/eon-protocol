'use client';

import { SmartButton } from '@/components/ui/SmartButton';
import { colors } from '@/lib/design-tokens';

/**
 * @title SmartButton Demo Page
 * @notice Interactive showcase of SmartButton component variants
 */
export default function DemoPage() {
  const simulateAsync = (): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, 2000));
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 gap-12"
      style={{ background: colors.bg.primary }}
    >
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          SmartButton Component
        </h1>
        <p className="text-white/60">
          Interactive buttons with idle, loading, and success states
        </p>
      </div>

      {/* Primary Variant */}
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-xl font-semibold text-white/80">Primary Variant</h2>
        <div className="flex gap-4">
          <SmartButton size="sm" onClick={simulateAsync}>
            Small Button
          </SmartButton>
          <SmartButton size="md" onClick={simulateAsync}>
            Medium Button
          </SmartButton>
          <SmartButton size="lg" onClick={simulateAsync}>
            Large Button
          </SmartButton>
        </div>
      </div>

      {/* Secondary Variant */}
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-xl font-semibold text-white/80">
          Secondary Variant
        </h2>
        <div className="flex gap-4">
          <SmartButton variant="secondary" size="sm" onClick={simulateAsync}>
            Small Button
          </SmartButton>
          <SmartButton variant="secondary" size="md" onClick={simulateAsync}>
            Medium Button
          </SmartButton>
          <SmartButton variant="secondary" size="lg" onClick={simulateAsync}>
            Large Button
          </SmartButton>
        </div>
      </div>

      {/* Outline Variant */}
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-xl font-semibold text-white/80">Outline Variant</h2>
        <div className="flex gap-4">
          <SmartButton variant="outline" size="sm" onClick={simulateAsync}>
            Small Button
          </SmartButton>
          <SmartButton variant="outline" size="md" onClick={simulateAsync}>
            Medium Button
          </SmartButton>
          <SmartButton variant="outline" size="lg" onClick={simulateAsync}>
            Large Button
          </SmartButton>
        </div>
      </div>

      {/* Confetti Demo */}
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-xl font-semibold text-white/80">
          With Confetti 🎉
        </h2>
        <SmartButton
          size="lg"
          showConfetti
          onClick={simulateAsync}
        >
          Complete KYC Verification
        </SmartButton>
      </div>

      {/* Disabled State */}
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-xl font-semibold text-white/80">Disabled State</h2>
        <SmartButton disabled>
          Disabled Button
        </SmartButton>
      </div>

      {/* Real Use Cases */}
      <div className="flex flex-col items-center gap-4 mt-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          Real Dashboard Use Cases
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SmartButton onClick={simulateAsync} showConfetti>
            🔐 Verify Identity (Free)
          </SmartButton>
          <SmartButton variant="secondary" onClick={simulateAsync}>
            💰 Borrow $100 with Collateral
          </SmartButton>
          <SmartButton variant="outline" onClick={simulateAsync}>
            📊 Explore DeFi History
          </SmartButton>
        </div>
      </div>
    </div>
  );
}
