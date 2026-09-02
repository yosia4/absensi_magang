// Deploy with: supabase functions deploy delete-intern
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
    if (!admin || admin.role !== 'admin' || !admin.is_active) throw new Error('Hanya pembimbing yang dapat menghapus akun')

    const { id } = await req.json()
    if (!id) throw new Error('ID anak magang wajib diisi')

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: intern } = await service.from('profiles').select('role').eq('id', id).single()
    if (!intern || intern.role !== 'intern') throw new Error('Akun anak magang tidak ditemukan')

    const { error } = await service.auth.admin.deleteUser(id)
    if (error) throw error
    await service.from('audit_logs').insert({ actor_id: user.id, action: 'delete_intern', target_id: id, details: { role: 'intern' } })
    return Response.json({ ok: true }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: corsHeaders })
  }
})
