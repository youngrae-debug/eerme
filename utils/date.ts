export const toDateKey = (date: Date = new Date()) => date.toISOString().slice(0, 10);

export const formatDateDisplay = (dateKey: string) => {
  const date = new Date(dateKey);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
};
