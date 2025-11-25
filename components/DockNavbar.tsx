'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  TrendingUp,
  Coins,
  Settings,
  LogOut,
  Home,
  Wallet,
  Users,
  ArrowUpRight,
  Send
} from 'lucide-react'

interface NavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  isActive?: boolean
}

interface DockNavbarProps {
  onSignOut?: () => void
}

export default function DockNavbar({ onSignOut }: DockNavbarProps) {
  const pathname = usePathname()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const navItems: NavItem[] = [
    {
      href: '/dashboard',
      icon: Home,
      label: 'Home'
    },
    {
      href: '/dashboard/deposit',
      icon: ArrowUpRight,
      label: 'Deposit'
    },
    {
      href: '/dashboard/invest',
      icon: Coins,
      label: 'Stake USDT'
    },
    {
      href: '/dashboard/transfer',
      icon: Send,
      label: 'Transfer'
    },
    {
      href: '/dashboard/referral',
      icon: Users,
      label: 'Referral'
    },
    {
      href: '/dashboard/profile',
      icon: Settings,
      label: 'Profile'
    }
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Backdrop blur for dock effect */}
      <div className="fixed bottom-4 md:bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-4 w-full max-w-fit">
        <div className="relative">
          {/* Dock container */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-2 md:px-4 py-2 md:py-3 shadow-2xl">
            <div className="flex items-center space-x-1 md:space-x-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                const isHovered = hoveredItem === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative group"
                    onMouseEnter={() => setHoveredItem(item.href)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    {/* Tooltip */}
                    <div className={`
                      absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
                      bg-gray-900 text-white text-xs px-2 py-1 rounded-lg
                      transition-all duration-200 pointer-events-none
                      hidden md:block
                      ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
                    `}>
                      {item.label}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
                    </div>

                    {/* Icon container */}
                    <div className={`
                      relative p-2 md:p-3 rounded-xl transition-all duration-300 ease-out
                      ${active
                        ? 'bg-amber-800/30 text-amber-300 scale-110'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                      }
                      ${isHovered ? 'md:scale-125 md:-translate-y-1' : ''}
                      group-hover:shadow-lg
                    `}>
                      <Icon className={`
                        h-6 w-6 md:h-7 md:w-7 transition-all duration-300
                        ${active ? 'drop-shadow-lg' : ''}
                      `} />

                      {/* Active indicator */}
                      {active && (
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-amber-400 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  </Link>
                )
              })}

              {/* Separator */}
              <div className="w-px h-6 md:h-8 bg-white/20 mx-1 md:mx-2"></div>

              {/* Logout button */}
              <button
                onClick={onSignOut}
                className="relative group"
                onMouseEnter={() => setHoveredItem('logout')}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Tooltip */}
                <div className={`
                  absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
                  bg-gray-900 text-white text-xs px-2 py-1 rounded-lg
                  transition-all duration-200 pointer-events-none
                  hidden md:block
                  ${hoveredItem === 'logout' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}
                `}>
                  Logout
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
                </div>

                <div className={`
                  p-2 md:p-3 rounded-xl transition-all duration-300 ease-out
                  text-red-400 hover:text-red-300 hover:bg-red-500/10
                  ${hoveredItem === 'logout' ? 'md:scale-125 md:-translate-y-1' : ''}
                  group-hover:shadow-lg
                `}>
                  <LogOut className="h-5 w-5 md:h-6 md:w-6" />
                </div>
              </button>
            </div>
          </div>

          {/* Dock reflection effect */}
          <div className="absolute top-full left-0 right-0 h-8 bg-gradient-to-b from-white/5 to-transparent rounded-b-2xl transform scale-y-50 opacity-30"></div>
        </div>
      </div>

      {/* Bottom padding to prevent content overlap */}
      <div className="h-24"></div>
    </>
  )
}
