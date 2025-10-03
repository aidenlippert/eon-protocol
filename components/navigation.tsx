'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { cn } from '@/lib/utils';

export function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/borrow', label: 'Borrow' },
    { href: '/profile', label: 'Profile' },
    { href: '/analytics', label: 'Analytics' },
  ];

  return (
    <nav className="border-b border-neutral-800 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">
              Eon Protocol
            </Link>

            <div className="hidden md:flex gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "bg-violet-500/10 text-violet-400"
                      : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
