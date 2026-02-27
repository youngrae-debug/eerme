import { t } from "./i18n";

const AUTH_ERROR_MAPPINGS: Array<{ token: string; messageKey: string }> = [
  { token: "auth/invalid-email", messageKey: "authInvalidEmail" },
  { token: "invalid_login_credentials", messageKey: "syncAuthInvalidCredentials" },
  { token: "auth/invalid-credential", messageKey: "syncAuthInvalidCredentials" },
  { token: "auth/wrong-password", messageKey: "syncAuthInvalidCredentials" },
  { token: "auth/user-not-found", messageKey: "syncAuthInvalidCredentials" },
  { token: "auth/email-already-in-use", messageKey: "syncAuthEmailExists" },
  { token: "email_exists", messageKey: "syncAuthEmailExists" },
  { token: "auth/too-many-requests", messageKey: "syncAuthFailed" },
  { token: "auth/user-disabled", messageKey: "syncAuthFailed" },
  { token: "auth/network-request-failed", messageKey: "syncFailed" },
  { token: "auth/weak-password", messageKey: "authPasswordWeak" },
];

export const resolveAuthErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return t("authFailed");

  const normalized = error.message.toLowerCase();

  for (const { token, messageKey } of AUTH_ERROR_MAPPINGS) {
    if (normalized.includes(token)) {
      return t(messageKey);
    }
  }

  return t("authFailed");
};

