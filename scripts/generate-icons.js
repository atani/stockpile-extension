const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const svgPath = path.join(__dirname, '../icons/icon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

for (const size of sizes) {
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  const outputPath = path.join(__dirname, `../icons/icon${size}.png`);
  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`Generated: icon${size}.png`);
}

console.log('Done!');
