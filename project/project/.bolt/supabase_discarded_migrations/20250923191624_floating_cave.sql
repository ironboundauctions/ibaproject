/*
  # Add Auction Event Fields

  1. New Columns
    - `auction_type` (text) - 'live' or 'timed'
    - `registration_start` (timestamptz) - When registration opens
    - `event_terms` (text) - Terms and conditions
    - `main_image_url` (text) - Main event image
    - `buyers_premium` (numeric) - Buyers premium percentage
    - `cc_card_fees` (numeric) - Credit card processing fees percentage

  2. Updates
    - Add constraints for auction_type
    - Set default values where appropriate
*/

-- Add new columns to auctions table
DO $$
BEGIN
  -- Add auction_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auctions' AND column_name = 'auction_type'
  ) THEN
    ALTER TABLE auctions ADD COLUMN auction_type text DEFAULT 'live';
  END IF;

  -- Add registration_start column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auctions' AND column_name = 'registration_start'
  ) THEN
    ALTER TABLE auctions ADD COLUMN registration_start timestamptz;
  END IF;

  -- Add event_terms column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auctions' AND column_name = 'event_terms'
  ) THEN
    ALTER TABLE auctions ADD COLUMN event_terms text;
  END IF;

  -- Add main_image_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auctions' AND column_name = 'main_image_url'
  ) THEN
    ALTER TABLE auctions ADD COLUMN main_image_url text;
  END IF;

  -- Add buyers_premium column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auctions' AND column_name = 'buyers_premium'
  ) THEN
    ALTER TABLE auctions ADD COLUMN buyers_premium numeric(5,2) DEFAULT 10.00;
  END IF;

  -- Add cc_card_fees column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auctions' AND column_name = 'cc_card_fees'
  ) THEN
    ALTER TABLE auctions ADD COLUMN cc_card_fees numeric(5,2) DEFAULT 3.00;
  END IF;
END $$;

-- Add constraint for auction_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'auctions_auction_type_check'
  ) THEN
    ALTER TABLE auctions ADD CONSTRAINT auctions_auction_type_check 
    CHECK (auction_type IN ('live', 'timed'));
  END IF;
END $$;

-- Add constraints for percentage fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'auctions_buyers_premium_check'
  ) THEN
    ALTER TABLE auctions ADD CONSTRAINT auctions_buyers_premium_check 
    CHECK (buyers_premium >= 0 AND buyers_premium <= 50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'auctions_cc_card_fees_check'
  ) THEN
    ALTER TABLE auctions ADD CONSTRAINT auctions_cc_card_fees_check 
    CHECK (cc_card_fees >= 0 AND cc_card_fees <= 10);
  END IF;
END $$;