import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Subhan Cargo — Custody Tracker',
  description: 'Parcel chain-of-custody tracking for Subhan Cargo storehouse',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-gray-200`}>
        <div className="mx-auto max-w-md min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}
