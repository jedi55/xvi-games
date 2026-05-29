-- ═══════════════════════════════════════════════════════
-- THE SOVEREIGN CUE — Database Schema
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. PROFILES (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_member BOOLEAN DEFAULT false,
  membership_plan TEXT,
  membership_start TIMESTAMPTZ,
  membership_expires TIMESTAMPTZ,
  membership_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. TABLES (snooker tables)
CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRICING
CREATE TABLE IF NOT EXISTS pricing (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('hourly', 'per_game')),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RESERVATIONS
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  booking_type TEXT NOT NULL CHECK (booking_type IN ('time', 'games')),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  num_games INTEGER,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  reference_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate reference codes
CREATE OR REPLACE FUNCTION generate_reference_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.reference_code := 'SC-' || LPAD(NEW.id::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_reference_code ON reservations;
CREATE TRIGGER set_reference_code
  BEFORE INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION generate_reference_code();

-- 5. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  paystack_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own; admins can read all
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Tables: everyone can read; admins can update
CREATE POLICY "Anyone can view tables" ON tables FOR SELECT USING (true);
CREATE POLICY "Admins can manage tables" ON tables FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Pricing: everyone can read; admins can update
CREATE POLICY "Anyone can view pricing" ON pricing FOR SELECT USING (true);
CREATE POLICY "Admins can manage pricing" ON pricing FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Reservations: users see their own; admins see all
CREATE POLICY "Users can view own reservations" ON reservations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create reservations" ON reservations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all reservations" ON reservations FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can manage reservations" ON reservations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Payments: users see their own; admins see all
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create payments" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all payments" ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ═══════════════════════════════════════════════════════
-- AVAILABILITY CHECK FUNCTION (prevents double booking)
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_table_availability(
  p_table_id INTEGER,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_reservation_id INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM reservations
    WHERE table_id = p_table_id
      AND date = p_date
      AND status IN ('pending', 'confirmed')
      AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
      AND (
        (start_time < p_end_time AND end_time > p_start_time)
      )
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════

INSERT INTO tables (name, description, status) VALUES
  ('Table 1', 'Premium full-size snooker table with tournament-grade cloth', 'available'),
  ('Table 2', 'Professional snooker table ideal for competitive play', 'available'),
  ('Table 3', 'Standard snooker table perfect for casual games', 'available')
ON CONFLICT DO NOTHING;

INSERT INTO pricing (type, amount, currency, label) VALUES
  ('hourly', 2000, 'NGN', '1 Hour Session'),
  ('hourly', 3500, 'NGN', '2 Hour Session'),
  ('hourly', 5000, 'NGN', '3 Hour Session'),
  ('per_game', 1500, 'NGN', 'Single Game'),
  ('per_game', 2500, 'NGN', '2 Games'),
  ('per_game', 3500, 'NGN', '3 Games')
ON CONFLICT DO NOTHING;
