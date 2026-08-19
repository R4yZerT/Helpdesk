# Edge Function: clasificacion automatica de categoria/prioridad (RF-22).
#
# PROTOTIPO / STUB: la implementacion real se completa en la etapa de IA.
#
# Frontera IA (definida en la sesion ARID):
#  - Timeout corto + fallback manual: si falla, el ticket se crea igualmente.
#  - Nunca bloquea el path critico de creacion de ticket (ASR-3).
#  - El dashboard jamas llama a este modelo: lee tablas de prediccion.

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const { asunto, descripcion } = await req.json();

  // TODO: invocar modelo de clasificacion entrenado con el historico.
  const sugerencia = {
    categoriaId: null,
    prioridad: "media",
    confianza: 0,
  };

  return Response.json({ sugerencia });
});