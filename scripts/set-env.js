const fs = require('fs');
const path = require('path');

if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  const dirPath = path.join(__dirname, '../src/environments');
  const targetPath = path.join(dirPath, 'environment.ts');
  const targetPathProd = path.join(dirPath, 'environment.development.ts');

  const envConfigFile = `export const environment = {
  production: true,
  supabaseUrl: '${process.env.SUPABASE_URL}',
  supabaseKey: '${process.env.SUPABASE_KEY}'
};
`;

  if (!fs.existsSync(dirPath)){
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(targetPath, envConfigFile);
  fs.writeFileSync(targetPathProd, envConfigFile);

  console.log('✅ Archivos de environment generados con exito usando variables de entorno del servidor.');
} else {
  console.log('ℹ️ No se detectaron variables de entorno del servidor. Se conservaran los archivos locales de environment.');
}
