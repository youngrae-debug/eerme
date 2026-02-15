import { t } from "./i18n";

const MAX_LINE_LENGTH = 120;

type ValidationFail = {
  ok: false;
  message: string;
};

type ValidationSuccess = {
  ok: true;
  value: [string, string, string];
};

export const validateLines = (lines: string[]): ValidationFail | ValidationSuccess => {
  const trimmed = lines.map((line) => line.trim());

  if (!trimmed.some(Boolean)) {
    return { ok: false, message: t("validationMinLine") };
  }

  const tooLong = trimmed.find((line) => line.length > MAX_LINE_LENGTH);
  if (tooLong) {
    return { ok: false, message: t("validationLineMax", { max: MAX_LINE_LENGTH }) };
  }

  return {
    ok: true,
    value: [trimmed[0], trimmed[1], trimmed[2]],
  };
};
