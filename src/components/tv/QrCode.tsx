// Join QR code for the TV lobby: phones scan it straight into #/join/<code>.
// Drawn as one SVG path from qrcode-generator's module matrix, so it scales
// to any TV without blurring and needs no canvas.

import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

const QUIET_ZONE = 2; // modules of white border scanners need

export function QrCode({ text, size = 240 }: { text: string; size?: number }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M'); // 0 = smallest version that fits
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c + QUIET_ZONE} ${r + QUIET_ZONE}h1v1h-1z`;
      }
    }
    return { count: n + QUIET_ZONE * 2, path: d };
  }, [text]);

  return (
    <svg
      className="qr-code"
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${text}`}
      data-testid="tv-qr"
    >
      <rect width={count} height={count} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
