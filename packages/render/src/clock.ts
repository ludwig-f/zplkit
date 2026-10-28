/**
 * ^FC: field data with clock codes like %Y-%m-%d, filled in from the
 * printer's clock. The codes are the ones reference renders fill in; others
 * print as they are.
 */

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

/** Day of the year, from 0 */
const dayOfYear = (date: Date) =>
  Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 1)) /
      86_400_000
  );

const codes: Record<string, (date: Date) => string> = {
  Y: (date) => String(date.getFullYear()),
  y: (date) => pad(date.getFullYear() % 100),
  m: (date) => pad(date.getMonth() + 1),
  d: (date) => pad(date.getDate()),
  H: (date) => pad(date.getHours()),
  M: (date) => pad(date.getMinutes()),
  S: (date) => pad(date.getSeconds()),
  I: (date) => pad(((date.getHours() + 11) % 12) + 1),
  p: (date) => (date.getHours() < 12 ? "AM" : "PM"),
  j: (date) => pad(dayOfYear(date) + 1, 3),
  b: (date) => months[date.getMonth()].slice(0, 3),
  B: (date) => months[date.getMonth()],
  a: (date) => days[date.getDay()].slice(0, 3),
  A: (date) => days[date.getDay()],
  w: (date) => String(date.getDay()),
  // Weeks starting on Sunday (U) or Monday (W), the first from that day on
  U: (date) => pad(Math.floor((dayOfYear(date) + 7 - date.getDay()) / 7)),
  W: (date) =>
    pad(Math.floor((dayOfYear(date) + 7 - ((date.getDay() + 6) % 7)) / 7)),
};

/** Field data with each clock code after one of the indicators filled in */
const formatClock = (
  data: string,
  indicators: readonly string[],
  clock: Date
): string => {
  let result = "";
  for (let i = 0; i < data.length; i++) {
    const code = codes[data[i + 1]];
    if (indicators.includes(data[i]) && code) {
      result += code(clock);
      i++;
    } else {
      result += data[i];
    }
  }
  return result;
};

export { formatClock };
