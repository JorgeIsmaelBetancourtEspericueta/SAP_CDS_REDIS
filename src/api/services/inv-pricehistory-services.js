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
async function GetRedis(req) {
  try {
    const key = req.req.query?.key;

    if (key) {
      // Obtener el valor desde Redis (sin RedisJSON, usando el comando estándar GET)
      const value = await cliente.get(key);

      return JSON.parse(value);
    } else {
      // Obtener todas las claves desde Redis
      const allKeys = await cliente.keys("*");

      if (!allKeys || allKeys.length === 0) {
        return "No se encontraron las keys";
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
      throw new Error("El parámetro 'key' es obligatorio."); // Mensaje de error en caso de no proporcionar la clave
    }

    // Verificar si la clave ya existe en Redis
    const keyExists = await cliente.exists(key);
    if (keyExists) {
      return `La clave '${key}' ya existe en Redis. Por favor utiliza otra clave o actualiza los datos existentes.`; // Mensaje de error si la clave ya está presente
    }

    // Validar estructura básica de la entidad priceshistory
    const validateEntityStructure = (prices) => {
      if (
        !prices.ID ||
        !prices.DATE ||
        !prices.OPEN ||
        !prices.HIGH ||
        !prices.LOW ||
        !prices.CLOSE ||
        !prices.VOLUME
      ) {
        return "La estructura del objeto no coincide con la entidad 'priceshistory'."; // Mensaje de error si la estructura no es válida
      }
    };

    // Validar la estructura de los nuevos datos
    validateEntityStructure(newPrices);

    // Definir automáticamente el campo DETAIL_ROW
    newPrices.DETAIL_ROW = [
      {
        ACTIVED: true, // Valor predeterminado
        DELETED: false, // Valor predeterminado
        DETAIL_ROW_REG: [
          {
            CURRENT: true, // Valor predeterminado
            REGDATE: new Date().toISOString().split("T")[0], // Fecha actual
            REGTIME: new Date().toISOString().split("T")[1], // Hora actual
            REGUSER: "system_user", // Usuario predeterminado
          },
        ],
      },
    ];

    // Convertir el objeto de precios a string JSON para almacenarlo en Redis
    const valueToStore = JSON.stringify(newPrices);

    // Guardar el valor en Redis usando el comando SET
    await cliente.set(key, valueToStore);

    // Obtener los datos recién insertados para mostrarlos
    const storedData = await cliente.get(key);

    return {
      "Datos insertados": JSON.parse(storedData), // Convertir a objeto para retornarlo
    };
  } catch (error) {
    // Manejo de errores y log
    console.error("Error:", error.message);
    throw new Error(`Error al agregar datos a Redis: ${error.message}`); // Mensaje de error general
  }
}

async function UpdateOnePriceHistoryRedis(req) {
  try {
    const key = req.req.query?.key;
    const newPrices = req.req.body?.prices;
    const regUser = req.req.body?.user || "system_user";

    if (!key) {
      throw new Error("El parámetro 'key' es obligatorio.");
    }

    if (!newPrices || Object.keys(newPrices).length === 0) {
      throw new Error("El body debe contener los datos que se actualizarán.");
    }

    const exists = await cliente.exists(key);
    if (!exists) {
      throw new Error(`La clave '${key}' no existe en Redis.`);
    }

    const currentDataStr = await cliente.get(key);
    const currentData = JSON.parse(currentDataStr);

    // Validar los campos actualizables
    const validFields = ["DATE", "OPEN", "HIGH", "LOW", "CLOSE", "VOLUME"];
    validFields.forEach(field => {
      if (newPrices[field] !== undefined) {
        currentData[field] = newPrices[field];
      }
    });

    // Validar existencia de DETAIL_ROW
    if (!Array.isArray(currentData.DETAIL_ROW) || currentData.DETAIL_ROW.length === 0) {
      throw new Error("El objeto no contiene un arreglo DETAIL_ROW válido.");
    }

    const detailRow = currentData.DETAIL_ROW[0]; // Suponemos que solo hay uno

    // Asegurar que DETAIL_ROW_REG sea un array
    if (!Array.isArray(detailRow.DETAIL_ROW_REG)) {
      detailRow.DETAIL_ROW_REG = [];
    } else {
      // Marcar todos los existentes como CURRENT: false
      detailRow.DETAIL_ROW_REG.forEach(reg => {
        reg.CURRENT = false;
      });
    }

    // Fecha y hora actual
    const now = new Date();
    const regDate = now.toISOString().split("T")[0];
    const regTime = now.toTimeString().split(" ")[0];

    // Agregar nuevo registro como parte del DETAIL_ROW actual
    detailRow.DETAIL_ROW_REG.push({
      CURRENT: true,
      REGDATE: regDate,
      REGTIME: regTime,
      REGUSER: regUser
    });

    // Guardar en Redis
    await cliente.set(key, JSON.stringify(currentData));

    return {
      message: `Los datos con la clave '${key}' fueron actualizados exitosamente.`,
      updatedData: currentData
    };
  } catch (error) {
    console.error("Error:", error.message);
    throw new Error(`Error al actualizar datos en Redis: ${error.message}`);
  }
}

async function DeleteOnePricesHistoryRedis(req) {
  try {
    const key = req.req.query?.key;
    const tipoBorrado = req.req.query?.borrado;
    const user = req.req.query?.user || "system_user";

    if (!key) {
      throw new Error("El parámetro 'key' es obligatorio.");
    }

    if (tipoBorrado !== "logic" && tipoBorrado !== "fisic") {
      throw new Error("El parámetro 'borrado' debe ser 'logic' o 'fisic'.");
    }

    const exists = await cliente.exists(key);
    if (!exists) {
      throw new Error(`La clave '${key}' no existe en Redis.`);
    }

    const currentDataStr = await cliente.get(key);
    const currentData = JSON.parse(currentDataStr);

    if (!Array.isArray(currentData.DETAIL_ROW)) {
      throw new Error("No se encontró la propiedad DETAIL_ROW en el objeto.");
    }

    // Obtener fecha y hora actuales
    const now = new Date();
    const regDate = now.toISOString().split("T")[0]; // yyyy-mm-dd
    const regTime = now.toTimeString().split(" ")[0]; // hh:mm:ss

    // Aplicar tipo de borrado y actualizar estado
    currentData.DETAIL_ROW = currentData.DETAIL_ROW.map((row) => {
      // Asegurar que tenga un arreglo de historial
      if (!Array.isArray(row.DETAIL_ROW_REG)) {
        row.DETAIL_ROW_REG = [];
      }

      // Desactivar registros anteriores
      row.DETAIL_ROW_REG.forEach((r) => {
        r.CURRENT = false;
      });

      // Agregar nuevo registro
      row.DETAIL_ROW_REG.push({
        CURRENT: true,
        REGDATE: regDate,
        REGTIME: regTime,
        REGUSER: user,
      });

      // Marcar estados
      row.ACTIVED = false;
      if (tipoBorrado === "fisic") {
        row.DELETED = true;
      }

      return row;
    });

    // Guardar en Redis
    await cliente.set(key, JSON.stringify(currentData));

    return {
      message: `La clave '${key}' fue marcada como eliminada (${tipoBorrado === "logic" ? "lógica" : "física"}) exitosamente.`,
      updatedData: currentData,
    };
  } catch (error) {
    throw new Error(`Error al eliminar datos de Redis: ${error.message}`);
  }
}

module.exports = {
  GetAllPricesHistory,
  AddOnePricesHistory,
  UpdateOnePriceHistory,
  DeleteOnePriceHistory,
  GetRedis,
  AddOnePricesHistoryRedis,
  UpdateOnePriceHistoryRedis,
  DeleteOnePricesHistoryRedis,
  GetLabelsWithValues,
};
