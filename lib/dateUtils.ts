export function monthRange(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function monthLabel(year: number, monthIndex: number) {
  const label = new Date(year, monthIndex, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// count = quantos meses pra trás; monthsAhead = quantos meses pra frente (planejamento,
// ex: agendar vídeos ou contas de um mês que ainda não chegou)
export function monthOptions(count = 12, monthsAhead = 6) {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = -monthsAhead; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: monthLabel(d.getFullYear(), d.getMonth()) });
  }
  return options;
}

export function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthValueRange(value: string) {
  const [year, month] = value.split("-").map(Number);
  return monthRange(year, month - 1);
}

export function yearOptions(back = 5) {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - back; y--) {
    options.push({ value: String(y), label: String(y) });
  }
  return options;
}
