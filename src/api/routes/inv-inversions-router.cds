// 1. Import the data model
// using {inv as myph} from '../models/inv-priceshistory';

using {inv as myinv} from '../models/inv-inversions';

// 2. Import the controller to implement the Logic

@impl: 'src/api/controllers/inv-inversions-controller.js'

// 3. Define the method to expose the routes
// for all APIs of prices history

service PricesHistoryRouter @(path: '/api/inv') {

    // 4. Instance the prices history entity
    //entity priceshistory as projection on myph.priceshistory;
    entity strategies as projection on myinv.strategies;
    entity priceshistory as projection on myinv.priceshistory;

    // 5. Define the route for API Get All Prices History
    // LocalHost:3333/api/inv/priceshisory/getall
    // Important: Don't forget that function name must be the same as the path

    @Core.Description: 'get-all-prices-history'
    @path            : 'getall'
    function getall() returns array of priceshistory;

};
