//Import libraries

const cds = require("@sap/cds");

const {
  GetLabelsWithValues,
} = require("../services/sec-security-service");
//Principal structure controller class

class InversionsClass extends cds.ApplicationService {
  //Constructor
  async init() {
   
    this.on("getCatalog", async (req) => {
      // call the service method and return the result to route.
      return GetLabelsWithValues(req);
    });

    return await super.init();
  }
}

// Export the controller class
module.exports = InversionsClass;
