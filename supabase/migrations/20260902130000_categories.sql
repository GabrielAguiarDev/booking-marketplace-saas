-- ---------------------------------------------------------------------------
-- Categorias que faltavam
-- ---------------------------------------------------------------------------
-- A fundação nasceu com as cinco categorias do brief. O app do cliente mostra
-- oito, e as três que faltam não são variações das existentes: quem procura
-- manicure não procura salão, e quem procura dentista não procura dermato.
--
-- `alter type ... add value` fica sozinho nesta migration de propósito: o
-- Postgres não deixa usar um valor novo de enum na mesma transação em que ele
-- foi criado, e cada arquivo de migration roda na sua própria transação.

alter type public.establishment_category add value if not exists 'nail_salon';
alter type public.establishment_category add value if not exists 'dentistry';
alter type public.establishment_category add value if not exists 'massage';
