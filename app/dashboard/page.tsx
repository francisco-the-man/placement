'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'
import type { Party, UserProfile } from '@/lib/types'
import styles from './page.module.css'

type SortField = 'name' | 'date'
type SortDirection = 'asc' | 'desc'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [tempName, setTempName] = useState('')
  const [showCreateParty, setShowCreateParty] = useState(false)
  const [partyName, setPartyName] = useState('')
  const [partyStartDate, setPartyStartDate] = useState('')
  const [partyEndDate, setPartyEndDate] = useState('')
  const [isCreatingParty, setIsCreatingParty] = useState(false)
  const [hoveredPartyId, setHoveredPartyId] = useState<string | null>(null)
  const [isDeletingParty, setIsDeletingParty] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // Fetch user profile as backup and parties
        await Promise.all([
          fetchUserProfile(user.id),
          fetchParties()
        ])
      }
      
      setLoading(false)
    }

    getUser()
  }, [supabase])

  // Clear hover state when parties change (e.g., after deletion)
  useEffect(() => {
    if (hoveredPartyId && !parties.find(party => party.id === hoveredPartyId)) {
      setHoveredPartyId(null)
    }
  }, [parties, hoveredPartyId])

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
      } else {
        setUserProfile(data)
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const fetchParties = async () => {
    try {
      const { data, error } = await supabase
        .from('parties')
        .select(`
          *,
          party_guests (
            id,
            guests (*)
          ),
          party_items (
            *,
            seating_arrangements (*),
            team_assignments (*)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching parties:', error)
      } else {
        setParties(data || [])
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const updateUserName = async (name: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: name.trim(),
          full_name: name.trim()
        }
      })

      if (error) {
        console.error('Error updating user metadata:', error)
      } else {
        // Refresh user data
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        setShowNamePrompt(false)
        setTempName('')
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'date' ? 'desc' : 'asc')
    }
  }

  const sortedParties = [...parties].sort((a, b) => {
    if (sortField === 'name') {
      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()
      return sortDirection === 'asc' 
        ? aName.localeCompare(bName)
        : bName.localeCompare(aName)
    } else {
      const aDate = new Date(a.created_at)
      const bDate = new Date(b.created_at)
      return sortDirection === 'asc' 
        ? aDate.getTime() - bDate.getTime()
        : bDate.getTime() - aDate.getTime()
    }
  })

  const getDateRange = (party: any) => {
    // Use party description if it contains formatted dates
    if (party.description) {
      // Check if it's already formatted (DD/MM/YY or DD/MM/YY - DD/MM/YY)
      if (party.description.match(/^\d{2}\/\d{2}\/\d{2}( - \d{2}\/\d{2}\/\d{2})?$/)) {
        return party.description
      }
      // Check if it's raw date format (YYYY-MM-DD)
      if (party.description.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const date = new Date(party.description)
        return date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: '2-digit' 
        })
      }
      // Check if it's date range (YYYY-MM-DD - YYYY-MM-DD)
      if (party.description.includes(' - ') && party.description.match(/^\d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}$/)) {
        const [startDate, endDate] = party.description.split(' - ')
        const start = new Date(startDate).toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: '2-digit' 
        })
        const end = new Date(endDate).toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: '2-digit' 
        })
        return `${start} - ${end}`
      }
    }
    
    // Fallback to created date
    const date = new Date(party.created_at)
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    })
  }

  const getGuestCount = (party: any) => {
    return party.party_guests?.length || 0
  }

  const getEventCount = (party: any) => {
    if (!party.party_items) return 0
    
    let count = 0
    
    // Count meals that have seating arrangements
    const meals = party.party_items.filter((item: any) => item.type === 'meal')
    const mealsWithArrangements = meals.filter((meal: any) => {
      return meal.seating_arrangements && meal.seating_arrangements.length > 0
    })
    count += mealsWithArrangements.length
    
    // Count events that have team assignments
    const events = party.party_items.filter((item: any) => item.type === 'event')
    const eventsWithTeams = events.filter((event: any) => {
      return event.team_assignments && event.team_assignments.length > 0
    })
    count += eventsWithTeams.length
    
    return count
  }

  const getUserName = () => {
    // First try to get name from user metadata
    const userMetaName = user?.user_metadata?.display_name || user?.user_metadata?.full_name
    if (userMetaName) {
      return userMetaName.split(' ')[0]
    }
    
    // Fall back to user profile table
    if (userProfile?.name) {
      return userProfile.name.split(' ')[0]
    }
    
    return 'User'
  }

  const hasUserName = () => {
    const userMetaName = user?.user_metadata?.display_name || user?.user_metadata?.full_name
    return !!(userMetaName || userProfile?.name)
  }

  const createParty = async () => {
    if (!partyName.trim() || !partyStartDate) return

    setIsCreatingParty(true)
    try {
      // Format dates for display
      const formatDisplayDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit', 
          year: '2-digit' 
        })
      }

      const dateDescription = partyEndDate 
        ? `${formatDisplayDate(partyStartDate)} - ${formatDisplayDate(partyEndDate)}`
        : formatDisplayDate(partyStartDate)

      const { data, error } = await supabase
        .from('parties')
        .insert([
          {
            name: partyName.trim(),
            description: dateDescription,
            user_id: user?.id,
          }
        ])
        .select()

      if (error) {
        console.error('Error creating party:', error)
      } else {
        // Reset form and close modal
        setPartyName('')
        setPartyStartDate('')
        setPartyEndDate('')
        setShowCreateParty(false)
        // Refresh parties list
        await fetchParties()
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setIsCreatingParty(false)
    }
  }

  const deleteParty = async (partyId: string, partyName: string) => {
    if (!confirm(`Are you sure you want to delete "${partyName}"? This will remove the party, all its meals/events, and seating arrangements, but guests will be preserved for future parties.`)) {
      return
    }

    setIsDeletingParty(true)
    setHoveredPartyId(null) // Clear hover state immediately
    try {
      // Step 1: Get all party items (meals and events) for this party
      const { data: partyItems, error: itemsError } = await supabase
        .from('party_items')
        .select('id')
        .eq('party_id', partyId)

      if (itemsError) {
        console.error('Error fetching party items:', itemsError)
        alert('Failed to delete party')
        return
      }

      const itemIds = partyItems?.map(item => item.id) || []

      // Step 2: Delete seating arrangements for all meals in this party
      if (itemIds.length > 0) {
        const { error: arrangementsError } = await supabase
          .from('seating_arrangements')
          .delete()
          .in('party_item_id', itemIds)

        if (arrangementsError) {
          console.error('Error deleting seating arrangements:', arrangementsError)
          alert('Failed to delete party')
          return
        }

        // Step 3: Delete team assignments for all events in this party
        const { error: teamsError } = await supabase
          .from('team_assignments')
          .delete()
          .in('party_item_id', itemIds)

        if (teamsError) {
          console.error('Error deleting team assignments:', teamsError)
          alert('Failed to delete party')
          return
        }
      }

      // Step 4: Delete all party items (meals and events)
      const { error: itemsDeleteError } = await supabase
        .from('party_items')
        .delete()
        .eq('party_id', partyId)

      if (itemsDeleteError) {
        console.error('Error deleting party items:', itemsDeleteError)
        alert('Failed to delete party')
        return
      }

      // Step 5: Delete party guest relationships (but keep the actual guest records)
      const { error: partyGuestsError } = await supabase
        .from('party_guests')
        .delete()
        .eq('party_id', partyId)

      if (partyGuestsError) {
        console.error('Error deleting party guests:', partyGuestsError)
        alert('Failed to delete party')
        return
      }

      // Step 6: Finally delete the party itself
      const { error: partyError } = await supabase
        .from('parties')
        .delete()
        .eq('id', partyId)
        .eq('user_id', user?.id) // Extra security check

      if (partyError) {
        console.error('Error deleting party:', partyError)
        alert('Failed to delete party')
        return
      }

      // Success! Update the local state
      setParties(prevParties => prevParties.filter(party => party.id !== partyId))
      console.log(`Successfully deleted party: ${partyName}`)
    } catch (err) {
      console.error('Error deleting party:', err)
      alert('An unexpected error occurred while deleting the party')
    } finally {
      setIsDeletingParty(false)
      setHoveredPartyId(null) // Ensure hover state is cleared
    }
  }

  if (loading) {
    return (
      <main className={styles.dashboard}>
        <div className={styles.container}>
          <p>Loading...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <main className={styles.dashboard}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
          <div className={styles.userSection}>
            <span className={styles.username}>{getUserName()}</span>
            {!hasUserName() && (
              <button 
                onClick={() => setShowNamePrompt(true)}
                className={styles.editNameButton}
                title="Add your name"
              >
                ✏️
              </button>
            )}
            <Image 
              src="/assets/user.svg" 
              alt="User" 
              width={24} 
              height={24}
              className={styles.userIcon}
            />
            <button onClick={handleSignOut} className={styles.signOutButton}>
              Sign Out
            </button>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.partiesSection}>
            <div className={styles.partiesHeader}>
              <h2 className={styles.partiesTitle}>
                {getUserName()}'s parties
              </h2>
              <button 
                onClick={() => setShowCreateParty(true)}
                className={styles.createButton}
              >
                <span>create new</span>
                <Image 
                  src="/assets/square-plus.svg" 
                  alt="Create new" 
                  width={20} 
                  height={20}
                />
              </button>
            </div>

            <div className={styles.partiesContainer}>
              {/* Header Row */}
              <div className={styles.partiesHeader}>
                <div 
                  className={`${styles.headerCell} ${styles.nameHeader} ${styles.sortable}`}
                  onClick={() => handleSort('name')}
                >
                  Name
                  {sortField === 'name' && (
                    <Image 
                      src={`/assets/arrow-${sortDirection === 'desc' ? 'down' : 'up'}.svg`}
                      alt="Sort" 
                      width={16} 
                      height={16}
                      className={styles.sortArrow}
                    />
                  )}
                </div>
                <div 
                  className={`${styles.headerCell} ${styles.dateHeader} ${styles.sortable}`}
                  onClick={() => handleSort('date')}
                >
                  Date
                  {sortField === 'date' && (
                    <Image 
                      src={`/assets/arrow-${sortDirection === 'desc' ? 'down' : 'up'}.svg`}
                      alt="Sort" 
                      width={16} 
                      height={16}
                      className={styles.sortArrow}
                    />
                  )}
                </div>
                <div className={`${styles.headerCell} ${styles.guestsHeader}`}># of guests</div>
                <div className={`${styles.headerCell} ${styles.eventsHeader}`}># of events</div>
              </div>

              {/* Data Rows */}
              <div className={styles.partiesData}>
                {!parties || sortedParties.length === 0 ? (
                  <div className={styles.emptyState}>
                    No parties yet. Create your first party to get started!
                  </div>
                ) : (
                  sortedParties.map((party) => (
                    <div 
                      key={party.id} 
                      className={styles.partyRow}
                      onMouseEnter={() => setHoveredPartyId(party.id)}
                      onMouseLeave={() => setHoveredPartyId(null)}
                    >
                      <div className={`${styles.dataCell} ${styles.nameCell}`}>
                        <Link href={`/dashboard/party/${party.id}`} className={styles.partyLink}>
                          {party.name}
                        </Link>
                        {hoveredPartyId === party.id && !isDeletingParty && (
                          <button 
                            className={styles.deletePartyButton}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              deleteParty(party.id, party.name)
                            }}
                            disabled={isDeletingParty}
                            title={`Delete ${party.name}`}
                          >
                            <Image src="/assets/delete.svg" alt="Delete" width={16} height={16} />
                          </button>
                        )}
                      </div>
                      <div className={`${styles.dataCell} ${styles.dateCell}`}>
                        {getDateRange(party)}
                      </div>
                      <div className={`${styles.dataCell} ${styles.guestsCell}`}>
                        {getGuestCount(party)}
                      </div>
                      <div className={`${styles.dataCell} ${styles.eventsCell}`}>
                        {getEventCount(party)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {showNamePrompt && (
          <div 
            className={styles.modal}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowNamePrompt(false)
                setTempName('')
              }
            }}
          >
            <div className={styles.modalContent}>
              <h3>Add Your Name</h3>
              <p>Please enter your name to personalize your dashboard:</p>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tempName.trim()) {
                    updateUserName(tempName)
                  } else if (e.key === 'Escape') {
                    setShowNamePrompt(false)
                  }
                }}
                placeholder="Your full name"
                className={styles.nameInput}
                autoFocus
              />
              <div className={styles.modalButtons}>
                <button 
                  onClick={() => setShowNamePrompt(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => updateUserName(tempName)}
                  className={styles.saveButton}
                  disabled={!tempName.trim()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showCreateParty && (
          <div 
            className={styles.modal}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateParty(false)
                setPartyName('')
                setPartyStartDate('')
                setPartyEndDate('')
              }
            }}
          >
            <div className={styles.createPartyModal}>
              <h2 className={styles.createPartyTitle}>New party</h2>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Name:</label>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && partyName.trim() && partyStartDate) {
                        createParty()
                      } else if (e.key === 'Escape') {
                        setShowCreateParty(false)
                        setPartyName('')
                        setPartyStartDate('')
                        setPartyEndDate('')
                      }
                    }}
                    placeholder="Party name"
                    className={styles.partyNameInput}
                    autoFocus
                    disabled={isCreatingParty}
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

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Date(s):</label>
                <div className={styles.dateInputs}>
                  <div className={styles.dateInputGroup}>
                    <label className={styles.dateLabel}>Start:</label>
                    <input
                      type="date"
                      value={partyStartDate}
                      onChange={(e) => setPartyStartDate(e.target.value)}
                      className={styles.dateInput}
                      disabled={isCreatingParty}
                    />
                  </div>
                  <div className={styles.dateInputGroup}>
                    <label className={styles.dateLabel}>End (optional):</label>
                    <input
                      type="date"
                      value={partyEndDate}
                      onChange={(e) => setPartyEndDate(e.target.value)}
                      className={styles.dateInput}
                      min={partyStartDate}
                      disabled={isCreatingParty}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.createPartyButtons}>
                <button 
                  onClick={() => {
                    setShowCreateParty(false)
                    setPartyName('')
                    setPartyStartDate('')
                    setPartyEndDate('')
                  }}
                  className={styles.backButton}
                  disabled={isCreatingParty}
                >
                  <Image 
                    src="/assets/arrow-square-left.svg" 
                    alt="Back" 
                    width={20} 
                    height={20}
                  />
                  <span>back</span>
                </button>
                <button 
                  onClick={createParty}
                  className={styles.savePartyButton}
                  disabled={!partyName.trim() || !partyStartDate || isCreatingParty}
                >
                  <span>{isCreatingParty ? 'Creating...' : 'save'}</span>
                  <Image 
                    src="/assets/floppy.svg" 
                    alt="Save" 
                    width={20} 
                    height={20}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
} 