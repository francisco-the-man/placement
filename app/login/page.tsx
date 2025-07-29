'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase-client'
import styles from './page.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else if (data.user) {
        router.push('/dashboard')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
    <main className={styles.loginPage}>
      <div className={styles.container}>
        <h1 className={styles.title}>Login</h1>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Email:</label>
            <div className={styles.inputWrapper}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                required
                disabled={isLoading}
              />
              <Image
                src="/assets/text-entry-1.svg"
                alt=""
                width={400}
                height={60}
                className={styles.inputBackground}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Password:</label>
            <div className={styles.inputWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.inputPassword}
                required
                disabled={isLoading}
              />
              <Image
                src="/assets/text-entry-2.svg"
                alt=""
                width={400}
                height={60}
                className={styles.inputBackground}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className={styles.eyeButton}
                disabled={isLoading}
              >
                <Image
                  src={`/assets/${showPassword ? 'hide' : 'unhide'}.svg`}
                  alt={showPassword ? 'Hide password' : 'Show password'}
                  width={24}
                  height={24}
                />
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.navigation}>
            <Link href="/" className={styles.navButton}>
              <Image
                src="/assets/arrow-square-left.svg"
                alt="Back"
                width={24}
                height={24}
              />
              <span>back</span>
            </Link>

            <button 
              type="submit" 
              className={styles.navButton}
              disabled={isLoading}
            >
              <span>{isLoading ? 'Loading...' : 'continue'}</span>
              <Image
                src="/assets/arrow-square-right.svg"
                alt="Continue"
                width={24}
                height={24}
              />
            </button>
          </div>
        </form>

        <div className={styles.linkSection}>
          <Link href="/signup">
            Don't have an account? Sign up here
          </Link>
        </div>
      </div>
    </main>
  )
} 