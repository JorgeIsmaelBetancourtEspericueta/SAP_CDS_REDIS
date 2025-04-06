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

//Obtener información de los usuarios
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

module.exports = {
  GetLabelsWithValues,
  GetUserInfo,
};
