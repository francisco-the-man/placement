'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'
import type { Party } from '@/lib/types'
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from '@hello-pangea/dnd'
import { toWords } from 'number-to-words'
import styles from './page.module.css'

interface Guest {
  id: string
  name: string
  gender: 'man' | 'woman' | 'nonbinary'
  created_at: string
  relationships?: string[]
}

interface PartyGuest {
  id: string
  party_id: string
  guest_id: string
  guests: Guest
}

interface PartyItem {
  id: string
  party_id: string
  name: string
  description: string | null
  type: 'meal' | 'event'
  date: string
  created_at: string
}

interface SeatingArrangement {
  id: string
  party_item_id: string
  guest_id: string
  position: number
  is_generated: boolean
  created_at: string
}

interface MealWithArrangement extends PartyItem {
  hasArrangement: boolean
  guestCount: number
}

interface EventWithTeams extends PartyItem {
  hasTeams: boolean
  guestCount: number
}

export default function PartyDetails() {
  const params = useParams()
  const router = useRouter()
  const partyId = params.id as string
  const [user, setUser] = useState<User | null>(null)
  const [party, setParty] = useState<Party | null>(null)
  const [partyGuests, setPartyGuests] = useState<PartyGuest[]>([])
  const [meals, setMeals] = useState<MealWithArrangement[]>([])
  const [events, setEvents] = useState<EventWithTeams[]>([])
  const [seatingArrangements, setSeatingArrangements] = useState<SeatingArrangement[]>([])
  const [teamAssignments, setTeamAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingDate, setIsEditingDate] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [guestSearchTerm, setGuestSearchTerm] = useState('')
  const [allUserGuests, setAllUserGuests] = useState<Guest[]>([])
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [newGuestName, setNewGuestName] = useState('')
  const [newGuestGender, setNewGuestGender] = useState<'man' | 'woman' | 'nonbinary'>('man')
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>([])
  const [hoveredGuestId, setHoveredGuestId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [guestRelationships, setGuestRelationships] = useState<{[key: string]: Guest[]}>({})
  const supabase = createClient()

  // New Meal Modal State
  const [showNewMealModal, setShowNewMealModal] = useState(false)
  const [newMealName, setNewMealName] = useState('Dinner 1')
  const [selectedMealGuests, setSelectedMealGuests] = useState<string[]>([])
  const [isCreatingMeal, setIsCreatingMeal] = useState(false)
  const [hoveredMealId, setHoveredMealId] = useState<string | null>(null)
  
  // View Arrangement Modal State
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewingMeal, setViewingMeal] = useState<MealWithArrangement | null>(null)
  const [viewArrangement, setViewArrangement] = useState<{guest: Guest, position: number}[]>([])
  const [loadingArrangement, setLoadingArrangement] = useState(false)

  // New Event Modal State
  const [showNewEventModal, setShowNewEventModal] = useState(false)
  const [newEventName, setNewEventName] = useState('Event 1')
  const [selectedEventGuests, setSelectedEventGuests] = useState<string[]>([])
  const [numberOfTeams, setNumberOfTeams] = useState(2)
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  const [fairPlay, setFairPlay] = useState(false)
  const [guestRankings, setGuestRankings] = useState<Guest[]>([])
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)

  // View Teams Modal State  
  const [showViewTeamsModal, setShowViewTeamsModal] = useState(false)
  const [viewingEvent, setViewingEvent] = useState<EventWithTeams | null>(null)
  const [viewTeams, setViewTeams] = useState<{[teamNumber: number]: {name: string, members: Guest[]}}>({})

  const fetchGuestRelationships = useCallback(async () => {
    try {
      const currentGuestIds = partyGuests.map(pg => pg.guest_id)
      if (currentGuestIds.length === 0) {
        setGuestRelationships({})
        return
      }

      console.log('Fetching relationships for guest IDs:', currentGuestIds)

      // Get all party guests with their relationships
      const { data, error } = await supabase
        .from('guests')
        .select('id, name, gender, relationships')
        .in('id', currentGuestIds)

      console.log('Raw guest data with relationships:', { data, error })

      if (error) {
        console.error('Error fetching guest relationships:', error)
        return
      }

      if (!data || data.length === 0) {
        console.log('No guests found')
        setGuestRelationships({})
        return
      }

      // Build relationship map
      const relationships: {[key: string]: Guest[]} = {}

      for (const guest of data) {
        const guestRelationshipIds = guest.relationships ?
          (Array.isArray(guest.relationships) ? guest.relationships : JSON.parse(guest.relationships))
          : []

        console.log(`Guest ${guest.name} has relationship IDs:`, guestRelationshipIds)

        // Filter to only include relationships that are in the current party
        const partyRelationshipIds = guestRelationshipIds.filter((id: string) => currentGuestIds.includes(id))

        if (partyRelationshipIds.length > 0) {
          // Get guest details for these relationships
          const { data: relatedGuestsData, error: relatedGuestsError } = await supabase
            .from('guests')
            .select('id, name, gender')
            .in('id', partyRelationshipIds)

          if (!relatedGuestsError && relatedGuestsData) {
            relationships[guest.id] = relatedGuestsData as Guest[]
            console.log(`Found ${relatedGuestsData.length} related guests for ${guest.name}`)
          }
        } else {
          relationships[guest.id] = []
        }
      }

      console.log('Final relationships mapping:', relationships)
      setGuestRelationships(relationships)
    } catch (err) {
      console.error('Error fetching guest relationships:', err)
    }
  }, [partyGuests, supabase])

  useEffect(() => {
    const fetchData = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (!user) {
        router.push('/login')
        return
      }

      // Fetch party details
      const { data: partyData, error: partyError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', partyId)
        .eq('user_id', user.id)
        .single()

      if (partyError || !partyData) {
        console.error('Error fetching party:', partyError)
        router.push('/dashboard')
        return
      }

      setParty(partyData)

      // Fetch party guests
      const { data: guestsData, error: guestsError } = await supabase
        .from('party_guests')
        .select(`
          *,
          guests (*)
        `)
        .eq('party_id', partyId)

      if (!guestsError && guestsData) {
        setPartyGuests(guestsData)
      }

      // Fetch party items (meals and events)
      const { data: itemsData, error: itemsError } = await supabase
        .from('party_items')
        .select('*')
        .eq('party_id', partyId)
        .order('created_at', { ascending: true })

      if (!itemsError && itemsData) {
        const mealItems = itemsData.filter(item => item.type === 'meal')
        const eventItems = itemsData.filter(item => item.type === 'event')
        
        // Fetch seating arrangements for meals - only show meals with saved arrangements
        if (mealItems.length > 0) {
          const mealIds = mealItems.map(meal => meal.id)
          const { data: arrangementsData, error: arrangementsError } = await supabase
            .from('seating_arrangements')
            .select('*')
            .in('party_item_id', mealIds)

          if (!arrangementsError && arrangementsData) {
            setSeatingArrangements(arrangementsData)
            
            // Only include meals that have saved seating arrangements
            const mealsWithArrangements: MealWithArrangement[] = mealItems
              .filter(meal => {
                const mealArrangements = arrangementsData.filter(arr => arr.party_item_id === meal.id)
                return mealArrangements.length > 0
              })
              .map(meal => {
                const mealArrangements = arrangementsData.filter(arr => arr.party_item_id === meal.id)
                return {
                  ...meal,
                  hasArrangement: true,
                  guestCount: mealArrangements.length
                }
              })
            
            setMeals(mealsWithArrangements)
          } else {
            // No arrangements found, show no meals
            setMeals([])
          }
        } else {
          setMeals([])
        }

        // Fetch team assignments for events - only show events with saved teams
        if (eventItems.length > 0) {
          const eventIds = eventItems.map(event => event.id)
          const { data: teamsData, error: teamsError } = await supabase
            .from('team_assignments')
            .select(`
              *,
              guests (*)
            `)
            .in('party_item_id', eventIds)

          if (!teamsError && teamsData) {
            setTeamAssignments(teamsData)
            
            // Only include events that have saved team assignments
            const eventsWithTeams: EventWithTeams[] = eventItems
              .filter(event => {
                const eventTeams = teamsData.filter(team => team.party_item_id === event.id)
                return eventTeams.length > 0
              })
              .map(event => {
                const eventTeams = teamsData.filter(team => team.party_item_id === event.id)
                return {
                  ...event,
                  hasTeams: true,
                  guestCount: eventTeams.length
                }
              })
            
            setEvents(eventsWithTeams)
          } else {
            // No team assignments found, show no events
            setEvents([])
          }
        } else {
          setEvents([])
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [partyId, supabase, router])

  useEffect(() => {
    if (partyGuests.length > 0) {
      fetchGuestRelationships()
    }
  }, [partyGuests, fetchGuestRelationships])

  const getUserName = () => {
    const userMetaName = user?.user_metadata?.display_name || user?.user_metadata?.full_name
    if (userMetaName) {
      return userMetaName.split(' ')[0]
    }
    return 'User'
  }

  const getDateRange = () => {
    if (!party) return ''
    
    if (party.description) {
      if (party.description.match(/^\d{2}\/\d{2}\/\d{2}( - \d{2}\/\d{2}\/\d{2})?$/)) {
        return party.description
      }
    }
    
    const date = new Date(party.created_at)
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    })
  }

  const formatItemDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    })
  }

  const getGuestsList = () => {
    if (partyGuests.length === 0) return 'No guests added yet'
    
    const guestNames = partyGuests.map(pg => pg.guests.name)
    return guestNames.join(', ')
  }

  const parseDateDescription = (description: string) => {
    if (!description) return { startDate: '', endDate: '' }
    
    // Check if it's formatted (DD/MM/YY or DD/MM/YY - DD/MM/YY)
    if (description.match(/^\d{2}\/\d{2}\/\d{2}( - \d{2}\/\d{2}\/\d{2})?$/)) {
      if (description.includes(' - ')) {
        const [start, end] = description.split(' - ')
        // Convert DD/MM/YY to YYYY-MM-DD for date input
        const startParts = start.split('/')
        const endParts = end.split('/')
        const startFormatted = `20${startParts[2]}-${startParts[1]}-${startParts[0]}`
        const endFormatted = `20${endParts[2]}-${endParts[1]}-${endParts[0]}`
        return { startDate: startFormatted, endDate: endFormatted }
      } else {
        // Single date
        const parts = description.split('/')
        const formatted = `20${parts[2]}-${parts[1]}-${parts[0]}`
        return { startDate: formatted, endDate: '' }
      }
    }
    
    return { startDate: '', endDate: '' }
  }

  const startEditingName = () => {
    setEditName(party?.name || '')
    setIsEditingName(true)
  }

  const startEditingDate = () => {
    const { startDate, endDate } = parseDateDescription(party?.description || '')
    setEditStartDate(startDate)
    setEditEndDate(endDate)
    setIsEditingDate(true)
  }

  const cancelEditingName = () => {
    setIsEditingName(false)
    setEditName('')
  }

  const cancelEditingDate = () => {
    setIsEditingDate(false)
    setEditStartDate('')
    setEditEndDate('')
  }

  const savePartyName = async () => {
    if (!editName.trim() || !party) return

    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('parties')
        .update({ name: editName.trim() })
        .eq('id', partyId)
        .eq('user_id', user?.id)

      if (error) {
        console.error('Error updating party name:', error)
      } else {
        setParty({ ...party, name: editName.trim() })
        setIsEditingName(false)
        setEditName('')
      }
    } catch (err) {
      console.error('Error:', err)
    }
    setIsUpdating(false)
  }

  const savePartyDate = async () => {
    if (!editStartDate || !party) return

    setIsUpdating(true)
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

      const dateDescription = editEndDate 
        ? `${formatDisplayDate(editStartDate)} - ${formatDisplayDate(editEndDate)}`
        : formatDisplayDate(editStartDate)

      const { error } = await supabase
        .from('parties')
        .update({ description: dateDescription })
        .eq('id', partyId)
        .eq('user_id', user?.id)

      if (error) {
        console.error('Error updating party date:', error)
      } else {
        setParty({ ...party, description: dateDescription })
        setIsEditingDate(false)
        setEditStartDate('')
        setEditEndDate('')
      }
    } catch (err) {
      console.error('Error:', err)
    }
    setIsUpdating(false)
  }

  const fetchAllUserGuests = async () => {
    if (!user) return

    try {
      console.log('Fetching all user guests for user:', user.id)
      
      // Get all guests that belong to this user directly
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('user_id', user.id)

      console.log('All user guests query result:', { data, error })

      if (!error && data) {
        setAllUserGuests(data as Guest[])
        console.log('Set allUserGuests to:', data)
      } else {
        console.error('Error fetching guests:', error)
      }
    } catch (err) {
      console.error('Error fetching user guests:', err)
    }
  }





  const openGuestModal = async () => {
    setShowGuestModal(true)
    await fetchAllUserGuests()
    await fetchGuestRelationships() // Refresh relationships when modal opens
  }

  const closeGuestModal = () => {
    console.log('Closing guest modal and resetting state')
    setShowGuestModal(false)
    setShowAddGuest(false)
    setGuestSearchTerm('')
    setSelectedGuest(null)
    setNewGuestName('')
    setNewGuestGender('man')
    setSelectedRelationships([])
  }

  const openNewMealModal = () => {
    setShowNewMealModal(true)
    setNewMealName('Dinner 1')
    setSelectedMealGuests([])
  }

  const closeNewMealModal = () => {
    setShowNewMealModal(false)
    setNewMealName('Dinner 1')
    setSelectedMealGuests([])
    setIsCreatingMeal(false)
  }

  const openNewEventModal = () => {
    setShowNewEventModal(true)
    setNewEventName('Event 1')
    setSelectedEventGuests([])
    setNumberOfTeams(2)
    setFairPlay(false)
    setGuestRankings([])
  }

  const closeNewEventModal = () => {
    setShowNewEventModal(false)
    setNewEventName('Event 1')
    setSelectedEventGuests([])
    setNumberOfTeams(2)
    setIsCreatingEvent(false)
    setFairPlay(false)
    setGuestRankings([])
  }

  const toggleEventGuestSelection = (guestId: string) => {
    setSelectedEventGuests(prev => {
      const newSelection = prev.includes(guestId)
        ? prev.filter(id => id !== guestId)
        : [...prev, guestId]
      
      // Update rankings when guest selection changes
      if (fairPlay) {
        const selectedGuests = partyGuests
          .filter(pg => newSelection.includes(pg.guest_id))
          .map(pg => pg.guests)
        setGuestRankings(selectedGuests)
      }
      
      return newSelection
    })
  }

  const selectAllEventGuests = () => {
    const allGuestIds = partyGuests.map(pg => pg.guest_id)
    setSelectedEventGuests(allGuestIds)
    
    // Update rankings if fair play is enabled
    if (fairPlay) {
      const allGuests = partyGuests.map(pg => pg.guests)
      setGuestRankings(allGuests)
    }
  }

  const calculateTeamConfiguration = () => {
    const totalGuests = selectedEventGuests.length
    if (totalGuests === 0 || numberOfTeams === 0) return { teams: 0, minSize: 0, maxSize: 0, description: '' }

    const minTeamSize = Math.floor(totalGuests / numberOfTeams)
    const remainder = totalGuests % numberOfTeams
    const maxTeamSize = remainder > 0 ? minTeamSize + 1 : minTeamSize

    let description = ''
    if (remainder === 0) {
      // Even teams
      description = `${toWords(numberOfTeams)} teams of ${toWords(minTeamSize)}`
    } else {
      // Uneven teams
      description = `${toWords(numberOfTeams)} teams of ${toWords(minTeamSize)}/${toWords(maxTeamSize)}`
    }

    return {
      teams: numberOfTeams,
      minSize: minTeamSize,
      maxSize: maxTeamSize,
      description
    }
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const sourceIndex = result.source.index
    const destinationIndex = result.destination.index

    if (sourceIndex === destinationIndex) return

    const reorderedRankings = Array.from(guestRankings)
    const [removed] = reorderedRankings.splice(sourceIndex, 1)
    reorderedRankings.splice(destinationIndex, 0, removed)

    setGuestRankings(reorderedRankings)
  }

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) {
      alert('Please enter a name for the event')
      return
    }

    if (selectedEventGuests.length === 0) {
      alert('Please select at least one guest')
      return
    }

    const teamConfig = calculateTeamConfiguration()
    if (teamConfig.teams < 2) {
      alert('You need at least 2 teams')
      return
    }

    setIsCreatingEvent(true)

    try {
      // Create the event (party item)
      const { data: eventData, error: eventError } = await supabase
        .from('party_items')
        .insert({
          party_id: partyId,
          name: newEventName,
          type: 'event',
          description: JSON.stringify({
            teams: numberOfTeams,
            minTeamSize: teamConfig.minSize,
            maxTeamSize: teamConfig.maxSize,
            fairPlay: fairPlay,
            guestRankings: fairPlay ? guestRankings.map(g => g.id) : null
          })
        })
        .select()
        .single()

      if (eventError || !eventData) {
        console.error('Error creating event:', eventError)
        alert('Failed to create event')
        setIsCreatingEvent(false)
        return
      }

      // Navigate to team placement page with selected guests
      const guestParams = selectedEventGuests.join(',')
      router.push(`/dashboard/party/${partyId}/event/${eventData.id}/placement?guests=${guestParams}`)
      closeNewEventModal()
    } catch (err) {
      console.error('Error:', err)
      alert('An unexpected error occurred')
      setIsCreatingEvent(false)
    }
  }

  const toggleMealGuestSelection = (guestId: string) => {
    setSelectedMealGuests(prev => 
      prev.includes(guestId)
        ? prev.filter(id => id !== guestId)
        : [...prev, guestId]
    )
  }

  const selectAllMealGuests = () => {
    const allGuestIds = partyGuests.map(pg => pg.guest_id)
    setSelectedMealGuests(allGuestIds)
  }

  const handleCreateMeal = async () => {
    if (!newMealName.trim()) {
      alert('Please enter a name for the meal')
      return
    }

    if (selectedMealGuests.length === 0) {
      alert('Please select at least one guest')
      return
    }

    setIsCreatingMeal(true)

    try {
      // Create the meal (party item)
      const { data: mealData, error: mealError } = await supabase
        .from('party_items')
        .insert({
          party_id: partyId,
          name: newMealName,
          type: 'meal'
        })
        .select()
        .single()

      if (mealError || !mealData) {
        console.error('Error creating meal:', mealError)
        alert('Failed to create meal')
        setIsCreatingMeal(false)
        return
      }

      // Navigate to placement page with selected guests
      const guestParams = selectedMealGuests.join(',')
      router.push(`/dashboard/party/${partyId}/meal/${mealData.id}/placement?guests=${guestParams}`)
    } catch (err) {
      console.error('Error:', err)
      alert('An unexpected error occurred')
      setIsCreatingMeal(false)
    }
  }

  const viewMealArrangement = async (meal: MealWithArrangement) => {
    setLoadingArrangement(true)
    setViewingMeal(meal)
    setShowViewModal(true)

    try {
      // Fetch the saved seating arrangement
      const { data: arrangements, error: arrangementsError } = await supabase
        .from('seating_arrangements')
        .select(`
          *,
          guests (*)
        `)
        .eq('party_item_id', meal.id)
        .order('position')

      if (arrangementsError || !arrangements) {
        console.error('Error fetching seating arrangement:', arrangementsError)
        alert('Failed to load seating arrangement')
        setShowViewModal(false)
        setLoadingArrangement(false)
        return
      }

      // Transform the data to match our display format
      const arrangementData = arrangements.map(arr => ({
        guest: arr.guests as Guest,
        position: arr.position
      }))

      setViewArrangement(arrangementData)
      setLoadingArrangement(false)
    } catch (err) {
      console.error('Error:', err)
      alert('An unexpected error occurred')
      setShowViewModal(false)
      setLoadingArrangement(false)
    }
  }

  const closeViewModal = () => {
    setShowViewModal(false)
    setViewingMeal(null)
    setViewArrangement([])
    setLoadingArrangement(false)
  }

  const viewEventTeams = async (event: EventWithTeams) => {
    setViewingEvent(event)
    setShowViewTeamsModal(true)

    try {
      // Fetch the saved team assignments
      const { data: teams, error: teamsError } = await supabase
        .from('team_assignments')
        .select(`
          *,
          guests (*)
        `)
        .eq('party_item_id', event.id)
        .order('team_number')

      if (teamsError || !teams) {
        console.error('Error fetching team assignments:', teamsError)
        alert('Failed to load team assignments')
        setShowViewTeamsModal(false)
        return
      }

      // Get event config to determine team names
      const eventConfig = JSON.parse(event.description || '{}')
      
      // Group teams by team number and generate team names
      const teamGroups: {[teamNumber: number]: {name: string, members: Guest[]}} = {}
      
      teams.forEach(assignment => {
        if (!teamGroups[assignment.team_number]) {
          // Generate consistent team name for this team number
          const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator')
          const customConfig = {
            dictionaries: [adjectives, animals],
            separator: ' ',
            style: 'capital',
            seed: event.id + assignment.team_number // Use seed for consistent names
          }
          
          teamGroups[assignment.team_number] = {
            name: uniqueNamesGenerator(customConfig),
            members: []
          }
        }
        teamGroups[assignment.team_number].members.push(assignment.guests as Guest)
      })

      setViewTeams(teamGroups)
    } catch (err) {
      console.error('Error:', err)
      alert('An unexpected error occurred')
      setShowViewTeamsModal(false)
    }
  }

  const closeViewTeamsModal = () => {
    setShowViewTeamsModal(false)
    setViewingEvent(null)
    setViewTeams({})
  }

  const deleteEventTeams = async (eventId: string, eventName: string) => {
    if (!confirm(`Are you sure you want to delete the team assignments for "${eventName}"? This action cannot be undone.`)) {
      return
    }

    setIsProcessing(true)
    try {
      // Delete all team assignments for this event
      const { error: deleteError } = await supabase
        .from('team_assignments')
        .delete()
        .eq('party_item_id', eventId)

      if (deleteError) {
        console.error('Error deleting team assignments:', deleteError)
        alert('Failed to delete team assignments')
        setIsProcessing(false)
        return
      }

      // Update the events list by removing this event
      setEvents(events.filter(event => event.id !== eventId))
      
      console.log(`Successfully deleted team assignments for event: ${eventName}`)
    } catch (err) {
      console.error('Error:', err)
      alert('An unexpected error occurred')
    }
    setIsProcessing(false)
  }

  const deleteMealArrangement = async (mealId: string, mealName: string) => {
    if (!confirm(`Are you sure you want to delete the seating arrangement for "${mealName}"? This action cannot be undone.`)) {
      return
    }

    setIsProcessing(true)
    try {
      // Delete all seating arrangements for this meal
      const { error: deleteError } = await supabase
        .from('seating_arrangements')
        .delete()
        .eq('party_item_id', mealId)

      if (deleteError) {
        console.error('Error deleting seating arrangement:', deleteError)
        alert('Failed to delete seating arrangement')
        setIsProcessing(false)
        return
      }

      // Update the meals list by removing this meal
      setMeals(meals.filter(meal => meal.id !== mealId))
      
      console.log(`Successfully deleted seating arrangement for meal: ${mealName}`)
    } catch (err) {
      console.error('Error:', err)
      alert('An unexpected error occurred')
    }
    setIsProcessing(false)
  }

  const deleteGuest = async (guestId: string) => {
    if (!confirm('Are you sure you want to remove this guest from the party?')) return

    setIsProcessing(true)
    try {
      const { error } = await supabase
        .from('party_guests')
        .delete()
        .eq('party_id', partyId)
        .eq('guest_id', guestId)

      if (!error) {
        setPartyGuests(partyGuests.filter(pg => pg.guest_id !== guestId))
      } else {
        console.error('Error deleting guest:', error)
      }
    } catch (err) {
      console.error('Error:', err)
    }
    setIsProcessing(false)
  }

  const handleGuestSearch = (term: string) => {
    console.log('Guest search term changed to:', term)
    setGuestSearchTerm(term)
    setNewGuestName(term)
    
    // Check if this guest already exists (exact match)
    const existingGuest = allUserGuests.find(g => 
      g.name.toLowerCase() === term.toLowerCase()
    )
    
    console.log('Existing guest found:', existingGuest)
    
    if (existingGuest) {
      setSelectedGuest(existingGuest)
      // Reset relationships when switching to existing guest
      setSelectedRelationships([])
    } else {
      setSelectedGuest(null)
    }
  }

  const addExistingGuest = async () => {
    if (!selectedGuest) return

    setIsProcessing(true)
    try {
      console.log('Adding existing guest:', { guest: selectedGuest, relationships: selectedRelationships })
      
      // Check if guest is already in this party
      const existing = partyGuests.find(pg => pg.guest_id === selectedGuest.id)
      if (existing) {
        alert('This guest is already in the party!')
        setIsProcessing(false)
        return
      }

      // Add guest to party
      const { data, error } = await supabase
        .from('party_guests')
        .insert([{
          party_id: partyId,
          guest_id: selectedGuest.id
        }])
        .select(`
          *,
          guests (*)
        `)

      if (error || !data) {
        console.error('Error adding guest:', error)
        alert(`Error adding guest to party: ${error?.message || 'Unknown error'}. Please try again.`)
        setIsProcessing(false)
        return
      }

      console.log('Existing guest added to party:', data[0])
      setPartyGuests([...partyGuests, data[0]])
      
      // Add any new relationships
      if (selectedRelationships.length > 0) {
        console.log('Adding relationships for existing guest:', selectedRelationships)
        try {
          await addGuestRelationships(selectedGuest.id, selectedRelationships)
          console.log('Relationships added successfully')
          // Refresh relationships display
          await fetchGuestRelationships()
        } catch (relationshipError) {
          console.error('Failed to add relationships:', relationshipError)
          alert('Guest added but failed to add some family/SO relationships. Please edit the guest to add them.')
        }
      }
      
      closeGuestModal()
    } catch (err) {
      console.error('Error:', err)
      alert('An unexpected error occurred. Please try again.')
    }
    setIsProcessing(false)
  }

  const addNewGuest = async () => {
    const guestName = newGuestName.trim() || guestSearchTerm.trim()
    if (!guestName) {
      alert('Please enter a guest name.')
      return
    }

    if (!user?.id) {
      alert('Authentication error. Please refresh and try again.')
      return
    }

    setIsProcessing(true)
    try {
      console.log('Creating new guest:', { name: guestName, gender: newGuestGender, relationships: selectedRelationships })
      
      // Create new guest
      const { data: guestData, error: guestError } = await supabase
        .from('guests')
        .insert([{
          name: guestName,
          gender: newGuestGender,
          user_id: user.id
        }])
        .select()
        .single()

      if (guestError || !guestData) {
        console.error('Error creating guest:', guestError)
        alert(`Error creating guest: ${guestError?.message || 'Unknown error'}. Please try again.`)
        setIsProcessing(false)
        return
      }

      console.log('Guest created:', guestData)

      // Add guest to party
      const { data: partyGuestData, error: partyGuestError } = await supabase
        .from('party_guests')
        .insert([{
          party_id: partyId,
          guest_id: guestData.id
        }])
        .select(`
          *,
          guests (*)
        `)

      if (partyGuestError || !partyGuestData) {
        console.error('Error adding guest to party:', partyGuestError)
        alert(`Error adding guest to party: ${partyGuestError?.message || 'Unknown error'}. Please try again.`)
        setIsProcessing(false)
        return
      }

      console.log('Guest added to party:', partyGuestData[0])
      setPartyGuests([...partyGuests, partyGuestData[0]])
      
      // Add relationships
      if (selectedRelationships.length > 0) {
        console.log('Adding relationships for new guest:', selectedRelationships)
        try {
          await addGuestRelationships(guestData.id, selectedRelationships)
          console.log('Relationships added successfully')
        } catch (relationshipError) {
          console.error('Failed to add relationships:', relationshipError)
          alert('Guest created but failed to add some family/SO relationships. Please edit the guest to add them.')
        }
      }
      
      closeGuestModal()
    } catch (err) {
      console.error('Error:', err)
      alert('An unexpected error occurred. Please try again.')
    }
    setIsProcessing(false)
  }

  const addGuestRelationships = async (guestId: string, relationshipIds: string[]) => {
    if (!relationshipIds || relationshipIds.length === 0) {
      console.log('No relationships to add')
      return
    }

    try {
      console.log(`🔄 Adding RECIPROCAL relationships for guest ${guestId} with:`, relationshipIds)

      // Step 1: Fetch the main guest's current relationships
      const { data: mainGuestData, error: mainGuestError } = await supabase
        .from('guests')
        .select('id, name, relationships')
        .eq('id', guestId)
        .single()

      if (mainGuestError || !mainGuestData) {
        console.error('❌ Error fetching main guest:', mainGuestError)
        throw new Error('Could not fetch main guest data')
      }

      // Step 2: Update main guest's relationships by adding new ones
      const existingRelationships = mainGuestData.relationships ? 
        (Array.isArray(mainGuestData.relationships) ? mainGuestData.relationships : JSON.parse(mainGuestData.relationships)) 
        : []
      
      console.log(`📊 Main guest ${mainGuestData.name} currently has relationships:`, existingRelationships)
      
      // Add new relationships while avoiding duplicates
      const newRelationshipsSet = new Set([...existingRelationships, ...relationshipIds])
      const updatedMainRelationships = Array.from(newRelationshipsSet)
      
      console.log(`💾 Updating main guest ${mainGuestData.name} to have relationships with:`, updatedMainRelationships)
      
      const { error: updateMainError } = await supabase
        .from('guests')
        .update({ relationships: updatedMainRelationships })
        .eq('id', guestId)

      if (updateMainError) {
        console.error(`❌ Error updating main guest relationships:`, updateMainError)
        throw updateMainError
      }

      // Step 3: For each new relationship, add the main guest to their relationships (reciprocal)
      for (const relationshipId of relationshipIds) {
        // Fetch the related guest's current relationships
        const { data: relatedGuestData, error: relatedGuestError } = await supabase
          .from('guests')
          .select('id, name, relationships')
          .eq('id', relationshipId)
          .single()

        if (relatedGuestError || !relatedGuestData) {
          console.error(`❌ Error fetching related guest ${relationshipId}:`, relatedGuestError)
          continue // Skip this one but continue with others
        }

        const relatedExistingRelationships = relatedGuestData.relationships ? 
          (Array.isArray(relatedGuestData.relationships) ? relatedGuestData.relationships : JSON.parse(relatedGuestData.relationships)) 
          : []
        
        console.log(`📊 Related guest ${relatedGuestData.name} currently has relationships:`, relatedExistingRelationships)
        
        // Add main guest to related guest's relationships (avoiding duplicates)
        if (!relatedExistingRelationships.includes(guestId)) {
          const updatedRelatedRelationships = [...relatedExistingRelationships, guestId]
          
          console.log(`💾 Updating related guest ${relatedGuestData.name} to have relationships with:`, updatedRelatedRelationships)
          
          const { error: updateRelatedError } = await supabase
            .from('guests')
            .update({ relationships: updatedRelatedRelationships })
            .eq('id', relationshipId)

          if (updateRelatedError) {
            console.error(`❌ Error updating relationships for ${relatedGuestData.name}:`, updateRelatedError)
          } else {
            console.log(`✅ Successfully added reciprocal relationship for ${relatedGuestData.name}`)
          }
        } else {
          console.log(`ℹ️ ${relatedGuestData.name} already has ${mainGuestData.name} as a relationship`)
        }
      }

      console.log('🎉 All reciprocal relationship operations completed successfully')
      
      return { success: true }
    } catch (err) {
      console.error('❌ Error adding reciprocal relationships:', err)
      throw err
    }
  }

  const getCurrentPartyGuests = () => {
    return partyGuests.map(pg => pg.guests).filter(Boolean)
  }

  const getAvailableRelationships = () => {
    const currentGuests = getCurrentPartyGuests()
    if (selectedGuest) {
      // For existing guests, exclude themselves and current relationships
      return currentGuests.filter(g => g.id !== selectedGuest.id)
    }
    // For new guests, show all current party guests
    return currentGuests
  }

  if (loading) {
    return (
      <main className={styles.container}>
        <div className={styles.loading}>Loading party details...</div>
      </main>
    )
  }

  if (!party) {
    return (
      <main className={styles.container}>
        <div className={styles.error}>Party not found</div>
      </main>
    )
  }

  return (
    <main className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>Party</h1>
        <div className={styles.userSection}>
          <span className={styles.username}>{getUserName()}</span>
          <Image 
            src="/assets/user.svg" 
            alt="User" 
            width={24} 
            height={24}
            className={styles.userIcon}
          />
        </div>
      </header>

      {/* Party Details */}
      <section className={styles.partyDetails}>
        <div className={styles.partyInfo}>
          <div className={styles.partyName}>
            {isEditingName ? (
              <div className={styles.editNameContainer}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={styles.editNameInput}
                  autoFocus
                  disabled={isUpdating}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') savePartyName()
                    if (e.key === 'Escape') cancelEditingName()
                  }}
                />
                <div className={styles.editButtons}>
                  <button 
                    onClick={savePartyName} 
                    className={styles.saveButton}
                    disabled={!editName.trim() || isUpdating}
                  >
                    {isUpdating ? '...' : '✓'}
                  </button>
                  <button 
                    onClick={cancelEditingName} 
                    className={styles.cancelButton}
                    disabled={isUpdating}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2>{party.name}</h2>
                <button className={styles.editButton} onClick={startEditingName}>
                  <Image src="/assets/note.svg" alt="Edit" width={20} height={20} />
                </button>
              </>
            )}
          </div>
          <div className={styles.partyDate}>
            {isEditingDate ? (
              <div className={styles.editDateContainer}>
                <div className={styles.dateInputs}>
                  <div className={styles.dateInputGroup}>
                    <label className={styles.dateLabel}>Start:</label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className={styles.dateInput}
                      disabled={isUpdating}
                    />
                  </div>
                  <div className={styles.dateInputGroup}>
                    <label className={styles.dateLabel}>End (optional):</label>
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className={styles.dateInput}
                      min={editStartDate}
                      disabled={isUpdating}
                    />
                  </div>
                </div>
                <div className={styles.editButtons}>
                  <button 
                    onClick={savePartyDate} 
                    className={styles.saveButton}
                    disabled={!editStartDate || isUpdating}
                  >
                    {isUpdating ? '...' : '✓'}
                  </button>
                  <button 
                    onClick={cancelEditingDate} 
                    className={styles.cancelButton}
                    disabled={isUpdating}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span>{getDateRange()}</span>
                <button className={styles.editButton} onClick={startEditingDate}>
                  <Image src="/assets/note.svg" alt="Edit" width={20} height={20} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Guests Section */}
        <div className={styles.guestsSection}>
          <div className={styles.guestsInfo}>
            <p><strong>Guests:</strong> {getGuestsList()}</p>
            <p><strong>Total:</strong> {partyGuests.length}</p>
          </div>
          <button className={styles.editGuestsButton} onClick={() => openGuestModal()}>
            <span>edit guests</span>
            <Image src="/assets/note.svg" alt="Edit" width={16} height={16} />
          </button>
        </div>
      </section>

      {/* Meals Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <h3>Meals</h3>
            <Image src="/assets/cutlery.svg" alt="Meals" width={20} height={20} />
          </div>
          <button className={styles.createButton} onClick={openNewMealModal}>
            <span>create new</span>
            <Image src="/assets/square-plus.svg" alt="Create" width={20} height={20} />
          </button>
        </div>
        
        <div className={styles.itemsContainer}>
          {meals.length === 0 ? (
            <div className={styles.emptyState}>No saved seating arrangements yet</div>
          ) : (
            <>
              <div className={styles.itemsHeader}>
                <div className={styles.itemName}>Name</div>
                <div className={styles.itemGuests}># of guests</div>
                <div className={styles.itemAction}>Action</div>
              </div>
              <div className={styles.itemsList}>
                {meals.map((meal) => (
                  <div 
                    key={meal.id} 
                    className={styles.itemRow}
                    onMouseEnter={() => setHoveredMealId(meal.id)}
                    onMouseLeave={() => setHoveredMealId(null)}
                  >
                    <div className={styles.itemName}>{meal.name}</div>
                    <div className={styles.itemGuests}>
                      {meal.guestCount}
                    </div>
                    <div className={styles.itemAction}>
                      <button 
                        onClick={() => viewMealArrangement(meal)}
                        className={styles.actionLink}
                        disabled={isProcessing}
                      >
                        <Image src="/assets/unhide.svg" alt="View Arrangement" width={20} height={20} />
                      </button>
                      {hoveredMealId === meal.id && (
                        <button 
                          className={styles.deleteMealButton}
                          onClick={() => deleteMealArrangement(meal.id, meal.name)}
                          disabled={isProcessing}
                        >
                          <Image src="/assets/delete.svg" alt="Delete" width={16} height={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Events Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <h3>Events</h3>
            <Image src="/assets/trophy.svg" alt="Events" width={20} height={20} />
          </div>
          <button className={styles.createButton} onClick={openNewEventModal}>
            <span>create new</span>
            <Image src="/assets/square-plus.svg" alt="Create" width={20} height={20} />
          </button>
        </div>
        
        <div className={styles.itemsContainer}>
          {events.length === 0 ? (
            <div className={styles.emptyState}>No saved team assignments yet</div>
          ) : (
            <>
              <div className={styles.itemsHeader}>
                <div className={styles.itemName}>Name</div>
                <div className={styles.itemGuests}># of guests</div>
                <div className={styles.itemAction}>Action</div>
              </div>
              <div className={styles.itemsList}>
                {events.map((event) => (
                  <div 
                    key={event.id} 
                    className={styles.itemRow}
                    onMouseEnter={() => setHoveredEventId(event.id)}
                    onMouseLeave={() => setHoveredEventId(null)}
                  >
                    <div className={styles.itemName}>{event.name}</div>
                    <div className={styles.itemGuests}>
                      {event.guestCount}
                    </div>
                    <div className={styles.itemAction}>
                      <button 
                        onClick={() => viewEventTeams(event)}
                        className={styles.actionLink}
                        disabled={isProcessing}
                      >
                        <Image src="/assets/unhide.svg" alt="View Teams" width={20} height={20} />
                      </button>
                      {hoveredEventId === event.id && (
                        <button 
                          className={styles.deleteMealButton}
                          onClick={() => deleteEventTeams(event.id, event.name)}
                          disabled={isProcessing}
                        >
                          <Image src="/assets/delete.svg" alt="Delete" width={16} height={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Back Button */}
      <div className={styles.backSection}>
        <Link href="/dashboard" className={styles.backButton}>
          <Image src="/assets/arrow-square-left.svg" alt="Back" width={20} height={20} />
          <span>back</span>
        </Link>
      </div>

      {/* Guest Management Modal */}
      {showGuestModal && (
        <div 
          className={styles.modal}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeGuestModal()
            }
          }}
        >
          <div className={styles.guestModal}>
            {!showAddGuest ? (
              <>
                {/* Guest List View */}
                <div className={styles.guestModalHeader}>
                  <div className={styles.guestModalTitle}>
                    <h2>Guests</h2>
                    <div className={styles.guestCount}>
                      <Image src="/assets/user.svg" alt="Guests" width={20} height={20} />
                      <span>{partyGuests.length}</span>
                    </div>
                  </div>
                                     <div style={{ display: 'flex', gap: '1rem' }}>
                     <button 
                       className={styles.addNewButton}
                       onClick={() => setShowAddGuest(true)}
                     >
                       <span>add new</span>
                       <Image src="/assets/square-plus.svg" alt="Add" width={20} height={20} />
                     </button>

                   </div>
                </div>

                <div className={styles.guestList}>
                  <div className={styles.guestListHeader}>
                    <div className={styles.guestHeaderName}>Name</div>
                    <div className={styles.guestHeaderGender}>Gender</div>
                    <div className={styles.guestHeaderFamily}>Family/SO</div>
                  </div>
                  
                  <div className={styles.guestListContent}>
                    {partyGuests.map((partyGuest) => (
                      <div 
                        key={partyGuest.id} 
                        className={styles.guestRow}
                        onMouseEnter={() => setHoveredGuestId(partyGuest.guest_id)}
                        onMouseLeave={() => setHoveredGuestId(null)}
                      >
                        <div className={styles.guestName}>{partyGuest.guests.name}</div>
                        <div className={styles.guestGender}>
                          <Image 
                            src={`/assets/${partyGuest.guests.gender === 'woman' ? 'user-female' : partyGuest.guests.gender === 'man' ? 'user-male' : 'user'}.svg`} 
                            alt={partyGuest.guests.gender} 
                            width={20} 
                            height={20} 
                          />
                        </div>
                                                 <div className={styles.guestFamily}>
                           {(() => {
                             console.log(`Relationships for guest ${partyGuest.guests.name} (${partyGuest.guest_id}):`, guestRelationships[partyGuest.guest_id])
                             const relationships = guestRelationships[partyGuest.guest_id]
                             if (relationships && relationships.length > 0) {
                               return relationships.map(rel => rel.name).join(', ')
                             }
                             return 'None'
                           })()}
                         </div>
                        {hoveredGuestId === partyGuest.guest_id && (
                          <button 
                            className={styles.deleteGuestButton}
                            onClick={() => deleteGuest(partyGuest.guest_id)}
                            disabled={isProcessing}
                          >
                            <Image src="/assets/delete.svg" alt="Delete" width={16} height={16} />
                          </button>
                        )}
                        <button className={styles.editGuestButton}>
                          <Image src="/assets/note.svg" alt="Edit" width={16} height={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.guestModalFooter}>
                  <button className={styles.backButton} onClick={closeGuestModal}>
                    <Image src="/assets/arrow-square-left.svg" alt="Back" width={20} height={20} />
                    <span>back</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Add Guest View */}
                <div className={styles.addGuestHeader}>
                  <h2>{selectedGuest ? 'Existing guest' : 'New guest'}</h2>
                </div>

                <div className={styles.addGuestForm}>
                  {!selectedGuest ? (
                    <>
                      {/* New Guest Form */}
                      <div className={styles.formField}>
                        <label>Name:</label>
                        <input
                          type="text"
                          value={guestSearchTerm}
                          onChange={(e) => handleGuestSearch(e.target.value)}
                          placeholder="Type guest name..."
                          className={styles.guestNameInput}
                          autoFocus
                        />
                                                 {/* Show matching guests */}
                         {guestSearchTerm.length > 0 && !selectedGuest && (
                           <div className={styles.guestSuggestions}>
                             {allUserGuests.length === 0 ? (
                               <div className={styles.noSuggestions}>
                                 Loading existing guests...
                               </div>
                             ) : (() => {
                               console.log('=== SEARCH DEBUG ===')
                               console.log('Search term:', guestSearchTerm)
                               console.log('All user guests:', allUserGuests)
                               console.log('Party guests:', partyGuests)
                               
                               const filteredGuests = allUserGuests.filter(g => {
                                 const nameMatch = g.name.toLowerCase().includes(guestSearchTerm.toLowerCase())
                                 const notInParty = !partyGuests.find(pg => pg.guest_id === g.id)
                                 console.log(`Guest ${g.name}: nameMatch=${nameMatch}, notInParty=${notInParty}`)
                                 return nameMatch && notInParty
                               })
                               
                               console.log('Filtered guests:', filteredGuests)
                               console.log('=== END SEARCH DEBUG ===')
                               
                               if (filteredGuests.length > 0) {
                                 return filteredGuests.slice(0, 5).map(guest => (
                                   <div 
                                     key={guest.id}
                                     className={styles.guestSuggestion}
                                     onClick={() => {
                                       console.log('Selected existing guest from dropdown:', guest)
                                       setSelectedGuest(guest)
                                       setGuestSearchTerm(guest.name)
                                       setSelectedRelationships([]) // Reset relationships for existing guest
                                     }}
                                   >
                                     {guest.name}
                                   </div>
                                 ))
                               } else {
                                 return (
                                   <div className={styles.noSuggestions}>
                                     No existing guests found. This will create a new guest.
                                   </div>
                                 )
                               }
                             })()}
                           </div>
                         )}
                      </div>

                      <div className={styles.formField}>
                        <label>Gender:</label>
                                                 <select 
                           value={newGuestGender} 
                           onChange={(e) => setNewGuestGender(e.target.value as 'man' | 'woman' | 'nonbinary')}
                           className={styles.genderSelect}
                         >
                           <option value="man">Male</option>
                           <option value="woman">Female</option>
                           <option value="nonbinary">Non-binary</option>
                         </select>
                      </div>

                                             <div className={styles.formField}>
                         <label>Family/SO:</label>
                         <div className={styles.relationshipSelector}>
                           <p>Select all that apply</p>
                           {getAvailableRelationships().map(guest => (
                             <div 
                               key={guest.id} 
                               className={styles.relationshipOption}
                               onClick={() => {
                                 console.log('New guest relationship clicked:', guest.name, 'Guest ID:', guest.id)
                                 const isSelected = selectedRelationships.includes(guest.id)
                                 console.log('Currently selected relationships:', selectedRelationships)
                                 console.log('Is this guest selected?', isSelected)
                                 
                                 if (isSelected) {
                                   const newRelationships = selectedRelationships.filter(id => id !== guest.id)
                                   console.log('Removing relationship. New list:', newRelationships)
                                   setSelectedRelationships(newRelationships)
                                 } else {
                                   const newRelationships = [...selectedRelationships, guest.id]
                                   console.log('Adding relationship. New list:', newRelationships)
                                   setSelectedRelationships(newRelationships)
                                 }
                               }}
                             >
                               <Image 
                                 src={selectedRelationships.includes(guest.id) ? "/assets/square-full.svg" : "/assets/square.svg"} 
                                 alt={selectedRelationships.includes(guest.id) ? "Selected" : "Not selected"} 
                                 width={16} 
                                 height={16} 
                                 className={styles.checkboxIcon}
                               />
                               {guest.name}
                             </div>
                           ))}
                         </div>
                       </div>
                     </>
                   ) : (
                    <>
                      {/* Existing Guest Form */}
                      <div className={styles.existingGuestInfo}>
                        <p><strong>Name:</strong> {selectedGuest.name}</p>
                        <p><strong>Gender:</strong> 
                                                     <Image 
                             src={`/assets/${selectedGuest.gender === 'woman' ? 'user-female' : selectedGuest.gender === 'man' ? 'user-male' : 'user'}.svg`} 
                             alt={selectedGuest.gender} 
                             width={20} 
                             height={20} 
                           />
                        </p>
                      </div>

                                             <div className={styles.formField}>
                         <label>Family/SO:</label>
                         <div className={styles.relationshipSelector}>
                           <p>Select all that apply</p>
                           {getAvailableRelationships().map(guest => (
                             <div 
                               key={guest.id} 
                               className={styles.relationshipOption}
                               onClick={() => {
                                 console.log('Existing guest relationship clicked:', guest.name, 'Guest ID:', guest.id)
                                 const isSelected = selectedRelationships.includes(guest.id)
                                 console.log('Currently selected relationships:', selectedRelationships)
                                 console.log('Is this guest selected?', isSelected)
                                 
                                 if (isSelected) {
                                   const newRelationships = selectedRelationships.filter(id => id !== guest.id)
                                   console.log('Removing relationship. New list:', newRelationships)
                                   setSelectedRelationships(newRelationships)
                                 } else {
                                   const newRelationships = [...selectedRelationships, guest.id]
                                   console.log('Adding relationship. New list:', newRelationships)
                                   setSelectedRelationships(newRelationships)
                                 }
                               }}
                             >
                               <Image 
                                 src={selectedRelationships.includes(guest.id) ? "/assets/square-full.svg" : "/assets/square.svg"} 
                                 alt={selectedRelationships.includes(guest.id) ? "Selected" : "Not selected"} 
                                 width={16} 
                                 height={16} 
                                 className={styles.checkboxIcon}
                               />
                               {guest.name}
                             </div>
                           ))}
                         </div>
                       </div>
                     </>
                   )}
                 </div>

                <div className={styles.addGuestFooter}>
                  <button 
                    className={styles.backButton} 
                    onClick={() => setShowAddGuest(false)}
                  >
                    <Image src="/assets/arrow-square-left.svg" alt="Back" width={20} height={20} />
                    <span>back</span>
                  </button>
                  <button 
                    className={styles.saveButton}
                    onClick={selectedGuest ? addExistingGuest : addNewGuest}
                                         disabled={
                       isProcessing || 
                       (selectedGuest === null && !guestSearchTerm.trim()) ||
                       (selectedGuest !== null && !selectedGuest?.id)
                     }
                  >
                    <span>{isProcessing ? 'Saving...' : 'save'}</span>
                    <Image src="/assets/floppy.svg" alt="Save" width={20} height={20} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* New Meal Modal */}
      {showNewMealModal && (
        <div className={styles.modalOverlay} onClick={closeNewMealModal}>
          <div className={styles.newMealModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.newMealModalHeader}>
              <h2>
                New Meal
                <Image 
                  src="/assets/cutlery.svg" 
                  alt="Cutlery" 
                  width={24} 
                  height={24}
                  className={styles.cutleryIcon}
                />
              </h2>
              <button className={styles.closeButton} onClick={closeNewMealModal}>
                ✕
              </button>
            </div>

            <div className={styles.newMealModalContent}>
              {/* Party Name */}
              <div className={styles.modalPartyName}>{party?.name}</div>

              {/* Meal Name Input */}
              <div className={styles.mealNameSection}>
                <label className={styles.modalLabel}>Name:</label>
                <div className={styles.inputContainer}>
                  <input
                    type="text"
                    value={newMealName}
                    onChange={(e) => setNewMealName(e.target.value)}
                    className={styles.mealNameInput}
                    placeholder="Enter meal name"
                  />
                  <Image 
                    src="/assets/text-entry-1.svg" 
                    alt="Edit" 
                    width={20} 
                    height={20}
                    className={styles.editIcon}
                  />
                </div>
              </div>

              {/* Guest Selection */}
              <div className={styles.guestSelectionSection}>
                <label className={styles.modalLabel}>Who's coming?</label>
                <div className={styles.guestSelectionContainer}>
                  <div className={styles.selectionHeader}>
                    <span>Select all that apply</span>
                    <div className={styles.selectAllControls}>
                      <button 
                        className={styles.selectAllButton}
                        onClick={selectAllMealGuests}
                        type="button"
                      >
                        select all
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.guestList}>
                    {partyGuests.map((partyGuest) => (
                      <div 
                        key={partyGuest.guest_id} 
                        className={styles.guestItem}
                        onClick={() => toggleMealGuestSelection(partyGuest.guest_id)}
                      >
                        <div className={styles.checkboxContainer}>
                          <Image 
                            src={selectedMealGuests.includes(partyGuest.guest_id) ? "/assets/square-full.svg" : "/assets/square.svg"} 
                            alt={selectedMealGuests.includes(partyGuest.guest_id) ? "Selected" : "Not selected"} 
                            width={16} 
                            height={16} 
                            className={styles.checkbox}
                          />
                        </div>
                        <span className={styles.guestName}>{partyGuest.guests.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={styles.newMealModalFooter}>
                <button className={styles.modalCancelButton} onClick={closeNewMealModal}>
                  cancel
                </button>
                <button 
                  className={styles.modalCreateButton}
                  onClick={handleCreateMeal}
                  disabled={isCreatingMeal}
                >
                  {isCreatingMeal ? 'Creating...' : 'create placement'}
                  <Image src="/assets/arrow-square-right.svg" alt="Create" width={20} height={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Arrangement Modal */}
      {showViewModal && (
        <div className={styles.modalOverlay} onClick={closeViewModal}>
          <div className={styles.viewArrangementModal} onClick={(e) => e.stopPropagation()}>
            {loadingArrangement ? (
              <div className={styles.loadingArrangement}>
                <div>Loading seating arrangement...</div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className={styles.viewModalHeader}>
                  <div className={styles.viewModalTitle}>
                    <h2>{viewingMeal?.name}</h2>
                    <div className={styles.viewModalSubtitle}>{party?.name}</div>
                  </div>
                  <button className={styles.closeButton} onClick={closeViewModal}>
                    ✕
                  </button>
                </div>

                {/* Seating Display */}
                <div className={styles.viewSeatingArea}>
                  {/* Table */}
                  <div 
                    className={styles.viewTable}
                    style={{
                      width: (() => {
                        const guestCount = viewArrangement.length
                        if (guestCount <= 4) return '50%'
                        else if (guestCount <= 6) return '60%'
                        else if (guestCount <= 8) return '70%'
                        else return '75%'
                      })(),
                      height: (() => {
                        const guestCount = viewArrangement.length
                        if (guestCount <= 4) return '35%'
                        else if (guestCount <= 6) return '40%'
                        else if (guestCount <= 8) return '45%'
                        else return '50%'
                      })()
                    }}
                  ></div>

                  {/* Guest Names */}
                  {viewArrangement.map((item, index) => {
                    const totalGuests = viewArrangement.length
                    let position = { top: '50%', left: '50%' }

                    // Calculate position based on the same logic as placement page
                    if (totalGuests <= 2) {
                      const headPositions = totalGuests === 1 
                        ? [{ top: '50%', left: '50%' }]
                        : [{ top: '50%', left: '3%' }, { top: '50%', left: '97%' }]
                      position = headPositions[index] || { top: '50%', left: '50%' }
                    } else if (totalGuests <= 4) {
                      const sidePositions = [
                        { top: '50%', left: '3%' },
                        { top: '12%', left: '50%' },
                        { top: '50%', left: '97%' },
                        { top: '88%', left: '50%' }
                      ]
                      position = sidePositions[index] || { top: '50%', left: '50%' }
                    } else {
                      // More complex positioning for 5+ guests (same logic as placement page)
                      const positions = []
                      let guestIndex = 0
                      
                      let topCount, rightCount, bottomCount, leftCount
                      
                      if (totalGuests <= 6) {
                        leftCount = 1
                        rightCount = 1
                        const sideGuests = totalGuests - 2
                        topCount = Math.ceil(sideGuests / 2)
                        bottomCount = sideGuests - topCount
                      } else {
                        const remainingGuests = totalGuests - 2
                        const guestsPerSide = Math.floor(remainingGuests / 2)
                        
                        leftCount = 1
                        rightCount = 1
                        topCount = guestsPerSide + (remainingGuests % 2)
                        bottomCount = guestsPerSide
                        
                        if (topCount > 4 || bottomCount > 4) {
                          leftCount = Math.min(2, Math.floor(totalGuests / 4))
                          rightCount = Math.min(2, Math.floor(totalGuests / 4))
                          const newRemaining = totalGuests - leftCount - rightCount
                          topCount = Math.ceil(newRemaining / 2)
                          bottomCount = newRemaining - topCount
                        }
                      }

                      // Left side
                      for (let i = 0; i < leftCount && guestIndex < totalGuests; i++) {
                        const topPos = leftCount === 1 ? '50%' : `${40 + (i * 20)}%`
                        positions.push({ top: topPos, left: '3%' })
                        guestIndex++
                      }

                      // Top side
                      for (let i = 0; i < topCount && guestIndex < totalGuests; i++) {
                        const leftPos = topCount === 1 ? '50%' : `${25 + (i * (50 / Math.max(1, topCount - 1)))}%`
                        positions.push({ top: '12%', left: leftPos })
                        guestIndex++
                      }

                      // Right side
                      for (let i = 0; i < rightCount && guestIndex < totalGuests; i++) {
                        const topPos = rightCount === 1 ? '50%' : `${60 - (i * 20)}%`
                        positions.push({ top: topPos, left: '97%' })
                        guestIndex++
                      }

                      // Bottom side
                      for (let i = 0; i < bottomCount && guestIndex < totalGuests; i++) {
                        const leftPos = bottomCount === 1 ? '50%' : `${75 - (i * (50 / Math.max(1, bottomCount - 1)))}%`
                        positions.push({ top: '88%', left: leftPos })
                        guestIndex++
                      }

                      position = positions[index] || { top: '50%', left: '50%' }
                    }

                    return (
                      <div
                        key={`${item.guest.id}-${index}`}
                        className={styles.viewGuestName}
                        style={{
                          position: 'absolute',
                          top: position.top,
                          left: position.left,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {item.guest.name}
                      </div>
                    )
                  })}
                </div>

                {/* Footer */}
                <div className={styles.viewModalFooter}>
                  <div className={styles.guestCountDisplay}>
                    <Image src="/assets/user.svg" alt="Guests" width={20} height={20} />
                    <span>{viewArrangement.length} guests</span>
                  </div>
                  <button className={styles.viewModalCloseButton} onClick={closeViewModal}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* New Event Modal */}
      {showNewEventModal && (
        <div className={styles.modalOverlay} onClick={closeNewEventModal}>
          <div className={styles.newEventModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.newEventModalHeader}>
              <h2>
                New Event
                <Image 
                  src="/assets/trophy.svg" 
                  alt="Trophy" 
                  width={24} 
                  height={24}
                  className={styles.trophyIcon}
                />
              </h2>
              <button className={styles.closeButton} onClick={closeNewEventModal}>
                ✕
              </button>
            </div>

            <div className={styles.newEventModalContent}>
              {/* Party Name */}
              <div className={styles.modalPartyName}>{party?.name}</div>

              {/* Event Name Input */}
              <div className={styles.eventNameSection}>
                <label className={styles.modalLabel}>Name:</label>
                <div className={styles.inputContainer}>
                  <input
                    type="text"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    className={styles.eventNameInput}
                    placeholder="Enter event name"
                  />
                  <Image 
                    src="/assets/text-entry-1.svg" 
                    alt="Edit" 
                    width={20} 
                    height={20}
                    className={styles.editIcon}
                  />
                </div>
              </div>

              {/* Guest Selection */}
              <div className={styles.guestSelectionSection}>
                <label className={styles.modalLabel}>Who's coming?</label>
                <div className={styles.guestSelectionContainer}>
                  <div className={styles.selectionHeader}>
                    <span>Select all that apply</span>
                    <div className={styles.selectAllControls}>
                      <button 
                        className={styles.selectAllButton}
                        onClick={selectAllEventGuests}
                        type="button"
                      >
                        select all
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.guestList}>
                    {partyGuests.map((partyGuest) => (
                      <div 
                        key={partyGuest.guest_id} 
                        className={styles.guestItem}
                        onClick={() => toggleEventGuestSelection(partyGuest.guest_id)}
                      >
                        <div className={styles.checkboxContainer}>
                          <Image 
                            src={selectedEventGuests.includes(partyGuest.guest_id) ? "/assets/square-full.svg" : "/assets/square.svg"} 
                            alt={selectedEventGuests.includes(partyGuest.guest_id) ? "Selected" : "Not selected"} 
                            width={16} 
                            height={16} 
                            className={styles.checkbox}
                          />
                        </div>
                        <span className={styles.guestName}>{partyGuest.guests.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Team Configuration */}
              <div className={styles.teamConfigSection}>
                <div className={styles.teamConfigText}>
                  I want to make{' '}
                  <select 
                    value={numberOfTeams}
                    onChange={(e) => setNumberOfTeams(parseInt(e.target.value))}
                    className={styles.teamSelect}
                    disabled={selectedEventGuests.length === 0}
                  >
                    {Array.from({ length: Math.max(1, selectedEventGuests.length) }, (_, i) => i + 2).map(num => (
                      <option key={num} value={num}>{toWords(num)}</option>
                    ))}
                  </select>
                  {' teams of '}
                  <span className={styles.teamSizeText}>
                    {selectedEventGuests.length > 0 ? (
                      (() => {
                        const config = calculateTeamConfiguration()
                        if (config.minSize === config.maxSize) {
                          return toWords(config.minSize)
                        } else {
                          return `${toWords(config.minSize)}/${toWords(config.maxSize)}`
                        }
                      })()
                    ) : (
                      '–'
                    )}
                  </span>
                  .
                </div>
              </div>

              {/* Fair Play Checkbox */}
              <div className={styles.fairPlaySection}>
                <div 
                  className={styles.fairPlayOption}
                  onClick={() => {
                    const newFairPlay = !fairPlay
                    setFairPlay(newFairPlay)
                    
                    // Initialize rankings with selected guests
                    if (newFairPlay && selectedEventGuests.length > 0) {
                      const selectedGuests = partyGuests
                        .filter(pg => selectedEventGuests.includes(pg.guest_id))
                        .map(pg => pg.guests)
                      setGuestRankings(selectedGuests)
                    } else {
                      setGuestRankings([])
                    }
                  }}
                >
                  <Image 
                    src={fairPlay ? "/assets/square-full.svg" : "/assets/square.svg"} 
                    alt={fairPlay ? "Fair play enabled" : "Fair play disabled"} 
                    width={16} 
                    height={16} 
                    className={styles.checkboxIcon}
                  />
                  <span className={styles.fairPlayLabel}>Fair play?</span>
                </div>
              </div>

              {/* Ranking Interface (only visible when fair play is checked) */}
              {fairPlay && selectedEventGuests.length > 0 && (
                <div className={styles.rankingSection}>
                  <label className={styles.modalLabel}>Rank participants</label>
                  <div className={styles.rankingContainer}>
                    <DragDropContext onDragEnd={handleDragEnd}>
                      <Droppable droppableId="rankings">
                        {(provided: DroppableProvided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={styles.rankingList}
                          >
                            {guestRankings.map((guest, index) => (
                              <Draggable key={guest.id} draggableId={guest.id} index={index}>
                                {(provided: DraggableProvided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={styles.rankingItem}
                                  >
                                    <span className={styles.rankNumber}>{index + 1}.</span>
                                    <span className={styles.rankGuestName}>{guest.name}</span>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className={styles.newEventModalFooter}>
                <button className={styles.modalCancelButton} onClick={closeNewEventModal}>
                  cancel
                </button>
                <button 
                  className={styles.modalCreateButton}
                  onClick={handleCreateEvent}
                  disabled={isCreatingEvent || selectedEventGuests.length === 0}
                >
                  {isCreatingEvent ? 'Creating...' : 'create placement'}
                  <Image src="/assets/arrow-square-right.svg" alt="Create" width={20} height={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Teams Modal */}
      {showViewTeamsModal && (
        <div className={styles.modalOverlay} onClick={closeViewTeamsModal}>
          <div className={styles.viewTeamsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.viewModalHeader}>
              <div className={styles.viewModalTitle}>
                <h2>{viewingEvent?.name}</h2>
                <div className={styles.viewModalSubtitle}>{party?.name}</div>
              </div>
              <button className={styles.closeButton} onClick={closeViewTeamsModal}>
                ✕
              </button>
            </div>

            {/* Teams Display */}
            <div className={styles.viewTeamsArea}>
              {Object.entries(viewTeams).map(([teamNumber, team]) => (
                <div key={teamNumber} className={styles.viewTeamContainer}>
                  <div className={styles.viewTeamHeader}>
                    <h3 className={styles.viewTeamName}>Team {team.name}</h3>
                  </div>
                  <div className={styles.viewTeamMembers}>
                    {team.members.map((member, index) => (
                      <div key={member.id} className={styles.viewTeamMember}>
                        {member.name}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className={styles.viewModalFooter}>
              <div className={styles.guestCountDisplay}>
                <Image src="/assets/user.svg" alt="Guests" width={20} height={20} />
                <span>{Object.values(viewTeams).reduce((total, team) => total + team.members.length, 0)} guests</span>
              </div>
              <button className={styles.viewModalCloseButton} onClick={closeViewTeamsModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
} 