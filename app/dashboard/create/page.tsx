'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import styles from '../page.module.css'

export default function CreateParty() {
  return (
    <main className={styles.dashboard}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Create New Party</h1>
          <Link href="/dashboard" className={styles.createButton}>
            <Image 
              src="/assets/arrow-square-left.svg" 
              alt="Back" 
              width={20} 
              height={20}
            />
            <span>back to dashboard</span>
          </Link>
        </header>

        <div className={styles.content}>
          <div className={styles.partiesSection}>
            <div style={{ 
              background: 'white', 
              padding: '3rem', 
              borderRadius: '8px', 
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ 
                fontFamily: 'Playwrite US Modern, cursive', 
                fontSize: '2rem', 
                marginBottom: '1.5rem',
                color: 'black'
              }}>
                Party Creation Coming Soon!
              </h2>
              <p style={{ 
                fontFamily: 'PT Serif, serif', 
                fontSize: '1.1rem', 
                color: 'black',
                lineHeight: '1.6',
                marginBottom: '2rem'
              }}>
                This is where you'll be able to create new dinner parties, add guests, 
                and set up meals and events for optimal seating arrangements.
              </p>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '1rem',
                marginTop: '2rem'
              }}>
                <div style={{ 
                  fontFamily: 'PT Serif, serif',
                  background: '#f8f9fa',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  color: 'black'
                }}>
                  🎉 Set party details
                </div>
                <div style={{ 
                  fontFamily: 'PT Serif, serif',
                  background: '#f8f9fa',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  color: 'black'
                }}>
                  👥 Add guests & relationships
                </div>
                <div style={{ 
                  fontFamily: 'PT Serif, serif',
                  background: '#f8f9fa',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  color: 'black'
                }}>
                  🍽️ Create meals & events
                </div>
                <div style={{ 
                  fontFamily: 'PT Serif, serif',
                  background: '#f8f9fa',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  color: 'black'
                }}>
                  🎯 Generate arrangements
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 