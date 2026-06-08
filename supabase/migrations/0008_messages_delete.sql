-- Permet au MJ d'effacer la conversation (suppression de messages).

drop policy if exists "messages_delete_dm" on public.messages;

create policy "messages_delete_dm"
  on public.messages for delete to authenticated
  using ( public.is_dm() );
