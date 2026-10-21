// Temporary PostgreSQL only; never connects to Supabase.
import assert from "node:assert/strict";
import fs from "node:fs";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const readMigration = (name) => fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const retire = readMigration("026_retire_intern_placements.sql");
try {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    create table profiles(id uuid primary key, name text, role text, is_active boolean, internship_start date, internship_end date);
    create function is_admin() returns boolean language sql stable security definer set search_path=public as $$
      select exists(select 1 from profiles where id=auth.uid() and role='admin' and is_active)
    $$;
    create table audit_logs(id bigint generated always as identity primary key, actor_id uuid, action text, target_id uuid, details jsonb);
    create table notifications(id bigint generated always as identity primary key, user_id uuid, title text, message text);
    create table attendance(id integer primary key);
    insert into attendance values (1);
    grant select on attendance to authenticated;
    create publication supabase_realtime;
    alter publication supabase_realtime add table attendance;
  `);
  // Missing/never-installed feature and repeat execution are supported.
  await db.exec(retire);
  await db.exec(retire);
  for (const file of [
    "017_weekly_room_placements.sql", "018_intern_read_placements.sql",
    "019_fill_week_placements.sql", "021_copy_previous_week_placements.sql",
    "022_bulk_place_interns.sql", "023_bulk_placement_date_range.sql",
    "024_placement_requests.sql", "025_placement_request_ranges_and_badges.sql",
  ]) await db.exec(readMigration(file));
  await db.exec(`
    insert into profiles values ('00000000-0000-0000-0000-000000000001','Admin','admin',true,null,null);
    insert into profiles values ('00000000-0000-0000-0000-000000000002','Peserta','intern',true,null,null);
    select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
    select save_daily_room_placement('00000000-0000-0000-0000-000000000002','2026-10-21','A',null);
  `);
  const tables = ["profiles", "attendance", "audit_logs", "notifications", "weekly_placement_rooms", "daily_room_placements", "placement_requests"];
  const snapshots = async () => Promise.all(tables.map(async table => (await db.query(`select * from ${table}`)).rows));
  const before = await snapshots();
  const functions = (await db.query(`select p.oid, p.oid::regprocedure::text as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like '%placement%' or p.proname like 'bulk_place_%')`)).rows;
  assert.equal(functions.length, 11);
  await db.exec(retire);
  await db.exec(retire);
  assert.deepEqual(await snapshots(), before, "all archived and unrelated data preserved");
  for (const role of ["anon", "authenticated"]) {
    for (const fn of functions) {
      const [{ allowed }] = (await db.query("select has_function_privilege($1, $2::oid, 'EXECUTE') as allowed", [role, fn.oid])).rows;
      assert.equal(allowed, false, `${role}: ${fn.signature}`);
    }
    await db.exec(`set role ${role}`);
    for (const table of ["weekly_placement_rooms", "daily_room_placements", "placement_requests"]) {
      await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
    }
    await assert.rejects(db.query("select save_daily_room_placement(null,null,null,null)"), /permission denied/);
    if (role === "authenticated") assert.equal((await db.query("select * from attendance")).rows.length, 1);
    await db.exec("reset role");
  }
  assert.deepEqual((await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows, [{tablename: "attendance"}]);
  console.log("PASS: absent feature, idempotency, archived data retained, all placement RPC/table access revoked, attendance and unrelated realtime preserved.");
} finally { await db.close(); }
