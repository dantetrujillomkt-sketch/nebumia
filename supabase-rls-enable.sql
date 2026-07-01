-- ================================================================
-- NEBUMIA — REACTIVAR ROW LEVEL SECURITY (RLS)
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Requiere que la app ya reenvíe el JWT del usuario (deploy del proxy).
-- Cada usuario solo puede leer/escribir sus propias filas (auth.uid() = user_id).
-- ================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'clients','leads','quotes','collections','expenses','team_payments',
    'tax_payments','purchases','invoiced_sales','cash_entries',
    'declaraciones','settings','sales_targets'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "own" on public.%I;', t);
    execute format(
      'create policy "own" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
  end loop;
end $$;

-- ================================================================
-- ROLLBACK DE EMERGENCIA (solo si la app deja de cargar datos)
-- Desactiva RLS al instante. Descomenta y ejecuta este bloque:
-- ================================================================
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'clients','leads','quotes','collections','expenses','team_payments',
--     'tax_payments','purchases','invoiced_sales','cash_entries',
--     'declaraciones','settings','sales_targets'
--   ]
--   loop
--     execute format('alter table public.%I disable row level security;', t);
--   end loop;
-- end $$;
