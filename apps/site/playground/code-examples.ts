/** zplkit code to start from in the playground */
type CodeExample = { name: string; code: string };

const shippingLabel = `import { Label, Text, Box, Code128, QrCode, build, inches, mm, dots } from "@zplkit/core/jsx";

const order = {
  id: 10442,
  express: true,
  from: ["Harbor Parts Co.", "1000 Shipping Lane", "Shelbyville TN 38102"],
  to: ["John Doe", "100 Main Street", "Springfield IL 62701"],
};

// Lines of text, each a little further down than the last
const Lines = (props: { x: number; y: number; size: number; lines: string[] }) => (
  <>
    {props.lines.map((line, index) => (
      <Text x={mm(props.x)} y={mm(props.y + index * props.size * 1.3)} height={mm(props.size)}>
        {line}
      </Text>
    ))}
  </>
);

const Rule = (props: { y: number }) => (
  <Box x={mm(6)} y={mm(props.y)} width={mm(89.6)} height={dots(3)} thickness={dots(3)} />
);

const label = build(
  <Label width={inches(4)} height={inches(6)} dpmm={8}>
    <Text x={mm(6)} y={mm(6)} height={mm(3)}>FROM</Text>
    <Lines x={6} y={11} size={3.5} lines={order.from} />
    {order.express && (
      <>
        <Box x={mm(66)} y={mm(6)} width={mm(29.6)} height={mm(12)} thickness={dots(4)} />
        <Text x={mm(69)} y={mm(9)} height={mm(6)}>EXPRESS</Text>
      </>
    )}
    <Rule y={28} />
    <Text x={mm(6)} y={mm(33)} height={mm(3)}>TO</Text>
    <Lines x={6} y={39} size={6} lines={order.to} />
    <Rule y={66} />
    <Code128 x={mm(10)} y={mm(74)} height={mm(25)}>{\`ORD-\${order.id}\`}</Code128>
    <Rule y={110} />
    <Text x={mm(6)} y={mm(118)} height={mm(5)}>Order #{order.id}</Text>
    <Text x={mm(6)} y={mm(126)} height={mm(3.5)}>Scan to track this parcel</Text>
    <QrCode x={mm(68)} y={mm(114)} moduleSize={dots(5)}>
      {\`https://example.com/track/\${order.id}\`}
    </QrCode>
  </Label>
);

export default label;
`;

const productLabels = `import { Label, Text, EAN13, build, mm } from "@zplkit/core/jsx";
import { PrintJob } from "@zplkit/core";

const products = [
  { name: "Oat drink", size: "1 L", price: 2.49, ean: "735000120004" },
  { name: "Rye crackers", size: "250 g", price: 3.9, ean: "735000120011" },
  { name: "Lingonberry jam", size: "400 g", price: 4.25, ean: "735000120028" },
];

type Product = (typeof products)[number];

const ProductLabel = ({ product }: { product: Product }) => (
  <Label width={mm(57)} height={mm(32)} dpmm={8}>
    <Text x={mm(3)} y={mm(3)} height={mm(4)}>{product.name}</Text>
    <Text x={mm(3)} y={mm(8.5)} height={mm(3)}>{product.size}</Text>
    <Text x={mm(38)} y={mm(3)} height={mm(7)}>{product.price.toFixed(2)}</Text>
    <EAN13 x={mm(3)} y={mm(15)} height={mm(9)}>{product.ean}</EAN13>
  </Label>
);

// One label per product, sent to the printer together
export default new PrintJob(
  ...products.map((product) => build(<ProductLabel product={product} />))
);
`;

const numberedBoxes = `import { Label, Text, Code128, build, inches, mm } from "@zplkit/core/jsx";

// One label, printed 6 times. serial counts the number at the end up on
// each copy, so the printer prints BOX-001 to BOX-006.
const label = build(
  <Label width={inches(2)} height={inches(1)} dpmm={8} copies={6}>
    <Text x={mm(2.5)} y={mm(2)} height={mm(3)}>Box</Text>
    <Text x={mm(2.5)} y={mm(5.5)} height={mm(7)} serial={{}}>BOX-001</Text>
    <Code128 x={mm(2.5)} y={mm(14)} height={mm(7.5)} serial={{}}>BOX-001</Code128>
  </Label>
);

export default label;
`;

const helloLabel = `import { Label, Text, Box, build, inches, mm, dots } from "@zplkit/core/jsx";

// Change the code and the label redraws. Lengths take mm(), inches() or dots().
const label = build(
  <Label width={inches(2)} height={inches(1)} dpmm={8}>
    <Text x={mm(4)} y={mm(4)} height={mm(6)}>Hello, zplkit</Text>
    <Box x={mm(4)} y={mm(13)} width={mm(42.8)} height={dots(3)} thickness={dots(3)} />
    <Text x={mm(4)} y={mm(16)} height={mm(3.5)}>Built with JSX</Text>
  </Label>
);

export default label;
`;

/** An empty 2 × 1 inch label, for "Start from a blank label" */
const blankLabel = `import { Label, Text, build, inches, mm } from "@zplkit/core/jsx";

const label = build(
  <Label width={inches(2)} height={inches(1)} dpmm={8}>
    <Text x={mm(4)} y={mm(4)} height={mm(5)}>Text</Text>
  </Label>
);

export default label;
`;

const codeExamples: CodeExample[] = [
  { name: "Shipping label", code: shippingLabel },
  { name: "Product labels", code: productLabels },
  { name: "Numbered boxes", code: numberedBoxes },
  { name: "Hello", code: helloLabel },
];

export default codeExamples;
export { blankLabel };
export type { CodeExample };
