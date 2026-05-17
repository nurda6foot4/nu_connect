-- NU Connect — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL,
  user_id UUID,                          -- null until onboarding complete
  email_hash TEXT,                       -- SHA-256 of nu.edu.kz email
  email_verified_at TIMESTAMPTZ,
  selfie_verified_at TIMESTAMPTZ,
  otp_code TEXT,                         -- 6-digit OTP (cleared after verify)
  otp_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  nu_email_hash TEXT UNIQUE NOT NULL,
  email_verified_at TIMESTAMPTZ NOT NULL,
  selfie_verified_at TIMESTAMPTZ NOT NULL,
  age INT NOT NULL CHECK (age >= 18 AND age <= 100),
  gender TEXT NOT NULL CHECK (gender IN ('male','female','other')),
  height_cm INT NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
  weight_kg_min INT NOT NULL CHECK (weight_kg_min BETWEEN 30 AND 300),
  weight_kg_max INT NOT NULL CHECK (weight_kg_max BETWEEN 30 AND 300),
  intent TEXT NOT NULL CHECK (intent IN ('fwb','one_time','ongoing','talk_first')),
  interested_in TEXT NOT NULL CHECK (interested_in IN ('men','women','both')),
  age_pref_min INT NOT NULL CHECK (age_pref_min >= 18),
  age_pref_max INT NOT NULL CHECK (age_pref_max >= 18),
  photo_path TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK after users table exists
ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS swipes (
  swiper_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  swiped_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  liked BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (swiper_id, swiped_id)
);

-- Matches: user_a < user_b (lexicographic) to prevent duplicates
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_a, user_b),
  CHECK (user_a::text < user_b::text)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sessions_telegram ON sessions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_swipes_swiped ON swipes(swiped_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_b ON matches(user_b);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

-- ============================================================
-- ATOMIC SWIPE + MATCH FUNCTION
-- Called via supabase.rpc('process_swipe', {...})
-- Runs inside a transaction — no race condition possible
-- ============================================================

CREATE OR REPLACE FUNCTION process_swipe(
  p_swiper_id UUID,
  p_swiped_id UUID,
  p_liked BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_match_id UUID;
  v_is_match BOOLEAN := FALSE;
  v_a UUID;
  v_b UUID;
BEGIN
  -- Upsert swipe record
  INSERT INTO swipes (swiper_id, swiped_id, liked)
  VALUES (p_swiper_id, p_swiped_id, p_liked)
  ON CONFLICT (swiper_id, swiped_id)
  DO UPDATE SET liked = EXCLUDED.liked;

  -- Only check for match if this is a like
  IF p_liked THEN
    -- Check if the other person already liked us
    IF EXISTS (
      SELECT 1 FROM swipes
      WHERE swiper_id = p_swiped_id
        AND swiped_id = p_swiper_id
        AND liked = TRUE
    ) THEN
      -- Also check neither blocked the other
      IF NOT EXISTS (
        SELECT 1 FROM blocks
        WHERE (blocker_id = p_swiper_id AND blocked_id = p_swiped_id)
           OR (blocker_id = p_swiped_id AND blocked_id = p_swiper_id)
      ) THEN
        -- Normalize: smaller UUID text first
        IF p_swiper_id::text < p_swiped_id::text THEN
          v_a := p_swiper_id;
          v_b := p_swiped_id;
        ELSE
          v_a := p_swiped_id;
          v_b := p_swiper_id;
        END IF;

        INSERT INTO matches (user_a, user_b)
        VALUES (v_a, v_b)
        ON CONFLICT (user_a, user_b) DO NOTHING
        RETURNING id INTO v_match_id;

        IF v_match_id IS NOT NULL THEN
          v_is_match := TRUE;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN json_build_object(
    'match', v_is_match,
    'match_id', v_match_id
  );
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- All tables protected — Edge Functions use service role key
-- which bypasses RLS. Direct Supabase client calls from
-- frontend are blocked (no anon access to any table).
-- ============================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Block ALL direct anon/authenticated access
-- (Edge Functions use service_role key which bypasses RLS)
CREATE POLICY "deny all anon sessions" ON sessions FOR ALL TO anon USING (false);
CREATE POLICY "deny all anon users" ON users FOR ALL TO anon USING (false);
CREATE POLICY "deny all anon swipes" ON swipes FOR ALL TO anon USING (false);
CREATE POLICY "deny all anon matches" ON matches FOR ALL TO anon USING (false);
CREATE POLICY "deny all anon blocks" ON blocks FOR ALL TO anon USING (false);
CREATE POLICY "deny all anon reports" ON reports FOR ALL TO anon USING (false);

CREATE POLICY "deny all auth sessions" ON sessions FOR ALL TO authenticated USING (false);
CREATE POLICY "deny all auth users" ON users FOR ALL TO authenticated USING (false);
CREATE POLICY "deny all auth swipes" ON swipes FOR ALL TO authenticated USING (false);
CREATE POLICY "deny all auth matches" ON matches FOR ALL TO authenticated USING (false);
CREATE POLICY "deny all auth blocks" ON blocks FOR ALL TO authenticated USING (false);
CREATE POLICY "deny all auth reports" ON reports FOR ALL TO authenticated USING (false);
