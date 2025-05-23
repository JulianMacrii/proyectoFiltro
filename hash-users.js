// hash-users.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const usuariosPath = path.join(__dirname, 'usuarios.json');

// Leer archivo
let usuarios = JSON.parse(fs.readFileSync(usuariosPath, 'utf8'));

// Si detecta que ya están todos hasheados, no hace nada
const usuariosProcesados = usuarios.map(user => {
  const { usuario, clave, envKey } = user;

  // Si ya parece un hash de bcrypt, lo dejamos igual
  if (clave.startsWith('$2a$') || clave.startsWith('$2b$')) {
    console.log(`🔒 Usuario "${usuario}" ya tiene clave protegida. Se conserva.`);
    return user;
  }

  // Si es texto plano, hasheamos
  const hashedClave = bcrypt.hashSync(clave, 10);
  console.log(`✅ Usuario "${usuario}" actualizado con clave segura.`);

  return { usuario, clave: hashedClave, envKey };
});

// Guardar el archivo
fs.writeFileSync(usuariosPath, JSON.stringify(usuariosProcesados, null, 2), 'utf8');

console.log('\n🚀 Proceso finalizado: usuarios.json actualizado con seguridad.\n');
