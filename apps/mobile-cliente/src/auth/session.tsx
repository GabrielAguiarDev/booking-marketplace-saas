import { createSessionContext } from "@vez/mobile-kit/auth";

import { supabase } from "../../lib/supabase";

/**
 * Amarra o provider de sessão do kit ao cliente Supabase deste app.
 *
 * O par nasce aqui, e não no pacote, porque o app do cliente e o do
 * estabelecimento guardam sessões separadas no mesmo aparelho.
 */
export const { SessionProvider, useSession } = createSessionContext(supabase);
