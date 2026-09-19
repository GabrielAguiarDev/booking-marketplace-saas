import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Deep links do app da loja.
 *
 * O esquema `vezstaff://` vem do `app.json` e funciona sempre, inclusive no
 * Expo Go. O link universal (`https://<host>/agendamento/<id>` abrindo direto
 * no app) depende de um domínio que ainda não existe, então só é declarado
 * quando `EXPO_PUBLIC_STAFF_LINK_HOST` estiver definido — declarar um domínio
 * sem o arquivo de associação publicado nele faria o Android recusar a
 * verificação e o iOS ignorar o link.
 *
 * Com o host definido, o domínio precisa servir
 * `/.well-known/apple-app-site-association` e `/.well-known/assetlinks.json`
 * para `app.vez.vez-staff` / `app.vez.vezstaff`. Mudar isto exige gerar o
 * projeto nativo de novo (`expo prebuild` ou build do EAS).
 *
 * A tradução do link para a rota fica em `app/+native-intent.tsx`.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const host = process.env.EXPO_PUBLIC_STAFF_LINK_HOST?.trim().replace(/^https?:\/\//, "");
  const base = config as ExpoConfig;
  if (!host) return base;

  return {
    ...base,
    ios: {
      ...base.ios,
      associatedDomains: [...(base.ios?.associatedDomains ?? []), `applinks:${host}`],
    },
    android: {
      ...base.android,
      intentFilters: [
        ...(base.android?.intentFilters ?? []),
        {
          action: "VIEW",
          autoVerify: true,
          data: [{ scheme: "https", host }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
  };
};
