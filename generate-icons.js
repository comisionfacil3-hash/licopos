// Script para generar iconos PNG desde SVG
// Ejecutar: node generate-icons.js

const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configuración de tamaños
const sizes = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 }
];

async function generateIcons() {
  console.log('🎨 Generando iconos para LicoPOS...\n');

  // Verificar si existe el SVG
  if (!fs.existsSync('icon.svg')) {
    console.error('❌ Error: No se encuentra icon.svg');
    process.exit(1);
  }

  // Crear carpeta public/icons si no existe
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
  }
  if (!fs.existsSync('public/icons')) {
    fs.mkdirSync('public/icons');
  }

  // Verificar si tiene ImageMagick o Sharp instalado
  try {
    await execPromise('which convert');
    console.log('✅ ImageMagick detectado\n');
    await generateWithImageMagick();
  } catch {
    console.log('⚠️  ImageMagick no detectado. Usando método alternativo...\n');
    await generateManually();
  }
}

async function generateWithImageMagick() {
  for (const { name, size } of sizes) {
    const command = `convert -background none icon.svg -resize ${size}x${size} public/icons/${name}`;
    
    try {
      await execPromise(command);
      console.log(`✅ Generado: ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Error generando ${name}:`, error.message);
    }
  }
  
  console.log('\n🎉 ¡Iconos generados exitosamente!');
  console.log('📁 Ubicación: public/icons/\n');
}

async function generateManually() {
  console.log('📝 INSTRUCCIONES MANUALES:\n');
  console.log('Como no tienes ImageMagick instalado, sigue estos pasos:\n');
  console.log('OPCIÓN A - Usar sitio web (Recomendado):');
  console.log('1. Ve a: https://cloudconvert.com/svg-to-png');
  console.log('2. Sube el archivo: icon.svg');
  console.log('3. Genera los siguientes tamaños:');
  sizes.forEach(({ name, size }) => {
    console.log(`   - ${name}: ${size}x${size} píxeles`);
  });
  console.log('4. Guarda todos en: public/icons/\n');
  
  console.log('OPCIÓN B - Instalar ImageMagick:');
  console.log('Windows: choco install imagemagick');
  console.log('Mac: brew install imagemagick');
  console.log('Linux: sudo apt-get install imagemagick\n');
  console.log('Luego ejecuta: node generate-icons.js\n');
}

// Ejecutar
generateIcons().catch(console.error);
