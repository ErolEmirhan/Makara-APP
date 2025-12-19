// SVG'den PNG icon oluşturma script'i
// Bu script'i çalıştırmak için: node create-icons.js
// Ancak canvas kütüphanesi gerektirir, bu yüzden alternatif olarak SVG'yi doğrudan kullanabiliriz

const fs = require('fs');
const path = require('path');

// SVG içeriği
const svgContent = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#dc2626" rx="80"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="180" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">MAKARA</text>
</svg>`;

// SVG dosyasını kaydet
fs.writeFileSync('icon.svg', svgContent);
console.log('✅ SVG icon oluşturuldu: icon.svg');

// Not: PNG oluşturmak için canvas veya sharp kütüphanesi gerekiyor
// Alternatif: Online tool kullanın (https://convertio.co/svg-png/ veya https://cloudconvert.com/svg-to-png)
// veya SVG'yi doğrudan kullanabilirsiniz (modern tarayıcılar destekler)

console.log('\n📝 PNG icon oluşturmak için:');
console.log('1. icon.svg dosyasını bir online SVG to PNG converter\'a yükleyin');
console.log('2. 192x192 ve 512x512 boyutlarında PNG dosyaları oluşturun');
console.log('3. icon-192.png ve icon-512.png olarak kaydedin');
console.log('4. Bu dosyaları public klasörüne kopyalayın');


