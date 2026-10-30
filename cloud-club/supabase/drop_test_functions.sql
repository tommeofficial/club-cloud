-- Run before opening the app to the public: removes the free test purchase functions.
drop function if exists public.test_buy_hours(integer);
drop function if exists public.test_set_pro(integer);
