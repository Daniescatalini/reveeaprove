drop policy if exists "comments delete own scoped" on public.comments;

create policy "comments delete own scoped"
on public.comments for delete
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and public.can_access_client(p.client_id)
  )
);
