// Edge Function: clasificación automática de categoría/prioridad (RF-22).
//
// PROTOTIPO / STUB: la implementación real se completa en la etapa de IA.
//
// Frontera IA (definida en la sesión ARID):
//  - Timeout corto + fallback manual: si falla, el ticket se crea igualmente.
//  - Nunca bloquea el path crítico de creación de ticket (ASR-3).
//  - El dashboard jamás llama a este modelo: lee tablas de predicción.

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const { asunto, descripcion } = await req.json();

  // TODO: invocar modelo de clasificación entrenado con el histórico.
  const sugerencia = {
    categoriaId: null,
    prioridad: 'media' as const,
    confianza: 0,
  };

  return Response.json({ sugerencia });
});
