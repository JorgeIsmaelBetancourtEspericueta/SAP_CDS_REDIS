const mongoose = require("mongoose");

const PRICEHISTORYSCHEMA = new mongoose.Schema({
  ID: {
    type: Number,
    required: true,
  },
  DATE: {
    type: Date,
    required: true,
  },
  OPEN: {
    type: Decimal,
    required: true,
  },
  HIGH: {
    type: Decimal,
    required: true,
  },
  LOW: {
    type: Decimal,
    required: true,
  },
  CLOSE: {
    type: Decimal,
    required: true,
  },
  VOLUME: {
    type: Decimal,
    required: true,
  },
});

export default mongoose.model(
  "ZTPRICEHISTORY",
  PRICEHISTORYSCHEMA,
  "ZTPRICESHISTORY"
);
