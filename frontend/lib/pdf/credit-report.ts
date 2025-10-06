import jsPDF from 'jspdf';

interface ScoreBreakdown {
  s1_payment_history: number;
  s2_credit_utilization: number;
  s3_account_age: number;
  s4_identity_trust: number;
  s5_asset_diversity: number;
  s6_protocol_mix: number;
  s7_activity_control: number;
}

interface LoanData {
  id: string;
  principalUsd18: string;
  timestamp: string;
  status: string;
  aprBps: number;
}

interface CreditReportData {
  address: string;
  score: number;
  tier: string;
  breakdown: ScoreBreakdown;
  loans: LoanData[];
  kycVerified: boolean;
  easAttestation?: string;
  totalBorrowed: number;
  totalRepaid: number;
  onTimePayments: number;
}

export async function generateCreditReport(data: CreditReportData): Promise<Blob> {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(139, 92, 246); // violet-500
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('EON PROTOCOL', 20, 20);
  doc.setFontSize(14);
  doc.text('Credit Report', 20, 30);

  // Report metadata
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 150, 20);
  doc.text(`Address: ${data.address.slice(0, 10)}...${data.address.slice(-8)}`, 150, 26);

  // Credit Score Section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text('Credit Score Overview', 20, 55);

  doc.setFontSize(48);
  doc.setTextColor(139, 92, 246);
  doc.text(data.score.toString(), 20, 80);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Tier: ${data.tier}`, 60, 75);

  // KYC Status
  if (data.kycVerified) {
    doc.setTextColor(34, 197, 94); // green-500
    doc.text('✓ KYC Verified', 60, 85);
  } else {
    doc.setTextColor(239, 68, 68); // red-500
    doc.text('✗ KYC Not Verified', 60, 85);
  }

  // Score Breakdown
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text('Score Breakdown (7-Factor Model)', 20, 100);

  const factors = [
    { name: 'S1: Payment History', value: data.breakdown.s1_payment_history, max: 300 },
    { name: 'S2: Credit Utilization', value: data.breakdown.s2_credit_utilization, max: 200 },
    { name: 'S3: Account Age', value: data.breakdown.s3_account_age, max: 150 },
    { name: 'S4: Identity Trust', value: data.breakdown.s4_identity_trust, max: 150 },
    { name: 'S5: Asset Diversity', value: data.breakdown.s5_asset_diversity, max: 100 },
    { name: 'S6: Protocol Mix', value: data.breakdown.s6_protocol_mix, max: 75 },
    { name: 'S7: Activity Control', value: data.breakdown.s7_activity_control, max: 25 },
  ];

  let yPos = 110;
  doc.setFontSize(10);

  factors.forEach(factor => {
    doc.setTextColor(100, 100, 100);
    doc.text(factor.name, 20, yPos);

    // Progress bar
    const barWidth = 80;
    const fillWidth = (factor.value / factor.max) * barWidth;

    doc.setDrawColor(200, 200, 200);
    doc.rect(110, yPos - 4, barWidth, 6, 'S');

    doc.setFillColor(139, 92, 246);
    doc.rect(110, yPos - 4, fillWidth, 6, 'F');

    doc.setTextColor(0, 0, 0);
    doc.text(`${factor.value}/${factor.max}`, 195, yPos);

    yPos += 8;
  });

  // Loan History Section
  yPos += 10;
  doc.setFontSize(14);
  doc.text('Loan History', 20, yPos);

  yPos += 10;
  doc.setFontSize(10);

  // Loan summary
  doc.setTextColor(100, 100, 100);
  doc.text(`Total Borrowed: $${data.totalBorrowed.toFixed(2)}`, 20, yPos);
  doc.text(`Total Repaid: $${data.totalRepaid.toFixed(2)}`, 80, yPos);
  doc.text(`On-Time Payments: ${data.onTimePayments}`, 140, yPos);

  yPos += 10;

  // Loan table header
  doc.setFillColor(240, 240, 240);
  doc.rect(20, yPos - 5, 170, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.text('Loan ID', 25, yPos);
  doc.text('Amount', 60, yPos);
  doc.text('APR', 100, yPos);
  doc.text('Status', 130, yPos);
  doc.text('Date', 160, yPos);

  yPos += 8;

  // Loan entries
  data.loans.slice(0, 10).forEach(loan => {
    const amount = parseFloat(loan.principalUsd18) / 1e18;
    const apr = loan.aprBps / 100;
    const date = new Date(Number(loan.timestamp) * 1000).toLocaleDateString();

    doc.setTextColor(60, 60, 60);
    doc.text(`#${loan.id}`, 25, yPos);
    doc.text(`$${amount.toFixed(0)}`, 60, yPos);
    doc.text(`${apr.toFixed(1)}%`, 100, yPos);

    if (loan.status === 'Repaid') {
      doc.setTextColor(34, 197, 94);
    } else if (loan.status === 'Active') {
      doc.setTextColor(59, 130, 246);
    } else {
      doc.setTextColor(239, 68, 68);
    }
    doc.text(loan.status, 130, yPos);

    doc.setTextColor(60, 60, 60);
    doc.text(date, 160, yPos);

    yPos += 6;

    if (yPos > 270) return; // Page limit
  });

  // EAS Attestation
  if (data.easAttestation) {
    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('EAS Attestation Proof', 20, yPos);

    yPos += 8;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`UID: ${data.easAttestation}`, 20, yPos);
    doc.text('Verifiable on-chain at https://arbitrum-sepolia.easscan.org', 20, yPos + 5);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('This report is generated from on-chain data and EAS attestations.', 20, 285);
  doc.text('Verify authenticity at https://eon-protocol.vercel.app', 20, 290);

  return doc.output('blob');
}

export function downloadCreditReport(data: CreditReportData) {
  generateCreditReport(data).then(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `eon-credit-report-${data.address.slice(0, 8)}-${Date.now()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  });
}
