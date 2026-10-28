// Codes measured from reference renders of ^FC
import { test, expect } from "vitest";
import { formatClock } from "./clock.js";

// Wednesday 28 October 2026, 07:38:44
const clock = new Date(2026, 9, 28, 7, 38, 44);

test("fills in the date and time", () => {
  expect(formatClock("%Y-%m-%d %H:%M:%S", ["%"], clock)).toBe(
    "2026-10-28 07:38:44"
  );
});

test("names days and months in English", () => {
  expect(formatClock("%y %b %B %a %A %d", ["%"], clock)).toBe(
    "26 Oct October Wed Wednesday 28"
  );
});

test("gives the 12-hour clock, day of the year and weeks", () => {
  expect(formatClock("%I %p %j %U %W %w", ["%"], clock)).toBe(
    "07 AM 301 43 43 3"
  );
  expect(formatClock("%I %p", ["%"], new Date(2026, 9, 28, 0, 5))).toBe(
    "12 AM"
  );
  expect(formatClock("%I %p", ["%"], new Date(2026, 9, 28, 13, 5))).toBe(
    "01 PM"
  );
});

test("leaves other codes and characters as they are", () => {
  expect(formatClock("%e %% %h", ["%"], clock)).toBe("%e %% %h");
  expect(formatClock("#Y-#m %Y", ["#"], clock)).toBe("2026-10 %Y");
});

test("reads every indicator", () => {
  expect(formatClock("%d {d #d", ["%", "{", "#"], clock)).toBe("28 28 28");
});
