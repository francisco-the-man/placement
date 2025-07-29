-- Add relationships column to guests table
-- This will store an array of guest IDs that this guest is related to (family/SO)

ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS relationships JSONB DEFAULT '[]'::jsonb;

-- Create an index on the relationships column for better performance
CREATE INDEX IF NOT EXISTS idx_guests_relationships ON guests USING GIN (relationships);

-- Add a comment explaining the column
COMMENT ON COLUMN guests.relationships IS 'Array of guest IDs that this guest is related to (family/significant others)';

-- Example of how the data will look:
-- relationships: ["guest-id-1", "guest-id-2", "guest-id-3"] 