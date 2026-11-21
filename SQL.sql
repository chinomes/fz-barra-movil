insert into public.admin_users (user_id)
values ("ed5eca2c-7f28-4ebd-9ea6-20d61e973775")
on conflict (user_id) do nothing;
insert into public.admin_users (user_id)
values ('3d049e7f-4cf7-4fa7-8586-0aebd344ff9a')
on conflict (user_id) do nothing;
