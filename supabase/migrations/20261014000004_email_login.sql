-- Sign-in moves from mobile number to email (no SMS provider needed).
-- The mobile number stays on the profile as optional contact information.
alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id;
update public.profiles set email = 'unknown+' || id || '@invalid' where email is null;
alter table public.profiles alter column email set not null;
create unique index profiles_email_key on public.profiles (lower(email));
alter table public.profiles alter column phone drop not null;
