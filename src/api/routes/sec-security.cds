// 1. Import the data model
// using {inv as myph} from '../models/inv-priceshistory';

using {inv as myinv} from '../models/inv-inversions';

// 2. Import the controller to implement the Logic

@impl: 'src/api/controllers/sec-security-controller'

// 3. Define the method to expose the routes
// for all APIs of prices history

service securityRouter @(path: '/api/sec') {

    // 4. Instance the prices history entity
    entity priceshistory as projection on myinv.priceshistory;


    @Core.Description: 'get-Catalog'
    @path            : 'getCatalog'
    function getCatalog() returns array of priceshistory;

};
