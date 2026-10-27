import { test, expect } from "vitest";
import { orders, shippingLabelFor } from "./shipping-label";

test.each(orders.map((order) => [order.name, order] as const))(
  "the label for %s has no problems",
  (_, order) => {
    expect(shippingLabelFor(order).lint()).toStrictEqual([]);
  }
);

test("references with ^ and ~ are escaped, not read as commands", () => {
  const order = orders.find((o) => o.reference.includes("^"))!;
  const zpl = shippingLabelFor(order).toZPL();
  expect(zpl).toContain("^FH");
  expect(zpl).not.toContain(`^FDREF ${order.reference}`);
});
