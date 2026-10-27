import {
  Label,
  Text,
  Box,
  Code128,
  DataMatrix,
  QrCode,
  Raw,
  build,
  dots,
  mm,
} from "@zplkit/core/jsx";

/** 4 × 6 in at 203 dpi: 812 × 1218 dots */
export const shippingLabelSize = {
  widthMm: 101.5,
  heightMm: 152.25,
  dpmm: 8 as const,
};

type Order = {
  name: string;
  street: string;
  city: string;
  /** The routing code printed large, here the postcode */
  route: string;
  tracking: string;
  zone: string;
  weight: string;
  /** Free text from the shop, which may hold characters ZPL escapes */
  reference: string;
  date: string;
};

/**
 * Orders for the labels the home page prints, from across Europe. Names
 * and streets use the accented letters font 0 has, and references carry
 * ^, ~ and _, which zplkit escapes in field data.
 */
export const orders: Order[] = [
  {
    name: "AMARA OKAFOR",
    street: "41 HARBOUR ST",
    city: "GLASGOW G1 4QE",
    route: "G1 4QE",
    tracking: "1ZK4F9W82034417",
    zone: "07",
    weight: "2.4 KG",
    reference: "PO-55821",
    date: "2026-10-24",
  },
  {
    name: "JÖRG MÜLLER",
    street: "KÖNIGSALLEE 27",
    city: "40212 DÜSSELDORF",
    route: "40212",
    tracking: "1ZK4F9W82034501",
    zone: "12",
    weight: "0.8 KG",
    reference: "A~7_44",
    date: "2026-10-24",
  },
  {
    name: "ZOFIA ŁUKASZEWSKA",
    street: "UL. ŻYTNIA 14/3",
    city: "01-014 WARSZAWA",
    route: "01-014",
    tracking: "1ZK4F9W82034588",
    zone: "21",
    weight: "5.1 KG",
    reference: "ZAM. 2026/1182",
    date: "2026-10-25",
  },
  {
    name: "SØREN ÅBERG",
    street: "NØRREGADE 8, 2. TV.",
    city: "1165 KØBENHAVN K",
    route: "1165",
    tracking: "1ZK4F9W82034612",
    zone: "15",
    weight: "1.2 KG",
    reference: "SKU 22^4-B",
    date: "2026-10-25",
  },
  {
    name: "FRANÇOIS LEFÈVRE",
    street: "12 RUE DE L’ÉGLISE",
    city: "69002 LYON",
    route: "69002",
    tracking: "1ZK4F9W82034679",
    zone: "09",
    weight: "3.7 KG",
    reference: "CMD_8812",
    date: "2026-10-26",
  },
  {
    name: "ŞEYMA YILDIZ",
    street: "İSTİKLAL CAD. 112",
    city: "34433 İSTANBUL",
    route: "34433",
    tracking: "1ZK4F9W82034733",
    zone: "31",
    weight: "0.4 KG",
    reference: "SİP-4471",
    date: "2026-10-26",
  },
  {
    name: "INÉS NÚÑEZ",
    street: "CALLE DE LA MONCLOA 9",
    city: "28008 MADRID",
    route: "28008",
    tracking: "1ZK4F9W82034790",
    zone: "18",
    weight: "2.0 KG",
    reference: "PED~0937",
    date: "2026-10-27",
  },
];

const Line = ({ y, thickness }: { y: number; thickness: number }) => (
  <Box
    x={dots(36)}
    y={dots(y)}
    width={dots(740)}
    height={dots(thickness)}
    thickness={dots(thickness)}
  />
);

/** A shipping label for an order, built with zplkit's JSX */
export const shippingLabelFor = (order: Order) =>
  build(
    <Label
      width={mm(shippingLabelSize.widthMm)}
      height={mm(shippingLabelSize.heightMm)}
      dpmm={shippingLabelSize.dpmm}
    >
      <Text x={dots(36)} y={dots(40)} height={dots(26)}>
        FROM: HARBOR PARTS CO.
      </Text>
      <Text x={dots(36)} y={dots(72)} height={dots(26)}>
        12 DOCK RD, UNIT 4
      </Text>
      <Text x={dots(36)} y={dots(104)} height={dots(26)}>
        LEEDS LS9 0AB
      </Text>
      <Box
        x={dots(652)}
        y={dots(28)}
        width={dots(124)}
        height={dots(124)}
        thickness={dots(124)}
      />
      {/* A priority mark: the letter reverses the box under it */}
      <Raw zpl="^FO676,40^FR^A0N,118,104^FDP^FS" />
      <Line y={170} thickness={6} />

      <Text x={dots(36)} y={dots(192)} height={dots(26)}>
        SHIP TO
      </Text>
      <Text x={dots(36)} y={dots(226)} height={dots(60)}>
        {order.name}
      </Text>
      <Text x={dots(36)} y={dots(292)} height={dots(42)}>
        {order.street}
      </Text>
      <Text x={dots(36)} y={dots(338)} height={dots(42)}>
        {order.city}
      </Text>
      <Line y={398} thickness={3} />

      <DataMatrix x={dots(40)} y={dots(420)} moduleSize={dots(8)}>
        {`ZK-55821-${order.tracking}`}
      </DataMatrix>
      <Text x={dots(250)} y={dots(428)} height={dots(110)}>
        {order.route}
      </Text>
      <Text x={dots(254)} y={dots(548)} height={dots(30)}>
        PKG 1 OF 2 · ZONE {order.zone}
      </Text>
      <Line y={604} thickness={6} />

      <Text x={dots(36)} y={dots(626)} height={dots(24)}>
        TRACKING #
      </Text>
      {/* Wider bars than the default 2 dots, to fill the label */}
      <Raw zpl="^BY3" />
      <Code128 x={dots(70)} y={dots(664)} height={dots(200)}>
        {order.tracking}
      </Code128>
      <Line y={936} thickness={3} />

      <QrCode x={dots(32)} y={dots(946)} moduleSize={dots(6)}>
        {`QA,https://zplkit.fingal.dev/t/${order.tracking}`}
      </QrCode>
      <Text x={dots(290)} y={dots(990)} height={dots(32)}>
        WEIGHT {order.weight}
      </Text>
      <Text x={dots(290)} y={dots(1034)} height={dots(32)}>
        REF {order.reference}
      </Text>
      <Text x={dots(290)} y={dots(1078)} height={dots(32)}>
        SHIP {order.date}
      </Text>
    </Label>
  );

/** The first order's label, shown first and in the rendering section */
export const shippingLabel = shippingLabelFor(orders[0]);
