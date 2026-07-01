-- ================================================================
-- NEBUMIA — QUITAR LA FOTO DE LOS METADATOS DEL USUARIO
-- Causa raíz del error 494: la foto de perfil (base64, ~50KB) se guardó en
-- user_metadata, que va DENTRO del token de login → token de ~60KB → rechazado.
-- Esto la borra del metadata para que el próximo token sea pequeño (~1KB).
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ================================================================

-- Cuenta de la app: dante@bandu.pe (NO dante.trujillo96@gmail.com)

-- 1) Ver el tamaño actual del metadata (antes):
select email, length(raw_user_meta_data::text) as tamano_metadata
from auth.users
where email = 'dante@bandu.pe';

-- 2) Quitar la foto:
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'photo'
where email = 'dante@bandu.pe';

-- 3) Confirmar el tamaño después (debe ser mucho menor):
select email, length(raw_user_meta_data::text) as tamano_metadata
from auth.users
where email = 'dante@bandu.pe';
