import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrumSepolia, arbitrum } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Eon Protocol',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [arbitrumSepolia, arbitrum],
  ssr: true,
});
