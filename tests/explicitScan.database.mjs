// Disposable PostgreSQL test. Set PGLITE_MODULE to an optional PGlite module URL.
import assert from "node:assert/strict";
import fs from "node:fs";
const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const intern = "00000000-0000-0000-0000-000000000001";
const inactive = "00000000-0000-0000-0000-000000000002";
const admin = "00000000-0000-0000-0000-000000000003";
try {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    create table profiles(id uuid primary key, role text, is_active boolean);
    insert into profiles values ('${intern}','intern',true),('${inactive}','intern',false),('${admin}','admin',true);
    create table attendance(id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id), date date, check_in timestamptz, check_out timestamptz, status text not null, unique(user_id,date));
    create table qr_sessions(id uuid primary key default gen_random_uuid(), token text, latitude double precision, longitude double precision, radius_m integer, is_active boolean, expires_at timestamptz);
    insert into qr_sessions(token,latitude,longitude,radius_m,is_active,expires_at) values ('valid',-7.8,110.4,150,true,now()+interval '1 day');
    create table system_settings(id int, work_start_time time, late_tolerance_minutes int, work_days smallint[], qr_enabled boolean);
    insert into system_settings values (1,'00:00',0,array[1,2,3,4,5,6,7],true);
  `);
  const migration = fs.readFileSync(
    new URL(
      "../supabase/migrations/014_explicit_attendance_scan.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  const today = (
    await db.query(
      "select (now() at time zone 'Asia/Jakarta')::date::text as day",
    )
  ).rows[0].day;
  const as = async (id, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec(`set role ${role}`);
  };
  const scan = (
    action,
    date = today,
    token = "valid",
    lat = -7.8,
    lng = 110.4,
  ) =>
    db.query(
      "select * from scan_attendance($1::text,$2::double precision,$3::double precision,$4::text,$5::date)",
      [token, lat, lng, action, date],
    );
  await as(inactive);
  await assert.rejects(scan("check_in"), /aktif/);
  await as(admin);
  await assert.rejects(scan("check_in"), /anak magang/);
  await as("", "anon");
  await assert.rejects(scan("check_in"), /permission denied/);
  await as(intern);
  await assert.rejects(scan("check_out"), /Jam masuk belum/);
  await assert.rejects(scan(null), /Pilih Absen/);
  await assert.rejects(scan("toggle"), /Pilih Absen/);
  await assert.rejects(scan("check_in", "2000-01-01"), /Tanggal sudah/);
  await assert.rejects(scan("check_in", null), /Tanggal sudah/);
  await assert.rejects(scan("check_in", today, "invalid"), /QR tidak valid/);
  await assert.rejects(scan("check_in", today, "valid", 0, 0), /di luar area/);
  await assert.rejects(
    scan("check_in", today, "valid", null),
    /GPS tidak valid/,
  );
  await assert.rejects(
    db.query(
      "select * from scan_attendance('valid',-7.8::double precision,110.4::double precision)",
    ),
    /Muat ulang/,
  );
  const entry = (await scan("check_in")).rows[0];
  assert.equal(entry.check_out, null);
  const duplicate = (await scan("check_in")).rows[0];
  assert.equal(duplicate.id, entry.id);
  assert.equal(duplicate.check_in.toISOString(), entry.check_in.toISOString());
  assert.equal(duplicate.check_out, null);
  const departure = (await scan("check_out")).rows[0];
  assert.ok(departure.check_out);
  assert.equal(departure.status, entry.status);
  assert.equal(departure.check_in.toISOString(), entry.check_in.toISOString());
  assert.equal(
    (await scan("check_out")).rows[0].check_out.toISOString(),
    departure.check_out.toISOString(),
  );
  assert.equal(
    (await scan("check_in")).rows[0].check_out.toISOString(),
    departure.check_out.toISOString(),
  );
  // Re-opened checkout after supervisor correction remains possible.
  await db.exec("reset role; update attendance set check_out=null");
  await as(intern);
  assert.ok((await scan("check_out")).rows[0].check_out);
  // Existing special statuses and records needing review cannot be overwritten.
  for (const status of ["Izin", "Sakit", "Alpa"]) {
    await db.exec("reset role");
    await db.query("update attendance set status=$1,check_out=null", [status]);
    await as(intern);
    await assert.rejects(scan("check_in"), /Status absensi/);
    await assert.rejects(scan("check_out"), /Status absensi/);
  }
  await db.exec(
    "reset role; update attendance set status='Hadir',check_in=null",
  );
  await as(intern);
  await assert.rejects(scan("check_in"), /Jam masuk belum/);
  await db.exec("reset role; update system_settings set qr_enabled=false");
  await as(intern);
  await assert.rejects(scan("check_in"), /dinonaktifkan/);
  await db.exec(
    "reset role; update system_settings set qr_enabled=true,work_days=array[]::smallint[]",
  );
  await as(intern);
  await assert.rejects(scan("check_in"), /tidak tersedia/);
  console.log(
    "PASS: explicit actions, duplicate timestamp preservation, disabled old RPC, role/date/GPS/QR/workday validation, protected special statuses, and checkout after correction.",
  );
} finally {
  await db.close();
}
