-- Seed built-in datasets and starter public exercises for the gym library.
-- Uses a fixed system author so exercises are readable by all authenticated users.

DO $$
DECLARE
  system_id uuid := '00000000-0000-4000-a000-000000000001';
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    system_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'system@gymjaim.app',
    crypt('seed-only-not-for-login', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"GymJaim"}'::jsonb,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, display_name)
  VALUES (system_id, 'GymJaim')
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.datasets (id, owner_id, name, description, builtin_key, columns, is_public, is_builtin)
VALUES
  (
    '11111111-1111-4111-8111-111111111001',
    NULL,
    'Restaurant tips',
    'Classic tipping dataset — total bill, tip, party size, and more.',
    'tips',
    '["total_bill","tip","sex","smoker","day","time","size"]'::jsonb,
    true,
    true
  ),
  (
    '11111111-1111-4111-8111-111111111002',
    NULL,
    'Palmer penguins',
    'Antarctic penguin measurements by species and island.',
    'penguins',
    '["species","island","bill_length_mm","bill_depth_mm","flipper_length_mm","body_mass_g","sex"]'::jsonb,
    true,
    true
  ),
  (
    '11111111-1111-4111-8111-111111111003',
    NULL,
    'Auto MPG',
    'Fuel economy and engine specs for classic cars.',
    'mpg',
    '["mpg","cylinders","displacement","horsepower","weight","acceleration","model_year","origin","name"]'::jsonb,
    true,
    true
  ),
  (
    '11111111-1111-4111-8111-111111111005',
    NULL,
    'US car crashes',
    'State-level crash rates and contributing factors.',
    'car_crashes',
    '["total","speeding","alcohol","not_distracted","no_previous","ins_premium","ins_losses","abbrev"]'::jsonb,
    true,
    true
  ),
  (
    '11111111-1111-4111-8111-111111111006',
    NULL,
    'Exoplanets',
    'Confirmed exoplanets — orbital period, mass, distance.',
    'planets',
    '["method","number","orbital_period","mass","distance","year"]'::jsonb,
    true,
    true
  ),
  (
    '11111111-1111-4111-8111-111111111007',
    NULL,
    'Health spending',
    'Country-level health spending vs life expectancy over time.',
    'healthexp',
    '["Year","Country","Spending_USD","Life_Expectancy"]'::jsonb,
    true,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  builtin_key = EXCLUDED.builtin_key,
  columns = EXCLUDED.columns,
  is_public = EXCLUDED.is_public,
  is_builtin = EXCLUDED.is_builtin;

INSERT INTO public.exercises (
  id,
  author_id,
  title,
  description,
  dataset_id,
  target_col,
  y_col,
  condition_col,
  difficulty,
  visibility
)
VALUES
  (
    '22222222-2222-4222-8222-222222222001',
    '00000000-0000-4000-a000-000000000001',
    'Your first rep: tip vs. bill',
    'Classic restaurant data. Some tip values vanish at random (MCAR). Impute them so the regression of tip on total_bill matches the ground truth. Mean fill is a fine first try.',
    '11111111-1111-4111-8111-111111111001',
    'tip',
    'total_bill',
    'size',
    'easy',
    'public'
  ),
  (
    '22222222-2222-4222-8222-222222222002',
    '00000000-0000-4000-a000-000000000001',
    'MPG vs. horsepower',
    'How does fuel economy relate to engine power? Horsepower readings go missing at random. Fill them in and check your slope against the oracle.',
    '11111111-1111-4111-8111-111111111003',
    'horsepower',
    'mpg',
    'weight',
    'easy',
    'public'
  ),
  (
    '22222222-2222-4222-8222-222222222003',
    '00000000-0000-4000-a000-000000000001',
    'Penguin bill length',
    'Bill length goes missing conditional on body mass — not random. Heavier birds lose measurements in a biased pattern. Can you recover the flipper-length regression?',
    '11111111-1111-4111-8111-111111111002',
    'bill_length_mm',
    'flipper_length_mm',
    'body_mass_g',
    'medium',
    'public'
  ),
  (
    '22222222-2222-4222-8222-222222222004',
    '00000000-0000-4000-a000-000000000001',
    'Crash rates & alcohol',
    'State alcohol-involved crash rates vs total crashes. Missingness depends on speeding rates. A realistic “conditional on another variable” rep.',
    '11111111-1111-4111-8111-111111111005',
    'alcohol',
    'total',
    'speeding',
    'medium',
    'public'
  ),
  (
    '22222222-2222-4222-8222-222222222005',
    '00000000-0000-4000-a000-000000000001',
    'Life expectancy & health spending',
    'Hard mode: life expectancy values disappear in a quartile-skewed, year-conditional pattern. This is the judgment call your notebook rarely lets you retry.',
    '11111111-1111-4111-8111-111111111007',
    'Life_Expectancy',
    'Spending_USD',
    'Year',
    'hard',
    'public'
  ),
  (
    '22222222-2222-4222-8222-222222222006',
    '00000000-0000-4000-a000-000000000001',
    'Planetary mass & orbital period',
    'Exoplanet masses go missing in the trickiest pattern — conditional and quartile-biased. Regress mass on orbital period after imputing.',
    '11111111-1111-4111-8111-111111111006',
    'mass',
    'orbital_period',
    'distance',
    'hard',
    'public'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  dataset_id = EXCLUDED.dataset_id,
  target_col = EXCLUDED.target_col,
  y_col = EXCLUDED.y_col,
  condition_col = EXCLUDED.condition_col,
  difficulty = EXCLUDED.difficulty,
  visibility = EXCLUDED.visibility;
