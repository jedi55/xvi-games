import { supabase } from './supabase.js';

// ═══════════════════════════════════════
// TABLES
// ═══════════════════════════════════════

export async function getTables() {
  const { data, error } = await supabase
    .from('snooker_tables')
    .select('*')
    .order('id');
  if (error) throw error;
  return data;
}

export async function getTableById(id) {
  const { data, error } = await supabase
    .from('snooker_tables')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateTableStatus(id, status) {
  const { data, error } = await supabase
    .from('snooker_tables')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════
// PRICING
// ═══════════════════════════════════════

export async function getPricing() {
  const { data, error } = await supabase
    .from('pricing')
    .select('*')
    .order('type, amount');
  if (error) throw error;
  return data;
}

export async function updatePricing(id, updates) {
  const { data, error } = await supabase
    .from('pricing')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════
// RESERVATIONS
// ═══════════════════════════════════════

export async function createReservation(reservation) {
  const { data, error } = await supabase
    .from('reservations')
    .insert(reservation)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getReservation(id) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, snooker_tables(name), profiles(full_name, phone)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getUserReservations(userId) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, snooker_tables(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAllReservations(filters = {}) {
  let query = supabase
    .from('reservations')
    .select('*, snooker_tables(name), profiles(full_name, phone, is_member, membership_plan)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.date) query = query.eq('date', filters.date);
  if (filters.table_id) query = query.eq('table_id', filters.table_id);
  if (filters.members_only) query = query.eq('profiles.is_member', true);
  if (filters.search) {
    query = query.or(`reference_code.ilike.%${filters.search}%,profiles.full_name.ilike.%${filters.search}%`);
  }

  // Pagination
  const page = filters.page || 1;
  const perPage = filters.perPage || 10;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function updateReservationStatus(id, status) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════
// AVAILABILITY CHECK
// ═══════════════════════════════════════

export async function checkAvailability(tableId, date, startTime, endTime) {
  const { data, error } = await supabase
    .rpc('check_table_availability', {
      p_table_id: tableId,
      p_date: date,
      p_start_time: startTime,
      p_end_time: endTime
    });
  if (error) throw error;
  return data;
}

export async function getTableReservationsForDate(tableId, date) {
  const { data, error } = await supabase
    .from('reservations')
    .select('start_time, end_time, status')
    .eq('table_id', tableId)
    .eq('date', date)
    .in('status', ['pending', 'confirmed'])
    .order('start_time');
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════

export async function createPayment(payment) {
  const { data, error } = await supabase
    .from('payments')
    .insert(payment)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePaymentStatus(id, status, paystackRef) {
  const updates = {
    status,
    paystack_reference: paystackRef
  };
  if (status === 'success') updates.paid_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAllPayments(filters = {}) {
  let query = supabase
    .from('payments')
    .select('*, reservations(reference_code, tables(name)), profiles(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);

  const page = filters.page || 1;
  const perPage = filters.perPage || 10;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

// ═══════════════════════════════════════
// ADMIN STATS
// ═══════════════════════════════════════

export async function getAdminStats() {
  const today = new Date().toISOString().split('T')[0];

  const [reservationsToday, revenueToday, allTables] = await Promise.all([
    supabase.from('reservations').select('id', { count: 'exact' }).eq('date', today),
    supabase.from('payments').select('amount').eq('status', 'success').gte('paid_at', today + 'T00:00:00'),
    supabase.from('snooker_tables').select('status')
  ]);

  const totalBookings = reservationsToday.count || 0;
  const revenue = (revenueToday.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const tables = allTables.data || [];
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;
  const occupancy = tables.length > 0 ? Math.round((occupiedCount / tables.length) * 100) : 0;

  return {
    totalBookings,
    revenue,
    occupancy,
    totalTables: tables.length,
    occupiedCount
  };
}
