const mongoose = require("mongoose");

// Servicio para hacer el lookup entre ZTLABELS y ZTVALUES
async function GetLabelsWithValues(req) {
  try {
    const labelid = req?.req?.query?.labelid;
    const valueid = req?.req?.query?.valueid;

    let result;

    if (!labelid && !valueid) {
      // Caso 1: No hay labelid ni valueid
      result = await mongoose.connection
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
    } else if (labelid && !valueid) {
      // Caso 2: Solo hay labelid
      result = await mongoose.connection
        .collection("ZTLABELS")
        .aggregate([
          {
            $match: { LABELID: labelid },
          },
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
    } else if (labelid && valueid) {
      // Caso 3: Hay labelid y valueid
      result = await mongoose.connection
        .collection("ZTLABELS")
        .aggregate([
          {
            $match: { LABELID: labelid },
          },
          {
            $lookup: {
              from: "ZTVALUES",
              localField: "LABELID",
              foreignField: "LABELID",
              as: "VALUES",
            },
          },
          {
            $addFields: {
              VALUES: {
                $filter: {
                  input: "$VALUES",
                  as: "val",
                  cond: { $eq: ["$$val.VALUEID", valueid] },
                },
              },
            },
          },
        ])
        .toArray();
    }

    return result;
  } catch (error) {
    console.error("Error en la agregación con $lookup:", error.message);
    throw error;
  }
}

module.exports = {
  GetLabelsWithValues,
};
