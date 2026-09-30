-- Store detailed D1 manual judgments and make client retries idempotent.

alter table public.training_attempts
  add column if not exists client_event_id uuid,
  add column if not exists response_data jsonb not null default '{}';

create unique index if not exists training_attempts_client_event_id_key
  on public.training_attempts(client_event_id)
  where client_event_id is not null;
