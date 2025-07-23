const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password:String,
  events: [String],
  referalID:String,
  referalcount:{
    type:Number,
    default:0
  },
  qrPath:String,
  isvalidated:{
    type:Boolean,
    default:false
  },
  hasEntered:{
    type:Boolean,
    default:false
  },
  entryTime:{
    type:Date,
    default:null
  },
  isAdmin:{
    type:Boolean,
    default:false
  }
});

const eventSchema = new mongoose.Schema({
  name: String,
  mobile: String,
  link: String,
  coordinator:String,
  timings:String,
  date: String,
  whatsappLink: String
});

const User = mongoose.model("User", userSchema);
const Event = mongoose.model("Event", eventSchema);

module.exports = { User, Event };
