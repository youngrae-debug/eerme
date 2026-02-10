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
    return { ok: false, message: "최소 한 줄은 작성해 주세요." };
  }

  const tooLong = trimmed.find((line) => line.length > MAX_LINE_LENGTH);
  if (tooLong) {
    return { ok: false, message: `한 줄은 ${MAX_LINE_LENGTH}자 이하로 입력해 주세요.` };
  }

  return {
    ok: true,
    value: [trimmed[0], trimmed[1], trimmed[2]],
  };
};
