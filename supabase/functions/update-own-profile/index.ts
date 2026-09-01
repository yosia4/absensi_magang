// Deploy with: supabase functions deploy update-own-profile
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authorization = req.headers.get('Authorization') ?? ''
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
    const { data: { user } } = await client.auth.getUser()
    if (!user) throw new Error('Sesi tidak valid')
    const body = await req.json()
    if (!body.name || !body.email) throw new Error('Nama dan email wajib diisi')
    if (body.password && body.password.length < 6) throw new Error('Kata sandi minimal 6 karakter')

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const update: Record<string, string> = { email: body.email }
    if (body.password) update.password = body.password
    const { error: authError } = await service.auth.admin.updateUserById(user.id, update)
    if (authError) throw authError
    const { error: profileError } = await service.from('profiles').update({ name: body.name, email: body.email }).eq('id', user.id)
    if (profileError) throw profileError
    return Response.json({ ok: true }, { headers: corsHeaders })
  } catch (error) { return Response.json({ error: error.message }, { status: 400, headers: corsHeaders }) }
})
