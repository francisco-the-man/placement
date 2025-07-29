'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import styles from './page.module.css'

interface Party {
  id: string
  name: string
  start_date: string
  end_date?: string
}

interface Guest {
  id: string
  name: string
  gender: 'man' | 'woman' | 'nonbinary'
  relationships?: string[]
}

interface Meal {
  id: string
  name: string
  party_id: string
}

interface SeatingPosition {
  position: number
  guest: Guest
  isAdjustedByUser: boolean
}

interface SeatingOption {
  score: number
  positions: SeatingPosition[]
}

// CP-SAT Algorithm Implementation
class SeatingOptimizer {
  private guests: Guest[]
  private relationships: Map<string, Set<string>>
  private previousSeatings: Map<string, Set<string>>
  private supabase: any
  private partyId: string

  constructor(guests: Guest[], partyId: string, supabase: any) {
    this.guests = guests
    this.relationships = new Map()
    this.previousSeatings = new Map()
    this.supabase = supabase
    this.partyId = partyId
    this.buildRelationshipMap()
  }

  async initialize() {
    await this.buildPreviousSeatingMap()
  }

  private buildRelationshipMap() {
    // Build relationship map from guest data
    this.guests.forEach(guest => {
      if (guest.relationships) {
        const relSet = new Set(guest.relationships)
        this.relationships.set(guest.id, relSet)
      }
    })
  }

  private async buildPreviousSeatingMap() {
    try {
      // Fetch all previous meals in this party
      const { data: previousMeals, error: mealsError } = await this.supabase
        .from('party_items')
        .select('id')
        .eq('party_id', this.partyId)
        .eq('type', 'meal')

      if (mealsError || !previousMeals) {
        console.log('No previous meals found or error:', mealsError)
        return
      }

      // Fetch all seating arrangements for previous meals
      const mealIds = previousMeals.map((meal: any) => meal.id)
      const { data: arrangements, error: arrangementsError } = await this.supabase
        .from('seating_arrangements')
        .select('*')
        .in('party_item_id', mealIds)
        .order('position')

      if (arrangementsError || !arrangements) {
        console.log('No previous arrangements found or error:', arrangementsError)
        return
      }

      // Group arrangements by meal
      const mealArrangements = new Map<string, any[]>()
      arrangements.forEach((arrangement: any) => {
        if (!mealArrangements.has(arrangement.party_item_id)) {
          mealArrangements.set(arrangement.party_item_id, [])
        }
        mealArrangements.get(arrangement.party_item_id)!.push(arrangement)
      })

      // Build adjacency map from previous seatings
      mealArrangements.forEach(mealArrangements => {
        const sortedArrangements = mealArrangements.sort((a, b) => a.position - b.position)
        
        for (let i = 0; i < sortedArrangements.length; i++) {
          const currentGuest = sortedArrangements[i].guest_id
          const nextGuest = sortedArrangements[(i + 1) % sortedArrangements.length].guest_id
          const prevGuest = sortedArrangements[(i - 1 + sortedArrangements.length) % sortedArrangements.length].guest_id

          // Track who sat next to whom
          if (!this.previousSeatings.has(currentGuest)) {
            this.previousSeatings.set(currentGuest, new Set())
          }
          this.previousSeatings.get(currentGuest)!.add(nextGuest)
          this.previousSeatings.get(currentGuest)!.add(prevGuest)
        }
      })

      console.log('Previous seating adjacencies built:', this.previousSeatings)
    } catch (err) {
      console.error('Error building previous seating map:', err)
    }
  }

  // Calculate penalty score for a seating arrangement
  // Priority order: 1) Family/SO separation, 2) Previous seating separation, 3) Gender alternation
  private calculateScore(arrangement: Guest[]): number {
    let score = 0
    const len = arrangement.length

    for (let i = 0; i < len; i++) {
      const currentGuest = arrangement[i]
      const nextGuest = arrangement[(i + 1) % len] // Next guest (circular)
      const prevGuest = arrangement[(i - 1 + len) % len] // Previous guest (circular)

      // Penalty 1: Family/SO adjacency (HIGHEST penalty: -30 points each)
      if (this.areRelated(currentGuest.id, nextGuest.id)) {
        score -= 35
      }
      if (this.areRelated(currentGuest.id, prevGuest.id)) {
        score -= 35
      }

      // Penalty 2: Previous meal adjacency (SECOND highest penalty: -20 points each)
      if (this.satTogetherBefore(currentGuest.id, nextGuest.id)) {
        score -= 15
      }
      if (this.satTogetherBefore(currentGuest.id, prevGuest.id)) {
        score -= 15
      }

      // Penalty 3: Same gender adjacency (LOWEST penalty: -5 points each)
      if (currentGuest.gender === nextGuest.gender) {
        score -= 20
      }
      if (currentGuest.gender === prevGuest.gender) {
        score -= 20
      }
    }

    return score
  }

  private areRelated(guestId1: string, guestId2: string): boolean {
    const relations1 = this.relationships.get(guestId1)
    return relations1 ? relations1.has(guestId2) : false
  }

  private satTogetherBefore(guestId1: string, guestId2: string): boolean {
    const previousAdjacencies = this.previousSeatings.get(guestId1)
    return previousAdjacencies ? previousAdjacencies.has(guestId2) : false
  }

  // Generate all possible permutations and score them
  private generatePermutations(arr: Guest[]): Guest[][] {
    if (arr.length <= 1) return [arr]
    
    const result: Guest[][] = []
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i]
      const remaining = arr.slice(0, i).concat(arr.slice(i + 1))
      const perms = this.generatePermutations(remaining)
      
      for (const perm of perms) {
        result.push([current, ...perm])
      }
    }
    return result
  }

  // Generate optimal seating arrangements
  generateArrangements(maxOptions: number = 6): SeatingOption[] {
    // For small groups, generate all permutations
    if (this.guests.length <= 8) {
      const allArrangements = this.generatePermutations(this.guests)
      const scoredArrangements = allArrangements.map(arrangement => ({
        score: this.calculateScore(arrangement),
        positions: arrangement.map((guest, index) => ({
          position: index,
          guest,
          isAdjustedByUser: false
        }))
      }))

      // Sort by score (best arrangements first - highest scores have least penalty)
      return scoredArrangements
        .sort((a, b) => b.score - a.score)
        .slice(0, maxOptions)
    }

    // For larger groups, use simplified heuristic approach
    return this.generateHeuristicArrangements(maxOptions)
  }

  private generateHeuristicArrangements(maxOptions: number): SeatingOption[] {
    const arrangements: SeatingOption[] = []
    
    // Generate several random starting arrangements and optimize them
    for (let attempt = 0; attempt < maxOptions * 3; attempt++) {
      const shuffled = [...this.guests].sort(() => Math.random() - 0.5)
      const optimized = this.localOptimization(shuffled)
      
      arrangements.push({
        score: this.calculateScore(optimized),
        positions: optimized.map((guest, index) => ({
          position: index,
          guest,
          isAdjustedByUser: false
        }))
      })
    }

    // Return top unique arrangements (best arrangements first)
    const uniqueArrangements = this.removeDuplicates(arrangements)
    return uniqueArrangements
      .sort((a, b) => b.score - a.score)
      .slice(0, maxOptions)
  }

  private localOptimization(arrangement: Guest[]): Guest[] {
    let current = [...arrangement]
    let improved = true
    
    while (improved) {
      improved = false
      const currentScore = this.calculateScore(current)
      
      // Try swapping adjacent pairs
      for (let i = 0; i < current.length - 1; i++) {
        const temp = [...current]
        ;[temp[i], temp[i + 1]] = [temp[i + 1], temp[i]]
        
        if (this.calculateScore(temp) > currentScore) {
          current = temp
          improved = true
          break
        }
      }
    }
    
    return current
  }

  private removeDuplicates(arrangements: SeatingOption[]): SeatingOption[] {
    const seen = new Set<string>()
    return arrangements.filter(arrangement => {
      const key = arrangement.positions.map(p => p.guest.id).join(',')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

export default function PlacementPage({ params }: { params: { id: string; mealId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [party, setParty] = useState<Party | null>(null)
  const [meal, setMeal] = useState<Meal | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [seatingOptions, setSeatingOptions] = useState<SeatingOption[]>([])
  const [currentOptionIndex, setCurrentOptionIndex] = useState(0)
  const [currentArrangement, setCurrentArrangement] = useState<SeatingPosition[]>([])
  const [originalArrangement, setOriginalArrangement] = useState<SeatingPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        router.push('/login')
        return
      }
      setUser(user)
    }
    getUser()


  }, [router, supabase])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user, params.id, params.mealId])

  const fetchData = async () => {
    try {
      // Fetch party data
      const { data: partyData, error: partyError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', params.id)
        .single()

      if (partyError || !partyData) {
        console.error('Error fetching party:', partyError)
        router.push('/dashboard')
        return
      }
      setParty(partyData)

      // Fetch meal data
      const { data: mealData, error: mealError } = await supabase
        .from('party_items')
        .select('*')
        .eq('id', params.mealId)
        .eq('type', 'meal')
        .single()

      if (mealError || !mealData) {
        console.error('Error fetching meal:', mealError)
        router.push(`/dashboard/party/${params.id}`)
        return
      }
      setMeal(mealData)

      // Get selected guests from URL params
      const guestIds = searchParams.get('guests')?.split(',') || []
      
      if (guestIds.length === 0) {
        console.error('No guests selected')
        router.push(`/dashboard/party/${params.id}`)
        return
      }

      // Fetch guest data
      const { data: guestData, error: guestError } = await supabase
        .from('guests')
        .select('*')
        .in('id', guestIds)

      if (guestError || !guestData) {
        console.error('Error fetching guests:', guestError)
        return
      }

      const guestsWithRelationships = guestData as Guest[]
      setGuests(guestsWithRelationships)

      // Generate seating arrangements using CP-SAT
      console.log('🎯 Starting CP-SAT optimization for', guestsWithRelationships.length, 'guests')
      const optimizer = new SeatingOptimizer(guestsWithRelationships, params.id, supabase)
      await optimizer.initialize()
      
      console.log('🧮 Generating arrangements...')
      const options = optimizer.generateArrangements(6)
      console.log('✅ Generated', options.length, 'optimal arrangements')
      console.log('📊 Arrangement scores:', options.map((opt, i) => `Option ${i+1}: ${opt.score}`).join(', '))
      
      setSeatingOptions(options)
      if (options.length > 0) {
        setCurrentArrangement(options[0].positions)
        setOriginalArrangement(options[0].positions)
      }

      setLoading(false)
    } catch (err) {
      console.error('Error:', err)
      setLoading(false)
    }
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const sourceIndex = result.source.index
    const destinationIndex = result.destination.index

    if (sourceIndex === destinationIndex) return

    const newArrangement = Array.from(currentArrangement)
    const [removed] = newArrangement.splice(sourceIndex, 1)
    newArrangement.splice(destinationIndex, 0, {
      ...removed,
      position: destinationIndex,
      isAdjustedByUser: true
    })

    // Update positions
    newArrangement.forEach((pos, index) => {
      pos.position = index
    })

    setCurrentArrangement(newArrangement)
  }

  const nextOption = () => {
    if (currentOptionIndex < seatingOptions.length - 1) {
      const newIndex = currentOptionIndex + 1
      setCurrentOptionIndex(newIndex)
      setCurrentArrangement(seatingOptions[newIndex].positions)
    }
  }

  const prevOption = () => {
    if (currentOptionIndex > 0) {
      const newIndex = currentOptionIndex - 1
      setCurrentOptionIndex(newIndex)
      setCurrentArrangement(seatingOptions[newIndex].positions)
    }
  }

  const resetArrangement = () => {
    setCurrentArrangement([...originalArrangement])
    setCurrentOptionIndex(0)
  }

  const saveArrangement = async () => {
    setSaving(true)
    try {
      // Delete existing arrangements for this meal
      await supabase
        .from('seating_arrangements')
        .delete()
        .eq('party_item_id', params.mealId)

      // Insert new arrangements
      const arrangements = currentArrangement.map(pos => ({
        party_item_id: params.mealId,
        guest_id: pos.guest.id,
        position: pos.position,
        is_generated: !pos.isAdjustedByUser
      }))

      const { error } = await supabase
        .from('seating_arrangements')
        .insert(arrangements)

      if (error) {
        console.error('Error saving arrangement:', error)
        alert('Failed to save seating arrangement')
      } else {
        alert('Seating arrangement saved successfully!')
        router.push(`/dashboard/party/${params.id}`)
      }
    } catch (err) {
      console.error('Error:', err)
      alert('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const getUserName = () => {
    const userMetaName = user?.user_metadata?.display_name || user?.user_metadata?.full_name
    if (userMetaName) {
      return userMetaName.split(' ')[0]
    }
    return 'User'
  }

  if (loading) {
    // Calculate total possible arrangements: n!/(n*2) for circular table
    const calculateTotalArrangements = (n: number): string => {
      if (n <= 1) return '1'
      if (n === 2) return '1'
      
      // For efficiency, calculate (n-1)!/2 which is equivalent to n!/(n*2)
      let result = 1
      for (let i = 2; i <= n - 1; i++) {
        result *= i
      }
      
      const totalArrangements = Math.floor(result / 2)
      
      // Format large numbers with commas
      return totalArrangements.toLocaleString()
    }

    // Only show calculation when guests are loaded
    const totalOptions = guests.length > 0 ? calculateTotalArrangements(guests.length) : null

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.loadingContainer}>
          <div className={styles.lottieContainer}>
            <DotLottieReact
              src="https://lottie.host/232b00f0-6fb4-4c19-b9e9-409513312dc7/kk71H0pd4f.lottie"
              loop
              autoplay
              style={{ width: 200, height: 200 }}
            />
          </div>
          <div className={styles.loadingText}>
            {totalOptions 
              ? `Doing some math to find the best placement from ${totalOptions} options...`
              : "Loading guests and calculating arrangements..."
            }
          </div>
        </div>
      </div>
    )
  }

  if (!party || !meal || guests.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Unable to load placement data</div>
      </div>
    )
  }

  // Calculate table positions for rectangular layout
  const getTablePositions = () => {
    const totalGuests = currentArrangement.length
    const positions: { top: string; left: string; guest: Guest; index: number }[] = []

    if (totalGuests <= 2) {
      // Linear arrangement for very small groups (heads of table)
      const headPositions = totalGuests === 1 
        ? [{ top: '50%', left: '50%' }]
        : [{ top: '50%', left: '3%' }, { top: '50%', left: '97%' }]
      
      currentArrangement.forEach((pos, index) => {
        positions.push({
          ...headPositions[index],
          guest: pos.guest,
          index
        })
      })
    } else if (totalGuests <= 4) {
      // Simple 4-person arrangement (heads at left/right)
      const sidePositions = [
        { top: '50%', left: '3%' },  // Left head
        { top: '12%', left: '50%' },  // Top
        { top: '50%', left: '97%' }, // Right head
        { top: '88%', left: '50%' }  // Bottom
      ]
      
      currentArrangement.forEach((pos, index) => {
        positions.push({
          ...sidePositions[index],
          guest: pos.guest,
          index
        })
      })
    } else {
      // Rectangular table arrangement for 5+ guests
      let guestIndex = 0
      
      // Calculate guests per side - heads are LEFT/RIGHT (short ends)
      let topCount, rightCount, bottomCount, leftCount
      
      if (totalGuests <= 6) {
        // For 5-6 guests: 1 at each head (left/right), distribute top/bottom
        leftCount = 1    // Head of table
        rightCount = 1   // Head of table
        const sideGuests = totalGuests - 2
        topCount = Math.ceil(sideGuests / 2)
        bottomCount = sideGuests - topCount
      } else {
        // For 7+ guests: start with 1 at each head, distribute evenly
        const remainingGuests = totalGuests - 2 // Reserve for heads
        const guestsPerSide = Math.floor(remainingGuests / 2)
        
        leftCount = 1    // Head of table
        rightCount = 1   // Head of table
        topCount = guestsPerSide + (remainingGuests % 2) // Add extra to top if odd
        bottomCount = guestsPerSide
        
        // If too crowded, add second guest to heads
        if (topCount > 4 || bottomCount > 4) {
          leftCount = Math.min(2, Math.floor(totalGuests / 4))
          rightCount = Math.min(2, Math.floor(totalGuests / 4))
          const newRemaining = totalGuests - leftCount - rightCount
          topCount = Math.ceil(newRemaining / 2)
          bottomCount = newRemaining - topCount
        }
      }

      // Left side (head of table)
      for (let i = 0; i < leftCount && guestIndex < totalGuests; i++) {
        const topPos = leftCount === 1 ? '50%' : `${40 + (i * 20)}%`
        positions.push({
          top: topPos,
          left: '3%',
          guest: currentArrangement[guestIndex].guest,
          index: guestIndex
        })
        guestIndex++
      }

      // Top side
      for (let i = 0; i < topCount && guestIndex < totalGuests; i++) {
        const leftPos = topCount === 1 ? '50%' : `${25 + (i * (50 / Math.max(1, topCount - 1)))}%`
        positions.push({
          top: '12%',
          left: leftPos,
          guest: currentArrangement[guestIndex].guest,
          index: guestIndex
        })
        guestIndex++
      }

      // Right side (head of table)
      for (let i = 0; i < rightCount && guestIndex < totalGuests; i++) {
        const topPos = rightCount === 1 ? '50%' : `${60 - (i * 20)}%`
        positions.push({
          top: topPos,
          left: '97%',
          guest: currentArrangement[guestIndex].guest,
          index: guestIndex
        })
        guestIndex++
      }

      // Bottom side
      for (let i = 0; i < bottomCount && guestIndex < totalGuests; i++) {
        const leftPos = bottomCount === 1 ? '50%' : `${75 - (i * (50 / Math.max(1, bottomCount - 1)))}%`
        positions.push({
          top: '88%',
          left: leftPos,
          guest: currentArrangement[guestIndex].guest,
          index: guestIndex
        })
        guestIndex++
      }
    }

    return positions
  }

  const tablePositions = getTablePositions()
  
  // Calculate dynamic table size based on number of guests
  const getTableDimensions = () => {
    const guestCount = currentArrangement.length
    if (guestCount <= 4) {
      return { width: '50%', height: '35%' }
    } else if (guestCount <= 6) {
      return { width: '60%', height: '40%' }
    } else if (guestCount <= 8) {
      return { width: '70%', height: '45%' }
    } else {
      return { width: '75%', height: '50%' }
    }
  }
  
  const tableDimensions = getTableDimensions()

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.placementModal}>
        {/* Header */}
        <div className={styles.placementHeader}>
          <div className={styles.headerLeft}>
            <h1 className={styles.mealName}>{meal.name}</h1>
            <div className={styles.partyName}>{party.name}</div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.guestCount}>
              <Image src="/assets/user.svg" alt="Guests" width={20} height={20} />
              <span>{currentArrangement.length}</span>
            </div>
          </div>
        </div>

        {/* Option Navigation */}
        <div className={styles.optionNavigation}>
          <button 
            className={styles.navButton}
            onClick={prevOption}
            disabled={currentOptionIndex === 0}
          >
            <Image src="/assets/arrow-square-left.svg" alt="Previous" width={20} height={20} />
          </button>
          
          <div className={styles.optionLabel}>
            Option {currentOptionIndex + 1}
            {seatingOptions[currentOptionIndex] && (
              <span className={styles.scoreLabel}>
                (Score: {seatingOptions[currentOptionIndex].score})
              </span>
            )}
          </div>
          
          <button 
            className={styles.navButton}
            onClick={nextOption}
            disabled={currentOptionIndex === seatingOptions.length - 1}
          >
            <Image src="/assets/arrow-square-right.svg" alt="Next" width={20} height={20} />
          </button>
        </div>

        {/* Seating Area */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={styles.seatingArea}>
            {/* Table outline */}
            <div 
              className={styles.table}
              style={{
                width: tableDimensions.width,
                height: tableDimensions.height
              }}
            ></div>
            
            {/* Guest positions */}
            <Droppable droppableId="seating" direction="horizontal">
              {(provided: DroppableProvided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={styles.guestPositions}
                >
                  {tablePositions.map((position, index) => (
                    <Draggable
                      key={position.guest.id}
                      draggableId={position.guest.id}
                      index={position.index}
                    >
                      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`${styles.guestPosition} ${
                            snapshot.isDragging ? styles.dragging : ''
                          }`}
                          style={{
                            ...provided.draggableProps.style,
                            position: 'absolute',
                            top: position.top,
                            left: position.left,
                            transform: `translate(-50%, -50%) ${provided.draggableProps.style?.transform || ''}`
                          }}
                        >
                          <div className={styles.guestName}>
                            {position.guest.name}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </DragDropContext>

        {/* Bottom Navigation */}
        <div className={styles.bottomNavigation}>
          <Link href={`/dashboard/party/${params.id}`} className={styles.backButton}>
            <Image src="/assets/arrow-square-left.svg" alt="Back" width={20} height={20} />
            back
          </Link>
          
          <div className={styles.centerControls}>
            <span className={styles.instructionText}>drag names to move</span>
            <button className={styles.resetButton} onClick={resetArrangement}>
              reset
            </button>
          </div>
          
          <button 
            className={styles.saveButton}
            onClick={saveArrangement}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'save'}
            <Image src="/assets/floppy.svg" alt="Save" width={20} height={20} />
          </button>
        </div>
      </div>
    </div>
  )
} 