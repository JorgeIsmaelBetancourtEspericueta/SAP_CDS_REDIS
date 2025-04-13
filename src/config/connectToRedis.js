const { createClient } = require("redis");
const dotEnvX = require("./dotenvXconfig.js");

let hasErrorLogged = false; // Variable para controlar si el error ya se ha registrado

// Conectar a Redis
const client = createClient({
  url: dotEnvX.REDIS_URL, // Cambia a REDIS_URL
});


// Función para conectar a Redis
async function connectRedis() {
  try {
    await client.connect();
    console.log("Conectado a Redis");
  } catch (err) {
    if (!hasErrorLogged) {
      console.error("Error al conectar a Redis:", err.message);
      hasErrorLogged = true;
    }
  }
}

// Llamar a la función para conectar
connectRedis();

// Exportar la instancia de Redis para su uso en otros archivos
module.exports = client;
