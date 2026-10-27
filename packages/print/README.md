# @zplkit/print

Send ZPL labels to Zebra printers and read their status, over the network from Node, or over USB and Bluetooth from the browser.

> [!WARNING]
> Experimental. The connections are built from Zebra's documentation and tested against stand-ins, not yet against real printers. Please [open an issue](https://github.com/ludwig-f/zplkit/issues) with your printer's model and what happened, whether it works or not.

## Installation

```bash
npm install @zplkit/print
```

## Network printers

Networked Zebra printers take ZPL on TCP port 9100. Node only, since browsers can't open TCP connections:

```typescript
import { connectNetworkPrinter } from "@zplkit/print/network";

const printer = await connectNetworkPrinter("192.168.1.50");
await printer.send(label); // a Label, PrintJob or ZPL string
console.log(await printer.status());
await printer.close();
```

## USB, from the browser

With WebUSB, in Chrome and Edge. Call it from a click, since the browser asks which printer to use:

```typescript
import { connectUsbPrinter } from "@zplkit/print/usb";

button.onclick = async () => {
  const printer = await connectUsbPrinter();
  await printer.send(label);
};
```

On Windows the system's printer driver usually claims the printer first, so WebUSB can't open it. macOS, Linux, ChromeOS and Android work.

## Bluetooth, from the browser

With Web Bluetooth, in Chrome and Edge, through Zebra's Bluetooth LE Parser Service, which mobile printers like the ZQ series have:

```typescript
import { connectBluetoothPrinter } from "@zplkit/print/bluetooth";

const printer = await connectBluetoothPrinter();
await printer.send(label);
```

Bluetooth LE is slow, about 80 bytes per second in Zebra's measurements, so it suits text labels better than images. Data goes out 20 bytes at a time; pass `{ chunkSize }` to send more when the connection allows it.

## Status

`printer.status()` sends `~HS` and reads the reply: whether the printer is `ready`, `paperOut`, `paused`, `headOpen`, `ribbonOut`, the print mode, labels remaining and more.

Printers don't answer `~HS` while they're out of media or ribbon, the head is open, the rewinder is full or the head is too hot. Then `status()` resolves with `{ ready: false, noReply: true }` after its timeout, 2 seconds by default.

## Your own connection

`new Printer(connection)` works over anything with `write(bytes)`, an optional `read(timeout)` and `close()`, for example a serial port or a print server.

## Trying it on a printer

If you have a Zebra printer, these are the things to check:

1. Network: `send()` prints a label, and `status()` returns `ready: true`, then `paperOut` or `noReply` with the media out.
2. USB: the browser lists the printer, `send()` prints, `status()` answers.
3. Bluetooth: the browser lists the printer, a short label prints, `status()` answers.
4. A label with UTF-8 text (`^CI28`) prints the right characters.

## License

MIT
