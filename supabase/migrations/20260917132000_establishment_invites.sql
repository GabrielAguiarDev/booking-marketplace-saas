-- ---------------------------------------------------------------------------
-- Convite de conta nova para a equipe da loja
-- ---------------------------------------------------------------------------
-- Até aqui o dono só conseguia vincular quem já tinha criado a conta sozinho.
-- O convite tem duas metades, como o da equipe da plataforma (`admin-invite`):
--
--   * a Edge Function `establishment-invite` usa a Admin API do Auth
--     (`inviteUserByEmail`), que só aceita a secret key;
--   * as RPCs abaixo, chamadas com o JWT de quem convida, conferem o papel e
--     gravam vínculo, cadeira e convite na mesma transação.
--
-- Só o dono convida — é a mesma regra de `establishment_members_write_owner`.
-- O papel convidado é `manager` ou `staff`: dono se promove pela tela da
-- equipe, depois que a pessoa entrou.

create type public.establishment_invite_status as enum ('pending', 'accepted', 'revoked');

create table public.establishment_invitations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name text not null check (char_length(name) between 2 and 120),
  role public.establishment_role not null check (role in ('manager', 'staff')),
  professional_id uuid references public.professionals (id) on delete set null,
  -- `false` quando o e-mail já tinha conta: o Auth não manda convite, a pessoa
  -- recebe o aviso da caixa de saída e entra com a senha que já usa.
  sent_by_auth boolean not null,
  status public.establishment_invite_status not null default 'pending',
  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.establishment_invitations is
  'Convites da loja. Escrita só pelas RPCs establishment_*invite*; leitura por dono e gerência.';

create unique index establishment_invitations_one_pending
  on public.establishment_invitations (establishment_id, lower(email))
  where status = 'pending';
create index establishment_invitations_user_idx on public.establishment_invitations (user_id);

create trigger establishment_invitations_set_updated_at
  before update on public.establishment_invitations
  for each row execute function public.set_updated_at();

alter table public.establishment_invitations enable row level security;

create policy establishment_invitations_select_manager
  on public.establishment_invitations for select
  to authenticated
  using (public.has_establishment_role(establishment_id, array['owner', 'manager']::public.establishment_role[]));

create policy establishment_invitations_select_invitee
  on public.establishment_invitations for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Antes do e-mail: pode convidar?
-- ---------------------------------------------------------------------------
-- A Edge Function chama esta antes de qualquer e-mail sair, para uma conta
-- sem permissão não usar a função como disparador de convites.

create function public.establishment_invite_check(
  p_establishment_id uuid,
  p_email text,
  p_role public.establishment_role,
  p_professional_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.has_establishment_role(p_establishment_id, array['owner']::public.establishment_role[]) then
    raise exception 'Só o dono da loja convida pessoas para a equipe.' using errcode = '42501', hint = 'forbidden';
  end if;
  if l_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = 'P0001', hint = 'invalid_email';
  end if;
  if p_role is null or p_role not in ('manager', 'staff') then
    raise exception 'Escolha gerência ou equipe.' using errcode = 'P0001', hint = 'invalid_role';
  end if;
  if p_professional_id is not null and not exists (
    select 1 from public.professionals p
    where p.id = p_professional_id and p.establishment_id = p_establishment_id
  ) then
    raise exception 'Profissional não encontrado nesta loja.' using errcode = 'P0002', hint = 'invalid_professional';
  end if;
  if exists (
    select 1
    from public.establishment_members m
    join auth.users u on u.id = m.user_id
    where m.establishment_id = p_establishment_id
      and lower(u.email) = l_email
      and not exists (
        select 1 from public.establishment_invitations i
        where i.establishment_id = p_establishment_id
          and lower(i.email) = l_email
          and i.status = 'pending'
      )
  ) then
    raise exception 'Esta pessoa já faz parte da equipe.' using errcode = '23505', hint = 'already_member';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Depois do e-mail: gravar vínculo, cadeira e convite
-- ---------------------------------------------------------------------------
-- A conta já existe neste ponto (o Auth acabou de criá-la, ou ela já existia).
-- Convidar de novo quem ainda não entrou é reenvio: atualiza a data e mantém
-- o vínculo. Devolve o id da conta.

create function public.establishment_add_member(
  p_establishment_id uuid,
  p_email text,
  p_name text,
  p_role public.establishment_role,
  p_professional_id uuid default null,
  p_sent_by_auth boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_email text := lower(btrim(coalesce(p_email, '')));
  l_name text := btrim(coalesce(p_name, ''));
  l_user uuid;
  l_pending public.establishment_invitations;
  l_establishment text;
begin
  perform public.establishment_invite_check(p_establishment_id, l_email, p_role, p_professional_id);
  if char_length(l_name) not between 2 and 120 then
    raise exception 'Informe o nome da pessoa.' using errcode = 'P0001', hint = 'invalid_name';
  end if;

  select u.id into l_user from auth.users u where lower(u.email) = l_email;
  if l_user is null then
    raise exception 'A conta convidada não foi encontrada. Convide de novo.' using errcode = 'P0002', hint = 'account_missing';
  end if;

  -- O perfil nasce pelo gatilho do Auth; garante para conta antiga sem perfil.
  insert into public.profiles (id, full_name) values (l_user, l_name)
  on conflict (id) do update set full_name = coalesce(public.profiles.full_name, excluded.full_name);

  select * into l_pending from public.establishment_invitations i
  where i.establishment_id = p_establishment_id and lower(i.email) = l_email and i.status = 'pending'
  for update;

  insert into public.establishment_members (user_id, establishment_id, role)
  values (l_user, p_establishment_id, p_role)
  on conflict (user_id, establishment_id) do update
  set role = case
    when public.establishment_members.role = 'owner' then public.establishment_members.role
    else excluded.role
  end;

  if p_professional_id is not null then
    update public.professionals p
    set user_id = l_user
    where p.id = p_professional_id
      and p.establishment_id = p_establishment_id
      and (p.user_id is null or p.user_id = l_user);
    if not found then
      raise exception 'Esta cadeira já está ligada a outra conta.' using errcode = 'P0001', hint = 'professional_taken';
    end if;
  end if;

  if l_pending.id is not null then
    update public.establishment_invitations i
    set invited_at = now(), name = l_name, role = p_role,
        professional_id = coalesce(p_professional_id, i.professional_id),
        sent_by_auth = p_sent_by_auth, invited_by = (select auth.uid())
    where i.id = l_pending.id;
  else
    insert into public.establishment_invitations (
      establishment_id, user_id, email, name, role, professional_id, sent_by_auth, invited_by,
      status, accepted_at
    ) values (
      p_establishment_id, l_user, l_email, l_name, p_role, p_professional_id, p_sent_by_auth,
      (select auth.uid()),
      -- Conta que já existia e já entrou alguma vez: o vínculo vale na hora.
      case when not p_sent_by_auth then 'accepted' else 'pending' end::public.establishment_invite_status,
      case when not p_sent_by_auth then now() end
    );
  end if;

  if not p_sent_by_auth then
    select e.name into l_establishment from public.establishments e where e.id = p_establishment_id;
    perform public.notify_enqueue(
      l_user, 'email', 'team_added', 'Você agora faz parte da equipe de ' || l_establishment,
      'Você foi adicionado à equipe de ' || l_establishment
        || '. Entre no portal ou no app Vez Estabelecimento com o e-mail e a senha que você já usa.',
      jsonb_build_object('type', 'team_added', 'establishment_id', p_establishment_id),
      null, 'team_added:' || p_establishment_id || ':' || l_user || ':' || extract(epoch from now())::bigint,
      p_establishment_id
    );
    perform public.notify_enqueue(
      l_user, 'push', 'team_added', 'Você entrou na equipe de ' || l_establishment,
      'Abra o app para ver a agenda da loja.',
      jsonb_build_object('type', 'team_added', 'establishment_id', p_establishment_id),
      'staff', 'team_added:' || p_establishment_id || ':' || l_user || ':' || extract(epoch from now())::bigint,
      p_establishment_id
    );
  end if;

  return l_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leitura e revogação
-- ---------------------------------------------------------------------------
-- O convite está aceito quando a conta entrou alguma vez. É derivado do Auth
-- na leitura (e gravado de volta), em vez de um gatilho em `auth.users`.

create function public.establishment_invites(p_establishment_id uuid)
returns table (
  id uuid,
  email text,
  name text,
  role public.establishment_role,
  professional_id uuid,
  status public.establishment_invite_status,
  sent_by_auth boolean,
  invited_at timestamptz,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_establishment_manager(p_establishment_id);

  update public.establishment_invitations i
  set status = 'accepted', accepted_at = u.last_sign_in_at
  from auth.users u
  where i.establishment_id = p_establishment_id
    and i.status = 'pending'
    and u.id = i.user_id
    and u.last_sign_in_at is not null;

  return query
    select i.id, i.email, i.name, i.role, i.professional_id, i.status, i.sent_by_auth,
           i.invited_at, i.accepted_at
    from public.establishment_invitations i
    where i.establishment_id = p_establishment_id
      and (i.status = 'pending' or i.updated_at >= now() - interval '30 days')
    order by i.status, i.invited_at desc;
end;
$$;

-- Revogar convite pendente tira o vínculo e solta a cadeira. A conta do Auth
-- fica: pode ser de alguém que usa o app do cliente.
create function public.establishment_revoke_invite(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_invite public.establishment_invitations;
begin
  select * into l_invite from public.establishment_invitations i where i.id = p_invitation_id for update;
  if not found or not public.has_establishment_role(l_invite.establishment_id, array['owner']::public.establishment_role[]) then
    raise exception 'Convite não encontrado.' using errcode = 'P0002', hint = 'not_found';
  end if;
  if l_invite.status <> 'pending' then
    raise exception 'Este convite já foi aceito ou revogado. Remova a pessoa pela equipe.'
      using errcode = 'P0001', hint = 'not_pending';
  end if;

  update public.establishment_invitations set status = 'revoked', revoked_at = now() where id = l_invite.id;
  delete from public.establishment_members m
  where m.establishment_id = l_invite.establishment_id and m.user_id = l_invite.user_id and m.role <> 'owner';
  update public.professionals p set user_id = null
  where p.establishment_id = l_invite.establishment_id and p.user_id = l_invite.user_id;
end;
$$;

revoke execute on function public.establishment_invite_check(uuid, text, public.establishment_role, uuid)
  from public, anon;
grant execute on function public.establishment_invite_check(uuid, text, public.establishment_role, uuid)
  to authenticated, service_role;
revoke execute on function public.establishment_add_member(uuid, text, text, public.establishment_role, uuid, boolean)
  from public, anon;
grant execute on function public.establishment_add_member(uuid, text, text, public.establishment_role, uuid, boolean)
  to authenticated, service_role;
revoke execute on function public.establishment_invites(uuid) from public, anon;
grant execute on function public.establishment_invites(uuid) to authenticated, service_role;
revoke execute on function public.establishment_revoke_invite(uuid) from public, anon;
grant execute on function public.establishment_revoke_invite(uuid) to authenticated, service_role;
