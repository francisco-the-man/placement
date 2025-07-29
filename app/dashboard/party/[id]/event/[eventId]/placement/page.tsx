'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { uniqueNamesGenerator, Config, adjectives, animals } from 'unique-names-generator'
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

interface Event {
  id: string
  name: string
  party_id: string
  description: string
}

interface EventConfig {
  teams: number
  minTeamSize: number
  maxTeamSize: number
  fairPlay: boolean
  guestRankings?: string[]
}

interface TeamMember {
  guest: Guest
  originalRank?: number
}

interface Team {
  id: string
  name: string
  members: TeamMember[]
}

interface TeamOption {
  score: number
  teams: Team[]
}

// CP-SAT Algorithm Implementation for Team Optimization
class TeamOptimizer {
  private guests: Guest[]
  private relationships: Map<string, Set<string>>
  private previousGroupings: Map<string, Set<string>>
  private guestRankings: Map<string, number>
  private supabase: any
  private partyId: string
  private numberOfTeams: number
  private minTeamSize: number
  private maxTeamSize: number
  private fairPlay: boolean

  constructor(
    guests: Guest[], 
    partyId: string, 
    supabase: any, 
    config: EventConfig,
    rankings: string[] = []
  ) {
    this.guests = guests
    this.relationships = new Map()
    this.previousGroupings = new Map()
    this.guestRankings = new Map()
    this.supabase = supabase
    this.partyId = partyId
    this.numberOfTeams = config.teams
    this.minTeamSize = config.minTeamSize
    this.maxTeamSize = config.maxTeamSize
    this.fairPlay = config.fairPlay
    
    this.buildRelationshipMap()
    if (this.fairPlay && rankings.length > 0) {
      this.buildRankingsMap(rankings)
    }
  }

  async initialize() {
    await this.buildPreviousGroupingsMap()
  }

  private buildRelationshipMap() {
    this.guests.forEach(guest => {
      if (guest.relationships) {
        const relSet = new Set(guest.relationships)
        this.relationships.set(guest.id, relSet)
      }
    })
  }

  private buildRankingsMap(rankings: string[]) {
    rankings.forEach((guestId, index) => {
      this.guestRankings.set(guestId, index + 1) // Rank 1 is best
    })
  }

  private async buildPreviousGroupingsMap() {
    try {
      // Fetch all previous events and meals in this party
      const { data: previousItems, error: itemsError } = await this.supabase
        .from('party_items')
        .select('id, type')
        .eq('party_id', this.partyId)

      if (itemsError || !previousItems) {
        console.log('No previous items found or error:', itemsError)
        return
      }

      // For meals, get seating arrangements (adjacencies)
      const mealIds = previousItems.filter((item: any) => item.type === 'meal').map((item: any) => item.id)
      if (mealIds.length > 0) {
        const { data: arrangements, error: arrangementsError } = await this.supabase
          .from('seating_arrangements')
          .select('*')
          .in('party_item_id', mealIds)
          .order('position')

        if (!arrangementsError && arrangements) {
          // Group by meal and build adjacency map
          const mealArrangements = new Map<string, any[]>()
          arrangements.forEach((arrangement: any) => {
            if (!mealArrangements.has(arrangement.party_item_id)) {
              mealArrangements.set(arrangement.party_item_id, [])
            }
            mealArrangements.get(arrangement.party_item_id)!.push(arrangement)
          })

          mealArrangements.forEach(mealArrangements => {
            const sortedArrangements = mealArrangements.sort((a, b) => a.position - b.position)
            
            for (let i = 0; i < sortedArrangements.length; i++) {
              const currentGuest = sortedArrangements[i].guest_id
              const nextGuest = sortedArrangements[(i + 1) % sortedArrangements.length].guest_id
              const prevGuest = sortedArrangements[(i - 1 + sortedArrangements.length) % sortedArrangements.length].guest_id

              if (!this.previousGroupings.has(currentGuest)) {
                this.previousGroupings.set(currentGuest, new Set())
              }
              this.previousGroupings.get(currentGuest)!.add(nextGuest)
              this.previousGroupings.get(currentGuest)!.add(prevGuest)
            }
          })
        }
      }

      // For events, get team assignments (team members)
      const eventIds = previousItems.filter((item: any) => item.type === 'event').map((item: any) => item.id)
      if (eventIds.length > 0) {
        const { data: teamAssignments, error: teamsError } = await this.supabase
          .from('team_assignments')
          .select('*')
          .in('party_item_id', eventIds)

        if (!teamsError && teamAssignments) {
          // Group by event and team, then add team member relationships
          const eventTeams = new Map<string, Map<number, string[]>>()
          teamAssignments.forEach((assignment: any) => {
            if (!eventTeams.has(assignment.party_item_id)) {
              eventTeams.set(assignment.party_item_id, new Map())
            }
            const eventMap = eventTeams.get(assignment.party_item_id)!
            if (!eventMap.has(assignment.team_number)) {
              eventMap.set(assignment.team_number, [])
            }
            eventMap.get(assignment.team_number)!.push(assignment.guest_id)
          })

          // For each team, every member was grouped with every other member
          eventTeams.forEach(eventMap => {
            eventMap.forEach(teamMembers => {
              for (const guestId of teamMembers) {
                if (!this.previousGroupings.has(guestId)) {
                  this.previousGroupings.set(guestId, new Set())
                }
                for (const otherGuestId of teamMembers) {
                  if (guestId !== otherGuestId) {
                    this.previousGroupings.get(guestId)!.add(otherGuestId)
                  }
                }
              }
            })
          })
        }
      }

      console.log('Previous groupings built:', this.previousGroupings)
    } catch (err) {
      console.error('Error building previous groupings map:', err)
    }
  }

  // Calculate penalty score for team assignments
  // Priority: 1) Fair play balance, 2) Family/SO separation, 3) Previous grouping separation, 4) Gender balance
  private calculateScore(teams: Team[]): number {
    let score = 0

    teams.forEach(team => {
      const members = team.members

      // Penalty 1: Fair play balance (HIGHEST priority)
      if (this.fairPlay && this.guestRankings.size > 0) {
        let teamRankSum = 0
        let rankedMembers = 0
        
        members.forEach(member => {
          const rank = this.guestRankings.get(member.guest.id)
          if (rank !== undefined) {
            teamRankSum += rank
            rankedMembers++
          }
        })
        
        if (rankedMembers > 0) {
          const avgRank = teamRankSum / rankedMembers
          const idealAvgRank = (this.guestRankings.size + 1) / 2 // Middle rank
          const rankDeviation = Math.abs(avgRank - idealAvgRank)
          score -= rankDeviation * 50 // High penalty for unbalanced teams
        }
      }

      // Check all pairs within the team for other penalties
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const member1 = members[i].guest
          const member2 = members[j].guest

          // Penalty 2: Family/SO on same team (SECOND highest penalty)
          if (this.areRelated(member1.id, member2.id)) {
            score -= 30
          }

          // Penalty 3: Previous grouping (THIRD highest penalty)  
          if (this.wereGroupedBefore(member1.id, member2.id)) {
            score -= 15
          }
        }
      }

      // Penalty 4: Gender balance (LOWEST penalty)
      const genderCounts = { man: 0, woman: 0, nonbinary: 0 }
      members.forEach(member => {
        genderCounts[member.guest.gender]++
      })
      
      // Ideal is even distribution, penalize imbalance
      const totalMembers = members.length
      const idealCount = totalMembers / 3 // If evenly distributed
      const genderImbalance = Math.abs(genderCounts.man - idealCount) + 
                             Math.abs(genderCounts.woman - idealCount) + 
                             Math.abs(genderCounts.nonbinary - idealCount)
      score -= genderImbalance * 5
    })

    return score
  }

  private areRelated(guestId1: string, guestId2: string): boolean {
    const relations1 = this.relationships.get(guestId1)
    return relations1 ? relations1.has(guestId2) : false
  }

  private wereGroupedBefore(guestId1: string, guestId2: string): boolean {
    const previousGroupings = this.previousGroupings.get(guestId1)
    return previousGroupings ? previousGroupings.has(guestId2) : false
  }

  private generateTeamName(): string {
    const customConfig: Config = {
      dictionaries: [adjectives, animals],
      separator: ' ',
      style: 'capital'
    }
    
    return uniqueNamesGenerator(customConfig)
  }

  private createTeamsFromAssignment(assignment: number[]): Team[] {
    const teams: Team[] = []
    
    // Initialize teams with random names
    for (let i = 0; i < this.numberOfTeams; i++) {
      teams.push({
        id: `team-${i}`,
        name: this.generateTeamName(),
        members: []
      })
    }

    // Assign guests to teams based on assignment array
    assignment.forEach((teamIndex, guestIndex) => {
      const guest = this.guests[guestIndex]
      const rank = this.guestRankings.get(guest.id)
      teams[teamIndex].members.push({
        guest,
        originalRank: rank
      })
    })

    return teams
  }

  private generateRandomAssignment(): number[] {
    const assignment: number[] = []
    let currentTeam = 0

    // Fill teams in round-robin fashion to ensure size constraints
    for (let i = 0; i < this.guests.length; i++) {
      assignment.push(currentTeam)
      currentTeam = (currentTeam + 1) % this.numberOfTeams
    }

    // Shuffle to randomize
    for (let i = assignment.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [assignment[i], assignment[j]] = [assignment[j], assignment[i]]
    }

    return assignment
  }

  private localOptimization(assignment: number[]): number[] {
    let current = [...assignment]
    let improved = true
    
    while (improved) {
      improved = false
      const currentTeams = this.createTeamsFromAssignment(current)
      const currentScore = this.calculateScore(currentTeams)
      
      // Try swapping guests between teams
      for (let i = 0; i < current.length - 1; i++) {
        for (let j = i + 1; j < current.length; j++) {
          if (current[i] !== current[j]) { // Only swap if they're on different teams
            const temp = [...current]
            ;[temp[i], temp[j]] = [temp[j], temp[i]]
            
            const tempTeams = this.createTeamsFromAssignment(temp)
            if (this.calculateScore(tempTeams) > currentScore) {
              current = temp
              improved = true
              break
            }
          }
        }
        if (improved) break
      }
    }
    
    return current
  }

  generateTeamOptions(maxOptions: number = 6): TeamOption[] {
    const options: TeamOption[] = []
    
    // Generate multiple random starting assignments and optimize them
    for (let attempt = 0; attempt < maxOptions * 3; attempt++) {
      const randomAssignment = this.generateRandomAssignment()
      const optimizedAssignment = this.localOptimization(randomAssignment)
      const teams = this.createTeamsFromAssignment(optimizedAssignment)
      
      options.push({
        score: this.calculateScore(teams),
        teams
      })
    }

    // Return top unique options (best arrangements first)
    const uniqueOptions = this.removeDuplicates(options)
    return uniqueOptions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxOptions)
  }

  private removeDuplicates(options: TeamOption[]): TeamOption[] {
    const seen = new Set<string>()
    return options.filter(option => {
      const key = option.teams.map(team => 
        team.members.map(m => m.guest.id).sort().join(',')
      ).sort().join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

export default function TeamPlacementPage({ params }: { params: { id: string; eventId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [party, setParty] = useState<Party | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null)
  const [guests, setGuests] = useState<Guest[]>([])
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [currentOptionIndex, setCurrentOptionIndex] = useState(0)
  const [currentTeams, setCurrentTeams] = useState<Team[]>([])
  const [originalTeams, setOriginalTeams] = useState<Team[]>([])
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
  }, [user, params.id, params.eventId])

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

      // Fetch event data
      const { data: eventData, error: eventError } = await supabase
        .from('party_items')
        .select('*')
        .eq('id', params.eventId)
        .eq('type', 'event')
        .single()

      if (eventError || !eventData) {
        console.error('Error fetching event:', eventError)
        router.push(`/dashboard/party/${params.id}`)
        return
      }
      setEvent(eventData)

      // Parse event configuration
      const config: EventConfig = JSON.parse(eventData.description)
      setEventConfig(config)

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

      // Generate team arrangements using CP-SAT
      console.log('🎯 Starting team optimization for', guestsWithRelationships.length, 'guests')
      const optimizer = new TeamOptimizer(
        guestsWithRelationships, 
        params.id, 
        supabase, 
        config,
        config.guestRankings || []
      )
      await optimizer.initialize()
      
      console.log('🧮 Generating team arrangements...')
      const options = optimizer.generateTeamOptions(6)
      console.log('✅ Generated', options.length, 'optimal team arrangements')
      console.log('📊 Team scores:', options.map((opt, i) => `Option ${i+1}: ${opt.score}`).join(', '))
      
      setTeamOptions(options)
      if (options.length > 0) {
        setCurrentTeams(options[0].teams)
        setOriginalTeams(JSON.parse(JSON.stringify(options[0].teams))) // Deep copy
      }

      setLoading(false)
    } catch (err) {
      console.error('Error:', err)
      setLoading(false)
    }
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const { source, destination } = result
    
    // Find source team and member
    const sourceTeamIndex = parseInt(source.droppableId.split('-')[1])
    const destTeamIndex = parseInt(destination.droppableId.split('-')[1])
    
    if (sourceTeamIndex === destTeamIndex) {
      // Reordering within same team
      const newTeams = [...currentTeams]
      const team = newTeams[sourceTeamIndex]
      const [removed] = team.members.splice(source.index, 1)
      team.members.splice(destination.index, 0, removed)
      setCurrentTeams(newTeams)
    } else {
      // Moving between teams
      const newTeams = [...currentTeams]
      const sourceTeam = newTeams[sourceTeamIndex]
      const destTeam = newTeams[destTeamIndex]
      
      const [removed] = sourceTeam.members.splice(source.index, 1)
      destTeam.members.splice(destination.index, 0, removed)
      
      setCurrentTeams(newTeams)
    }
  }

  const nextOption = () => {
    if (currentOptionIndex < teamOptions.length - 1) {
      const newIndex = currentOptionIndex + 1
      setCurrentOptionIndex(newIndex)
      setCurrentTeams(JSON.parse(JSON.stringify(teamOptions[newIndex].teams))) // Deep copy
    }
  }

  const prevOption = () => {
    if (currentOptionIndex > 0) {
      const newIndex = currentOptionIndex - 1
      setCurrentOptionIndex(newIndex)
      setCurrentTeams(JSON.parse(JSON.stringify(teamOptions[newIndex].teams))) // Deep copy
    }
  }

  const resetTeams = () => {
    setCurrentTeams(JSON.parse(JSON.stringify(originalTeams))) // Deep copy
    setCurrentOptionIndex(0)
  }

  const saveTeams = async () => {
    setSaving(true)
    try {
      // Delete existing team assignments for this event
      await supabase
        .from('team_assignments')
        .delete()
        .eq('party_item_id', params.eventId)

      // Insert new team assignments
      const assignments = currentTeams.flatMap((team, teamIndex) =>
        team.members.map((member, index) => ({
          party_item_id: params.eventId,
          guest_id: member.guest.id,
          team_number: teamIndex + 1,
          is_generated: true
        }))
      )

      const { error } = await supabase
        .from('team_assignments')
        .insert(assignments)

      if (error) {
        console.error('Error saving teams:', error)
        alert('Failed to save team assignments')
      } else {
        alert('Team assignments saved successfully!')
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
            Creating fair teams and calculating optimal arrangements...
          </div>
        </div>
      </div>
    )
  }

  if (!party || !event || !eventConfig || guests.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Unable to load team placement data</div>
      </div>
    )
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.placementModal}>
        {/* Header */}
        <div className={styles.placementHeader}>
          <div className={styles.headerLeft}>
            <h1 className={styles.eventName}>{event.name}</h1>
            <div className={styles.partyName}>{party.name}</div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.guestCount}>
              <Image src="/assets/user.svg" alt="Guests" width={20} height={20} />
              <span>{guests.length}</span>
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
            {teamOptions[currentOptionIndex] && (
              <span className={styles.scoreLabel}>
                (Score: {teamOptions[currentOptionIndex].score})
              </span>
            )}
          </div>
          
          <button 
            className={styles.navButton}
            onClick={nextOption}
            disabled={currentOptionIndex === teamOptions.length - 1}
          >
            <Image src="/assets/arrow-square-right.svg" alt="Next" width={20} height={20} />
          </button>
        </div>

        {/* Teams Area */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={styles.teamsArea}>
            {currentTeams.map((team, teamIndex) => (
              <div key={team.id} className={styles.teamContainer}>
                <div className={styles.teamHeader}>
                  <h3 className={styles.teamName}>Team {team.name}</h3>
                </div>
                <Droppable droppableId={`team-${teamIndex}`} direction="vertical">
                  {(provided: DroppableProvided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={styles.teamMembers}
                    >
                      {team.members.map((member, memberIndex) => (
                        <Draggable
                          key={member.guest.id}
                          draggableId={member.guest.id}
                          index={memberIndex}
                        >
                          {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`${styles.teamMember} ${
                                snapshot.isDragging ? styles.dragging : ''
                              }`}
                            >
                              {member.guest.name}
                              {member.originalRank && eventConfig?.fairPlay && (
                                <span className={styles.rankBadge}>#{member.originalRank}</span>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
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
            <button className={styles.resetButton} onClick={resetTeams}>
              reset
            </button>
          </div>
          
          <button 
            className={styles.saveButton}
            onClick={saveTeams}
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