// Disposable PostgreSQL. pg_cron is stubbed only to inspect job registration;
// all profile triggers, dates, audit entries and job SQL run in real PostgreSQL.
import assert from "node:assert/strict";
import fs from "node:fs";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated;
    create table profiles(id uuid primary key default gen_random_uuid(), name text, role text, is_active boolean not null default true, internship_end date);
    create table audit_logs(id bigint generated always as identity primary key, actor_id uuid references profiles(id), action text, target_id uuid, details jsonb);
    create table attendance(user_id uuid references profiles(id), date date);
    create schema cron;
    create table cron.job(jobid bigint generated always as identity primary key, jobname text unique, schedule text, command text);
    create function cron.schedule(text,text,text) returns bigint language sql as $$
      insert into cron.job(jobname,schedule,command) values($1,$2,$3)
      on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid
    $$;
    create publication supabase_realtime;
    set time zone 'Pacific/Honolulu';
    insert into profiles(name,role,is_active,internship_end) values
      ('expired','intern',true,(now() at time zone 'Asia/Jakarta')::date-1),
      ('today','intern',true,(now() at time zone 'Asia/Jakarta')::date),
      ('future','intern',true,(now() at time zone 'Asia/Jakarta')::date+1),
      ('unknown','intern',true,null),
      ('manual','intern',false,(now() at time zone 'Asia/Jakarta')::date-1),
      ('admin','admin',true,(now() at time zone 'Asia/Jakarta')::date-1);
    insert into attendance select id,(now() at time zone 'Asia/Jakarta')::date-1 from profiles where name='expired';
  `);
  const migration = fs
    .readFileSync(
      new URL(
        "../supabase/migrations/020_auto_deactivate_finished_interns.sql",
        import.meta.url,
      ),
      "utf8",
    )
    .replace(
      "create extension if not exists pg_cron with schema extensions;",
      "",
    );
  await db.exec(migration);
  await db.exec(migration);
  const active = async (name) =>
    (await db.query("select is_active from profiles where name=$1", [name]))
      .rows[0].is_active;
  assert.equal(await active("expired"), false);
  for (const name of ["today", "future", "unknown", "admin"])
    assert.equal(await active(name), true);
  assert.equal(await active("manual"), false);
  assert.equal((await db.query("select * from audit_logs")).rows.length, 1);
  assert.equal((await db.query("select * from attendance")).rows.length, 1);
  const jobs = (await db.query("select * from cron.job")).rows;
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].schedule, "* * * * *");
  assert.equal(
    (
      await db.query(
        "select * from pg_publication_tables where tablename='profiles'",
      )
    ).rows.length,
    1,
  );
  await db.exec("update profiles set is_active=true where name='expired'");
  assert.equal(await active("expired"), false);
  assert.equal((await db.query("select * from audit_logs")).rows.length, 1);
  await db.exec(
    "update profiles set internship_end=(now() at time zone 'Asia/Jakarta')::date+10 where name='expired'",
  );
  assert.equal(await active("expired"), false);
  await db.exec("update profiles set is_active=true where name='expired'");
  assert.equal(await active("expired"), true);
  await db.exec(
    "update profiles set internship_end=(now() at time zone 'Asia/Jakarta')::date-1 where name='future'",
  );
  assert.equal(await active("future"), false);
  assert.equal((await db.query("select * from audit_logs")).rows.length, 2);
  await db.exec(
    "insert into profiles(name,role,internship_end) values('new-expired','intern',(now() at time zone 'Asia/Jakarta')::date-1)",
  );
  assert.equal(await active("new-expired"), false);
  assert.equal((await db.query("select * from audit_logs")).rows.length, 3);
  // Simulate a day passing with an already-active account, then execute the job.
  await db.exec(
    "alter table profiles disable trigger enforce_internship_end_status; update profiles set internship_end=(now() at time zone 'Asia/Jakarta')::date-1 where name='today'; alter table profiles enable trigger enforce_internship_end_status;",
  );
  assert.equal(await active("today"), true);
  await db.exec(jobs[0].command);
  assert.equal(await active("today"), false);
  assert.equal((await db.query("select * from audit_logs")).rows.length, 4);
  assert.equal(
    (await db.query("select deactivate_finished_interns() as n")).rows[0].n,
    0,
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(
      db.exec("select public.deactivate_finished_interns()"),
      /permission denied/,
    );
    await db.exec("reset role");
  }
  assert.equal(
    (await db.query("select count(*)::int as n from profiles")).rows[0].n,
    7,
  );
  console.log(
    "PASS: WIB end-day boundary, immediate backfill, minute job registration, insert/update enforcement, controlled reactivation, audit idempotence, preserved history and restricted scheduler access.",
  );
} finally {
  await db.close();
}
