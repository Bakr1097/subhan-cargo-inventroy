'use server'

import { signIn, signOut, auth } from '@/auth'
import { AuthError } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { users, parcels, shift_closes } from '@/db/schema'
import { eq, and, gte, desc, ne } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function loginAction(
  prevState: { error: string },
  formData: FormData
) {
  try {
    await signIn('credentials', {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      redirectTo: '/',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Invalid email or password' }
    }
    throw error // re-throw redirect — Next.js needs this
  }
  return { error: '' }
}

export async function signupAction(
  prevState: { error: string; success: boolean },
  formData: FormData
) {
  const full_name = (formData.get('full_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!full_name || !email || !password || !confirmPassword) {
    return { error: 'All fields are required', success: false }
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match', success: false }
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters', success: false }
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email))
  if (existing) {
    return { error: 'An account with this email already exists', success: false }
  }

  const password_hash = await bcrypt.hash(password, 12)
  await db.insert(users).values({ full_name, email, password_hash, role: 'STAFF', status: 'PENDING' })

  return { error: '', success: true }
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' })
}

// ── Admin: Approve / Reject Staff ────────────────────────────────────────────

export async function approveUserAction(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return
  const user_id = formData.get('user_id') as string
  await db.update(users).set({ status: 'ACTIVE' }).where(eq(users.id, user_id))
  revalidatePath('/admin/approvals')
}

export async function rejectUserAction(formData: FormData) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return
  const user_id = formData.get('user_id') as string
  await db.delete(users).where(eq(users.id, user_id))
  revalidatePath('/admin/approvals')
}

// ── Receive Parcel ────────────────────────────────────────────────────────────

type ReceiveState = { error: string; success: boolean; ts?: number }

export async function receiveParcelAction(
  prevState: ReceiveState,
  formData: FormData
): Promise<ReceiveState> {
  const session = await auth()
  if (!session) return { error: 'Not authenticated', success: false }

  const bilty_number = (formData.get('bilty_number') as string)?.trim().toUpperCase()
  const description = (formData.get('description') as string)?.trim()
  const units = parseInt(formData.get('units') as string, 10)
  const payment_type = formData.get('payment_type') as string
  const amount_due_raw = (formData.get('amount_due') as string)?.trim()

  if (!bilty_number || !description || isNaN(units) || !payment_type) {
    return { error: 'All fields are required', success: false }
  }
  if (units < 1) {
    return { error: 'Units must be at least 1', success: false }
  }
  if (payment_type === 'TO_PAY' && !amount_due_raw) {
    return { error: 'Amount due is required for TO PAY parcels', success: false }
  }

  // Parse amount_due as a float so Drizzle/neon receives a JS number, not a raw string
  const amount_due = payment_type === 'TO_PAY' ? parseFloat(amount_due_raw) : null
  if (amount_due !== null && (isNaN(amount_due) || amount_due < 0)) {
    return { error: 'Amount due must be a valid positive number', success: false }
  }

  // Anti-duplicate: reject if this bilty is already IN_STORE
  const [existing] = await db
    .select({ id: parcels.id })
    .from(parcels)
    .where(and(eq(parcels.bilty_number, bilty_number), eq(parcels.status, 'IN_STORE')))

  if (existing) {
    return { error: `Bilty "${bilty_number}" is already in the storehouse`, success: false }
  }

  await db.insert(parcels).values({
    bilty_number,
    description,
    units,
    payment_type,
    amount_due: amount_due !== null ? String(amount_due) : null,
    status: 'IN_STORE',
    received_by: session.user.id,
    location_id: 'main',
  })

  return { error: '', success: true, ts: Date.now() }
}

// ── Release Parcel ────────────────────────────────────────────────────────────

export type FoundParcel = {
  id: string
  bilty_number: string
  description: string
  units: number
  payment_type: string
  amount_due: string | null
}

type LookupState = { error: string; parcel: FoundParcel | null }

export async function lookupParcelAction(
  prevState: LookupState,
  formData: FormData
): Promise<LookupState> {
  const session = await auth()
  if (!session) return { error: 'Not authenticated', parcel: null }

  const bilty_number = (formData.get('bilty_number') as string)?.trim().toUpperCase()
  if (!bilty_number) return { error: 'Please enter a bilty number', parcel: null }

  const rows = await db
    .select({
      id: parcels.id,
      bilty_number: parcels.bilty_number,
      description: parcels.description,
      units: parcels.units,
      payment_type: parcels.payment_type,
      amount_due: parcels.amount_due,
      status: parcels.status,
      voided: parcels.voided,
      released_at: parcels.released_at,
      released_by_name: users.full_name,
    })
    .from(parcels)
    .leftJoin(users, eq(parcels.released_by, users.id))
    .where(eq(parcels.bilty_number, bilty_number))
    .limit(1)

  if (rows.length === 0) {
    return { error: `No parcel found with bilty number "${bilty_number}"`, parcel: null }
  }

  const row = rows[0]

  if (row.voided) {
    return { error: 'This bilty has been voided by an admin and cannot be released', parcel: null }
  }

  if (row.status === 'RELEASED') {
    const date = row.released_at
      ? new Date(row.released_at).toLocaleDateString('en-PK', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      : 'unknown date'
    return {
      error: `Already released by ${row.released_by_name ?? 'unknown'} on ${date}`,
      parcel: null,
    }
  }

  return {
    error: '',
    parcel: {
      id: row.id,
      bilty_number: row.bilty_number,
      description: row.description,
      units: row.units,
      payment_type: row.payment_type,
      amount_due: row.amount_due,
    },
  }
}

type ReleaseState = { error: string; success: boolean; ts?: number }

export async function releaseParcelAction(
  prevState: ReleaseState,
  formData: FormData
): Promise<ReleaseState> {
  const session = await auth()
  if (!session) return { error: 'Not authenticated', success: false }

  const parcel_id = formData.get('parcel_id') as string
  const payment_type = formData.get('payment_type') as string
  const receiver_name = (formData.get('receiver_name') as string)?.trim()
  const receiver_phone = (formData.get('receiver_phone') as string)?.trim()
  const receiver_cnic = (formData.get('receiver_cnic') as string)?.trim()
  const cash_collected_raw = (formData.get('cash_collected') as string)?.trim()

  if (!receiver_name || !receiver_phone || !receiver_cnic) {
    return { error: 'Receiver name, phone, and CNIC are all required', success: false }
  }
  if (payment_type === 'TO_PAY' && !cash_collected_raw) {
    return { error: 'Cash collected is required for TO PAY parcels', success: false }
  }

  const cash_collected = payment_type === 'TO_PAY' ? parseFloat(cash_collected_raw) : null
  if (cash_collected !== null && (isNaN(cash_collected) || cash_collected < 0)) {
    return { error: 'Cash collected must be a valid positive number', success: false }
  }

  // Re-verify the parcel is still IN_STORE (guard against race condition)
  const [parcel] = await db
    .select({ id: parcels.id, status: parcels.status })
    .from(parcels)
    .where(eq(parcels.id, parcel_id))

  if (!parcel) return { error: 'Parcel not found', success: false }
  if (parcel.status === 'RELEASED') {
    return { error: 'This parcel was already released by another user', success: false }
  }

  await db
    .update(parcels)
    .set({
      status: 'RELEASED',
      released_by: session.user.id,
      released_at: new Date(),
      receiver_name,
      receiver_phone,
      receiver_cnic,
      cash_collected: cash_collected !== null ? String(cash_collected) : null,
      updated_at: new Date(),
    })
    .where(eq(parcels.id, parcel_id))

  return { error: '', success: true, ts: Date.now() }
}

// ── Void Parcel ───────────────────────────────────────────────────────────────

export async function voidParcelAction(
  parcel_id: string,
  reason: string
): Promise<{ error: string }> {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') return { error: 'Unauthorized' }

  const trimmedReason = reason.trim()
  if (!trimmedReason) return { error: 'Reason is required' }

  const [parcel] = await db
    .select({ id: parcels.id, voided: parcels.voided })
    .from(parcels)
    .where(eq(parcels.id, parcel_id))

  if (!parcel) return { error: 'Parcel not found' }
  if (parcel.voided) return { error: 'Parcel is already voided' }

  await db
    .update(parcels)
    .set({
      voided: true,
      voided_by: session.user.id,
      voided_at: new Date(),
      void_reason: trimmedReason,
      updated_at: new Date(),
    })
    .where(eq(parcels.id, parcel_id))

  revalidatePath('/storehouse')
  revalidatePath('/admin/voided')

  return { error: '' }
}

// ── Close Shift ───────────────────────────────────────────────────────────────

export type ShiftSlip = {
  staffName:       string
  shiftStart:      string  // ISO
  closedAt:        string  // ISO
  parcelsReceived: number
  parcelsReleased: number
  cashCollected:   number
}

export async function closeShiftAction(): Promise<{ error: string; slip: ShiftSlip | null }> {
  const session = await auth()
  if (!session) return { error: 'Not authenticated', slip: null }

  const userId = session.user.id

  // Re-derive shift start server-side
  const [lastClose] = await db
    .select({ closed_at: shift_closes.closed_at })
    .from(shift_closes)
    .where(eq(shift_closes.user_id, userId))
    .orderBy(desc(shift_closes.closed_at))
    .limit(1)

  let shiftStart: Date
  if (lastClose?.closed_at) {
    shiftStart = lastClose.closed_at
  } else {
    const [user] = await db
      .select({ created_at: users.created_at })
      .from(users)
      .where(eq(users.id, userId))
    shiftStart = user?.created_at ?? new Date(0)
  }

  // Re-count all totals server-side
  const [received, released, toPay] = await Promise.all([
    db.select({ id: parcels.id })
      .from(parcels)
      .where(and(eq(parcels.received_by, userId), gte(parcels.received_at, shiftStart), ne(parcels.voided, true))),
    db.select({ id: parcels.id })
      .from(parcels)
      .where(and(eq(parcels.released_by, userId), gte(parcels.released_at, shiftStart), ne(parcels.voided, true))),
    db.select({ cash_collected: parcels.cash_collected })
      .from(parcels)
      .where(and(
        eq(parcels.released_by, userId),
        eq(parcels.payment_type, 'TO_PAY'),
        eq(parcels.status, 'RELEASED'),
        gte(parcels.released_at, shiftStart),
        ne(parcels.voided, true),
      )),
  ])

  const parcelsReceived = received.length
  const parcelsReleased = released.length
  const cashCollected   = toPay.reduce((s, r) => s + parseFloat(r.cash_collected ?? '0'), 0)

  const now = new Date()

  await db.insert(shift_closes).values({
    user_id:          userId,
    closed_at:        now,
    parcels_received: parcelsReceived,
    parcels_released: parcelsReleased,
    cash_collected:   String(cashCollected),
  })

  revalidatePath('/shift')
  revalidatePath('/admin/shifts')

  return {
    error: '',
    slip: {
      staffName:       session.user.name ?? 'Staff',
      shiftStart:      shiftStart.toISOString(),
      closedAt:        now.toISOString(),
      parcelsReceived,
      parcelsReleased,
      cashCollected,
    },
  }
}
