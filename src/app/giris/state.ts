/** Login is two steps in one form: ask for the e-mail, then for the code sent to it. */
export type LoginState =
  | { step: "email"; email?: string; error?: string }
  | { step: "code"; email: string; error?: string; notice?: string };

export const initialLoginState: LoginState = { step: "email" };
