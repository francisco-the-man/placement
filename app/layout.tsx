import type { Metadata } from 'next'
import React from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Placement - Dinner Party Seating App',
  description: 'A dinner party seating app by Avery Louis with etiquette intuitions from Elizabeth Louis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
} 