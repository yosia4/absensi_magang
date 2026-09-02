// Deploy with: supabase functions deploy update-intern
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authorization = req.headers.get('Authorization') ?? ''
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
    const { data: { user } } = await client.auth.getUser()
    if (!user) throw new Error('Sesi tidak valid')
    const { data: admin } = await client.from('profiles').select('role,is_active').eq('id', user.id).single()
    if (!admin || admin.role !== 'admin' || !admin.is_active) throw new Error('Hanya pembimbing yang dapat mengubah akun')

    const body = await req.json()
    if (!body.id || !body.name || !body.email) throw new Error('Data akun tidak lengkap')
    if (body.password && body.password.length < 6) throw new Error('Kata sandi minimal 6 karakter')

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: intern } = await service.from('profiles').select('role').eq('id', body.id).single()
    if (!intern || intern.role !== 'intern') throw new Error('Akun anak magang tidak ditemukan')

    const userUpdate: Record<string, string> = { email: body.email }
    if (body.password) userUpdate.password = body.password
    const { error: authError } = await service.auth.admin.updateUserById(body.id, userUpdate)
    if (authError) throw authError
    const { error: profileError } = await service.from('profiles').update({
      name: body.name, email: body.email, department: body.department || null,
      internship_start: body.internship_start || null, internship_end: body.internship_end || null,
    }).eq('id', body.id)
    if (profileError) throw profileError
    await service.from('audit_logs').insert({ actor_id: user.id, action: 'update_intern', target_id: body.id, details: { email: body.email, department: body.department || null } })
    return Response.json({ ok: true }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: corsHeaders })
  }
})
