const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://lkuscpoliusttczzcnxc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdXNjcG9saXVzdHRjenpjbnhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNzE3NzAsImV4cCI6MjA2NzY0Nzc3MH0.66_hX0eZAMuTsRGmlrsxhB3Cah1Xr70XMgH4nVsVnWU"; // ← вставь весь ключ

const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = supabase;