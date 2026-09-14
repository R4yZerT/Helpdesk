// RF-23 — Helpers notificaciones (in-app + push_tokens)
import type { SupabaseClient } from '@supabase/supabase-js';

export type Notificacion = {
  id: number;
  usuario_id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  ticket_id: string | null;
  leida: boolean;
  creado_en: string;
};

export async function listNotificaciones(client: SupabaseClient, opts:{ limit?:number; soloNoLeidas?:boolean }={}):Promise<Notificacion[]>{
  let q=client.from('notificaciones').select('id,usuario_id,tipo,titulo,cuerpo,ticket_id,leida,creado_en').order('creado_en',{ascending:false}).limit(opts.limit??20);
  if(opts.soloNoLeidas) q=q.eq('leida', false);
  const {data, error}=await q as any;
  if(error) throw new Error(error.message);
  return (data ?? []) as Notificacion[];
}

export async function countNoLeidas(client: SupabaseClient):Promise<number>{
  const {count, error}=await client.from('notificaciones').select('id',{count:'exact', head:true}).eq('leida', false) as any;
  if(error) throw new Error(error.message);
  return count ?? 0;
}

export async function marcarLeida(client: SupabaseClient, id:number):Promise<void>{
  const {error}=await (client.from('notificaciones') as any).update({leida:true}).eq('id', id);
  if(error) throw new Error(error.message);
}
export async function marcarTodasLeidas(client: SupabaseClient):Promise<void>{
  const {error}=await (client.from('notificaciones') as any).update({leida:true}).eq('leida', false);
  if(error) throw new Error(error.message);
}

// Realtime: suscribe a nuevas notificaciones del usuario actual
export function subscribeNotificaciones(client: SupabaseClient, onInsert:(n:Notificacion)=>void){
  const ch=client.channel('notificaciones-own')
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'notificaciones'}, (payload:any)=>{
      const r=payload.new as any;
      onInsert({ id:r.id, usuario_id:r.usuario_id, tipo:r.tipo, titulo:r.titulo, cuerpo:r.cuerpo, ticket_id:r.ticket_id, leida:r.leida, creado_en:r.creado_en } as Notificacion);
    })
    .subscribe();
  return ()=>{ client.removeChannel(ch); };
}

// push_tokens
export async function registerPushToken(client: SupabaseClient, token:string, plataforma:'web'|'android'|'ios'){
  const {data:{user}}=await client.auth.getUser();
  if(!user) throw new Error('No autenticado');
  const {error}=await (client.from('push_tokens') as any).upsert({usuario_id:user.id, token, plataforma}, {onConflict:'usuario_id,token'});
  if(error) throw new Error(error.message);
}
