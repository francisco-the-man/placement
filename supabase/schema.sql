-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE gender_type AS ENUM ('man', 'woman', 'nonbinary');
CREATE TYPE party_item_type AS ENUM ('meal', 'event');

-- User profiles table
CREATE TABLE user_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parties table
CREATE TABLE parties (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Guests table
CREATE TABLE guests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  gender gender_type NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Party guests (many-to-many relationship)
CREATE TABLE party_guests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(party_id, guest_id)
);

-- Guest relationships (family/SO - reciprocal)
CREATE TABLE guest_relationships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guest_1_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  guest_2_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL DEFAULT 'family_or_so',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guest_1_id, guest_2_id),
  CHECK (guest_1_id != guest_2_id)
);

-- Party items (meals and events)
CREATE TABLE party_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type party_item_type NOT NULL,
  description TEXT,
  fair_play BOOLEAN DEFAULT FALSE, -- for events only
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seating arrangements (for meals)
CREATE TABLE seating_arrangements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  party_item_id UUID REFERENCES party_items(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  is_generated BOOLEAN DEFAULT TRUE, -- false if manually adjusted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(party_item_id, guest_id),
  UNIQUE(party_item_id, position)
);

-- Team assignments (for events)
CREATE TABLE team_assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  party_item_id UUID REFERENCES party_items(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL,
  ability_rating INTEGER, -- for fair play events
  is_generated BOOLEAN DEFAULT TRUE, -- false if manually adjusted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(party_item_id, guest_id),
  CHECK (team_number > 0),
  CHECK (ability_rating IS NULL OR (ability_rating >= 1 AND ability_rating <= 10))
);

-- Function to automatically create reciprocal relationships
CREATE OR REPLACE FUNCTION create_reciprocal_relationship()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the reciprocal relationship if it doesn't exist
  INSERT INTO guest_relationships (guest_1_id, guest_2_id, relationship_type)
  VALUES (NEW.guest_2_id, NEW.guest_1_id, NEW.relationship_type)
  ON CONFLICT (guest_1_id, guest_2_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for reciprocal relationships
CREATE TRIGGER trigger_reciprocal_relationship
  AFTER INSERT ON guest_relationships
  FOR EACH ROW
  EXECUTE FUNCTION create_reciprocal_relationship();

-- Function to prevent duplicate relationships (A->B and B->A)
CREATE OR REPLACE FUNCTION prevent_duplicate_relationships()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the reverse relationship already exists
  IF EXISTS (
    SELECT 1 FROM guest_relationships 
    WHERE guest_1_id = NEW.guest_2_id 
    AND guest_2_id = NEW.guest_1_id
  ) THEN
    RAISE EXCEPTION 'Relationship already exists between these guests';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent duplicates
CREATE TRIGGER trigger_prevent_duplicate_relationships
  BEFORE INSERT ON guest_relationships
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_relationships();

-- RLS (Row Level Security) policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_arrangements ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_assignments ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Parties policies
CREATE POLICY "Users can view their own parties" ON parties
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own parties" ON parties
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own parties" ON parties
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own parties" ON parties
  FOR DELETE USING (auth.uid() = user_id);

-- Guests policies
CREATE POLICY "Users can view their own guests" ON guests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own guests" ON guests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own guests" ON guests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own guests" ON guests
  FOR DELETE USING (auth.uid() = user_id);

-- Party guests policies
CREATE POLICY "Users can view party guests for their parties" ON party_guests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parties 
      WHERE parties.id = party_guests.party_id 
      AND parties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage party guests for their parties" ON party_guests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM parties 
      WHERE parties.id = party_guests.party_id 
      AND parties.user_id = auth.uid()
    )
  );

-- Guest relationships policies
CREATE POLICY "Users can view relationships for their guests" ON guest_relationships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guests 
      WHERE guests.id = guest_relationships.guest_1_id 
      AND guests.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage relationships for their guests" ON guest_relationships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM guests 
      WHERE guests.id = guest_relationships.guest_1_id 
      AND guests.user_id = auth.uid()
    )
  );

-- Party items policies
CREATE POLICY "Users can view items for their parties" ON party_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parties 
      WHERE parties.id = party_items.party_id 
      AND parties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage items for their parties" ON party_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM parties 
      WHERE parties.id = party_items.party_id 
      AND parties.user_id = auth.uid()
    )
  );

-- Seating arrangements policies
CREATE POLICY "Users can view arrangements for their party items" ON seating_arrangements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM party_items 
      JOIN parties ON parties.id = party_items.party_id
      WHERE party_items.id = seating_arrangements.party_item_id 
      AND parties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage arrangements for their party items" ON seating_arrangements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM party_items 
      JOIN parties ON parties.id = party_items.party_id
      WHERE party_items.id = seating_arrangements.party_item_id 
      AND parties.user_id = auth.uid()
    )
  );

-- Team assignments policies
CREATE POLICY "Users can view team assignments for their party items" ON team_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM party_items 
      JOIN parties ON parties.id = party_items.party_id
      WHERE party_items.id = team_assignments.party_item_id 
      AND parties.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage team assignments for their party items" ON team_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM party_items 
      JOIN parties ON parties.id = party_items.party_id
      WHERE party_items.id = team_assignments.party_item_id 
      AND parties.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_parties_user_id ON parties(user_id);
CREATE INDEX idx_guests_user_id ON guests(user_id);
CREATE INDEX idx_party_guests_party_id ON party_guests(party_id);
CREATE INDEX idx_party_guests_guest_id ON party_guests(guest_id);
CREATE INDEX idx_guest_relationships_guest_1 ON guest_relationships(guest_1_id);
CREATE INDEX idx_guest_relationships_guest_2 ON guest_relationships(guest_2_id);
CREATE INDEX idx_party_items_party_id ON party_items(party_id);
CREATE INDEX idx_seating_arrangements_party_item_id ON seating_arrangements(party_item_id);
CREATE INDEX idx_team_assignments_party_item_id ON team_assignments(party_item_id); 