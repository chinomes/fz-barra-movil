insert into public.admin_users (user_id)
values ("ed5eca2c-7f28-4ebd-9ea6-20d61e973775")
on conflict (user_id) do nothing;
