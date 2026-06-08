import { pgTable, uuid, text, integer, numeric, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  full_name: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: text('role').notNull().default('STAFF'),       // 'ADMIN' | 'STAFF'
  status: text('status').notNull().default('PENDING'), // 'PENDING' | 'ACTIVE'
  created_at: timestamp('created_at').defaultNow(),
})

export const parcels = pgTable('parcels', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  bilty_number: text('bilty_number').notNull(),
  description: text('description').notNull(),
  units: integer('units').notNull().default(1),
  payment_type: text('payment_type').notNull(),        // 'PAID' | 'TO_PAY'
  amount_due: numeric('amount_due'),
  status: text('status').notNull().default('IN_STORE'), // 'IN_STORE' | 'RELEASED'
  received_by: uuid('received_by').references(() => users.id),
  received_at: timestamp('received_at').defaultNow(),
  released_by: uuid('released_by').references(() => users.id),
  released_at: timestamp('released_at'),
  receiver_name: text('receiver_name'),
  receiver_phone: text('receiver_phone'),
  receiver_cnic: text('receiver_cnic'),
  cash_collected: numeric('cash_collected'),
  location_id: text('location_id').default('main'),
  voided: boolean('voided').notNull().default(false),
  voided_by: uuid('voided_by').references(() => users.id),
  voided_at: timestamp('voided_at'),
  void_reason: text('void_reason'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('parcels_bilty_active_unique')
    .on(table.bilty_number)
    .where(sql`${table.status} = 'IN_STORE'`),
])

export const shift_closes = pgTable('shift_closes', {
  id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id:          uuid('user_id').references(() => users.id),
  closed_at:        timestamp('closed_at').defaultNow(),
  parcels_received: integer('parcels_received').notNull(),
  parcels_released: integer('parcels_released').notNull(),
  cash_collected:   numeric('cash_collected').notNull().default('0'),
})

export type User        = typeof users.$inferSelect
export type NewUser     = typeof users.$inferInsert
export type Parcel      = typeof parcels.$inferSelect
export type NewParcel   = typeof parcels.$inferInsert
export type ShiftClose  = typeof shift_closes.$inferSelect
