export type Gender = 'man' | 'woman' | 'nonbinary'
export type PartyItemType = 'meal' | 'event'

export interface UserProfile {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Party {
  id: string
  name: string
  description?: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface Guest {
  id: string
  name: string
  gender: Gender
  user_id: string
  created_at: string
  updated_at: string
}

export interface PartyGuest {
  id: string
  party_id: string
  guest_id: string
  created_at: string
}

export interface GuestRelationship {
  id: string
  guest_1_id: string
  guest_2_id: string
  relationship_type: string
  created_at: string
}

export interface PartyItem {
  id: string
  party_id: string
  name: string
  type: PartyItemType
  description?: string
  fair_play: boolean
  created_at: string
  updated_at: string
}

export interface SeatingArrangement {
  id: string
  party_item_id: string
  guest_id: string
  position: number
  is_generated: boolean
  created_at: string
}

export interface TeamAssignment {
  id: string
  party_item_id: string
  guest_id: string
  team_number: number
  ability_rating?: number
  is_generated: boolean
  created_at: string
}

// Extended types with relations
export interface PartyWithGuests extends Party {
  party_guests: (PartyGuest & {
    guests: Guest
  })[]
}

export interface GuestWithRelationships extends Guest {
  relationships: (GuestRelationship & {
    related_guest: Guest
  })[]
}

export interface PartyItemWithArrangements extends PartyItem {
  seating_arrangements?: (SeatingArrangement & {
    guests: Guest
  })[]
  team_assignments?: (TeamAssignment & {
    guests: Guest
  })[]
} 