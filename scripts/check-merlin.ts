import { createSupabaseAdminClient } from "../src/lib/supabase/server";

async function check() {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('players').select('first_name, last_name, clubs(name)').ilike('last_name', '%Merlin%');
  console.log(JSON.stringify(data, null, 2));
}

check();
