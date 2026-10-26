import type { LabelLength } from "./share";

/** Example labels to start from */
const examples: {
  name: string;
  zpl: string;
  width: LabelLength | undefined;
  height: LabelLength | undefined;
  dpmm: number;
}[] = [
  {
    name: "Shipping label",
    width: { inches: 4 },
    height: { inches: 6 },
    dpmm: 8,
    zpl: `^XA

^FX Top section with logo, name and address.
^CF0,60
^FO50,50^GB100,100,100^FS
^FO75,75^FR^GB100,100,100^FS
^FO93,93^GB40,40,40^FS
^FO220,50^FDIntershipping, Inc.^FS
^CF0,30
^FO220,115^FD1000 Shipping Lane^FS
^FO220,155^FDShelbyville TN 38102^FS
^FO50,250^GB700,3,3^FS

^FX Second section with recipient address and permit information.
^CFA,30
^FO50,300^FDJohn Doe^FS
^FO50,340^FD100 Main Street^FS
^CFA,15
^FO600,300^GB150,150,3^FS
^FO638,340^FDPermit^FS
^FO638,390^FD123456^FS
^FO50,500^GB700,3,3^FS

^FX Third section with bar code.
^BY5,2,270
^FO100,550^BC^FD12345678^FS

^FX Fourth section (the two boxes on the bottom).
^FO50,900^GB700,250,3^FS
^FO400,900^GB3,250,3^FS
^CF0,40
^FO100,960^FDCtr. X34B-1^FS
^FO100,1010^FDREF1 F00B47^FS
^FO100,1060^FDREF2 BL4H8^FS
^CF0,190
^FO470,955^FDCA^FS
^XZ`,
  },
  {
    name: "Product label",
    width: undefined,
    height: undefined,
    dpmm: 8,
    zpl: `^XA
^PW406^LL203
^FX Product name and price
^CF0,34
^FO20,20^FDOrganic Oat Drink^FS
^CF0,24
^FO20,60^FD1 L - Barista edition^FS
^FO290,20^GB96,60,60^FS
^FO290,32^FR^A0,40^FB96,1,0,C^FD2.49^FS
^FX Barcode
^BY2
^FO20,100^BEN,60,Y,N^FD735000123456^FS
^XZ`,
  },
  {
    name: "Asset tag",
    width: undefined,
    height: undefined,
    dpmm: 8,
    zpl: `^XA
^PW406^LL203
^FX Header bar
^FO0,0^GB406,50,50^FS
^FO16,10^FR^A0,34^FDPROPERTY OF HARBOR IT^FS
^FX Asset number and code
^FO16,70^A0,26^FDAsset^FS
^FO16,100^A0,44^FDHIT-04821^FS
^BY2
^FO16,150^BCN,40,N,N^FDHIT-04821^FS
^FO290,66^BXN,6,200^FDhttps://assets.example/HIT-04821^FS
^XZ`,
  },
  {
    name: "Common mistakes",
    width: undefined,
    height: undefined,
    dpmm: 8,
    zpl: `^XA
^PW406^LL203
^FX A rule thinner than its line thickness
^FO20,20^GB360,1,3^FS
^FX EAN-13 data must be 12 digits, without the check digit
^FO20,40^BEN,50^FD7350001234569^FS
^FX This field is never closed
^FO20,130^A0,30^FDUnclosed field
^FO20,170^A0,24^FDNext field^FS
^FX This field starts past the right edge
^FO420,20^A0,30^FDOff the label^FS
^XZ`,
  },
];

export default examples;
