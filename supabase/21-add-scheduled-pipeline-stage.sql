alter type public.pipeline_stage add value if not exists 'scheduled';

update public.posts
set pipeline_stage = 'revision'
where status = 'revision_requested'
  and pipeline_stage is distinct from 'revision';

update public.posts
set pipeline_stage = 'scheduled'
where status = 'scheduled'
  and pipeline_stage is distinct from 'scheduled';

update public.posts
set pipeline_stage = 'approved'
where status = 'approved'
  and pipeline_stage is distinct from 'approved';

update public.posts
set pipeline_stage = 'published'
where status = 'published'
  and pipeline_stage is distinct from 'published';

notify pgrst, 'reload schema';
