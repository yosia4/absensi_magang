// Run against disposable PostgreSQL only. PGlite is an optional test dependency;
// PGLITE_MODULE may point to its installed module URL outside production deps.
import assert from "node:assert/strict";
import fs from "node:fs";
import { attendanceDisplayState } from "../src/attendanceSummary.js";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const admin = "00000000-0000-0000-0000-000000000001";
const intern = "00000000-0000-0000-0000-000000000002";
const inactiveAdmin = "00000000-0000-0000-0000-000000000003";
const originalIn = "2026-09-23T01:00:00.123Z";
const originalOut = "2026-09-23T01:00:01.456Z";
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    create table profiles(id uuid primary key, role text, is_active boolean);
    create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin' and is_active) $$;
    create table attendance(id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id), date date, check_in timestamptz, check_out timestamptz, status text, unique(user_id,date));
    create table audit_logs(id serial primary key, actor_id uuid, action text, target_id uuid, details jsonb);
    create table notifications(id serial primary key, user_id uuid, title text, message text);
    insert into profiles values ('${admin}','admin',true), ('${intern}','intern',true), ('${inactiveAdmin}','admin',false);
    insert into attendance(user_id,date,check_in,check_out,status) values
      ('${intern}','2026-09-23','${originalIn}','${originalOut}','Terlambat'),
      ('${intern}','2026-09-22','2026-09-22T01:00Z','2026-09-22T09:00Z','Hadir'),
      ('${intern}','2026-09-21',null,'2026-09-21T09:00Z','Hadir');
  `);
  const migration = fs.readFileSync(
    new URL(
      "../supabase/migrations/013_clear_attendance_checkout.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  const as = async (id, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec(`set role ${role}`);
  };
  const clear = (
    date = "2026-09-23",
    expected = originalOut,
    reason = "Salah scan dua kali",
  ) =>
    db.query("select * from public.clear_attendance_checkout($1,$2,$3,$4)", [
      intern,
      date,
      expected,
      reason,
    ]);
  await as(intern);
  await assert.rejects(clear(), /Hanya admin/);
  await as(inactiveAdmin);
  await assert.rejects(clear(), /Hanya admin/);
  await as("", "anon");
  await assert.rejects(clear(), /permission denied/);
  await as(admin);
  await assert.rejects(clear("2026-09-23", originalOut, "    "), /minimal 5/);
  await assert.rejects(clear("2026-09-20"), /belum tercatat/);
  await assert.rejects(
    clear("2026-09-21", "2026-09-21T09:00Z"),
    /Jam masuk belum/,
  );
  await assert.rejects(clear("2026-09-23", null), /sudah berubah/);
  await assert.rejects(
    clear("2026-09-23", "2026-09-23T09:00Z"),
    /sudah berubah/,
  );
  const result = (await clear()).rows[0];
  assert.equal(result.check_out, null);
  assert.equal(result.check_in.toISOString(), originalIn);
  assert.equal(result.status, "Terlambat");
  assert.equal(attendanceDisplayState(result).canScan, true);
  assert.equal(attendanceDisplayState(result).action, "SCAN UNTUK CHECK-OUT");
  await assert.rejects(clear(), /sudah kosong/);
  await db.exec("reset role");
  const audit = (await db.query("select * from audit_logs")).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "clear_attendance_checkout");
  assert.equal(
    new Date(audit[0].details.previous_check_out).toISOString(),
    originalOut,
  );
  assert.equal(audit[0].details.reason, "Salah scan dua kali");
  assert.equal(
    (await db.query("select count(*)::int as count from notifications")).rows[0]
      .count,
    1,
  );
  assert.equal(
    (
      await db.query("select check_out from attendance where date='2026-09-22'")
    ).rows[0].check_out.toISOString(),
    "2026-09-22T09:00:00.000Z",
  );
  // A later legitimate checkout cannot be removed using the stale confirmation.
  await db.query("update attendance set check_out=$1 where date='2026-09-23'", [
    "2026-09-23T09:00Z",
  ]);
  await as(admin);
  await assert.rejects(clear(), /sudah berubah/);
  const normal = (await clear("2026-09-22", "2026-09-22T09:00Z")).rows[0];
  assert.equal(normal.status, "Hadir");
  assert.equal(normal.check_in.toISOString(), "2026-09-22T01:00:00.000Z");
  // Failed audit/notification writes must roll back the attendance change.
  await db.exec(
    "reset role; alter table notifications add constraint reject_test_notice check (false) not valid",
  );
  await as(admin);
  await assert.rejects(
    clear("2026-09-23", "2026-09-23T09:00Z"),
    /reject_test_notice/,
  );
  await db.exec("reset role");
  assert.equal(
    (
      await db.query("select check_out from attendance where date='2026-09-23'")
    ).rows[0].check_out.toISOString(),
    "2026-09-23T09:00:00.000Z",
  );
  console.log(
    "PASS: checkout-only correction preserves exact check-in/status, re-enables checkout, guards stale/repeated requests, checks permissions, logs audit/notifies, and rolls back atomically.",
  );
} finally {
  await db.close();
}
