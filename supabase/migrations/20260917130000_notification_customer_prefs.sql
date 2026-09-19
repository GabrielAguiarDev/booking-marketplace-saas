-- ---------------------------------------------------------------------------
-- Avisos ao cliente respeitam a escolha dele; lembrete e pedido de avaliação
-- ---------------------------------------------------------------------------
-- `20260917100000_notifications.sql` nasceu antes de `customer_notification_prefs`
-- (`20260917120000_cliente_conta.sql`) e deixou `notification_customer_allows`
-- respondendo sempre "sim". Aqui ela passa a ler a preferência. Sem linha vale
-- o padrão da tabela: operacional ligado, marketing desligado.
--
-- E duas preferências que já eram gravadas ganham quem as use:
--   `appointment_reminder` — lembrete 2 horas antes da reserva;
--   `review_request`       — pedido de avaliação 1 hora depois de concluída.

create or replace function public.notification_customer_allows(p_user_id uuid, p_pref text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and coalesce(
      (
        select case p_pref
          when 'queue_turn' then cp.queue_turn
          when 'appointment_reminder' then cp.appointment_reminder
          when 'appointment_changes' then cp.appointment_changes
          when 'review_request' then cp.review_request
          when 'marketing' then cp.marketing
        end
        from public.customer_notification_prefs cp
        where cp.customer_id = p_user_id
      ),
      p_pref <> 'marketing'
    );
$$;

revoke execute on function public.notification_customer_allows(uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pedido de avaliação
-- ---------------------------------------------------------------------------
-- A política de `reviews` só aceita avaliação de reserva concluída; este é o
-- momento em que ela passa a ser possível. Sai com uma hora de atraso para não
-- chegar com a pessoa ainda na cadeira.

create function public.notify_review_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_name text;
begin
  if new.status <> 'completed' or old.status = 'completed'
    or not public.notification_customer_allows(new.customer_id, 'review_request')
  then
    return new;
  end if;
  select e.name into l_name from public.establishments e where e.id = new.establishment_id;
  perform public.notify_enqueue(
    new.customer_id, 'push', 'review_request', 'Como foi em ' || l_name || '?',
    'Conte como foi o atendimento. Sua avaliação ajuda outras pessoas a escolher.',
    jsonb_build_object('type', 'review_request', 'appointment_id', new.id, 'establishment_id', new.establishment_id),
    'cliente', 'review_request:' || new.id, new.establishment_id, null, null,
    now() + interval '1 hour'
  );
  return new;
end;
$$;

revoke execute on function public.notify_review_request() from public, anon, authenticated, service_role;

create trigger appointments_notify_review_request
  after update of status on public.appointments
  for each row execute function public.notify_review_request();

-- ---------------------------------------------------------------------------
-- Lembrete de reserva
-- ---------------------------------------------------------------------------
-- O cron roda a cada 5 minutos e pega o que começa nas próximas 2 horas. Quem
-- reservou em cima da hora (menos de 2h de antecedência) não recebe: acabou de
-- marcar. A chave de deduplicação inclui o horário, então uma reserva
-- remarcada ganha lembrete novo.

create function public.notification_appointment_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_row record;
  l_count integer := 0;
begin
  for l_row in
    select a.id, a.customer_id, a.establishment_id, a.starts_at, e.name, s.name as service
    from public.appointments a
    join public.establishments e on e.id = a.establishment_id
    left join public.services s on s.id = a.service_id
    where a.status in ('scheduled', 'confirmed')
      and a.customer_id is not null
      and a.starts_at > now()
      and a.starts_at <= now() + interval '2 hours'
      and a.created_at < a.starts_at - interval '2 hours'
  loop
    if public.notification_customer_allows(l_row.customer_id, 'appointment_reminder') then
      perform public.notify_enqueue(
        l_row.customer_id, 'push', 'appointment_reminder', 'Sua reserva é daqui a pouco',
        coalesce(l_row.service, 'Seu horário') || ' em ' || l_row.name || ', '
          || public.notification_when(l_row.starts_at, l_row.establishment_id) || '.',
        jsonb_build_object('type', 'appointment', 'appointment_id', l_row.id, 'establishment_id', l_row.establishment_id),
        'cliente', 'appointment_reminder:' || l_row.id || ':' || extract(epoch from l_row.starts_at)::bigint,
        l_row.establishment_id
      );
      l_count := l_count + 1;
    end if;
  end loop;
  return l_count;
end;
$$;

revoke execute on function public.notification_appointment_reminders() from public, anon, authenticated;
grant execute on function public.notification_appointment_reminders() to service_role;

select cron.schedule('notifications-appointment-reminders', '*/5 * * * *',
                     'select public.notification_appointment_reminders()');
