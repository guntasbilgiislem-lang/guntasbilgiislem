const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://idgczlqrrfcfwztfdrjj.supabase.co', 'sb_publishable_k88OEJ2d2PTcxwVLqHXrVA_b4UGy1-p');

async function test() {
  const { data, error } = await supabase.from('branches').select('*');
  console.log('Data:', data);
  console.log('Error:', error);
}

test();
