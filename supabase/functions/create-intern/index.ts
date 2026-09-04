// Deploy with: supabase functions deploy create-intern
// The function uses the automatically available SUPABASE_SERVICE_ROLE_KEY server-side.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await client.auth.getUser()
    if (!user) throw new Error('Sesi tidak valid')
    const { data: admin } = await client.from('profiles').select('role,is_active').eq('id', user.id).single()
    if (!admin || admin.role !== 'admin' || !admin.is_active) throw new Error('Hanya pembimbing yang dapat menambah akun')
    const body = await req.json()
    if (!body.name || !body.email || !body.password) throw new Error('Nama, email, dan kata sandi wajib diisi')
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: body.email,
      password: body.password,
      // Account dapat langsung dipakai login tanpa menunggu konfirmasi email.
      email_confirm: true,
      user_metadata: {
        name: body.name,
        university: body.university || '',
        major: body.major || '',
        internship_start: body.internship_start || '',
        internship_end: body.internship_end || '',
      },
    })
    if (createError) throw createError

    // Trigger Auth membuat profile awal. Upsert ini tetap diperlukan agar data
    // universitas dan jurusan tersimpan juga pada project yang trigger-nya
    // masih versi lama.
    const { error: profileError } = await service.from('profiles').upsert({
      id: created.user.id,
      name: body.name,
      email: body.email,
      role: 'intern',
      university: body.university || null,
      major: body.major || null,
      internship_start: body.internship_start || null,
      internship_end: body.internship_end || null,
      is_active: true,
    }, { onConflict: 'id' })
    if (profileError) {
      await service.auth.admin.deleteUser(created.user.id)
      throw profileError
    }

    await service.from('audit_logs').insert({ actor_id: user.id, action: 'create_intern', target_id: created.user.id, details: { email: body.email, university: body.university || null, major: body.major || null } })
    return Response.json({ ok: true }, { headers: corsHeaders })
  } catch (error) { return Response.json({ error: error.message }, { status: 400, headers: corsHeaders }) }
})
