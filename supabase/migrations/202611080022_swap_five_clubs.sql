-- Swap five clubs in place (ids and all linked players, squads, matches and stats are kept).
--   Montpellier HSC       -> Paris FC
--   Stade de Reims        -> ESTAC Troyes
--   Girondins de Bordeaux -> FC Lorient
--   Saint-Etienne         -> AJ Auxerre
--   Nantes FC             -> Le Mans FC
update public.clubs c
set name = v.new_name, short_name = v.new_short
from (values
  ('00000000-0000-0000-0001-000000000010'::uuid, 'Paris FC',     'PFC'),
  ('00000000-0000-0000-0001-000000000015'::uuid, 'ESTAC Troyes', 'ESTAC'),
  ('00000000-0000-0000-0001-000000000016'::uuid, 'FC Lorient',   'FCL'),
  ('00000000-0000-0000-0001-000000000017'::uuid, 'AJ Auxerre',   'AJA'),
  ('00000000-0000-0000-0001-000000000013'::uuid, 'Le Mans FC',   'MANS')
) as v(id, new_name, new_short)
where c.id = v.id;
