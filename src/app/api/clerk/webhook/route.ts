import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing webhook secret' }, { status: 500 })
  }

  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: { type: string; data: Record<string, unknown> }
  try {
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof evt
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  switch (evt.type) {
    case 'user.created': {
      const data = evt.data as {
        id: string
        email_addresses: { email_address: string }[]
        first_name?: string
        last_name?: string
        image_url?: string
      }
      const email = data.email_addresses[0]?.email_address

      // Upsert para evitar duplicados si el usuario ya existe desde otra app
      await supabase.from('users').upsert({
        id: data.id,
        email: email || '',
        full_name: [data.first_name, data.last_name].filter(Boolean).join(' ') || null,
        avatar_url: data.image_url || null,
        plan_type: 'free',
      }, { onConflict: 'id', ignoreDuplicates: true })

      // Crear suscripción free solo si no existe
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', data.id)
        .maybeSingle()

      if (!existing) {
        await supabase.from('subscriptions').insert({
          id: `free_${data.id}`,
          user_id: data.id,
          status: 'free',
          plan_type: 'free',
          currency: 'usd',
          cancel_at_period_end: false,
          tutor_minutes_used: 0,
          dialogues_used: 0,
          audio_used: 0,
        })
      }
      break
    }

    case 'user.updated': {
      const data = evt.data as {
        id: string
        email_addresses: { email_address: string }[]
        first_name?: string
        last_name?: string
        image_url?: string
      }
      const email = data.email_addresses[0]?.email_address

      await supabase.from('users').update({
        email: email || '',
        full_name: [data.first_name, data.last_name].filter(Boolean).join(' ') || null,
        avatar_url: data.image_url || null,
        updated_at: new Date().toISOString(),
      }).eq('id', data.id)
      break
    }

    case 'user.deleted': {
      const data = evt.data as { id: string }
      await supabase.from('users').delete().eq('id', data.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
