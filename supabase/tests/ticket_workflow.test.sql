begin;

select plan(8);

create temporary table workflow_fixture (
  requester_id uuid not null,
  other_user_id uuid not null,
  technician_a uuid not null,
  technician_b uuid not null,
  mesa_id int not null,
  categoria_id int not null,
  ticket_a uuid,
  ticket_b uuid
);
grant select, update on workflow_fixture to authenticated;

insert into workflow_fixture (requester_id, other_user_id, technician_a, technician_b, mesa_id, categoria_id)
select gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  (select id from public.mesas order by id limit 1),
  (select id from public.ticket_categories order by id limit 1);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
select id, 'authenticated', 'authenticated', id || '@workflow-test.local', '',
  now(), '{"full_name":"Workflow test"}', now(), now()
from workflow_fixture
cross join lateral unnest(array[requester_id, other_user_id, technician_a, technician_b]) as id;

update public.profiles p
set rol = 'tecnico', mesa_id = f.mesa_id, activo = true
from workflow_fixture f
where p.id in (f.technician_a, f.technician_b);

update public.profiles p
set rol = 'usuario', mesa_id = f.mesa_id, activo = true
from workflow_fixture f
where p.id in (f.requester_id, f.other_user_id);

select set_config('request.jwt.claim.sub', requester_id::text, true)
from workflow_fixture;
set local role authenticated;

with inserted as (
  insert into public.tickets (usuario_id, mesa_id, categoria_id, asunto, descripcion, prioridad)
  select requester_id, mesa_id, categoria_id, 'Integration ticket one',
    'Integration test description for automatic assignment', 'critica'
  from workflow_fixture
  returning id
)
update workflow_fixture set ticket_a = inserted.id from inserted;

with inserted as (
  insert into public.tickets (usuario_id, mesa_id, categoria_id, asunto, descripcion, prioridad)
  select requester_id, mesa_id, categoria_id, 'Integration ticket two',
    'Integration test description for workload balancing', 'critica'
  from workflow_fixture
  returning id
)
update workflow_fixture set ticket_b = inserted.id from inserted;

reset role;

select ok(
  (select t.tecnico_asignado_id is not null
    and p.rol = 'tecnico' and p.activo and p.mesa_id = f.mesa_id
   from workflow_fixture f
   join public.tickets t on t.id = f.ticket_a
   join public.profiles p on p.id = t.tecnico_asignado_id),
  'ticket insertado se asigna a técnico activo de la misma mesa'
);

select isnt(
  (select tecnico_asignado_id from public.tickets t join workflow_fixture f on t.id = f.ticket_a),
  (select tecnico_asignado_id from public.tickets t join workflow_fixture f on t.id = f.ticket_b),
  'la carga ponderada distribuye tickets consecutivos entre técnicos'
);

select set_config('request.jwt.claim.sub', requester_id::text, true)
from workflow_fixture;
set local role authenticated;
select throws_ok(
  format(
    'insert into public.tickets (usuario_id, mesa_id, categoria_id, asunto, descripcion, prioridad, tecnico_asignado_id) values (%L, %s, %s, %L, %L, %L, %L)',
    requester_id, mesa_id, categoria_id, 'Manual assignment rejected',
    'This ticket must not accept a client selected technician', 'alta', technician_a
  ),
  '42501',
  'La asignación inicial del técnico es automática',
  'cliente no puede elegir el técnico inicial'
)
from workflow_fixture;
reset role;

select set_config('request.jwt.claim.sub', t.tecnico_asignado_id::text, true)
from public.tickets t join workflow_fixture f on t.id = f.ticket_a;
set local role authenticated;
update public.tickets t
set estado = 'cerrado', solucion_aplicada = 'Integration solution completed'
from workflow_fixture f
where t.id = f.ticket_a;
reset role;

select is(
  (select estado::text from public.tickets t join workflow_fixture f on t.id = f.ticket_a),
  'cerrado',
  'el técnico asignado puede cerrar el ticket'
);

select set_config('request.jwt.claim.sub', other_user_id::text, true)
from workflow_fixture;
set local role authenticated;
update public.tickets t
set estado = 'devuelto'
from workflow_fixture f
where t.id = f.ticket_a;
reset role;

select is(
  (select estado::text from public.tickets t join workflow_fixture f on t.id = f.ticket_a),
  'cerrado',
  'otro solicitante no puede reabrir un ticket ajeno'
);

select set_config('request.jwt.claim.sub', requester_id::text, true)
from workflow_fixture;
set local role authenticated;
insert into public.ticket_satisfaccion (
  ticket_id, usuario_id, calidad_servicio, tiempo_respuesta, comunicacion, solucion_resolvio
)
select ticket_a, requester_id, 5, 4, 5, 5 from workflow_fixture;

select throws_ok(
  format(
    'insert into public.ticket_satisfaccion (ticket_id, usuario_id, calidad_servicio, tiempo_respuesta, comunicacion, solucion_resolvio) values (%L, %L, 5, 4, 5, 5)',
    (select ticket_a from workflow_fixture), (select requester_id from workflow_fixture)
  ),
  '23505',
  null,
  'solo se puede enviar una encuesta por ticket'
);

update public.tickets t
set estado = 'devuelto'
from workflow_fixture f
where t.id = f.ticket_a;
reset role;

select is(
  (select estado::text from public.tickets t join workflow_fixture f on t.id = f.ticket_a),
  'devuelto',
  'dueño puede reabrir ticket cerrado'
);

select ok(
  not has_table_privilege('authenticated', 'public.hibp_cache', 'select')
  and not has_table_privilege('authenticated', 'public.sla_config', 'select'),
  'tablas sensibles no son legibles directamente por authenticated'
);

select * from finish();
rollback;
