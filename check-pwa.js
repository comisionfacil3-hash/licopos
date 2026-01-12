// Script de verificación PWA para ControlaPos
// Ejecutar: node check-pwa.js

const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICANDO CONFIGURACIÓN PWA...\n');

let errores = 0;
let advertencias = 0;
let ok = 0;

// Verificar iconos
console.log('📁 VERIFICANDO ICONOS:');
const iconos = [
  'icon-72x72.png',
  'icon-96x96.png',
  'icon-128x128.png',
  'icon-144x144.png',
  'icon-152x152.png',
  'icon-180x180.png',
  'icon-192x192.png',
  'icon-384x384.png',
  'icon-512x512.png',
  'favicon-32x32.png',
  'favicon-16x16.png'
];

const iconPath = path.join(__dirname, 'public', 'icons');

if (!fs.existsSync(iconPath)) {
  console.log('   ❌ Carpeta public/icons/ NO existe');
  console.log('   💡 Solución: Descarga ControlaPos-iconos.zip y copia la carpeta icons/ a public/');
  errores++;
} else {
  let iconosFaltantes = 0;
  iconos.forEach(icono => {
    const iconoPath = path.join(iconPath, icono);
    if (fs.existsSync(iconoPath)) {
      console.log(`   ✅ ${icono}`);
      ok++;
    } else {
      console.log(`   ❌ ${icono} FALTA`);
      iconosFaltantes++;
      errores++;
    }
  });
  
  if (iconosFaltantes === 0) {
    console.log(`   🎉 Todos los iconos (${iconos.length}) están presentes!\n`);
  } else {
    console.log(`   ⚠️  Faltan ${iconosFaltantes} iconos\n`);
  }
}

// Verificar manifest.json
console.log('📄 VERIFICANDO MANIFEST.JSON:');
const manifestPath = path.join(__dirname, 'app', 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.log('   ❌ app/manifest.json NO existe');
  console.log('   💡 Solución: Copia manifest-MEJORADO.json a app/manifest.json');
  errores++;
} else {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`   ✅ Archivo existe`);
    console.log(`   ✅ Nombre: ${manifest.name}`);
    console.log(`   ✅ Iconos definidos: ${manifest.icons ? manifest.icons.length : 0}`);
    
    if (manifest.name && manifest.name.includes('Gestión')) {
      console.log('   ✅ Encoding UTF-8 correcto');
      ok++;
    } else if (manifest.name && manifest.name.includes('GestiÃ³n')) {
      console.log('   ⚠️  Encoding incorrecto (GestiÃ³n → Gestión)');
      console.log('   💡 Solución: Reemplaza con manifest-MEJORADO.json');
      advertencias++;
    }
    
    if (!manifest.icons || manifest.icons.length === 0) {
      console.log('   ❌ No hay iconos definidos');
      errores++;
    } else {
      ok++;
    }
  } catch (error) {
    console.log(`   ❌ Error al leer manifest: ${error.message}`);
    errores++;
  }
}
console.log('');

// Verificar app/layout.tsx
console.log('📄 VERIFICANDO APP/LAYOUT.TSX:');
const layoutPath = path.join(__dirname, 'app', 'layout.tsx');

if (!fs.existsSync(layoutPath)) {
  console.log('   ❌ app/layout.tsx NO existe');
  errores++;
} else {
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  
  if (layoutContent.includes('manifest:')) {
    console.log('   ✅ Metadata de manifest presente');
    ok++;
  } else {
    console.log('   ❌ Falta metadata de manifest');
    console.log('   💡 Solución: Reemplaza con layout-MEJORADO.tsx');
    errores++;
  }
  
  if (layoutContent.includes('icons:')) {
    console.log('   ✅ Metadata de icons presente');
    ok++;
  } else {
    console.log('   ⚠️  Falta metadata de icons');
    console.log('   💡 Solución: Reemplaza con layout-MEJORADO.tsx');
    advertencias++;
  }
  
  if (layoutContent.includes('AuthProvider')) {
    console.log('   ✅ AuthProvider presente (correcto)');
    ok++;
  }
}
console.log('');

// Verificar components/install-pwa.tsx
console.log('📄 VERIFICANDO COMPONENTS/INSTALL-PWA.TSX:');
const installPwaPath = path.join(__dirname, 'components', 'install-pwa.tsx');

if (!fs.existsSync(installPwaPath)) {
  console.log('   ❌ components/install-pwa.tsx NO existe');
  console.log('   💡 Solución: Copia install-pwa.tsx a components/');
  errores++;
} else {
  console.log('   ✅ Componente existe');
  ok++;
}
console.log('');

// Verificar dashboard/layout.tsx
console.log('📄 VERIFICANDO DASHBOARD/LAYOUT.TSX:');
const dashboardLayoutPath = path.join(__dirname, 'app', 'dashboard', 'layout.tsx');

if (!fs.existsSync(dashboardLayoutPath)) {
  console.log('   ❌ app/dashboard/layout.tsx NO existe');
  errores++;
} else {
  const dashboardLayoutContent = fs.readFileSync(dashboardLayoutPath, 'utf8');
  
  if (dashboardLayoutContent.includes('InstallPWA')) {
    console.log('   ✅ InstallPWA importado');
    ok++;
  } else {
    console.log('   ❌ InstallPWA NO está importado');
    console.log('   💡 Solución: Agrega: import InstallPWA from "@/components/install-pwa"');
    errores++;
  }
  
  if (dashboardLayoutContent.includes('<InstallPWA')) {
    console.log('   ✅ Componente <InstallPWA /> agregado');
    ok++;
  } else {
    console.log('   ❌ Componente <InstallPWA /> NO agregado al JSX');
    console.log('   💡 Solución: Agrega <InstallPWA /> en el return');
    errores++;
  }
}
console.log('');

// Verificar next.config.js
console.log('📄 VERIFICANDO NEXT.CONFIG.JS:');
const nextConfigPath = path.join(__dirname, 'next.config.js');

if (!fs.existsSync(nextConfigPath)) {
  console.log('   ❌ next.config.js NO existe');
  errores++;
} else {
  const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
  
  if (nextConfigContent.includes('manifest.json')) {
    console.log('   ✅ Headers para manifest.json configurados');
    ok++;
  } else {
    console.log('   ⚠️  Headers para manifest.json no configurados');
    console.log('   💡 Recomendación: Reemplaza con next-config-MEJORADO.js');
    advertencias++;
  }
}
console.log('');

// Resumen
console.log('═'.repeat(50));
console.log('📊 RESUMEN:');
console.log('═'.repeat(50));
console.log(`✅ Verificaciones OK: ${ok}`);
console.log(`⚠️  Advertencias: ${advertencias}`);
console.log(`❌ Errores: ${errores}`);
console.log('');

if (errores === 0 && advertencias === 0) {
  console.log('🎉 ¡PERFECTO! Todo está configurado correctamente.');
  console.log('');
  console.log('📱 SIGUIENTE PASO:');
  console.log('1. Ejecuta: npm run build');
  console.log('2. Ejecuta: npm run dev');
  console.log('3. Abre: http://localhost:3000/dashboard');
  console.log('4. Espera 3-5 segundos');
  console.log('5. Deberías ver el botón "Instalar App"');
  console.log('');
  console.log('💡 TIP: Abre DevTools (F12) → Console para ver mensajes de debug');
} else if (errores === 0) {
  console.log('⚠️  Hay algunas advertencias pero debería funcionar.');
  console.log('   Revisa las recomendaciones arriba para optimizar.');
} else {
  console.log('❌ Hay errores que debes corregir:');
  console.log('');
  console.log('📋 ACCIÓN REQUERIDA:');
  console.log('1. Revisa los errores marcados con ❌ arriba');
  console.log('2. Sigue las soluciones sugeridas (💡)');
  console.log('3. Ejecuta este script de nuevo: node check-pwa.js');
}

console.log('');
