'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase-client'
import styles from './page.module.css'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setMessage('')

    if (!name.trim()) {
      setError('Name is required')
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name.trim(),
            full_name: name.trim()
          }
        }
      })

      if (error) {
        setError(error.message)
      } else if (data.user) {
        // Also create user profile as backup
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([
            {
              user_id: data.user.id,
              name: name.trim(),
            }
          ])

        if (profileError) {
          console.error('Profile creation error:', profileError)
          // Don't show this error to user as the account was created successfully
        }

        if (!data.user.email_confirmed_at) {
          setMessage('Please check your email and click the confirmation link to complete registration.')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className={styles.loginPage}>
      <div className={styles.container}>
        <h1 className={styles.title}>Sign Up</h1>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Name:</label>
            <div className={styles.inputWrapper}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.inputEmail}
                required
                disabled={isLoading}
                placeholder="Your full name"
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
            <label className={styles.label}>Email:</label>
            <div className={styles.inputWrapper}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.inputEmail}
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
                className={styles.input}
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
                onClick={() => setShowPassword(!showPassword)}
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

          <div className={styles.inputGroup}>
            <label className={styles.label}>Confirm Password:</label>
            <div className={styles.inputWrapper}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
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
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={styles.eyeButton}
                disabled={isLoading}
              >
                <Image
                  src={`/assets/${showConfirmPassword ? 'hide' : 'unhide'}.svg`}
                  alt={showConfirmPassword ? 'Hide password' : 'Show password'}
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

          {message && (
            <div className={styles.success}>
              {message}
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
              <span>{isLoading ? 'Creating...' : 'create account'}</span>
              <Image
                src="/assets/arrow-square-right.svg"
                alt="Create account"
                width={24}
                height={24}
              />
            </button>
          </div>
        </form>

        <div className={styles.linkSection}>
          <Link href="/login">
            Already have an account? Login here
          </Link>
        </div>
      </div>
    </main>
  )
} 