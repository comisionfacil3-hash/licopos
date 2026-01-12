// Script para generar TODOS los iconos PWA desde SVG
// Ejecutar: node generate-icons.js

const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// TODOS los tamaños que necesita tu proyecto
const sizes = [
  { name: 'icon-72x72.png', size: 72 },
  { name: 'icon-96x96.png', size: 96 },
  { name: 'icon-128x128.png', size: 128 },
  { name: 'icon-144x144.png', size: 144 },
  { name: 'icon-152x152.png', size: 152 },
  { name: 'icon-180x180.png', size: 180 },  // iOS
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-384x384.png', size: 384 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 }
];

async function generateIcons() {
  console.log('🎨 Generando TODOS los iconos para ControlaPos...\n');
  console.log(`📋 Total de iconos a generar: ${sizes.length}\n`);

  // Verificar si existe el SVG
  if (!fs.existsSync('icon.svg')) {
    console.error('❌ Error: No se encuentra icon.svg');
    console.log('\n💡 Asegúrate de que icon.svg esté en la raíz del proyecto');
    process.exit(1);
  }

  // Crear carpeta public/icons si no existe
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
    console.log('✅ Carpeta public/ creada');
  }
  if (!fs.existsSync('public/icons')) {
    fs.mkdirSync('public/icons');
    console.log('✅ Carpeta public/icons/ creada');
  }
  console.log('');

  // Verificar si tiene ImageMagick instalado
  try {
    await execPromise('convert -version');
    console.log('✅ ImageMagick detectado\n');
    await generateWithImageMagick();
  } catch {
    console.log('⚠️  ImageMagick no detectado\n');
    await generateManually();
  }
}

async function generateWithImageMagick() {
  let successCount = 0;
  let errorCount = 0;

  for (const { name, size } of sizes) {
    const command = `convert -background none icon.svg -resize ${size}x${size} public/icons/${name}`;
    
    try {
      await execPromise(command);
      console.log(`✅ ${name.padEnd(25)} (${size}x${size})`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error en ${name}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`🎉 Proceso completado!`);
  console.log(`✅ Exitosos: ${successCount}`);
  if (errorCount > 0) {
    console.log(`❌ Errores: ${errorCount}`);
  }
  console.log('📁 Ubicación: public/icons/');
  console.log('='.repeat(50) + '\n');
}

async function generateManually() {
  console.log('📝 INSTRUCCIONES MANUALES:\n');
  console.log('Como no tienes ImageMagick instalado, tienes 3 opciones:\n');
  
  console.log('━'.repeat(50));
  console.log('OPCIÓN A - Sitio Web (Más Fácil) ⭐');
  console.log('━'.repeat(50));
  console.log('1. Ve a: https://cloudconvert.com/svg-to-png');
  console.log('2. Sube el archivo: icon.svg');
  console.log('3. Genera estos tamaños:\n');
  
  sizes.forEach(({ name, size }) => {
    console.log(`   📦 ${name.padEnd(25)} → ${size}x${size} px`);
  });
  
  console.log('\n4. Guarda TODOS en: public/icons/\n');
  
  console.log('━'.repeat(50));
  console.log('OPCIÓN B - Instalar ImageMagick (Automático)');
  console.log('━'.repeat(50));
  console.log('Windows: choco install imagemagick');
  console.log('Mac:     brew install imagemagick');
  console.log('Linux:   sudo apt-get install imagemagick\n');
  console.log('Luego ejecuta: node generate-icons.js\n');
  
  console.log('━'.repeat(50));
  console.log('OPCIÓN C - Figma/Photoshop (Diseñador)');
  console.log('━'.repeat(50));
  console.log('1. Abre icon.svg en tu editor');
  console.log('2. Exporta cada tamaño listado arriba');
  console.log('3. Guarda en: public/icons/\n');
}

// Ejecutar
generateIcons().catch(console.error);
