/*
  # Add Cloudflare Stream fields to live_auction_sessions

  ## Changes
  - Adds `cf_stream_uid` - The Cloudflare Stream live input UID used for the current session's stream
  - Adds `cf_stream_whip_url` - The WHIP endpoint URL for the auctioneer to publish video
  - Adds `cf_stream_playback_url` - The HLS/WHEP playback URL for viewers
  - Adds `cf_stream_status` - Current stream status from Cloudflare (idle, connected, disconnected)

  ## Notes
  - These fields are nullable — stream is optional per session
  - cf_stream_uid is the Cloudflare "live input" ID, not a video ID
  - WHIP URL is used by OBS or browser-based publisher
  - Playback URL is used by the audience viewer page
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'cf_stream_uid'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN cf_stream_uid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'cf_stream_whip_url'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN cf_stream_whip_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'cf_stream_playback_url'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN cf_stream_playback_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'live_auction_sessions' AND column_name = 'cf_stream_status'
  ) THEN
    ALTER TABLE live_auction_sessions ADD COLUMN cf_stream_status text DEFAULT 'idle';
  END IF;
END $$;
