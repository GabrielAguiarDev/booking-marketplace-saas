-- ---------------------------------------------------------------------------
-- Avaliações
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  -- A reserva é a credencial. Uma avaliação sem atendimento é uma opinião de
  -- quem nunca entrou na loja, e é assim que nota de plataforma vira leilão.
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid references public.professionals (id) on delete set null,
  rating smallint not null,
  comment text,
  -- Os marcadores da tela ("Pontualidade", "Higiene", …).
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5)
);

comment on table public.reviews is
  'Uma avaliação por atendimento concluído. O unique em appointment_id é o que impede avaliar duas vezes.';

create index reviews_establishment_idx on public.reviews (establishment_id, created_at desc);
create index reviews_customer_idx on public.reviews (customer_id);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Nota agregada
-- ---------------------------------------------------------------------------
-- Materializada em `establishments` por gatilho, não recalculada na tela: a
-- busca ordena por nota, e ordenar por agregado calculado em tempo real varre
-- todas as avaliações de todas as lojas a cada busca.

alter table public.establishments
  add column rating_avg numeric(3, 2),
  add column rating_count integer not null default 0;

create function public.refresh_establishment_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_establishment_id uuid := coalesce(new.establishment_id, old.establishment_id);
begin
  update public.establishments e
  set
    rating_avg = sub.avg_rating,
    rating_count = sub.total
  from (
    select
      round(avg(r.rating)::numeric, 2) as avg_rating,
      count(*)::integer as total
    from public.reviews r
    where r.establishment_id = l_establishment_id
  ) sub
  where e.id = l_establishment_id;

  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_establishment_rating();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.reviews enable row level security;

create policy reviews_select_public
  on public.reviews for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.establishments e
      where e.id = establishment_id and e.status = 'active'
    )
  );

-- Só quem foi atendido avalia, e só o próprio atendimento. As três condições
-- juntas são a regra inteira: é meu, foi concluído, e é desta loja.
create policy reviews_insert_own
  on public.reviews for insert
  to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.customer_id = (select auth.uid())
        and a.status = 'completed'
        and a.establishment_id = reviews.establishment_id
    )
  );

-- Editar a própria avaliação, sim. Apagar, não: nota que some sob pressão do
-- estabelecimento não é nota. Remoção passa por moderação da plataforma.
create policy reviews_update_own
  on public.reviews for update
  to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create policy reviews_delete_admin
  on public.reviews for delete
  to authenticated
  using (public.is_platform_admin());
