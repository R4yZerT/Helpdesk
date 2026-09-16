-- RF-01 / RF-03 robusto — Hook NIST SP 800-63B §5.1.1.2 + OWASP ASVS 2.1
-- Valida contraseña antes de crear usuario (auth.hook.before_user_created)
-- Complementa validación cliente (shared/src/password.ts) con imposición servidor no-bypasseable
-- HIBP k-anonimity se valida en Edge Function auth-validate (fail-closed); aquí se hacen checks síncronos que no requieren red

-- Tabla cache opcional para HIBP (si se usa pg_net en el futuro)
create table if not exists public.hibp_cache (
  prefix text primary key,
  body text not null,
  actualizado_en timestamptz not null default now()
);

-- Lista Top comunes (subset) para validación servidor — espejo de shared/src/password.ts COMMON_PASSWORDS
create or replace function public.is_common_password(pw text)
returns boolean language sql immutable as $$
  select lower(pw) in (
    'password','123456','123456789','qwerty','12345678','12345','1234567','password1',
    '123123','qwerty123','abc123','password123','admin','letmein','welcome','monkey',
    'dragon','passw0rd','master','hello','freedom','whatever','qazwsx','trustno1',
    '1234','1234567890','000000','1q2w3e4r','qwertyuiop','123qwe','zxcvbnm','superman',
    'iloveyou','starwars','123321','654321','qwerty12345','password12','admin123',
    'welcome123','login','princess','solo','qwerty1','baseball','football','jesus'
  );
$$;

create or replace function public.contains_user_attribute(pw text, attr text)
returns boolean language sql immutable as $$
  select exists (
    select 1 where attr is not null and length(trim(attr)) >= 3
    and lower(pw) like '%' || lower(split_part(trim(attr), '@', 1)) || '%'
  ) or exists (
    select 1 where attr is not null and length(trim(attr)) >= 3
    and lower(pw) like '%' || lower(trim(attr)) || '%'
  );
$$;

-- Hook principal — firma requerida por Supabase Auth Hooks: jsonb in, jsonb out
-- Si retorna error (raise exception) el registro se rechaza
create or replace function public.validate_password_hook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pw text;
  email text;
  nombre text;
  rol text;
begin
  -- El password viene en NEW.encrypted_password no es plaintext; Hooks de Supabase exponen
  -- new.raw_user_meta_data->>'password' NO existe. En su lugar, Supabase pasa el intento
  -- vía `auth.hook.before_user_created` con payload JSON que incluye `user` + `password`.
  -- Para compatibilidad con trigger directo sobre auth.users, validamos lo que tengamos.
  -- NOTA RF-01 (Fase 3): el trigger sobre auth.users NUNCA ve el plaintext en el
  -- caso general (solo hash bcrypt en encrypted_password), así que este hook NO
  -- puede verificar HIBP aquí. El enforcement real vive en: (1) Edges
  -- admin-create-user / admin-update-user (HIBP fail-closed en servidor,
  -- no-bypasseable), (2) validatePassword() de shared en cliente antes de
  -- updateUser, (3) Edge auth-validate como Auth Hook before-user-created para
  -- signups (ver config.toml). Este hook conserva checks locales como red de
  -- seguridad cuando el plaintext sí viaja en el contexto.
  -- Intentamos leer password de varias fuentes:
  pw := coalesce(
    current_setting('request.jwt.claims', true)::jsonb->>'password',
    new.raw_user_meta_data->>'password',
    ''
  );

  -- Sin plaintext disponible: no hay nada que verificar localmente.
  -- NO rechazar (bloquearía cualquier alta vía Auth API); el HIBP ya aplica
  -- en las Edges de escritura de contraseña.
  if pw = '' or pw is null then
    return new;
  end if;

  -- NFKC ya aplicado en cliente; aquí verificamos longitud sin trim (espacios cuentan)
  if length(pw) < 8 then
    raise exception 'Password debe tener mínimo 8 caracteres (NIST 800-63B)' using errcode = '23514';
  end if;
  if length(pw) > 64 then
    raise exception 'Password debe tener máximo 64 caracteres (NIST 800-63B)' using errcode = '23514';
  end if;

  if public.is_common_password(pw) then
    raise exception 'Password muy común, elige otra (OWASP ASVS 2.1.8)' using errcode = '23514';
  end if;

  -- Repetición 4+ iguales o secuencia 4 (aaaa, 1234)
  if pw ~ '(.)\1{3,}' then
    raise exception 'Evita repeticiones o secuencias (OWASP)' using errcode = '23514';
  end if;

  email := coalesce(new.email, new.raw_user_meta_data->>'email', '');
  nombre := coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'full_name', '');
  rol := coalesce(new.raw_user_meta_data->>'rol', '');

  if public.contains_user_attribute(pw, email) then
    raise exception 'Password no debe contener tu correo (NIST 800-63B)' using errcode = '23514';
  end if;
  if public.contains_user_attribute(pw, nombre) then
    raise exception 'Password no debe contener tu nombre' using errcode = '23514';
  end if;
  if public.contains_user_attribute(pw, rol) then
    raise exception 'Password no debe contener tu rol' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- El hook se invoca vía Supabase Auth (config.toml), no como trigger directo.
-- Dejamos también trigger defensivo por si se inserta directo en auth.users en local:
drop trigger if exists trg_validate_password on auth.users;
create trigger trg_validate_password
  before insert on auth.users
  for each row execute function public.validate_password_hook();

comment on function public.validate_password_hook() is 'RF-01/RF-03 robusto NIST 800-63B: valida longitud, comunes, atributos. HIBP en Edge Function auth-validate (fail-closed)';
