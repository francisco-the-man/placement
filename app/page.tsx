import React from 'react'
import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.landingPage}>
      <div className={styles.container}>
        <h1 className={styles.title}>Placement</h1>
        
        <div className={styles.subtitleSection}>
          <p className={styles.subtitle}>A dinner party seating app by Avery Louis</p>
          <p className={styles.subtitle}>With etiquette intuitions from Elizabeth Louis</p>
        </div>
        
        <p className={styles.tagline}>
          ...And powered by pseudo-boolean optimisation using lazy clause generation
        </p>
        
        <div className={styles.authButtons}>
          <Link href="/signup" className={styles.authButton}>sign up</Link>
          <Link href="/login" className={styles.authButton}>login</Link>
        </div>
      </div>
    </main>
  )
} 