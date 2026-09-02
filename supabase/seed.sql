-- Dado de referência apenas. Nenhum estabelecimento ou usuário fictício:
-- o banco local deve refletir o que existe de verdade em produção no dia zero.

insert into public.cities (name, state_code, slug, ibge_code) values
  ('São Paulo',      'SP', 'sao-paulo',      '3550308'),
  ('Rio de Janeiro', 'RJ', 'rio-de-janeiro', '3304557'),
  ('Belo Horizonte', 'MG', 'belo-horizonte', '3106200'),
  ('Curitiba',       'PR', 'curitiba',       '4106902'),
  ('Porto Alegre',   'RS', 'porto-alegre',   '4314902'),
  -- Santa Catarina: as três cidades que o design do app do cliente usa no
  -- seletor de cidade da Home.
  ('Joinville',      'SC', 'joinville',      '4209102'),
  ('Blumenau',       'SC', 'blumenau',       '4202404'),
  ('Florianópolis',  'SC', 'florianopolis',  '4205407')
on conflict (slug) do nothing;
