-- ---------------------------------------------------------------------------
-- Autorização: escritas amplas que sobraram depois do gate de 18/09
-- ---------------------------------------------------------------------------
-- Aditiva, como o gate: troca políticas `FOR ALL` por políticas do tamanho do
-- que os apps de fato fazem, e estende guardas que já existiam.

-- ---------------------------------------------------------------------------
-- Equipe: vínculo só nasce no aceite do convite
-- ---------------------------------------------------------------------------
-- `establishment_members_write_owner` era FOR ALL. O dono inseria direto
-- qualquer `user_id` na própria loja — sem convite e sem aceite —, passava a
-- ler nome e telefone dessa conta (`profiles_select_colleagues`) e a impedia
-- de excluir a conta (`has_establishment`). Criar vínculo é só
-- `establishment_accept_invites()`; ao dono restam mudar papel e remover.

drop policy establishment_members_write_owner on public.establishment_members;

create policy establishment_members_update_owner
  on public.establishment_members for update
  to authenticated
  using (public.has_establishment_role(establishment_id, array['owner']::public.establishment_role[]))
  with check (public.has_establishment_role(establishment_id, array['owner']::public.establishment_role[]));

create policy establishment_members_delete_owner
  on public.establishment_members for delete
  to authenticated
  using (public.has_establishment_role(establishment_id, array['owner']::public.establishment_role[]));

revoke insert, truncate on public.establishment_members from anon, authenticated;

-- Mudar papel não pode virar "trocar a pessoa": um UPDATE de `user_id` seria o
-- insert proibido acima por outro caminho.
create function public.guard_establishment_member_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'postgres'
    and current_setting('role', true) is distinct from 'service_role'
    and (new.user_id is distinct from old.user_id
      or new.establishment_id is distinct from old.establishment_id)
  then
    raise exception 'o vínculo com a loja não muda de pessoa nem de loja'
      using errcode = '42501', hint = 'forbidden';
  end if;
  return new;
end;
$$;

create trigger establishment_members_guard_identity
  before update on public.establishment_members
  for each row execute function public.guard_establishment_member_identity();

-- ---------------------------------------------------------------------------
-- Reservas: a loja atende, não reescreve nem apaga
-- ---------------------------------------------------------------------------
-- `appointments_update_establishment` era FOR ALL para qualquer membro. Com
-- `reviews.appointment_id ON DELETE CASCADE`, apagar a reserva concluída
-- apagava a avaliação — remoção de avaliação sem passar pela moderação. O
-- mesmo FOR ALL deixava criar reserva em nome de uma conta qualquer e trocar
-- o cliente de uma reserva existente.
--
-- O que a equipe faz, e continua fazendo: criar reserva de balcão (sem conta)
-- e mudar situação, horário e profissional. Reserva de cliente com conta
-- nasce pela Edge Function `book-appointment`.

drop policy appointments_update_establishment on public.appointments;

create policy appointments_insert_establishment
  on public.appointments for insert
  to authenticated
  with check (public.is_establishment_member(establishment_id) and customer_id is null);

create policy appointments_update_establishment
  on public.appointments for update
  to authenticated
  using (public.is_establishment_member(establishment_id))
  with check (public.is_establishment_member(establishment_id));

revoke delete, truncate on public.appointments from anon, authenticated;

create function public.guard_appointment_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'postgres'
    and current_setting('role', true) is distinct from 'service_role'
    and (new.customer_id is distinct from old.customer_id
      or new.establishment_id is distinct from old.establishment_id)
  then
    raise exception 'cliente e loja da reserva são imutáveis'
      using errcode = '42501', hint = 'forbidden';
  end if;
  return new;
end;
$$;

create trigger appointments_guard_identity
  before update on public.appointments
  for each row execute function public.guard_appointment_identity();

-- ---------------------------------------------------------------------------
-- Loja: nota e cidade não são do dono
-- ---------------------------------------------------------------------------
-- A guarda cobria situação, plano e desconto. `rating_avg` e `rating_count`
-- ficavam de fora: um UPDATE direto punha a loja com nota 5,0 no topo da
-- busca. `city_id` também: trocar de cidade é entrar em outra cota sem passar
-- pela aprovação. A nota continua sendo escrita por
-- `refresh_establishment_rating()`, que é security definer.

create or replace function public.guard_establishment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  l_privileged boolean :=
    current_user = 'postgres'
    or current_setting('role', true) = 'service_role'
    ;
begin
  if not l_privileged and (
    new.status is distinct from old.status
    or new.plan_id is distinct from old.plan_id
    or new.plan_changed_at is distinct from old.plan_changed_at
    or new.discount_percent is distinct from old.discount_percent
    or new.discount_until is distinct from old.discount_until
    or new.status_reason is distinct from old.status_reason
  ) then
    raise exception 'situação, plano e desconto do estabelecimento só mudam por admin da plataforma'
      using errcode = '42501';
  end if;

  if not l_privileged and (
    new.rating_avg is distinct from old.rating_avg
    or new.rating_count is distinct from old.rating_count
  ) then
    raise exception 'a nota da loja vem das avaliações dos clientes'
      using errcode = '42501';
  end if;

  if not l_privileged and new.city_id is distinct from old.city_id then
    raise exception 'a cidade da loja só muda pela equipe da plataforma'
      using errcode = '42501';
  end if;

  if not l_privileged and new.submitted_at is distinct from old.submitted_at then
    raise exception 'a data de envio do cadastro só muda pelo reenvio depois de uma correção'
      using errcode = '42501';
  end if;

  -- carimbo de quando a situação mudou: ninguém escreve à mão
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  else
    new.status_changed_at := old.status_changed_at;
  end if;

  -- A primeira atribuição (aprovação, backfill) não é troca: o intervalo mínimo
  -- entre trocas não pode impedir de corrigir o plano logo depois de aprovar.
  if new.plan_id is distinct from old.plan_id then
    new.plan_changed_at := case when old.plan_id is null then null else now() end;
  else
    new.plan_changed_at := old.plan_changed_at;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fila: a conferência do código é interna
-- ---------------------------------------------------------------------------
-- Só `queue_join` e `queue_confirm_arrival` (security definer) a chamam.
-- Como RPC, era um oráculo sem freio do código do balcão.

revoke execute on function public.queue_code_matches(uuid, text) from authenticated;
