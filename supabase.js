import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://wjuxmkynxtgscgqomvul.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iAdUEGJl7Cw8SB-JQAqqpg_AEIEAf6y";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
