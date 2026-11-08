import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://duufnkszflcgcknlvtlz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1dWZua3N6ZmxjZ2Nrbmx2dGx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTgwMTU0MSwiZXhwIjoyMTA1Mzc3NTQxfQ.1VebJjlQh0slSvNOonzo5jxVWRmLcjXjMN-ea5BFc6c'
);

async function run() {
  const { data } = await supabase.from('clubs').select('name');
  console.log("ALL CLUBS:", data);
  const { data: merlin } = await supabase.from('players').select('first_name, last_name, clubs(name)').ilike('last_name', '%Merlin%');
  console.log("MERLIN:", merlin);
}

run();
