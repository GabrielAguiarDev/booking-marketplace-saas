import { createSessionContext } from "@vez/mobile-kit/auth";

import { supabase } from "../../lib/supabase";

/**
 * Amarra o provider de sessão do kit ao cliente Supabase deste app.
 *
 * Cada app tem o seu: o dono da barbearia é cliente de outra barbearia, e as
 * duas sessões convivem no mesmo aparelho sem se derrubar.
 */
export const { SessionProvider, useSession } = createSessionContext(supabase);
