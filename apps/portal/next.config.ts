import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mantém localhost para uso normal e permite o host isolado usado nos testes
  // do portal, sem compartilhar os cookies do admin em outra porta.
  allowedDevOrigins: ["127.0.0.1"],
  // O pacote é publicado como TypeScript, sem build próprio.
  transpilePackages: ["@vez/supabase"],
  // Sem isto o Next infere a raiz do projeto como a pasta do app e o trace de
  // arquivos da build no monorepo sai incompleto.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
