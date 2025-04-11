const ztpricehistory = require("../models/mongoDB/ztpricehistory");
const cliente = require("../../config/connectToRedis");
const mongoose = require("mongoose");

async function GetAllPricesHistory(req) {
  try {
    const IdPrice = parseInt(req.req.query?.IdPrice);
    const IniVolume = parseFloat(req.req.query?.IniVolume);
    const EndVolume = parseFloat(req.req.query?.EndVolume);

    let pricehistory;

    //Donde el volumen de ventas esté estre un rango de valores

    if (IdPrice >= 0) {
      pricehistory = await ztpricehistory.findOne({ ID: IdPrice }).lean();
      console.log(pricehistory);
    } else if (IniVolume >= 0 && EndVolume >= 0) {
      pricehistory = await ztpricehistory
        .find({ VOLUME: { $gte: IniVolume, $lte: EndVolume } })
        .lean();
      console.log(pricehistory);
    } else {
      pricehistory = await ztpricehistory.find().lean();
      console.log(pricehistory);
    }

    return pricehistory;
  } catch (error) {
    return error;
  } finally {
  }
}

// Add one and some
async function AddOnePricesHistory(req) {
  try {
    const newPrices = req.req.body.prices;

    let pricesHistory;
    pricesHistory = await ztpricehistory.insertMany(newPrices, {
      order: true,
    });
    return JSON.parse(JSON.stringify(pricesHistory));
  } catch (error) {
    throw error;
  } finally {
  }
}

// Put one
async function UpdateOnePriceHistory(req) {
  try {
    const Id = parseInt(req.req.query?.Id); // Obtener el parámetro Id desde la consulta
    const newPrices = req.req.body.prices; // El objeto con los datos de precios que quieres actualizar

    // Actualizar el registro en la base de datos
    let updatedHistory = await ztpricehistory.updateOne(
      { ID: Id }, // Condición para encontrar el registro por ID
      { $set: newPrices } // Actualizar los campos excepto ID
    );

    // Verificar si se actualizó algún documento
    if (updatedHistory.matchedCount === 0) {
      throw new Error("Price history not found");
    }

    let pricehistory = await ztpricehistory
      .findOne({ ID: newPrices.ID })
      .lean();

    // Devolver el registro actualizado
    return JSON.parse(JSON.stringify(pricehistory));
  } catch (error) {
    console.error("Error updating price history:", error.message);
    throw error;
  }
}

async function DeleteOnePriceHistory(req) {
  try {
    // Obtener el ID desde la consulta de la URL
    const IdPrice = parseInt(req.req.query?.IdPrice); // El ID del precio que quieres eliminar

    // Verificar si se proporcionó un ID válido
    if (isNaN(IdPrice) || IdPrice <= 0) {
      throw new Error("Invalid ID provided.");
    }

    // Eliminar el historial con el ID especificado
    const deleteResult = await ztpricehistory.deleteOne({ ID: IdPrice });

    // Verificar si se eliminó algún documento
    if (deleteResult.deletedCount === 0) {
      throw new Error("Price history not found for the given ID.");
    }

    // Retornar un mensaje de éxito
    return { message: "Price history eliminado exitosamente" };
  } catch (error) {
    console.error("Error deleting price history:", error.message);
    throw error;
  }
}

// Servicio para hacer el lookup entre ZTLABELS y ZTVALUES
async function GetLabelsWithValues() {
  try {
    const result = await mongoose.connection
      .collection("ZTLABELS")
      .aggregate([
        {
          $lookup: {
            from: "ZTVALUES",
            localField: "LABELID",
            foreignField: "LABELID",
            as: "VALUES",
          },
        },
      ])
      .toArray();

    return result;
  } catch (error) {
    console.error("Error en la agregación con $lookup:", error.message);
    throw error;
  }
}

//-------------------------------------------------------REDIS------------------------------------------------------------
async function GetAllPHRedis(req) {
  try {
    // Obtener todas las claves desde Redis
    const allKeys = await cliente.keys("*");

    const key = req.req.query?.key;

    if (key) {
      // Obtener el valor desde Redis (sin RedisJSON, usando el comando estándar GET)
      const value = await cliente.get(key);

      return JSON.parse(value);
    } else {
      if (!allKeys || allKeys.length === 0) {
        throw new Error("No se encontraron las keys");
      }

      // Array para almacenar los resultados
      const allData = [];

      // Iterar sobre todas las claves obtenidas
      for (const key of allKeys) {
        // Obtener el valor de cada clave
        const value = await cliente.get(key);

        // Verificar si se obtuvo un valor
        if (value) {
          try {
            // Intentar parsear el valor si es posible
            allData.push({ key, value: JSON.parse(value) });
          } catch (parseError) {
            // Si no se puede parsear, almacenar el valor tal cual
            allData.push({ key, value });
          }
        }
      }

      // Devolver todos los resultados
      return allData;
    }
  } catch (error) {
    throw new Error(`Error al obtener los datos de  Redis: ${error.message}`);
  }
}

async function AddOnePricesHistoryRedis(req) {
  try {
    const key = req.req.query?.key; // Obtener la clave desde la URL
    const newPrices = req.req.body?.prices; // Obtener los datos nuevos del body de la solicitud

    // Validar si la clave existe
    if (!key) {
      throw new Error("El parámetro 'key' es obligatorio.");
    }

    // Validar si los datos del body están presentes
    if (!newPrices || Object.keys(newPrices).length === 0) {
      throw new Error("El body debe contener los datos que se agregarán.");
    }

    // Convertir el objeto de precios a string JSON para almacenarlo en Redis
    const valueToStore = JSON.stringify(newPrices);

    // Guardar el valor en Redis usando el comando SET
    await cliente.set(key, valueToStore);

    // Obtener los datos recién insertados para mostrarlos
    const storedData = await cliente.get(key);

    // Retornar una respuesta exitosa junto con los datos insertados
    return {
      "Datos insertados": JSON.parse(storedData), // Convertir a objeto para retornarlo
    };
  } catch (error) {
    // Manejo de errores y log
    console.error("Error:", error.message);
    throw new Error(`Error al agregar datos a redis: ${error.message}`);
  }
}

async function UpdateOnePriceHistoryRedis(req) {
  try {
    const key = req.req.query?.key;
    const newPrices = req.req.body?.prices; // Obtener los datos nuevos del body de la solicitud

    // Validar si la clave existe
    if (!key) {
      throw new Error("El parámetro 'key' es obligatorio.");
    }

    // Validar si los datos del body están presentes
    if (!newPrices || Object.keys(newPrices).length === 0) {
      throw new Error("El body debe contener los datos que se agregarán.");
    }

    // Verificar si la clave existe antes de actualizar
    const exists = await cliente.exists(key);
    if (!exists) {
      throw new Error(
        `La clave '${key}' no existe en Redis. No se puede actualizar.`
      );
    }

    // Convertir el objeto de precios a string JSON para almacenarlo en Redis
    const valueToStore = JSON.stringify(newPrices);

    // Actualizar el valor en Redis usando el comando SET
    await cliente.set(key, valueToStore);

    // Obtener los datos actualizados para mostrarlos
    const storedData = await cliente.get(key);

    // Retornar una respuesta exitosa junto con los datos actualizados
    return {
      message: `Los datos con la clave '${key}' fueron actualizados exitosamente.`,
      updatedData: JSON.parse(storedData), // Convertir a objeto para retornarlo
    };
  } catch (error) {
    // Manejo de errores y log
    console.error("Error:", error.message);
    throw new Error(`Error al actualizar datos en Redis: ${error.message}`);
  }
}

async function DeleteOnePricesHistoryRedis(req) {
  try {
    const key = req.req.query?.key; // Obtener la clave desde la URL

    // Validar si la clave existe
    if (!key) {
      throw new Error("El parámetro 'key' es obligatorio.");
    }

    // Verificar si la clave existe antes de eliminarla
    const exists = await cliente.exists(key);
    if (!exists) {
      throw new Error(`La clave ${key} no existe en Redis.`);
    }

    // Eliminar la clave de Redis
    const result = await cliente.del(key);

    // Verificar si la eliminación fue exitosa
    if (result === 1) {
      return {
        message: `Los datos con la clave ${key} fueron eliminados exitosamente de Redis.`,
      };
    } else {
      throw new Error(`No se pudo eliminar la clave ${key}.`);
    }
  } catch (error) {
    // Manejo de errores y log
    throw new Error(`Error al eliminar datos de Redis: ${error.message}`);
  }
}

module.exports = {
  GetAllPricesHistory,
  AddOnePricesHistory,
  UpdateOnePriceHistory,
  DeleteOnePriceHistory,
  GetAllPHRedis,
  AddOnePricesHistoryRedis,
  UpdateOnePriceHistoryRedis,
  DeleteOnePricesHistoryRedis,
  GetLabelsWithValues,
};
