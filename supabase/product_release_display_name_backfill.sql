begin;

with profile_names as (
  select
    lower(trim(email)) as email_key,
    nullif(trim(display_name), '') as display_name
  from public.dir_user_profiles
  where nullif(trim(email), '') is not null
    and nullif(trim(display_name), '') is not null
)
update public.pl_packing_items as items
set
  released_by = profile_names.display_name,
  updated_at = coalesce(items.updated_at, now())
from profile_names
where lower(trim(items.released_by)) = profile_names.email_key
  and items.released_by is distinct from profile_names.display_name;

with profile_names as (
  select
    lower(trim(email)) as email_key,
    nullif(trim(display_name), '') as display_name
  from public.dir_user_profiles
  where nullif(trim(email), '') is not null
    and nullif(trim(display_name), '') is not null
)
update public.dir_product_model_variant_release_states as states
set
  released_by = profile_names.display_name,
  updated_at = now()
from profile_names
where lower(trim(states.released_by)) = profile_names.email_key
  and states.released_by is distinct from profile_names.display_name;

with profile_names as (
  select
    lower(trim(email)) as email_key,
    nullif(trim(display_name), '') as display_name
  from public.dir_user_profiles
  where nullif(trim(email), '') is not null
    and nullif(trim(display_name), '') is not null
),
mapped_history as (
  select
    states.id,
    jsonb_agg(
      case
        when profile_names.display_name is not null
          then jsonb_set(event.value, '{released_by}', to_jsonb(profile_names.display_name), true)
        else event.value
      end
      order by event.ordinality
    ) as release_history
  from public.dir_product_model_variant_release_states as states
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(coalesce(states.release_history, '[]'::jsonb)) = 'array'
        then coalesce(states.release_history, '[]'::jsonb)
      else '[]'::jsonb
    end
  ) with ordinality as event(value, ordinality)
  left join profile_names
    on lower(trim(event.value ->> 'released_by')) = profile_names.email_key
  where jsonb_typeof(coalesce(states.release_history, '[]'::jsonb)) = 'array'
  group by states.id
)
update public.dir_product_model_variant_release_states as states
set
  release_history = mapped_history.release_history,
  updated_at = now()
from mapped_history
where states.id = mapped_history.id
  and states.release_history is distinct from mapped_history.release_history;

commit;
