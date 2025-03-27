const ztpricehistory = require('../models/mongoDB/ztpricehistory');

async function GetAllPricesHistory(req){
    try{
        let pricehistory;
        pricehistory = await ztpricehistory.find().lean();
        console.log(pricehistory);
        return(pricehistory);
    }catch(error){
        return error;
    } finally {

    }
}

module.exports = {GetAllPricesHistory};