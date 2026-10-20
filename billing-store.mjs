export function billingStore(db){
  if(!db)return null;
  return {
    get:member=>db.prepare('SELECT member, customer_id AS customer, checkout_session AS session, attempt FROM billing_members WHERE member = ?').bind(member).first(),
    async create(member,customer){await db.prepare('INSERT INTO billing_members (member,customer_id,attempt) VALUES (?,?,1) ON CONFLICT(member) DO NOTHING').bind(member,customer).run();return this.get(member);},
    async nextAttempt(member,previous){await db.prepare('UPDATE billing_members SET attempt=attempt+1,checkout_session=NULL WHERE member=? AND checkout_session=?').bind(member,previous).run();return this.get(member);},
    async setCheckout(member,attempt,session){await db.prepare('UPDATE billing_members SET checkout_session=? WHERE member=? AND attempt=?').bind(session,member,attempt).run();}
  };
}
