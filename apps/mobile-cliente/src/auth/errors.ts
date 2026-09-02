import { AuthError } from "@supabase/supabase-js";

/**
 * Traduz o erro do Supabase para uma frase que o usuário entenda.
 *
 * O Supabase responde em inglês e com vocabulário de backend
 * ("Invalid login credentials"). Mostrar isso cru é empurrar para o usuário a
 * tarefa de traduzir e de adivinhar o que fazer a seguir.
 *
 * O mapeamento é por `code`, que é estável, e não pela mensagem, que muda entre
 * versões. O texto padrão nunca é vazio: erro sem frase vira tela travada sem
 * explicação nenhuma.
 */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof AuthError)) {
    return "Não foi possível conectar. Verifique sua internet e tente de novo.";
  }

  switch (error.code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar.";
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com esse e-mail.";
    case "weak_password":
      return "Senha fraca. Use ao menos 8 caracteres.";
    // O Supabase devolve `otp_expired` tanto para código expirado quanto para
    // código errado — não dá para distinguir, então a frase cobre os dois.
    case "otp_expired":
      return "Código inválido ou expirado. Peça um novo.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
    case "same_password":
      return "A senha nova precisa ser diferente da anterior.";
    case "validation_failed":
      return "Confira os dados preenchidos.";
    case "user_not_found":
      return "Não encontramos uma conta com esse e-mail.";
    default:
      return "Algo deu errado. Tente de novo em instantes.";
  }
}
