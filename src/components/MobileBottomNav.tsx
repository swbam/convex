import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface TabItem {
  to: string
  label: string
}

const items: TabItem[] = [
  { to: '/', label: 'Home' },
  { to: '/artists', label: 'Artists' },
  { to: '/shows', label: 'Shows' },
  { to: '/trending', label: 'Trending' },
  { to: '/profile', label: 'Profile' },
]

export function MobileBottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-background/80 backdrop-blur border-t border-border sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {items.map((i) => {
          const isActive = pathname === i.to
          return (
            <li key={i.to}>
              <button
                onClick={() => navigate(i.to)}
                className={[
                  'flex h-16 w-full items-center justify-center text-xs',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {i.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}


