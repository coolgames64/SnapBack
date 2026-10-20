import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const billingMembers=sqliteTable('billing_members',{
 member:text('member').primaryKey(),
 customerId:text('customer_id').notNull(),
 checkoutSession:text('checkout_session'),
 attempt:integer('attempt').notNull().default(1)
});

export const aiUsage=sqliteTable('ai_usage',{
 member:text('member').notNull(),
 period:text('period').notNull(),
 requests:integer('requests').notNull(),
 lastRequest:integer('last_request').notNull()
},table=>[primaryKey({columns:[table.member,table.period]})]);
