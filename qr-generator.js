/**
 * Zero-Dependency QR Code SVG Generator for WhatsApp Flow Router
 * Generates ISO/IEC 18004 compliant QR Code SVGs for WhatsApp Click-to-Chat links.
 * 
 * Author: Eng. MHD. Shadi AL-Hasan <mhd.shadi.alhasan@gmail.com>
 * Phone: +963934005922
 * Copyright (c) 2026 MHD. Shadi AL-Hasan
 */

const fs = require('fs');
const path = require('path');

// Galois Field GF(256) precomputations
const GF_EXP = new Array(512).fill(0);
const GF_LOG = new Array(256).fill(0);
let val = 1;
for (let i = 0; i < 255; i++) {
  GF_EXP[i] = val;
  GF_EXP[i + 255] = val;
  GF_LOG[val] = i;
  val = (val << 1) ^ (val & 0x80 ? 0x11d : 0);
}

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const root = GF_EXP[i];
    const newPoly = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      newPoly[j] ^= poly[j];
      newPoly[j + 1] ^= gfMul(poly[j], root);
    }
    poly = newPoly;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const msg = [...data, ...new Array(ecLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const lead = msg[i];
    if (lead !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(lead, gen[j]);
      }
    }
  }
  return msg.slice(data.length);
}

const QR_SPECS = {
  1: [26, 19, 7, 1, 16, 10, 1, 0, []],
  2: [44, 34, 10, 1, 28, 16, 1, 7, [6, 18]],
  3: [70, 55, 15, 1, 44, 26, 1, 7, [6, 22]],
  4: [100, 80, 20, 1, 64, 18, 2, 7, [6, 26]],
  5: [134, 108, 26, 1, 86, 24, 2, 7, [6, 30]],
  6: [172, 136, 18, 2, 108, 16, 4, 7, [6, 34]],
  7: [196, 156, 20, 2, 124, 18, 4, 0, [6, 22, 38]],
  8: [242, 194, 24, 2, 154, 22, 4, 0, [6, 24, 42]],
  9: [292, 232, 30, 2, 182, 22, 5, 0, [6, 26, 46]],
  10: [346, 274, 18, 4, 216, 26, 5, 0, [6, 28, 50]],
};

const FORMAT_MASKS = {
  '1,0': 0x77c4, '1,1': 0x72f3, '1,2': 0x7daa, '1,3': 0x789d,
  '0,0': 0x5412, '0,1': 0x5125, '0,2': 0x5e7c, '0,3': 0x5b4b,
};

function getVersionInfo(ver) {
  let d = ver << 12;
  const poly = 0x1f25;
  for (let i = 17; i >= 12; i--) {
    if ((d >> i) & 1) {
      d ^= poly << (i - 12);
    }
  }
  return (ver << 12) | d;
}

function generateQrMatrix(text, ecc = 'L') {
  const rawData = Buffer.from(text, 'utf-8');
  const dataLen = rawData.length;
  const eccIdx = ecc === 'L' ? 1 : 0;

  let chosenVer = null;
  for (let ver = 1; ver <= 10; ver++) {
    const spec = QR_SPECS[ver];
    const maxBytes = ecc === 'L' ? spec[1] : spec[4];
    const overheadBits = 4 + (ver < 10 ? 8 : 16) + 4;
    if (dataLen <= maxBytes - Math.ceil(overheadBits / 8)) {
      chosenVer = ver;
      break;
    }
  }
  if (!chosenVer) throw new Error(`Data exceeds maximum supported size (${dataLen} bytes)`);

  const ver = chosenVer;
  const spec = QR_SPECS[ver];
  const dataCwTotal = ecc === 'L' ? spec[1] : spec[4];
  const ecLen = ecc === 'L' ? spec[2] : spec[5];
  const numBlocks = ecc === 'L' ? spec[3] : spec[6];
  const remBits = spec[7];
  const alignCoords = spec[8];

  let bits = '0100';
  const lenBits = ver < 10 ? 8 : 16;
  bits += dataLen.toString(2).padStart(lenBits, '0');
  for (const b of rawData) {
    bits += b.toString(2).padStart(8, '0');
  }

  const maxBits = dataCwTotal * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  bits += '0'.repeat(termLen);
  if (bits.length % 8 !== 0) {
    bits += '0'.repeat(8 - (bits.length % 8));
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    bits += padBytes[padIdx].toString(2).padStart(8, '0');
    padIdx = 1 - padIdx;
  }

  const codewords = [];
  for (let i = 0; i < maxBits; i += 8) {
    codewords.push(parseInt(bits.slice(i, i + 8), 2));
  }

  const baseBlockLen = Math.floor(codewords.length / numBlocks);
  const extraBlocks = codewords.length % numBlocks;
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const bLen = baseBlockLen + (b >= numBlocks - extraBlocks ? 1 : 0);
    const bData = codewords.slice(offset, offset + bLen);
    offset += bLen;
    dataBlocks.push(bData);
    ecBlocks.push(rsEncode(bData, ecLen));
  }

  const finalCodewords = [];
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const b of dataBlocks) {
      if (i < b.length) finalCodewords.push(b[i]);
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (const b of ecBlocks) {
      finalCodewords.push(b[i]);
    }
  }

  const finalBits = finalCodewords.map(cw => cw.toString(2).padStart(8, '0')).join('') + '0'.repeat(remBits);

  const size = 4 * ver + 17;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  function setModule(r, c, isDark, isRes = true) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = isDark ? 2 : 1;
      if (isRes) reserved[r][c] = true;
    }
  }

  function placeFinder(startR, startC) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = startR + dr;
        const c = startC + dc;
        if (r >= 0 && r < size && c >= 0 && c < size) {
          if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
            const isDark = dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
            setModule(r, c, isDark);
          } else {
            setModule(r, c, false);
          }
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  if (alignCoords.length > 0) {
    for (const ar of alignCoords) {
      for (const ac of alignCoords) {
        if ((ar === 6 && ac === 6) || (ar === 6 && ac === alignCoords[alignCoords.length - 1]) || (ar === alignCoords[alignCoords.length - 1] && ac === 6)) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isDark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setModule(ar + dr, ac + dc, isDark);
          }
        }
      }
    }
  }

  setModule(4 * ver + 9, 8, true);

  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = size - 8; i < size; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }

  if (ver >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[size - 11 + j][i] = true;
        reserved[i][size - 11 + j] = true;
      }
    }
  }

  let bitIdx = 0;
  let direction = -1;
  let c = size - 1;
  while (c > 0) {
    if (c === 6) c--;
    const rows = direction === -1
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const dc of [0, -1]) {
        const col = c + dc;
        if (!reserved[r][col]) {
          let bit = 0;
          if (bitIdx < finalBits.length) {
            bit = parseInt(finalBits[bitIdx], 10);
            bitIdx++;
          }
          if ((r + col) % 2 === 0) bit ^= 1;
          matrix[r][col] = bit ? 2 : 1;
        }
      }
    }
    direction = -direction;
    c -= 2;
  }

  const fmtVal = FORMAT_MASKS[`${eccIdx},0`];
  const fmtBits = fmtVal.toString(2).padStart(15, '0');

  for (let i = 0; i < 6; i++) setModule(8, i, fmtBits[i] === '1');
  setModule(8, 7, fmtBits[6] === '1');
  setModule(8, 8, fmtBits[7] == '1');
  setModule(7, 8, fmtBits[8] == '1');
  for (let i = 0; i < 6; i++) setModule(5 - i, 8, fmtBits[9 + i] === '1');

  for (let i = 0; i < 7; i++) setModule(size - 1 - i, 8, fmtBits[i] === '1');
  for (let i = 0; i < 8; i++) setModule(8, size - 8 + i, fmtBits[7 + i] === '1');

  if (ver >= 7) {
    const vBits = getVersionInfo(ver).toString(2).padStart(18, '0');
    for (let i = 0; i < 18; i++) {
      const bit = vBits[17 - i] === '1';
      setModule(size - 11 + (i % 3), Math.floor(i / 3), bit);
      setModule(Math.floor(i / 3), size - 11 + (i % 3), bit);
    }
  }

  return matrix.map(row => row.map(cell => cell === 2));
}

function generateQrSvg(text, options = {}) {
  const { border = 4, boxSize = 10, darkColor = '#000000', lightColor = '#ffffff' } = options;
  const matrix = generateQrMatrix(text);
  const size = matrix.length;
  const totalSize = (size + 2 * border) * boxSize;

  const paths = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        const x = (c + border) * boxSize;
        const y = (r + border) * boxSize;
        paths.push(`M${x},${y}h${boxSize}v${boxSize}h-${boxSize}z`);
      }
    }
  }
  const pathData = paths.join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="${lightColor}"/>
  <path d="${pathData}" fill="${darkColor}"/>
</svg>`;
}

function buildWhatsAppUrl(phoneNumber, initialText = '') {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  if (!initialText) return `https://wa.me/${cleanPhone}`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(initialText)}`;
}

function generateWhatsAppQrSvg({ phone, message = '', border = 4, boxSize = 10 } = {}) {
  const url = buildWhatsAppUrl(phone, message);
  return generateQrSvg(url, { border, boxSize });
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  let phone = '+963934005922';
  let text = 'Hello! I am reaching out regarding Enterprise Solutions.';
  let outPath = 'whatsapp_click_to_chat.svg';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phone' || args[i] === '-p') phone = args[++i];
    else if (args[i] === '--text' || args[i] === '-t') text = args[++i];
    else if (args[i] === '--output' || args[i] === '-o') outPath = args[++i];
  }

  const svg = generateWhatsAppQrSvg({ phone, message: text });
  fs.writeFileSync(outPath, svg, 'utf-8');
  console.log(`[+] Generated WhatsApp QR Code SVG: ${outPath}`);
  console.log(`[+] Encoded URL: ${buildWhatsAppUrl(phone, text)}`);
}

module.exports = {
  generateQrMatrix,
  generateQrSvg,
  buildWhatsAppUrl,
  generateWhatsAppQrSvg
};
