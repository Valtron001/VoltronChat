const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://lkuscpoliusttczzzcnxc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // ← вставь весь ключ

const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = supabase;