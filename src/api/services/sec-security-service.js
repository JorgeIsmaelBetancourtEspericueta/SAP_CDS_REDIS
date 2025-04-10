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

// Servicio para obtener usuarios con sus roles, procesos, vistas y aplicaciones
async function GetUserInfo(req) {
  try {
    let result;

    const userid = req?.req?.query?.userid;

    if (!userid) {
      result = await mongoose.connection
        .collection("ZTUSERS")
        .aggregate([
          {
            $lookup: {
              from: "ZTROLES",
              localField: "ROLES.ROLEID",
              foreignField: "ROLEID",
              as: "ROLE_DETAILS",
            },
          },
          { $unwind: "$ROLES" },
          {
            $addFields: {
              ROLE_DETAIL: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$ROLE_DETAILS",
                      as: "detail",
                      cond: { $eq: ["$$detail.ROLEID", "$ROLES.ROLEID"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
          { $unwind: "$ROLE_DETAIL.PRIVILEGES" },
          {
            $lookup: {
              from: "ZTVALUES",
              let: { processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$LABELID", "IdProcesses"] },
                        {
                          $eq: [
                            { $concat: ["IdProcess-", "$VALUEID"] },
                            "$$processId",
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  $lookup: {
                    from: "ZTVALUES",
                    let: { viewId: "$VALUEPAID" },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ["$LABELID", "IdViews"] },
                              {
                                $eq: [
                                  { $concat: ["IdViews-", "$VALUEID"] },
                                  "$$viewId",
                                ],
                              },
                            ],
                          },
                        },
                      },
                      {
                        $lookup: {
                          from: "ZTVALUES",
                          let: { appId: "$VALUEPAID" },
                          pipeline: [
                            {
                              $match: {
                                $expr: {
                                  $and: [
                                    { $eq: ["$LABELID", "IdApplications"] },
                                    {
                                      $eq: [
                                        {
                                          $concat: [
                                            "IdApplications-",
                                            "$VALUEID",
                                          ],
                                        },
                                        "$$appId",
                                      ],
                                    },
                                  ],
                                },
                              },
                            },
                          ],
                          as: "application",
                        },
                      },
                      {
                        $addFields: {
                          application: { $arrayElemAt: ["$application", 0] },
                        },
                      },
                    ],
                    as: "view",
                  },
                },
                {
                  $addFields: {
                    view: { $arrayElemAt: ["$view", 0] },
                  },
                },
              ],
              as: "PROCESS_INFO",
            },
          },
          {
            $addFields: {
              PROCESS_INFO: { $arrayElemAt: ["$PROCESS_INFO", 0] },
            },
          },
          {
            $group: {
              _id: {
                userId: "$_id",
                roleId: "$ROLES.ROLEID",
                processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
              },
              PROCESS: {
                $first: {
                  PROCESSID: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
                  PROCESSNAME: "$PROCESS_INFO.VALUE",
                  VIEWID: "$PROCESS_INFO.view.VALUEID",
                  VIEWNAME: "$PROCESS_INFO.view.VALUE",
                  APPLICATIONID: "$PROCESS_INFO.view.application.VALUEID",
                  APPLICATIONNAME: "$PROCESS_INFO.view.application.VALUE",
                  PRIVILEGES: {
                    $map: {
                      input: "$ROLE_DETAIL.PRIVILEGES.PRIVILEGEID",
                      as: "privId",
                      in: {
                        PRIVILEGEID: "$$privId",
                        PRIVILEGENAME: "$$privId",
                      },
                    },
                  },
                },
              },
              ROLE_META: { $first: "$ROLES" },
              ROLE_DETAILS: {
                $first: {
                  ROLEID: "$ROLE_DETAIL.ROLEID",
                  ROLENAME: "$ROLE_DETAIL.ROLENAME",
                  DESCRIPTION: "$ROLE_DETAIL.DESCRIPTION",
                  DETAIL_ROW: "$ROLE_DETAIL.DETAIL_ROW",
                },
              },
              USER: { $first: "$$ROOT" },
            },
          },
          {
            $group: {
              _id: {
                userId: "$_id.userId",
                roleId: "$_id.roleId",
              },
              ROLEID: { $first: "$ROLE_META.ROLEID" },
              ROLEIDSAP: { $first: "$ROLE_META.ROLEIDSAP" },
              ROLENAME: { $first: "$ROLE_DETAILS.ROLENAME" },
              DESCRIPTION: { $first: "$ROLE_DETAILS.DESCRIPTION" },
              DETAIL_ROW: { $first: "$ROLE_DETAILS.DETAIL_ROW" },
              PROCESSES: { $push: "$PROCESS" },
              USER: { $first: "$USER" },
            },
          },
          {
            $group: {
              _id: "$_id.userId",
              ROLES: {
                $push: {
                  ROLEID: "$ROLEID",
                  ROLEIDSAP: "$ROLEIDSAP",
                  ROLENAME: "$ROLENAME",
                  DESCRIPTION: "$DESCRIPTION",
                  DETAIL_ROW: "$DETAIL_ROW",
                  PROCESSES: "$PROCESSES",
                },
              },
              USER: { $first: "$USER" },
            },
          },
          {
            $project: {
              _id: 0,
              USERID: "$USER.USERID",
              PASSWORD: "$USER.PASSWORD",
              USERNAME: "$USER.USERNAME",
              ALIAS: "$USER.ALIAS",
              FIRSTNAME: "$USER.FIRSTNAME",
              LASTNAME: "$USER.LASTNAME",
              BIRTHDAYDATE: "$USER.BIRTHDAYDATE",
              COMPANYID: "$USER.COMPANYID",
              COMPANYNAME: "$USER.COMPANYNAME",
              COMPANYALIAS: "$USER.COMPANYALIAS",
              CEDIID: "$USER.CEDIID",
              EMPLOYEEID: "$USER.EMPLOYEEID",
              EMAIL: "$USER.EMAIL",
              PHONENUMBER: "$USER.PHONENUMBER",
              EXTENSION: "$USER.EXTENSION",
              DEPARTMENT: "$USER.DEPARTMENT",
              FUNCTION: "$USER.FUNCTION",
              STREET: "$USER.STREET",
              POSTALCODE: "$USER.POSTALCODE",
              CITY: "$USER.CITY",
              REGION: "$USER.REGION",
              STATE: "$USER.STATE",
              COUNTRY: "$USER.COUNTRY",
              AVATAR: "$USER.AVATAR",
              DETAIL_ROW: "$USER.DETAIL_ROW",
              ROLES: "$ROLES",
            },
          },
        ])
        .toArray();
    } else {
      result = await mongoose.connection
        .collection("ZTUSERS")
        .aggregate([
          {
            $match: { USERID: userid },
          },
          // Aquí va exactamente el mismo pipeline que en el if anterior
          {
            $lookup: {
              from: "ZTROLES",
              localField: "ROLES.ROLEID",
              foreignField: "ROLEID",
              as: "ROLE_DETAILS",
            },
          },
          { $unwind: "$ROLES" },
          {
            $addFields: {
              ROLE_DETAIL: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$ROLE_DETAILS",
                      as: "detail",
                      cond: { $eq: ["$$detail.ROLEID", "$ROLES.ROLEID"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
          { $unwind: "$ROLE_DETAIL.PRIVILEGES" },
          {
            $lookup: {
              from: "ZTVALUES",
              let: { processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$LABELID", "IdProcesses"] },
                        {
                          $eq: [
                            { $concat: ["IdProcess-", "$VALUEID"] },
                            "$$processId",
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  $lookup: {
                    from: "ZTVALUES",
                    let: { viewId: "$VALUEPAID" },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ["$LABELID", "IdViews"] },
                              {
                                $eq: [
                                  { $concat: ["IdViews-", "$VALUEID"] },
                                  "$$viewId",
                                ],
                              },
                            ],
                          },
                        },
                      },
                      {
                        $lookup: {
                          from: "ZTVALUES",
                          let: { appId: "$VALUEPAID" },
                          pipeline: [
                            {
                              $match: {
                                $expr: {
                                  $and: [
                                    { $eq: ["$LABELID", "IdApplications"] },
                                    {
                                      $eq: [
                                        {
                                          $concat: [
                                            "IdApplications-",
                                            "$VALUEID",
                                          ],
                                        },
                                        "$$appId",
                                      ],
                                    },
                                  ],
                                },
                              },
                            },
                          ],
                          as: "application",
                        },
                      },
                      {
                        $addFields: {
                          application: { $arrayElemAt: ["$application", 0] },
                        },
                      },
                    ],
                    as: "view",
                  },
                },
                {
                  $addFields: {
                    view: { $arrayElemAt: ["$view", 0] },
                  },
                },
              ],
              as: "PROCESS_INFO",
            },
          },
          {
            $addFields: {
              PROCESS_INFO: { $arrayElemAt: ["$PROCESS_INFO", 0] },
            },
          },
          {
            $group: {
              _id: {
                userId: "$_id",
                roleId: "$ROLES.ROLEID",
                processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
              },
              PROCESS: {
                $first: {
                  PROCESSID: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
                  PROCESSNAME: "$PROCESS_INFO.VALUE",
                  VIEWID: "$PROCESS_INFO.view.VALUEID",
                  VIEWNAME: "$PROCESS_INFO.view.VALUE",
                  APPLICATIONID: "$PROCESS_INFO.view.application.VALUEID",
                  APPLICATIONNAME: "$PROCESS_INFO.view.application.VALUE",
                  PRIVILEGES: {
                    $map: {
                      input: "$ROLE_DETAIL.PRIVILEGES.PRIVILEGEID",
                      as: "privId",
                      in: {
                        PRIVILEGEID: "$$privId",
                        PRIVILEGENAME: "$$privId",
                      },
                    },
                  },
                },
              },
              ROLE_META: { $first: "$ROLES" },
              ROLE_DETAILS: {
                $first: {
                  ROLEID: "$ROLE_DETAIL.ROLEID",
                  ROLENAME: "$ROLE_DETAIL.ROLENAME",
                  DESCRIPTION: "$ROLE_DETAIL.DESCRIPTION",
                  DETAIL_ROW: "$ROLE_DETAIL.DETAIL_ROW",
                },
              },
              USER: { $first: "$$ROOT" },
            },
          },
          {
            $group: {
              _id: {
                userId: "$_id.userId",
                roleId: "$_id.roleId",
              },
              ROLEID: { $first: "$ROLE_META.ROLEID" },
              ROLEIDSAP: { $first: "$ROLE_META.ROLEIDSAP" },
              ROLENAME: { $first: "$ROLE_DETAILS.ROLENAME" },
              DESCRIPTION: { $first: "$ROLE_DETAILS.DESCRIPTION" },
              DETAIL_ROW: { $first: "$ROLE_DETAILS.DETAIL_ROW" },
              PROCESSES: { $push: "$PROCESS" },
              USER: { $first: "$USER" },
            },
          },
          {
            $group: {
              _id: "$_id.userId",
              ROLES: {
                $push: {
                  ROLEID: "$ROLEID",
                  ROLEIDSAP: "$ROLEIDSAP",
                  ROLENAME: "$ROLENAME",
                  DESCRIPTION: "$DESCRIPTION",
                  DETAIL_ROW: "$DETAIL_ROW",
                  PROCESSES: "$PROCESSES",
                },
              },
              USER: { $first: "$USER" },
            },
          },
          {
            $project: {
              _id: 0,
              USERID: "$USER.USERID",
              PASSWORD: "$USER.PASSWORD",
              USERNAME: "$USER.USERNAME",
              ALIAS: "$USER.ALIAS",
              FIRSTNAME: "$USER.FIRSTNAME",
              LASTNAME: "$USER.LASTNAME",
              BIRTHDAYDATE: "$USER.BIRTHDAYDATE",
              COMPANYID: "$USER.COMPANYID",
              COMPANYNAME: "$USER.COMPANYNAME",
              COMPANYALIAS: "$USER.COMPANYALIAS",
              CEDIID: "$USER.CEDIID",
              EMPLOYEEID: "$USER.EMPLOYEEID",
              EMAIL: "$USER.EMAIL",
              PHONENUMBER: "$USER.PHONENUMBER",
              EXTENSION: "$USER.EXTENSION",
              DEPARTMENT: "$USER.DEPARTMENT",
              FUNCTION: "$USER.FUNCTION",
              STREET: "$USER.STREET",
              POSTALCODE: "$USER.POSTALCODE",
              CITY: "$USER.CITY",
              REGION: "$USER.REGION",
              STATE: "$USER.STATE",
              COUNTRY: "$USER.COUNTRY",
              AVATAR: "$USER.AVATAR",
              DETAIL_ROW: "$USER.DETAIL_ROW",
              ROLES: "$ROLES",
            },
          },
        ])
        .toArray();
    }

    return result;
  } catch (error) {
    console.error(
      "Error en la agregación de usuario-rol-proceso:",
      error.message
    );
    throw error;
  }
}

// Servicio para crear un nuevo usuario
async function CreateUser(req) {
  try {
    const {
      USERID,
      USERNAME,
      ALIAS,
      FIRSTNAME,
      LASTNAME,
      BIRTHDAYDATE,
      COMPANYID,
      COMPANYNAME,
      COMPANYALIAS,
      CEDIID,
      EMPLOYEEID,
      EMAIL,
      PHONENUMBER,
      EXTENSION,
      DEPARTMENT,
      FUNCTION,
      STREET,
      POSTALCODE,
      CITY,
      REGION,
      STATE,
      COUNTRY,
      ROLES,
      reguser,
    } = req?.req?.body?.users; // Accediendo a la clave "users"

    // Obtener la fecha y hora actual
    const currentDate = new Date();

    // Crear el objeto de DETAIL_ROW_REG con el registro actual
    const detailRowReg = [
      {
        CURRENT: false,
        REGDATE: currentDate,
        REGTIME: currentDate,
        REGUSER: reguser,
      },
      {
        CURRENT: true,
        REGDATE: currentDate,
        REGTIME: currentDate,
        REGUSER: reguser,
      },
    ];

    // Crear el nuevo objeto de usuario
    const newUser = {
      USERID,
      USERNAME,
      ALIAS: ALIAS || "",
      FIRSTNAME,
      LASTNAME,
      BIRTHDAYDATE: BIRTHDAYDATE || "",
      COMPANYID: COMPANYID || "",
      COMPANYNAME: COMPANYNAME || "",
      COMPANYALIAS: COMPANYALIAS || "",
      CEDIID: CEDIID || "",
      EMPLOYEEID: EMPLOYEEID || "",
      EMAIL,
      PHONENUMBER: PHONENUMBER || "",
      EXTENSION: EXTENSION || "",
      DEPARTMENT: DEPARTMENT || "",
      FUNCTION: FUNCTION || "",
      STREET: STREET || "",
      POSTALCODE: POSTALCODE || "",
      CITY: CITY || "",
      REGION: REGION || "",
      STATE: STATE || "",
      COUNTRY: COUNTRY || "",
      DETAIL_ROW_REG: detailRowReg, // Agregar el detalle de registro
      ROLES: ROLES || [], // Roles asignados al usuario
    };

    // Insertar el nuevo usuario en la colección
    const result = await mongoose.connection
      .collection("ZTUSERS")
      .insertOne(newUser);

    return {
      message: "Usuario creado exitosamente",
      userId: result.insertedId,
    };
  } catch (error) {
    console.error("Error al crear el usuario:", error.message);
    throw error;
  }
}

// Servicio para borrado lógico de un usuario
async function DeleteUserLogic(req) {
  try {
    const userid = req?.req?.query?.userid;

    if (!userid) {
      throw new Error("Falta el parámetro requerido: 'userid'");
    }

    const currentDate = new Date();
    const newDetailReg = {
      CURRENT: true,
      REGDATE: currentDate,
      REGTIME: currentDate,
    };

    const collection = mongoose.connection.collection("ZTUSERS");

    // Paso 1: Desactivar el campo CURRENT en registros anteriores
    await collection.updateOne(
      { USERID: userid },
      {
        $set: {
          "DETAIL_ROW.DETAIL_ROW_REG.$[elem].CURRENT": false,
          "DETAIL_ROW.ACTIVED": false,
        },
      },
      {
        arrayFilters: [{ "elem.CURRENT": true }],
      }
    );

    // Paso 2: Agregar nuevo registro
    const result = await collection.updateOne(
      { USERID: userid },
      {
        $push: {
          "DETAIL_ROW.DETAIL_ROW_REG": {
            $each: [newDetailReg],
            $position: 0,
          },
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new Error("Usuario no encontrado");
    }

    return {
      message: "Usuario desactivado (borrado lógico) exitosamente",
      matched: result.matchedCount,
      modified: result.modifiedCount,
    };
  } catch (error) {
    console.error("Error en el borrado lógico del usuario:", error.message);
    throw error;
  }
}

// Servicio para borrado físico de un usuario
async function PhysicalDeleteUser(req) {
  try {
    const userid = req?.req?.query?.userid;

    if (!userid) {
      throw new Error("Falta el parámetro requerido: 'userid'");
    }

    const currentDate = new Date();

    // Crear el nuevo registro para DETAIL_ROW_REG (opcional si deseas mantener un historial)
    const newDetailReg = {
      CURRENT: true,
      REGDATE: currentDate,
      REGTIME: currentDate,
    };

    const collection = mongoose.connection.collection("ZTUSERS");

    // Paso 1: Desactivar el campo CURRENT en registros anteriores
    await collection.updateOne(
      { USERID: userid },
      {
        $set: {
          "DETAIL_ROW.DETAIL_ROW_REG.$[elem].CURRENT": false, // Cambiar CURRENT a false en registros previos
          "DETAIL_ROW.DELETED": true, // Modificar el campo DELETED a true
        },
      },
      {
        arrayFilters: [{ "elem.CURRENT": true }], // Filtrar los registros que estén marcados como CURRENT
      }
    );

    // Paso 2: Agregar el nuevo registro a DETAIL_ROW_REG (opcional)
    const result = await collection.updateOne(
      { USERID: userid },
      {
        $push: {
          "DETAIL_ROW.DETAIL_ROW_REG": {
            $each: [newDetailReg],
            $position: 0, // Insertar al inicio del arreglo
          },
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new Error("Usuario no encontrado");
    }

    return {
      message: "Usuario marcado como eliminado (borrado físico) exitosamente",
      matched: result.matchedCount,
      modified: result.modifiedCount,
    };
  } catch (error) {
    console.error("Error en el borrado físico del usuario:", error.message);
    throw error;
  }
}

// Servicio para eliminar un registro de la colección correspondiente (por query params)

async function DeleteRecord(req) {
  try {
    // Extraer los parámetros del request
    const { roleid, valueid, labelid, userid, borrado } = req?.req?.query || {};

    // Validación: al menos un ID debe estar presente
    if (!labelid && !userid && !roleid && !valueid) {
      throw new Error("Se debe proporcionar al menos un ID para eliminar");
    }

    const currentDate = new Date();

    // Función para marcar como eliminado según tipo (lógico o físico)
    const deleteFromCollection = async (collection, fieldName, value) => {
      const filter = { [fieldName]: value };

      // Campos a modificar según el tipo de eliminación
      const updateFields = {
        "DETAIL_ROW.ACTIVED": false,
        "DETAIL_ROW.DELETED": true,
        "DETAIL_ROW.DELETEDDATE": currentDate,
      };

      if (borrado !== "fisic") {
        updateFields["DETAIL_ROW.DELETED"] = false;
      }

      const result = await mongoose.connection
        .collection(collection)
        .updateOne(filter, { $set: updateFields });

      if (result.modifiedCount === 0) {
        throw new Error(
          `No se pudo actualizar el registro en la colección ${collection}`
        );
      }

      return {
        message: `Registro marcado como eliminado ${
          borrado === "fisic" ? "físicamente" : "lógicamente"
        } en la colección ${collection}`,
      };
    };

    // Lógica según qué ID se proporciona (usa claves personalizadas en mayúsculas)
    if (labelid)
      return await deleteFromCollection("ZTLABELS", "LABELID", labelid);
    if (userid) return await deleteFromCollection("ZTUSERS", "USERID", userid);
    if (roleid) return await deleteFromCollection("ZTROLES", "ROLEID", roleid);
    if (valueid)
      return await deleteFromCollection("ZTVALUE", "VALUEID", valueid);
  } catch (error) {
    console.error("Error al eliminar el registro:", error.message);
    throw error;
  }
}

module.exports = {
  GetLabelsWithValues,
  GetUserInfo,
  CreateUser,
  DeleteRecord,
};
