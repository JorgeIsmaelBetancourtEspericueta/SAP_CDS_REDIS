//Import libraries

const cds = require("@sap/cds");

const {GetAllPricesHistory} = require("../services/inv-pricehistory-services");
//Principal structure controller class

class InversionsClass extends cds.ApplicationService {
  //Constructor
  async init() {
    //Call method handler the parent constructor
    this.on("getall", async (req) => {
      // call the service method and return the result to route.
      return GetAllPricesHistory(req);
    });
    //If not execute any method, the system will return the defsult CSV data model.
    //gets local data and returns the metadata with the route localhost:3333/api/inv/priceshistory
    //Note: the file name with extension .csv must called equal than the data model;
    //otherwhise, it will not be found

    return await super.init();
  }
}

// Export the controller class
module.exports = InversionsClass;
